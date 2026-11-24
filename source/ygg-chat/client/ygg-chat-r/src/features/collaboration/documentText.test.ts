import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: { workerSrc: '' }, getDocument: vi.fn() }))
vi.mock('mammoth', () => ({ default: { extractRawText: vi.fn(async () => ({ value: 'Word text' })) } }))
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { readDocumentText } from './documentText'
beforeEach(() => vi.clearAllMocks())
function pdf(items: any[], pages = 1) {
  const destroy = vi.fn(async () => {}), cleanup = vi.fn()
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve({ numPages: pages, getPage: async () => ({ getTextContent: async () => ({ items }), cleanup }) }), destroy } as any)
  return { destroy, cleanup }
}
it('extracts text with a bundled worker and releases the PDF task', async () => {
  const task = pdf([{ str: 'Document evidence', hasEOL: true }])
  expect(await readDocumentText('.pdf', new ArrayBuffer(0))).toContain('Document evidence')
  expect(GlobalWorkerOptions.workerSrc).not.toMatch(/^https?:/)
  expect(vi.mocked(getDocument).mock.calls[0][0]).toMatchObject({ isEvalSupported: false, useWorkerFetch: false })
  expect(task.destroy).toHaveBeenCalledTimes(1)
  expect(task.cleanup).toHaveBeenCalledTimes(1)
})
it('rejects scanned/empty, oversized and excessive-page PDFs explicitly without leaking workers', async () => {
  const blank = pdf([])
  await expect(readDocumentText('.pdf', new ArrayBuffer(0))).rejects.toThrow('OCR')
  expect(blank.destroy).toHaveBeenCalledTimes(1)
  const fits = pdf([{ str: 'x'.repeat(16001), hasEOL: false }])
  expect((await readDocumentText('.pdf', new ArrayBuffer(0))).length).toBeGreaterThan(16000)
  expect(fits.destroy).toHaveBeenCalledTimes(1)
  const large = pdf([{ str: 'x'.repeat(2_000_001), hasEOL: false }])
  await expect(readDocumentText('.pdf', new ArrayBuffer(0))).rejects.toThrow('document limit')
  expect(large.destroy).toHaveBeenCalledTimes(1)
  const pages = pdf([],2001)
  await expect(readDocumentText('.pdf', new ArrayBuffer(0))).rejects.toThrow('2,000 pages')
  expect(pages.destroy).toHaveBeenCalledTimes(1)
})
it('extracts Word text without rendering document HTML', async () => {
  expect(await readDocumentText('.docx', new ArrayBuffer(0))).toBe('Word text')
  expect(getDocument).not.toHaveBeenCalled()
})

it('sends old Word (.doc) files to the desktop app and returns only the text', async () => {
  const wordDocText = vi.fn(async (bytes: Uint8Array) => `Old Word text (${bytes.byteLength} bytes)`)
  vi.stubGlobal('window', { electronAPI: { collaboration: { wordDocText } } })
  try {
    expect(await readDocumentText('.doc', new Uint8Array([1, 2, 3]).buffer)).toBe('Old Word text (3 bytes)')
    wordDocText.mockRejectedValueOnce(new Error("Error invoking remote method 'collaboration:word-doc-text': Error: This Word document could not be read. It may be damaged"))
    await expect(readDocumentText('.doc', new ArrayBuffer(1))).rejects.toThrow(/^This Word document could not be read/)
    vi.stubGlobal('window', {})
    await expect(readDocumentText('.doc', new ArrayBuffer(1))).rejects.toThrow('desktop app only')
  } finally { vi.unstubAllGlobals() }
})

it('sends PDFs with possibly scanned pages to the desktop OCR reader with their original bytes', async () => {
  const pdfText = vi.fn(async (bytes: Uint8Array) => `Page 1 (text recognised from a scanned image; may contain OCR errors)\nScan text (${bytes.byteLength} bytes)`)
  vi.stubGlobal('window', { electronAPI: { collaboration: { pdfText } } })
  try {
    const scanned = pdf([])
    expect(await readDocumentText('.pdf', new Uint8Array([1, 2, 3, 4]).buffer)).toContain('Scan text (4 bytes)')
    expect(scanned.destroy).toHaveBeenCalledTimes(1)
    // A fully typed PDF is read in the window as before, without the OCR reader.
    pdf([{ str: 'A typed page with plenty of real text on it', hasEOL: true }])
    expect(await readDocumentText('.pdf', new ArrayBuffer(1))).toContain('plenty of real text')
    expect(pdfText).toHaveBeenCalledTimes(1)
    pdf([])
    pdfText.mockRejectedValueOnce(new Error("Error invoking remote method 'collaboration:pdf-text': Error: No readable PDF text found, and text recognition (OCR) found no words on its pages."))
    await expect(readDocumentText('.pdf', new ArrayBuffer(1))).rejects.toThrow(/^No readable PDF text found, and text recognition/)
  } finally { vi.unstubAllGlobals() }
})
