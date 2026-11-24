import {HADRON_DOCUMENT_MAX_CHARS} from '../../../../shared/hadronDocuments.js'
import {OCR_MAX_PAGES,OCR_PAGE_TEXT_THRESHOLD,pageScanImage,recognisePages,type OcrPageResult,type ScanPage} from './pdfOcr.js'

/** Recently extracted documents by content hash, so reading a long document in parts parses it once. */
const cache=new Map<string,string>()
const CACHE_ENTRIES=4

export type FolderDocumentKind='pdf'|'docx'|'doc'

/** Folder files whose text Hadron extracts instead of reading raw bytes. */
export const folderDocumentKind=(file:string):FolderDocumentKind|null=>{
  const match=/\.(pdf|docx|doc)$/i.exec(file)
  return match?match[1].toLowerCase() as FolderDocumentKind:null
}

/**
 * Extract the text of a PDF or Microsoft Word (.docx, or older .doc) file.
 * Text only: no document scripts, macros, fonts, rendering or network.
 * PDFs use the same "Page N" layout as attached PDFs. Scanned pages (an image but almost no
 * real text) are recognised on this PC with OCR and labelled as such; nothing is sent anywhere.
 */
export async function folderDocumentText(kind:FolderDocumentKind,bytes:Uint8Array,sha256:string,signal:AbortSignal):Promise<string>{
  const key=kind+':'+sha256,cached=cache.get(key)
  if(cached!==undefined){cache.delete(key);cache.set(key,cached);return cached}
  const text=kind==='pdf'?await pdfText(bytes,signal):kind==='doc'?await docText(bytes):await docxText(bytes)
  signal.throwIfAborted()
  if(text.length>HADRON_DOCUMENT_MAX_CHARS)throw Error('Document text is larger than Hadron\'s document limit')
  if(!text.trim())throw Error(kind==='pdf'?'No readable PDF text found, and text recognition (OCR) found no words on its pages.':'This Word document has no readable text')
  cache.set(key,text)
  while(cache.size>CACHE_ENTRIES)cache.delete(cache.keys().next().value!)
  return text
}

async function docxText(bytes:Uint8Array):Promise<string>{
  const imported:{default?:typeof import('mammoth')}&typeof import('mammoth')=await import('mammoth')
  const mammoth=imported.default??imported
  try{return (await mammoth.extractRawText({buffer:Buffer.from(bytes)})).value.trim()}
  catch{throw Error('This Word document could not be read')}
}

interface WordDocument{getBody():string;getFootnotes():string;getEndnotes():string}

/** Word 97-2003 (.doc). Footnotes and endnotes follow the main text under their own headings. */
async function docText(bytes:Uint8Array):Promise<string>{
  // @ts-expect-error word-extractor ships no type declarations.
  const imported=await import('word-extractor')
  const WordExtractor=(imported.default??imported) as new()=>{extract(source:Buffer):Promise<WordDocument>}
  let document:WordDocument
  try{document=await new WordExtractor().extract(Buffer.from(bytes))}
  catch{throw Error('This Word document could not be read. It may be damaged, password-protected or not really a .doc file.')}
  const part=(title:string,text:string)=>text.trim()?`\n\n${title}\n${text.trim()}`:''
  return (document.getBody().trim()+part('Footnotes',document.getFootnotes())+part('Endnotes',document.getEndnotes())).trim()
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

const SCAN_NOTES:Record<Extract<OcrPageResult,{skipped:string}>['skipped'],string>={
  limit:`[Scanned page not read: Hadron recognises up to ${OCR_MAX_PAGES} scanned pages per document]`,
  time:'[Scanned page not read: text recognition ran out of time for this document]',
  failed:'[Scanned page could not be recognised]',
}

async function pdfText(bytes:Uint8Array,signal:AbortSignal):Promise<string>{
  const globals=globalThis as Record<string,unknown>
  globals.DOMMatrix??=TextOnlyDOMMatrix
  const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Run the PDF parser on this thread. A bundled app cannot load pdf.js's separate worker file.
  const holder=globalThis as typeof globalThis&{pdfjsWorker?:unknown}
  // @ts-expect-error pdf.js ships no type declarations for its worker module.
  holder.pdfjsWorker??=await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  // Raw image pixels (not browser bitmaps), so scanned pages can be passed to OCR.
  const loading=pdf.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,useSystemFonts:false,isOffscreenCanvasSupported:false,isImageDecoderSupported:false,verbosity:0})
  const stop=()=>{void loading.destroy()}
  signal.addEventListener('abort',stop,{once:true})
  // Parsing has two minutes; scanned pages add text recognition's own bounded time.
  let timer=setTimeout(stop,120000)
  try{
    const document=await loading.promise
    if(document.numPages>2000)throw Error('PDF has more than 2,000 pages')
    const pages:string[]=[],scanned:number[]=[]
    let length=0
    for(let index=1;index<=document.numPages;index++){
      signal.throwIfAborted()
      const page=await document.getPage(index),content=await page.getTextContent()
      const pageText=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('')
      if(pageText.replace(/\s/g,'').length<OCR_PAGE_TEXT_THRESHOLD)scanned.push(index)
      pages[index]=pageText
      page.cleanup()
      length+=pageText.length
      if(length>HADRON_DOCUMENT_MAX_CHARS)throw Error('Document text is larger than Hadron\'s document limit')
    }
    const recognised=new Map<number,OcrPageResult>()
    if(scanned.length){
      clearTimeout(timer);timer=setTimeout(stop,8*60000)
      const image=async(index:number)=>{const page=await document.getPage(index);try{return await pageScanImage(page as unknown as ScanPage,pdf.OPS)}finally{page.cleanup()}}
      for(const [index,result] of await recognisePages(scanned,image,signal))recognised.set(index,result)
    }
    let text='',foundText=false
    for(let index=1;index<=document.numPages;index++){
      const result=recognised.get(index),typed=pages[index].trim()
      if(result&&'text' in result&&result.text){
        foundText=true
        text+=`\n\nPage ${index} (text recognised from a scanned image; may contain OCR errors)\n${typed?typed+'\n':''}${result.text}`
      }else{
        if(typed)foundText=true
        text+=`\n\nPage ${index}\n`+pages[index]+(result&&'skipped' in result?SCAN_NOTES[result.skipped]:'')
      }
      if(text.length>HADRON_DOCUMENT_MAX_CHARS)throw Error('Document text is larger than Hadron\'s document limit')
    }
    // Page headings and notes alone must not pass for content.
    return foundText?text.trim():''
  }catch(error){
    signal.throwIfAborted()
    // Keep Hadron's own explanations; replace parser internals with one plain message.
    throw error instanceof Error&&/^(PDF has more than|Document text is larger)/.test(error.message)?error:Error('This PDF could not be read')
  }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);await loading.destroy()}
}
