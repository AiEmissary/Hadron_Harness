/** Explicitly attached JPEGs. Image bytes never belong in the text history. */
export interface HadronImage {id:string;name:string;dataUrl:string}
export const HADRON_IMAGE_MAX_BYTES=1024*1024
export const HADRON_IMAGE_MAX_DATA_URL_LENGTH=Math.ceil(HADRON_IMAGE_MAX_BYTES/3)*4+23
export const HADRON_IMAGE_MAX_COUNT=5
export function jpegDimensions(bytes:Uint8Array|string):{width:number;height:number}{
 const byte=(offset:number)=>typeof bytes==='string'?bytes.charCodeAt(offset):bytes[offset]
 if(bytes.length<4||byte(0)!==255||byte(1)!==216)throw Error('This file is not a JPEG image.')
 let offset=2
 while(offset+3<bytes.length){
  if(byte(offset++)!==255)throw Error('Invalid JPEG image.')
  while(byte(offset)===255)offset++
  const marker=byte(offset++)
  if(marker===217||marker===218)break
  if(marker===1||marker>=208&&marker<=215)continue
  const length=byte(offset)*256+byte(offset+1)
  if(length<2||offset+length>bytes.length)break
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   if(length<8)break
   const height=byte(offset+3)*256+byte(offset+4),width=byte(offset+5)*256+byte(offset+6)
   if(!width||!height||width*height>40000000)throw Error('JPEG dimensions exceed the 40 megapixel limit.')
   return {width,height}
  }
  offset+=length
 }
 throw Error('The JPEG image is incomplete or invalid.')
}
export function parseHadronImages(value:unknown):HadronImage[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>HADRON_IMAGE_MAX_COUNT)throw Error('Use up to five JPEG pictures on the selected conversation branch.')
 const ids=new Set<string>()
 return value.map(image=>{
  if(!image||typeof image!=='object'||Object.keys(image).some(key=>!['id','name','dataUrl'].includes(key))||typeof image.id!=='string'||!image.id||image.id.length>128||ids.has(image.id)||typeof image.name!=='string'||!image.name||image.name.length>1000||typeof image.dataUrl!=='string'||image.dataUrl.length>HADRON_IMAGE_MAX_DATA_URL_LENGTH||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl))throw Error('Invalid JPEG attachment.')
  const encoded=image.dataUrl.slice(23)
  if(encoded.length%4)throw Error('Invalid JPEG attachment encoding.')
  const binary=atob(encoded)
  if(binary.length>HADRON_IMAGE_MAX_BYTES)throw Error('Prepared JPEG exceeds 1 MiB.')
  const dimensions=jpegDimensions(binary)
  if(Math.max(dimensions.width,dimensions.height)>2048||binary.charCodeAt(binary.length-2)!==255||binary.charCodeAt(binary.length-1)!==217)throw Error('Invalid prepared JPEG dimensions or incomplete image.')
  ids.add(image.id)
  return {id:image.id,name:image.name,dataUrl:image.dataUrl}
 })
}
export function claudeImageInput(text:string,images:HadronImage[]):string{
 return JSON.stringify({type:'user',message:{role:'user',content:[{type:'text',text},...images.map(image=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:image.dataUrl.slice(23)}}))]}})+'\n'
}
