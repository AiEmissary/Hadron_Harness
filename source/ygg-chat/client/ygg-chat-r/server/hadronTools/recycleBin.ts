export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export type RecycleKind = 'project' | 'conversation' | 'branch'
export type RecycleEntry = { kind: RecycleKind; id: string; title: string; deletedAt: number; expiresAt: number; parentDeleted: boolean }
export function ensureRecycleBin(db: any) {
  db.exec("CREATE TABLE IF NOT EXISTS hadron_recycle_bin(kind TEXT NOT NULL CHECK(kind IN ('project','conversation')),item_id TEXT NOT NULL,owner TEXT NOT NULL,deleted_at INTEGER NOT NULL,PRIMARY KEY(kind,item_id))")
}
// Aliases are internal SQL identifiers, never user input.
export const activeProjectSql = (alias = 'projects') => `NOT EXISTS (SELECT 1 FROM hadron_recycle_bin rb WHERE rb.kind='project' AND rb.item_id=${alias}.id)`
export const activeConversationSql = (alias = 'conversations') => `NOT EXISTS (SELECT 1 FROM hadron_recycle_bin rb WHERE rb.kind='conversation' AND rb.item_id=${alias}.id) AND NOT EXISTS (SELECT 1 FROM hadron_recycle_bin rb WHERE rb.kind='project' AND rb.item_id=${alias}.project_id)`
export const recycleBinHost: { current?: HadronRecycleBin } = {}
export const branchRecycleHost:{list?(owner:string):RecycleEntry[];restore?(owner:string,id:string):void;purge?():void;forget?(owner:string,chatId:string):void}={}
export class HadronRecycleBin {
  constructor(private db: any, private now = () => Date.now()) { ensureRecycleBin(db) }
  private table(kind: RecycleKind) {
    if (kind !== 'project' && kind !== 'conversation') throw Error('Invalid recycle bin item')
    return kind === 'project' ? 'projects' : 'conversations'
  }
  trash(kind: RecycleKind, id: string, owner: string) {
    const table = this.table(kind), row = this.db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
    if (!row || row.user_id !== owner || row.storage_mode !== 'local') throw Error('Choose one of your local projects or chats')
    if (kind==='conversation'&&this.db.prepare("SELECT 1 FROM hadron_recycle_bin WHERE kind='project' AND item_id=?").get(row.project_id)) throw Error('Restore its project before deleting this chat separately')
    // Duplicate delete must not extend the original 30-day retention.
    this.db.prepare('INSERT OR IGNORE INTO hadron_recycle_bin(kind,item_id,owner,deleted_at) VALUES (?,?,?,?)').run(kind, id, owner, this.now())
  }
  list(owner: string): RecycleEntry[] {
    this.purgeExpired()
    const rows = this.db.prepare('SELECT * FROM hadron_recycle_bin WHERE owner=? ORDER BY deleted_at DESC').all(owner)
    return [...rows.flatMap((entry: any) => {
      const row = this.db.prepare(`SELECT * FROM ${this.table(entry.kind)} WHERE id=?`).get(entry.item_id)
      if (!row || row.user_id !== owner || row.storage_mode !== 'local') return []
      return [{ kind: entry.kind, id: entry.item_id, title: row.name ?? row.title ?? 'Untitled chat', deletedAt: entry.deleted_at, expiresAt: entry.deleted_at + RETENTION_MS,
        parentDeleted: entry.kind === 'conversation' && !!this.db.prepare("SELECT 1 FROM hadron_recycle_bin WHERE kind='project' AND item_id=?").get(row.project_id) }]
    }),...(branchRecycleHost.list?.(owner)??[])]
  }
  restore(kind: RecycleKind, id: string, owner: string) {
    this.purgeExpired()
    if(kind==='branch'){if(!branchRecycleHost.restore)throw Error('Branch recovery unavailable');branchRecycleHost.restore(owner,id);return}
    const table = this.table(kind), entry = this.db.prepare('SELECT * FROM hadron_recycle_bin WHERE kind=? AND item_id=? AND owner=?').get(kind, id, owner)
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
    if (!entry || !row || row.user_id !== owner || row.storage_mode !== 'local') throw Error('This item is no longer available to restore')
    if (kind === 'conversation' && this.db.prepare("SELECT 1 FROM hadron_recycle_bin WHERE kind='project' AND item_id=?").get(row.project_id)) throw Error('Restore its project first, then restore this chat')
    this.db.prepare('DELETE FROM hadron_recycle_bin WHERE kind=? AND item_id=? AND owner=?').run(kind, id, owner)
  }
  purgeExpired() {
    branchRecycleHost.purge?.()
    const expired = this.db.prepare('SELECT * FROM hadron_recycle_bin WHERE deleted_at<=?').all(this.now() - RETENTION_MS)
    const purge = () => {
      for (const entry of expired) {
        const table = this.table(entry.kind), row = this.db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(entry.item_id)
        if (row?.user_id === entry.owner && row.storage_mode === 'local') {
          if (entry.kind === 'project') {
            for(const chat of this.db.prepare('SELECT id FROM conversations WHERE project_id=? AND user_id=?').all(row.id,entry.owner))branchRecycleHost.forget?.(entry.owner,chat.id)
            this.db.prepare("DELETE FROM hadron_recycle_bin WHERE kind='conversation' AND item_id IN (SELECT id FROM conversations WHERE project_id=? AND user_id=?)").run(row.id, entry.owner)
            this.db.prepare('DELETE FROM conversations WHERE project_id=? AND user_id=?').run(row.id, entry.owner)
          }
          else branchRecycleHost.forget?.(entry.owner,entry.item_id)
          this.db.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).run(entry.item_id, entry.owner)
        }
        this.db.prepare('DELETE FROM hadron_recycle_bin WHERE kind=? AND item_id=?').run(entry.kind, entry.item_id)
      }
    }
    if (!expired.length) return
    if (typeof this.db.transaction === 'function') this.db.transaction(purge)()
    else { this.db.exec('BEGIN'); try { purge(); this.db.exec('COMMIT') } catch (error) { this.db.exec('ROLLBACK'); throw error } }
  }
}
