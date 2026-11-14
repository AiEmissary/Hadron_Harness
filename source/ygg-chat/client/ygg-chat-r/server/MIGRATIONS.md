# SQLite schema migrations

Last reviewed: 2026-10-11

The local database (`<dataDir>/local-sync.db`) is upgraded on every server start by
`runSchemaMigrations()` in `server/localServer.ts`. The runner reads SQLite's
`PRAGMA user_version`, applies every entry of `SCHEMA_MIGRATIONS` with a higher
`version` in ascending order, and stamps `user_version` after each successful `up`.
An installed app therefore upgrades itself once per migration and never re-runs one.

## Rules

1. **Two places, one PR.** Change the `CREATE TABLE ... IF NOT EXISTS` block so a fresh
   database gets the final shape, and append a migration so an existing database
   reaches the same shape. Fresh and upgraded installs must converge.
2. **Append only.** Take the next integer `version`. Never edit, renumber, or delete a
   shipped migration.
3. **Idempotent `up`.** Guard `ALTER TABLE ... ADD COLUMN` with a `PRAGMA table_info`
   check. Use `CREATE ... IF NOT EXISTS` for tables and indexes. A crash between the DDL
   and the stamp must be harmless on the next launch.
4. **No data rewrites in `up` without a guard.** A backfill must be safe to run twice.
5. **Record it here.** Add a row to the log below in the same change, with the version,
   the name used in code, what changed, and why.
6. **Readers tolerate both shapes.** Code that reads a new column must accept `NULL`
   from rows written before the migration.

## Log

| Version | Name | Change | Why | Added |
| --- | --- | --- | --- | --- |
| 1 | `subagent_manager_columns` | `subagent_runs` gains `handle`, `attempt`, `last_turn_at` and two indexes. | Subagent manager (detached runs, resume). | before 2026-09-15 |
| 2 | `messages_meta_column` | `messages` gains `meta TEXT` (JSON object). First key: `kind = 'context_injection'` with `files` and `reason`. | Auto-loaded instruction files are persisted as tagged user rows (docs/claude_code_context_loading_rules.md §11.3 decision 6). Future per-message identifiers go in `meta`, not in new columns. | 2026-09-15 |
| 3 | `hook_runs` | Adds operational hook-run lifecycle records and indexes by message, conversation, stream, and active status. | Async hook completion, skips, failures, and diagnostics must survive SSE completion and app navigation. | 2026-09-16 |
| 4 | `conversation_additional_cwds` | `conversations` gains nullable `additional_cwds TEXT` containing a JSON array of directory strings; `cwd` is unchanged. | Add storage for extra conversation roots without changing the existing default-directory contract. | 2026-09-29 |
| 5 | `search_index_rowid_rebuild` | Rebuilds `top_level_user_message_search` and `note_search_fts` once, keyed by the base-table rowid; syncs `note_search_docs` and `note_search_embedding_state` while keeping `note_updated_at` for unchanged notes; replaces all 11 search triggers. | Boot used to empty and refill both indexes and recreate 7 triggers on every launch (one full `messages` scan, and every `note_updated_at` reset to the boot time). Trigger deletes by `message_id` scanned the whole FTS index. | 2026-10-11 |

## Compaction transcript metadata (v6)

| Version | Name | Change | Why | Added |
| --- | --- | --- | --- | --- |
| 6 | `subagent_message_metadata` | Adds nullable `subagent_messages.meta TEXT`; existing rows remain NULL. | Persist normal compaction instruction/assistant boundary metadata across child resume. | 2026-10-14 |

## Conversation directory storage (v4)

- `cwd` remains a single default working-directory path (or `NULL`).
- `additional_cwds` stores JSON text, for example `["/projects/backend", "/projects/shared"]`.
- `NULL` means no additional directories, equivalent to `[]` for readers. Existing
  rows are not rewritten; their `cwd` values and all other fields are preserved.
- Fresh databases declare the column in `CREATE TABLE conversations`. Existing
  databases add it through the startup `runSchemaMigrations()` runner. The v4
  migration checks `PRAGMA table_info(conversations)` before adding the column,
  so it is safe if the column already exists. `PRAGMA user_version` prevents
  reapplying completed migrations on subsequent launches.
- This migration adds storage only. API serialization/validation, UI selection,
  multi-root context loading, and tool-path authorization are separate follow-up
  work. The existing single-root execution behavior is unchanged. This is a local
  SQLite migration, not a migration of the external cloud database.

## Search index maintenance (v5)

- Boot runs only `TOP_LEVEL_USER_MESSAGE_SEARCH_SCHEMA_SQL` (`server/topLevelUserMessages.ts`)
  and the `NOTE_SEARCH_*_SQL` constants (`server/searchIndexSchema.ts`). Every statement
  is `CREATE ... IF NOT EXISTS`. Boot never deletes or refills index rows.
- The triggers keep both indexes current. `CREATE TRIGGER IF NOT EXISTS` never replaces
  an existing body, so a trigger change ships as a new migration whose `up` calls
  `rebuildSearchIndexes(database)`. That function is idempotent and runs in a savepoint.
- FTS rows use the rowid of `messages` (top-level index) or `note_search_docs` (note
  index), because FTS5 scans the whole index for `WHERE message_id = ?` and does a
  lookup for `WHERE rowid = ?`. Both base tables have TEXT primary keys, so `VACUUM` may
  renumber their rowids. Nothing runs `VACUUM` today; if that changes, call
  `rebuildSearchIndexes` afterwards.
- `note_updated_at` changes only when the note text changes. Title, project, user, and
  storage-mode changes update the denormalised doc columns and keep the timestamp.
  `updated_at` touches on `conversations` do nothing.
- Top-level index triggers fire only for user rows whose parent is a root or a generated
  (context-injection / access-notice) row. Follow-up turns, assistant and tool rows,
  streaming content updates, and `children_ids` maintenance cost nothing.
- Verify on a copy before and after one start:
  `sqlite3 copy.db "SELECT COUNT(*) FROM top_level_user_message_search; SELECT COUNT(*), COUNT(DISTINCT note_updated_at) FROM note_search_docs;"`.

## Verifying a migration

```bash
# Inspect the stamped version and the columns of a database copy
sqlite3 /path/to/local-sync.db 'PRAGMA user_version; PRAGMA table_info(conversations);'
```

Start the server once against a copy of a pre-migration database. The log prints
`[LocalServer] Applied schema migration v<N> (<name>)` once, and never again on the next start.

## Durable internal proposal admission (v7)

| Version | Name | Change | Why | Added |
| --- | --- | --- | --- | --- |
| 7 | `hadron_collaboration_sessions` | Adds `hadron_sessions` and reserved/bound `hadron_participants`, lifecycle checks, foreign-key cascades and admission indexes. | Persist owner/scope/config identity, Stop fencing, child bindings and atomic checkpoint publication without adopting crash orphans. | 2026-11-02 |

Fresh installs and migration 7 use the same idempotent `createCollaborationSchema`
helper. Configuration is caller-sanitized bounded JSON; no provider secrets or source
rewrites are stored. Startup orphan reconciliation is an explicit repository operation
that marks unfinished sessions/participants interrupted and never dispatches work.


## Collaboration source deletion (v8)

Migration `hadron_collaboration_deletion_guards` installs two idempotent triggers via
`createCollaborationDeletionGuards`, also called for fresh installs. Deleting an
active (`created`, `running`, `stopping`) session, directly or by parent cascade,
raises ABORT and rolls back the entire deletion. Stop must finish draining the
owned children first. This deliberately blocks deletion rather than silently
removing ownership while paid work might still be running.

Deleting a terminal session removes its bound stream ledger entries, canonical
subagent messages and canonical runs before participant references disappear.
Ordinary runs are preserved. Explicit message cleanup also covers databases where
foreign-key enforcement is disabled. No provider dispatch or credential access is
performed by the migration. Tests cover populated-v7 installation, repeat install,
anchor/lineage/conversation/session cascades, all terminal statuses and Stop/drain.

## Independent job records (v9)

Migration hadron_independent_jobs adds owner/conversation/anchor/config identity, idempotent claim and unique run/stream binding, per-job Stop/terminal status and indexed ownership. Foreign-key parent deletion is blocked while active; terminal deletion cleans its private transcript/ledger. Startup marks unfinished jobs interrupted without dispatch. Runtime generic guards consult both job and proposal ownership. Service/routes/UI are now implemented behind the disabled live gate. Automatic Markdown journals are filesystem artifacts and add no schema migration; see headlessServer/services/collaboration/JOB_LOGS.md.

## Hadron agent branch annotations (2026-11-06)

Revision65 uses existing messages.meta for server-owned prepared turn parents
and provenance-tagged shared proposal snapshots. Actual questions/answers are
linked using existing parent_id/children_ids fields. The independent job table
remains schema9; no DDL or new user_version entry is needed. Existing single-turn
records stay separate roots, without invented parentage. Branch history is
resolved from owned canonical records, never from renderer-supplied history.

## Bounded cross-review and combined answer (v10)

Migration `hadron_review_and_synthesis` adds `hadron_workflows` and
`hadron_workflow_runs`. Existing proposal sessions and their checkpoints keep their
original meaning. New sessions explicitly opt into `review_and_synthesis`.
The workflow reserves two review attempts and one synthesis attempt; each binding
is immutable and registered before provider dispatch. Generic run/stream guards
consult both initial and workflow ownership.

Initial proposal completion is a barrier, not full workflow completion. A separate
active-workflow trigger blocks deleting the session or its source by cascade even
after the initial proposals are committed. Terminal deletion cleans stage-private
runs, messages and stream ledgers; ordinary runs are preserved. Startup marks
active workflows interrupted without adopting, replaying or dispatching attempts.
DDL is create-only and idempotent, with no changes to existing user messages or
credentials. Fresh and v6/v9 upgrades converge at schema10.

Project-list recovery uses existing server-owned job/proposal metadata to resolve
the immediate source workspace and saved response. It adds no migration and does
not flatten older nested scopes or change their parent relationships.
