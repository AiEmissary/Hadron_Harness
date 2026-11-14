# Hadron 0.4.16 validation — 9 November 2026

Delivered source revision fb81243d524ad206ca6edf78ffd2e9e5fa72144d. Installer and matching source hashes are in artifacts.json / SHA256SUMS.txt. This private testing installer is unsigned.

## Passed

- 116 focused tests: 52 headless collaboration/session tests, 45 folder/helper/tool tests, and 19 renderer tests. Production renderer, main and mobile builds/typechecks passed.
- Native synthetic desktop tests: shared folder selection, both independent proposals and both cross-reviews reading the folder, verification with host evidence receipts, visible activity, retention for a next task and removal; folder scope isolation and no writes/commands. Mode setup/model choices on right, instructions on left, actual keyboard typing and retained drafts in all four modes. Selection/typing sends no inference.
- Sidebar regression with actual mouse input: two successive open/close cycles using the same left rail button. The overlay no longer intercepts the button. DOM-only clicks would not have detected this bug.
- Build-folder regression: nested source discovery without individual file selection, evidence and exact review. Continuous conversation regression: 20→40 requests, compaction, full original replies, user message, Pause/Stop, saved reopen and mode switching. Full jobs/history/copy/bin/theme/Help regression passed. These are synthetic inference fixtures, not provider-quality guarantees.
- Real-account folder probe passed separately with ChatGPT gpt-6.1-sol and Claude sonnet. Each searched a disposable fixture, read its file and returned a random marker. No personal project edits, account copying or sign-in changes. GPT used three requests; total probe bounded to 16. Only sanitized metadata is retained here.
- Packaged startup passed at 0.4.16, maximized, with matching startup trace and zero model requests. Native dependencies and both packaged provider engines passed packaging checks.
- Actual per-user 0.4.15→0.4.16 installation exited zero. Installed archive exactly matches build. SQLite integrity passed and all pre-upgrade logical rows remained unchanged: 3 projects, 54 conversations including bin, 149 messages, with original content and parent links. Private backups remain outside this evidence folder. Installer removed the pinned shortcut; it was restored and Desktop, Start menu and pinned shortcut targets verified against the installed executable with no development arguments.

## Qualifications

Three preliminary lightweight Luna probes did not meet the explicit search-plus-read/value criterion: a search snippet could suffice for a one-line fixture, and one multiline attempt returned the field identifier rather than its value. The clearer final probe used normal main models and passed. A required evidence-attempt guard now allows one corrective retry before refusing an ungrounded answer. This does not guarantee every model follows every instruction or that tool use proves an entire answer.

Folder tools in Work together and Independent jobs are bounded read/search only. Folder permissions expire at restart. Shared saved sessions remain readable without a current grant. Automatic conversation remains text-only. File changes and checks belong to Build a project and its existing approval flow.

Fresh Windows PC acceptance, publisher/provider distribution review and signing remain open; Mac is deferred. No original Graviton installation/profile was changed. No public upload or contract acceptance occurred.
