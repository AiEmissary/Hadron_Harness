/** Shared create-only DDL for fresh installs, migration 7 and isolated SQLite tests. */
export function createCollaborationSchema(db: { exec(sql: string): unknown }): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hadron_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      source_lineage_id TEXT NOT NULL REFERENCES lineages(id) ON DELETE CASCADE,
      anchor_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','running','stopping','completed','cancelled','failed','interrupted')),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      config_json TEXT NOT NULL CHECK (length(config_json) <= 65536 AND json_valid(config_json)),
      config_hash TEXT NOT NULL,
      checkpoints_json TEXT CHECK (checkpoints_json IS NULL OR json_valid(checkpoints_json)),
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS hadron_participants (
      session_id TEXT NOT NULL REFERENCES hadron_sessions(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL,
      run_id TEXT UNIQUE,
      handle TEXT,
      stream_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','running','completed','aborted','error','interrupted')),
      PRIMARY KEY (session_id, participant_id),
      CHECK ((run_id IS NULL AND handle IS NULL AND stream_id IS NULL AND status IN ('reserved','interrupted'))
        OR (run_id IS NOT NULL AND handle IS NOT NULL AND stream_id IS NOT NULL AND status <> 'reserved'))
    );
    CREATE INDEX IF NOT EXISTS idx_hadron_sessions_owner_conversation ON hadron_sessions(owner_id, conversation_id);
    CREATE INDEX IF NOT EXISTS idx_hadron_sessions_active ON hadron_sessions(status) WHERE status IN ('created','running','stopping');
  `)
  createCollaborationWorkflowSchema(db)
  createCollaborationVerificationSchema(db)
}

/** Migration 10. Initial proposal receipts remain immutable; later stages have their own fence. */
export function createCollaborationWorkflowSchema(db: { exec(sql: string): unknown }): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hadron_workflows (
      session_id TEXT PRIMARY KEY REFERENCES hadron_sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('running','stopping','completed','cancelled','failed','interrupted')),
      phase TEXT NOT NULL CHECK(phase IN ('proposals','reviews','synthesis','finished')),
      revision INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS hadron_workflow_runs (
      session_id TEXT NOT NULL REFERENCES hadron_workflows(session_id) ON DELETE CASCADE,
      stage_id TEXT NOT NULL CHECK(stage_id IN ('review_a','review_b','final')),
      participant_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      run_id TEXT UNIQUE, handle TEXT, stream_id TEXT UNIQUE,
      PRIMARY KEY(session_id, stage_id),
      CHECK((run_id IS NULL AND handle IS NULL AND stream_id IS NULL) OR
        (run_id IS NOT NULL AND handle IS NOT NULL AND stream_id IS NOT NULL))
    );
    CREATE TRIGGER IF NOT EXISTS hadron_workflow_delete_guard
    BEFORE DELETE ON hadron_sessions
    WHEN EXISTS(SELECT 1 FROM hadron_workflows WHERE session_id = OLD.id AND status IN ('running','stopping'))
    BEGIN
      SELECT RAISE(ABORT, 'Stop collaboration and wait for completion before deleting its source');
    END;
    CREATE TRIGGER IF NOT EXISTS hadron_workflow_delete_private_records
    BEFORE DELETE ON hadron_sessions
    WHEN EXISTS(SELECT 1 FROM hadron_workflows WHERE session_id = OLD.id AND status IN ('completed','cancelled','failed','interrupted'))
    BEGIN
      DELETE FROM streaming_runs WHERE stream_id IN (SELECT stream_id FROM hadron_workflow_runs WHERE session_id = OLD.id);
      DELETE FROM subagent_messages WHERE run_id IN (SELECT run_id FROM hadron_workflow_runs WHERE session_id = OLD.id);
      DELETE FROM subagent_runs WHERE id IN (SELECT run_id FROM hadron_workflow_runs WHERE session_id = OLD.id);
    END;
  `)
}

/** Internal service/test initialization alias; same DDL as fresh installs and v7. */
export const initializeCollaborationSchema = createCollaborationSchema

/** Migration 8: all deletion entry points, including foreign-key cascades, share this fence. */
export function createCollaborationDeletionGuards(db: { exec(sql: string): unknown }): void {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS hadron_session_delete_guard
    BEFORE DELETE ON hadron_sessions
    WHEN OLD.status IN ('created', 'running', 'stopping')
    BEGIN
      SELECT RAISE(ABORT, 'Stop collaboration and wait for completion before deleting its source');
    END;
    CREATE TRIGGER IF NOT EXISTS hadron_session_delete_private_records
    BEFORE DELETE ON hadron_sessions
    WHEN OLD.status IN ('completed', 'cancelled', 'failed', 'interrupted')
    BEGIN
      DELETE FROM streaming_runs WHERE stream_id IN
        (SELECT stream_id FROM hadron_participants WHERE session_id = OLD.id);
      DELETE FROM subagent_messages WHERE run_id IN
        (SELECT run_id FROM hadron_participants WHERE session_id = OLD.id);
      DELETE FROM subagent_runs WHERE id IN
        (SELECT run_id FROM hadron_participants WHERE session_id = OLD.id);
    END;
  `)
}

/** Migration 11: additive verification run/host evidence; v10 workflows stay intact. */
export function createCollaborationVerificationSchema(db: { exec(sql: string): unknown }): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hadron_verification_runs (
      session_id TEXT PRIMARY KEY REFERENCES hadron_workflows(session_id) ON DELETE CASCADE,
      stage_id TEXT NOT NULL DEFAULT 'verification' CHECK(stage_id = 'verification'),
      participant_id TEXT NOT NULL, model_name TEXT NOT NULL,
      run_id TEXT UNIQUE, handle TEXT, stream_id TEXT UNIQUE,
      evidence_json TEXT NOT NULL DEFAULT '{"receipts":[],"omitted":0}' CHECK(json_valid(evidence_json) AND length(evidence_json) <= 24000),
      CHECK((run_id IS NULL AND handle IS NULL AND stream_id IS NULL) OR
        (run_id IS NOT NULL AND handle IS NOT NULL AND stream_id IS NOT NULL))
    );
    CREATE TRIGGER IF NOT EXISTS hadron_verification_delete_private_records
    BEFORE DELETE ON hadron_sessions
    WHEN EXISTS(SELECT 1 FROM hadron_workflows WHERE session_id = OLD.id AND status IN ('completed','cancelled','failed','interrupted'))
    BEGIN
      DELETE FROM streaming_runs WHERE stream_id IN (SELECT stream_id FROM hadron_verification_runs WHERE session_id = OLD.id);
      DELETE FROM subagent_messages WHERE run_id IN (SELECT run_id FROM hadron_verification_runs WHERE session_id = OLD.id);
      DELETE FROM subagent_runs WHERE id IN (SELECT run_id FROM hadron_verification_runs WHERE session_id = OLD.id);
    END;
  `)
}
