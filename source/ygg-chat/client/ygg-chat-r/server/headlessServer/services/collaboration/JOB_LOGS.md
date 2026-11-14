# Automatic agent job logs

`AgentJobJournal` saves local `.md` artifacts under `hadron-job-logs` beside the
Hadron database. Names hash owner/job/participant identity; user text never selects
a filesystem path. Independent job headers identify A/B using trusted context
metadata. Collaboration participants each have their own file.

Logs include the frozen goal and supplied context/files, status revisions, run
identity, visible progress and next steps. Current attempts cannot edit files or
run tests. All model-authored fixes and test claims are explicitly unverified;
future coding/verification receipts must come from the trusted execution path.
Reasoning, tool frames, credentials and raw provider diagnostics are excluded.

Services checkpoint before dispatch, at binding, every five seconds while active,
at Stop and at terminal state. The writer flushes a temporary file and atomically
renames it. A failed initial write prevents dispatch. Later failures preserve
canonical inference state, never trigger another request, and surface through
journal reads/status. Files are capped at 2 MiB with explicit failure, not silent
truncation. Stream buffer excerpts are labelled when earlier frames are missing.

Startup reconciliation marks unfinished jobs interrupted, then updates their logs.
Previously saved progress remains readable after the process and in-memory stream
have gone. Restart does not resume a provider request. SQLite remains authoritative
for identity, ownership and status; journal content is continuity data, not tool
authority. These local artifacts are retained independently of chat records;
complete retention/export/deletion policy is a release checklist item.

Owner-authorized, feature-gated reads:

- `GET /api/collaboration/jobs/:id/journal`
- `GET /api/collaboration/proposals/:sessionId/participants/:participantId/journal`
- `GET /api/collaboration/jobs/:id/continuity` (terminal jobs only)

Independent context preparation is `POST /api/collaboration/jobs/contexts` with
`{schemaVersion:1,id,sourceConversationId,slot:'a'|'b'}`. It is local/idempotent,
checks current owner/project access and does not copy selected-chat messages.

The renderer displays logs as plain text and offers Save .md copy. Prepare
follow-up from log restores the original goal and a bounded excerpt of context
and notes into a NEW draft, with truncation disclosed. Original files may need
reattaching. Only explicit Start dispatches that new job.

Evidence: journal, continuity, independent context/service/routes and proposal
service tests; `check:hadron-startup` seeds a running fixture in one Electron
process and proves interruption/log preservation in a second process without
network calls. `check:hadron-ui` checks separate task/file state and disabled Start.

Revision66: full Work together sessions keep five separate journals: initial `a`
and `b`, `review_a`, `review_b`, and `final`. The same owner-authorized participant
journal endpoint accepts these fixed stage IDs. Stage status is the full workflow
status plus the stage/run status; partial synthesis remains explicitly incomplete.
Saved stage text comes from the canonical run, not a new inference request. Startup
refreshes the interrupted workflow journals; no stage resumes automatically.
