
import {jpegDimensions,parseHadronImages,HADRON_IMAGE_MAX_DATA_URL_LENGTH,type HadronImage} from '../../../../../shared/hadronImages'
import {VIDEO_EXTENSIONS,VIDEO_MAX_BYTES,VIDEO_MAX_FRAMES,videoFrames,videoTimeLabel} from './videoFrames'
/** searchable: large text kept whole for the agent's document tools instead of being inlined into the shared context. */
export interface SharedAttachment { id: string; name: string; text: string; image?:HadronImage; searchable?: true }
/** Pictures in other formats are converted to JPEG when attached. */
export const PICTURE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
export const SHARED_ATTACHMENT_MAX_COUNT = 20
export const SHARED_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.bmp,.mp4,.webm,.mov,.m4v,.pdf,.docx,.doc,.txt,.md,.markdown,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonl,.py,.html,.css,.scss,.xml,.yaml,.yml,.toml,.ini,.log,.sql,.rs,.go,.java,.c,.h,.cpp,.hpp,.cs,.sh,.ps1,.r'
const extensions = new Set(SHARED_FILE_ACCEPT.split(','))

/** Read only files explicitly picked by the user. No paths, disk scanning or HTTP upload. */
export async function readSharedFiles(files: readonly File[], existing: readonly SharedAttachment[] = []): Promise<SharedAttachment[]> {
  if (files.length + existing.length > SHARED_ATTACHMENT_MAX_COUNT) throw new Error(`Choose up to ${SHARED_ATTACHMENT_MAX_COUNT} files.`)
  const prepared = await Promise.all(files.map(async (file): Promise<SharedAttachment | SharedAttachment[]> => {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!extensions.has(extension)) throw new Error(`${file.name}: choose a picture (JPEG, PNG, WebP, GIF or BMP), video (MP4, WebM, MOV), PDF, Word (.docx or .doc), text or code file.`)
    if (VIDEO_EXTENSIONS.has(extension)) {
      // A video becomes evenly spaced still frames: the AI sees pictures in time order, not motion or sound.
      if (file.size > VIDEO_MAX_BYTES) throw new Error(`${file.name}: videos can be up to ${VIDEO_MAX_BYTES / 1024 / 1024} MiB.`)
      const slots = SHARED_ATTACHMENT_MAX_COUNT - existing.length - (files.length - 1)
      if (slots < 1) throw new Error(`${file.name}: no attachment space is left for video frames.`)
      let frames: Awaited<ReturnType<typeof videoFrames>>
      try { frames = await videoFrames(file, Math.min(VIDEO_MAX_FRAMES, slots)) }
      catch (error) { throw new Error(`${file.name}: ${error instanceof Error ? error.message : 'the video could not be read.'}`) }
      return frames.map(frame => {
        const id = crypto.randomUUID(), name = `${file.name} · frame at ${videoTimeLabel(frame.time)}`
        return { id, name, text: '', image: parseHadronImages([{ id, name, dataUrl: frame.dataUrl }])[0] }
      })
    }
    const isDocument = extension === '.pdf' || extension === '.docx' || extension === '.doc'
    const isPicture = PICTURE_EXTENSIONS.has(extension)
    const maxBytes = (isPicture ? 30 : 8) * 1024 * 1024
    if (file.size > maxBytes) throw new Error(`${file.name}: the file exceeds Hadron's ${isPicture ? 30 : 8} MiB attachment limit. ${isPicture?'Choose a smaller picture.':'Use Add folder for bounded text excerpts instead.'}`)
    if(isPicture){
      if(extension==='.jpg'||extension==='.jpeg')jpegDimensions(new Uint8Array(await file.arrayBuffer()))
      let bitmap:ImageBitmap
      try{bitmap=await createImageBitmap(file)}catch{throw Error(`${file.name}: this picture could not be opened.`)}
      if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error(`${file.name}: picture dimensions exceed the 40 megapixel limit.`)}
      try{
        const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas')
        canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
        const context=canvas.getContext('2d');if(!context)throw Error('Image preview is unavailable.')
        // Transparent areas (PNG, WebP, GIF) become white, not black, in the JPEG copy.
        context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height)
        context.drawImage(bitmap,0,0,canvas.width,canvas.height)
        let dataUrl=canvas.toDataURL('image/jpeg',.9)
        for(const quality of [.8,.65,.5]){if(dataUrl.length<=HADRON_IMAGE_MAX_DATA_URL_LENGTH)break;dataUrl=canvas.toDataURL('image/jpeg',quality)}
        while(dataUrl.length>HADRON_IMAGE_MAX_DATA_URL_LENGTH&&Math.max(canvas.width,canvas.height)>512){
          canvas.width=Math.max(1,Math.floor(canvas.width*.8));canvas.height=Math.max(1,Math.floor(canvas.height*.8))
          context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);dataUrl=canvas.toDataURL('image/jpeg',.8)
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
  const all = [...existing, ...prepared.flat()]
  if (all.length > SHARED_ATTACHMENT_MAX_COUNT) throw new Error(`These files would make ${all.length} attachments; the limit is ${SHARED_ATTACHMENT_MAX_COUNT}. Each video adds up to ${VIDEO_MAX_FRAMES} frames.`)
  return all
}

export {composeSharedContext} from './attachmentContext'
