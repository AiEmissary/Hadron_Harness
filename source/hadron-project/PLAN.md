## Revision99 - helpers, milestones, reference copies and Windows release (2026-11-07)

Implemented Copy into project across saved main, independent, collaborative, automatic and project modes. Copies create ordinary historical text chats in owned local projects, preserve originals, are idempotent and bounded to 128 KiB, and transfer no active jobs, attachments, authority or approvals. Added same-provider known-lightweight helpers with a durable two-helper agent/job budget, one-level delegation, parent-linked visible activity/history and Markdown checkpoints. Parent Stop aborts/joins children; restart marks unfinished work interrupted without replay. Automatic conversation remains text only; automatic repair stages disable helpers to preserve existing approval budgets.

Project proposals can include safe nested new files/folders, created only on reviewed application. Added explicit milestone deliverable acceptance, test/build gates and preparation of the next milestone without inference. A complete small Node project with nested source/tests was created and tested by the host fixture. Mixed desktop build/test/fix fixture demonstrated a real failing test, independently reviewed repair, then passing test and build.

Removed the Electron remote title-bar button, gated inherited marketing/legal routes, disabled upstream cloud auth configuration in Hadron builds and blocked upstream app domains in external launch. Larger centered project title added. Help includes optional setup inventory and official optional download links; Electron/Node, provider engines, worker controller and tool capability are bundled. No changes to original Graviton, user chats, credentials or running user app.

Regressions passed: 559 server tests, 894 headless tests, 1182 renderer tests; six focused helper tests passed including cancellation/join and restart. Actual built UI fixtures passed mixed jobs/branches/reopen/help/reference copying (zero navigation inference), both same-provider helper children and the real Node repair cycle. Provider fixture output is synthetic, not fresh paid acceptance. Electron/main/mobile and server typechecks passed.

Windows NSIS packaging now verifies target native SQLite/vector, keytar and PTY dependencies, includes curated hoisted runtime packages and both pinned vendor binaries, and probes packaged native modules plus vendor versions before installer creation. Missing VS Spectre libraries were avoided using the working official PTY prebuild. Windows signing-tool cache was extracted without irrelevant macOS symlinks; no OS developer-mode setting was changed. Release is unsigned. Final artifact/evidence checkpoint: CURRENT_BUILD.md and WINDOWS_RELEASE.md. Installed and development profiles remain separate; no automatic profile/account migration.

Deferred: Mac, remote access, extra providers/primary agents, arbitrary language/package/shell runners, configurable helper roles/budgets and fresh paid-model release acceptance. Do not describe this as unlimited autonomous all-language coding. The installer has not been installed into the user's active profile.

---
# The Hadron Harness — implementation plan

Revision66: ChatGPT-only Work together now implements independent proposals -> one cross-review per agent -> final combined answer using Agent A's selected model. Five maximum tool-free requests, preserved dissent, durable interruption/Stop, no automatic replay. Coding write/review stages and releases remain pending. See wherearewe.md for current evidence.

Status: accepted plan, gated proposal/session/desktop integration implemented through revision29; live models unapproved and broader workflows/releases still pending. See wherearewe.md for current evidence.
Read `wherearewe.md` first when resuming. Work items live in `TODO.md`.

## Summary

Build Hadron as a small, feature-flagged collaboration layer in a development fork of Graviton. Preserve its Electron app, model interfaces, tools, SQLite storage, Heimdall branches, and server-owned agent loop. Ship two independent AI sessions first; represent participants as a list so additional agents can be added later without replacing the session model.

Two supported workflows:
- **General collaboration:** same task/context → independent proposals → exchange completed findings → bounded cross-review → evidence checks → one synthesis.
- **Coding collaboration:** independent read-only analysis → one implementer edits → independent read-only review → bounded fixes/recheck → one result with actual test evidence.

Both streams are visible. Partial tokens are for the UI, not automatically fed into the other AI. Exchange completed artifacts at explicit checkpoints. Independence means separate conversation/provider sessions; it does not require different vendors. Two ChatGPT sessions are a valid first test, but not evidence of model diversity.

## Findings

Inspected upstream main at commit `44a142fc5be3af5ae963a58fe20ceedcba9223c1` (commit date 2026-10-18). This is a remote-source planning baseline, not a local checkout or runtime verification.

| Reuse | Evidence / implication |
| --- | --- |
| Electron renderer + local Express + SQLite | Upstream agent context explicitly targets desktop, not a new web product. |
| `ChatOrchestrator.runMessage` → `ToolLoopService` | Reuse the existing provider/tool loop, permission pauses, hooks and compaction. Do not create another agent engine. |
| `BranchOrchestrator.resolve` + `LineageRepo` | Server owns structural ancestry and durable lineage. A visible `currentPath` is not execution identity. |
| Stream-keyed Redux/SSE projection | Existing multi-stream state is useful, but simultaneous Hadron runs and view-selection races still need tests. |
| Existing provider router | Inspected routes: `openaichatgpt`, `openrouter`, `lmstudio`, `zai`, `bedrock`. Unknown route strings fall back to ChatGPT: Hadron must reject unsupported selections before dispatch. |
| Subagent service/manager | Useful precedents for lifecycle and policy, but transcripts are not normal branches; provider restrictions and detached cancellation differ. Revision 3 comparison recommends this service for read-only participants; normal chat remains the permission-gated implementer. |

The inspected router does not establish native Anthropic or DeepSeek support. Models may be exposed through other routes, subject to availability/auth/capability checks. The user's expected DeepSeek update is future input, not verified current functionality. Exact concurrency/session isolation, hooks, auth refresh and recovery behavior need a development spike.

## Scope and decisions

- User-approved: Desktop project folder; both workflows above; reuse existing Graviton providers; ChatGPT first, Anthropic/DeepSeek later.
- Design recommendation: coordinator is deterministic application code, not an always-running third AI. A chosen participant/model performs synthesis as a bounded inference step.
- Defaults proposed for the MVP: two participants, one cross-review round, one coding fix/recheck round. Remaining material disagreements return to the human.
- Begin with a feature flag and unchanged single-agent behavior. Keep upstream branding/internal paths initially; package as **The Hadron Harness** after core acceptance tests.
- Not included: new model-provider integrations, CLI automation, multi-writer worktrees, a vector database, Kafka, A2A deployment, or broad Graviton refactoring. Future multi-writer isolation is a separate design.
- The user accepted the plan and P0 start. Separate source checkout now exists at `source/`, matching the inspected SHA. Do not patch the installed application or its live database.
- Export must include a Windows installer `.exe` with bundled Hadron tools/resources, no developer-machine dependencies, and corresponding source/notices. See PROJECT_MAP.md for acceptance gates.
- Keep components/processes in clearly named, cohesive modules with a maintained component map. UI stays clean/chat-first and retains the colourful Heimdall tree.

## P0 refinement — reuse the existing subagent channel (revision 3)

Mocked comparison confirms Graviton's subagent service already separates provider sessions (`subagent:<runId>`). Preferred minimal integration is now **hybrid**: existing subagents for independent read-only proposals, cross-review and optional synthesis; existing normal chat branch execution for the single permission-gated coding implementer. Publish committed proposal/review/synthesis checkpoints as normal branch nodes referencing canonical subagent transcripts, rather than duplicating the full live transcript. Keep the colourful Heimdall tree and its existing subagent viewer.

This supersedes main-chat-only participant scheduling references below; stage/identity/persistence/safety requirements still apply. Do not create a second engine, bypass provider route restrictions, enable blanket subagent write approval or remove normal-chat branch behavior. Subagents receive an explicitly assembled frozen context packet; parentMessageId is not automatic parent-history inheritance. Shared-lineage REPL is deliberately shared upstream, so independent phases must omit it/delegation or have separately proven isolated scopes. Model/provider choice comes from validated server-owned participant configuration; real cross-vendor support remains gated.

Revision 4 completed the internal checkpoint-to-branch spike using existing repositories on real Node SQLite: 12 cases pass for barrier, provenance, idempotency/conflicts, rollback and Stop. New modules remain unregistered. Next: P1 contracts/session persistence and fail-closed admission/capability/provider checks; close pre-dispatch Stop/crash gaps before live use. See FEASIBILITY.md revision 3 for commands, results and limitations. Subsequent detailed steps should use this runner split without broad upstream refactoring.

## Implementation Plan

### 0. Safe development baseline and feasibility gate

Progress: branch-backed and existing subagent mocked comparisons completed (FEASIBILITY.md). Do not re-run setup or add a new provider-session mechanism before using the verified subagent pattern. Remaining gate is integration/policy/recovery, not proof that subagents can run independently.

1. Create a separate source checkout under this project (proposed `source/`), record the actual upstream SHA and compare it to the inspected baseline before editing. Do not infer installed-app parity.
2. Read upstream agent context and package scripts. Use a separate development app identity/data directory, auth profile and test database; disable production cloud mirroring for fixtures. Determine exact configuration before launching development Electron.
3. Establish baseline tests/builds and record pre-existing failures. Check license/notice requirements (upstream metadata says AGPL-3.0); confirm modified-app distribution/network obligations before release.
4. Spike two `ChatOrchestrator.runMessage` runs from one frozen anchor with unique stream, operation, lineage and provider-session identities. Verify same-provider concurrency, permissions, cancellation, history isolation, hooks, compaction and stream projections.
5. Require proof that provider conversation/session caches are not keyed only by conversation ID. Include OpenRouter/cloud-mirror behavior before declaring that route supported by Hadron. Unsupported configurations are disabled with an explanation.

**Gate:** both results persist as separate inspectable branches, neither reads sibling history, neither hijacks the other's stream or permission decision. If reuse needs an injection seam, add a narrow optional server-owned execution context; retain one tool loop.

### 1. Versioned contracts and durable session records

Proposed new modules under existing `ygg-chat/` layout:
- `shared/collaboration.ts`: request/status/event/artifact types and validation contracts.
- `client/ygg-chat-r/server/headlessServer/persistence/collaborationRepo.ts`.
- `client/ygg-chat-r/server/headlessServer/services/collaborationService.ts`.
- `client/ygg-chat-r/server/headlessServer/routes/collaborationRoutes.ts`.

Use SQLite records for sessions, participant attempts and append-only checkpoint events/artifacts. Keep ordinary turns in the existing message tree; reference IDs instead of duplicating complete transcripts.

Minimum data:
- Session: ID, schema version, workflow, conversation ID, source lineage ID, frozen anchor ID, task/acceptance criteria, context manifest/hash, participant configuration snapshot, synthesis choice, phase, phase revision, limits, usage, timestamps, terminal reason.
- Participant attempt: participant ID, role, resolved provider/model, server-side auth-profile reference (never tokens), role capabilities, attempt number, operation/stream/lineage/message IDs, status, retry reason and usage.
- Artifact: ID, kind, author, round, source attempt/message IDs, content or immutable content reference/hash, claims/evidence, disagreements, context/workspace revision and delivery receipts.
- Evidence: source location or test command, cwd/revision, observed exit code/result, timestamp and verifier; model assertions alone are not verified evidence.

Proposed envelope:

```json
{
  "schemaVersion": 1,
  "messageId": "unique-id",
  "sessionId": "session-id",
  "senderId": "agent-a",
  "recipientIds": ["agent-b"],
  "type": "proposal",
  "round": 0,
  "attemptId": "attempt-id",
  "artifactIds": ["artifact-id"],
  "contextHash": "sha256-of-frozen-context",
  "createdAt": "ISO-8601"
}
```

Application transport is in-process calls + SQLite + existing local HTTP/SSE conventions. Models do not need to emit perfect JSON: preserve raw output and normalize into validated artifacts; label extraction failures. Model-provided metadata never grants authority.

For schema changes, update fresh-install DDL in `server/localServer.ts`, append the next unused idempotent `SCHEMA_MIGRATIONS` entry, and document it in `server/MIGRATIONS.md`. Determine the next version from the checkout, not this document. Add indexes, same-conversation validation, deletion/retention rules and old-client handling. Feature-flag-off must continue reading ordinary chats unchanged.

### 2. Deterministic coordination and branch mapping

Proposed transitions:

```text
created → preparing → independent → exchanging → reviewing
  general: → verifying → synthesizing → completed
  coding:  → implementing → code_review → fixing? → rechecking → synthesizing → completed
Any active phase → waiting_for_user | stopping | failed | interrupted
stopping → cancelled (only after owned work is terminal or explicitly marked unresolved)
```

For coding, `reviewing` above is the initial proposal review; `code_review` examines the implementation. A terminal-looking partial response is not a successful collaboration. Distinguish `completed` from a clearly labelled partial/degraded result.

- Freeze task/history/attachments/context instructions once. Record artifact hashes and workspace base revision. General discovery and initial coding analysis use no mutating tools or effectful hooks. If files change externally during independent analysis, mark the snapshot stale and restart or ask the user. A shared folder alone is not a frozen filesystem snapshot.
- Create an A and B branch using existing server-authoritative branch semantics from that anchor. Track returned durable lineage IDs; never mint durable lineage/message IDs in the UI.
- Give each inference a distinct provider-session key. Both receive the same task/context, role-specific constraints, and no peer proposal until both independent artifacts are committed.
- Advance phases with a transaction/compare-and-swap phase revision. Uniquely key launch requests and checkpoint deliveries so double-clicks/reconnects cannot duplicate paid inference or proposal exchange.
- Record approved exchange packets as visible contextual messages on the recipient branch. Reference the peer artifact; do not rewrite history or re-parent peer messages. Preserve role/provenance and bound size against the smallest selected context window.
- Synthesis gets a dedicated sibling branch from the original anchor plus a bounded evidence/disagreement packet. A tree node has one parent; use references for cross-branch evidence, not a new multi-parent message graph.
- Forking a Hadron session creates a new session ID from a chosen committed checkpoint with provenance; it does not mutate the source session. Ordinary Graviton manual branching remains available.
- User intervention is queued at a safe boundary and recorded. Changing task, provider or permissions after launch creates an explicit revision/restart; it must not silently contaminate the independent phase.

### 3. Hard capabilities and one-writer coding policy

Introduce a narrow server-owned role policy at tool execution, composed with existing workspace access and permission checks. The caller/model cannot elevate its role by changing request fields or requesting Agent mode.

- Reviewer/general/synthesis: approved read-only tools only. Deny writes, shell, arbitrary custom/MCP tools, delegation/bridge escape paths, plan/todo writes and other hidden mutations by default. Permit additional tools only after an explicit audited capability classification.
- Filter advertised tools AND enforce at execution, including `multi_call`, REPL invocation/export, custom/MCP discovery, mode changes, hooks and child jobs. Prompt-only restrictions and existing Plan mode are insufficient as a strict read-only boundary.
- Coding implementer: sole write lease for the canonical workspace. Normal user permission prompts still apply; implementer status is not blanket auto-approval. Fail closed when the lease is unavailable; parallel Hadron sessions or ordinary Graviton agents must not bypass it through another entry point. Unsupported external writers require a pause/stale-revision check, not a claim of OS-wide locking.
- Reviewer examines an immutable diff/manifest and actual test results from a named workspace revision. Serialize review with edits; invalidate its approval if the files change.
- Tests may run through an explicitly approved verification capability with bounded commands/environment; capture stdout/exit code. Treat shell/test execution as potentially mutating or executing untrusted code. Reviewer cannot obtain arbitrary shell access by labelling a tool call a test.
- Peer output is untrusted evidence, never system instruction. Preserve source labels, sanitize display, cap output size and never automatically execute proposed commands/patches. Cross-provider sharing must be disclosed before starting. Credentials remain in existing secure provider storage and are excluded from artifacts/exports.

### 4. Run lifecycle, budgets, cancellation and recovery

Proposed local endpoints, using existing auth/origin/workspace checks (exact mount names to follow repository conventions): create/start, get status/artifacts, cancel, explicit retry/resume, fork checkpoint and attach events for a collaboration ID.

- Register all participant/synthesis/verification streams and child tool jobs as owned work. Stop first closes admission of new work and marks the session stopping, then cancels those runs and awaits/records terminal results. Late events carry attempt/phase revisions and cannot resurrect the session or trigger synthesis.
- View navigation/disconnect should detach where Graviton's resumable-run behavior supports it; explicit Stop cancels. Reattach reads canonical persisted state and resumes from a sequence cursor. Persist stage/checkpoint events; reuse existing chat state for token replay/snapshots rather than duplicating every token in a new event store.
- On process restart, do not assume an old provider request or tool job completed. Reconcile to interrupted, retain partial artifacts, inspect workspace changes and require explicit retry from the last safe checkpoint. No automatic paid rerun or blind write/test replay.
- Expose max review/fix rounds, wall time, provider turn/token/output limits, retries, concurrent runs and optional estimated dollar ceiling. Proposed starting UI presets: concurrency 2, one review round, one fix round, 15-minute session deadline; validate feasibility during the spike. All limits must be shown/editable before launch.
- Reserve capacity for review/synthesis. Stop or ask before launching a phase that cannot fit remaining limits. Record actual/estimated/unknown usage distinctly. Without reliable pricing, do not promise a strict dollar cap; use enforceable request/token/time ceilings and warn about provider in-flight charges.
- A failed participant is visible with retry/continue-partial/cancel choices. No silent provider substitution, endless debate, fabricated agreement or automatic green completion when tests fail. In-flight tool cancellation may be best-effort: disclose surviving jobs/effects and keep the write lease until safely resolved.

### 5. Desktop UI without replacing branching

Proposed renderer feature folder: `src/features/collaboration/`; presentation: `src/components/CollaborationPanel/`.

- Add a **Hadron / Collaborate** action from the current task/selected branch.
- Configure workflow, model/provider for A/B, roles, synthesis model, context preview, sharing disclosure and limits. Start disabled for unsupported/unavailable provider configurations.
- Show two independently keyed stream panes, phase timeline, branch links, tool permissions, usage, Stop, retry and intervention controls. Native branch navigation still works.
- Extend the existing SSE/Redux projection with participant/session correlation, not a second source of message truth. Background participant completions must not repeatedly steal `currentPath`/scroll focus; user-selected pane/branch stays selected.
- Display one final result with evidence, executed/skipped checks, dissent, participant identities, cost uncertainty and links to original branches. Distinguish consensus, verified findings and unresolved claims.
- More than two participants stays disabled in MVP. Later add bounded scheduling, targeted reviews and aggregate budgets; do not default to all-to-all chatter.

### 6. Acceptance, benchmark and release gate

Release a development build only after migration, permissions, branch isolation, lifecycle and provider-pair acceptance checks pass. Preserve the upstream license/notices, use separate Hadron app identity/update channel/data directory and test upgrades/backup/export before touching user data.

Evaluate Hadron against the same task/context single-model baseline. Use a small labelled pilot set (suggested 12 tasks: coding defects, implementation tasks and factual/reasoning tasks), repeat selected tasks, record correctness, missed defects, harmful edits, cost, latency and human interventions. A pilot is not statistical proof. Ship collaboration as opt-in; do not promise it always improves results.

## Data Flow Diagram — Before

```mermaid
flowchart LR
  U[Task or selected branch] --> R[React thin client]
  R --> C[Local ChatOrchestrator]
  C --> B[BranchOrchestrator and lineage]
  C --> L[Shared ToolLoopService]
  L --> P[Selected provider/model]
  L --> T[Permission-gated tools]
  L --> D[SQLite messages and streaming runs]
  C --> S[SSE / Redux projection]
  S --> H[Chat and Heimdall]
```

## Data Flow Diagram — After

```mermaid
flowchart TD
  U[Task, criteria, anchor, selected models] --> C[Deterministic Hadron coordinator]
  C --> DB[Durable session, attempts, checkpoints, budgets]
  C --> A[Participant A existing subagent / checkpoint branch]
  C --> B[Participant B existing subagent / checkpoint branch]
  A --> X[Completed proposals and evidence]
  B --> X
  X --> R[Bounded exchange and cross-review]
  R --> W{Workflow}
  W -->|general| V[Evidence verification]
  W -->|coding| I[Single implementer then read-only code review]
  I --> F[Bounded fixes and real test checks]
  F --> V
  V --> S[Synthesis branch with evidence and dissent]
  S --> UI[One result + both streams + Heimdall links]
  A --> UI
  B --> UI
  C --> K[Role policy, write lease, cancellation ownership]
```

## Data Flow Explanation

The coordinator schedules existing chat runs and persists explicit phase transitions. It does not splice streams or bypass Graviton's provider/tool layer. Normal message/lineage storage remains the source of transcript truth. A separate collaboration record explains why each branch exists, which artifacts were exchanged, which attempt owns each stream, and whether limits and verification passed. Read-only independent phases protect proposal independence; a single writer protects coding files. Completion requires committed artifacts, a verified terminal state and explicit reporting of unresolved issues—not agreement alone.

## Testing Plan

All commands below are **planned, not run**. From `<checkout>/ygg-chat`, scripts verified in the inspected package:

```text
npm --prefix client/ygg-chat-r run test:headless
npm --prefix client/ygg-chat-r run test:server
npm --prefix client/ygg-chat-r run test:renderer
npm --prefix client/ygg-chat-r run test:tools
npm --prefix client/ygg-chat-r run typecheck:server
npm --prefix client/ygg-chat-r run build:electron
npm --prefix client/ygg-chat-r run build:electron:main
```

Start with new focused test files in the matching existing Vitest suite, then run impacted regression suites/builds. Mock providers first; paid provider smoke tests require a visible user-approved budget.

Required assertions:
- Same frozen input, distinct sessions/branches, no sibling proposal leak before barrier, valid parent/children and lineage head updates; two simultaneous completions without focus stealing.
- Role-denial tests through direct, composite, REPL, shell, MCP/custom, hooks, nested jobs and mode-upgrade paths; no permission/lease leakage between streams/sessions.
- Duplicate start/delivery, stale phase/attempt events, retry, bad model JSON, oversized packets, context overflow, provider auth/429/empty-output errors and same-account refresh races.
- Cancel one/session/all-owned jobs, cancel while awaiting permissions, disconnect/reconnect, Electron restart, crash between DB commit and provider launch, and restart after files changed. No duplicated paid inference without explicit acknowledgement of ambiguity.
- Fresh/existing/repeated migrations, legacy chats, deleted branches/artifacts, export/redaction and rollback-to-backup on test data. Feature flag off retains single-agent behavior.
- ChatGPT/ChatGPT first; each later provider pair gated on streaming/tools/auth/cancel support. Same credentials do not mean same session history.
- Manual Electron: both workflows end-to-end; manual branch forks and checkpoint-session fork; Stop and honest partial results; real failing tests block a verified-success claim.

## Risks and Trade-offs

- Two agents increase latency, spending and correlated mistakes. Bounded stages and baseline comparisons make the trade-off visible.
- Core integration is slightly larger than a custom tool, but supports durable first-class branches, strict roles and reliable lifecycle ownership. Hooks/custom tools can demonstrate a prototype, not establish these guarantees.
- Existing tool and provider state may contain hidden per-conversation caches or automatic hooks. The spike is a gate, not an assumption of safe concurrency.
- Local-first is not offline: selected providers receive context and may use upstream gateways. Preview sharing and support redacted packets.
- Persistent checkpoints improve recovery but cannot guarantee exactly-once execution of an external paid request or shell command after a crash. Mark ambiguous attempts and require explicit human recovery.
- Package identity, AGPL compliance and upstream merge drift require attention at release. Do not rebuild branding before validating collaboration.

## Critical Files for Implementation

Paths below are relative to the existing `source/ygg-chat/` root. Revision 3 also makes `services/subagentRunService.ts` and its transcript/lifecycle primitives critical reuse surfaces.

1. `client/ygg-chat-r/server/headlessServer/services/chatOrchestrator.ts` — run lifecycle, permissions, lineage transaction and role-policy seam; retain shared `toolLoopService.ts`.
2. `client/ygg-chat-r/server/headlessServer/persistence/lineageRepo.ts` — durable forks/heads; use with `branchOrchestrator.ts`, not UI path state.
3. `shared/collaboration.ts` **(new/proposed)** — collaboration contract; integrate with existing `shared/headlessApi.ts` only where needed.
4. `client/ygg-chat-r/server/headlessServer/services/collaborationService.ts` **(new/proposed)** — bounded coordinator, ownership, recovery and budgets; repository/routes are companions.
5. `client/ygg-chat-r/src/features/chats/sseProjection.ts` — existing event projection; integrate with new collaboration feature/panel and existing Chat/Heimdall.

Other important existing surfaces: `services/providerRouter.ts`, `services/decisionBroker.ts`, `shared/operationModeToolPolicy.ts`, `server/localServer.ts`, `server/MIGRATIONS.md`, and `server/headlessServer/index.ts` wiring. Revalidate paths and signatures against the actual checkout.

## Revision 5 implementation checkpoint

Internal proposal-only P1 contracts, durable owner/config admission and participant binding now exist in shared/collaboration.ts, persistence/collaborationRepo.ts and services/collaboration/proposalSessionService.ts. Shared collaborationSchema.ts DDL is referenced by fresh setup and migration 7. Trusted spawnDetached admission fences preparation/dispatch and denies all tools. This is a partial P1 implementation; full artifacts/events, retries, budgets, native migration parity, startup reconciliation wiring and public API/UI are still pending. Revision-5 validation: 138 passed/20 existing skips and server typecheck passed. See wherearewe.md for evidence and inherited-change provenance.


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

## Revision 9 — desktop identity isolation and dual-provider UI contract

Added electron/hadronBootstrap.ts as main.ts first import. Sets separate Hadron release/development userData and Chromium session directories beneath Electron appData, explicit app name/ID, Hadron settings path and loopback-only binding before importing server singletons. server/runtimeIdentity.ts centralizes Conf options and development cloud denial. Main/adapter, LSP, custom tool settings and fallback settings stores use these options. Hadron Conf refuses a missing initialized directory rather than opening Graviton settings. envLoader skips parent .env discovery for Hadron desktop. No environment file or personal store read during this work.

CredentialVault uses Hadron service/account and no legacy-service migration, with a separate credential lock directory. electron-builder.json now has com.hadron.harness, The Hadron Harness, Hadron artifact names and publish:null. Main protocol is hadron-harness instead of yggchat; app cloud login is explicitly blocked pending a separate backend plan. Main updater setup and install IPC cannot use the upstream feed. Central RailwayClient rejects requests before token refresh/network in Hadron; other direct network paths still need auditing. Package npm identity/internal icon assets remain upstream; no release-readiness claim.

New server/__tests__/hadronIdentity.test.ts covers bootstrap with mocked Electron/filesystem, distinct packaged/development paths, fail-closed settings, separate mocked vault/no legacy migration, disabled builder publishing and GET/POST/PATCH/DELETE cloud rejection before auth/network. Final server run: keytarSecrets.test.ts, hadronIdentity.test.ts, credentialVaultLock.test.ts — 21 passed, three files, exit 0. Separate headless railwayClient.test.ts: 12 passed, exit 0. Both typecheck:electron and typecheck:server passed; diff --check passed (CRLF warnings). Earlier bootstrap test run: eight passed, superseded by final suites. No native API or real credentials were used.

User confirmed two independent provider entry points in UI. Added UI_DESIGN.md: Agent A/B each get provider/model selectors and own connection status, shared composer, two live panes, session Stop, compact phases, coloured branch/transcript links, explicit implementer/read-only reviewer and permission attribution. Separate selectors mean distinct execution sessions, not automatically separate provider accounts. Current internal support remains ChatGPT-only; unsupported choices disabled with reasons. Specification only, no collaboration renderer/API implemented.

No Electron launch/build, native rebuild, real provider requests, installed Graviton/database/credential changes or .exe. Isolation is incomplete: hooks/resources/workspace defaults, inherited environment/direct cloud paths, renderer localhost fallback and OAuth callback-port coexistence require audit before launch. Updated PROJECT_MAP links UI_DESIGN; current source HEAD unchanged at pinned upstream with uncommitted changes.

Next exact action: finish no-launch isolation audit for hooks/resources and renderer server selection (no fallback to Graviton's port), direct cloud/credential paths and callback coexistence. Then validate an isolated desktop build and complete remaining P1 API/event contracts before enabling collaboration UI.

## Revision 10 — renderer endpoint, hooks/resources and auth boundaries

Fixed cross-instance endpoint hazard: desktop getLocalServerOrigin/getCachedLocalServerOrigin now reject missing, foreign, failed or stale IPC discovery rather than guessing port 3002 or reusing a stale endpoint. Removed unused static LOCAL_API_BASE export. localServer health reports process.pid; Electron accepts only an exact own-process match, including rejection of legacy health responses without a PID. Async/sync origin tests cover failure, foreign status, absent IPC/configured override, timeout, cache expiry and verified custom port. Native browser/health coexistence has not been launched.

Hadron bootstrap now overrides inherited managed custom-tool/hook/theme directories into its own profile. hookStorage skips upstream bundled hook/settings seeding under Hadron; builder omits .ygg/settings.local.json and .ygg/hooks resources. Themes remain upstream read-only assets pending release audit. Project/workspace context hooks and all context-loading defaults still require inspection before launch. No personal files were read/changed.

Hadron Electron config disables automatic OAuth callback listener, avoiding a startup claim on Graviton's port 1455. Existing manual code exchange routes remain, but usability/coexistence is not verified and no login was performed. Direct upstream app session acceptance, code exchange and app credential refresh now use the same cloud-access denial as central RailwayClient; ChatGPT auth remains separately supported. Other direct remote clients still need review.

Changed paths under source/ygg-chat/client/ygg-chat-r: src/utils/api.ts and new api.isolation.test.ts; electron/main.ts, hadronBootstrap.ts, electronHostAdapter.ts; electron-builder.json; server/localServer.ts, hooks/hookStorage.ts, auth/runtime.ts, appLogin.ts, refreshAdapters.ts; server/__tests__/hadronIdentity.test.ts and hookStorage.test.ts. Updated Electron agent-context docs.

Validation from source/ygg-chat (separate runs, not one combined suite): test:renderer -- src/utils/api.isolation.test.ts src/features/chats/subagentClient.test.ts: 23 passed/two files, exit 0. test:server -- server/__tests__/hadronIdentity.test.ts server/__tests__/hookStorage.test.ts: final 17 passed/two files, exit 0. test:headless -- server/headlessServer/services/__tests__/authMigration.test.ts server/headlessServer/services/__tests__/railwayClient.test.ts: 17 passed/two files, exit 0. Total 57 passing cases across these separate commands, no skips. typecheck:electron and typecheck:server passed; diff --check passed with CRLF warnings. Mocked Electron/filesystem bootstrap, temporary hook fixture, synthetic credentials/fetch only; native Electron/full renderer build untested.

Next: finish context/project hook and direct remote-client audit, review manual OAuth and renderer startup behavior after fail-closed origins, then perform an isolated build (without production data/login). P1 artifact/event routes/UI remain unwired. UI_DESIGN.md dual Agent A/B provider controls remain the accepted direction. No Electron launch, real AI/network call, native rebuild, installed-app data mutation or .exe.

## Revision 11 — context isolation and first successful desktop bundles

Closed HOOK-3: an empty Hadron managed hook directory previously triggered hookRunner's ancestor/home search. Under Hadron it now returns only managed profile settings, including an empty list, so a project .ygg/settings.json command is never adopted implicitly. Added hadronHookIsolation.test.ts with a synthetic project command and mocked bash executor; no command ran.

Added runtimeContextHome() and used it for default home scope in context/instructionFiles.ts, skillsDiscovery.ts, agentsLoader.ts and contextLoader.ts. Hadron global instructions/skills/agents default to <userData>/context-home. Explicit caller homeDir remains respected. Project and ancestor instructions remain workspace context when that root is selected; this is not a claim that project files are ignored. Bootstrap clears inherited YGG_AUTO_MEMORY_DIRECTORY; explicit future user context/memory sharing remains a separate setting. Context metadata docs updated.

Validation from source/ygg-chat: test:server -- server/__tests__/hadronHookIsolation.test.ts server/__tests__/hadronIdentity.test.ts server/__tests__/hookStorage.test.ts: 18 passed/three files, exit 0. Separate test:headless -- server/headlessServer/services/__tests__/contextLoading.test.ts: 22 passed, exit 0. Both are synthetic/temp/mock tests. No real provider requests or app sign-in.

FIRST BUILDS: npm --prefix client/ygg-chat-r run build:electron:main passed, exit 0 (includes typecheck:electron, typecheck:mobile, esbuild main/preload/tool utility/analytics worker/mobile UI). npm --prefix client/ygg-chat-r run build:electron passed, exit 0 (project TypeScript build and Vite Electron renderer; 7442 transformed modules, Vite reports 1m4s for its stage). Warnings: api.ts mixed static/dynamic imports and large chunks. Built outputs are electron/main.mjs, preload.mjs, toolRuntimeUtility.mjs, localAnalyticsWorker.mjs and dist-electron/ plus mobile assets, all in the development checkout. Static bundle inspection confirmed bootstrap HADRON_DESKTOP assignment precedes credential-vault namespace initialization. This is not execution of the bundles.

Build-generated tracked vite.config.js/.d.ts were restored to their starting upstream state; no original local edits existed in those paths. Fixed extra EOF blank lines introduced by editing context source. Final git diff --check exit 0 (CRLF conversion warnings only). HEAD remains pinned upstream; accumulated source work remains uncommitted. Lockfiles unchanged.

No Electron launch, native addon rebuild, .exe packaging, personal profile/credential/database mutation or live network inference. Dependencies were originally installed with scripts disabled; native Electron loadability remains unverified. Direct network audit covered central cloud and app auth boundaries, not every inherited tool's intentional web access; do not declare a network-isolated app. UI_DESIGN dual selectors remain specified, not implemented.

Next exact action: check native dependency/runtime readiness and isolated startup behavior (no login/paid requests), then finish versioned P1 artifact/event/status contracts and authenticated local API before rendering Agent A/B controls. Packaging, full provider login/coexistence and clean-Windows .exe acceptance remain open.

## Revision 12 — native runtime probe and compiler prerequisite (2026-11-03)

Installed the pinned Electron 38.8.4 executable by running source/ygg-chat/node_modules/electron/install.js (exit 0). Downloaded keytar 7.9.0 N-API prebuild using node ../prebuild-install/bin.js --runtime=napi --verbose from its hoisted node_modules directory (exit 0). Only checkout dependencies and normal download caches changed; no installed Graviton files or credentials accessed. No lockfile changes.

Important workspace correction: dependencies are hoisted into source/ygg-chat/node_modules, while @electron/rebuild is in the client node_modules. Early checks against client node_modules/electron incorrectly suggested the package itself was absent; actual require.resolve revealed the hoist. Two broad rebuild API calls exited 0 without generating SQLite's binding; they are not evidence of native readiness. A direct rebuild targeting the hoisted better-sqlite3 directory gave the actionable failure below.

Pinned better-sqlite3 11.10.0 has no Electron-v139 Windows-x64 prebuild: direct prebuild-install --runtime=electron --target=38.8.4 returned HTTP 404, exit 1. Direct @electron/rebuild at that module directory failed, exit 1: Could not find any Visual Studio installation to use. Kept pinned dependency version; did not install system-wide compilers or change upstream dependency versions.

Added scripts/check-hadron-native.mjs and npm check:hadron-native. It starts pinned electron.exe with ELECTRON_RUN_AS_NODE=1 and windowsHide, loads required modules and probes SQLite only in memory. It does NOT start the Electron app, create a profile, call credential APIs, create a PTY/shell, or make provider requests. Observed output: Electron 38.8.4/ABI139, keytar ready, node-pty ready, better-sqlite3 missing binding; exits 1 intentionally. This is the real current runtime readiness result, overriding broad rebuild success messages. git diff --check passed with CRLF warnings; no tests/build re-run for the diagnostic script/package script addition.

Compiler candidate inspected read-only: winget show --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --disable-interactivity reports Microsoft Visual Studio BuildTools 2022 version 17.14.44. Proposed next action requires C++ Build Tools/Windows SDK installation outside the checkout, potentially administrative rights and substantial disk space. User has not yet approved this system-wide prerequisite. Alternative is continue API/UI work while native startup remains gated; changing the pinned SQLite version is a separate dependency decision, not a silent workaround.

Next: obtain user choice on installing the C++ build prerequisite, then direct native rebuild and check:hadron-native before isolated app startup. Keep no live-provider/no-login limits. Collaboration API/UI remains unregistered; dual provider selector specification unchanged. Bundles from revision 11 remain the last successful JS builds; no installer or normal Electron application launch yet.

## Revision 13 — approved C++ tools and passing native readiness (2026-11-03)

User explicitly approved installing Visual Studio Build Tools 2022 with C++ support after the revision-12 prerequisite question. Executed winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-source-agreements --accept-package-agreements --silent --disable-interactivity --override "--wait --quiet --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended". Winget verified the installer hash, completed successfully, exit 0. This authorized system-wide developer tooling change is separate from the checkout; no forced reboot requested. vswhere confirms VC.Tools.x86.x64 at C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools; installationVersion 17.14.37827.9 (winget package label was 17.14.44).

Direct @electron/rebuild targeting the hoisted source/ygg-chat/node_modules/better-sqlite3, Electron 38.8.4 and force:true completed, exit 0. npm --prefix client/ygg-chat-r run check:hadron-native from source/ygg-chat now exits 0: Electron 38.8.4, ABI139, better-sqlite3 ready, keytar ready, node-pty ready. SQLite check opens only :memory: and executes SELECT 1. No credential API calls or PTY/shell creation. Native bindings now target Electron; plain Node native tests may still skip on ABI mismatch, so do not treat this as a Node-ABI rebuild.

Added NATIVE_SETUP.md with approved installer command, workspace-hoist warning, direct rebuild/native-check instructions and observed success. No app runtime source changed in this session. Final diff --check exit 0 (CRLF warnings); dependency manifests/lockfiles unchanged from revision 12. Earlier JS builds remain the last successful builds. Installed tooling/native compilation changed host developer tools and checkout node_modules/build/download caches as authorized.

No normal Hadron/Graviton application launch, app profile/database creation, provider login/inference, installer packaging or installed Graviton modification. Native readiness does not prove production migrations, startup/shutdown, renderer interaction, tools or the collaboration UI work.

Next exact action: controlled isolated startup/native schema smoke with no login/live providers, checking own profile/server PID and shutdown before UI exposure. Remaining P1 artifact/event/status contracts, authenticated collaboration API and Agent A/B selector renderer remain to implement. Do not ask again for the already approved compiler installation.

## Revision 14 — native production-server startup smoke (2026-11-03)

Added electron/hadronStartupSmoke.ts, scripts/check-hadron-startup.mjs and npm check:hadron-startup. Dedicated windowless Electron entry dynamically imports the production server factory only after configuring a fresh temp profile. Shared configureHadronEnvironment(dataDir) extracted to runtimeIdentity.ts and reused by normal bootstrap and smoke; synthetic in-memory settings, disabled secrets/tool-execution ports, no BrowserWindow, no callback listener, ephemeral loopback port. Global fetch is denied; health requests alone use a captured fetch directly against the returned own-server origin. This is not a comprehensive raw-socket/network sandbox and not an interactive app launch.

Actual final smoke passed, exit 0: Electron 38.8.4, native better-sqlite3, sqlite-vec enabled, migrations v1–v7 applied, both hadron tables present, health PID matched, custom tool guide copied into the new profile, double close succeeded and the listener stopped. blockedNetwork empty (zero intercepted fetch attempts). Fresh profile C:/Users/rajka/AppData/Local/Temp/hadron-startup-oKUNvO; portable report copied to validation/native-startup-2026-11-03.json. No credentials, live AI requests or personal/Graviton database used. Native production fresh-schema creation is now exercised, but upgrade of a real legacy production schema still needs its own fixture.

Fixed resource issue discovered by smoke: customToolLoader.resolveGuideSourcePath now prefers injected resourcesDir instead of the test bundle's app path. Fixed upstream builder typo CUSTOM_TOOLS_GUIIDE.md to existing CUSTOM_TOOLS_GUIDE.md for both source and destination. Expected sqlite-vec optional-candidate warning remains: @sqlite/vec unavailable, then installed sqlite-vec loads successfully.

Harness corrections recorded: first run failed before initialization due to duplicate createRequire in bundle banner; renamed banner import alias. Second harness waited for app.whenReady via top-level await, preventing main module startup completion; moved async lifecycle into a non-awaited runSmoke function. Initial typecheck also caught missing toolSandbox host port; supplied a disabled stub. Two failed smoke processes were stopped by exact checkout executable and startup-smoke command-line match; did not target installed Graviton. Final typecheck and native smoke pass. Early failed fresh temporary profiles remain diagnostic-only.

Validation from source/ygg-chat: npm --prefix client/ygg-chat-r run check:hadron-startup exit 0; typecheck:electron exit 0; test:server -- server/__tests__/hadronIdentity.test.ts server/__tests__/hadronHookIsolation.test.ts: eight passed/exit 0; separate test:tools -- server/tools/__tests__/customToolLoader.test.ts: two passed/exit 0. git diff --check exit 0 (CRLF warnings). Last complete renderer/main development builds remain revision 11; smoke bundles are built from current source each run. No release installer generated and no normal main/renderer launched.

Updated NATIVE_SETUP.md and Electron subsystem docs. Source HEAD still pinned upstream, accumulated changes uncommitted. Next: finish versioned P1 session status/artifact/event contracts and owner-authorized local API plus fake-provider route tests, then implement UI_DESIGN.md's Agent A/B provider/model controls and dual panes. Interactive renderer startup/login/coexistence, native upgrade parity and .exe acceptance remain gates. Keep all live-provider requests behind explicit user limits/approval.

## Revision 15 — internal proposal HTTP/status API (2026-11-03)

Added shared ProposalSessionStatus schemaVersion1 projection; ProposalSessionService.status rechecks owner/workspace access and returns phase, state/revision, effective limits, selected models, canonical run/stream references and proposal checkpoint references labelled verified:false. It omits private child handles, task/context packet and provider diagnostics. Stored limits must validate; legacy/malformed configs require explicit recovery. Added typed CollaborationOwnerMismatch/ProposalAccessDenied errors; start/read/Stop access failures can map consistently without leaking diagnostics. Stop now rechecks workspace access.

Added unregistered routes/collaborationRoutes.ts: POST /api/collaboration/proposals admits synchronously then returns 202 while observing completion rejection; GET /:sessionId returns status; POST /:sessionId/stop fences owned work. Explicit enabled flag and injected authenticatedOwner are mandatory. Disabled=404, unauthenticated=401, malformed=400, owner/access denied=403, admission conflict/rejection=409, unexpected read/Stop=generic500. Requests never supply authoritative owner/capabilities. HTTP disconnect does not cancel admitted work; explicit Stop does.

Added routes/__tests__/collaborationRoutes.test.ts (seven cases), using actual ProposalSessionService/repositories and Node SQLite with fake providers through local HTTP. Test principal header is synthetic transport only, NOT production auth. Covers immediate acceptance/two streams, duplicate admission/completed replay, sanitized artifacts/status, disabled/unauthenticated routes, unsupported provider/authority fields, changed config, cross-owner read/Stop, revoked workspace access, durable cancellation and async provider failure/no automatic retry. Production composition root does not import/register this module, so no new live inference entry point exists.

Added collaboration/API.md and updated README with exact implemented scope: proposal-only phase; completed means proposal checkpoint completion, not full collaboration success. Polling status is not an append-only event log; revision is session-transition revision, not token sequence. Existing stream references require separate owner-checked streaming access before UI live integration. Full versioned artifacts/evidence/events and cross-review/synthesis remain unfinished.

Validation from source/ygg-chat: npm --prefix client/ygg-chat-r run test:headless -- server/headlessServer/routes/__tests__/collaborationRoutes.test.ts server/headlessServer/services/__tests__/proposalSessionService.test.ts server/headlessServer/services/__tests__/proposalSpike.test.ts server/headlessServer/persistence/__tests__/collaborationRepo.test.ts: four files, 46 passed/0 skipped, exit 0. Earlier two-file run 23 passed; final supersedes it. typecheck:server and typecheck:electron passed; diff --check passed with CRLF warnings. No migrations, normal app launch, login/live AI or installer this session.

Next exact action: provide a production-trusted desktop principal and stream-access boundary behind a disabled feature flag; build renderer client/setup state and dual Agent A/B provider/model controls against fake API fixtures. Do not use test headers, request-body user IDs or unvalidated provider defaults as production authority. Native/JS startup evidence remains revisions 11–14; renderer visible interaction, real login/coexistence and .exe are still open gates. No user action required for these development steps.

## Revision 16 — setup panel, client and desktop capability candidate (2026-11-03)

Implemented src/components/CollaborationPanel/CollaborationPanel.tsx (not mounted): independent Agent A/B provider/model fieldsets, connection labels, shared task, gated Start and session Stop callbacks, locked active configuration, generic errors and proposal-only labels. No fixed provider catalog or live auth status is invented; props carry server-validated options later. Separate A/B state helpers in src/features/collaboration/setup.ts reset only the changed agent model, validate availability and copy frozen admission input. General/coding selector, live panes, cross-review/synthesis UI and branch navigation still pending.

Added renderer client.ts using verified getLocalServerOrigin and caller-supplied trusted capability, bearer header only, encoded IDs and no automatic retries. Rejects unsupported status version/phase/limits/participant/artifact shapes. This UI client currently targets A/B IDs; it is not an arbitrary participant client. No trusted IPC getter is supplied in the running app yet, so client/panel cannot launch inference.

Added server/headlessServer/services/collaboration/desktopAccess.ts capability candidate: process-local 32-byte grant, loopback request validation, constant-time bearer comparison, owner AND auth-session binding, explicit revoke and stable issuance within the same principal/session for concurrent requests. Account/session changes deny old grants. Candidate is not connected to main-frame IPC, production principal provider, stream authorization or route registration. Do not claim the test header becomes production authentication. Follow existing trusted-main-frame IPC guard when wiring.

New tests: desktopCollaborationAccess.test.ts (two), setup.test.ts (two), client.test.ts (three), CollaborationPanel.test.tsx (one static-render case). Final renderer run also includes api.isolation.test.ts: 12 passed/four files, exit 0. Headless run with desktopCollaborationAccess.test.ts and existing collaborationRoutes.test.ts: nine passed/two files, exit 0; later rerun of the two access tests passed after stable issuance/session-binding refinements. Total distinct final suite counts 21 across separate renderer/headless runs; do not add repeated tests. Server/Electron typechecks pass.

npm --prefix client/ygg-chat-r run build:electron passed (tsc -b and Vite; 7442 modules, Vite stage 1m17s; existing mixed-import/large-chunk warnings). Latest unmounted client-validation edits occurred after that build's initial TypeScript stage, so ran full tsc -b again via the client-resolved typescript/bin/tsc module; exit 0. First guessed hoisted compiler path failed MODULE_NOT_FOUND, corrected using client dependency resolution. Unmounted modules are statically checked/tested, not claimed present in the active app bundle/tree. Generated tracked vite.config.js/.d.ts restored; last diff --check passed with CRLF warnings.

Updated module README, collaboration API notes and PROJECT_MAP. No live provider requests, visible window, migrations, native rebuild, login or installer this session. Source HEAD remains pinned with uncommitted changes. Next exact action: wire trusted main-frame capability issuance and server principal/stream checks behind an explicit disabled feature gate; mount setup in a fixture/demo-only integration and implement dual stream panes with cancellation/reattach tests. No user action needed. Do not enable live inference until approved provider test limits and auth/safety gates are satisfied.


## Revision 17 — guarded IPC and mounted fixture preview (2026-11-03)

Added shared HADRON_LIVE_COLLABORATION_ENABLED=false, guarded collaboration:availability/capability handlers in electron/main.ts, preload methods and ElectronAPI declarations. They use the existing mainWindow/mainFrame authHandle guard. Availability reports preview true/live false; capability issuance throws while disabled. Dormant principal callback binds current local owner, process/app auth generation and Codex session; auth notifications revoke grants. No production collaboration routes or authorized stream route are wired, so no inference entry point is enabled. Do not flip the shared constant without completing backend grant registration and live-test approval.

Added CollaborationPreview.tsx and CollaborationStreams.tsx, mounted as the separate /hadron-preview route in App.tsx. In Electron its hash URL is #/hadron-preview after the app is running. Two independently selected simulated models, shared task, two labelled response panes, explicit simulation/no-account/no-branch banner and Stop-both behavior. Fixture route has no collaboration API/provider imports, no credentials or chat writes. Timers are cleaned up on effect teardown; previewState reducer owns separate A/B text/cursors, rejects duplicate/reordered/old-session/post-Stop frames and resets on new session. These are fixture projection semantics, not tested real SSE replay/reattach. Normal Chat integration remains unmounted. Added connectionLabel to distinguish simulated connection from real account status.

ProposalSessionService.ownsStream adds an owner/workspace-checked stream-membership predicate, covered in existing service test. No streaming HTTP endpoint currently consumes it. Existing generic upstream stream route is unchanged; collaboration must not rely on it as the completed scoped authorization boundary.

Tests from source/ygg-chat: test:renderer -- src/features/collaboration/previewState.test.ts src/features/collaboration/setup.test.ts src/features/collaboration/client.test.ts src/components/CollaborationPanel/CollaborationPanel.test.tsx: nine passed/four files, exit0. test:headless -- services/__tests__/proposalSessionService.test.ts and desktopCollaborationAccess.test.ts at their existing full paths: 19 passed/two files, exit0. test:server -- server/__tests__/hadronDesktopBridge.test.ts: two passed, exit0. Bridge test executes actual main.ts guard/registration source in a synthetic VM: false gate denies grant; test-only true gate rejects foreign windows/subframes. Total separate suite counts 30; static-render/reducer tests do not prove visible keyboard/layout interaction.

build:electron:main passed with Electron/mobile typechecks and main/preload/tool utility/analytics/mobile bundles. build:electron passed (project TS + Vite, Vite stage57.68s, existing large-chunk/mixed-import warnings). Renderer build output retained at validation/renderer-build-r17.log. Generated tracked vite.config.js/.d.ts restored after build. diff --check passed before restoration with CRLF warnings. UI_DESIGN and renderer README updated. No login, paid/live AI request, normal window launch or installer this session.

Next exact action: build the owner-authorized collaboration stream replay route and real client stream lifecycle with disconnect/reconnect/cancel tests, then connect backend principal/capability registration while the live gate stays disabled. Integrate setup and panes into normal chat only after scoped stream/provenance/feature-off checks. Cross-review/verification/synthesis, coding role/write-lease, real provider/login/coexistence and release gates still remain. No user action is needed for the next development steps.

## Revision 18 — scoped replay endpoint and client reader (2026-11-03)

Added GET /api/collaboration/proposals/:sessionId/streams/:streamId?fromSeq=N to the still-unregistered internal route module. Requires enabled flag, authenticated owner, current workspace access, stream membership in the durable session and matching registry conversation. Cursor validation rejects malformed/unsafe/negative values, unavailable retained history (including zero after truncation) and future cursors. Missing replay stream=410; out-of-range history=409. RunSession.canReplayFrom adds strict scoped admission without changing legacy attach behavior.

Before every response data frame, route rechecks owner/workspace/feature access. One-second idle checks close revoked viewers too. access_revoked closes only the subscriber, never the underlying inference. HTTP disconnect detaches; explicit session Stop still owns cancellation. Terminal buffered replay works without new inference. Replay remains in-memory and cannot survive process loss; persisted transcript/status recovery stays explicit.

Added renderer stream.ts and client.stream: header-only capability, scoped URL and cursor, incremental UTF-8/CRLF SSE parsing, per-frame/pending-buffer bounds, strict contiguous sequence, duplicate replay suppression, terminal fencing, abort cancellation/release and structured cursor-bearing errors. A disconnect requires explicit GET reattachment, never an inference launch. No reconnect supervisor or normal Chat integration yet. Regression refinement ensures a large batch of valid frames is not rejected as one oversized frame.

Expanded real-service/SQLite HTTP tests from seven to14: owner/stream/cursor checks, truncation, disconnect/reconnect without new launches, revoked access before a frame and while idle, explicit Stop with terminal replay, wrong registry conversation. Registry tests retain all15 existing passes. Renderer reader tests cover split bytes/CRLF, comments, cursor replay/gaps, invalid/null frames, revoked access, stalled-read detach and large valid batch versus oversized frame. Client transport test confirms scoped header-auth replay.

Final validation from source/ygg-chat: test:headless -- server/headlessServer/routes/__tests__/collaborationRoutes.test.ts server/headlessServer/services/__tests__/runSessionRegistry.test.ts: 29 passed/two files, exit0. Separate test:renderer -- src/features/collaboration/stream.test.ts src/features/collaboration/client.test.ts src/features/collaboration/previewState.test.ts: 14 passed/three files, exit0 (supersedes earlier13 run). Total43 across separate suites, no skips. typecheck:electron and client-resolved tsc -b passed. Last tiny frame-bound placement change was runtime-tested in final renderer suite. diff --check passed; generated tracked Vite config outputs restored. No full Vite rebuild this session; last full builds revision17. No normal app launch/login/live providers/native rebuild/installer or installed Graviton changes.

Updated collaboration API/renderer README. Production integration remains disabled/unregistered. Security gate: upstream generic /api/streams/:id route is unchanged and would bypass scoped collaboration authorization if live streams were registered; close that path for collaboration-owned streams BEFORE enabling/registering real collaboration. Add registry provenance/guard integration without changing ordinary single-agent behavior. Next exact action: generic stream read/abort bypass fencing plus server principal/grant registration under false live gate, then real stream supervisor/Chat pane integration and permission/workflow gates. No user action required.

## Revision 19 — generic stream bypass fence (2026-11-03)

Added readonly chat/collaboration RunSession accessScope (ordinary scope remains default). Trusted SubagentRunService.prepareRun marks admitted streams collaboration BEFORE started/publication/provider dispatch; actual registry test checks scope in onPrepared. Scoped collaboration SSE now also requires that registry scope. Resume preparation remains ordinary scope and is explicitly pending ownership audit before live use.

Generic GET /api/streams/:id, POST /api/streams/:id/abort, and duplicate client-stream chat POST now reject protected IDs with403 before replay, cancellation or inference, including the legacy non-resumable chat-post path. Generic registry replace/create cannot recycle collaboration IDs or abort their owner before rejection. Process-local scope tombstones survive delete/reaper eviction. Added CollaborationRepo.ownsStreamId indexed lookup and injected it into production headless registry to fence saved IDs after restart; no config/transcript returned by lookup.

Added collaborationStreamFence.test.ts: generic read/abort/duplicate POST denial without cancellation/subscriber/inference, ordinary replay/abort retained, scope replacement denied before abort, eviction tombstone and simulated persisted lookup protection. Expanded real repository binding test for persisted lookup, actual SubagentRunService/RunSessionRegistry scope-before-dispatch test, and scoped route tests to use trusted scope.

Final test command from source/ygg-chat: npm --prefix client/ygg-chat-r run test:headless -- server/headlessServer/routes/__tests__/collaborationStreamFence.test.ts server/headlessServer/routes/__tests__/chatRoutes.resumable.test.ts server/headlessServer/routes/__tests__/chatRoutes.test.ts server/headlessServer/routes/__tests__/collaborationRoutes.test.ts server/headlessServer/services/__tests__/runSessionRegistry.test.ts server/headlessServer/services/__tests__/subagentRunService.test.ts server/headlessServer/persistence/__tests__/collaborationRepo.test.ts
Result: seven files,106 passed/0 skipped, exit0. Initial five-file run45 passed, superseded. typecheck:electron passed. Native check:hadron-startup passed against current bundled source, fresh profile and production schema/registry query wiring: health own PID, generic unowned stream returns410, migrations7, both Hadron tables, guide, double close and listener shutdown verified; zero intercepted fetch attempts. Portable report validation/native-startup-r19-2026-11-03.json. No normal visible app/login/provider requests/installer this session. diff --check passed with CRLF warnings. No full main/renderer build this session; smoke separately bundles current source.

Live gate remains false and collaboration routes unregistered. Stream bypass is closed for registered/saved collaboration IDs, not a claim of full subagent API security: generic transcript read/list/mutation and manager resume/send/cancel entry points require audit/fencing before enabling real sessions. Plain native legacy-upgrade fixtures/full interaction/release tests remain open. Installed Graviton files/data/settings/credentials unchanged.

Next exact action: fence canonical collaboration transcript and manager control/resume paths using durable run ownership, preserve ordinary subagent behavior, then backend principal/grant integration under false gate and real Chat stream supervisor/panes. No user action required; do not re-ask settled isolation/compiler/provider choices or launch paid/live tests without limits.


### 2026-11-03 � Work log revision 20

Added CollaborationRepo.ownsRunId and production SubagentRunService durable ownership callback. Trusted admissions also record process-local protected run IDs immediately after row creation, before started events. Generic getRunByHandle returns null for protected runs, lineage/tool-call transcript lists filter them, and generic latest-stream lookup returns null when a tool call includes protected runs. All manager status/wait/send/cancel/resume actions resolve through getRunByHandle before control; internal coordinator cancellation remains available. resumeDetached additionally refuses protected run IDs before CAS reopen, transcript repair or provider preparation. This preserves the trusted session Stop path.

Validation: subagentRunService (52), subagentToolExecutor (30), collaborationRepo (10): 92 passed, zero skipped. New regression covers persisted handle/list hiding, mixed tool-call results, stream-reference suppression and resume rejection before any reopen. Real SQLite binding regression checks run ownership before/after bind. Electron typecheck passed before final test-only additions and moving the same protected-run insertion earlier; final typecheck rerun below. No live AI, window, login, native rebuild or installer. Installed Graviton untouched.

Remaining: broader generic CRUD/branch transcript mutation audit (including parent deletion/export behavior), route-level boundary tests and backend principal/grant integration under false gate; then real Chat stream supervisor/panes. These guards do not constitute a completed full API authorization audit. Production collaboration routes remain unregistered and live gate false.


### 2026-11-03 � Work log revision 21

Audit found legacy server/routes/runStateRoutes.ts directly bypassed the headless manager guards. Added production durable CollaborationRepo callbacks to its registration in localServer. Protected run IDs now reject generic create/upsert, transcript append and status mutation before repository access (403); parent/conversation transcript lists filter protected runs. Protected stream IDs reject durable ledger GET/POST/PATCH before record reads/writes, and mixed conversation ledger lists omit them. Repository cache is now per registration rather than a module singleton, avoiding cross-database instance reuse.

Also found insertSubagentMessage ON CONFLICT(id) could overwrite a different run's message via an ordinary run ID. Production SQL now updates only when existing and incoming run_id match. Regression executes the extracted production prepared SQL in real in-memory Node SQLite, checks cross-run overwrite is ignored and same-run updates still work. No schema migration needed for this prepared-statement change.

Validation: test:server runStateRoutes.test.ts seven passed. test:headless subagentRoutes (13), collaborationStreamFence (3), subagentRunService (52), subagentToolExecutor (30), collaborationRepo (10): 108 passed; total115 distinct tests, zero skipped. typecheck:electron passed. check:hadron-startup passed on fresh isolated profile with production registration/DB callbacks, schema7, own health PID, clean double-close, zero blocked network attempts. Report validation/native-startup-r21-2026-11-03.json. No full renderer build or visible app/login/live providers/installer this turn. Installed Graviton remains untouched.

Audit scope: canonical subagent table access is through runStateRoutes/SubagentRunRepo and the protected headless service. Main messages/branch exports intentionally contain checkpoint excerpts, not private canonical transcripts. Source anchor/conversation deletion cascades canonical runs; collaboration session/participant references also cascade. Deletion during active work, lineage cascade effects and surviving stream-ledger provenance across parent deletion/restart still require explicit lifecycle/retention tests before enabling live collaboration. Do not claim the entire deletion/export audit completed.

Next: resolve deletion/retention provenance and active-session cancellation on parent removal, then bind backend principal/grants under the existing false live gate and build the real Chat stream supervisor/panes. Routes remain unregistered/live AI disabled; user action unnecessary.


### 2026-11-03 � Work log revision 22

Added append-only schema migration8 hadron_collaboration_deletion_guards and shared fresh-install trigger setup. BEFORE DELETE session guard aborts deletion (including anchor/lineage/conversation foreign-key cascades) while session is created/running/stopping. User must Stop and await cancellation before retrying deletion; no automatic cancellation/deletion flow is claimed. A terminal-session cleanup trigger removes owned streaming_runs, subagent_messages and subagent_runs before durable participant references disappear. Ordinary run records remain untouched. Process-local replay protection still retains tombstones after deletion.

Tests: CollaborationRepo now15 cases (five new lifecycle cases): populated-v7 trigger install/reinstall, all four parent/direct deletion paths, atomic refusal for all three active states, all four terminal states, unrelated deletion and ordinary records preserved. ProposalSessionService now18 cases (one new real-service test): while both mocked providers run, delete is blocked; Stop remains blocked until promise drains, then terminal deletion clears canonical transcripts/runs and no checkpoints publish. Initial fixture revealed no message FK in that minimal schema; cleanup now explicitly deletes messages too, tested both with/without FKs.

Validation: final headless two-file run33 passed/zero skipped. Server migration/legacy route tests12 passed/zero skipped. Total45 distinct tests. Electron typecheck passed. Native startup smoke passed against current source, fresh isolated profile, migrations1..8, own health PID, zero blocked fetch attempts and clean shutdown; report validation/native-startup-r22-2026-11-03.json. No normal window, login, live provider requests, full renderer rebuild or installer. Installed Graviton untouched. Full interactive deletion error UX is pending normal Chat integration; legacy routes currently surface generic errors on database refusal.

Next exact action: bind trusted main-process principal/capability to backend collaboration routes behind false gate, then implement real renderer stream supervisor and dual Chat panes. Keep paid/live inference disabled until approved bounded tests and remaining workflow/auth/release checks. No user action required.


### 2026-11-03 - Work log revision 23

Connected main-process capability authentication to backend via new desktopHost module. Main installs existing authenticator; trusted main-frame IPC alone issues tokens. Backend never uses body/query identity. Production now registers all four proposal routes behind shared HADRON_LIVE_COLLABORATION_ENABLED=false (supersedes earlier unregistered claims). Exact local conversation user ownership and project user ownership required. Production model allowlist explicitly EMPTY; changing feature flag alone cannot dispatch paid work. Coordinator forwards trusted owner as provider userId to both children. Real standalone local identity/login/account/model admission remain unvalidated; current principal depends on publicAuthState.user. Do not enable live inference yet.

Validation: main-frame bridge3 tests, headless proposalSessionService18 + collaborationRoutes14 + desktopAccess2: total37 distinct passes/zero skips. Electron typecheck passes. Registering route exposes its SSE payload typing to Electron graph; fixed explicit Record typing without changing wire format. Native isolated startup passes schema8, own health PID and clean shutdown; all four proposal endpoints explicitly return404 with forged Bearer headers while feature is false. Zero intercepted network attempts. Report validation/native-startup-r23-2026-11-03.json. No visible normal app, login, live AI, full renderer build or installer; installed Graviton untouched. Windows legacy/mixed text encodings encountered in editing; source edits use UTF-8, handoff log appended as ASCII without rewriting existing bytes.

Next: renderer A/B stream supervisor, separate cursors, status polling, explicit replay reconnect, unmount detach without Stop, explicit Stop-both and session replacement fencing; then normal Chat dual-pane integration under false gate. Local identity/model policy plus full general/coding/review/verification/synthesis and release checks remain. No user action needed.


### 2026-11-03 - Work log revision 24

User requested a quick desktop launch shortcut for later. Configured NSIS createDesktopShortcut=true, shortcutName='The Hadron Harness' in existing independent builder config. This is future installer behavior, not a shortcut created now or a completed installer test. Installed Graviton unchanged.

Implemented renderer CollaborationSupervisor: observation/replay only (no Start method), independent A/B text/cursors/stream identities, status polling, explicit reconnect GET from saved cursor, per-stream errors, generation fencing for late status/frames/Stop acknowledgments, response size bound, terminal fencing, explicit Stop call, and detach/abort on dispose or session replacement without automatic Stop. Client status accepts AbortSignal. Stream failures do not auto-retry inference or automatically reconnect; user explicitly requests replay/status recovery. Status polling pauses on errors and terminal state.

Added CollaborationSessionView wired to supervisor and trusted Electron capability getter, disabled by shared false live gate. Includes independent response labels/status, reconnect buttons, session error recovery and explicit Stop-both; previous-session text hidden immediately on prop replacement. It is reusable but NOT mounted in normal Chat yet. CollaborationStreams now supports individual status and optional reconnect; existing simulation route unchanged. Existing setup stays separate from observing an existing session.

Validation: renderer supervisor7 + reader8 + client4 + component static3 =22 passed/zero skipped. Includes independent replay positions, no implicit Stop, late status/Stop/frames on replacement, terminal no-reopen, polling/status failure, duplicate/gap fencing and disabled viewer markup/no fetch. Full client-resolved tsc -b passed; no generated tracked Vite config changes. diff --check passes (existing CRLF warnings). No full Vite build, visual interaction/window, live AI, native startup rerun or installer this turn. SSR does not prove mounted effect or keyboard/layout behavior. Initial test assertion used unsupported Vitest matcher, replaced with supported count/arguments checks and rerun.

Next exact action: integrate collapsed setup/session view into normal Chat without disturbing Heimdall or transcript virtualizer geometry, wire explicit admission context/selection under false gate, then mounted effect/interaction and visible layout checks. Backend local identity/login/model allowlist still pending (production model allowlist empty). Full workflows and release gates remain. No user action required.


### 2026-11-03 - Work log revision 25

Mounted a desktop-only Work together action in normal Chat's ConversationToolbar. Opens CollaborationWorkspace using native modal dialog/portal outside transcript virtualizer/Heimdall geometry. Dialog starts closed, focuses Close, supports Escape/Close with native focus restoration, owns separate A/B provider/model controls and shared task, and shows CollaborationSessionView response panes. Workspace keyed by conversation; closure uses identity guard to avoid an old dialog clearing a new conversation's state. Desktop-only entry/mount; ordinary web toolbar unchanged.

This is a DISABLED integration: unavailable ChatGPT collaboration option, empty models, Start disabled. No account connectivity is invented. No source anchor/context/admission wiring or real saved session selector is implemented yet; sessionId is null and status remains setup-only. Do not claim live admission or live text works through the mounted Chat entry. Existing reusable supervisor/view supports actual sessions but production allowlist remains empty/feature false. Same provider/model and independent sessions versus accounts are explained in dialog. Future desktop shortcut stays configured only; no installer/shortcut changes executed.

Added check:hadron-ui script: bundles actual workspace component into an isolated fixture, launches hidden pinned Electron BrowserWindow with fresh temp userData, sandbox/context isolation/no Node renderer, blocks non-file resource loads and replaces fetch to fail. Checks four labelled selectors, disabled Start, initial keyboard focus, Close, focus restoration, reopen/Escape, narrow dialog overflow, no fetches. Saves desktop/dark/mobile screenshots and JSON. Final run success; copied artifacts validation/collaboration-*-r25*. Inspected desktop/mobile captures: side-by-side A/B on desktop, stacked mobile, scrollable constrained modal. This is a real mounted component test, not a normal app/login/full chat/tree interaction test.

Validation: renderer collaboration tests22 passed plus toolbar6 passed =28 distinct passes/zero skips. Full build:electron passed tsc -b and Vite7453 modules,1m10s Vite stage with existing mixed-import/large-chunk warnings. Initial build caught prior-turn deferred Stop test's overly narrow inferred return type, fixed mock annotation then build passed. Initial UI test looked in wrong dist path; corrected to production dist-electron/assets and reran successfully. Final minor Chat desktop/closure guards followed build; final tsc -b rerun tracked separately. Initial final tsc invocation from docs root could not resolve TypeScript; corrected client cwd. No native startup rerun/main bundle/login/live providers/installer; installed Graviton untouched.

Next: wire explicit frozen-anchor/context and trusted provider/model metadata to workspace under false gate; resolve local desktop principal in standalone Hadron without upstream app login, and add saved-session selection/status with safe ownership checks. No approved models or live calls until explicit bounded tests. Full review/verification/synthesis/coding and release tests remain. No user action required.


### 2026-11-03 - Work log revision 26

Connected normal Chat selectedPath/conversationMessages/currentLineageId to captureCollaborationAnchor. On dialog open, freezes exact saved tip/lineage and text JSON from selected user/assistant/ex_agent messages only. Rejects missing/duplicate/cross-conversation path and context over28000 characters without silent truncation. Sibling branches, files, tool results/system messages excluded. Product dialog shows selected text-message count and expandable Review shared context. Still no Start request; production feature false, model allowlist empty, workspace admission remains unavailable.

Added guarded read-only collaboration:setup IPC in main/preload/types: schemaVersion, liveEnabled, ownerAvailable, ChatGPT ready boolean and empty models only. No credential/capability/email/account values. Workspace fetches on open, fences late close/conversation responses and accurately labels connection/model approval state. Existing local_login_enabled path supplies publicAuthState.user without upstream app/provider login. Source-backed runtime test confirms local enable/disable returns/removes local principal while app/provider remain signed out. Isolated Hadron settings/profile remain boundary; no auth runtime behavior changed.

Validation: renderer context2 + supervisor7 + static components3 =12 passes; server main-frame bridge4 + local principal1 =5 passes; total17 distinct/zero skipped. Full client tsc -b passes. build:electron:main passes Electron/mobile typechecks and main/preload/tool utility/analytics/mobile bundles. Isolated mounted Electron UI test now uses real context capture and fixture read-only metadata, verifies correct selected text/no tool output, four selectors, Start disabled, focus/Close/Escape/restoration/mobile overflow and zero fetches. JSON validation/collaboration-ui-r26-2026-11-03.json; desktop screenshot validation/collaboration-desktop-r26.png inspected. UI fixture uses existing r25 production CSS and current esbuild component; no full Vite build this turn, no normal app/login/live provider/native startup/installer. Installed Graviton untouched. diff --check passes with existing CRLF warnings.

Next: implement owned saved-session discovery/selection and persist selected session reference per conversation, connect to actual session viewer under false gate, and wire explicit frozen snapshot admission callback once approved model metadata exists. Production models remain empty; cannot enable live Start just by toggling frontend. Full review/verification/synthesis/coding, provider login/coexistence and installer/release tests still pending. No user action needed for next internal development.


### 2026-11-03 - Work log revision 27

User explicitly wants a say in UI design when ready; existing layout remains provisional. Continue backend/session work without treating current UI as final. Added owner/conversation-authorized saved-session discovery GET /api/collaboration/proposals?conversationId=...&limit=1..50&before=... behind same false feature gate. Repository bounds deterministic descending session-ID pages (not chronological order); service requires explicit conversation authorization before querying, then rechecks each session/workspace via status. Public summaries include session/conversation/phase/status/revision and A/B provider/model labels only; no packet, private handles or stream/run refs. nextBefore cursor; default20. No timestamps/schema changes.

Production uses same strict exact local owner/project authorization for discovery and individual sessions. Renderer client list method uses header-only trusted grant, encoded query, optional AbortSignal, bounded versioned page validation and rejects cross-conversation results without retry. No UI layout changed or session picker mounted this round. Saved session references must still be reauthorized on reopen; no auto Start/resume.

Validation: headless HTTP16 + service18 + repository16 and renderer client6 =56 distinct passes/zero skipped. Electron typecheck and full client tsc -b pass (last added client negative runtime-only test after tsc pass). Native isolated startup schema8 passes with all FIVE endpoints, including discovery, returning404 behind false gate; own health PID, zero intercepted network, clean shutdown. Report validation/native-startup-r27-2026-11-03.json. No normal visible app, login/live AI, full Vite/main rebuild, installer or Graviton modifications. diff --check passes with existing CRLF warnings.

Next: backend/session selection controller with conversation/owner fencing, explicit paging, saved-session reauthorization and connect existing observer, keeping UI provisional. Gatefalse/modelsempty. User subsequently asked to continue autonomously without stopping until user input required; honor that and do not end after each small revision. UI design review and live paid test limits need user involvement later, not now.


### 2026-11-03 - Work log revision 28 (continuing autonomously)

Added SavedSessionsController: explicit bounded paging, every selection reauthorized through status, discovered IDs only, conversation/generation/abort fences, refresh clears selected authority, no Start/Stop/resume methods. SavedCollaborationSessions provisional functional selector wired to workspace -> existing CollaborationSessionView; hidden while live flag false. No persistent selection cache/auto reopening; caller must explicitly choose a discovered session. UI design remains subject to user input.

Added owned participant saved transcript GET /:sessionId/participants/:participantId/transcript. Rechecks session/workspace/owner, binding and run conversation, returns only settled completed/aborted/error visible output, verified=false, max1Mchars. No prompt/user packet/thinking/raw errors/tool output; no resume. Missing/unsettled record404. Client validates scoped identities/version/size/status. Supervisor only falls back on live replay410; ordinary disconnect/auth errors do not trigger fallback. Fallback completion is generation-fenced, terminal and labelled partial when noncompleted. This supports re-opening output after process replay buffers disappear without new AI calls.

Tests: renderer session browser4/supervisor10/client7/static components3=24 pass. HTTP routes17 pass (includes settled-only transcript recovery, foreign owner, revocation, feature-off and no extra provider requests). Electron typecheck passed; full client tsc-b passed before final test-only additions. Native startup schema8 and all SIX endpoints404 under false gate, clean shutdown, zero intercepted network; report validation/native-startup-r28-2026-11-03.json. Isolated mounted UI gate-off checks pass/no fetch, report collaboration-ui-r28-2026-11-03.json. No live provider calls/login/installer/Graviton changes. Production approved models empty.

User explicitly requested continue without stopping until needed. Do not end after routine revision; continue toward remaining admission/workflow/auth/release gates, preserving user UI design review and explicit paid-test approval. Next: wire explicit frozen admission with ambiguous-response/retry safety, then broaden targeted integration regressions and address remaining workflow phases.


### 2026-11-03 - Work log revision 29 (continuing autonomously)

Added CollaborationAdmission once-only POST coordinator and wired frozen snapshot callbacks into provisional workspace behind false gate. Saves identity-only recovery marker BEFORE POST; if storage unavailable, no request. Unknown replies cannot resubmit; GET status recovery coalesces and validates exact session/conversation; even404 keeps duplicate fence. Fresh controller instance reads saved marker and requires recovery. Only confirmed terminal status permits explicit Prepare another task and clears marker. Marker contains session/conversation/version only, never task/context/token. Closing/disposal detaches callbacks only. Production models still empty; no paid dispatch possible. Showing a different saved session no longer exposes Stop for another admission session in setup panel.

Fixed context-preview max mismatch: shared PROPOSAL_CONTEXT_MAX_CHARS=16000 now drives both parser and renderer snapshot capture (previous28000 preview limit could prepare context rejected by server). No silent truncation. Added initial unregistered reviewPacket data builder: requires completed proposal barrier, exact owner/workspace, two durable bindings, canonical model/provider/anchor/prompt hash, fork receipt attempt/result hash and existing checkpoint paths. Bounded excerpts6000chars each explicitly marked truncated/unverified; packet64KiB limit, immutable output. No review provider calls or phase scheduling yet. Real SQLite test rejects early/foreign/tampered proposals and prepares reciprocal packets without extra inference.

Broader validation: renderer collaboration/toolbar50 passed10files; headless proposal/manager/ownership148 passed7files. New reviewPacket test later increases proposalSessionService18->19 (19 passed final module run). Full build:electron passed7457modules/Vite56.3sec, existing chunk/import warnings; context constant was changed while build was running, final typecheck/test rerun still needed for final source. No live AI/login/installer/Graviton changes. UI gate-off smoke passes/current workspace, JSON validation/collaboration-ui-r29-2026-11-03.json. Production source is independent; no normal app launched.

Next: complete review packet/admission validation, remaining durable workflow phase/artifact/evidence contracts and scheduling. User UI design review is required before final appearance; user approved continuing autonomously until input needed. Do not stop after each small revision.


### 2026-11-03 - Work log revision 30

Added generalWorkflowPolicy.ts (internal, not scheduled/registered): immutable plan for2 proposals+2 cross-reviews+0 provider verification+1 chosen synthesis, one review round, toolPolicy none, derived per-participant request maxima3/2. This is NOT approved production spend or an executing workflow; current production proposal policy remains1 per participant, model allowlist empty/livefalse. Evidence projection keeps claims unverified absent explicit trusted server-observed/human-attested sources, retains contradictions and rejects model-assertion provenance. Actual trusted evidence adapters/durable artifact ledger/phased dispatch still pending.

Expanded reviewPacket real-SQLite regression: unverified/instruction-like model output stays quoted data,6000char excerpts marked truncated, revoked workspace denied, UTF-8 total packet cap checked separately from config byte cap. Initial multilingual fixture exceeded existing durable config byte cap before review; adjusted to valid60KB config plus review excerpts to exercise intended64KiB review rejection. Module remains internal/unregistered and dispatches nothing.

Final integrated checks: headless153/8files + renderer50/10files + server17/4files =220 distinct tests passed, zero skipped. Full client tsc-b passes latest source. Full main/preload build passes Electron/mobile types and bundles. Full renderer build passes7457modules/Vite56.3sec (context sharedconstant changed during build; latest tsc/tests pass final constant). Isolated mounted UI rerun with latest built CSS passes frozen-context/four-controls/Start-disabled/focus/Close/Escape/restoration/mobile/no-fetch. JSON validation/collaboration-ui-r30-2026-11-03.json; screenshot collaboration-desktop-r30.png. Last native startup r28 schema8/all six endpoints404 remains current server wiring; no need to repeat unchanged native setup. diff --check pass; no tracked generated Vite config diffs observed. No paid/live calls, normal app login, installer, installed Graviton changes.

User wanted UI input before final design and autonomous work until needed. After advancing backend several revisions without stopping, asked asynchronous layout preference: main Chat switch single/two-agent, separate side workspace beside chat/tree, or prototype dialog. No response yet; do not infer approval. Current layout provisional. Concrete screenshot available for review. Next UI layout work depends on preference; backend remaining work includes durable full-workflow phase/artifact/evidence/attempt records, review/synthesis scheduling, coding one-writer lease and approval/permission tests. Provider sign-in/coexistence, bounded paid test approval and installer/clean-Windows tests remain future user/external gates.


### 2026-11-04 - Work log revision 31: user-selected side workspace

User answered UI question: separate workspace beside chat and branch tree. Implemented this direction in normal desktop Chat; removed modal/portal shell. New ChatCollaborationLayout keeps chat/tree coordinate space in its own flex region (containerRef moved there), and docks collaboration to the right on wide windows. Narrow windows stack it below chat/tree. Main chat remains interactive, no backdrop/focus trap. Close/Escape inside workspace restore opening control focus. Toolbar reports workspace controls/expanded state instead of dialog semantics. Workspace stays keyed to conversation; existing session lifecycle/livefalse/modelsempty unchanged. Provider/response grids now respond to available pane width via auto-fit rather than viewport media breakpoints.

Fine styling/widths remain provisional; user chose location, not final aesthetic approval. Updated UI_DESIGN with explicit user direction, superseding modal notes. Colourful Heimdall implementation unchanged; divider coordinates still use isolated chat/tree rectangle. Full actual Chat/tree interactive regression has not been run; mounted fixture exercises the same layout shell/workspace with illustrative chat/tree, not real database data.

Validation: renderer collaboration/toolbar51 tests pass10files (one new layout structural case), full build:electron (tsc-b + Vite7458modules,1m8s stage) passed; existing mixed-import/large-chunk warnings. Updated isolated Electron UI fixture uses actual layout shell/workspace and current built CSS. Checks desktop dock beside chat/tree, main chat textarea can receive focus while workspace stays open/no modal, separate A/B controls, selected context, Start disabled, close/Escape/focus restoration, mobile stacking/no pane overflow, zero fetches. All pass. Captured/inspected wide light and narrow dark screenshots. Artifacts validation/collaboration-ui-r31-2026-11-04.json, collaboration-workspace-r31.png, collaboration-workspace-mobile-r31.png. No paid/live AI, normal app/login/native rebuild/installer, or installed Graviton changes.

Next: get user feedback on this concrete side-workspace preview before polishing layout; continue remaining durable full-workflow phase/artifact/evidence/attempt scheduling, coding role lease and provider/release gates independently. Shared live flag false and approved model list empty. User previously requested autonomous work until their input is needed; a concrete visual review is now appropriate, not another abstract location question.


### 2026-11-04 - Work log revision 32 (continuing autonomously)

User approved workspace arrangement and requested file chooser alongside shared task. Implemented Add files native input (multiple), readable/removable attachment list, local UTF-8 text/code reading and context preparation. Up to5 files/64KB each; current full context max16000chars enforced before Start, no silent truncation. Unsupported/binary/invalidUTF8/empty files reject explicitly. First supported formats are text/code (not PDF/Word/images yet). Selected files do not upload or start inference. Files serialize as data with branch context into same frozen packet for both agents; typed instructions optional with file-only defaulttask. No permissions/tools derive from file contents. Updated branch-context explanation. Workspace placement approved, fine UI still may evolve.

User also requested two separate simultaneous jobs, confirmed plan for Independent jobs mode: separate task/files/conversation/session/Stop per agent, no automatic exchange; coding jobs separate project folders. Added unregistered read-only IndependentJobsSpike feasibility runner using existing SubagentRunService/trusted tool-none/single-attempt path. Two real-service/fake-provider tests prove distinct private packets/provider sessions, same-model allowed, stopping A leaves B running, independent outputs and early isolation/model rejection. This is not a UI mode/live feature yet.

Added migration9 createIndependentJobsSchema and IndependentJobsRepo for durable job identity/config/claim/binding/Stop/terminal/startup-interrupted records, indexed ownership lookups. Parent deletion blocked while active; terminal deletion purges own canonical transcript and stream ledger only. Startup reconciliation never reruns work. Production generic stream/subagent manager/legacy ledger fences now consult BOTH proposal and independent-job ownership. No independent-job service/routes/controller are registered; next step is durable execution service under false live gate, then mode UI.

Validation: renderer collaboration/toolbar53 tests11files pass (new attachment cases included). IndependentJobsSpike2 and independent repo3 tests pass; migration runner5 passes. Full build:electron passed (tsc-b/Vite7459modules48.46sec); final client tsc-b after new prototype passed before durable repo addition. Electron typecheck after migration wiring passed. Native startup now schema9/three Hadron tables, health ownPID/clean shutdown/all six existing proposal endpoints404/zero blocked fetches. Mounted UI checks chooser invocation, selecting/listing/removing real browser File, separate selectors, responsive dock, main chat interactive, focus/Close/Escape/noHTTP all pass. Reports validation/collaboration-ui-r32-2026-11-04.json, native-startup-r32-2026-11-04.json; screenshot collaboration-files-r32.png. No paid AI/login/normal installed app/installer/Graviton changes. More integrated validation follows service wiring.

Continue autonomously per user instruction; do not stop at routine checkpoint. UI base position approved. No user action needed yet. Keep livefalse and model allowlist empty; full general/coding workflows, independent-job live/durable service/UI and release tests remain unfinished.

User addition2026-11-04: Independent jobs mode for two simultaneous unrelated tasks, distinct task/files/conversation/session/cancellation per agent, no automatic peer sharing. Coding jobs use separate project folders; existing no-multiwriter-in-one-workspace rule retained. Shared-task Work together remains separate. First read-only prototype and durable job records added revision32; not live or UI-accessible yet.

## Revision 33 - 2026-11-04: document attachments and durable independent jobs

- Shared task supports file-only instructions or typed instructions plus local text/code/PDF/DOCX attachments. PDF worker is bundled locally; DOCX uses plain-text extraction. No upload, OCR, remote worker or silent truncation.
- Independent jobs now have durable migration9 records, owner-scoped status, atomic two-active-job capacity, cancellation/draining, startup interruption reconciliation, guarded cleanup, and private run/stream fencing.
- IndependentJobService and five HTTP routes are registered behind the false live gate with no approved production models. Each job owns one tool-free, single-attempt run. Stopping A leaves B running. Canonical settled output is available only through its authorized job.
- Replay transport is shared with proposal routes and checks authorization throughout viewing; disconnect does not stop inference.
- Renderer independent-job client validates scope/status/transcripts and never retries Start automatically. UI/source-conversation admission remains next.
- Validation: 165 headless + 58 renderer + 17 server = 240 tests passed; main/renderer builds and client typecheck passed. Isolated native/UI reports saved in validation with r33 names. No live AI, installed Graviton access, normal-app sign-in or installer test.
- Next: separate owned job contexts and per-job tasks/files/response/Stop UI, with unknown-admission recovery and no duplicate inference. General cross-review/synthesis and coding write leases remain future work.
## Revision 34 - 2026-11-04: Independent jobs UI and automatic Markdown continuity logs

- Workspace now offers Work together / Independent jobs. Independent A/B have separate task and PDF/DOCX/text/code file inputs, response areas, Start, Stop, status/reconnect and new-job controls. Mode switching preserves drafts. Each launch prepares its own owned local conversation and anchor without copying the selected chat.
- Context preparation is deterministic/idempotent and transactional. It checks owner/local storage/project access and rejects identity/source/slot conflicts. Independent-job admission persists identity before the only inference POST; unknown responses remain fenced across reload. Detaching never cancels inference; closing during context preparation prevents a later launch.
- User requested automatic .md job/project logs. AgentJobJournal writes one local Markdown record per independent job or collaboration participant under the database profile's hadron-job-logs directory. It records goal/context, status, visible progress, work/test/fix caveats and next actions. Writes are atomic and flushed; checkpoints occur at admission/binding, every five seconds while active, Stop and terminal state. Hidden reasoning, tool frames and credentials are excluded.
- Logs survive restart; startup appends interrupted state without repeating provider requests. They are continuity data, never tool authority or proof that a model's claimed test/fix happened. Current jobs are tool-free and logs explicitly say no project edits or tests were executed.
- Owner-authorized journal viewing and Save .md copy are wired for both modes. Independent jobs also offer Prepare follow-up from log: original goal plus a bounded, explicitly excerpted recovery packet; this prepares a NEW draft and never starts it automatically. Reattach original files if the continuity excerpt is insufficient.
- Logs are retained local artifacts in the Hadron profile. Full retention/export/deletion policy remains a release check. A filesystem failure before initial log creation prevents dispatch; later failures do not relaunch inference, and status/read errors expose unavailable logging.
- User's original logo is copied unchanged into the renderer assets and displayed in the workspace header. New independent layout remains provisional for the user's design review.
- Validation: 193 headless tests, 66 renderer tests and 17 server tests (276 total), Electron main/renderer builds and client typecheck. Native smoke now launches TWO isolated Electron processes against a temporary profile: first seeds a running fixture with notes; second confirms interruption reconciliation and preserved Markdown notes with no network. All fifteen proposal/job/context/journal/continuity endpoints remain 404 while live disabled. UI fixture verifies independent drafts/file isolation, mode preservation, bundled PDF/Word extraction, responsive dock and zero HTTP calls.
- Evidence: validation/independent-jobs-light-r34.png and independent-jobs-r34.png; collaboration-ui-r34-2026-11-04.json; native-startup-r34-2026-11-04.json; sample-agent-job-r34.md is synthetic fixture output, not a real task.
- Still pending: complete general cross-review/verification/synthesis scheduler, coding permissions/write leases, usable normal desktop sign-in/coexistence, bounded approved live provider tests and independent Windows installer/shortcut. Live flag false and all production model allowlists empty; installed Graviton untouched.
## Revision 35 - 2026-11-04: separate job trees and subscription-provider requirement

The user accepted the two-mode layout ("a little plain but good") and requested two trees for two independent jobs, then repeated the instruction to continue alone. IndependentJobTree now provides a separate expandable task/run history per job with independent selection, authenticated owner/conversation checks and no mutation of the main Chat tree. This is a read-only projection of the current job's frozen task and one owned run, not full Heimdall editing/branch navigation. Existing shared-task proposal branches remain in the shared conversation.

Tree backend/client and ownership checks pass; mounted Electron fixture proves A's selected response does not alter B's selected task. Renderer/main builds pass (renderer7469 modules). Focused renderer tests11 and service/routes9 pass after tree changes; aggregate previous193 headless + updated67 renderer +17 server =277 tests across the targeted files. New UI report: temp hadron-ui-OGedkY; native two-process report: temp hadron-startup-T3HNoX. Schema9/three Hadron tables, sixteen disabled endpoints, restart notes preserved and no HTTP/provider calls.

New confirmed requirement: OpenAI AND Anthropic/Claude accounts, BOTH via subscription sign-in, with easy Connect buttons like Graviton. Do not substitute an Anthropic API key or assume Claude is already integrated. The current base provider router has ChatGPT/OpenRouter/Bedrock/LMStudio/Zai; NO direct Claude subscription provider. Collaboration contracts/admission/UI are still ChatGPT-only. This is now the next foundation to implement before completing mixed-provider workflow scheduling.

Verified official Anthropic docs 2026-11-04:
- https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use permits end users signing into the UNMODIFIED Claude Code binary using their own subscriptions; third-party apps must not collect/intermediate Claude.ai session tokens.
- https://code.claude.com/docs/en/authentication documents separate CLAUDE_CONFIG_DIR per account, including settings/history/subscription credentials.
- https://code.claude.com/docs/en/cli-reference documents claude auth login/status, --restricted, --safe-mode, --tools "", --disallowedTools "*", --strict-mcp-config, --permission-prompts none, --max-turns1, --no-session-persistence.
- https://code.claude.com/docs/en/env-vars documents nonessential-traffic disabling and CLAUDE_CODE_MAX_RETRIES in the retry-watchdog description.
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan says signed-in SDK/claude -p usage still draws from subscription limits (updated October7).
- npm registry read-only query found official @anthropic-ai/claude-code version2.1.318 with win32-x64/arm64 optional binary packages. Get-Command claude returned no executable. No Claude installed, launched, signed in or paid request yet.

Next: vendor an unmodified pinned official Claude engine locally in Hadron, isolated process/config/runtime and official auth flow, adapt provider contracts/allowlists/grant invalidation for mixed providers, then general cross-review/synthesis and coding controls. Never copy tokens from installed Graviton or other Claude profiles. All model allowlists remain empty/liveflagfalse. General-workflow schema/service work has NOT started; only design discussion, no migration10.
## Release platform requirement - 2026-11-04

The user explicitly requires Windows AND macOS for later sharing. Windows gets an .exe installer; macOS gets separate .dmg/.app (optionally zip) artifacts. Plan/test both Apple Silicon arm64 and Intel x64. Do not claim Mac readiness based on Windows tests. Keep runtime paths, keychain/config isolation, process launch/cancel, bundled Claude engine and native SQLite/keytar/node-pty portable. macOS signing/notarization, real Mac validation and distribution notices are release gates; no installer is created yet.

Claude connection choice is confirmed twice: subscription / official Claude Code sign-in, not an API key. OpenAI continues the existing ChatGPT subscription path. Use easy separate Connect buttons. Official pinned Claude runtime installation has started ONLY inside source/ygg-chat/client/ygg-chat-r/vendor/claude-code, with install scripts disabled; no system-wide install, credentials migration or sign-in.

Revision72 user order: finish and accept the Windows two-agent MVP first, then proceed through the wider project-building TODO. Current sandboxed tools do not imply project-file/shell/build capabilities.
