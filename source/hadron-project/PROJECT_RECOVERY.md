## Current state - revision93 (2026-11-07)

The user explicitly prioritised reviewed file application, builds/tests with a repair loop, and automatic back-and-forth conversation, with Mac deferred and testing performed autonomously. These features now have native desktop implementations for the supported Windows/Node scope. This section supersedes earlier statements that all canonical application or all automatic conversation is disabled; the older entries below are historical records.

Build a project: exact native-approved current-session file application; actual contained Node tests and JavaScript build scripts; separate test/build output and exit codes; stale pre-application results; a manual repair action; and an opt-in bounded build/test/fix run. One native scope approval covers the initial reviewed change plus at most two freshly reviewed repairs within the original editable paths, fixed test/build scripts, at most eight additional model calls and three applications/checks per kind. Stop, changed scripts, rejected reviews, conflicts and exhausted budgets stop progression. No token is serialized or granted to models. See BUILD_TEST_FIX.md.

Automatic conversation: an additional three-pane mode with shared goal, independent A/B ChatGPT model choices, automatic alternating turns, ordered turn cards, transcript, budget extension, boundary user messages, Pause and Stop. Durable request/run binding prevents duplicate dispatch; per-agent Markdown logs checkpoint preparation, binding and completion. Cold reopen sends no requests and historical sessions cannot adopt old workers. Text only; no project/tool capabilities. See AUTOMATIC_CONVERSATION.md.

Validation uses synthetic model replies and approvals in disposable profiles, but actual Windows replacements/backups, native process jobs, Node test/build execution, SQLite persistence and built main/preload/UI. The full server suite passes533 tests with5 skipped; renderer/main/mobile builds and checks pass. A manual calculator fixture failed, was actually corrected, passed its retest and produced a build output file. The automatic fixture deliberately starts with a faulty implementation and independently reviews a fresh repair. A separate conversation fixture exchanged40 turns, injected a user message, exercised Pause/Stop and reopened with zero inference replay. Final results are under validation/revision93. No real credentials or provider inference requests are used by these fixtures.

Remaining: end-user native UI acceptance and real-account multi-repair/continuous sessions, Claude integration/acceptance, arbitrary package/native/Python commands, directory creation/deletes/moves, general project milestone completion, safe historical conversation branching/resumption, cross-process write-lock retirement, remaining private-store/enterprise-metadata assessment, and Windows distribution packaging. Mac remains deferred. Passing selected checks is not proof of all project requirements. No installed Graviton program/profile was changed by this increment. Continue from this state; do not redo the completed preview-only acceptance or ask the user to repeat synthetic fixture checks.

Final acceptance:533 full server tests pass with5 skipped;1182 renderer tests pass with1 skipped. The final focused application/repair/approval run passes24 tests. The one-scope desktop loop includes an actual optional build script and passes after one reviewed repair. Cold reopen retains the additional test source added to the repair snapshot, preserves the original native source selection for the next task, and starts no inference. A stale renderer wording assertion and a cold-fixture assumption of exactly two sources were corrected; neither was treated as a product pass before its successful rerun.

A separate explicit live acceptance used Hadron's existing ChatGPT connection for2 actual gpt-6-luna requests: a real proposal and independent exact review, followed by actual reviewed application to a disposable calculator project and passing Node tests. The tests were preserved. No personal project, sign-in setting or Graviton profile was changed, and no raw credentials were read or copied by the test harness. The normal official runtime handled authentication. Live evidence is in validation/revision93/live-project.txt and Hadron's private validation-live folder. Multi-repair and40-turn desktop tests remain synthetic generation, with actual host/storage/Windows operations.
---
# Project recovery and Windows commit contract - revision80

This is a host-only backend, not a live menu or permission grant. Startup now configures canonical exclusion and the host coordinator has an explicit default-denied apply action. No live native/UI grant or consent composition enables a writer scope or application. Existing two-agent conversations remain the accepted live baseline.

## What recovery does

recoveryPlan authenticates the stored owner and reads the selected root, latest candidate per path, actual bytes/identity/timestamps and retained operation artifacts. Saved before/after hashes are checked for corruption. Windows replacements are compared against their original backup using the fixed read-only metadata helper. The inspection digest covers the observed state; a stale digest is rejected. Unknown/linked/changed roots, unknown content/artifacts or changed permissions retain the lock.

The coordinator's explicit keep_observed_files action requires the original in-memory folder/execution capabilities, its original process instance and actual owned workers no longer active. It never trusts a serialized workersStopped flag, a model author label or a timestamp/PID-only unlock. The writer rechecks the observations in a FULL-synchronization SQLite transaction, stores a reconciliation event and releases the folder lease without altering files. The task is durably terminal before execution is reopened. A marker-storage failure leaves intervention visible; after a new explicit inspection, marker closure can finish without replaying paid work or an edit. Original reviews cannot authorize a new attempt.

A new host can inspect saved diffs/logs/recovery observations but cannot recover the old opaque capability. Previous-process/child termination proof and an authenticated restart intervention flow remain unimplemented. Do not clear execution.json or rewrite database state to bypass this. Current-host uncertainty is resolvable only when the actual files match known before/after states and metadata verification succeeds; unrelated/manual versions stay held for inspection.

## Windows replacement policy

The platform adapter uses the system Windows PowerShell executable with fixed encoded code, NoProfile/NonInteractive, disabled module autoload, an explicit system Utility module, minimal environment, trusted cwd, JSON stdin and a ten-second process budget. It accepts no executable, script or arbitrary command from the caller/model. This is a bounded host filesystem operation, not project shell/build/test access. Ordinary canonical apply is disabled unless a synchronous host admission assertion is supplied and remains valid.

The adapter prepares a same-directory staged text file, clones owner/group/access-control information, preserves supported ordinary attributes/creation time, then calls File.Replace with merge failures not ignored and an original backup. It verifies content and access-control metadata before success. Its backup is retained for read-only recovery comparison. There is no permission-losing rename fallback. Read-only/special attribute cases fail closed; uncertain temporary/backup artifacts remain available, without automatic cleanup or rollback.

Real NTFS tests cover protected DACL, owner/group, Hidden/Archive attributes, creation time and a named data stream, including Unicode and shell-metacharacter file names passed only as data. They also cover actual replacement followed by lost receipt and permissions changed after success. All validation uses disposable folders. POSIX/macOS acceptance, full enterprise SACL/auditing/security labels, non-cooperating external writers and OS power-loss durability are not certified. Do not expand the supported policy silently. The synchronous helper must be integrated with yielding/dedicated trusted execution before a live multi-file UI; a cancellation must not start another file after the current bounded commit.

Platform references: [Microsoft ReplaceFileW contract](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-replacefilew), [Microsoft File.Replace API](https://learn.microsoft.com/en-us/dotnet/api/system.io.file.replace).

## Still required for activation

- Build-safe startup with one canonical execution ledger configured before any competing legacy work.
- Actual protected roots/native consent/owner routes; bind the write assertion to the exact scope and folder lease, never a UI boolean.
- Previous-process recovery proof and safe artifact retention/cleanup policy.
- Approved three-pane Build a project entry with visible diffs, new B review when changed, explicit apply, receipts, Stop and recovery state.
- Disposable-project live account acceptance. Tests/builds remain not run until a separately contained command capability exists.


## Application interruption (revision80)

An application reservation is durable before its first file and cannot be retried, including after Stop or journal failure. Status distinguishes applying, applied, failed, cancelled and interrupted observations from project completion. A restarted coordinator can inspect saved operation receipts and logs, but cannot reconstruct the original live scope/lease or approve another write. Explicit same-host keep-files reconciliation still requires all actual workers ended and fresh known observations. A closed/discarded reconciliation remains terminal even if an old application receipt was left started. Canonical standard/utility startup now leaves legacy execution markers for intervention; do not delete them to get into project mode. Previous-process/child termination proof is not implemented.


Revision80 storage-failure handling: a corrupt/unconstructable execution ledger now produces a frozen restricted inspection boot. Existing saved work can be viewed without starting inherited runtimes. Both legacy and project execution remain denied even if the ledger failed before configuration; no record is cleared or replaced. This is not stale-scope recovery or write permission.

Current revision81: native Build a project proposal preview is now available; A/B role admission and selected-file grants are wired. Applying edits and executing project commands remain disabled. Real subscription preview acceptance is pending. See PROJECT_DRAFTS.md. Earlier revision descriptions below remain historical.


## Revision81 - native project proposal preview (2026-11-07)

The approved separate Build a project mode is now wired into the real desktop app. It uses the same three panes: reviewed responses/diffs on the left, plan/stage/file cards in the middle, and separate A/B models plus native folder/source pickers on the right. Agent A proposes text changes; Agent B receives the exact frozen before/after snapshot. Existing files must match explicitly selected source paths and SHA-256 hashes. At most one correction/re-review is allowed. This release prepares proposals only: no application API, file changes, project commands, tests or automatic project completion are enabled.

Native grants bind the local owner/workspace and exact root identity, expire on restart/logout, and refuse protected application/account folders including junction aliases. The private hadron-project-builds.db is separate from chat schema. A damaged optional project database disables project proposals while leaving core chats available; it is not repaired or deleted. Saved chooser reads metadata only. Read-only admission checks recover a lost response without retrying inference. Real worker shutdown is awaited before private storage closes, including Quit with an idle upgraded socket. A crash/unknown previous process still holds execution; no marker deletion or PID/age unlock is offered.

Validation: full server444 passed/5 skipped; renderer1177 passed/1 skipped; no failed tests. Server/Electron/mobile typechecks and built renderer/main/mobile passed. Four built startup cases passed (project, standard utility, corrupt execution record, corrupt optional project database). Final built native preview passed real protected-worker admission, frozen source capture, exact B review, diffs, three panes, keep/clear selected files, Stop and saved proposal selection. Cold reopen restored the proposal/mode with zero inference and expired native grants. Both clean Quits joined workers, closed an unregistered idle socket and released execution. Picker/provider replies were synthetic; no real subscription or personal project edits. One preceding desktop attempt found the Agents pane collapsed during placement measurement; a fresh full run and cold reopen passed. Preserve that diagnostic rather than claiming the earlier attempt passed. Existing native-reader regression is recorded separately. Evidence: validation/revision81.

NEXT USER CHECK: fully quit Hadron normally and reopen the shortcut; keep the existing ChatGPT account. In Build a project, select the sibling demo-project folder and README.md plus src/calculator.js. Choose both ChatGPT models, request a proposed README-only improvement explaining the calculator, and provide a deliverable. Prepare proposal should show A's suggested changes and B's exact review, with unchanged source files and no test claims. This real subscription preview acceptance is pending. Canonical edits still require remaining execution audits, prior-process/child termination proof, advanced metadata policy and explicit native consent; command containment and milestone completion follow separately.

USER REQUEST ADDED: continuous automatic A/B conversation (ping-pong turns), with chess only an example. Preserve ordinary independent chat and bounded review modes; implement an opt-in continuous session after the current project-building milestones. See CONTINUOUS_CHAT_PLAN.md. This is planned, not yet available.


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


## Revision91 - current-host worker join corrected

Codex command failures now wait for the actual owned child close event instead of rejecting immediately on an error; pipe/observer/stdin failures and unsuccessful kill requests cannot publish premature completion. Graceful Quit closes admission and joins all owned status/login/provider work without logout, then joins existing project/server shutdown. Actual built repeated-Quit acceptance passed with a delayed real local child. This does not establish earlier-process/descendant termination or permit restart unlocking. See WORKER_LIFECYCLE.md for evidence and remaining crash/restart steps.


## Revision92 - Windows worker containment (2026-11-07)

Project-only Codex launches now use creation-time Windows Job Object assignment, durable private admission evidence and whole-job termination joins. Saved inspection can confirm newly recorded prior epochs through actual process identities and job accounting. Unknown/old/denied/cross-session evidence remains unconfirmed. This does not unlock execution records, restore write leases, replay requests or enable editing. Standard sessions and Claude helpers are outside this transport.

Validation:515 server tests passed/5 skipped; final server typecheck, renderer and Electron/mobile builds passed. Actual crash/descendant/cancel, production transport, repeated Quit and fresh cold-reopen checks passed. No real credentials or inference requests were used. An early closed fixture was inconclusive and the stricter rerun passed. See WINDOWS_WORKER_CONTAINMENT.md and validation/revision92.

Next: exact execution-marker binding and explicit preview-recovery retirement, remaining helper/private-store/metadata assessment, then native application consent and disposable write/conflict/restart acceptance. Project editing, commands, continuous automatic A/B turns and distribution acceptance remain pending. No user action is required for this increment.
