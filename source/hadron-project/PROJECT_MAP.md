# Hadron — component map and export contract

Revision66 current map: collaborationReview.ts is the bounded cross-review/synthesis executor, proposalSessionService.ts owns full admission/projection/Stop/journals, CollaborationRepo and migration10 own stage bindings/fences. Shared DTO adds explicit review_and_synthesis input and optional collaboration status; legacy omitted-workflow sessions retain proposal-only behavior. Renderer setup opts into the full workflow and CollaborationSessionView displays/exports the combined result.

Accepted requirements, 2026-11-02. This is a navigation/design map; proposed modules are not implemented yet.

Current revision29: the desktop provisional collaboration workspace is mounted; renderer admission/saved sessions/replay recovery and gated backend routes exist. User will review UI design before finalization. Live gate false, model allowlist empty, full workflows/releases pending. Older proposed/unmounted descriptions below are historical.

## Product and UI

Detailed accepted interaction specification: [UI_DESIGN.md](UI_DESIGN.md). Agent A and Agent B each have their own provider/model entry point and connection status, a shared task composer, dual live response panes and one session Stop control. This is a specification; renderer implementation remains pending.

Revision 16 implements the first **unmounted** `src/components/CollaborationPanel/CollaborationPanel.tsx` setup component and `src/features/collaboration/{setup,client}.ts`, with tests. It has separate A/B selectors and shared task/start/Stop controls; dual live panes and chat mounting are still pending. `services/collaboration/desktopAccess.ts` provides a tested capability validator; trusted IPC issuance and production route registration are still pending. These modules do not enable live inference.

- Clean chat-first desktop interface, like Graviton/ChatGPT: uncluttered composer and result area, familiar navigation, restrained controls.
- Retain Graviton's colourful Heimdall branch system, including its existing interactions. Do not replace it with a monochrome tree or a separate graph.
- Collaboration controls live in one compact panel. Advanced budgets, diagnostics and execution traces expand on demand; two streams can be inspected without making every screen a dashboard.
- Colour is supplementary: participant names/status labels and accessible contrast distinguish agents without relying only on colour.

## Component ownership — future modules

Keep related files together within Graviton's existing runtime boundaries. Prefer one responsibility per module; avoid both giant coordinator files and needless one-function files. Each feature folder gets a short README with purpose, entry point, inputs/outputs, dependencies and tests. Update this map when actual names change.

| Responsibility | Proposed home (relative to source/ygg-chat) |
| --- | --- |
| Shared requests, status, artifacts and events | `shared/collaboration.ts` |
| Workflow transitions and scheduling | `client/ygg-chat-r/server/headlessServer/services/collaborationService.ts` |
| Role/capability enforcement | adjacent `collaborationPolicy.ts` |
| Owned streams, cancellation and recovery | adjacent `collaborationRuns.ts` |
| Budgets and usage | adjacent `collaborationBudget.ts` |
| Checkpoint exchanges and context bounds | adjacent `collaborationExchange.ts` |
| SQLite persistence | `client/ygg-chat-r/server/headlessServer/persistence/collaborationRepo.ts` |
| Authenticated local HTTP/SSE entry points | `client/ygg-chat-r/server/headlessServer/routes/collaborationRoutes.ts` |
| Renderer state and event client | `client/ygg-chat-r/src/features/collaboration/` |
| Setup, streams, timeline and result presentation | `client/ygg-chat-r/src/components/CollaborationPanel/` |
| Existing colourful tree | `client/ygg-chat-r/src/components/Heimdall/` — reuse, do not rebuild |
| Built-in tool implementations | Existing `server/tools/` registration/build boundary; ship with the app |
| Tests | Matching upstream `__tests__` locations; feature-specific fixtures together |
| Build/package integration | Existing Electron esbuild and electron-builder configuration/scripts |

P0 currently adds two branch cases in existing `chatOrchestrator.phase2.test.ts` (real SQLite fixture) and four detached subagent cases in existing `subagentRunService.test.ts` (fake repos/provider/session registry). The latter fixture now allocates unique fake stream IDs like the production repo. Preferred integration is hybrid: subagent-backed read-only phases with branch checkpoint references; normal chat for permission-gated implementation. Revision 4 adds unregistered internal `services/collaboration/proposalSpike.ts` (proposal barrier/Stop), `proposalCheckpoints.ts` (atomic branch publication), and their README. New `services/__tests__/proposalSpike.test.ts` plus `fixtures/proposalSqlite.ts` prove the connection using real repositories/Node SQLite. No API/UI wiring yet. No production collaboration code exists. When tests grow, extract a shared fixture into a named test-support module rather than duplicating it.

## Exportable Windows delivery

Target: a transferable release folder containing a Windows installer `.exe`, release notes, a quick-start guide, checksums, applicable license/notices, and the exact corresponding source/build instructions. A loose Electron `.exe` without its resources is NOT a complete application.

- Default delivery is an NSIS installer `.exe`, matching the inspected upstream Windows target. A portable build can be added later if required; portability does not mean writing into a protected installation directory.
- Hadron-created tools must be built into or shipped as audited app resources in the same product. No dependence on this chat's custom-tool store, Desktop paths, development checkout, globally installed Node/npm or the developer's personal scripts.
- Bundle required runtime assets, helpers and native binaries through build inputs/`extraResources`/unpack rules as appropriate. Keep their source and build scripts in the project. Audit redistributability for each dependency.
- Resolve shipped read-only resources via Electron's packaged resource/app paths. Store mutable user state, optional user tools and logs in the recipient's own writable Hadron data directory, with explicit backup/export support. Never rely on a developer absolute path or modify an ASAR archive at runtime.
- Audit external tools that require Python, git, browser downloads or other installations. Either redistribute an allowed runtime and test it, or clearly mark those optional features unavailable with setup guidance. Do not claim all inherited Graviton tools are self-contained without the audit.
- Recipients authenticate their own AI providers. The release excludes tokens, `.env` secrets, personal conversations, databases, caches and development settings. Network/model services remain external dependencies and may require subscriptions/API charges.
- Use a separate Hadron app ID, data/config/credential namespaces and update channel. Disable upstream auto-updating until a Hadron-controlled channel is configured. Never publish to Graviton's release endpoints.
- Audit upstream packaged `.ygg` settings/hooks/themes before inclusion; ship curated defaults, not user-specific hooks or credentials.
- Validate the installer on a clean Windows VM/account with no source checkout, Node/npm, developer tool folders or existing Graviton profile. Test install, first start, bundled tools, colourful tree, two streams, Stop, restart, uninstall and data retention. Test a path containing spaces and moving the release folder.
- Review AGPL and third-party notices; provide exact corresponding source and build/install materials as required. Code signing needs a later certificate/approval; unsigned builds may trigger SmartScreen. Do not label an unsigned development installer production-trusted.

Current package configuration is still upstream `Graviton` with upstream app ID/update URL. It has NOT been changed or built. No `.exe` exists for Hadron yet.

Revision 5 adds internal proposalSessionService.ts, shared/collaboration.ts and persistence/collaborationRepo.ts/collaborationSchema.ts with matching repository/service tests; localServer.ts references shared DDL for fresh setup/migration 7. Trusted tool-free admission lives in existing subagentRunService.ts. No collaboration route/renderer registration exists; production readiness is not established.


Revision30 actual modules: src/features/collaboration/{admission,context,sessions,supervisor,client,stream,setup}.ts; components/CollaborationPanel/{CollaborationWorkspace,CollaborationPanel,CollaborationSessionView,SavedCollaborationSessions,CollaborationStreams}.tsx. Server services/collaboration/{proposalSessionService,proposalSpike,proposalCheckpoints,reviewPacket,generalWorkflowPolicy,desktopHost,desktopAccess}.ts. reviewPacket/generalWorkflowPolicy are internal data/policy, not live multi-phase scheduling. UI remains provisional pending user layout preference.

Revision31: ChatCollaborationLayout.tsx owns separate chat/tree and collaboration dock regions; CollaborationWorkspace is a nonmodal aside. User chose side workspace on2026-11-04; widths/appearance remain provisional for review. Narrow screens stack workspace below chat/tree.

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
Revision66 project reopening: IndependentJobContexts.openWorkspace and the authenticated /jobs/open route resolve saved project-list entries. ChatCollaborationLayout restores the returned workspace and JobTreeWorkspaceProvider selects the corresponding saved agent response. The URL/Main chat keeps its existing conversation; agent controllers use the resolved source. Older nested source scopes remain intact.

## Revision70 tooling modules

- server/hadronTools/publicWeb.ts: bounded public-only DNS-pinned HTTP reader, HTML text/links.
- server/hadronTools/toolLibrary.ts: owner/hash versioned generator source, atomic state, bounded schema cache and QuickJS sandbox.
- server/hadronTools/toolSession.ts and types.ts: admitted capabilities, per-job operations/history/activity and8-request coordinator.
- server/headlessServer/routes/hadronToolRoutes.ts: authenticated user library/source/add/test/enable controls.
- src/components/CollaborationPanel/HadronToolLibrary.tsx and IndependentJobs.tsx: developer UI/modes.
- hadron-tools/TOOL_DEVELOPMENT.md: bundled guide; development copy in root custom-tools.
- electron/hadronToolDesktopAudit.ts and --tools/--reopen-tools smoke modes: synthetic model, real library/VM/UI persistence proof.


Revision71: VERIFICATION_PLAN.md describes the optional shared verifier; collaborationReview and ProposalSessionService admit it. Additive v11 hadron_verification_runs records owned binding and bounded host evidence; old workflow tables are unchanged. CollaborationSessionView exposes report/receipts/activity; desktopVerificationAudit exercises real UI, engine and restore with synthetic model text.


Revision72 modules: sharedContinuation.ts, SharedConversationTree.tsx, shared-tree/preflight routes and Continue with both controls. Authoritative native final-message extraction fixes duplicate JSON. MVP_AUDIT.md and MVP_ACCEPTANCE.md define scope and gate.
