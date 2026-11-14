# Project execution boundaries - revision80

Project editing is not enabled. This audit names the implemented controls and remaining activation conditions. The gate is cooperative application exclusion, not an OS sandbox. A working directory does not contain arbitrary programs.

## Implemented

`server/hadronTools/executionGate.ts` provides an opaque owner/workspace-bound scope, exclusive-create private execution marker, bounded/identity-checked reads and explicit release. It never automatically clears legacy activity or interrupted project records. Failed/corrupt storage prevents admission. ProjectBuildCoordinator reserves before acquiring its folder lease, rechecks at stage/result boundaries and holds exclusion until workers ended and a draft was explicitly discarded. Native A/B worker tools remain disabled.

| Entry point | Guard location |
| --- | --- |
| Tool submission, restored queue, actual handler dispatch | tools/orchestrator/ToolOrchestrator.ts |
| Dynamic/cached custom JavaScript and custom management writes | tools/customToolLoader.ts |
| Widget writes/mkdir/shell, PTY creation/input, custom Node modules | electron/main.ts |
| Utility child and per-tool dispatch | tools/runtime/toolRuntimeSandbox.ts |
| Shell preparation/launch, login-shell PATH, WSL discovery | tools/shellRunner.ts, tools/nativeShell.ts, utils/wslBridge.ts |
| Local editor writes and Git commands | localOperations.ts |
| MCP tools/resources/prompts, pre-connection admission and stdio | mcp/mcpManager.ts |
| LSP binary lookup and both launch paths | lsp/LspServerRegistry.ts, lsp/LspSession.ts, lsp/LspToolContext.ts |
| Skill clone/install/copy admission | skills/skillInstaller.ts |
| Main chat and unadmitted child/resume/Claude bridge | headlessServer/services/chatOrchestrator.ts, subagentRunService.ts, tools/claudeBridge.ts |
| Direct/nested REPL and undo restoration | headlessServer/services/replExecutor.ts, tools/streamUndoManager.ts |

Paths in this table are relative to the app's server folder except electron/main.ts. Hooks use the guarded bounded-shell path. Batches and delegated tools return through guarded dispatch. Trusted cleanup/kill paths remain available to stop work; they are not a general execution grant. Reader grants and already protected tool-free native workers remain separate.

An older queue bug reset stored running jobs to pending. Lost running handlers are now failed with an explicit not-replayed message. Merely pending jobs retain their queue behavior. Both pending admission and actual dispatch are observed, so a deferred job cannot evade the gate by starting later.

## Startup and apply update (revision80)

Canonical ledger configuration now runs in Electron bootstrap, standalone entry and utility bootstrap. A frozen launch-only project session skips inherited startup work, holds persisted pending jobs and refuses legacy execution even between scopes. Standard hosts and utility children use the same profile ledger; none can clear a persisted marker. See PROJECT_EXECUTION_STARTUP.md. The coordinator's host-only apply action defaults to denied and additionally requires authenticated exact-snapshot consent, live execution admission and actual worker termination. It has no live native/UI endpoint.

## Remaining activation audit

1. Audit remaining root selection/settings/installation/export/IPC and any new execution entry points; actual protected roots must include Hadron storage/code/runtime/libraries, account directories and installed Graviton. Do not assume all writes to user-configurable directories are internal profile writes.
2. Canonical startup is implemented for the shipped desktop/standalone/utility entry points. Audit any future host entry point before admitting writes. Independently constructed or unconfigured library hosts cannot gain project authority.
3. Project-only startup is implemented and built-desktop tested. It holds and reports pending legacy jobs without replay. Standard utility/legacy work still taints a writer-capable process; neither a completed promise nor a new process proves old descendants ended. Finish authenticated stale-scope recovery before live activation.
4. Implement authenticated intervention for stale scope/folder leases and started/uncertain write receipts. Require actual worker termination and receipt reconciliation. No timeout/PID-only force-unlock. Distinguish draft-only checkpoints from canonical writes; saved proposals/logs are context, not resumed authority.
5. Make canonical apply itself assert the live execution scope and exact approved snapshot. The host-only coordinator now has an exact-review/consent-bound apply method with a separate live write assertion; default composition denies it. Do not activate the lower-level writer independently or treat canApply diagnostics as authority.
6. Preserve file mode/ACL/security metadata for replacement, especially Windows. Existing-parent text create/replace remains the bounded target; no commands, installation, delete/move/mkdir or native model tools are implied.
7. Connect trusted native selection/owner admission and the approved third Build a project UI entry. Show actual drafts, fresh B review, operation receipts, stop/recovery and explicit review/apply controls. Tests/builds remain not run until separately contained command execution exists.
8. Complete disposable-project and live subscription acceptance before personal project changes or packaging.

The ledger intentionally has no legacy-reset UI/API yet. Do not ask the user to delete execution.json to bypass a held or uncertain scope. Non-cooperating external writers and OS power-loss behavior require separate containment/durability evaluation.


## Revision79 update

The writer now refuses default apply without an actual host execution assertion. A fixed Windows metadata helper is an explicitly bounded trusted filesystem operation and must not be exposed as arbitrary shell/IPC command execution. It receives only host-validated paths/hashes and uses no user profiles or module autoload. Current-host reconciliation needs fresh observed hashes/native metadata and confirmed actual worker termination; it can close an uncertain scope without file edits or retry. Restart remains read-only. The new method does not clear legacy markers or allow age/PID-only overrides. Build-safe startup, complete native route/UI admission, previous-process proof, advanced metadata policy and live acceptance are still outstanding.


Revision80 storage-failure handling: a corrupt/unconstructable execution ledger now produces a frozen restricted inspection boot. Existing saved work can be viewed without starting inherited runtimes. Both legacy and project execution remain denied even if the ledger failed before configuration; no record is cleared or replaced. This is not stale-scope recovery or write permission.

Current revision81: native Build a project proposal preview is now available; A/B role admission and selected-file grants are wired. Applying edits and executing project commands remain disabled. Real subscription preview acceptance is pending. See PROJECT_DRAFTS.md. Earlier revision descriptions below remain historical.


## Revision81 - native project proposal preview (2026-11-07)

The approved separate Build a project mode is now wired into the real desktop app. It uses the same three panes: reviewed responses/diffs on the left, plan/stage/file cards in the middle, and separate A/B models plus native folder/source pickers on the right. Agent A proposes text changes; Agent B receives the exact frozen before/after snapshot. Existing files must match explicitly selected source paths and SHA-256 hashes. At most one correction/re-review is allowed. This release prepares proposals only: no application API, file changes, project commands, tests or automatic project completion are enabled.

Native grants bind the local owner/workspace and exact root identity, expire on restart/logout, and refuse protected application/account folders including junction aliases. The private hadron-project-builds.db is separate from chat schema. A damaged optional project database disables project proposals while leaving core chats available; it is not repaired or deleted. Saved chooser reads metadata only. Read-only admission checks recover a lost response without retrying inference. Real worker shutdown is awaited before private storage closes, including Quit with an idle upgraded socket. A crash/unknown previous process still holds execution; no marker deletion or PID/age unlock is offered.

Validation: full server444 passed/5 skipped; renderer1177 passed/1 skipped; no failed tests. Server/Electron/mobile typechecks and built renderer/main/mobile passed. Four built startup cases passed (project, standard utility, corrupt execution record, corrupt optional project database). Final built native preview passed real protected-worker admission, frozen source capture, exact B review, diffs, three panes, keep/clear selected files, Stop and saved proposal selection. Cold reopen restored the proposal/mode with zero inference and expired native grants. Both clean Quits joined workers, closed an unregistered idle socket and released execution. Picker/provider replies were synthetic; no real subscription or personal project edits. One preceding desktop attempt found the Agents pane collapsed during placement measurement; a fresh full run and cold reopen passed. Preserve that diagnostic rather than claiming the earlier attempt passed. Existing native-reader regression is recorded separately. Evidence: validation/revision81.

NEXT USER CHECK: fully quit Hadron normally and reopen the shortcut; keep the existing ChatGPT account. In Build a project, select the sibling demo-project folder and README.md plus src/calculator.js. Choose both ChatGPT models, request a proposed README-only improvement explaining the calculator, and provide a deliverable. Prepare proposal should show A's suggested changes and B's exact review, with unchanged source files and no test claims. This real subscription preview acceptance is pending. Canonical edits still require remaining execution audits, prior-process/child termination proof, advanced metadata policy and explicit native consent; command containment and milestone completion follow separately.

USER REQUEST ADDED: continuous automatic A/B conversation (ping-pong turns), with chess only an example. Preserve ordinary independent chat and bounded review modes; implement an opt-in continuous session after the current project-building milestones. See CONTINUOUS_CHAT_PLAN.md. This is planned, not yet available.


## Revision84 - longer opening screen, accepted preview and next-stage plans (2026-11-07)

The user's screenshot confirms the native two-model preview: both selected files are listed, A prepared a README replacement, B completed its independent review and status is Proposal reviewed. Read-only inspection of Hadron's own saved record confirms two completed actual stages, B approve and both demo source hashes unchanged. The session is saved/closed after ordinary Quit, not deleted. Initial real subscription preview acceptance is complete; inspecting the saved exact diff and personal cold reopen remains a separate check. Canonical edits, project commands and completion remain unavailable.

The existing Hadron logo entry now stays visible for at least4000ms after the image loads while local initialization proceeds in parallel. Slow initialization does not add a second four-second delay; startup failures retain the retry screen, and leaving the entry cancels its delayed navigation. The main Hadron window now maximizes before first show, fulfilling the earlier full-page startup request while retaining normal window controls. This does not change provider credentials or the installed Graviton app. The larger centred project title and a fuller introductory design remain later UI work.

CONTINUOUS_CHAT_PLAN.md now specifies ordered backend/worker/API/UI/acceptance phases, durable turn/session states, one admitted turn, real run binding, crash ambiguity, idempotent completion, Pause/Stop/injection/branch behavior, explicit budgets, context compaction, twenty-turn acceptance and a later real-account test. It remains planned rather than silently enabled. The approved Windows project-building priority is retained. PROJECT_ACTIVATION_AUDIT.md records the next editing gates and confirmed external-launch/theme initialization gaps. Broadly tainting every normal browser click was rejected as an unsuitable fix; no such behavior is shipped. Full canonical execution containment is not claimed.

Next user check can use saved work: normal Quit/reopen should show the longer logo and a maximized workspace, restore the saved proposal without inference, and show Before/Proposed after when the README card is selected. No fresh paid proposal or sign-out is needed to inspect this. Continue project editing only after the activation gates in PROJECT_ACTIVATION_AUDIT.md.

Revision84 validation:28 focused server/bridge/execution/startup tests passed; renderer/server/Electron/mobile typechecks and renderer/main/mobile builds passed. Actual built desktop and cold reopen passed; loaded logo visible at2500ms and transitioned at4051ms/4025ms, both windows maximized. Existing proposal/diff/two-source/Stop/file retention and saved reopen passed with zero real requests; no personal project edits or installed Graviton changes. Evidence:validation/revision84.


## Revision86 - confine theme maintenance to pinned profile storage (2026-11-07)

ExecutionStartup now pins a PrivateProfilePaths policy to the actual profile's BigInt device/inode. Internal consumers can recheck existing ancestors and leaves; linked/junction paths, hard-linked files, invalid ancestors, alternate streams, escapes and replaced profile roots are refused. Reinitializing the same string path cannot adopt a replacement root. This is a host storage check, not a model/project permission or an OS sandbox.

Theme initialization and CRUD in configured desktop/standalone/utility hosts now use the fixed profile/.ygg/custom-themes directory. A late external directory override is rejected before mutation. Target checks run on initialization, copying, listing, reading, saving and deletion. Template links/hard links are refused; copy uses exclusive-create semantics and rechecks a raced target. Saves open without truncation, validate the actual file handle/name/links first, and then write. Normal private theme operations do not taint a held project session. Unconfigured legacy test hosts retain their existing root resolution, but cannot obtain project execution authority.

Focused validation:10 new actual-filesystem tests plus8 startup regressions and5 inherited theme tests pass. The full server suite run before the final two additional race/concurrency tests passed456 with5 skipped; the final focused run independently passed all18 policy/startup tests, including those two additions. Server/Electron/mobile typechecks and main/mobile builds passed. Actual built startup and desktop fixtures are recorded in validation/revision86. Application consent and project editing remain unavailable; this closes the theme-target gap, not the whole activation audit. External launcher policy, other private stores, previous-process termination, advanced metadata, native exact consent and contained commands remain.


## Revision88 - protected and durable automatic job logs (2026-11-07)

Extended pinned private storage checks to AgentJobJournal locations, checkpoints and reads. Linked log directories, hard-linked leaves and external configured destinations are refused. Reads now use a bounded file descriptor with actual identity/link/size/time checks and fatal UTF-8 decoding. Checkpoint temporaries are created exclusively, synced and renamed only after checks; cleanup deletes only the identified temporary owned by that attempt.

Fixed a continuity bug: an unchanged in-memory snapshot previously returned before verifying its Markdown record still existed. A removed/changed durable log is no longer silently accepted as a valid checkpoint. Missing logs are recreated with full current notes, and oversized/invalid/changed-during-read records fail closed. This improves continuity records without treating logs as execution authority or inventing prior worker termination.

Validation: full server466 passed/5 skipped; focused journal/coordinator57 and headless individual/collaboration/log44 passed. Server/Electron/mobile typechecks and main/mobile builds passed. The built proposal/inspection/Stop/two-file/retention/clean-Quit fixture passed. Cold reopen additionally reads the saved Agent A Markdown through the actual native bridge and verifies no inference replay; results are in validation/revision88. Tests use disposable files and synthetic provider/picker replies; no personal files or account data were changed. See PRIVATE_STORAGE_POLICY.md for the exact coverage and remaining stores. Actual project application, commands and cross-process unlocking remain disabled.

NEXT USER INPUT: review the new Inspect saved state screen beside an existing saved proposal and its View Agent A job log. Both should remain readable after normal Quit/reopen, with original file states and historical worker status described truthfully. No new proposal or sign-in is needed. User feedback on this recovery view precedes the next recovery/apply UI controls, consistent with the user's request to participate in design. Remaining engineering gates continue in PROJECT_ACTIVATION_AUDIT.md; this does not mark application ready.
