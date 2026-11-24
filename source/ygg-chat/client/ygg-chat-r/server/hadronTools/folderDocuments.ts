import {HADRON_DOCUMENT_MAX_CHARS} from '../../../../shared/hadronDocuments.js'

/** Recently extracted documents by content hash, so reading a long document in parts parses it once. */
const cache=new Map<string,string>()
const CACHE_ENTRIES=4

/** Folder files whose text Hadron extracts instead of reading raw bytes. */
export const folderDocumentKind=(file:string):'pdf'|'docx'|null=>/\.pdf$/i.test(file)?'pdf':/\.docx$/i.test(file)?'docx':null

/**
 * Extract the text of a PDF or Microsoft Word (.docx) file for read-only folder access.
 * Text only: no document scripts, macros, fonts, rendering, network or worker files.
 * PDFs use the same "Page N" layout as attached PDFs.
 */
export async function folderDocumentText(kind:'pdf'|'docx',bytes:Uint8Array,sha256:string,signal:AbortSignal):Promise<string>{
  const key=kind+':'+sha256,cached=cache.get(key)
  if(cached!==undefined){cache.delete(key);cache.set(key,cached);return cached}
  const text=kind==='pdf'?await pdfText(bytes,signal):await docxText(bytes)
  signal.throwIfAborted()
  if(text.length>HADRON_DOCUMENT_MAX_CHARS)throw Error('Document text is larger than Hadron\'s document limit')
  if(!text.trim())throw Error(kind==='pdf'?'No readable PDF text found. Scanned pages need OCR first.':'This Word document has no readable text')
  cache.set(key,text)
  while(cache.size>CACHE_ENTRIES)cache.delete(cache.keys().next().value!)
  return text
}

async function docxText(bytes:Uint8Array):Promise<string>{
  const imported:{default?:typeof import('mammoth')}&typeof import('mammoth')=await import('mammoth')
  const mammoth=imported.default??imported
  try{return (await mammoth.extractRawText({buffer:Buffer.from(bytes)})).value.trim()}
  catch{throw Error('This Word document could not be read (only .docx is supported, not older .doc files)')}
}

/**
 * pdf.js creates a DOMMatrix when it loads, a browser feature the desktop app's
 * background process lacks. Text extraction never draws, so a plain identity
 * matrix is enough. Its optional native canvas package is not shipped with Hadron.
 */
class TextOnlyDOMMatrix{
  a=1;b=0;c=0;d=1;e=0;f=0
  constructor(init?:number[]){if(Array.isArray(init)&&init.length>=6)[this.a,this.b,this.c,this.d,this.e,this.f]=init}
  multiplySelf(){return this}
  preMultiplySelf(){return this}
  translateSelf(){return this}
  scaleSelf(){return this}
  invertSelf(){return this}
}

async function pdfText(bytes:Uint8Array,signal:AbortSignal):Promise<string>{
  const globals=globalThis as Record<string,unknown>
  globals.DOMMatrix??=TextOnlyDOMMatrix
  const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Run the PDF parser on this thread. A bundled app cannot load pdf.js's separate worker file.
  const holder=globalThis as typeof globalThis&{pdfjsWorker?:unknown}
  // @ts-expect-error pdf.js ships no type declarations for its worker module.
  holder.pdfjsWorker??=await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const loading=pdf.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,useSystemFonts:false,verbosity:0})
  const stop=()=>{void loading.destroy()}
  signal.addEventListener('abort',stop,{once:true})
  const timer=setTimeout(stop,120000)
  try{
    const document=await loading.promise
    if(document.numPages>2000)throw Error('PDF has more than 2,000 pages')
    let text='',foundText=false
    for(let index=1;index<=document.numPages;index++){
      signal.throwIfAborted()
      const page=await document.getPage(index),content=await page.getTextContent()
      const pageText=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('')
      if(pageText.trim())foundText=true
      text+=`\n\nPage ${index}\n`+pageText
      page.cleanup()
      if(text.length>HADRON_DOCUMENT_MAX_CHARS)throw Error('Document text is larger than Hadron\'s document limit')
    }
    // Page headings alone must not pass for content (for example scanned pages).
    return foundText?text.trim():''
  }catch(error){
    signal.throwIfAborted()
    // Keep Hadron's own explanations; replace parser internals with one plain message.
    throw error instanceof Error&&/^(PDF has more than|Document text is larger)/.test(error.message)?error:Error('This PDF could not be read')
  }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);await loading.destroy()}
}
