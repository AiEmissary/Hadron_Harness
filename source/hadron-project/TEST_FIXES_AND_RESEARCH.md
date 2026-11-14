# Two-pane redesign implementation underway - 10 November 2026

The new borderless two-pane surface, pop-up-only setup, common Send/Stop/session logic, history adapters and native Agent permission/tool path are implemented in source and tested in isolated fixtures. Desktop route/data integration and authoritative branch copy/move/notes/bin operations remain unfinished. The installed application and installer remain unchanged. See REDESIGN_IMPLEMENTATION_2026-11-10.md for precise evidence and next steps; HADRON_REDESIGN_2026-11-10.md remains the user-approved specification. Do not activate an incomplete replacement or describe fixture actions as saved real work.

Earlier checkpoints below are historical.

---

# User-directed two-pane redesign specified - 10 November 2026

The user's annotated Examples 1-3 and clarification replace the previous three-pane workflow design. Use HADRON_REDESIGN_2026-11-10.md as the implementation specification. Fixed layout: chronological transcript left, branch tree right, one bottom-left composer in every mode. Work type, Chat/Agent permissions, A/B switching and setup controls belong in the three-dot pop-up; the main page retains the compact strip and requested help/attachment/send controls. Chat/Agent controls permissions for Work together too. Do not introduce any additional buttons/features without asking.

This checkpoint records the design and implementation sequence; the installed app has not been redesigned or replaced. Reuse the original chat/composer/tree, preserve all saved records, migrate old mode histories through adapters, and implement actual coding capability behind Agent mode. Next: implement the unified shell and pop-up using the specified control inventory, then connect individual/together/continuous execution and branch operations. No installer update until local acceptance. Original Graviton remains untouched.

Earlier checkpoints below are historical.

---

# Bounded source-read correction active - 9 November 2026

The reported Agent B task retained its selected folder and conversation, listed/searched successfully, then stopped without reading a matching source. It returned no changes because hashes were not yet available. Folder-based file work now requires a relevant source-read attempt before accepting a final answer without frozen source. The existing one-correction host protocol directs an actual matched-file read within the same maximum-eight-request budget. Empty root listings still permit new-project work. Inspected projects may legitimately yield no justified changes; no permission or write scope was added.

Empty proposals now say no changes were proposed/applied, preserve the explanation and offer continuation/Try again. Errors name the actual actor; ended stages that never ran say so. The original failed task remains saved and was not automatically rerun.

95 coordinator/protocol tests, 17 client tests, production builds/typechecks and the five-task native coding/handoff audit passed. The native audit explicitly reproduces search then premature empty response, observes correction and actual source read before applying its disposable fix. Installed startup passed with zero model requests; all 1,529 baseline logical rows across 51 tables survived and all three integrity checks passed. Normal installed Hadron is reopened. No paid task or trading project was rerun/edited by validation. Active archive: 39a7aee5ac1ec8eeda8dce01bc555b3b7e8307c95ca33967e5b12538904da968. EXE, installer and source ZIP remain frozen.

Next user step: Try again on the saved task, reselect the Andromeda2 folder after restart, then Go. Source inspection can still conclude that no defect is established; the host must not manufacture a patch. See validation/local-source-read/README.md.

Earlier checkpoints below are historical.

---

# Task feedback fix active - 9 November 2026

With the user's explicit reopen approval, the tested feedback resources are installed and the normal Hadron app is open. Task update at the top of the left Project build pane lists the actual agent, saved files and test/build states. It and the full conclusion remain visible during file/stage inspection. No tests run is stated explicitly. Read task report returns to the summary. Help is updated.

Seven receipt/outcome tests, production renderer build, Electron typecheck and the five-task native coding/handoff audit passed, including visible Agent B receipt during file/stage inspection. Installed startup passed with zero model requests. All 1,508 baseline logical rows across 51 non-search tables survived; all three DB integrity checks passed. User-approved unsent draft loss was the only expected effect of reopening. No user task or paid provider request was rerun.

Active local archive: 2ec9993d0abaf6abe4246396fe683bfef556e485c06941600f890710fc65ffd4. EXE, desktop installer and source ZIP remain unchanged/frozen. Next user step: choose Project build in the left tabs and read Task update. See validation/local-task-feedback/README.md and activation.json.

Earlier checkpoints below are historical.

---

# Simple conversation-to-work flow active - 9 November 2026

The installed local app now offers Continue with Agent A, Agent B, both agents, and Work on this beside answers. Work on this chooses who acts, an instruction and Go, carrying the selected bounded conversation, provider/models and current live folder. Work on files in the other modes and Build from scratch also use Go. A single agent implements and self-checks; both uses A to implement and B to check. The old required preparation handoff and duplicate conclusion selector are removed. File approval and supported checks occur at execution. How to use Hadron is updated.

99 backend tests, 20 focused client tests, production builds/typechecks, the five-task native coding/handoff test and the native XML/folder/regeneration regression passed. Actual temporary code changes and Node checks passed using synthetic model responses. The five-task fixture exceeded its original 55-second process deadline once; a test-only 180-second deadline allowed the full rerun to complete. No user project or paid provider task was run. Actual installed startup passed with zero model requests; all 1,486 baseline logical rows across the three databases survived and integrity passed. The installed app reopened with its normal profile. Local archive: 50460ee298c241b3aad1ad36bd49a7c81ba800b9f0f615b6daf2d6b84b6fd1c0.

Installer/EXE/source ZIP remain frozen until user acceptance. Built-in automatic checks support Node tests/build scripts; arbitrary shell execution was not added. The separate existing saved-history loading issues remain a follow-up if reproducible; saved records are intact. Next acceptance: open a saved completed answer, Work on this, choose A/B/both, instruction and Go; approve when ready. Continue buttons return to discussion without starting requests. See validation/local-conversation-actions/README.md.

Earlier checkpoints below are historical.

---

# Four-mode folder/access check active - 9 November 2026

Installed local resources now preserve reviewed access when adding a folder in Independent jobs, Work together and Automatic conversation. Independent regeneration/editing keeps the current live folder and access choice. The left instructions explain Send blockers and offer Read files or the reviewed-edit handoff. Help is updated. Build retains its goal/models/access when choosing a folder. Restart and Remove folder still revoke permissions; no saved history grants access automatically.

All four modes passed the native folder/access test, plus 12 focused tests, production builds/typechecks and installed startup. All existing logical DB records and all three integrity checks passed. No paid task was rerun, no project edits occurred, and EXE/installer/source ZIP remain unchanged. The installed app reopened. Next: regenerate the saved report question, add its folder once after restart, choose Read files and Send to Agent A. See validation/local-folder-choice/README.md. Keep installer updates frozen until the user says ready.

Earlier checkpoints below are historical.

---

# Native tool-format fix active - 9 November 2026

Installer freeze continues: no EXE or source ZIP rebuild. The latest single Claude Sonnet job returned raw XML tool markup and was incorrectly marked completed. The shared host loop now requests one bounded JSON-protocol correction instead of treating that markup as an answer or executing XML. Repeated malformed output stops clearly. Old affected individual replies show an explanation and collapsed technical text; original history is preserved.

55 focused tests, production builds/typechecks, native single-agent selected-folder recovery and installed startup passed. All baseline logical database rows survived and all three integrity checks passed. The installed app reopened; no paid task was rerun. Next user step: Regenerate answer on the bad response, Add folder again and Send to Agent A. This prepares and then explicitly submits the original task. See validation/local-tool-markup/README.md. Desktop installer still lacks these local fixes and must remain unchanged until user acceptance.

Earlier checkpoints below are historical.

---

# Local shared-continuation fix active — 9 November 2026

Installer freeze remains. Only local installed resources were updated; no EXE or installer/source ZIP rebuild. The user explicitly approved reopening and clearing the unsent question. Completed shared-task history remains intact.

Continue with both agents is above the answer, keeps it visible and preserves text typed before choosing continuation. The left composer now identifies the follow-up, labels Send follow-up to both agents and explains an Edit and test block with a Use Read files action. Read mode still requires a current folder grant. Reopen last saved answer restores the newest completed answer without inference; saved sessions now paginate by creation order instead of random IDs. Help is updated. This does not add restart-persistent unsent draft storage.

49 focused tests, production builds/typechecks, full native two-agent follow-up/fork/recovery and actual installed startup passed. All pre-update logical DB rows are preserved and integrity passed. No paid request was started. The installed app is reopened. User next: Reopen last saved answer in the left composer → Continue with both agents above the answer → write follow-up → Send follow-up to both agents. Read files and the folder must be selected for research. See validation/local-shared-continuation/README.md. Current Desktop installer remains its pre-local-fix baseline; do not update until the user says ready.

Earlier checkpoints below are historical.

---

# Local collaboration failure repair â€” 9 November 2026

Installer freeze remains: test the installed programme here; do not rebuild EXE installers or source ZIPs until the user says ready. The app's local resources have been updated and reopened; installed EXE and Desktop installer are unchanged.

The failed folder test exhausted eight research requests before an agent gave its final answer, cancelling the other proposal. The last request is now reserved for the answer. If ignored, Hadron preserves bounded partial evidence with a clear warning, without another tool operation or a higher request budget. Structured edit proposals still fail safely. Old failures show a useful explanation, and trees refresh after failed/interrupted tasks as well as success. Original failed sessions remain saved; no paid task was rerun.

92 focused tests, production builds/typechecks, a full native two-provider research-limit/review/synthesis test and actual installed startup passed. All baseline database records are intact and integrity passed. User acceptance is next: select folder again after restart, choose New collaboration and repeat test one explicitly. See validation/local-research-finish/README.md. Desktop 0.4.17 installer does not yet contain the local access/excerpt or research-limit fixes. Mac remains deferred.

Earlier checkpoints below are historical.

---

# Current local resource test â€” file access and excerpts, 9 November 2026

TEST LOCALLY FIRST. Do not rebuild/update EXE installers or source ZIPs until the user explicitly says ready. Installed executable remains 0.4.17 and is unchanged; source revision 53a86b8 updates only its application resources for this test. Desktop installer remains the earlier 0.4.17 baseline and does not contain these local changes. Do not start the development version for normal use or use the desktop inspection tool that caused the fuzzy cursor overlay.

Access controls are present in all four modes: Chat only, Read files, Edit and test. Add folder enables scoped read/search, including both agents in Automatic conversation. Editing from other modes prepares a Build a project draft; it does not grant writes or run requests. Build applies only approved reviewed changes and approved checks. Attachment input supports 8 MiB files and an explicit line-excerpt picker; shared context stays bounded at 16,000 characters. Folder reads support files up to 16 MiB with 200-line/8,000-character excerpts. Content search remains bounded to 8 MiB per operation. Permissions expire at restart. Help is updated.

Passed: 14 renderer and 40 server tests, production builds/typechecks, native access/excerpt/automatic-folder-read/edit-handoff tests, shared-folder collaboration regression, continuous-conversation regression, and startup diagnostic of the actual installed local resources. All existing logical database rows survived, integrity passed, and saved history has 3 projects, 56 conversations including bin and 158 messages. The user app has reopened for testing. No paid inference or installer build. See FILE_ACCESS_AND_EXCERPTS.md and validation/local-file-access/README.md for exact boundaries, evidence and private rollback locations.

Next: user tests Access choices, large file excerpts and reviewed-edit handoffs here. Fresh-PC acceptance, signing and distribution review remain external. Mac deferred. Original Graviton untouched.

Earlier checkpoints below are historical.

---

# Current local test: 0.4.17 â€” 9 November 2026

USER INSTRUCTION: Test programme changes on this computer first. Do not rebuild, replace or update EXE installers again until the user explicitly says they are ready. Do not launch the development version for normal use. Do not use the desktop inspection tool: its cursor/highlight effect annoyed the user; resetting its session removed it.

The provider-choice repair was already packaged and its local upgrade started before this instruction arrived. That in-flight 0.4.16â†’0.4.17 upgrade completed safely. Installed archive matched the build; all baseline logical rows and message content/parent links remain unchanged, with 3 projects, 54 conversations including bin and 149 messages. Desktop/Start menu/pinned shortcuts point to installed Hadron with no development arguments. The app was reopened for the user's local testing. Original Graviton is untouched.

The model menus previously held stale disconnected availability despite both account cards showing connected. Account refresh/polling now notifies the workflow; providers load independently, and Refresh providers and models is available above Subscription connections. All four modes were tested for both providers/model selections, retaining an unsent task and selections, with no inference. Nine focused renderer tests, production builds/typechecks, full shared-folder regression, sidebar toggle regression and packaged startup passed. Help includes recovery instructions. See validation/revision117/README.md and installed-upgrade-result.json.

The 0.4.17 source/installer files and Desktop packet had already been created before the user's instruction. They are pending the user's local acceptance, not recommended yet for the other PC. Installer SHA-256 ad2334f42f30c4ddab9c0fceeb38dcb3413da99ca8619f6c97be6c752e2bae32; source revision 440f7c79a37e146cb0895e199188ca16380757c9 and ZIP SHA-256 8a69c3618d5d4aaa8db9adca89293ca7c44820c1fbc4a43965183a484f61091d. Future installer work is paused by explicit user request. Do not regenerate these files during local UI fixes without authorization.

Next: let the user test Work together provider/model selection in installed 0.4.17. Folder permissions expire at restart and must be selected again. Continue necessary local app fixes with the user's testing-first preference. Fresh-PC acceptance, signing and publisher/provider distribution review remain open; Mac deferred.

Earlier sections below are historical.

---

# Windows 0.4.16 installed â€” 9 November 2026

Current installed app: C:/Users/rajka/AppData/Local/Programs/Hadron-Harness/The Hadron Harness.exe. Desktop, current-user Start menu and pinned shortcut point to this installed app with no development arguments. The update preserves all saved history: 3 projects, 54 conversations including bin and 149 messages; all baseline logical records and message parent links were verified unchanged. Original Graviton remains untouched.

The folder gap is closed: Work together has shared Add folder read/search for proposals, cross-reviews and verification. Independent jobs has visible per-agent Add folder. Helpers inherit only the same folder scope. No edits or commands in these modes; permissions expire at restart. Choose mode â†’ folder/files â†’ models on the right, then instructions/start/send on the left; responses appear above and trees/plans stay in the middle. How to use Hadron has updated flowcharts. Automatic conversation remains text-only. The left Projects button now toggles open and closed; a full-screen overlay was intercepting the second click and is fixed.

Current USB packet: C:/Users/rajka/Desktop/Hadron Release 0.4.16. Installer SHA-256 94bba1acc195624b34a66ba576b7b4d490fa508e815d960db089801253007f21. Source revision fb81243d524ad206ca6edf78ffd2e9e5fa72144d; source ZIP SHA-256 97d121c0e76cfd3371321e19726cefabcbfb43b7d73ac078d21971b17023b234. It contains the one current installer, matching source/notices, test checklist and hashes. Previous Desktop release packets are archived under Documents/Hadron Desktop Archive/2026-11-09. The source workspace remains for maintenance; it is not the app launcher.

Validation: 116 focused tests, production builds/typechecks, native folder/workflow/sidebar/build/continuous/jobs regressions, real ChatGPT and Claude fixture search/read, packaged startup and actual installed upgrade. Evidence and qualifications: validation/revision116/README.md. Preliminary lightweight-model probe failures are recorded there; the final main-model probe passed. Tool evidence is not a guarantee of whole-answer correctness.

Remaining external acceptance: separate fresh Windows PC testing, publisher/provider distribution review and signing. This private testing build is unsigned. Mac remains deferred. User feedback on the new workflow may identify further polish. No claim of fresh-PC acceptance is made.

Earlier sections below are historical and may describe older versions or gaps now fixed.

---

# Windows 0.4.15 installed â€” 9 November 2026

The installed app is C:/Users/rajka/AppData/Local/Programs/Hadron-Harness/The Hadron Harness.exe. Desktop, pinned taskbar and current-user Start menu shortcuts all point there with no development arguments. The old pinned PowerShell development launcher caused the wrong-version launches and was repaired; obsolete common/Desktop shortcuts and old release files are archived in Documents/Hadron Desktop Archive/2026-11-09. The development checkout remains in Hadron-Harness for maintenance and is not the normal app launcher.

Latest development-profile work was handed over after verifying all installed logical rows were an unchanged subset, with both profiles backed up. The installed profile now has 3 projects, 54 conversations including bin entries, and 149 messages. Existing messages and parent links remained identical across the actual 0.4.14-to-0.4.15 upgrade. Andromeda_profitability already contained separate A and B references plus a second A copy; no copy was overwritten. No credentials or account stores were transferred, and original Graviton is untouched.

Copy into project now has a direct New project button and deferred name-field focus, plus Add more chats for up to 20 separate reference chats in one destination. Batch copies are atomic and retry-safe; the confirmation lists each copied chat. Help is updated. The initial inability to type was not reproduced after explicitly clicking the field; native keyboard tests now check focus/typing after choosing a destination as well as the direct-button route.

Desktop USB folder: C:/Users/rajka/Desktop/Hadron Release 0.4.15. Installer bytes 370844103, SHA-256 9a9915a08b291fa16dc280abbaa2e671012ceefc703cc10bcf9bc25d6c26db52. Source revision ee8cee4bec44ac9e779bc9894dffb5281dcac772; source ZIP SHA-256 6263d93e35f5698681368b337588cb18e2f7f00b6de5992a2ace5ebbc996d345. The folder contains the installer, source/notices, current checklist and checksums, with no nested old installer. The standalone duplicate installer was not put back on Desktop.

Passed this change: 9 context-copy tests, production renderer/main/mobile builds and typechecks, native desktop regression using real keyboard/mouse input and multi-chat copy assertions, packaged 0.4.15 startup, and actual installed upgrade/archive equality/history preservation. Evidence: validation/revision115/README.md. No new paid inference was needed.

Pending functional gap: folder search is currently available only in Build a project. Independent jobs and Work together still accept Add files; neither has an Add folder button. Next design/implementation must give each job an explicit read-only folder grant, reuse bounded list/search/read and lightweight helper access within that root, show activity, isolate A/B permissions, and expire access on restart; collaboration reviews must identify supplied folder evidence. Do not claim this is already delivered. Mac remains deferred. Fresh-PC acceptance, publisher permissions and signing remain open; the private-testing installer is unsigned.

Older sections below are historical.

---

# Windows 0.4.14 delivered and installed â€” 9 November 2026

The normal Hadron Desktop shortcut now opens the installed 0.4.14 application. Saved history was preserved exactly, with verified private recovery backups. The current installer is C:/Users/rajka/Desktop/Hadron-Harness-0.4.14-win-x64.exe. The USB-ready folder is C:/Users/rajka/Desktop/Hadron Release 0.4.14 and includes the matching source, checksums, instructions and separate-PC checklist.

Installer: 370850039 bytes; SHA-256 188d3e6517ef64421d2963cf813bc7e9b11e5c2a768f4dd548394d1173f753fe.
Source: Hadron-Harness-0.4.14-source.zip; revision b4e819e857634976c04224d0ce7a9f423c5e0dee; SHA-256 afe624a6b2bafb4b4551ac0d5f925e16ebca6f871f108579efcefdec3d15fd30.

New: portable chat backup/import in Settings â†’ Saved data; safe Edit question / Regenerate answer drafts; whole-agent-conversation bin controls; updated Help. The existing 30-day bin policy remains. Source revision 8ac92be includes the installer-path backport; b4e819e adds acceptance tooling only.

The isolated 0.4.13 installer checks passed but actual Desktop launches crashed in NSIS System.dll. That package was withdrawn. The 0.4.14 upstream-backed folder-detection fix passed 50 fresh-path launches, default-mode Desktop install/repair/recovery/uninstall, an in-use refusal without termination, and actual installation into the userâ€™s normal program folder with unchanged chats. This was not merely another portable-copy fallback.

Passed: 41 focused tests, full production builds/typecheck, native branch/archive and broad chat regressions, packaged startup, and an additional 18-request real mixed-provider memory run. Results and limits: validation/revision114/README.md and its JSON receipts. The installer is unsigned. Fresh-PC confirmation and publisher permissions/signing remain external release checks; Mac is not started. The original application and development account profile were not changed. Reconnect providers in the packaged application if prompted; account credentials were not copied.

This section is the current checkpoint. Older sections below are historical.

---

# Revision 112 checkpoint

Saved agent history now pages beyond the previous whole-workspace caps, with selected ancestry preserved, adaptive page size, loading status and updated How to use Hadron. Source tests and a native paging fixture pass; final release acceptance is recorded in validation/revision112. Individual branch/context limits still apply. Version 0.4.12 is delivered. Final packaged/native installation and upgrade evidence is in validation/revision112; direct Node-launch failures remain unresolved.

# Consolidated fixes and investigations - 8 November 2026

Current action list after reviewing the other-PC chat (Test Programme Here), its recovered screenshots, REMAINING_WORK.md, release validation and the continuous conversation plan. This list supersedes older unchecked historical TODO boxes where newer release evidence records completion. Release 0.4.11 is being validated; this document is not a new build or a claim that these tasks have passed.

## Current implementation checkpoint

Revision111 adds current saved-session status, durable startup checkpoints, invocation-matched diagnostic reports and verified worker-build reuse. A longer real mixed-provider run passed 36 requests: 31 short replies and five summaries. Native startup-phase tests and the packaged invocation/portable-ZIP check pass. See validation/revision111. The underlying intermittent startup cause remains unconfirmed.


Revision 110 implements durable AI memory, safe diagnostic categories and conservative repetition pausing. 25 focused tests, production builds, a 40-request desktop fixture and a nine-request real ChatGPT/Claude memory check pass. Packaged startup, real 0.4.9 -> 0.4.10 upgrade, backup/recovery and uninstall also passed. Real second-opinion reviewers passed in both directions; mixed-provider reviewed application and three Node tests passed in a disposable task-list project. See validation/revision110 and RESEARCH_FOLLOWUPS.md. The original other-PC root cause remains unconfirmed. Broader acceptance/research below remains open unless explicitly qualified.

## Priority 1 - long-conversation reliability

- [ ] Diagnose the real other-PC failure: 27 completed replies, Agent B failed on request 28/50, then another failed attempt at request 29. Recover the underlying provider/runtime error where available. User confirmed available credits; context exhaustion remains suspected, not established.
- [x] Add durable compacted conversation memory plus a recent-turn window. Research a five-turn checkpoint versus size-triggered compaction; use explicit context budgets rather than assume five turns always fits. Preserve goal, decisions, disagreements, open questions, constraints and source-turn references. Retain the full original transcript separately. Record any summarisation requests and budget use.
- [x] Ensure continuation after failure/restart uses the bounded context and correct next speaker. Preserve completed replies and summaries, never silently replay an ambiguous paid request, and retain explicit user controls.
- [x] Replace generic turn failed no retry with a useful, redacted diagnosis and appropriate next action. Distinguish context limit, rate limit, authentication, timeout, connection loss and unexpected runtime failure when evidence allows. Unknown errors must remain unknown.
- [x] Improve progress and stagnation handling (conservative lexical-overlap pause, not full semantic understanding): recognise semantic repetition such as repeated agreed / proceed to validation, not just identical text. Offer a conclusion, a new direction or a pause instead of spending the remaining budget restating agreement. Keep active-agent/waiting/failure states clear.
- [ ] Validate long sessions across ChatGPT, Claude and mixed pairs, including compaction, injected instructions, Pause/Stop, failure continuation and cold reopen. Use synthetic fault tests and limited real-account acceptance; no claim of guaranteed uninterrupted provider service.

## Priority 2 - remaining product acceptance and investigation

- [ ] Real-project end-to-end acceptance: folder discovery and lightweight helpers, implementer/reviewer roles, exact review, approved application, actual build/test/repair, saved conclusions and workflow handoff. Measure correctness and missed defects against a comparable single-agent run; agreement is not verification.
- [x] Exercise the new second-opinion flow with real accounts in both provider directions; check that closing it preserves Agent A's draft, branch and continued conversation. Existing native UI tests used synthetic responses.
- [x] Complete current-release regression acceptance on this PC for saved/sidebar chats, copy into an existing/new project, 30-day bin/restore, appearance/text/font/background options and Settings scrolling. These features have fixes and local evidence already; fix only remaining/reproduced faults rather than rebuild them.
- [ ] Review portable diagnostics and backup/export/import: make another-PC results easy to bring back, retain source/version identifiers, redact secrets, and distinguish transcript copies from runnable sessions and permissions. Existing disposable-profile SQLite and whole-profile recovery tests passed; product-facing portability/retention still needs review.
- [x] Review branch-management gaps and larger-history pagination against current implementation before defining additions. Basic branching and historical reopening already work; older TODO entries must not be treated as proof that all branch menus are missing.
- [x] Research configurable helper budgets/roles and practical context savings. Same-provider lightweight helpers already exist and passed earlier real-account tests; larger helper trees and nested delegation are later work. Keep automatic conversation text-only unless a separately designed capability is deliberately added.
- [ ] Assess broader project execution beyond the current reviewed-file/Node scope: new directories, file moves/deletes, other languages/package managers, milestone completion and multiple-writer worktrees require separate designs and acceptance. Do not advertise general autonomous project completion from the calculator test.

## Priority 3 - Windows release completion

- [ ] Consolidate the separate-PC test pack results. Screenshots establish that the app ran and exchanged real replies, but do not establish every clean-install, prerequisites, upgrade, uninstall or backup/recovery check.
- [ ] Investigate intermittent older-installer launch crashes (0xC0000005, recorded for 0.4.0 and a 0.4.2 baseline). Recheck genuine version upgrades and saved-chat preservation with the next release; distinguish an installer failure from a test harness failure.
- [ ] Finish distribution qualifications: confirm bundled Claude Code redistribution/preinstallation conditions, resolve publisher-notice qualifications, retain required source/licence notices and decide publisher signing. Technical inventory/source packaging exists; legal permission and signed-public-release readiness are not established by it.
- [x] After code fixes: update How to use Hadron, test checklist, installer, corresponding source package and hashes; place the verified new executable on Desktop. Installer 0.4.10 is now on Desktop. See revision110 evidence; broader acceptance gaps remain listed above.

## Completed fixes to retain as regressions

Project monitor close/reopen; project retry/new task; additive source files and selected-folder search; milestone preload bridge; project conclusion and cross-mode drafts; copy into a new project; 30-day recycle bin; historical chat reopening; additional palettes and centralised appearance controls; Hadron-specific Settings; second-opinion modal; Settings wheel scrolling and persistent navigation; startup tagline. These are implemented, with evidence in the latest release notes. They are not all newly verified on the other PC.

## Deferred by agreement

Mac, remote access, extra primary agents and multiple-writer development remain later scope. A chess board/rules validator would be needed for a trustworthy chess feature; imagined-board conversation only demonstrates alternating messages.

## Evidence limits

The recovered other-PC user messages and screenshots are readable. Assistant messages in the connected chat were returned as unresolved content references, so this is not claimed to be a complete recovery of that chat's assistant reports. No other-PC diagnostic log has been recovered in this pass. The full installation checklist remains partly unconfirmed.
