import {parseHadronImages} from '../../../../../shared/hadronImages.js'
type Scope='independent'|'shared'
/** Keep image bytes out of legacy 64 KiB job envelopes without rebuilding user tables. */
export function storeJobImages(db:any,scope:Scope,id:string,owner:string,conversation:string,json:string):string{
 if(Buffer.byteLength(json)>8*1024*1024)throw Error('Job attachments exceed the saved-image budget')
 const config=JSON.parse(json),images=parseHadronImages(config.images)
 const packed=images.length?JSON.stringify({...config,images:{savedJobImages:1}}):json
 if(Buffer.byteLength(packed)>65536)throw Error('Job text configuration exceeds its saved-context budget')
 if(!images.length)return packed
 db.exec(`CREATE TABLE IF NOT EXISTS hadron_saved_job_images (
  scope TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL,conversation TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  images_json TEXT NOT NULL CHECK(json_valid(images_json) AND length(images_json)<=7340032),PRIMARY KEY(scope,id));`)
 const table=scope==='independent'?'hadron_independent_jobs':'hadron_sessions'
 db.exec(`CREATE TRIGGER IF NOT EXISTS hadron_${scope}_image_cleanup AFTER DELETE ON ${table} BEGIN
  DELETE FROM hadron_saved_job_images WHERE scope='${scope}' AND id=OLD.id AND owner=OLD.owner_id; END;`)
 db.prepare('INSERT INTO hadron_saved_job_images(scope,id,owner,conversation,images_json) VALUES (?,?,?,?,?)').run(scope,id,owner,conversation,JSON.stringify(images))
 return packed
}
export function restoreJobImages(db:any,scope:Scope,row:{id:string;owner_id:string;conversation_id:string;config_json:string}):string{
 const config=JSON.parse(row.config_json)
 if(!config.images||Array.isArray(config.images))return row.config_json
 if(config.images.savedJobImages!==1||Object.keys(config.images).length!==1)throw Error('Invalid saved picture reference')
 const stored=db.prepare('SELECT images_json FROM hadron_saved_job_images WHERE scope=? AND id=? AND owner=? AND conversation=?').get(scope,row.id,row.owner_id,row.conversation_id)
 if(!stored)throw Error('Saved pictures are unavailable')
 return JSON.stringify({...config,images:parseHadronImages(JSON.parse(stored.images_json))})
}
