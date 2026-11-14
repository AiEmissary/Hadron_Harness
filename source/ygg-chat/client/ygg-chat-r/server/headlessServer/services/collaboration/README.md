Current revision34: proposal and independent-job routes/UI are registered behind
the false live gate and empty model lists. `IndependentJobContexts` creates empty,
owned local job conversations idempotently. `IndependentJobService` owns one
durable tool-free attempt per job; `ProposalSessionService` owns the proposal pair.
Both automatically checkpoint `AgentJobJournal` Markdown logs, and authorized
journal reads expose no hidden reasoning or credentials. `jobContinuity.ts`
prepares explicit new-job handoff data without dispatch. See [JOB_LOGS.md](JOB_LOGS.md).
`reviewPacket`/`generalWorkflowPolicy` still prepare data/policy only; full phased
workflow scheduling remains pending. Older unwired descriptions below are historical.

# Hadron internal proposal modules

Revision 15 adds an unregistered internal start/status/Stop HTTP module with strict
principal injection and a versioned public status projection. See [API.md](API.md)
for implemented endpoints, tests and missing host-auth/event/workflow gates.

## P1 admission checkpoint (2026-11-02)

`proposalSessionService.ts` wraps the spike with strict version-1 parsing in
`shared/collaboration.ts`, an explicit server model allowlist, injected access checks,
and durable owner/config/participant claims in `persistence/collaborationRepo.ts`.
`collaborationSchema.ts` supplies shared fresh-install/migration-7 DDL. Nothing
registers the session service as a route, tool or renderer feature.

The trusted second argument to `SubagentRunService.spawnDetached` fences dispatch
after asynchronous authentication and synchronously binds child identity before
inference. It removes resolver-added tools and denies every execution, including
hallucinated calls. Existing ordinary subagents keep their existing behavior.
Durable Stop from another service instance rejects binding/publication. Startup-only
`reconcileInterrupted()` marks unfinished records interrupted, preserves terminal
sessions, and never dispatches; startup wiring is still required.

The repository and session integration tests add 19 cases; four existing-service
admission cases cover auth preparation, auth failure, tool denial and binding failure.
Combined impacted regression: 138 passed, 20 existing native SQLite skips, eight
files; server typecheck passes. Tests use Node SQLite/fake providers and injected
resolvers, not the production registry or Electron database migration runner.

Remaining P1 work includes actual registry integration, production migration parity,
startup recovery wiring, deadlines/request budgets, broader versioned artifacts/events
and explicit retry contracts. The notes below describe the underlying P0 module;
its per-instance launch limitation is addressed only when using the P1 wrapper.

Not registered in server wiring, tool registry, routes or renderer. Not a complete collaboration feature. Existing Graviton single-agent behavior is unchanged.

## Files / flow

- `proposalSpike.ts`: exactly two tool-free ChatGPT subagent proposals using existing `SubagentRunService`. Copies task/context/model selection at construction, hashes one identical packet, waits for both terminal results and owns child cancellation. `start()` shares one promise per instance; `stop()` closes launch/publication and the promise settles after child cleanup.
- `proposalCheckpoints.ts`: synchronous transactional publisher using existing `MessageRepo`, `LineageRepo` and `SubagentRunRepo`. Validates source scope, anchor, completed attempt and prompt hash. Bounded assistant excerpts reference canonical child transcripts in generic message metadata. Existing `fork_operations` store immutable publication receipts. Matching retries reuse messages; changed identity/provenance is rejected. Both branches commit or roll back together. No inference is used to publish checkpoints.
- `../__tests__/proposalSpike.test.ts`: fake-provider barrier and failure/race regression tests.
- `../__tests__/fixtures/proposalSqlite.ts`: small real Node SQLite in-memory schema/statement fixture for the existing repositories. Streaming lifecycle is a recorder, not the production SSE registry. No live app startup/auth/network.

## Boundaries

The P0 caller is trusted server code. A future route must add authentication, workspace access, provider capability checks, durable sessions/admission/budgets, stale revisions and ownership validation. Do not expose this constructor as an unchecked public API. No schema migration: this spike uses existing generic metadata and fork receipts; P1 requires proper collaboration tables/migrations.

No shared REPL/root/lineage tool access is granted; the tool resolver must respect explicit `[]` and unknown tool calls must not execute. Tests enforce this resolver contract. This is not the full reviewer role policy. Max one loop turn still does not disable existing provider transient retries; live cost/deadline budgets are unimplemented.

Launch deduplication is in-memory/per-instance only. Publication deduplication is backed by fork-operation receipts in SQLite and survives publisher recreation; crash/restart of paid launch is not solved. Stop cannot interrupt an already committed synchronous transaction and does not delete committed checkpoints. Stop during asynchronous preparation is checked after the child handle returns; that child is cancelled/awaited, but provider dispatch may have begun. Full pre-dispatch admission fencing requires a later service seam.

Metadata marks excerpts `verified: false`; model text is untrusted content, not test evidence or commands. No transcript IDs are promoted into message/lineage IDs. Checkpoint branch nodes use server-generated IDs and preserve source ancestry. The UI will need a typed link to the existing transcript viewer; that link is not implemented here.

## Validation

From `source/ygg-chat`:

```text
npm --prefix client/ygg-chat-r run test:headless -- server/headlessServer/services/__tests__/proposalSpike.test.ts
npm --prefix client/ygg-chat-r run typecheck:server
```

Node 22 with `node:sqlite` is required by this isolated test fixture. It intentionally fails rather than silently skips when SQLite is unavailable. Native Electron/better-sqlite3 compatibility and production schema/migrations must be checked separately before enabling a route or UI.

## Revision 6 checkpoint — registry, migrations and startup recovery

Production resolver source with real built-in definitions now participates in five tool-free admission denial cases. Production migration registry/runner is exercised on Node SQLite (fresh-helper versus v6 upgrade, partial failure/retry, legacy preservation). Startup-only CollaborationRepo reconciliation is wired after migrations and before routes; it never restarts requests. Final focused headless run: 72 passed across five files; separate conversation migration server suite: five passed; server typecheck passed. Tests use explicit host availability and minimal parent schemas; native Electron/full production schema/custom registry discovery remain unverified. Next: server-owned request budgets/deadlines including retry bounds. See wherearewe.md revision 6 for exact commands/files.

## Revision 7 checkpoint — proposal request/deadline limits

Internal trusted proposals now have one ToolLoopService provider-router generate call per participant: maxTurns is forced to one, compaction and empty/error/finalization retries are disabled, and an empty result fails. Ordinary subagents keep their existing retry behavior. This is a loop-level request bound, not a token/currency guarantee: OpenAiChatgptProvider.generate can retry a pre-stream 401 after credential refresh; transport internals are not yet audited.

ProposalSessionService validates a server-owned deadline (default 120000ms, maximum 600000ms), persists effective limits in the exact admission config, checks expiry before child binding/publication and aborts owned children on timeout. Failed deadline sessions record the reason after cleanup; explicit Stop still yields cancelled. Config replay rejects changed limits. A previously stored internal pre-limit config will conflict rather than silently acquire a new policy. No automatic recovery/re-dispatch.

Deadline fences work/publication; it does not promise an uncooperative authentication/provider operation returns by that instant. Cleanup waits for owned work to settle, preserving honest state. Native/provider timeout behavior still needs validation. No new schema or live database mutation occurred.

Validation from source/ygg-chat: final test:headless run used collaborationRepo.test.ts, collaborationMigration.test.ts, proposalSessionService.test.ts, proposalSpike.test.ts, subagentRunService.test.ts, subagentToolExecutor.test.ts, chatOrchestrator.phase2.test.ts, decisionBroker.test.ts, branchOrchestrator.test.ts and compactionPersistence.test.ts at their existing persistence/services test paths. Result: ten files passed, 157 passed/20 existing native skips, exit 0. Focused three-file run: 79 passed. typecheck:server and git diff --check exit 0. Ten new cases cover empty/transient no-retry, running timeout cancellation, preparation timeout fencing and six invalid deadlines. No live provider calls, Electron launch/build, credentials or installed Graviton changes.

Next exact action: provider/transport retry and abort audit with mocked coverage; cap/label request usage at the appropriate boundary, then complete remaining artifact/event/recovery contracts and isolated desktop setup before route/UI exposure.

## Revision 8 — provider request policy and streaming cancellation

Trusted proposals now forward requestPolicy: single_attempt from SubagentRunService through ToolLoopService/ProviderGenerateInput to ChatGPT/Codex. This suppresses pre-stream 401 auth replay, pre-first-byte HTTP retries and auto WebSocket-to-HTTP fallback. Ordinary callers omit it and retain existing retries. One proposal permits at most one inference transport attempt; this is not a token/currency cap, and credential refresh is separate from inference. Explicit WebSocket transport still needs live/native validation; fallback suppression is tested at the mocked transport method boundary.

Bug CANCEL-2: streamResilience unlinks the parent signal after returning the first byte, so later stalled SSE reads could outlive Stop/deadline. Codex SSE parser now owns an abort listener for its whole read lifetime, cancels its reader, rechecks the signal and preserves partial output. Listener is removed at terminal exit. No shared retry engine or installed-app changes.

Changed runtime files: providers/openRouterProvider.ts; providers/openaiChatgptProvider.ts; providers/codex/codexResponsesProvider.ts, codexSse.ts, types.ts; services/toolLoopService.ts and subagentRunService.ts. Added providers/__tests__/proposalProviderPolicy.test.ts (nine cases), extended services/__tests__/subagentRunService.test.ts forwarding assertion, and updated docs/agent_context/agent_subagents_orchestration.md. All paths relative to source/ygg-chat/client/ygg-chat-r/server/headlessServer except the docs path under source/ygg-chat.

Validation from source/ygg-chat: npm --prefix client/ygg-chat-r run test:headless -- server/headlessServer/providers/__tests__/proposalProviderPolicy.test.ts server/headlessServer/providers/__tests__/openaiChatgptProvider.test.ts server/headlessServer/providers/__tests__/codexWebsocket.test.ts server/headlessServer/services/__tests__/proposalSessionService.test.ts server/headlessServer/services/__tests__/proposalSpike.test.ts server/headlessServer/services/__tests__/subagentRunService.test.ts server/headlessServer/services/__tests__/toolLoopService.test.ts
Result: seven files passed, 155 passed/16 existing skips, exit 0. Initial three-file run: 88 passed. typecheck:server exit 0 (test files excluded); git diff --check exit 0 with CRLF warnings. An extra attempted streamResilience.test.ts filter exited 1 because no such test exists; no runtime/test assertion failure. Existing provider suite covers normal HTTP retries and new tests cover auth retry compatibility, 401/429/503/network single-attempt failures, abort during auth/open/read, partial retention and fallback denial.

No live provider request, Electron launch/build, native addon rebuild, schema/data/credentials mutation or executable produced. HEAD remains pinned upstream with accumulated uncommitted changes. API/UI remains unregistered. Next: establish isolated Hadron development app/data/auth/update namespaces and non-production defaults before any Electron launch; finish P1 artifact/event contracts and native schema parity before feature exposure. Provider spending approval remains required for live smoke tests.
