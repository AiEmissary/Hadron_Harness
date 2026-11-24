import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { HADRON_DOCUMENT_MAX_CHARS } from '../../../../../shared/hadronDocuments'
const LIMIT_TEXT = HADRON_DOCUMENT_MAX_CHARS.toLocaleString('en-GB')

/** Text extraction only: no document scripts, HTML rendering, remote workers or provider requests. */
export async function readDocumentText(extension: string, buffer: ArrayBuffer): Promise<string> {
  if (extension === '.doc') {
    // Old Word files are read by the desktop app's background process (the same reader as folders).
    const read = window.electronAPI?.collaboration?.wordDocText
    if (!read) throw new Error('Old Word (.doc) files can be read in the Hadron desktop app only.')
    try { return await read(new Uint8Array(buffer)) }
    catch (error) { throw new Error((error instanceof Error ? error.message : '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'This Word document could not be read.') }
  }
  if (extension === '.docx') {
    const mammoth = await import('mammoth')
    const result = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: buffer })
    if (result.value.length > HADRON_DOCUMENT_MAX_CHARS) throw new Error(`The document text exceeds Hadron's ${LIMIT_TEXT}-character document limit.`)
    return result.value
  }
  const pdf = await import('pdfjs-dist')
  pdf.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loading = pdf.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useWorkerFetch: false, disableFontFace: true })
  const timer = setTimeout(() => { void loading.destroy() }, 120000)
  try {
    const document = await loading.promise
    if (document.numPages > 2000) throw new Error('Choose a PDF with no more than 2,000 pages.')
    let text = '', foundText = false
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index), content = await page.getTextContent()
      const pageText = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('')
      if (pageText.trim()) foundText = true
      text += `\n\nPage ${index}\n` + pageText
      page.cleanup()
      if (text.length > HADRON_DOCUMENT_MAX_CHARS) throw new Error(`The PDF text exceeds Hadron's ${LIMIT_TEXT}-character document limit.`)
    }
    // Page headings alone must not masquerade as extracted content (e.g. scanned PDFs).
    if (!foundText) throw new Error('No readable PDF text found. Scanned pages need OCR first.')
    return text.trim()
  } finally { clearTimeout(timer); await loading.destroy() }
}
