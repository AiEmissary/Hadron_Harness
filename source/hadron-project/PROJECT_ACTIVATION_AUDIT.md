## Current state - revision93 (2026-11-07)

The user explicitly prioritised reviewed file application, builds/tests with a repair loop, and automatic back-and-forth conversation, with Mac deferred and testing performed autonomously. These features now have native desktop implementations for the supported Windows/Node scope. This section supersedes earlier statements that all canonical application or all automatic conversation is disabled; the older entries below are historical records.

Build a project: exact native-approved current-session file application; actual contained Node tests and JavaScript build scripts; separate test/build output and exit codes; stale pre-application results; a manual repair action; and an opt-in bounded build/test/fix run. One native scope approval covers the initial reviewed change plus at most two freshly reviewed repairs within the original editable paths, fixed test/build scripts, at most eight additional model calls and three applications/checks per kind. Stop, changed scripts, rejected reviews, conflicts and exhausted budgets stop progression. No token is serialized or granted to models. See BUILD_TEST_FIX.md.

Automatic conversation: an additional three-pane mode with shared goal, independent A/B ChatGPT model choices, automatic alternating turns, ordered turn cards, transcript, budget extension, boundary user messages, Pause and Stop. Durable request/run binding prevents duplicate dispatch; per-agent Markdown logs checkpoint preparation, binding and completion. Cold reopen sends no requests and historical sessions cannot adopt old workers. Text only; no project/tool capabilities. See AUTOMATIC_CONVERSATION.md.

Validation uses synthetic model replies and approvals in disposable profiles, but actual Windows replacements/backups, native process jobs, Node test/build execution, SQLite persistence and built main/preload/UI. The full server suite passes533 tests with5 skipped; renderer/main/mobile builds and checks pass. A manual calculator fixture failed, was actually corrected, passed its retest and produced a build output file. The automatic fixture deliberately starts with a faulty implementation and independently reviews a fresh repair. A separate conversation fixture exchanged40 turns, injected a user message, exercised Pause/Stop and reopened with zero inference replay. Final results are under validation/revision93. No real credentials or provider inference requests are used by these fixtures.

Remaining: end-user native UI acceptance and real-account multi-repair/continuous sessions, Claude integration/acceptance, arbitrary package/native/Python commands, directory creation/deletes/moves, general project milestone completion, safe historical conversation branching/resumption, cross-process write-lock retirement, remaining private-store/enterprise-metadata assessment, and Windows distribution packaging. Mac remains deferred. Passing selected checks is not proof of all project requirements. No installed Graviton program/profile was changed by this increment. Continue from this state; do not redo the completed preview-only acceptance or ask the user to repeat synthetic fixture checks.

Final acceptance:533 full server tests pass with5 skipped;1182 renderer tests pass with1 skipped. The final focused application/repair/approval run passes24 tests. The one-scope desktop loop includes an actual optional build script and passes after one reviewed repair. Cold reopen retains the additional test source added to the repair snapshot, preserves the original native source selection for the next task, and starts no inference. A stale renderer wording assertion and a cold-fixture assumption of exactly two sources were corrected; neither was treated as a product pass before its successful rerun.

A separate explicit live acceptance used Hadron's existing ChatGPT connection for2 actual gpt-6-luna requests: a real proposal and independent exact review, followed by actual reviewed application to a disposable calculator project and passing Node tests. The tests were preserved. No personal project, sign-in setting or Graviton profile was changed, and no raw credentials were read or copied by the test harness. The normal official runtime handled authentication. Live evidence is in validation/revision93/live-project.txt and Hadron's private validation-live folder. Multi-repair and40-turn desktop tests remain synthetic generation, with actual host/storage/Windows operations.
---
# Project editing activation audit - revision84

The first real two-model proposal/review is accepted at preview scope. The user's screenshot shows both native-selected files, one README proposal and a completed independent B review. Read-only inspection of Hadron's private saved record confirms two completed stages, B verdict approve and source hashes still equal the actual demo files. The closed session is retained as discarded/saved preview after ordinary Quit; that does not erase its completed review. This is not acceptance of file application, command execution or project completion.

## Confirmed boundaries

- ProjectDraftService derives native root/source grants, overrides raw renderer source paths, requires exact existing source hashes, and exposes no apply method.
- ProjectBuildCoordinator binds actual A/B runs, persists source packets, limits correction, records exact reviews and waits for real worker termination. The production writer lacks the trusted assertion and application-consent callback.
- Electron widget fs:writeFile/fs:mkdir, shell:exec, terminal create/write and custom Node invocation already call the execution gate before mutation/execution. The existing held-scope tests cover these categories; ordinary reads and native folder selection are separate permissions.
- Project roots protect application/profile/account/library locations and their canonical aliases. Metadata-only saved listing does not read all old project files.

## Confirmed unresolved entry points

1. electron/main.ts shell:openPath launches the system default handler, which can be an executable or editor. Generic auth:openExternal and the window.open HTTP handoff also launch an external application. Current code does not join those processes into the project execution scope. Simply labelling every browser click as unresolved legacy execution would permanently disable subsequent project admission with the current no-reset ledger; do not ship that as a cosmetic guard. Define explicit user-driven external launch admission, scope-aware blocking, clear UI status and a fresh-session recovery policy first. Trusted fixed provider login URLs are distinct from generic renderer-selected URLs. This audit does not claim existing external applications can be contained.
2. server/tools/themeManager.ts can mkdir/copy managed themes during initialization/list/read, not only save/delete. YGG_THEME_DIRECTORY and host dataDir select the target. Default desktop storage is protected private data, but configurable overrides and linked targets need a pinned canonical-root policy before any writer-capable composition. Blocking every theme read as arbitrary legacy execution would unnecessarily disable project previews; distinguish guaranteed profile-only maintenance from user-selected external storage.
3. Profile settings/log/auth/job-checkpoint writes must remain confined to pinned private storage, including aliases. A user-selectable path must not be assumed internal. Continue auditing attachment/export/download/update/install/LSP/custom-tool paths and future host entry points. An inventory is not proof of containment; add dispatch-level regressions for each confirmed bypass.

No new external-launch behavior is enabled in revision84. Ordinary links remain as before; canonical edits remain disabled. The existing cooperating-host execution gate is not an OS sandbox and does not control unrelated external writers.

## Ordered implementation gates

1. Finish the path/launcher audit above and add narrowly scoped policies tested against real temporary roots and exact production dispatch functions. Preserve accepted ordinary chat and provider login flows.
2. Implement previous-process/child termination evidence and authenticated interrupted-scope reconciliation. Never delete execution.json, infer termination from elapsed time/PID alone, or replay ambiguous paid work/writes. Start with process-local owned provider workers; inherited arbitrary descendants need separate proof or a strict isolated process epoch.
3. Finalize the supported Windows metadata policy and fail-closed checks for unsupported attributes/security cases. Existing tests establish owner/group/protected DACL, ordinary attributes, creation time and named streams on disposable files; enterprise auditing/labels and power-loss behavior are not certified.
4. Wire explicit native user consent to an exact displayed reviewed snapshot, not to a model verdict or renderer canApply flag. Recheck root identity/source hashes/review/version/actual workers immediately before each write. Preserve original backups, durable receipts and Stop between files. No rollback overwrite of a later user edit.
5. Run a disposable real-account single-file application, manual-conflict, Stop, failure and restart acceptance before personal files. Do not silently expand to directory creation, deletes/moves or package installation.
6. Contain approved project commands separately with exact executable/arguments/environment, output/time limits and actual receipts. Only then implement bounded build/test/fix milestones and truthful project completion criteria.
7. Keep the expanded CONTINUOUS_CHAT_PLAN.md as the subsequent roadmap. Its text-only scheduler cannot grant unfinished project capabilities. Show the user its UI preview before final mode/tab design.

## Next user acceptance

At next start, Hadron should fill the desktop and retain its current logo entry for at least four seconds after the logo loads, then restore saved work. Confirm the saved README file card displays Before/Proposed after, B's exact review is readable, both selected source paths remain listed and reopening starts no inference. No sign-out or new account is needed. The existing real proposal is sufficient; do not spend another request just to check saved rendering.


## Revision86 - confine theme maintenance to pinned profile storage (2026-11-07)

ExecutionStartup now pins a PrivateProfilePaths policy to the actual profile's BigInt device/inode. Internal consumers can recheck existing ancestors and leaves; linked/junction paths, hard-linked files, invalid ancestors, alternate streams, escapes and replaced profile roots are refused. Reinitializing the same string path cannot adopt a replacement root. This is a host storage check, not a model/project permission or an OS sandbox.

Theme initialization and CRUD in configured desktop/standalone/utility hosts now use the fixed profile/.ygg/custom-themes directory. A late external directory override is rejected before mutation. Target checks run on initialization, copying, listing, reading, saving and deletion. Template links/hard links are refused; copy uses exclusive-create semantics and rechecks a raced target. Saves open without truncation, validate the actual file handle/name/links first, and then write. Normal private theme operations do not taint a held project session. Unconfigured legacy test hosts retain their existing root resolution, but cannot obtain project execution authority.

Focused validation:10 new actual-filesystem tests plus8 startup regressions and5 inherited theme tests pass. The full server suite run before the final two additional race/concurrency tests passed456 with5 skipped; the final focused run independently passed all18 policy/startup tests, including those two additions. Server/Electron/mobile typechecks and main/mobile builds passed. Actual built startup and desktop fixtures are recorded in validation/revision86. Application consent and project editing remain unavailable; this closes the theme-target gap, not the whole activation audit. External launcher policy, other private stores, previous-process termination, advanced metadata, native exact consent and contained commands remain.


## Revision87 - native read-only saved-state inspection (2026-11-07)

Build a project now has Inspect saved state beside its response/log controls. It explicitly compares current project file states with the saved before/proposed-after states, reports a changed/unverifiable root or manual differences, and distinguishes workers actually confirmed ended by the current host from historical/unconfirmed workers. The report is timestamped and does not verify the whole answer or run tests. Each proposal selection clears the earlier displayed inspection.

The fixed authenticated native inspect channel derives the local owner, invokes the existing fresh coordinator recovery observation and returns a small read-only report without write capabilities, inspection digests, root paths or file contents. There is no apply/reconcile/resume endpoint and no lock reset. Inspection does not start inference, change project files, or claim earlier-process termination after restart. It can inspect saved work after the original native grant expires, as an explicit user-initiated read of the previously selected folder; a new task still requires fresh selection.

Validation: full server460 passed/5 skipped, focused service/bridge20 passed, renderer8 passed; server/renderer/Electron/mobile typechecks and renderer/main/mobile builds passed. Server cases cover owner refusal before file reads, original/manual file states, changed root, unchanged bytes and zero new requests. Actual built desktop inspection reports original file state and current-host worker termination while preserving existing proposal/Stop/two-source/retention/quit checks. Cold-reopen inspection is tested separately under validation/revision87. Canonical edits and cross-process unlocking remain disabled.

NEXT USER CHECK: fully quit Hadron normally, reopen and select the saved reviewed proposal. Click Inspect saved state on the left. The files should match original state (no application has been enabled); historical worker termination should be described as unconfirmed by this session. This requires no new model request, account sign-in or file changes. Confirm the report is useful/readable before the next recovery/apply controls are introduced. Existing before/after diff and two-file list remain available.


## Revision88 - protected and durable automatic job logs (2026-11-07)

Extended pinned private storage checks to AgentJobJournal locations, checkpoints and reads. Linked log directories, hard-linked leaves and external configured destinations are refused. Reads now use a bounded file descriptor with actual identity/link/size/time checks and fatal UTF-8 decoding. Checkpoint temporaries are created exclusively, synced and renamed only after checks; cleanup deletes only the identified temporary owned by that attempt.

Fixed a continuity bug: an unchanged in-memory snapshot previously returned before verifying its Markdown record still existed. A removed/changed durable log is no longer silently accepted as a valid checkpoint. Missing logs are recreated with full current notes, and oversized/invalid/changed-during-read records fail closed. This improves continuity records without treating logs as execution authority or inventing prior worker termination.

Validation: full server466 passed/5 skipped; focused journal/coordinator57 and headless individual/collaboration/log44 passed. Server/Electron/mobile typechecks and main/mobile builds passed. The built proposal/inspection/Stop/two-file/retention/clean-Quit fixture passed. Cold reopen additionally reads the saved Agent A Markdown through the actual native bridge and verifies no inference replay; results are in validation/revision88. Tests use disposable files and synthetic provider/picker replies; no personal files or account data were changed. See PRIVATE_STORAGE_POLICY.md for the exact coverage and remaining stores. Actual project application, commands and cross-process unlocking remain disabled.

NEXT USER INPUT: review the new Inspect saved state screen beside an existing saved proposal and its View Agent A job log. Both should remain readable after normal Quit/reopen, with original file states and historical worker status described truthfully. No new proposal or sign-in is needed. User feedback on this recovery view precedes the next recovery/apply UI controls, consistent with the user's request to participate in design. Remaining engineering gates continue in PROJECT_ACTIVATION_AUDIT.md; this does not mark application ready.


## Revision89 - user preview acceptance and private registration storage

The user confirmed saved-state inspection after reopening and the actual saved README Before/Proposed after display. No further proposal request is needed. Extended pinned private storage to the advanced app-registration encrypted record and mutation lock; see PRIVATE_STORAGE_POLICY.md. The separate official Codex credential directory and other stores remain unaudited for this policy. Actual application/commands/restart unlock remain gated.


## Revision90 - external shell handoffs checked, standard containment still open

Covered generic native web/file/window.open handoffs and initial embedded OAuth window creation with project-aware admission. Exact trusted host ChatGPT auth paths retain a separate exception only in a clean session. Held/corrupt/persisted project state refuses all these handoffs. Native regression evidence confirms standard handoffs remain usable, restricted sessions reach no shell dispatch, and denials leave execution evidence intact. See EXTERNAL_LAUNCH_POLICY.md for routes, tests and limits.

This partially supersedes unresolved entry1 above; it does not join/terminate earlier standard-mode applications or unrelated external writers. The production writer must remain disabled until a clean project-only epoch or equivalent containment, previous-process proof, remaining private storage/metadata and exact native consent are established.


## Revision91 - current-host worker join corrected

Codex command failures now wait for the actual owned child close event instead of rejecting immediately on an error; pipe/observer/stdin failures and unsuccessful kill requests cannot publish premature completion. Graceful Quit closes admission and joins all owned status/login/provider work without logout, then joins existing project/server shutdown. Actual built repeated-Quit acceptance passed with a delayed real local child. This does not establish earlier-process/descendant termination or permit restart unlocking. See WORKER_LIFECYCLE.md for evidence and remaining crash/restart steps.


## Revision92 - Windows worker containment (2026-11-07)

Project-only Codex launches now use creation-time Windows Job Object assignment, durable private admission evidence and whole-job termination joins. Saved inspection can confirm newly recorded prior epochs through actual process identities and job accounting. Unknown/old/denied/cross-session evidence remains unconfirmed. This does not unlock execution records, restore write leases, replay requests or enable editing. Standard sessions and Claude helpers are outside this transport.

Validation:515 server tests passed/5 skipped; final server typecheck, renderer and Electron/mobile builds passed. Actual crash/descendant/cancel, production transport, repeated Quit and fresh cold-reopen checks passed. No real credentials or inference requests were used. An early closed fixture was inconclusive and the stricter rerun passed. See WINDOWS_WORKER_CONTAINMENT.md and validation/revision92.

Next: exact execution-marker binding and explicit preview-recovery retirement, remaining helper/private-store/metadata assessment, then native application consent and disposable write/conflict/restart acceptance. Project editing, commands, continuous automatic A/B turns and distribution acceptance remain pending. No user action is required for this increment.
