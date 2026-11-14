import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { IndependentJobContexts } from '../headlessServer/services/collaboration/independentJobContexts.js'
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE conversations(id TEXT PRIMARY KEY,user_id TEXT,storage_mode TEXT,project_id TEXT); CREATE TABLE messages(id TEXT PRIMARY KEY,conversation_id TEXT,meta TEXT,content TEXT); CREATE TABLE hadron_independent_jobs(id TEXT,owner_id TEXT,conversation_id TEXT); CREATE TABLE hadron_sessions(id TEXT,owner_id TEXT,conversation_id TEXT,status TEXT)')
  const id = 'hadron-proposal-' + createHash('sha256').update(JSON.stringify(['owner','proposal:old-session:a'])).digest('hex')
  const meta = {hadronSharedProposal:{ownerId:'owner',participant:'a',sessionId:'old-session',sourceRunId:'old-run'}}
  db.prepare('INSERT INTO conversations VALUES (?,?,?,?)').run(id,'owner','local','project')
  db.prepare('INSERT INTO messages VALUES (?,?,?,?)').run('saved-message',id,JSON.stringify(meta),'Existing saved answer')
  const contexts = new IndependentJobContexts(db,(owner,id)=>{if(db.prepare('SELECT user_id FROM conversations WHERE id=?').get(id)?.user_id!==owner)throw Error('denied')})
  return {db,id,meta,contexts}
}
it('opens owned historical proposal messages without rebuilding missing session/run records or writing data',()=>{
  const f=fixture();try {
    const before=f.db.prepare('SELECT * FROM messages').all()
    expect(f.contexts.openWorkspace('owner',f.id)).toEqual({schemaVersion:1,requestedConversationId:f.id,workspaceConversationId:f.id,slot:null,nodeId:null,historicalOnly:true})
    expect(f.db.prepare('SELECT * FROM messages').all()).toEqual(before)
    expect(f.db.prepare('SELECT * FROM hadron_sessions').all()).toEqual([])
    expect(f.db.prepare('SELECT * FROM hadron_independent_jobs').all()).toEqual([])
  }finally{f.db.close()}
})
it('keeps foreign-owner, forged-identity and foreign-session denials',()=>{
  const f=fixture();try {
    expect(()=>f.contexts.openWorkspace('intruder',f.id)).toThrow('Access denied')
    f.meta.hadronSharedProposal.sessionId='forged'
    f.db.prepare('UPDATE messages SET meta=?').run(JSON.stringify(f.meta))
    expect(()=>f.contexts.openWorkspace('owner',f.id)).toThrow('Access denied')
    f.meta.hadronSharedProposal.sessionId='old-session'
    f.db.prepare('UPDATE messages SET meta=?').run(JSON.stringify(f.meta))
    f.db.exec("INSERT INTO hadron_sessions VALUES ('old-session','other','foreign','completed')")
    expect(()=>f.contexts.openWorkspace('owner',f.id)).toThrow('Access denied')
  }finally{f.db.close()}
})
it('does not reinterpret an unfinished session as completed historical work',()=>{
  const f=fixture();try {
    f.db.exec("INSERT INTO hadron_sessions VALUES ('old-session','owner','source','running')")
    expect(()=>f.contexts.openWorkspace('owner',f.id)).toThrow('Access denied')
  }finally{f.db.close()}
})
