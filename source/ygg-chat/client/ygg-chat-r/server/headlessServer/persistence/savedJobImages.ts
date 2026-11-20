import {parseHadronImages} from '../../../../../shared/hadronImages.js'
import {parseHadronDocuments} from '../../../../../shared/hadronDocuments.js'
type Scope='independent'|'shared'
/** Whole job including pictures and large documents, before they are moved out of the job row. */
export const SAVED_JOB_MAX_BYTES=48*1024*1024
/** Job rows keep a legacy 64 KiB envelope; pictures and large documents are stored one per row beside them. */
const ENVELOPE_MAX_BYTES=65536

function ensureMediaTable(db:any,scope:Scope){
 db.exec(`CREATE TABLE IF NOT EXISTS hadron_saved_job_media (
  scope TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL,conversation TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('image','document')),part INTEGER NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(scope,id,kind,part));`)
 const table=scope==='independent'?'hadron_independent_jobs':'hadron_sessions'
 db.exec(`CREATE TRIGGER IF NOT EXISTS hadron_${scope}_media_cleanup AFTER DELETE ON ${table} BEGIN
  DELETE FROM hadron_saved_job_media WHERE scope='${scope}' AND id=OLD.id AND owner=OLD.owner_id; END;`)
}

/** Keep picture bytes and large document text out of the job row: one row per picture or document. */
export function storeJobImages(db:any,scope:Scope,id:string,owner:string,conversation:string,json:string):string{
 if(Buffer.byteLength(json)>SAVED_JOB_MAX_BYTES)throw Error('Job attachments exceed the saved-attachment budget')
 const config=JSON.parse(json),images=parseHadronImages(config.images),documents=config.documents===undefined?[]:parseHadronDocuments(config.documents)
 const packed=images.length||documents.length?JSON.stringify({...config,...(images.length?{images:{savedJobImages:2}}:{}),...(documents.length?{documents:{savedJobDocuments:1}}:{})}):json
 if(Buffer.byteLength(packed)>ENVELOPE_MAX_BYTES)throw Error('Job text configuration exceeds its saved-context budget')
 if(!images.length&&!documents.length)return packed
 ensureMediaTable(db,scope)
 const insert=db.prepare('INSERT INTO hadron_saved_job_media(scope,id,owner,conversation,kind,part,payload) VALUES (?,?,?,?,?,?,?)')
 images.forEach((image,part)=>insert.run(scope,id,owner,conversation,'image',part,JSON.stringify(image)))
 documents.forEach((document,part)=>insert.run(scope,id,owner,conversation,'document',part,JSON.stringify(document)))
 return packed
}

export function restoreJobImages(db:any,scope:Scope,row:{id:string;owner_id:string;conversation_id:string;config_json:string}):string{
 const config=JSON.parse(row.config_json)
 const imagesSaved=config.images&&!Array.isArray(config.images),documentsSaved=config.documents&&!Array.isArray(config.documents)
 if(!imagesSaved&&!documentsSaved)return row.config_json
 const media=(kind:'image'|'document')=>db.prepare('SELECT payload FROM hadron_saved_job_media WHERE scope=? AND id=? AND owner=? AND conversation=? AND kind=? ORDER BY part').all(scope,row.id,row.owner_id,row.conversation_id,kind).map((item:{payload:string})=>JSON.parse(item.payload))
 const restored={...config}
 if(imagesSaved){
  if(Object.keys(config.images).length!==1||![1,2].includes(config.images.savedJobImages))throw Error('Invalid saved picture reference')
  if(config.images.savedJobImages===1){
   // Pictures saved before per-picture rows were introduced.
   const stored=db.prepare('SELECT images_json FROM hadron_saved_job_images WHERE scope=? AND id=? AND owner=? AND conversation=?').get(scope,row.id,row.owner_id,row.conversation_id)
   if(!stored)throw Error('Saved pictures are unavailable')
   restored.images=parseHadronImages(JSON.parse(stored.images_json))
  }else{
   const images=media('image');if(!images.length)throw Error('Saved pictures are unavailable')
   restored.images=parseHadronImages(images)
  }
 }
 if(documentsSaved){
  if(Object.keys(config.documents).length!==1||config.documents.savedJobDocuments!==1)throw Error('Invalid saved document reference')
  const documents=media('document');if(!documents.length)throw Error('Saved documents are unavailable')
  restored.documents=parseHadronDocuments(documents)
 }
 return JSON.stringify(restored)
}
