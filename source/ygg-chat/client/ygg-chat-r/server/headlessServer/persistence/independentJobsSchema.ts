/** Append-only migration9. Independent jobs never share a task, transcript or cancellation handle. */
export function createIndependentJobsSchema(db: { exec(sql: string): unknown }): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hadron_independent_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      anchor_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      config_json TEXT NOT NULL CHECK (json_valid(config_json) AND length(config_json) <= 65536),
      config_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','running','stopping','completed','cancelled','failed','interrupted')),
      revision INTEGER NOT NULL DEFAULT 0,
      run_id TEXT UNIQUE,
      handle TEXT,
      stream_id TEXT UNIQUE,
      CHECK ((run_id IS NULL AND handle IS NULL AND stream_id IS NULL) OR (run_id IS NOT NULL AND handle IS NOT NULL AND stream_id IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS hadron_closed_job_admissions (
      id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,source_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_hadron_jobs_owner_conversation ON hadron_independent_jobs(owner_id, conversation_id, id);
    CREATE TRIGGER IF NOT EXISTS hadron_job_delete_guard BEFORE DELETE ON hadron_independent_jobs
    WHEN OLD.status IN ('created','running','stopping') BEGIN
      SELECT RAISE(ABORT, 'Stop independent job and wait for completion before deleting its source');
    END;
    CREATE TRIGGER IF NOT EXISTS hadron_job_delete_private_records BEFORE DELETE ON hadron_independent_jobs
    WHEN OLD.status IN ('completed','cancelled','failed','interrupted') BEGIN
      DELETE FROM streaming_runs WHERE stream_id = OLD.stream_id;
      DELETE FROM subagent_messages WHERE run_id = OLD.run_id;
      DELETE FROM subagent_runs WHERE id = OLD.run_id;
    END;
  `)
}
