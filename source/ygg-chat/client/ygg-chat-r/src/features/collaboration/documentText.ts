import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PROPOSAL_CONTEXT_MAX_CHARS } from '../../../../../shared/collaboration'

/** Text extraction only: no document scripts, HTML rendering, remote workers or provider requests. */
export async function readDocumentText(extension: string, buffer: ArrayBuffer): Promise<string> {
  if (extension === '.docx') {
    const mammoth = await import('mammoth')
    const result = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: buffer })
    if (result.value.length > PROPOSAL_CONTEXT_MAX_CHARS) throw new Error('The document text exceeds the current shared-context limit.')
    return result.value
  }
  const pdf = await import('pdfjs-dist')
  pdf.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loading = pdf.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useWorkerFetch: false, disableFontFace: true })
  const timer = setTimeout(() => { void loading.destroy() }, 15000)
  try {
    const document = await loading.promise
    if (document.numPages > 100) throw new Error('Choose a PDF with no more than 100 pages.')
    let text = '', foundText = false
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index), content = await page.getTextContent()
      const pageText = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('')
      if (pageText.trim()) foundText = true
      text += `\n\nPage ${index}\n` + pageText
      page.cleanup()
      if (text.length > PROPOSAL_CONTEXT_MAX_CHARS) throw new Error('The PDF text exceeds the current shared-context limit.')
    }
    // Page headings alone must not masquerade as extracted content (e.g. scanned PDFs).
    if (!foundText) throw new Error('No readable PDF text found. Scanned pages need OCR first.')
    return text.trim()
  } finally { clearTimeout(timer); await loading.destroy() }
}
