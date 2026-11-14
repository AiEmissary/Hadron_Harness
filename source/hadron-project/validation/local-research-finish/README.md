# Research-limit failure repair — local test, 9 November 2026

The user's first folder collaboration failed because one provider spent all eight model requests requesting research and never returned a final answer. The coordinator then aborted its partner before the atomic proposal checkpoint or cross-review. The previous attempt failed the same way with the other provider. This was a host protocol limit, not an authentication or file-access failure. Original sessions remain failed and their saved activity/logs are preserved; no paid task was automatically rerun.

The last allowed request is now final-answer-only. Maximum requests remain eight, with at most seven tool operations. If a model still requests another tool, Hadron executes nothing further and preserves a bounded, explicitly host-labelled partial evidence record. The collaboration shows a separate partial-research warning even if review/synthesis completes. This is not a completed assessment or verification. Structured edit proposals fail safely instead of interpreting that fallback as changes. Abort behavior is retained.

Old budget failures have a specific explanation in the response pane. Tree refresh now happens on every terminal outcome, including failure/interruption. Auditing a private SQLite copy established that the user's saved agent-tree records were readable; the exact transient UI load failure was not independently established. No history was deleted or rewritten.

92 focused tests passed (41 protocol/read, 37 headless collaboration/review, 14 renderer); production builds/typechecks passed. A native desktop fixture made both providers keep researching through the final request, then exercised peer review and combined answer, visible warning and recovered history. The test used 25 synthetic generation calls and zero real provider requests. Installed-resource startup diagnostic passed. All baseline logical rows in all three databases survived, and SQLite integrity passed; see local-application-result.json.

Only the installed application resources changed. EXE and Desktop installer hashes are unchanged. No installer or source ZIP was rebuilt. The current Desktop installer remains the earlier baseline and lacks these local changes. Original Graviton, Windows display and pointer settings were untouched.

The installed app has reopened for local acceptance. Select the folder again after restart, use New collaboration, and explicitly start a repeat test. Old failed sessions are not resumable completed proposals. Evidence and agreement do not prove whole-project correctness.

Private rollback resources: Local-Test-Builds/access-hGTn1C under the user's local Hadron data contains baseline-app.asar and baseline-localAnalyticsWorker.mjs. Private online DB backups: Local-Test-Backups/research-20261109-130938. With Hadron closed and idle, roll back application resources only; never overwrite newer user work with old DB backups just to undo code.
