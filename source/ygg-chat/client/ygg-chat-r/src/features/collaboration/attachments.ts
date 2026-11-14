
import {jpegDimensions,parseHadronImages,HADRON_IMAGE_MAX_DATA_URL_LENGTH,type HadronImage} from '../../../../../shared/hadronImages'
export interface SharedAttachment { id: string; name: string; text: string; image?:HadronImage }
export const SHARED_FILE_ACCEPT = '.jpg,.jpeg,.pdf,.docx,.txt,.md,.markdown,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonl,.py,.html,.css,.scss,.xml,.yaml,.yml,.toml,.ini,.log,.sql,.rs,.go,.java,.c,.h,.cpp,.hpp,.cs,.sh,.ps1,.r'
const extensions = new Set(SHARED_FILE_ACCEPT.split(','))

/** Read only files explicitly picked by the user. No paths, disk scanning or HTTP upload. */
export async function readSharedFiles(files: readonly File[], existing: readonly SharedAttachment[] = []): Promise<SharedAttachment[]> {
  if (files.length + existing.length > 5) throw new Error('Choose up to five shared files.')
  const prepared = await Promise.all(files.map(async file => {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!extensions.has(extension)) throw new Error(`${file.name}: choose a JPEG, PDF, Word (.docx), text or code file.`)
    const isDocument = extension === '.pdf' || extension === '.docx'
    const maxBytes = 8 * 1024 * 1024
    if (file.size > maxBytes) throw new Error(`${file.name}: the file exceeds Hadron's 8 MiB attachment limit. ${extension==='.jpg'||extension==='.jpeg'?'Choose a smaller JPEG picture.':'Use Add folder for bounded text excerpts instead.'}`)
    if(extension==='.jpg'||extension==='.jpeg'){
      jpegDimensions(new Uint8Array(await file.arrayBuffer()))
      let bitmap:ImageBitmap
      try{bitmap=await createImageBitmap(file)}catch{throw Error(`${file.name}: this JPEG could not be opened.`)}
      try{
        const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas')
        canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
        const context=canvas.getContext('2d');if(!context)throw Error('Image preview is unavailable.')
        context.drawImage(bitmap,0,0,canvas.width,canvas.height)
        let dataUrl=canvas.toDataURL('image/jpeg',.9)
        for(const quality of [.8,.65,.5]){if(dataUrl.length<=HADRON_IMAGE_MAX_DATA_URL_LENGTH)break;dataUrl=canvas.toDataURL('image/jpeg',quality)}
        while(dataUrl.length>HADRON_IMAGE_MAX_DATA_URL_LENGTH&&Math.max(canvas.width,canvas.height)>512){
          canvas.width=Math.max(1,Math.floor(canvas.width*.8));canvas.height=Math.max(1,Math.floor(canvas.height*.8))
          context.drawImage(bitmap,0,0,canvas.width,canvas.height);dataUrl=canvas.toDataURL('image/jpeg',.8)
        }
        const id=crypto.randomUUID(),image=parseHadronImages([{id,name:file.name,dataUrl}])[0]
        return {id,name:file.name,text:'',image}
      }finally{bitmap.close()}
    }
    let text: string
    if (isDocument) {
      try { text = await (await import('./documentText')).readDocumentText(extension, await file.arrayBuffer()) }
      catch (error) { throw new Error(`${file.name}: ${error instanceof Error ? error.message : 'Document text could not be read.'}`) }
    } else {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()) }
      catch { throw new Error(`${file.name}: the file must contain UTF-8 text.`) }
    }
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error(`${file.name}: empty or binary files cannot be shared as text.`)
    return { id: crypto.randomUUID(), name: file.name, text }
  }))
  return [...existing, ...prepared]
}

export {composeSharedContext} from './attachmentContext'
