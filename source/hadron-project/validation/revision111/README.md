# Revision 111 - startup checkpoints and truthful saved-session status (8 November 2026)

Windows preview 0.4.11 fixes the Automatic conversation saved dropdown retaining an old running status after live polling has paused or finished the selected session. The desktop fixture checks that the saved option agrees with the actual paused state.

A lightweight diagnostic bootstrap now runs before the normal host bootstrap. In an explicit private --hadron-diagnose profile only, it records bounded, atomic startup checkpoints with a unique invocation ID: bootstrap/profile/main, instance lock, app ready, server ready, window/renderer load and terminal diagnostic state. Known startup/renderer failures and an early normal quit produce a matching failure report. Normal application launches do not enable this recorder or change their profile.

Abrupt Electron exits can bypass JavaScript exit/quit callbacks: a native test establishes this. The durable last checkpoint still remains, and the diagnostic launchers preserve the exit code and last stage when a complete report is absent. A fresh result must match the invocation trace; old success reports are not sufficient. Portable ZIPs now include startup-trace.json alongside the existing allowlisted reports/screenshots, never an account store, normal chat database or raw process log. This improves future diagnosis; it does not establish or fix the cause of the earlier unexplained startup exit or old NSIS crashes.

The Windows worker build now reuses an existing binary only when source, compiler, build recipe and binary hashes all match its manifest. This avoids rewriting an unchanged executable while it is in use. Changed builds still require compilation and never kill an active worker to gain access. The existing manifest schema stays compatible with the protected runtime. Actual Windows worker containment tests passed after the change.

Validation: four focused recorder tests; native Electron checks for abrupt exit, early quit, simulated lock refusal and successful completion; renderer/main/mobile typechecks and builds; actual desktop 40-budgeted-request memory/injection/Pause/Stop/sidebar regression and truthful saved-state label. The first native test harness incorrectly awaited app readiness at module top level; corrected to a nonblocking readiness callback before acceptance. An initial build tried to overwrite a worker still used by this pass's live test and failed; after verified reuse and the live worker's clean join, the successful build completed. Failed attempts are not counted as product passes.

A longer standalone real-account scheduler test passed 36 requests: 31 conversational replies plus five memory summaries, using ChatGPT Luna and Claude Haiku. The handover marker/rollback requirement survived, latest replies used memory, every original reply was retained, and workers ended at the chosen budget. This passes the earlier 27-reply count, but uses deliberately short checklist replies; it is not an unlimited-service or maximum-context stress claim. Prior synthetic large-history tests cover bounded long ancestry. No personal project files or original Graviton application/profile were modified.

Packaged-startup, final installer/source hashes and upgrade results are appended here once complete. The broader fresh-Windows checklist and public redistribution/signing qualifications remain open; Mac/remote work stays deferred.

Final packaged 0.4.11 startup passed: current invocation IDs match, the trace ends at diagnostic_passed, required UI/native/provider checks pass, and no model requests were sent. The portable script passed; its ZIP contains exactly the six allowlisted files, including a matching startup trace, with no account stores/databases/raw logs. Actual installer upgrade acceptance follows separately.

Diagnostic isolation follow-up: code inspection found that diagnostic and desktop fixture launches still called setAsDefaultProtocolClient. These private test profiles now skip global OAuth-protocol registration. Both desktop and packaged checkers take read-only before/after snapshots of Hadron's own URL-handler registration, persisting equality only; the actual command is not exported. The final 40-request desktop regression and packaged startup pass with signInProtocolPreserved=true. Normal Hadron launches retain their normal protocol registration. The final program was rebuilt and repackaged with this guard; exact final installer acceptance is recorded separately.

Installer evidence: the initial 0.4.10 baseline invocation exited 0xC0000005 before installing. Direct 0.4.11 install/reinstall/backup-recovery/uninstall passed; an explicit repeated 0.4.10 -> 0.4.11 upgrade also passed with both saved messages preserved and original shortcuts restored. Retain the failed attempt as an unresolved intermittent NSIS launch problem, not a successful first attempt or a root-cause fix. Windows event/WER lookups produced no matching crash details in this pass. The final diagnostic-isolation candidate uses the same installer configuration; its final installer check is separate.

# Release 0.4.11 delivered — 8 November 2026

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
---

