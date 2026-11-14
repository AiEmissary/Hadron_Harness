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
  const large = pdf([{ str: 'x'.repeat(16001), hasEOL: false }])
  await expect(readDocumentText('.pdf', new ArrayBuffer(0))).rejects.toThrow('shared-context limit')
  expect(large.destroy).toHaveBeenCalledTimes(1)
  const pages = pdf([],101)
  await expect(readDocumentText('.pdf', new ArrayBuffer(0))).rejects.toThrow('100 pages')
  expect(pages.destroy).toHaveBeenCalledTimes(1)
})
it('extracts Word text without rendering document HTML', async () => {
  expect(await readDocumentText('.docx', new ArrayBuffer(0))).toBe('Word text')
  expect(getDocument).not.toHaveBeenCalled()
})
