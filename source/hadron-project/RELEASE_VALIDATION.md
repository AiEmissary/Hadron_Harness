
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

# Revision 104 hotfix - 0.4.4 milestone bridge

Fixed three missing preload methods causing the reported minified milestones TypeError. Added compile-time API completeness, compiled-preload IPC forwarding regression and actual packaged milestone IPC acceptance. Renderer/main/typechecks and desktop folder regression passed. Exact installer/source hashes are in validation/revision104/artifacts.json. Earlier upgrade/clean-PC qualifications remain below; no fresh installed-upgrade claim is made for this hotfix.

---
# Revision 103 follow-up - 0.4.3 selected-folder search

Folder-only and manual-file desktop workflows passed. Added read-only recursive search and same-provider lightweight scan summaries, frozen discovered evidence for review, visible operation history, bounded context and unchanged mutation approvals. 100 focused server + 37 protocol/library + 9 renderer tests passed. Actual production 0.4.3 packaged startup/native/provider checks passed; upgrade result follows. Source revision 2b08b082c2fedaa093f5c264d6547fdf2397733c. Separate clean-PC acceptance remains pending.

---
# Revision 102 follow-up - 0.4.2 project controls

User requested the updated executable. Fixed monitor close/reopen/minimize and prominent project retry/new-task controls. Fixed failed-worker polling until termination. Actual built desktop flow and 19 focused renderer tests passed; final packaged 0.4.2 startup/native provider checks passed. Source revision 652fc9f30274d58881ff3a2269f56d806eb3f339. See validation/revision102 and CURRENT_BUILD.md for exact artifacts and final upgrade result. Separate-PC acceptance remains pending.

---
# Release validation - revision 101, 8 November 2026

Passed on the existing Windows development PC:
- Real subscriptions: GPT-6.1 Sol -> GPT-6 Luna helper -> parent, and Claude Sonnet -> Haiku helper -> parent. Six successful physical requests; official runtimes and durable helper journals. An earlier loose-prompt check used one request without optional delegation, so was not counted as a helper pass. No credentials exported.
- Real NSIS installation, installed startup, correct shortcut, same-version reinstall, 0.4.0 to 0.4.1 upgrade, uninstall and restoration of original shortcuts.
- Two seeded synthetic messages preserved through upgrade. Native SQLite backup restored after deliberately simulated corruption; unfinished helper marked interrupted without replay. Whole disposable profile backup restored nine job trees/selection without inference.
- 24 focused execution-startup/private-profile/journal tests passed. Earlier full regression counts remain 559 server, 894 headless, 1182 renderer, six focused helper tests.
- 593-package production dependency licence inventory, zero missing accompanying notices. JSZip uses its MIT alternative. dingbat-to-unicode and lazy-val lack original standalone licence texts: publisher declarations and clearly labelled standard terms are supplied, not invented original notices. Unused GSAP removed.

Qualification and pending external work:
- Separate Windows PC selected by user; clean-PC test pack prepared. No access to that PC is configured and no result is claimed. Existing-host tests cannot prove fresh Windows compatibility without developer tools.
- Two 0.4.0 installer invocations returned 0xC0000005 before installing, including the final repeated baseline check. Later runs passed; cause remains unconfirmed and clean-PC reliability testing is required. Other failed attempts were test-fixture startup/invalid lineage seed issues, corrected before the passing run.
- Root project is AGPLv3 with original provenance retained. Source archive includes committed build sources, locks, worker source, vendor install recipes, notices and build instructions. This is a technical source-package review, not legal certification.
- Official Claude Code product/preinstallation conditions need confirmation before public redistribution. No contracts accepted or public upload performed. Primary source: https://code.claude.com/docs/en/legal-and-compliance .
- Installer unsigned; publisher signing requires a certificate. Mac and previously deferred expansion remain later work.

Original Graviton, personal chats and credentials were not modified. Test installation/profile directories were disposable. Installed and development Hadron profiles remain separate.

Final repeat: old 0.4.0 baseline again crashed before installation. The final 0.4.1 installed and launched; its recovery diagnostic then hung waiting for requestAnimationFrame in a covered window. Diagnostic now uses a bounded timer, avoiding suspended animation-frame waits. No data-loss conclusion is inferred from that diagnostic timeout. Final revalidation follows.

Final exact 0.4.1 installer verification PASSED after the diagnostic correction: current-user install, shortcut target, installed startup, SQLite backup/restore after simulated corruption, interrupted helper with no replay, same-version reinstall, both saved messages preserved, uninstall and original shortcut restoration. Final packaged startup and all required resource probes passed with zero model requests. Separate-PC acceptance is pending and the user will run the provided test pack there. Matching source revision 7a903e587a29015ab2a5a616cdb4312786001afb; artifacts.json records exact installer/source hashes. Earlier successful 0.4.0 -> 0.4.1 upgrade remains valid evidence, alongside the recorded intermittent old-installer baseline failures.

Final installer acceptance PASSED: real 0.4.1 installation, same-version reinstall, genuine 0.4.1 -> 0.4.2 upgrade, both saved synthetic messages preserved, SQLite backup/recovery, unfinished helper not replayed, uninstall and restoration of original shortcuts. Current-host acceptance only; separate-PC test remains pending.

Final exact 0.4.3 installer acceptance PASSED on this Windows host: actual installation, correct shortcut, installed startup, SQLite backup/restore after simulated corruption, interrupted helper without replay, same-version reinstall, both synthetic saved messages preserved, uninstall and original shortcut restoration. The separate 0.4.2 -> 0.4.3 upgrade attempt failed before installation because the older 0.4.2 baseline installer returned 0xC0000005; do not count this as a successful version-upgrade test. The intermittent baseline-launch issue is broader than only 0.4.0 and remains a release concern. Separate-PC acceptance and real-project user testing remain pending. No personal project writes, account changes or paid requests were used for this feature pass.
