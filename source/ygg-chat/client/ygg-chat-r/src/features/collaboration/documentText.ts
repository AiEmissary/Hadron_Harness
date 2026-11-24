import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { HADRON_DOCUMENT_MAX_CHARS } from '../../../../../shared/hadronDocuments'
const LIMIT_TEXT = HADRON_DOCUMENT_MAX_CHARS.toLocaleString('en-GB')

/** Pages with less real text than this may be scans; the desktop reader then applies OCR to them. */
const SCANNED_PAGE_TEXT = 20

/** Read through the desktop app's background process (the same reader as shared folders). */
async function readInDesktop(read: (bytes: Uint8Array) => Promise<string>, buffer: ArrayBuffer, fallback: string) {
  try { return await read(new Uint8Array(buffer)) }
  catch (error) { throw new Error((error instanceof Error ? error.message : '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || fallback) }
}

/** Text extraction only: no document scripts, HTML rendering, remote workers or provider requests. */
export async function readDocumentText(extension: string, buffer: ArrayBuffer): Promise<string> {
  if (extension === '.doc') {
    const read = window.electronAPI?.collaboration?.wordDocText
    if (!read) throw new Error('Old Word (.doc) files can be read in the Hadron desktop app only.')
    return readInDesktop(read, buffer, 'This Word document could not be read.')
  }
  if (extension === '.docx') {
    const mammoth = await import('mammoth')
    const result = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: buffer })
    if (result.value.length > HADRON_DOCUMENT_MAX_CHARS) throw new Error(`The document text exceeds Hadron's ${LIMIT_TEXT}-character document limit.`)
    return result.value
  }
  const pdf = await import('pdfjs-dist')
  pdf.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  // pdf.js may hand the bytes to its worker (detaching them), so keep a copy for the OCR reader.
  const original = buffer.slice(0)
  const loading = pdf.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useWorkerFetch: false, disableFontFace: true })
  const timer = setTimeout(() => { void loading.destroy() }, 120000)
  let text = '', foundText = false, maybeScanned = false
  try {
    const document = await loading.promise
    if (document.numPages > 2000) throw new Error('Choose a PDF with no more than 2,000 pages.')
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index), content = await page.getTextContent()
      const pageText = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('')
      if (pageText.trim()) foundText = true
      if (pageText.replace(/\s/g, '').length < SCANNED_PAGE_TEXT) maybeScanned = true
      text += `\n\nPage ${index}\n` + pageText
      page.cleanup()
      if (text.length > HADRON_DOCUMENT_MAX_CHARS) throw new Error(`The PDF text exceeds Hadron's ${LIMIT_TEXT}-character document limit.`)
    }
  } finally { clearTimeout(timer); await loading.destroy() }
  // Pages that may be scans go to the desktop reader, which recognises them with OCR on this PC.
  const readScans = typeof window === 'undefined' ? undefined : window.electronAPI?.collaboration?.pdfText
  if (maybeScanned && readScans) return readInDesktop(readScans, original, 'This PDF could not be read.')
  // Page headings alone must not masquerade as extracted content (e.g. scanned PDFs).
  if (!foundText) throw new Error('No readable PDF text found. Scanned pages can be read with OCR in the Hadron desktop app.')
  return text.trim()
}
