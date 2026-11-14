# Revision 111 - startup checkpoints and truthful saved-session status (8 November 2026)

Windows preview 0.4.11 fixes the Automatic conversation saved dropdown retaining an old running status after live polling has paused or finished the selected session. The desktop fixture checks that the saved option agrees with the actual paused state.

A lightweight diagnostic bootstrap now runs before the normal host bootstrap. In an explicit private --hadron-diagnose profile only, it records bounded, atomic startup checkpoints with a unique invocation ID: bootstrap/profile/main, instance lock, app ready, server ready, window/renderer load and terminal diagnostic state. Known startup/renderer failures and an early normal quit produce a matching failure report. Normal application launches do not enable this recorder or change their profile.

Abrupt Electron exits can bypass JavaScript exit/quit callbacks: a native test establishes this. The durable last checkpoint still remains, and the diagnostic launchers preserve the exit code and last stage when a complete report is absent. A fresh result must match the invocation trace; old success reports are not sufficient. Portable ZIPs now include startup-trace.json alongside the existing allowlisted reports/screenshots, never an account store, normal chat database or raw process log. This improves future diagnosis; it does not establish or fix the cause of the earlier unexplained startup exit or old NSIS crashes.

The Windows worker build now reuses an existing binary only when source, compiler, build recipe and binary hashes all match its manifest. This avoids rewriting an unchanged executable while it is in use. Changed builds still require compilation and never kill an active worker to gain access. The existing manifest schema stays compatible with the protected runtime. Actual Windows worker containment tests passed after the change.

Validation: four focused recorder tests; native Electron checks for abrupt exit, early quit, simulated lock refusal and successful completion; renderer/main/mobile typechecks and builds; actual desktop 40-budgeted-request memory/injection/Pause/Stop/sidebar regression and truthful saved-state label. The first native test harness incorrectly awaited app readiness at module top level; corrected to a nonblocking readiness callback before acceptance. An initial build tried to overwrite a worker still used by this pass's live test and failed; after verified reuse and the live worker's clean join, the successful build completed. Failed attempts are not counted as product passes.

A longer standalone real-account scheduler test passed 36 requests: 31 conversational replies plus five memory summaries, using ChatGPT Luna and Claude Haiku. The handover marker/rollback requirement survived, latest replies used memory, every original reply was retained, and workers ended at the chosen budget. This passes the earlier 27-reply count, but uses deliberately short checklist replies; it is not an unlimited-service or maximum-context stress claim. Prior synthetic large-history tests cover bounded long ancestry. No personal project files or original Graviton application/profile were modified.

Packaged-startup, final installer/source hashes and upgrade results are appended here once complete. The broader fresh-Windows checklist and public redistribution/signing qualifications remain open; Mac/remote work stays deferred.

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
# Current consolidated action list - 8 November 2026

See TEST_FIXES_AND_RESEARCH.md for the prioritised fixes and research after the other-PC test. Long-conversation failures, bounded compaction, useful failure diagnostics and repetitive agent exchanges are the first priorities. Older unchecked boxes below are historical and may already be completed.

# Revision 109 - Settings scrolling, startup tagline and Desktop installer (2026-11-08)

Windows preview 0.4.9 fixes mouse-wheel scrolling in Hadron Settings. The previous page was taller than its hidden-overflow app shell without owning a scroll area; section links could move the hidden shell while the wheel could not recover it. Settings now owns a bounded, keyboard-focusable scrolling region with a visible scrollbar. The header, section buttons, Back to workspace and new Back to top stay outside the scrolling content. Section jumps scroll only that content. A palette-aware solid Settings backdrop keeps labels readable.

The startup logo now has the exact text "Where AI's Collide" directly below it. The four-second minimum display remains. How to use Hadron and the separate-PC checklist explain the updated behaviour.

Passed: production renderer/main/mobile typechecks and builds; actual Chromium mouse-wheel down/up, visible scrollbar, persistent navigation, Setup/Appearance jumps, keyboard End and Back to top in a resized 1100x700 window with font/background options expanded; entry-logo/tagline positioning and a 4037 ms startup transition; final packaged 0.4.9 startup/native bridge/Settings scroll checks. Zero real provider requests. The clean-PC test on the user's other computer, full installed upgrade and real-account checks were not repeated here. Existing preview/licensing qualifications remain.

The final installer was copied to C:\Users\rajka\Desktop\Hadron-Harness-0.4.9-win-x64.exe, distribution and the clean-PC kit, with matching SHA-256 checks. A small Hadron-Test-Checklist folder is on the Desktop alongside it. The source archive is refreshed from revision 89717ca0d00ebe24bbc5d9abe418a65fe879081b. The user's running development app was not closed, nor were any personal profile rows or original application files modified.

Hadron-Harness-0.4.9-win-x64.exe: 370850358 bytes; SHA-256 20b247a4de25a9b9748cf4cf9588ce77a1db3e46611913d84598d178d192fe7d
Hadron-Harness-0.4.9-source.zip: 8063005 bytes; SHA-256 521c44bf82cb04347e17011739f785384302b4497581a04a6cec443a928e4771

# Revision 108 - Hadron Settings and quick second opinions (2026-11-08)

Windows preview 0.4.8 replaces inherited desktop Settings with five actual Hadron groups: Appearance, Connections, Agents and tools, Saved data, and Setup. Inapplicable Chat/Agent prompt modes, legacy providers/defaults, memory/LM Studio, context/timeouts, HTML cache, browser DevTools, remote access and ownership migration controls are absent. The legacy component never mounts in Hadron. Actual subscription controls, bounded helper preference, tool library, optional secure Brave Search key, 30-day Recycle Bin and local setup checks remain. No stored accounts, preferences or chats were deleted.

Appearance groups palette, light/dark/system mode, automatic/high-contrast/custom workspace text colours, fonts and backgrounds. The right-pane palette dropdown is removed. Display mode now follows subsequent system changes. Uploading a video selects video mode; resetting restores actual backdrop colours; asynchronous gallery removals are awaited and failures surfaced. The inherited giant theme editor for unused widgets is not exposed. Detailed decisions: SETTINGS_REVIEW.md.

Independent jobs now offer Get a second opinion beside a completed answer. A modal asks the other agent for a brief text evaluation, shows a working indicator, saves it separately and closes back to the original agent without changing its draft or branch. Opening/reopening does not dispatch inference; review recovery identities are separate from the other agent's normal job. Only a bounded, explicitly excerpted text snapshot is shared; no sibling chats, attached files or tool/folder authority. This is not independent verification or an instruction to implement changes.

Passed: 14 focused renderer/controller tests; renderer/main/mobile typechecks and production builds; a native Settings audit including palette/text/display persistence, actual helper preference, library read, secure-key status/form without secret writes, 30-day bin, setup, font validation/application and backdrop reset; a separate actual modal test with two synthetic requests confirming waiting status, original draft/branch retention and no resend on reopen; packaged 0.4.8 startup/Settings/native-bridge checks. Paid provider calls, live search/credential writes, full installed-upgrade and separate clean-PC testing were not repeated. Earlier release qualifications remain.

Installer, source archive, How to use Hadron and clean-PC kit are updated. Source revision: 59192e78d3d65ae74346443a3cdc0bb2e2d3fac3. Tests used private fixture profiles; the user's app was not forcibly closed. Completely quit and reopen the development shortcut, or install the new executable for an installed copy.

Hadron-Harness-0.4.8-win-x64.exe: 370850170 bytes; SHA-256 f99872774da2e49515b9dc26846d22124906e18350cf5a3bb1e2665083283205
Hadron-Harness-0.4.8-source.zip: 8059610 bytes; SHA-256 1f2748a1009ef370beb2ab5f3498d36c8e5915e562c580875d44fdabc9b2bc0a

# Revision 107 - historical saved chat reopening (2026-11-08)

Windows preview 0.4.7 fixes older sidebar proposal chats failing to reopen when their original agent-session records are absent. The saved messages remain available and now open in Main chat with a historical-session notice. Existing intact session/branch navigation is retained; old jobs are never recreated or replayed.

A read-only check of the Hadron development profile accepted all 48 conversations: 34 normal and 14 historical-only, zero failed. No personal chat rows were modified. Root cause was the reopening code requiring an old session ledger even to read retained owned messages. Hash/owner checks and denials for foreign, forged or unfinished records remain.

Passed: 3 focused server authorization/history tests, 8 client tests, production renderer/main/typechecks, actual native desktop missing-ledger history display in the left chat pane with zero model requests, and final packaged 0.4.7 startup with native IPC/palette checks. The unrelated broad synthetic job run timed out in its early Clarify A flow and was not counted as passing. Clean-PC/full installed-upgrade checks were not repeated. Existing release qualifications remain.

Installer, source archive, hashes and test-pack executable are refreshed. Source revision: 56c27328f55a25db3794a69072b6a3970869dc66. Completely quit and reopen the development shortcut; for the installed application use the new installer. No user data migration or original Graviton changes. Unsigned-preview/licensing qualifications remain.

Hadron-Harness-0.4.7-win-x64.exe: 370837122 bytes; SHA-256 e349b8ee540e304adb9415a56d9e4fb4c88ca6b599c2fcd0810c11e2d2005a33
Hadron-Harness-0.4.7-source.zip: 8038933 bytes; SHA-256 624c9d45cec36659ba824b024d14e0b11ffb688ed809650fd90aa940c0fad5c6

---

# Revision 106 - new-project copy, recycle bin and colour palettes (2026-11-08)

Windows preview 0.4.6 adds Create new project to Copy into project, a recoverable Hadron Recycle Bin for local projects/chats, and four additional Hadron colour palettes. Source revision: 7714b5a679a56536c9d9ddedfddfad915bdad7e0. Local Git only.

Copying can create a named local project and reference conversation atomically; failures roll back and matching retries do not duplicate it. The original stays saved, and copying starts no AI request. Help and the separate-PC checklist explain the option.

Deleting a local sidebar project/chat now moves it to Hadron's Recycle Bin for 30 days. Restore is available in the expanded left Projects pane. Project restoration preserves chats; separately deleted chats stay in the bin. Duplicate deletes do not extend retention. Expired items cannot be restored. Cleanup runs at startup, hourly and on bin list/restore; if Hadron is closed, expiry is processed when it next starts. Normal lists/searches exclude recycled items, and startup does not reopen them. External folder files are unaffected. This is not secure erasure of historical diagnostics or backups; previously permanent deletions cannot be reconstructed by this feature.

Hadron colours is available in the right-pane header and Settings theme controls: Hadron Violet, Cream & Honey, Cocoa & Caramel, Rose Red, Ocean Blue. Palettes persist locally and affect shared pane/button tokens, with matching dark surfaces. Selecting an advanced custom theme clears the palette override; old theme files remain available. How to use Hadron explains both colours and recovery.

Passed: 10 focused storage/retention tests and 8 renderer tests, Electron/mobile typechecks, renderer/main production builds, full actual desktop fixture for copy/new-project/restore/colours and existing agent branches/reviews/history, and final packaged 0.4.6 startup with actual recycle-bin IPC and five palette options. All provider transport was synthetic; zero paid requests. No personal project folders, accounts, chats or original Graviton were changed by validation. Full clean-PC/installed-upgrade checks were not repeated; prior qualifications remain.

Installer, source archive, hashes and clean-PC pack are refreshed. Completely quit/reopen the development shortcut, or install the new .exe for the installed release. A renderer refresh alone cannot replace the updated host/preload. Installed and development profiles remain separate. Unsigned-preview/licensing qualifications remain.

Hadron-Harness-0.4.6-win-x64.exe: 370837583 bytes; SHA-256 5858e44d56108d17540e18db39b3439bd0b6ceb8485781cab6be7a3bb1762856
Hadron-Harness-0.4.6-source.zip: 8036188 bytes; SHA-256 cb9a697361cfa4a8a93dbace98f974a8fc73be2b29c88a0a9c10a6956354dc2b

---

# Revision 105 - project conclusion and workflow handoffs (2026-11-08)

Windows preview 0.4.5 adds Project conclusion at the top of the project result and a matching middle-pane shortcut. It shows the saved goal, Agent A recommendation, Agent B review, actual file/check states and next step. It distinguishes reviewed proposals from applied changes, passing checks and user acceptance.

Continue in another workflow creates an editable draft for Work together or either independent agent. Main chat appends to its existing draft/branch. Only bounded summary text crosses modes; no files, folder grants, tools or approvals transfer. Existing unsent agent drafts require confirmation; active/uncertain jobs retain their admission guards. Nothing sends until the user presses Start or Send. The original proposal stays saved. Help and PROJECT_CONCLUSIONS.md explain the flow.

Passed: seven focused renderer tests, Electron/mobile typechecks, production renderer/main builds, full desktop four-destination handoff/history/retry/source/monitor fixture, and final packaged 0.4.5 native/provider startup with actual milestone IPC. Synthetic provider transport only; zero paid requests. Test fixture form changes now flush before Prepare to avoid a timing race; two concurrent-packaging runs had timed out at Stop before this fixture adjustment. Personal projects/profiles and original Graviton were untouched.

Installer and source package are refreshed. Source revision: c61f03d36eff924fa06091c06c7ec4816b579e9f. No fresh installed-upgrade or separate clean-PC run was claimed for this renderer change; prior qualifications, unsigned-preview status and licensing qualifications remain. Completely quit and reopen the development shortcut for the new UI, or install the updated .exe for the installed release. The two Hadron profiles remain separate.

Hadron-Harness-0.4.5-win-x64.exe: 370843419 bytes; SHA-256 dc20ffb76b6fc0ebca162fdb78fc3a0f7cd9b2ae232612e89953b253b3ac5493
Hadron-Harness-0.4.5-source.zip: 8022722 bytes; SHA-256 ccbdf850c4d051546aae7db9638e1a46a24a9701cf68666c890329269b1b4213


---

## Revision104 - milestone desktop bridge fix (2026-11-08)

Windows preview 0.4.4 fixes the reported we.milestones is not a function error. Source revision: 8257110e45d648b698bd865d0e89430ac46e0240. Local Git only.

Root cause: electron/preload.ts omitted milestones, accept and nextMilestone, although the renderer/shared API and host handlers already used them. Added the three IPC forwards and a static satisfies ProjectDraftApi check so future omissions fail Electron typechecking. A compiled-real-preload regression checks method availability and exact IPC arguments. The project screen reports a clear full-restart instruction when an old bridge remains loaded.

Passed: regression test, Electron/mobile typechecks, renderer/main builds, actual desktop folder search/read/review using real milestone IPC, final packaged 0.4.4 native/provider checks and actual milestone-list IPC. Packaged report requires projectBridgeReady=true. New tests used synthetic model transport with zero paid requests. No personal chats, project files, credentials or original Graviton were changed.

Installer/source are built and checksummed; clean-PC and version-upgrade reliability qualifications remain as recorded in revision103. This hotfix rechecked the final unpacked packaged application, not a new full installed upgrade cycle. Prior 0.4.3 install/reinstall/recovery evidence remains available.

Hadron-Harness-0.4.4-win-x64.exe: 370831551 bytes; SHA-256 8e29c2bb39c0cadb7bdf05a77b9efbe9eecf46cf8efb88a367a56f14ce8ba5b0
Hadron-Harness-0.4.4-source.zip: 8014680 bytes; SHA-256 e95a947b70d1d7d478d3783bf4198b533b96d602f2ff9b290f7c3618eaea0a63

Quit Hadron completely and reopen to load the new preload; refreshing the renderer alone cannot replace it. The 0.4.4 installer and separate-PC test pack are refreshed. Installed and development profiles remain separate. Existing licensing/signing qualifications remain.

---
## Revision103 - folder search and lightweight scanning helpers (2026-11-08)

Windows preview 0.4.3 adds folder search and same-provider lightweight scanning helpers. Source revision: 2b08b082c2fedaa093f5c264d6547fdf2397733c. Local Git only.

Build a project -> Choose project folder -> leave folder search enabled -> select A/B providers/models -> describe goal/plan/deliverables -> Prepare proposal. Individual source-file picks are optional hints. Agent A can recursively search/list/read relevant files and use helper_search/helper_read for bounded lightweight analysis; Agent B independently reviews the frozen original files and exact changes. The folder is used in place, not copied. Existing file replacement requires a frozen read, not merely a search hit. File writes and tests still require the existing approvals.

Project folder activity is visible on the left, including Relevant files found. Help describes the new mode. Existing monitor close/reopen and project retry controls remain.

Limits: each search scans up to 2000 entries / 100 content files / 8 MiB with bounded matches; reports truncation and skips generated/dependency folders, links and common credentials. Narrow tasks/subfolders when needed. Cumulative frozen context remains 20 files / 128 KiB. Folder proposals/reviews allow up to 18 parent requests plus two Agent A lightweight helpers, same provider, no nested child tools or writes. Global helper opt-out remains effective. Automatic build/test/fix repairs disable extra exploration/helpers to retain the existing approved model budget.

Passed: 100 focused server tests, 37 tool protocol/library tests, 9 focused renderer tests, main/renderer builds, actual desktop folder-only nested search/read/review with no manual file selections, manual-file/retry/monitor/history regression and clean Stop/Quit joining workers. Protected-engine folder tests cover both provider admissions. New model transports were synthetic; no new paid calls or personal project changes. Final packaged 0.4.3 startup/native/provider checks passed. Installer upgrade result is recorded below once complete.

Hadron-Harness-0.4.3-win-x64.exe: 370831638 bytes; SHA-256 e3ae5bade9b90ffabc53e3691788188328582cc939c522111e560ccc65b26018
Hadron-Harness-0.4.3-source.zip: 8013137 bytes; SHA-256 5e39ee7b26618e06829cc4c114dfe0b3b4309840a8eb5009d054886aca43c72c

Separate clean-PC acceptance remains pending. The test pack is refreshed to 0.4.3. Installed/development profiles remain separate. Existing licensing qualifications and unsigned status remain. Original Graviton and personal accounts/chats were not modified.

---
## Revision102 - project retry and monitor closure (2026-11-08)

Windows preview 0.4.2 fixes project retry/new-task visibility and floating-agent monitor closure. Source revision: 652fc9f30274d58881ff3a2269f56d806eb3f339. Local Git only.

Use X to close the monitor completely; Agent monitor in the top bar reopens it. Minimize keeps the compact pill. Jobs continue independently of this viewer.

Project setup/results now offer Try again and New project task at the top. Try again keeps the goal, plan, deliverables, models and files. New task clears the goal/deliverables with a keep-files option; Choose project can select another folder. Prepare proposal explicitly submits the edited form. Saved failures remain in history. Failed-task polling continues until actual worker termination; host recovery/ownership guards remain enforced.

Passed: 19 focused renderer tests, renderer/main builds, actual desktop monitor close/reopen/minimize and failed empty-proposal retry/new-task/file-selection/Stop/history flow. Clean Quit joined workers and released execution. Final packaged startup (version 0.4.2), native modules and both provider engines passed. Fixtures used no paid requests. Installation/upgrade recheck recorded separately when complete.

Hadron-Harness-0.4.2-win-x64.exe: 370828700 bytes; SHA-256 e9f5b7ef9b16763ee36421a1747f131d4c889adc0376ac4edd270ae1618e25e1
Hadron-Harness-0.4.2-source.zip: 8007716 bytes; SHA-256 4fa231ce08dbd23149c266cc37a35cce7c995d22b4b0187f51aa27417bb45ac4

Separate clean-PC test remains pending with the user. The test-pack folder contains the new installer. Existing installed and development profiles remain separate; no chat/account migration was added. Prior live helper/recovery evidence remains in revision101. Public-release licensing qualifications and unsigned status remain unchanged. Original Graviton and personal project/account files were not modified.

---
## Revision101 - release validation and separate-PC test pack (2026-11-08)

Windows preview 0.4.1 is packaged. Source revision: 7a903e587a29015ab2a5a616cdb4312786001afb. Local Git only, no public upload.

Installer: distribution/Hadron-Harness-0.4.1-win-x64.exe (370828255 bytes).
SHA-256: 43fed88af55341e7b8d3ae5b58a624cb8a52e16f3be3905059151f10562fcf3c
Source: distribution/Hadron-Harness-0.4.1-source.zip (1,968 entries, CRC and individual SHA-256 hashes verified).
SHA-256: da63f7262f94c5475cc41307d957f057f22c260a517312375b97a67df1d38662

Passed: live ChatGPT Sol/Luna and Claude Sonnet/Haiku helpers (six successful physical requests); actual existing-host installation, same-version reinstall, 0.4.0 -> 0.4.1 upgrade, two saved synthetic messages preserved, SQLite backup/restore after simulated corruption, interrupted helper without replay, whole disposable profile recovery, uninstall/shortcut restoration. Packaged native modules/provider engines and final startup diagnostic passed. Full earlier regressions: 559 server, 894 headless, 1182 renderer, six helper tests; 24 additional recovery tests passed.

Source archive, build guide and 593-package notice inventory supplied. Two publisher licence-text provenance qualifications are documented. Claude Code product/preinstallation conditions need confirmation before public redistribution. Installer unsigned. The older 0.4.0 installer crashed again before installation during the final repeat check; earlier upgrade runs passed; separate-PC reliability testing remains necessary.

Next: user will run distribution/clean-pc-test on their separate Windows PC. This is not claimed passed. No Node, Electron or VS Code installation is required for Hadron itself. See REMAINING_WORK.md and RELEASE_VALIDATION.md for limits. Original Graviton and personal accounts/chats were not modified. Installed and development Hadron profiles remain separate.

---
## Revision100 - explicit Copy into project help (2026-11-07)

Added a prominent Copy into project topic to How to use Hadron, with four ordered arrow steps, location of the actual command, destination selection and precise text-only/128 KiB limitations. Renderer build and built mixed desktop help/jobs/copy acceptance passed. Refreshed the Windows preview installer. Added REMAINING_WORK.md as a current prioritised checklist so historical unchecked TODO entries are not confused with current state. User subsequently authorised the listed release-validation work; proceed autonomously without altering their personal projects/accounts.

---
## Revision99 - helpers, milestones, reference copies and Windows release (2026-11-07)

Implemented Copy into project across saved main, independent, collaborative, automatic and project modes. Copies create ordinary historical text chats in owned local projects, preserve originals, are idempotent and bounded to 128 KiB, and transfer no active jobs, attachments, authority or approvals. Added same-provider known-lightweight helpers with a durable two-helper agent/job budget, one-level delegation, parent-linked visible activity/history and Markdown checkpoints. Parent Stop aborts/joins children; restart marks unfinished work interrupted without replay. Automatic conversation remains text only; automatic repair stages disable helpers to preserve existing approval budgets.

Project proposals can include safe nested new files/folders, created only on reviewed application. Added explicit milestone deliverable acceptance, test/build gates and preparation of the next milestone without inference. A complete small Node project with nested source/tests was created and tested by the host fixture. Mixed desktop build/test/fix fixture demonstrated a real failing test, independently reviewed repair, then passing test and build.

Removed the Electron remote title-bar button, gated inherited marketing/legal routes, disabled upstream cloud auth configuration in Hadron builds and blocked upstream app domains in external launch. Larger centered project title added. Help includes optional setup inventory and official optional download links; Electron/Node, provider engines, worker controller and tool capability are bundled. No changes to original Graviton, user chats, credentials or running user app.

Regressions passed: 559 server tests, 894 headless tests, 1182 renderer tests; six focused helper tests passed including cancellation/join and restart. Actual built UI fixtures passed mixed jobs/branches/reopen/help/reference copying (zero navigation inference), both same-provider helper children and the real Node repair cycle. Provider fixture output is synthetic, not fresh paid acceptance. Electron/main/mobile and server typechecks passed.

Windows NSIS packaging now verifies target native SQLite/vector, keytar and PTY dependencies, includes curated hoisted runtime packages and both pinned vendor binaries, and probes packaged native modules plus vendor versions before installer creation. Missing VS Spectre libraries were avoided using the working official PTY prebuild. Windows signing-tool cache was extracted without irrelevant macOS symlinks; no OS developer-mode setting was changed. Release is unsigned. Final artifact/evidence checkpoint: CURRENT_BUILD.md and WINDOWS_RELEASE.md. Installed and development profiles remain separate; no automatic profile/account migration.

Deferred: Mac, remote access, extra providers/primary agents, arbitrary language/package/shell runners, configurable helper roles/budgets and fresh paid-model release acceptance. Do not describe this as unlimited autonomous all-language coding. The installer has not been installed into the user's active profile.

---
## Revision98 - Claude across Hadron modes and visual help guide (2026-11-07)

User accepted mixed Automatic conversation and authorized Claude in Work together, Independent jobs and Build a project. Implemented shared ChatGPT/Claude provider selection, strict provider-specific model admission and provider-preserving execution, reviews, branch history and journals. Independent jobs now send the selected provider instead of hard-coding ChatGPT. Shared proposal/review/synthesis use each frozen participant's provider; verifier and final use Agent A's selection. Project configurations optionally persist providers per role; legacy configurations without the field retain ChatGPT semantics and unchanged serialized hashes. A proposes, B reviews, and the existing coordinator still owns approved file application/tests/repair.

Claude CLI stays restricted, text-only and without native tools. Trusted Hadron tool sessions now use the same bounded text/JSON broker as ChatGPT: the host executes only the admitted web/project/custom-tool capability, returns evidence to subsequent text requests, and stops within the existing request budget. Untrusted cloned capabilities reject. Cancellation/shutdown abort and join broker jobs and owned native captures. No automatic provider fallback, new account storage or installed Graviton dependency was introduced.

Added How to use Hadron beside Collapse in the workspace header. The accessible modal has four mode choices, a numbered arrow flowchart for each, steps for saved work/branching/connections/tools, and buttons that open the selected mode. In-page flowchart navigation does not change the app route or dispatch inference. Native modal focus/escape behavior is used. User clarified each agent and asked why helpers were unavailable: inherited sub-agent run infrastructure remains, but delegation is explicitly disabled in A/B jobs. New SUBAGENT_PLAN.md records optional per-agent helpers, ownership/budgets, visible activity, cancellation and no-replay restart work; no helpers are enabled in this increment.

Validation: server typecheck, renderer build, Electron/main/mobile build pass. 59 focused runtime/routing/collaboration/independent tests, 99 project/build/tool-protocol tests and 79 renderer collaboration tests pass (237). New cases cover mixed providers through reviews/synthesis/journals, separate Claude admission, exact project review, and trusted Claude host-tool protocol with native tools still absent. Built disposable desktop UI ran mixed independent jobs and shared collaboration/follow-ups, with 4 actual native Claude-adapter calls to synthetic inference, help flowchart/navigation checks and zero inference when reopening views. Mixed project UI proposed/reviewed, stopped, inspected diffs and reopened saved proposals; cold restart made zero provider requests. No real paid inference was repeated; previous actual subscription generation was already accepted by the user. Evidence: validation/revision98. Models remain official Sonnet/Haiku/Opus aliases; account limits remain vendor-controlled.

Next user action: quit/reopen Hadron to load the new main/renderer. In any mode choose each agent's provider/model (either can be Claude). How to use Hadron opens the guide. Next implementation item: per-agent sub-agent support per SUBAGENT_PLAN.md, after this increment's user acceptance. Mac remains deferred. No user chat/project data or installed Graviton profile was changed by these fixture tests.

---
## Revision97 - reopen saved agent conversations from the sidebar (2026-11-07)

User reported losing the automatic chat when opening the project/sidebar view, and could not find it in the sidebar. Read-only inspection confirmed their latest paused session still had 6 completed replies; prior stopped/failed sessions retained 16/50 completed replies. The sidebar indexed the containing ordinary chat (testing project Conversation), while automatic transcripts live in the separate Hadron continuous-session store. No chat data was deleted or repaired in this pass.

Added saved automatic conversation task links beneath each local workspace chat and in its hover preview. Links show goal, saved state and a short session identifier, so identical goals can be distinguished. Clicking selects the containing chat, opens the agent dock and Conversation view, and loads the exact saved session using workspace-checked read-only IPC. Repeated selection within the same workspace is supported. Route state carries navigation only; opening does not resume, replay, continue or dispatch a model. Selection remains remembered for the next launch. Existing project/individual/shared modes retain their behavior; other saved task types are not newly indexed by this feature.

Validation: renderer build and 43 focused chat-selection/workspace tests passed. Built desktop fixture exchanged 40 synthetic mixed-provider turns, exercised Pause/Stop, switched from Independent jobs to a saved 40-reply conversation through the actual sidebar, then selected the 2-reply conversation in the same workspace. Request-count assertion remained 43 (no navigation inference). Cold reopen restored the selected conversation with zero requests. No real provider calls or personal database mutations. Evidence: validation/revision97.

The user's fuzzy screen border/mouse glow cleared after resetting the computer-control session. No Windows display settings were changed. Screen control is left off. Their already-running app has not been force-reloaded or closed; the rebuilt renderer is ready for their next reopen. To recover their view: sidebar -> testing project -> testing project Conversation -> Agent conversations -> choose the paused saved task. Inspection alone is safe; use Continue this saved conversation only when they want new replies.

Next: user verifies their actual saved task via the new sidebar link and accepts Claude model selection/mixed conversation. Continue Windows MVP work in order; Claude in other modes and later project autonomy remain pending. No installed Graviton program/profile was accessed or changed in this increment.

---
## Revision96 - Claude subscription in Automatic conversation (2026-11-07)

User confirmed saved continuation works, then connected Claude via their Google-login subscription and requested Claude model selection. Read-only official status confirmed Hadron's own Claude profile connected with authMethod claude.ai. Implemented separate per-agent Provider and Model selectors in Automatic conversation: ChatGPT plus Claude subscription, with Claude Sonnet/Haiku/Opus aliases. Provider and model are frozen per role, persisted, checked at admission/run binding and displayed in the transcript. Saved continuation can explicitly switch either role's provider/model. Older sessions without providers keep their original ChatGPT meaning.

Scope: Claude is enabled for Automatic conversation only. Work together, Independent jobs and Build a project keep their existing ChatGPT-only admission. Do not claim all Claude modes or project coding are finished. Next: user accepts mixed native UI, then extend the proven runtime to the other modes with provider-aware config/history/reviews and model admission, in order.

Official Claude Code2.1.318 now has contained Windows text generation. Uses safe-mode (not bare, which explicitly disables subscription OAuth), restricted mode, empty tools, deny-all tool rules, strict empty MCP, disabled skills/Chrome/persistence, fixed model aliases and one CLI turn. Only completed text with no tool-bearing frames, empty tool/MCP init and no permission denials is published. Unknown/error/incomplete results do not get a host retry or ChatGPT fallback. Native Windows job containment and actual close join apply to status/login/generation; Quit cancels and joins both runtimes. Private account/profile remain separate; credentials are handled by the vendor runtime, not read/copied by Hadron. This is tool-free execution, not an OS filesystem sandbox. Alias versions and subscription quotas remain vendor-controlled; Opus was not exercised live.

Validation:24 focused conversation/bridge tests,15 Claude-runtime/provider-router tests and52 existing subagent tests pass (91 total). Renderer/main/mobile builds and server typecheck pass. Built three-pane synthetic desktop fixture exchanged40 mixed turns, asserting21 actual calls through the native Claude adapter, exercised model selection, Pause/Stop and cold reopen with zero inference. Screenshot inspected. These fixture responses are synthetic.

Real-account acceptance: Claude Haiku independently returned the exact connection-check reply, native exit0/tools0/joined. A separate real scheduler/native-engine run used GPT-6-Luna then Claude Sonnet for2 subscription jobs, with the first reply included in the second prompt and quoted by Claude. Both completed and joined; no personal project edits or sign-in/out. Standalone live adapter run IDs are controlled test bindings; actual durable subagent bindings are covered by the built desktop fixture. Explicit live scripts require --run-live and an idle Hadron scope. One earlier bare-mode attempt failed before usable subscription auth and was corrected, not counted as a successful test. Evidence:validation/revision96; details:CLAUDE_SUBSCRIPTION.md.

User next action: fully quit/reopen, Automatic conversation -> Continue this saved conversation (or New conversation), choose Agent A ChatGPT/model and Agent B Claude subscription/model, choose a short initial turn budget and Start. Subscriptions remain signed in. Mac remains deferred. No installed Graviton or its profile was accessed/changed in this increment.

---
## Revision95 - continue a saved automatic conversation (2026-11-07)

User asked to continue the task after closing Hadron. Implemented the native Continue this saved conversation action, followed by an optional next-direction field, fresh model/request/time choices and Start continuation. It explicitly creates a new session carrying frozen completed A/B replies and user messages, while leaving the original session and actual old run bindings unchanged. Original failed/pending requests are not replayed or adopted. Opening saved work alone still sends no requests. Inherited replies have cards in both transcript and middle turn view. Current-session explicit Resume remains separate.

Host derives owner, original workspace/anchor/goal and ancestry from the owned saved record. New model choices are checked. New session, flattened context snapshot and optional next instruction are committed atomically before any dispatch. Repeated continuation IDs with identical configuration only return the existing child; changed inputs are refused. Live source workers must settle first. Completed ancestry determines the next speaker; failed attempts do not count as replies. Continuation chains retain earlier completed ancestry and user directions. Oversized history is refused before generation without silent truncation; the64KiB prompt limit remains. Each continuation gets fresh bounded requests/time, no inherited tools or execution rights, and job logs identify its source session.

Validated22 focused server/bridge tests (15 conversation,7 bridge), renderer/main/mobile builds and server typecheck. Built native desktop cold-open test explicitly continued2 saved replies into2 fresh synthetic replies and displayed all4 turn cards. A second cold reopen restored inherited history and new replies with zero inference. Screenshots inspected. Synthetic tests consume no provider inference; no actual account sign-in or real conversation requests were made in this pass.

Claude update: user now has a Claude subscription via their Google login and is ready to connect. Both fresh isolated readiness probe and a sanitized status probe of Hadron's own profile report bundled Claude Code2.1.318 installed; Hadron profile is signed_out. Browser Claude login does not by itself connect Hadron's separate official runtime profile. Connect Claude exists; actual browser authentication requires the user. Subscription job generation/admission for Claude is not yet implemented, so do not claim that Claude can already execute A/B jobs. Next: user connects the subscription, then implement/validate contained tool-free Claude inference and mixed-provider admission in order. No API key required for the intended subscription route. Installed Graviton and its profile were not accessed or changed.

---
## Revision94 - live acceptance and conversation recovery (2026-11-07)

User screenshots confirm a real A proposal/B exact review and native-approved README application (Replacement: applied; Files changed: yes). Their automatic conversation then completed 50 real replies; request51 failed. Read-only inspection of Hadron's last-job-diagnostic.json identified upstream_http_503, one request, incomplete response. This was a temporary provider rejection, not the context cap (the frozen prompt was24378 characters).

Changes: animated working indicator, observed elapsed seconds and active-agent/stage labels for conversation/project work. Failed or historical empty turns no longer misleadingly say Waiting. Failed status polling replaces animation with a stale-status warning. No claim of token progress or actual model thinking is made.

Conversation recovery: only exact host-generated classifications of explicit HTTP429/503 rejections, with one request and no output/completion, allow automatic fresh attempts. The previous actual worker must join first. Up to two fresh attempts per consecutive failure sequence and six scheduled recoveries per conversation, within the configured100-request/time limits; backoff3s then6s, Stop cancels it. Each attempt gets its own durable ordinal/run binding and error code. Failed attempts remain visible but do not enter peer reply history or advance the A/B speaker. Unknown transport failures do not auto retry. Current-host joined failed sessions offer explicit Continue after failure; historical sessions remain inspection-only.

Limits remain: no guarantee of uninterrupted provider service; context cap pauses without silent truncation; exact-text repetition detection does not detect semantically repetitive paraphrases (seen in the live50-turn run). Better convergence/stagnation detection and fresh historical continuation remain TODO. Automatic conversation remains text-only. Agent A proposes project code/fixes, Agent B reviews, and Hadron applies/runs selected checks through host approval.

Validation results are recorded in validation/revision94. Installed Graviton was not accessed or modified in this pass.

---

Validated:35 focused server tests, project renderer check, renderer/main/mobile builds and server typecheck passed. Built desktop synthetic generation exchanged40 turns, confirmed active-agent spinner/elapsed time and no stale Waiting text after Stop; no real provider requests were spent in this pass. The user's50-turn run was real, distinct from synthetic validation.

## Current state - revision93 (2026-11-07)

The user explicitly prioritised reviewed file application, builds/tests with a repair loop, and automatic back-and-forth conversation, with Mac deferred and testing performed autonomously. These features now have native desktop implementations for the supported Windows/Node scope. This section supersedes earlier statements that all canonical application or all automatic conversation is disabled; the older entries below are historical records.

Build a project: exact native-approved current-session file application; actual contained Node tests and JavaScript build scripts; separate test/build output and exit codes; stale pre-application results; a manual repair action; and an opt-in bounded build/test/fix run. One native scope approval covers the initial reviewed change plus at most two freshly reviewed repairs within the original editable paths, fixed test/build scripts, at most eight additional model calls and three applications/checks per kind. Stop, changed scripts, rejected reviews, conflicts and exhausted budgets stop progression. No token is serialized or granted to models. See BUILD_TEST_FIX.md.

Automatic conversation: an additional three-pane mode with shared goal, independent A/B ChatGPT model choices, automatic alternating turns, ordered turn cards, transcript, budget extension, boundary user messages, Pause and Stop. Durable request/run binding prevents duplicate dispatch; per-agent Markdown logs checkpoint preparation, binding and completion. Cold reopen sends no requests and historical sessions cannot adopt old workers. Text only; no project/tool capabilities. See AUTOMATIC_CONVERSATION.md.

Validation uses synthetic model replies and approvals in disposable profiles, but actual Windows replacements/backups, native process jobs, Node test/build execution, SQLite persistence and built main/preload/UI. The full server suite passes533 tests with5 skipped; renderer/main/mobile builds and checks pass. A manual calculator fixture failed, was actually corrected, passed its retest and produced a build output file. The automatic fixture deliberately starts with a faulty implementation and independently reviews a fresh repair. A separate conversation fixture exchanged40 turns, injected a user message, exercised Pause/Stop and reopened with zero inference replay. Final results are under validation/revision93. No real credentials or provider inference requests are used by these fixtures.

Remaining: end-user native UI acceptance and real-account multi-repair/continuous sessions, Claude integration/acceptance, arbitrary package/native/Python commands, directory creation/deletes/moves, general project milestone completion, safe historical conversation branching/resumption, cross-process write-lock retirement, remaining private-store/enterprise-metadata assessment, and Windows distribution packaging. Mac remains deferred. Passing selected checks is not proof of all project requirements. No installed Graviton program/profile was changed by this increment. Continue from this state; do not redo the completed preview-only acceptance or ask the user to repeat synthetic fixture checks.

Final acceptance:533 full server tests pass with5 skipped;1182 renderer tests pass with1 skipped. The final focused application/repair/approval run passes24 tests. The one-scope desktop loop includes an actual optional build script and passes after one reviewed repair. Cold reopen retains the additional test source added to the repair snapshot, preserves the original native source selection for the next task, and starts no inference. A stale renderer wording assertion and a cold-fixture assumption of exactly two sources were corrected; neither was treated as a product pass before its successful rerun.

A separate explicit live acceptance used Hadron's existing ChatGPT connection for2 actual gpt-6-luna requests: a real proposal and independent exact review, followed by actual reviewed application to a disposable calculator project and passing Node tests. The tests were preserved. No personal project, sign-in setting or Graviton profile was changed, and no raw credentials were read or copied by the test harness. The normal official runtime handled authentication. Live evidence is in validation/revision93/live-project.txt and Hadron's private validation-live folder. Multi-repair and40-turn desktop tests remain synthetic generation, with actual host/storage/Windows operations.
---
# Hadron Harness TODO - revision91

Updated: 2026-11-07. Order confirmed by the user: finish and accept the Windows two-agent MVP first; then implement the wider project-building roadmap. Historical checklist preserved verbatim in TODO_HISTORY_TO_R71.md. Older unchecked boxes are not a reliable current status; this file is the current order.

## 1. Windows two-agent MVP - core accepted

- [x] Hadron-specific app/profile/database/settings/credentials and ephemeral loopback listener. No installed Graviton tool/data/credential imports.
- [x] ChatGPT subscription sign-in; independent A/B conversations, task files, follow-up branches, saved project chats and automatic Markdown logs.
- [x] Independent proposals, focused cross-review and one combined answer, preserving disagreement and missing evidence.
- [x] Opt-in web/tool verification; immutable user-approved sandboxed tools; private per-job navigation, bounded execution and cancellation.
- [x] Fix actual native stream duplication: select the authoritative final message instead of joining commentary and final JSON.
- [x] Remove contradictory verifier instructions; require an actual evidence attempt, with one bounded protocol correction if omitted. Discovery alone is not verification.
- [x] Distinguish successful evidence, failed checks and historical no-check sessions. Unavailable search results cannot become successful evidence receipts.
- [x] Real ChatGPT public-URL tool acceptance: two native requests, one actual web_read, observed Example Domain title/source URL. No Brave key or Graviton access. Earlier diagnostic failures are retained separately.
- [x] Continue with both agents near the combined answer; restore model/review choices and prepare an editable follow-up without starting inference.
- [x] Explicit choice to retain/exclude previous shared context/file text; server freezes only selected shared questions/combined answers. No sibling leakage; bounded history, preflight before inference and preserved saved sessions.
- [x] Shared conversation tree with question/combined-answer preview cards; select an earlier answer and fork a separate shared follow-up.
- [x] Automated permission, Stop, recovery, migration, restart and canonical-history checks; broad Windows test fixtures repaired without replacing Electron's SQLite binary.
- [x] Preserve nested managed shared-workspace scope and selected combined answer on reopening; recover admission with read-only GET and no inference replay.
- [x] User screenshots confirm real shared public-URL evidence and a contextual Continue with both follow-up.
- [x] Actual cold startup restores the last owned workspace rather than the newest private proposal; no-click desktop restart regression passes.
- [x] Core Windows two-agent acceptance: user confirmed actual shared verification/follow-up and correct cold startup; automated shared-file keep/exclude and all supported local settings checks passed. Optional configured services remain separately deferred.

## 2. Build-and-complete-project collaboration - current phase

The user wants agents to work together to build and finish projects. Current sandboxed web/generator tools do NOT provide autonomous project-file editing or shell/build/test execution. Implement these explicitly, in order:

- [x] Document selected-project read/write/command boundaries and staged acceptance in PROJECT_BUILD_PLAN.md.
- [x] Implement explicit per-agent read-only folder grants and bounded listing/text reads, with revoke and restart expiry.
- [x] Personal native-picker/subscription acceptance of the new project-read mode using demo-project.
- [x] Add native-selected source grants to the proposal workflow: A implementer, B exact read-only reviewer; no edits/commands/delegation.
- [x] Implement and test the coordinator-only durable lease/write/review/correction backend. This is not yet an enabled editing capability.
- [x] Add the host-only persisted task/source packet and actual-run-bound A/B coordinator, one correction, cancellation/deadline, offline diffs and mandatory per-agent Markdown checkpoints. No canonical apply method or production UI connection is enabled.
- [x] Add the cooperating-host execution gate and durable exclusive marker, observe queued/legacy activity, guard audited legacy entry points and bind the coordinator to an opaque scope. Prevent replay of ambiguous running legacy jobs at startup.
- [x] Verify actual Windows owner/group/protected DACL, ordinary attributes, creation time and named-stream preservation using a fixed metadata helper; keep backups and refuse unsafe fallback/special attributes. Canonical apply requires a live trusted execution assertion.
- [x] Add fresh recovery inspection and explicit same-host keep-files reconciliation after actual worker termination, durable observations and safe marker-release retry. Restart inspection never recreates a write capability.
- [x] Configure canonical private-ledger startup across desktop/standalone/utility hosts; add immutable project-only startup, hold/report pending legacy work and skip inherited runtimes.
- [x] Add host-only exact-review application with separate trusted consent, live coordinator/write admission, durable once-only reservation, Stop between files and actual A/B operation logs. Default production application remains unavailable.
- [x] Enable the approved separate Build a project entry for proposals/diffs only, with native folder/source choice, Stop, saved proposals and cold reopen.
- [x] Accept the initial two-model proposal preview using the real ChatGPT subscription: screenshot plus actual completed A/B stages, B approval and unchanged source hashes.
- [x] Personal saved-diff inspection/cold reopen: user screenshots confirm saved proposal, original-state inspection and Before/Proposed after text (revision89).
- [x] Hold the opening logo for at least four seconds and maximize Hadron before first show.
- [x] Expand continuous-chat implementation/recovery/acceptance plan and document remaining project activation audit; keep actual edits/commands disabled until those gates pass.
- [ ] IN PROGRESS: remaining competing execution audits, previous-process/child termination proof, advanced metadata policy and explicit native consent before enabling canonical edits.
- [x] User selected a separate Build a project entry beside existing modes; preserve three panes.
- [ ] Add one implementer plus a read-only reviewer; one canonical-workspace write lease covering every enabled execution path. Deny bypasses through shell, MCP/custom tools, hooks, REPL, delegation and mode changes.
- [ ] Add approved verification commands with actual recorded results; bound one fix/recheck round and invalidate review whenever the implementation changes.
- [ ] Add persisted project plan/milestones, task ownership and completion criteria. Finish only when agreed deliverables and checks pass; preserve genuine failures/uncertainty.
- [x] Add authenticated native read-only saved-state inspection, including actual file comparison and current/historical worker distinction.
- [ ] Implement explicit interrupted-attempt intervention and fork-from-checkpoint recovery; never replay ambiguous paid requests or writes automatically. Read-only inspection does not unlock or recreate execution authority.
- [ ] Validate with real small project builds and same-context single-model baselines, measuring correctness, missed defects, latency and usage.

## 3. Remaining product and provider work

- [ ] Continuous automatic A/B conversation: user-requested alternating ping-pong turns, shared transcript, Stop/pause, explicit budgets and interruption-safe resume. Chess is an example, not the scope. See CONTINUOUS_CHAT_PLAN.md; retain current project-building priority.

- [ ] Claude subscription sign-in/execution and Claude/ChatGPT pairing when the user is ready. Do not treat installed CLI availability as acceptance.
- [ ] Consistent three-pane custom themes and explicit Hadron preset/reset; retain user-approved layout and colours.
- [ ] Complete branch edit/regenerate/delete menus, larger-history pagination and deliberate compaction/context-budget UX.
- [ ] Finalize log redaction, retention, deletion and portable checkpoint/backup export/import. Keep credentials out of exports.
- [ ] Configured-service acceptance of optional Main chat providers, embeddings, hooks/skills/MCP and wallpaper playback. These inherited controls are distinct from native Agent A/B grants; SETTINGS_AUDIT.md records prior scope.
- [ ] Optional synthesis-model/role presets and richer structured claims/confidence evaluation; avoid unbounded debate.

## 4. Windows distribution and release

- [ ] Audit AGPL/source/licence notices and third-party runtimes; review branding, packaging defaults and upstream update isolation.
- [ ] Bundle required official provider runtimes/resources, guides, corresponding source and notices into Hadron's own installer.
- [ ] Test installer/uninstaller/desktop icon/shortcut/profile isolation on clean Windows without developer tools or personal data.
- [ ] Verify backup/upgrade/recovery and normal desktop coexistence. Previous port-shadowing incident is documented in wherearewe.md; do not erase it with blanket isolation claims.
- [ ] Publish/share only after release checks and the user's concrete approval.

## 5. Deliberately later

- [ ] macOS build, icon, signing/notarization and real Mac testing after Windows works (user preference).
- [ ] More than two agents with aggregate budgets and targeted reviews.
- [ ] Separate worktrees/multiple-writer merge workflow, if requested and designed.
- [ ] Remote/A2A/multi-machine transport only for an actual requirement.

Current evidence is under validation/revision88; older evidence remains preserved. The checklist is not being marked complete merely to clear old boxes. Continue updating wherearewe.md after each working session.


## Revision74 - restore the workspace on actual cold startup (2026-11-06)

The user's next screenshot showed Agent B / Independent jobs immediately after launching the shortcut. Revision73 repaired project-entry resolution but its desktop test manually opened that entry after launch, so it did not establish automatic startup restoration. This distinction supersedes the earlier expectation that the shortcut would automatically restore the shared view.

Root cause: HomepageRedirect selected the latest updated stored conversation, which can be a materialized private agent proposal rather than the workspace the user was viewing. Hadron now remembers the last resolved workspace ID per local owner and reads it at startup. A fresh server GET validates the conversation owner/project before navigation; deleted, malformed and foreign references fall back safely. For older installs without the new reference, a recent managed agent/proposal entry is resolved back to its owning workspace first. Stored preferences contain navigation IDs only, no text, files, tokens or inference request.

Validation: 12 focused renderer tests passed, including newer-proposal vs last-workspace priority, legacy startup migration and deleted/foreign preferences. Renderer build and Electron typecheck passed. A fresh isolated desktop fixture created a private conversation, a nested shared verification task, a shared follow-up and an earlier-answer fork. After full process exit, an actual cold launch restored the nested workspace route, Work together / Shared task, the earlier selected combined answer and its tool evidence. The test now explicitly rejects any wrong startup route and performs NO project-list click, route injection or mode switch on reopening. The built native-model fixture recorded zero inference requests on reopening; fixture inference is synthetic, no personal account or Graviton files/processes were used or changed.

Next personal check: fully quit Hadron and reopen its existing shortcut; keep the subscription sign-in. It should return to the shared workspace automatically. The wider project-edit/build phase remains gated on Windows MVP acceptance.


## Revision75 - Windows MVP confirmed; selected-project read foundation (2026-11-06)

The user confirmed that cold startup opened correctly, then requested continued work. Core Windows two-agent acceptance now includes actual ChatGPT independent chats, shared proposals/reviews/synthesis, contextual shared follow-up, saved chats/trees and correct cold startup. The remaining shared-file choice was exercised end to end: a real text-file fixture passed through the file input, was excluded from one follow-up and retained on an alternate branch. The settings desktop audit again opened all 19 sections, persisted supported local changes and used no inference. Optional configured services and Claude are still separately unaccepted.

Implemented the first project-building increment: each independent agent has Read a project folder in its Tools selector. Choose project for Agent A/B opens a native read-only folder selection. The main process issues an opaque in-memory grant bound to local owner, resolved workspace and agent. Server admission resolves canonical job metadata and only then creates branded host tools. Native CLI tools remain disabled. This mode supplies only project_list and bounded UTF-8 project_read line ranges with SHA-256; no writes, shell/build/test commands, web, library tools or subagents. Project files are untrusted data. Traversal, absolute/device/alternate-stream paths, links/hard links, oversized/binary files, common credential directories/files and protected application/account folders are denied. Root identity, authorization and cancellation are rechecked. Activity logs store tool names/status only, never file paths/text. A grant is revoked on replacement/removal and expires on restart; saved answers/logs remain readable without replay.

The title-bar Select a work folder does not grant this new access. A and B require separate explicit selections. Work together verification remains web/enabled-tool only; project collaboration edits are the next distinct increment, not enabled by this reader. PROJECT_BUILD_PLAN.md defines implementer/reviewer separation, durable overlapping-folder write leases, expected-hash edits, interrupted-operation reconciliation, review invalidation, command containment and disposable-project acceptance before editing is enabled.

Validation: 333 server tests passed, 5 skipped; 1173 renderer tests passed, 1 skipped. Focused independent/context/journal routes and prompt tests: 24 passed; branching/service checks: 13 passed. Project read boundary tests include actual file reads, no-write protocol roundtrip, owner/workspace/agent isolation, forged grants, revoke/replacement, traversal/device paths, links/hard links, protected directories, size/line/output limits, cancellation, changed roots, restart expiry, operation budget and metadata-only activity. Renderer/main/mobile builds and server/Electron/mobile typechecks passed. Built desktop fixture used the actual UI/IPC/server/database/native host protocol and real temporary project files; only the model and native folder-picker result were fixtures. It read the exact requested line, made zero file changes/commands, revoked access and blocked another send. Cold restart restored the saved answer but required a fresh folder grant and sent zero inference requests. No real provider requests, personal project access, Graviton changes or user-app restarts were performed during this pass. Evidence: validation/revision75.

NEXT LIVE CHECK: reopen Hadron, choose Independent jobs, choose ChatGPT/model for Agent A, Tools -> Read a project folder -> Choose project for Agent A. Select C:/Users/rajka/Desktop/Hadron-Harness/demo-project. Suggested task: Read README.md and src/calculator.js. Explain the function and suggest one useful test. Do not edit files or run commands. This checks the real native folder picker and subscription path before the writer increment. The demo has no personal data or dependency installation. Do not claim project building is complete; coordinated writes and command execution remain in TODO order.



## Revision76 - editing journal foundation and approved project entry (2026-11-06)

The user supplied a successful real Agent A project-read answer: README.md and src/calculator.js were read, add(a,b) was correctly explained, a negative-operand test was suggested, and the answer correctly stated no edits/tests ran. The selected-project native-picker/subscription acceptance is complete.

Implemented a coordinator-only ProjectWriteStore backend in server/hadronTools/projectWrites.ts. It has immediate SQLite transactions, overlapping parent/child folder exclusion across connections/owners, opaque process-local lease handles, immutable before/after text proposals and SHA-256 snapshots, exact-snapshot Agent B review records, retained review/proposal history, one bounded staged correction, expected-hash text create/replace, write-start and applied/uncertain receipts, partial-batch reporting and read-only recovery inspection. It never replays a completed, superseded or uncertain operation. A reopened host cannot recreate a write capability from serialized IDs; interrupted leases remain held for intervention. SQLite FULL synchronization is required.

This is a backend foundation, NOT an enabled editing feature. It has no production import, HTTP/model tool, permission grant, provider runner or live UI connection. The argument identifying reviewer B is trusted coordinator metadata, not authentication in itself. Do not expose recordReview or apply as model-callable approvals. Before enabling writes, finish authenticated role/admission integration, cover inherited tool/Node module/IPC/shell/MCP/hooks/REPL paths, implement explicit interrupted-operation intervention and review file-mode/ACL preservation. Existing parent folders are required; deletion, moving, directory creation and commands are not implemented. Operation atomicity is per file, not all-or-nothing for a batch. Tests cover process/storage failure handling; do not claim OS power-loss or non-cooperating external-writer containment certification.

Windows tests found inode values beyond JavaScript's safe integer range. Folder/file identity and timestamps now use BigInt statistics; persisted writer identities use decimal text. The existing project reader shares the same path policy through projectPaths.ts and also uses exact identities.

Validation: 19 editing backend tests plus 9 project-read tests passed. Full server suite: 352 passed, 5 skipped. Server/Electron/mobile typechecks and Electron main/mobile build passed. Built desktop reader regression passed with real temporary files, simulated model/picker, read/revoke/block behavior and zero project writes/commands/real provider requests. The user's successful real reader acceptance remains recorded separately. No personal project files, Graviton files or running user apps were modified/restarted.

Design: design/project-building.html is an interactive, isolated three-pane design preview, not live execution. Screenshot and design audit are in validation/revision76. It has no native bridge/network/AI or file access; tree/review/log navigation and simulation controls were checked. The user explicitly chose a new Build a project entry beside Work together and Independent jobs. Keep those three entry points and the existing three-pane layout when integrating. Agent A is the initial implementer and Agent B is read-only reviewer. The preview proposes showing changes before apply; automatic application was not requested/approved by this design choice.

Later visual requests from the user, intentionally deferred while project work proceeds:
- Open Hadron maximized to fill the desktop, retaining normal window controls.
- Full-page logo introduction/login screen, with the word Hadron at the bottom; use the existing user-supplied logo.
- Sign-in configured specifically for Hadron, separate from Graviton. Do not reuse Graviton account data or upstream OAuth branding/client registrations. Confirm the intended app-account versus provider-subscription login when this stage is implemented; the current local workspace/subscription behavior remains the accepted baseline.
- Larger project name centred at the top of the workspace.

Next implementation: wire the approved Build a project entry to a persisted task/stage coordinator and authenticated implementer/reviewer capabilities; complete execution-path exclusion and recovery controls before enabling canonical project writes. Keep proposal/review snapshots visible and tests explicitly not run until actual command containment and receipts exist. No user action is needed on the current backend foundation.


## Revision77 - authenticated project proposal/review coordinator (2026-11-06)

Implemented ProjectBuildCoordinator as a trusted host-only service alongside ProjectWriteStore. It freezes the owned workspace/anchor, task, plan, deliverables, A/B models and selected source paths before dispatch. The source packet contains actual bounded UTF-8 file contents and SHA-256 hashes, persisted separately with an integrity hash. A manual source change causes proposal admission to fail instead of silently overwriting it. Agent A can only return bounded text-change candidates. Agent B receives the exact before/after snapshot and cannot call write/approval tools.

Every stage reserves a durable attempt before dispatch and binds the actual protected SubagentRunService handle, run ID, stream ID, conversation, anchor, provider, model, prompt and system prompt before the first request. Terminal identities are rechecked. The coordinator does not trust model-supplied author, role or apply fields. One rejected proposal may receive one A correction plus a fresh B review; unresolved defects remain changes_required after that. There are at most four stage requests, with no provider retries, automatic resumption or inference on status/log reads. Each stage uses toolPolicy none, empty tools, one turn, no rootPath/fullAccess/auto-approve/compaction. No canonical apply method is exposed.

Automatic Markdown job logs now exist for both project agents using the existing protected AgentJobJournal. The prepared task, reserved stage, bound provider run and returned response are checkpointed. A failed pre-dispatch Markdown checkpoint prevents inference. Saved diffs and logs remain readable after a coordinator restart without restoring write authority. A whole-build deadline and explicit cancellation abort actual children; the lease stays held until every worker has reached a confirmed terminal state. Explicit discard releases only a live settled proposal lease. An unconfirmed worker, interrupted host or uncertain write cannot be silently unlocked or replayed. The dedicated project database requires FULL SQLite synchronization and is NOT wired into the live application database or its schema migrations.

Also fixed UTF-8 BOM preservation in the writer's saved before-image: decoding now preserves the marker so saved text reproduces the original byte hash. Added read-only saved proposal history for offline diff inspection; this does not recreate a lease capability.

Validation: the full server suite passed 380 tests with 5 skipped before the final two added coordinator cases. The final focused coordinator suite passed all 29 cases, including those two additional checks; the writer suite passed all 20 cases and existing project reader all 9. The production SubagentRunService regression suite passed all 52 cases. Server typecheck passed. Coordinator integration tests use the real protected worker engine and actual tool loop, disk-backed SQLite and real temporary files/Markdown logs; provider transport and run persistence adapters are simulated. Real-engine cases cover successful A/B review, empty/transient failure without retry, shell-tool denial, cancellation, whole-build deadline and bound-checkpoint storage failure before dispatch. No real model requests, project commands, personal project edits, user-app restarts or Graviton changes were performed. Evidence: validation/revision77.

Activation remains incomplete: this service has no production startup import, native permission grant, route or live Build a project UI yet. Its states are proposed/reviewed drafts, not finished projects; tests/builds are always recorded as not run. Finish exclusion of inherited Node/custom-tool/shell/MCP/hook/REPL/delegation execution, including already-running work; explicit interrupted-write intervention; and file-mode/ACL policy before enabling canonical writes. Then connect the approved third Build a project entry and test in a disposable project. The deferred maximize/logo/login/centred-title design requests from revision76 remain recorded; no further user decision is needed for this coordinator increment.


## Revision78 - inherited execution exclusion controls (2026-11-06)

Added a shared ProjectExecutionGate and an exclusive private-file ledger. A trusted host must configure durable storage before any project scope can be admitted. Project capabilities are opaque, owner/workspace-bound and checked against the persisted scope ID. An active scope denies legacy starts; earlier legacy starts, pending jobs and loaded custom code remain unresolved even after their promises settle, since children/timers may survive. Those observations survive later ledger configuration, and persisted legacy/stale-project records block new project admission across hosts/restarts. There is no age/PID reset, model-provided scope or force-unlock API. Corrupt, oversized, linked, changed or failed-sync storage remains unavailable. This is a cooperating-host execution boundary, not an OS sandbox or protection against an unrelated external application.

Connected this gate to ProjectBuildCoordinator: reserve exclusion before the folder lease, assert it at each actual provider stage/result, and retain it through review until explicit settled discard. Failed admission with an acquired and safely discarded draft releases its scope; uncertain folder-lease admission is blocked for intervention. The service still has no canonical apply method and is not wired to production UI/routes.

Added guards at older tool submission/execution and restored pending queues; dynamic and cached custom modules and custom-tool management; Electron widget file/mkdir/shell IPC, terminal creation/input and custom module execution; utility child creation and request dispatch; native shell/environment/WSL preparation; Git processes and local editor writes; MCP invocation/resource/prompt boundaries and stdio launch; LSP lookup/launch; skill install/clone/copy entry points; Main chat start, unadmitted subagents/resume, legacy Claude bridge, direct REPL and undo restoration. Already-started work cannot be treated as stopped merely because a tool result returned. Existing normal desktop behavior uses observation only: the production singleton intentionally has no configured project ledger, so it cannot admit a live project scope. Do not turn that on until the remaining startup/recovery/metadata controls are complete.

Found and fixed an older restart replay issue: ToolOrchestrator previously reset stored running jobs to pending and re-executed them. They now retain a failed interruption record and require review. Truly pending jobs retain the original queue behavior and are observed before execution/admission. This fix is in Hadron's checkout only; installed Graviton was not edited or restarted.

Validation: 13 execution-gate tests and 31 coordinator tests pass, including real guarded engine admission. They cover queued work, cached modules, utility dispatch, shell preparation, REPL, undo, MCP pre-connection/auth, skill/custom installation, multiple host objects, persistence/restart, disk failure and the interrupted-queue no-replay fix. Broader server totals are in validation/revision78/test-summary.json. Production worker/REPL regressions:88 passed. Legacy chat regressions:27 passed,22 skipped. Selected legacy tools:45 passed,5 skipped; after the final queue fix, all16 orchestrator cases passed again. Server/Electron/mobile typechecks and Electron main/mobile build passed. The isolated built desktop project-reader fixture passed actual bounded read, revoke and send-block checks with simulated picker/provider and zero user project writes/commands/real provider requests. No running user apps or Graviton files/processes were changed.

Remaining activation work is explicit in PROJECT_EXECUTION_BOUNDARIES.md: finish a build-safe startup that does not eagerly launch legacy utility/process work; configure the same durable ledger before all participating execution; reconcile interrupted scope/write records with confirmed worker termination; ensure canonical apply also asserts the live scope; settle Windows ACL/file-mode preservation; then wire the approved Build a project UI and run disposable-project live acceptance. No live project-writing feature or completed-project claim is made by this backend increment.


## Revision79 - Windows metadata commit and explicit recovery (2026-11-06)

Implemented Windows replacement through a fixed, bounded Windows PowerShell/.NET platform helper. It runs the installed system executable without profiles or generic shell interpolation; paths and hashes are JSON stdin data. Module autoload is disabled and only the system Utility module is explicitly imported. It uses a minimal environment and trusted working directory, with no model commands, project build/test execution, plugins or elevation. Native File.Replace uses metadata-error handling enabled, keeps an operation-owned original backup and has no rename fallback. Before replacement it clones owner/group/access-control state onto the staged file, preserves ordinary supported attributes and creation time, and verifies content plus metadata after replacement. Diagnostics contain step labels and hashes, not file text, ACL/SID details or raw exception paths.

The writer persists operation temporary/backup names before filesystem mutation and records the verified metadata digest with a successful receipt. Backups and uncertain artifacts are retained; recovery does not delete, restore or retry them. Read-only, encrypted, compressed, reparse/offline/system and other unsupported attribute combinations are refused rather than relaxed. Tests demonstrate protected DACL, owner/group, Hidden/Archive attributes, creation time and a named alternate data stream survive replacement. Case aliases for the same existing or absent Windows file are rejected before review. Full enterprise auditing/SACL, special security-label policy, non-cooperating external-writer containment, OS power-loss certification and Mac acceptance are not claimed.

Canonical apply now requires a synchronous trusted execution assertion even after a matching B review; default construction cannot write. Admission is rechecked before staging/commit and before saving success. This function must be supplied by the trusted host with actual scope/lease ownership; never expose it as a user/model switch. The native metadata integration tests bind it to a real temporary ProjectExecutionGate scope. Journal/fault-injection tests explicitly use their filesystem adapter fixture and are not evidence of native ACL behavior.

Added read-only recovery plans with current content hashes, exact file identities/timestamps, per-operation state, retained artifacts, a snapshot digest and native comparison with the original Windows metadata backup. Unknown content, paths, roots, artifacts or changed permissions keep recovery held. One explicit keep_observed_files decision can close a current-host attempt only after actual owned workers have ended, with the original opaque folder/execution capabilities. It writes a durable reconciliation event, closes the folder lease, invalidates its review, persists terminal task state, and then releases the execution marker. If marker release fails, the attempt remains visibly terminal with intervention required; a new explicit inspection can finish release without another provider request/file write or duplicate recovery event. Saved state or serialized IDs cannot reconstruct ordinary write authority.

Restart inspection is implemented, but automatic cross-process unlock is deliberately not. A new coordinator can read the recovery plan/diffs/logs; it cannot make a stale original-host decision. Actual previous-process/child termination proof and startup integration remain before live writing. Unknown legacy execution records also remain held, with no time/PID-only override. The current project coordinator still exposes no apply action, production startup does not configure writer scopes, and no live UI route is added by this increment.

Validation:411 full server tests passed,5 skipped. Focused modules:14 execution-gate,35 coordinator,25 writer and4 actual Windows platform tests (78 total). Real Windows tests use protected temporary files, a live temporary execution scope, named streams and actual .NET file replacement; they test permission refusal, changed-permission lock retention, receipt loss after a real replacement and read-only metadata verification during reconciliation. Coordinator tests also cover unended workers, stale/foreign restart decisions, unknown files, stale snapshots, missing admission and execution-marker storage failure. The final coordinator terminal-state ordering change passed all35 cases again. Server/Electron/mobile typechecks and Electron main/mobile build passed. No real model requests, user-project edits, installed Graviton changes, running user-app restarts or project build/test commands occurred. Evidence:validation/revision79.

Next: finish build-safe startup, protected native grant/route integration and the approved Build a project three-pane mode; provide previous-process recovery proof before allowing stale write scopes to close. Preserve explicit review/apply and actual receipts. The fixed Windows helper is bounded but synchronous; live batch integration must yield between files or use a dedicated trusted worker so Stop/UI responsiveness stays bounded. Normal NTFS access controls are verified; advanced security-policy and actual Mac coverage remain separately gated. See PROJECT_RECOVERY.md and PROJECT_EXECUTION_BOUNDARIES.md.


## Revision80 - project-safe startup and reviewed application coordinator (2026-11-06)

Implemented a frozen host startup policy before inherited work can start. Electron, standalone Node and utility children now use the same canonical private-profile execution ledger. Child bootstrap receives the frozen host profile/mode even if process environment variables are later changed. Standard sessions preserve existing tools; --hadron-project-session selects a project-only host at process launch and cannot be toggled by renderer settings or model data. Such a host skips inherited custom/skill/MCP initialization, utility creation, hook/custom-tool seeding and LSP startup. It holds persisted pending legacy jobs without executing or changing them, exposes the held count through health diagnostics, and retains the interrupted-running-job not-replayed failure. Every legacy category remains refused between project attempts as well as during a held scope. No legacy or stale-project marker is automatically cleared. If ledger creation/inspection fails, startup remains restricted for saved-work inspection rather than quitting or falling back to unfenced execution; both legacy and project admission stay blocked, and damaged records are preserved. Ordinary legacy activity may continue in standard mode, but makes project admission unavailable until its separate recovery requirements are met.

ProjectBuildCoordinator now has a host-only explicit application action. Default construction still denies application. Trusted composition must supply both a synchronous authenticated consent assertion for the exact displayed snapshot and ProjectWriteStore admission bound to coordinator.assertCanonicalWrite. The coordinator requires actual A/B workers to have ended, the original opaque capabilities, the exact fresh B approval and a one-time durable application reservation. It checks admission/review again before every file and at commit boundaries. An in-flight read-only review assertion supports the started receipt interval without relaxing apply's no-replay readiness checks. Duplicate/concurrent applications, stale or revoked approvals, foreign ownership, changed execution records, missing/async consent, manual changes and unconfirmed workers are refused.

The batch yields to the event loop before each file so Stop can prevent the first or next operation. A single fixed Windows metadata helper remains synchronous and bounded to ten seconds; it cannot be interrupted mid-replacement by a renderer click. Interrupted/partial batches retain per-file receipts and are never rolled back, replayed or declared complete automatically. Host A/B Markdown logs now distinguish real applied/uncertain operation states from model notes, and always say project tests/builds have not run. The coordinator holds exclusion after applying until an explicit safe close/reconciliation. Terminal discard state is saved before releasing execution, so marker-storage failure does not leave a falsely runnable task.

Validation:432 server tests passed,5 skipped; additional production worker/journal regressions55 passed and legacy orchestrator16 passed. The coordinator suite now has48 cases, including a real Windows replacement bound to the actual coordinator scope. Startup cases8 passed; gate14, writer25 and standalone native Windows commit4 remain passing. Server/Electron/mobile typechecks and Electron main/mobile build passed. The actual built Windows app was cold-launched in isolated disposable project and standard profiles with utility mode configured: project startup held a real persisted job unchanged, loaded no fixture custom implementation, created no utility child or execution claim and stayed clean; standard startup actually initialized its utility runtime and recorded legacy activity. A third actual built cold launch with a corrupt marker opened the viewer/server in restricted mode, preserved the corrupt evidence and started no utility. The existing native desktop project-reader regression also passed actual bounded read/revoke/send-block with simulated picker/provider and zero project writes/commands. No real subscription request, personal project change, running user-app restart or installed Graviton change occurred. The platform tests did launch fixed Windows metadata helpers against disposable files; do not describe those as zero OS processes. Evidence:validation/revision80.

Live project editing remains disabled: there is no Build a project native grant, route or live UI yet, and no production composition supplies application consent. Remaining activation work: protected native selection/role admission and UI; all remaining competing IPC/settings/export/write-path audits; previous-process/child termination proof for interrupted scopes; advanced Windows metadata policy; real disposable subscription acceptance. Shell/build/test execution and automatic project completion remain separate work. Read-only restart inspection remains available, but there is no stale PID/age unlock or marker-deletion workaround. Existing accepted A/B chat/collaboration and the three-pane design remain the live baseline. See PROJECT_EXECUTION_STARTUP.md, PROJECT_EDITING_BACKEND.md and PROJECT_RECOVERY.md.


## Revision81 - native project proposal preview (2026-11-07)

The approved separate Build a project mode is now wired into the real desktop app. It uses the same three panes: reviewed responses/diffs on the left, plan/stage/file cards in the middle, and separate A/B models plus native folder/source pickers on the right. Agent A proposes text changes; Agent B receives the exact frozen before/after snapshot. Existing files must match explicitly selected source paths and SHA-256 hashes. At most one correction/re-review is allowed. This release prepares proposals only: no application API, file changes, project commands, tests or automatic project completion are enabled.

Native grants bind the local owner/workspace and exact root identity, expire on restart/logout, and refuse protected application/account folders including junction aliases. The private hadron-project-builds.db is separate from chat schema. A damaged optional project database disables project proposals while leaving core chats available; it is not repaired or deleted. Saved chooser reads metadata only. Read-only admission checks recover a lost response without retrying inference. Real worker shutdown is awaited before private storage closes, including Quit with an idle upgraded socket. A crash/unknown previous process still holds execution; no marker deletion or PID/age unlock is offered.

Validation: full server444 passed/5 skipped; renderer1177 passed/1 skipped; no failed tests. Server/Electron/mobile typechecks and built renderer/main/mobile passed. Four built startup cases passed (project, standard utility, corrupt execution record, corrupt optional project database). Final built native preview passed real protected-worker admission, frozen source capture, exact B review, diffs, three panes, keep/clear selected files, Stop and saved proposal selection. Cold reopen restored the proposal/mode with zero inference and expired native grants. Both clean Quits joined workers, closed an unregistered idle socket and released execution. Picker/provider replies were synthetic; no real subscription or personal project edits. One preceding desktop attempt found the Agents pane collapsed during placement measurement; a fresh full run and cold reopen passed. Preserve that diagnostic rather than claiming the earlier attempt passed. Existing native-reader regression is recorded separately. Evidence: validation/revision81.

NEXT USER CHECK: fully quit Hadron normally and reopen the shortcut; keep the existing ChatGPT account. In Build a project, select the sibling demo-project folder and README.md plus src/calculator.js. Choose both ChatGPT models, request a proposed README-only improvement explaining the calculator, and provide a deliverable. Prepare proposal should show A's suggested changes and B's exact review, with unchanged source files and no test claims. This real subscription preview acceptance is pending. Canonical edits still require remaining execution audits, prior-process/child termination proof, advanced metadata policy and explicit native consent; command containment and milestone completion follow separately.

USER REQUEST ADDED: continuous automatic A/B conversation (ping-pong turns), with chess only an example. Preserve ordinary independent chat and bounded review modes; implement an opt-in continuous session after the current project-building milestones. See CONTINUOUS_CHAT_PLAN.md. This is planned, not yet available.


## Revision82 - explain proposal readiness (2026-11-07)

The user's screenshot showed a valid selected source (src/calculator.js), Agent A configured, but Agent B provider/model, project goal and deliverables empty. Prepare proposal was correctly disabled but gave no explanation. The proposal form now lists missing requirements directly above the button, uses those same requirements for enablement, distinguishes unavailable/held execution from initialization, and provides a read-only preparation-status check when unavailable. A connected provider/model is required for each role; the same account/model may be used for both. No model defaults are silently chosen. Required task/plan/deliverables reject whitespace. Source files remain optional for new-file proposals; existing-file proposals still need exact selected source evidence.

Updated test instructions: Choose project is a folder-only dialog, so files do not appear there. Use Select source files afterwards. Select README.md for the README-only test, or src/calculator.js for a calculator documentation proposal. Select BOTH agents' ChatGPT providers/models, enter the goal and at least one deliverable, leave the suggested plan, then Prepare proposal. No sign-out is needed. Current real-subscription acceptance remains pending; files/commands remain disabled. Continuous conversation remains planned in CONTINUOUS_CHAT_PLAN.md.

### Revision82 real subscription result and path fix

The user completed setup and received an actual ChatGPT Agent A JSON proposal. The saved record was inspected read-only in Hadron's own private project database: one completed proposal_0, state failed/stage_failed, no peer attempt. A suggested docs/calculator-add.md with expectedHash null. demo-project has only README.md and src/calculator.js; docs does not exist. Directory creation is unavailable, so rejection was correct but the contract/diagnostic were insufficient. No personal files/database records were modified during diagnosis.

The host now sends allowedNewFileDirectories explicitly (project root and selected source parents), states that directory creation is unavailable, validates all proposed new-file parents before saving any file draft, and records safe diagnostic codes for unsupported parents, missing selected source evidence and empty changes. Existing-file hashes remain mandatory. The UI shows these failure reasons near both the result and setup, preserving raw saved responses/logs. Older generic stage_failed rows remain generic; they are not rewritten or automatically replayed. The failure remains in saved history. Real Agent B exact-review acceptance is still pending; one actual Agent A response alone does not establish full acceptance.

Next real check after normal Quit/reopen: open the failed saved proposal, click New proposal, choose demo-project and src/calculator.js again (native selection expires on restart), select both ChatGPT models, and request: Propose a short calculator.md document at the project root explaining src/calculator.js. Do not create folders. Deliverable: Reviewed calculator.md proposal. Leave the suggested plan. Prepare proposal should show A's file card and B's review with no disk edits.

Revision82 final focused validation:61 server tests and8 renderer tests passed; renderer/server/Electron/mobile typechecks and renderer/main/mobile builds passed. Expanded actual desktop fixture passed missing requirements, unsupported-directory diagnostics, explicit New proposal recovery, six synthetic requests, source retention/clearing, Stop, exact review, saved selection and graceful Quit. See validation/revision82. No new real requests were made by these fixtures.


## Revision83 - additive multi-file selection (2026-11-07)

The native picker already allowed multiple files in one visit, but each completed visit replaced the previous selection. This made selecting a root README then a source in src lose the first file. Source selection now accumulates native-selected files across visits/folders, deduplicates repeated selections, and enforces a maximum of20 files over the combined set. All paths are validated before replacing the granted set; invalid/over-limit additions leave it intact. The explicit Clear files action still removes the whole selection; cancel leaves it unchanged. Renderer-supplied paths still cannot grant access.

The button now says Add source files. A Selected source files: N /20 heading and complete project-relative list show what both agents will receive. Help explains Ctrl-click for multiple files in one folder, or another Add source files visit for another folder. The frozen project packet contains the full selected set; saved views retain the paths while native access expires on restart. Existing selected-source SHA checks and read-only preview boundaries are unchanged. No real provider request or installed Graviton change is required for this fix.

NEXT USER CHECK: quit/reopen normally, choose New proposal if viewing an existing result, choose demo-project, then Add source files for README.md and again for src/calculator.js. Both paths and a count of2 should remain visible. Continue the existing proposal test after completing both model choices, goal and deliverables.

Revision83 validation:12 service tests and8 renderer tests passed; renderer/server/Electron/mobile typechecks and builds passed. Actual desktop fixture confirms two successive picker visits retain both displayed filenames/count2, exact frozen-source review, Clear/keep, Stop and graceful Quit. No real requests or personal file edits. Evidence: validation/revision83.


## Revision84 - longer opening screen, accepted preview and next-stage plans (2026-11-07)

The user's screenshot confirms the native two-model preview: both selected files are listed, A prepared a README replacement, B completed its independent review and status is Proposal reviewed. Read-only inspection of Hadron's own saved record confirms two completed actual stages, B approve and both demo source hashes unchanged. The session is saved/closed after ordinary Quit, not deleted. Initial real subscription preview acceptance is complete; inspecting the saved exact diff and personal cold reopen remains a separate check. Canonical edits, project commands and completion remain unavailable.

The existing Hadron logo entry now stays visible for at least4000ms after the image loads while local initialization proceeds in parallel. Slow initialization does not add a second four-second delay; startup failures retain the retry screen, and leaving the entry cancels its delayed navigation. The main Hadron window now maximizes before first show, fulfilling the earlier full-page startup request while retaining normal window controls. This does not change provider credentials or the installed Graviton app. The larger centred project title and a fuller introductory design remain later UI work.

CONTINUOUS_CHAT_PLAN.md now specifies ordered backend/worker/API/UI/acceptance phases, durable turn/session states, one admitted turn, real run binding, crash ambiguity, idempotent completion, Pause/Stop/injection/branch behavior, explicit budgets, context compaction, twenty-turn acceptance and a later real-account test. It remains planned rather than silently enabled. The approved Windows project-building priority is retained. PROJECT_ACTIVATION_AUDIT.md records the next editing gates and confirmed external-launch/theme initialization gaps. Broadly tainting every normal browser click was rejected as an unsuitable fix; no such behavior is shipped. Full canonical execution containment is not claimed.

Next user check can use saved work: normal Quit/reopen should show the longer logo and a maximized workspace, restore the saved proposal without inference, and show Before/Proposed after when the README card is selected. No fresh paid proposal or sign-out is needed to inspect this. Continue project editing only after the activation gates in PROJECT_ACTIVATION_AUDIT.md.

Revision84 validation:28 focused server/bridge/execution/startup tests passed; renderer/server/Electron/mobile typechecks and renderer/main/mobile builds passed. Actual built desktop and cold reopen passed; loaded logo visible at2500ms and transitioned at4051ms/4025ms, both windows maximized. Existing proposal/diff/two-source/Stop/file retention and saved reopen passed with zero real requests; no personal project edits or installed Graviton changes. Evidence:validation/revision84.


## Revision85 - clean startup wording (2026-11-07)

Removed the account/subscription explanatory sentence from HadronEntry, as requested. The start page now shows the existing Hadron logo/title and opening status, with retry only if local startup fails. The next engineering phase remains reviewed file application after the activation audit/recovery/metadata/native-consent gates, followed by contained commands, build/test/fix milestones and project completion acceptance. Continuous A/B conversation has a detailed plan for the subsequent phase. Claude pairing, remaining UI polish and Windows distribution remain on the roadmap.


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


Revision89: personal saved-preview acceptance completed. Pinned private paths and bounded identity checks now also cover the advanced app-registration encrypted record and mutation lease; official Codex credentials and other stores remain pending. See PRIVATE_STORAGE_POLICY.md and wherearewe.md.


Revision90: project-only/held/persisted-scope external launch checks implemented across native web/file handoffs and generic OAuth windows; ordinary standard-session links preserved. Standard earlier external processes remain uncontained; future writes require a clean project-only host or equivalent proof. See EXTERNAL_LAUNCH_POLICY.md.


Revision91: actual current-host child closure now precedes provider completion, including process/pipe/observer failures. Graceful Quit tracks and joins status/login/provider helpers without logout; repeated Quit cannot bypass it. Earlier crashed epochs and descendants still require OS-backed evidence. See WORKER_LIFECYCLE.md.


## Revision92 - Windows worker containment (2026-11-07)

Project-only Codex launches now use creation-time Windows Job Object assignment, durable private admission evidence and whole-job termination joins. Saved inspection can confirm newly recorded prior epochs through actual process identities and job accounting. Unknown/old/denied/cross-session evidence remains unconfirmed. This does not unlock execution records, restore write leases, replay requests or enable editing. Standard sessions and Claude helpers are outside this transport.

Validation:515 server tests passed/5 skipped; final server typecheck, renderer and Electron/mobile builds passed. Actual crash/descendant/cancel, production transport, repeated Quit and fresh cold-reopen checks passed. No real credentials or inference requests were used. An early closed fixture was inconclusive and the stricter rerun passed. See WINDOWS_WORKER_CONTAINMENT.md and validation/revision92.

Next: exact execution-marker binding and explicit preview-recovery retirement, remaining helper/private-store/metadata assessment, then native application consent and disposable write/conflict/restart acceptance. Project editing, commands, continuous automatic A/B turns and distribution acceptance remain pending. No user action is required for this increment.
