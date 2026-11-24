import { createRequire as createModuleRequire } from 'node:module'
import path from 'node:path'

/** Scanned pages Hadron recognises per document, and the time it allows for them. */
export const OCR_MAX_PAGES = 100
const OCR_TIME_MS = 5 * 60_000
const OCR_MAX_PIXELS = 60_000_000
/** Pages with less real text than this, but a scanned image, are recognised with OCR. */
export const OCR_PAGE_TEXT_THRESHOLD = 20

export interface ScanImage { width: number; height: number; gray: Uint8Array }
interface PdfImage { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray }
interface ObjectStore { get(id: string, callback: (value: unknown) => void): void }
export interface ScanPage { getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>; objs: ObjectStore; commonObjs: ObjectStore }

let configured: { workerPath?: string; langPath?: string } = {}
/**
 * The packaged app keeps the OCR worker and English data outside the app archive
 * (resources/hadron-ocr). Development and tests fall back to the installed packages.
 */
export function configureDocumentOcr(options: { workerPath?: string; langPath?: string }) { configured = { ...options } }
function languageFolder() {
  if (configured.langPath) return configured.langPath
  const resolveFrom = createModuleRequire(import.meta.url)
  return path.join(path.dirname(resolveFrom.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int')
}

/** The largest image drawn on a page, as 8-bit grayscale, or null when the page has none worth reading. */
export async function pageScanImage(page: ScanPage, ops: { paintImageXObject: number; paintInlineImageXObject: number }): Promise<ScanImage | null> {
  const list = await page.getOperatorList()
  let best: PdfImage | null = null
  for (let index = 0; index < list.fnArray.length; index++) {
    const fn = list.fnArray[index], args = list.argsArray[index]
    let image: PdfImage | null = null
    if (fn === ops.paintInlineImageXObject) image = args[0] as PdfImage
    else if (fn === ops.paintImageXObject && typeof args[0] === 'string') {
      const id = args[0], store = id.startsWith('g_') ? page.commonObjs : page.objs
      image = await new Promise<PdfImage>(resolve => store.get(id, value => resolve(value as PdfImage)))
    }
    if (image?.data && image.width * image.height > (best ? best.width * best.height : 0)) best = image
  }
  // Ignore logos and icons: a scanned page image is at least a few hundred pixels each way.
  if (!best?.data || best.width < 200 || best.height < 200 || best.width * best.height > OCR_MAX_PIXELS) return null
  return { width: best.width, height: best.height, gray: toGray(best as Required<PdfImage>) }
}

/** pdf.js image kinds: 1 = 1 bit per pixel (1 is white), 2 = RGB, 3 = RGBA. */
function toGray(image: Required<PdfImage>): Uint8Array {
  const { width, height, data, kind } = image, gray = new Uint8Array(width * height)
  if (kind === 1) {
    const rowBytes = (width + 7) >> 3
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) gray[y * width + x] = data[y * rowBytes + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0
  } else {
    const step = kind === 3 ? 4 : 3
    for (let p = 0; p < gray.length; p++) gray[p] = (data[p * step] * 299 + data[p * step + 1] * 587 + data[p * step + 2] * 114) / 1000
  }
  return gray
}

/** A binary PGM image, which the OCR engine's image reader accepts directly. */
const pgm = (image: ScanImage) => Buffer.concat([Buffer.from(`P5\n${image.width} ${image.height}\n255\n`, 'latin1'), Buffer.from(image.gray.buffer, image.gray.byteOffset, image.gray.byteLength)])

export type OcrPageResult = { text: string } | { skipped: 'limit' | 'time' | 'failed' }

let queue: Promise<unknown> = Promise.resolve()
/** Recognise pages one document at a time, keeping memory bounded. */
export function recognisePages(pages: number[], image: (page: number) => Promise<ScanImage | null>, signal: AbortSignal): Promise<Map<number, OcrPageResult>> {
  const run = queue.then(() => recognise(pages, image, signal))
  queue = run.catch(() => undefined)
  return run
}

async function recognise(pages: number[], image: (page: number) => Promise<ScanImage | null>, signal: AbortSignal) {
  const results = new Map<number, OcrPageResult>()
  type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>
  let worker: Worker | null = null, recognised = 0
  // The engine starts only once a page actually has a scanned image.
  const start = async () => {
    const imported = await import('tesseract.js')
    // CommonJS package: the API is on default when bundled, or on the module itself under Node.
    const tesseract = (imported.default ?? imported) as typeof imported.default
    return tesseract.createWorker('eng', tesseract.OEM.LSTM_ONLY, {
      langPath: languageFolder(), gzip: true, cacheMethod: 'none',
      ...(configured.workerPath ? { workerPath: configured.workerPath } : {}),
      logger: () => undefined, errorHandler: () => undefined,
    })
  }
  const stop = () => { void worker?.terminate() }
  signal.addEventListener('abort', stop, { once: true })
  const deadline = Date.now() + OCR_TIME_MS
  try {
    for (const page of pages) {
      signal.throwIfAborted()
      const scan = await image(page)
      if (!scan) continue
      if (recognised >= OCR_MAX_PAGES) { results.set(page, { skipped: worker ? 'limit' : 'failed' }); continue }
      if (Date.now() > deadline) { results.set(page, { skipped: 'time' }); continue }
      recognised++
      // If the engine cannot start, the typed pages are still returned; scans are marked unread.
      if (!worker) try { worker = await start() } catch (error) {
        signal.throwIfAborted()
        console.warn('[Hadron OCR] Text recognition could not start:', error instanceof Error ? error.message : error)
        results.set(page, { skipped: 'failed' }); recognised = OCR_MAX_PAGES; continue
      }
      signal.throwIfAborted()
      try { results.set(page, { text: (await worker.recognize(pgm(scan))).data.text.trim() }) }
      catch { signal.throwIfAborted(); results.set(page, { skipped: 'failed' }) }
    }
    return results
  } finally { signal.removeEventListener('abort', stop); await worker?.terminate().catch(() => undefined) }
}

/** Release check: the packaged OCR worker and language data load and recognise an image. */
export async function documentOcrReady(signal: AbortSignal = AbortSignal.timeout(60_000)): Promise<boolean> {
  const blank = { width: 200, height: 200, gray: new Uint8Array(200 * 200).fill(255) }
  const result = (await recognisePages([1], async () => blank, signal)).get(1)
  return !!result && 'text' in result
}
