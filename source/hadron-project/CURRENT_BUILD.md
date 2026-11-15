# Shared Claude task-deadline correction — 15 November 2026

The reported failure was a five-minute Claude tool-runner cutoff inside an admitted ten-minute shared task. Claude was still completing reads/searches one second before cancellation; the other agent's answer was saved. No provider context, usage or sign-in rejection was recorded. Local source now propagates the coordinator deadline, requests a final report near expiry, fences late operations and explains host timeouts clearly. See SHARED_TOOL_DEADLINES.md for read-only evidence, 128 automated checks, build and isolated desktop validation.

Save/copy unsent text, close Hadron and reopen through the existing Desktop shortcut to load the local renderer and host. The original failed task was not replayed and the user window was not touched. Installer 6.0.6 remains unchanged and does not include this or the preceding later continuous-input correction.

Earlier checkpoints below are historical.

---

# Continuous pasted/attached input correction — 15 November 2026

The local build corrects the legacy 4K continuous continuation limit which counted accepted text attachments, the 12K start limit, related question-anchor/journal limits and repeated prompt copies. Large supplied input can be condensed in consecutive bounded memory parts while originals stay saved. Activity and the guide explain preparation. See CONTINUOUS_INPUT_CONTEXT.md for scope and 132 automated plus full native desktop checks.

Save/copy any unsent text, close Hadron, then reopen through the existing Desktop shortcut to load the local renderer and host. The open user window was not touched. The previously delivered 6.0.6 installer is unchanged and does not contain this later correction; no installer was rebuilt in this pass.

Earlier checkpoints below are historical.

---

# Hadron Harness installer 6.0.6 — 15 November 2026

The user authorized an installer update. Hadron-Harness-6.0.6-win-x64.exe is on the Desktop and in distribution. It includes the inline branch editor, complete branch transcript browsing, provider-backed no-extra-key web research and suppression of restored-task notification replays, with updated How to use Hadron instructions.

86 automated tests, hidden branch-editor checks in all work types, production renderer/main/typechecks, packaged startup, bundled native/provider checks, installer running-app guard and 50 fresh-path NSIS probes passed. All 266 packaged compiled files match the current build. Installer integrity and all 1,959 payload names/sizes/CRC32 checks passed. The Desktop, release and distribution copies have SHA256 ca80dbd96185d267bfeee8abc0122cfbe37415ab32979ea205c304cf9b6cb93d (370,778,405 bytes).

The installer is unsigned. Close Hadron before installing. Personal chats and sign-ins are excluded from the package and retained in the existing profile on upgrade. Testing did not install over the user's current application or close its window; actual clean-PC sign-in remains an acceptance check. Source archive and private GitHub release backup accompany this release. Details: RELEASE_6_0_6.md.

Earlier checkpoints below are historical.

---

# Inline branching correction — 15 November 2026

Branch opens an editable box in place of the selected message on the left. An alternative question creates a sibling path on the right, preserving the original conversation and the unsent bottom-composer draft/files. Agent answers open blank follow-up editors. Hover and right-click actions share this behavior in all work types. 70 focused tests, isolated browser checks and the production renderer build passed. See INLINE_BRANCHING.md. Save any draft and reopen the existing desktop shortcut to load it. The installer is unchanged.

---

# Branch transcript navigation correction — 15 November 2026

The local renderer now scrolls to an earlier selected tree message without hiding the later replies on that branch. Sibling paths remain separate and the down arrow follows the displayed branch. See TREE_NAVIGATION.md for validation and context-isolation details. How to use Hadron is updated. The installer is unchanged; save any draft and reopen using the existing desktop shortcut to load this local update.

---

# Online research correction — 15 November 2026

The local source build now exposes provider-backed web search and public-page reads in individual Chat/Agent, Work together and Continuous conversation, with or without an attached folder. Claude Haiku and ChatGPT GPT-6.1-Sol passed real no-extra-key search probes. Brave remains an optional configured alternative. The setup pop-up, settings and help explain tool availability. See WEB_ACCESS.md for scope and evidence.

This is a local test-build change. The 6.0.5 installer has not been rebuilt or replaced, and the web correction has been opened through the desktop shortcut. A subsequent restored-task notification correction is prepared for the next restart. Save any unsent message, close Hadron, then use Test Hadron.cmd in the workspace for acceptance. Model/account restrictions still apply; interactive signed-in browser actions are not included.

Historical checkpoints follow.

---

# Hadron Harness Release 5.0 — 12 November 2026

The Windows x64 installer is ready on the desktop: `Hadron-Harness-5.0.0-win-x64.exe` (354 MiB). Copy this file to the USB stick for the other Windows computer. This is the installer, not the development folder. Close Hadron before installing. The app identity and saved-data location are retained for upgrades; uninstall is configured to preserve app data. This release is unsigned.

The source backup is `distribution/Hadron-Harness-5.0.0-source.zip`. The source archive has 2,107 entries and every manifest hash was verified. It excludes local accounts, saved chats, credentials and development dependencies. SHA256SUMS-5.0.0.txt records both release hashes.

Passed: production renderer/main build and typechecks, packaged SQLite/vector/keytar/PTY components, bundled Codex and Claude engines, packaged UI with temporary profile and zero model requests, startup/recovery smoke, installer in-use guard and Windows installer path regression. Real-account acceptance evidence is in test-results/2026-11-12-live-acceptance/REPORT.md. The packaged app reports version 5.0.0 and retains one composer, conversation tree, setup popup, help, themes and saved-data services.

Actual installation and upgrade of the 5.0.0 installer have not been run on this host because an existing Hadron installation is registered and the isolated-install checker protects it. A clean-PC installation test remains external. Do not describe packaged launch checks as clean installation or upgrade testing.

GitHub backup remains pending the user's own account/repository and authenticated access. The existing origin points to the original Graviton upstream and has not been used for uploading Hadron. Do not upload user data or account files.

The large Desktop/Hadron-Harness folder is the development workspace, approximately 16 GiB. About 6.5 GiB is release build output and about 5 GiB is distribution material from multiple versions. No cleanup was performed during packaging. Preserve the workspace until the new installer and backup are accepted.

Earlier checkpoints below are historical.

---

# Two-pane redesign ready for local acceptance - 10 November 2026

Desktop route/data integration, actual file tools, saved histories and transactional chat transfers are connected. The hidden desktop integration passed 100 visible continuous replies, a real disposable file edit/test, destination append and saved reload. A copied-profile audit preserved all 204 original messages without inference. Real-account acceptance remains. Close Hadron after saving drafts and use Test Hadron.cmd in Desktop/Hadron-Harness; it backs up databases and opens the new source build with the existing profile. The installed shortcut, EXE and installer remain unchanged. See REDESIGN_IMPLEMENTATION_2026-11-10.md for evidence and limits.

Earlier checkpoints below are historical.

---

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

# Release 0.4.12 delivered - 8 November 2026

Verified Desktop installer: Hadron-Harness-0.4.12-win-x64.exe (370839796 bytes).
SHA-256: 05deca65e4c3e57fa6196e664ec3a7bfbe73e2304f900d0c90a8430ee573506c
Source archive revision: 7cdb9c0d675687732d90a02cdc9c1945d9291c72; SHA-256: dcdfb2741c43dedb377e1cf17d39dbf785ca4fa090e23cb0004c029a454f427e.

Saved agent histories now open in bounded pages beyond the previous 256-job / 128-proposal rejection. Agent trees -> All workspace chats offers More saved chats and First page, with loading status. Selected ancestry remains visible and complete. Large answers reduce the page size; browsing does not start an AI request. Help explains the controls. Individual branch/context limits remain separate.

Passed: 40 focused service/HTTP/renderer tests; production renderer/main/mobile builds; actual desktop paging and full branching/shared-review/sidebar/project-copy/bin/palette regressions; final packaged startup with matching diagnostic trace and unchanged sign-in registration. The Windows native installation comparison passed install/repair, backup/recovery, interrupted-helper non-replay, saved messages and uninstall. The 0.4.11 -> 0.4.12 native upgrade passed with both saved messages retained and original shortcuts restored. These are existing-host checks, not fresh-Windows acceptance.

Direct Node installer launches still returned 0xC0000005; those failures remain recorded, alongside successful normal Windows launches. This release does not claim their underlying cause is fixed. Investigation and exact results: validation/revision112/INSTALLER_INVESTIGATION.md and artifacts.json. The source archive adds acceptance tooling after the product build cbd2bda; bundled application code is unchanged by those later records.

The Desktop USB checklist and distribution instructions are updated. Original Graviton and personal profiles were untouched; the user's running Hadron was not forcibly closed. Remaining work is tracked in REMAINING_WORK.md and TEST_FIXES_AND_RESEARCH.md.

---

# Release 0.4.11 delivered â€” 8 November 2026

The verified installer is on Desktop: Hadron-Harness-0.4.11-win-x64.exe (370851431 bytes).
SHA-256: 381ce0feb9ba2070b7429f6f499980ba9874d958f2cf8675edf59d7e41cd98d0
Corresponding source archive revision: 75933c1df6426373d19738b7aef9c0a0ebc8a366; SHA-256: 3ffcca09af0a10f7649ff585ba3d543ad13e25cb45ced948a3bce170c8ca3fdd.

The exact final installer passed installation, repair installation, saved-message preservation, backup/recovery after simulated corruption, interrupted-helper non-replay and uninstall. Original shortcuts were restored. Final packaged startup and desktop fixtures also confirm that private test launches preserve the sign-in URL handler. These checks used this existing Windows computer, not a fresh system. The intermittent earlier NSIS baseline crash remains unresolved; the repeated upgrade pass and failed attempt are both retained. Full evidence: validation/revision111/artifacts.json and installer-final-result.json.

The Desktop test checklist is updated. The running user app was not closed. Large agent-history pagination is the next implementation item.

---


Diagnostic isolation follow-up: code inspection found that diagnostic and desktop fixture launches still called setAsDefaultProtocolClient. These private test profiles now skip global OAuth-protocol registration. Both desktop and packaged checkers take read-only before/after snapshots of Hadron's own URL-handler registration, persisting equality only; the actual command is not exported. The final 40-request desktop regression and packaged startup pass with signInProtocolPreserved=true. Normal Hadron launches retain their normal protocol registration. The final program was rebuilt and repackaged with this guard; exact final installer acceptance is recorded separately.

Installer evidence: the initial 0.4.10 baseline invocation exited 0xC0000005 before installing. Direct 0.4.11 install/reinstall/backup-recovery/uninstall passed; an explicit repeated 0.4.10 -> 0.4.11 upgrade also passed with both saved messages preserved and original shortcuts restored. Retain the failed attempt as an unresolved intermittent NSIS launch problem, not a successful first attempt or a root-cause fix. Windows event/WER lookups produced no matching crash details in this pass. The final diagnostic-isolation candidate uses the same installer configuration; its final installer check is separate.

# Revision 111 - startup checkpoints and truthful saved-session status (8 November 2026)

Windows preview 0.4.11 fixes the Automatic conversation saved dropdown retaining an old running status after live polling has paused or finished the selected session. The desktop fixture checks that the saved option agrees with the actual paused state.

A lightweight diagnostic bootstrap now runs before the normal host bootstrap. In an explicit private --hadron-diagnose profile only, it records bounded, atomic startup checkpoints with a unique invocation ID: bootstrap/profile/main, instance lock, app ready, server ready, window/renderer load and terminal diagnostic state. Known startup/renderer failures and an early normal quit produce a matching failure report. Normal application launches do not enable this recorder or change their profile.

Abrupt Electron exits can bypass JavaScript exit/quit callbacks: a native test establishes this. The durable last checkpoint still remains, and the diagnostic launchers preserve the exit code and last stage when a complete report is absent. A fresh result must match the invocation trace; old success reports are not sufficient. Portable ZIPs now include startup-trace.json alongside the existing allowlisted reports/screenshots, never an account store, normal chat database or raw process log. This improves future diagnosis; it does not establish or fix the cause of the earlier unexplained startup exit or old NSIS crashes.

The Windows worker build now reuses an existing binary only when source, compiler, build recipe and binary hashes all match its manifest. This avoids rewriting an unchanged executable while it is in use. Changed builds still require compilation and never kill an active worker to gain access. The existing manifest schema stays compatible with the protected runtime. Actual Windows worker containment tests passed after the change.

Validation: four focused recorder tests; native Electron checks for abrupt exit, early quit, simulated lock refusal and successful completion; renderer/main/mobile typechecks and builds; actual desktop 40-budgeted-request memory/injection/Pause/Stop/sidebar regression and truthful saved-state label. The first native test harness incorrectly awaited app readiness at module top level; corrected to a nonblocking readiness callback before acceptance. An initial build tried to overwrite a worker still used by this pass's live test and failed; after verified reuse and the live worker's clean join, the successful build completed. Failed attempts are not counted as product passes.

A longer standalone real-account scheduler test passed 36 requests: 31 conversational replies plus five memory summaries, using ChatGPT Luna and Claude Haiku. The handover marker/rollback requirement survived, latest replies used memory, every original reply was retained, and workers ended at the chosen budget. This passes the earlier 27-reply count, but uses deliberately short checklist replies; it is not an unlimited-service or maximum-context stress claim. Prior synthetic large-history tests cover bounded long ancestry. No personal project files or original Graviton application/profile were modified.

Packaged-startup, final installer/source hashes and upgrade results are appended here once complete. The broader fresh-Windows checklist and public redistribution/signing qualifications remain open; Mac/remote work stays deferred.

---
# Release 0.4.10 delivery - 8 November 2026

Verified Desktop installer: C:\Users\rajka\Desktop\Hadron-Harness-0.4.10-win-x64.exe
Installer: 370841253 bytes; SHA-256 7e2258dd5dded50bc068d2928a6188b96ca9494129d5955413bffb92f3c96200
Corresponding source: distribution/Hadron-Harness-0.4.10-source.zip; 8081733 bytes; SHA-256 5f9509ee7257c081f4383070a4979f37d0d50aa1d319f8d53c2fd420ffb5c199
Binary build revision 0efaad43502c22811f6f35df35713ce0724abf91; source archive revision 03dae56 adds the completed acceptance scripts/records without changing the bundled program. Source archive entry hashes and ZIP integrity passed.

Conversation compaction and preserved originals, real ChatGPT/Claude memory and second-opinion checks, real mixed-provider task-list fix with three passing Node tests, and real Windows upgrade/recovery passed. Full evidence: validation/revision110. Current unresolved work: REMAINING_WORK.md and TEST_FIXES_AND_RESEARCH.md. Startup reliability and fresh-PC/licensing qualifications remain explicitly open. Research notes: RESEARCH_FOLLOWUPS.md.

---


Final release checks: packaged 0.4.10 startup passed with zero model requests. Actual 0.4.9 installation, same-version reinstall, 0.4.9 -> 0.4.10 upgrade, two saved messages retained, SQLite backup/restore after simulated corruption, interrupted helper not replayed, uninstall and original shortcut restoration all passed on this existing Windows host. This is not fresh-Windows acceptance.

The portable-report script passed and its ZIP contains only the five allowlisted report/screenshot files. One earlier diagnostic invocation exited without a report; a repeat passed. Its cause is unconfirmed and is retained as an outstanding startup reliability observation. The script now exports a failure manifest if a diagnostic exits without producing a report.

Installer and corresponding source package are built and checksummed; the verified installer is on Desktop and in distribution/clean-pc-test. Binary build revision: 0efaad43502c22811f6f35df35713ce0724abf91. Exact sizes/hashes are in validation/revision110/artifacts.json. Fully quit/reopen the development shortcut for new code; an installed copy needs the new installer. The running user app was not forcibly closed.

# Revision 110 - durable conversation compaction (8 November 2026)

Windows preview 0.4.10 adds saved AI memory for Automatic conversation. After five older completed replies accumulate (keeping two recent replies in full), the scheduler reserves a normal durable request to summarise them. Large history triggers smaller batches sooner. The full transcript is unchanged. Memory carries source reply ranges, is labelled as a lossy AI summary, and is included with recent replies in later prompts. Original goal and user messages remain explicit. A summary can omit details; it is not independent verification.

Memory generation uses the existing bound provider worker lifecycle, request/time budgets, cancellation and join requirements. It has a separate visible request kind and a compaction working indicator. Saving the completed summary and advancing memory is atomic. Failed/interrupted summaries do not replace earlier memory or become peer replies; no ambiguous request is automatically replayed. Cold continuation inherits saved memory and preserves the correct speaker. The full originals remain available in transcript/history. The limit is now labelled Maximum requests (including summaries).

Known runtime errors are mapped to redacted context-limit, rate-limit, authentication, timeout, connection or service-unavailable categories; unknown failures remain unknown. The existing narrow, bounded automatic retry for explicit ChatGPT 429/503 rejections is retained. A conservative lexical-overlap check pauses long, strongly repetitive exchanges; it does not claim to understand task completion or detect all semantic repetition. A new user direction can be added before Resume.

Validation: 25 focused service tests pass, including 100 budgeted requests, bounded large-ancestry compaction, early size triggers, durable continuation, failed summary preservation and Stop during compaction. Production renderer/main/mobile builds pass. The actual Electron fixture passes 40 budgeted synthetic requests, visible memory, full transcript retention, user injection, Pause/Stop and sidebar navigation. A separate real-account check made exactly nine requests using ChatGPT Luna and Claude Haiku: eight replies and one summary. The summary preserved the test marker and rollback constraint; the next reply received the saved memory and two recent replies. This standalone real-engine adapter uses controlled run bindings; the Electron fixture covers full desktop run-service bindings. It does not establish that the other-PC failure was definitely context exhaustion, or prove unlimited provider reliability.

The separate-PC diagnostic now exports only startup JSON, Windows version information, diagnostic screenshots and executable identity into a ZIP under the test checklist's Results folder. It does not bundle the profile, chats, databases, logs or account stores. The installer fixture accepts an explicit baseline so the current release can be upgraded from 0.4.9 without depending on the intermittently crashing older baseline.

Cold-reopen, packaged startup and install/upgrade results are recorded in this folder when completed. Earlier licence/signing qualifications and incomplete full fresh-PC checklist acceptance remain. Mac/remote work stays deferred. No original Graviton application/profile was modified.

---
# Current build checkpoint - revision 109, 8 November 2026

Windows preview 0.4.9 fixes mouse-wheel scrolling in Hadron Settings. The previous page was taller than its hidden-overflow app shell without owning a scroll area; section links could move the hidden shell while the wheel could not recover it. Settings now owns a bounded, keyboard-focusable scrolling region with a visible scrollbar. The header, section buttons, Back to workspace and new Back to top stay outside the scrolling content. Section jumps scroll only that content. A palette-aware solid Settings backdrop keeps labels readable.

The startup logo now has the exact text "Where AI's Collide" directly below it. The four-second minimum display remains. How to use Hadron and the separate-PC checklist explain the updated behaviour.

Passed: production renderer/main/mobile typechecks and builds; actual Chromium mouse-wheel down/up, visible scrollbar, persistent navigation, Setup/Appearance jumps, keyboard End and Back to top in a resized 1100x700 window with font/background options expanded; entry-logo/tagline positioning and a 4037 ms startup transition; final packaged 0.4.9 startup/native bridge/Settings scroll checks. Zero real provider requests. The clean-PC test on the user's other computer, full installed upgrade and real-account checks were not repeated here. Existing preview/licensing qualifications remain.

The final installer was copied to C:\Users\rajka\Desktop\Hadron-Harness-0.4.9-win-x64.exe, distribution and the clean-PC kit, with matching SHA-256 checks. A small Hadron-Test-Checklist folder is on the Desktop alongside it. The source archive is refreshed from revision 89717ca0d00ebe24bbc5d9abe418a65fe879081b. The user's running development app was not closed, nor were any personal profile rows or original application files modified.

Hadron-Harness-0.4.9-win-x64.exe: 370850358 bytes; SHA-256 20b247a4de25a9b9748cf4cf9588ce77a1db3e46611913d84598d178d192fe7d
Hadron-Harness-0.4.9-source.zip: 8063005 bytes; SHA-256 521c44bf82cb04347e17011739f785384302b4497581a04a6cec443a928e4771
