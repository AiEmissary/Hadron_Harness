# Editing backend integration contract - revision80

ProjectWriteStore is a tested coordinator-only foundation, not a production capability. Nothing currently imports it into Hadron startup or exposes its methods over IPC/HTTP/model tools.

## Trust boundary

Use a dedicated project-editing database with SQLite synchronous FULL (or EXTRA), in Hadron private storage. Select the canonical root through trusted native UI and supply protected roots. Obtain consent for file changes separately from a read-only project grant. Authentication and authorization stay in the host. Never accept an implementer/reviewer identity, root, lease handle, approval or apply command from model-supplied JSON as authority.

Only the coordinator holds ProjectWriteLease objects. WeakMap identity makes serialized IDs insufficient. Agent A supplies bounded candidate text and expected hashes. The coordinator persists it with propose. Agent B receives the exact snapshot as untrusted review data and cannot call a write/approval method. The coordinator validates B's stage/provider/run identity before recording its review. Proposal changes invalidate review; beginCorrection allows one staged correction and retains old proposals/reviews.

## Activation prerequisites

The model may not enable canonical writes yet. Cover all enabled competing execution paths and already-running legacy work before granting a writer lease. Actual existing entry points include ToolOrchestrator.executeJob, customToolLoader's dynamic implementation import, Electron fs:writeFile, shell:exec, terminal/PTY and customTool:execute, plus MCP/hooks/skills/REPL/delegation and any background work they can start. A lease respected only by the new editor is insufficient. Keep native A/B tools disabled and preserve controlled host-tool admission.

Do not wire apply into production until this exclusion and authenticated role admission are implemented. It must be an explicit trusted coordinator/user action against a matching B review. Shell/package execution is a separate unimplemented capability. No file read, peer agreement or successful edit is a project test result.

## Persistence and failure semantics

acquire uses BEGIN IMMEDIATE and rejects overlapping canonical folder roots across SQLite connections and owners. propose persists original/replacement text without mutating the project. snapshot hashes the immutable file identities, batch and revision. recordReview retains history and accepts only the exact current snapshot. beginCorrection starts a single new batch; old operations are preserved and cannot apply.

apply records started before any mutation, rechecks the original hash, writes/fsyncs a same-directory temporary file, creates a new file exclusively or uses the fixed Windows metadata-preserving replacement helper, checks the resulting hash/metadata and records applied. A conflict or uncertain outcome blocks the lease. Applied operations never replay; a partial multi-file batch remains explicitly partial. Temporary cleanup targets only the operation's own generated temporary name.

inspect compares current hashes without writing, retrying or releasing leases. A new process has no old in-memory capabilities. Stale/blocked leases must remain held until an explicit authenticated intervention flow verifies process/run termination and reconciles every receipt. That intervention flow is not implemented yet. Never clear a stale lock merely because of its age or a reused PID.

Current limits: existing parent directories only; up to 20 text files per batch, 128 KiB per file, one staged correction. No delete/move/mkdir or shell. File mode/ACL preservation still needs a policy before production integration. Existing metadata and full OS power-loss durability are not certified; current tests cover the stated process/storage failure cases. Non-cooperating external processes can still race filesystem checks; an OS boundary is required for stronger containment claims.

## Design choice

The user chose Build a project beside Work together and Independent jobs. Preserve the existing three-pane workspace. See design/project-building.html for the simulated UI, and PROJECT_BUILD_PLAN.md for the remaining coordinator and acceptance stages.


## Project coordinator contract (revision77)

ProjectBuildCoordinator now imports the writer in a host-only service; neither is connected to production startup, HTTP, IPC or live UI. Its constructor requires the dedicated SQLite database, writer, actual worker service/run repository, explicit allowed models, current owner/workspace authorizer and Markdown journal. Do not construct it using the application chat database. The build/attempt tables are dedicated private-store schema, not a production chat schema migration.

prepare is for trusted native admission only. It freezes task/plan/deliverables/models/anchor and reads only the selected sourcePaths (up to 20 and 128 KiB total) through the writer's bounded read boundary. Both stages receive the same saved source packet. Agent A returns strict JSON summary/changes; Agent B returns strict JSON snapshotHash/verdict/text. Native worker tools remain disabled. The coordinator checks the actual persisted provider identity before accepting output, rather than treating model JSON as author/approval authority. Missing context, invalid hashes, stale reviews and invalid responses fail without a retry. One correction permits at most four total attempts.

The service checkpoints prepared/reserved/bound/completed stages to each agent's Markdown log. A failed checkpoint before dispatch blocks the request. Database state remains authoritative if a later log write fails. status/journal/markdown and savedProposals are read-only; none reacquires a capability or calls a provider. Reopened unfinished tasks show interrupted. Previously reviewed drafts remain readable but require intervention; canApply is always false. Proposal/approval states never imply that tests ran or that a project is complete.

Cancellation and deadlines abort actual children, and termination is awaited before a draft can be discarded. The real engine uses completed/error/aborted terminal statuses. Missing/unknown/unterminated children retain the lease. There is deliberately no apply operation on this coordinator, no automatic release on restart, no force-unlock based on age/PID and no shell/build/test capability. Before production activation, finish the inherited execution fence, explicit recovery intervention, metadata policy, native grants/owner route integration and visible review/apply controls. The existing three-pane UI choice is unchanged.


## Execution gate integration (revision78)

ProjectBuildCoordinator now requires a ProjectExecutionGate. It reserves an opaque scope before the folder lease, checks it with stage ownership before provider dispatch/results and releases only on settled discard. Existing legacy entry points are guarded as catalogued in PROJECT_EXECUTION_BOUNDARIES.md. The production singleton is intentionally unconfigured and cannot enter project mode. This does not yet activate startup/HTTP/native UI grants or lower-level file apply. Finish the explicit activation conditions in that audit before turning writes on.

The dedicated pre-activation build schema now journals scope_id before the folder lease. This links a stale marker to its frozen task for future intervention without recreating an execution capability. Both actual provider admission and owner/workspace checks reject a mismatched scope link. There is no production chat-schema migration or existing-user database change.


## Windows metadata and recovery (revision79)

See PROJECT_RECOVERY.md. Windows replacement now uses a fixed platform helper, verifies tested access-control metadata and retains an original backup; read-only/special cases fail rather than falling back to rename. apply defaults to denied unless the trusted host supplies a synchronous execution assertion. Recovery plans and explicit current-host reconciliation preserve current files, verify actual worker shutdown and cannot reconstruct a capability after restart. The dedicated pre-activation schema adds operation artifact/metadata columns and a reconciliation-events table; the production chat schema/database is unchanged. These features are not live UI/routes yet. Previous-process recovery proof and advanced security/OS containment remain activation requirements.


## Reviewed application coordinator (revision80)

ProjectBuildCoordinator.apply is host-only and unavailable by default. Trusted composition must bind ProjectWriteStore.assertExecution to coordinator.assertCanonicalWrite and supply a synchronous assertApplyConsent for the exact snapshot shown to the local owner. Neither peer approval, a UI Boolean, canApply status nor a model response supplies this consent. Before dispatching files, actual workers must be ended, the original scope/lease live and B's exact current snapshot approved. A dedicated hadron_project_applications table reserves each batch once. It is part of the pre-activation dedicated project database, not a change to the user's main chat schema/database.

Admission checks authenticate the frozen owner/workspace/models, actual execution record, current review and application state at file boundaries. ProjectWriteStore.assertReviewedSnapshot is read-only and can inspect the synchronous started/commit interval with the original handle; it never restores a write capability or permits operation replay. The coordinator yields before each file for Stop. The fixed Windows helper is still a bounded synchronous operation; a Stop click cannot interrupt its current ten-second maximum commit. Per-file applied/failed/uncertain receipts and both protected Markdown logs remain available; applied is not tested or complete. No command/build/test capability is added.

Production startup now configures canonical exclusion, but no native build grant/route/UI or trusted consent composition is installed. Remaining activation audits and restart/child termination proof are still required. No personal project writes are enabled by this backend change.

Current revision81: native Build a project proposal preview is now available; A/B role admission and selected-file grants are wired. Applying edits and executing project commands remain disabled. Real subscription preview acceptance is pending. See PROJECT_DRAFTS.md. Earlier revision descriptions below remain historical.


## Revision81 - native project proposal preview (2026-11-07)

The approved separate Build a project mode is now wired into the real desktop app. It uses the same three panes: reviewed responses/diffs on the left, plan/stage/file cards in the middle, and separate A/B models plus native folder/source pickers on the right. Agent A proposes text changes; Agent B receives the exact frozen before/after snapshot. Existing files must match explicitly selected source paths and SHA-256 hashes. At most one correction/re-review is allowed. This release prepares proposals only: no application API, file changes, project commands, tests or automatic project completion are enabled.

Native grants bind the local owner/workspace and exact root identity, expire on restart/logout, and refuse protected application/account folders including junction aliases. The private hadron-project-builds.db is separate from chat schema. A damaged optional project database disables project proposals while leaving core chats available; it is not repaired or deleted. Saved chooser reads metadata only. Read-only admission checks recover a lost response without retrying inference. Real worker shutdown is awaited before private storage closes, including Quit with an idle upgraded socket. A crash/unknown previous process still holds execution; no marker deletion or PID/age unlock is offered.

Validation: full server444 passed/5 skipped; renderer1177 passed/1 skipped; no failed tests. Server/Electron/mobile typechecks and built renderer/main/mobile passed. Four built startup cases passed (project, standard utility, corrupt execution record, corrupt optional project database). Final built native preview passed real protected-worker admission, frozen source capture, exact B review, diffs, three panes, keep/clear selected files, Stop and saved proposal selection. Cold reopen restored the proposal/mode with zero inference and expired native grants. Both clean Quits joined workers, closed an unregistered idle socket and released execution. Picker/provider replies were synthetic; no real subscription or personal project edits. One preceding desktop attempt found the Agents pane collapsed during placement measurement; a fresh full run and cold reopen passed. Preserve that diagnostic rather than claiming the earlier attempt passed. Existing native-reader regression is recorded separately. Evidence: validation/revision81.

NEXT USER CHECK: fully quit Hadron normally and reopen the shortcut; keep the existing ChatGPT account. In Build a project, select the sibling demo-project folder and README.md plus src/calculator.js. Choose both ChatGPT models, request a proposed README-only improvement explaining the calculator, and provide a deliverable. Prepare proposal should show A's suggested changes and B's exact review, with unchanged source files and no test claims. This real subscription preview acceptance is pending. Canonical edits still require remaining execution audits, prior-process/child termination proof, advanced metadata policy and explicit native consent; command containment and milestone completion follow separately.

USER REQUEST ADDED: continuous automatic A/B conversation (ping-pong turns), with chess only an example. Preserve ordinary independent chat and bounded review modes; implement an opt-in continuous session after the current project-building milestones. See CONTINUOUS_CHAT_PLAN.md. This is planned, not yet available.
