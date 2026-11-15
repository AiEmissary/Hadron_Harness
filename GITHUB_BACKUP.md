# Hadron GitHub backup

Private repository: https://github.com/AiEmissary/Hadron_Harness

The working application source stays in the existing source folder. The small github-backup folder is a clean Git export for this private repository. It has independent history so local account configuration and prior personal metadata are never sent to GitHub.

After committing and checking changes in the application source, run from this workspace:

    python Sync-Hadron-GitHub.py --push

When an installer has been explicitly requested, built and verified, also back up that version:

    python Sync-Hadron-GitHub.py --push --release

Without flags the script only prepares the local export. It refuses uncommitted application changes, edits in the backup working directory, an unexpected repository/account, a public destination, changed existing release assets and unsafe paths. It never force-pushes. If someone changed GitHub separately, those changes must be merged first.

Source, dependency locks, build guides and licences are included. Saved chat databases, credentials, local AI account settings, dependencies and build caches are excluded. The installer is a release attachment rather than a Git source file. Its uploaded checksum and size are checked against the validated Desktop copy. No credentials are written into scripts, Git remotes or reports; sign-in is handled by Git Credential Manager and the browser.

This is a repeatable update step, not a scheduled background backup. Keep the private repository current after completed, checked Hadron work. A restored clone can use normal Git commits and pushes; the export script is intended for the original development workspace.

The latest upload result is saved locally in test-results/github-backup-result.json.

## Release 6.0.3 — 14 November 2026

The user authorized an installer update containing reuse of an existing Claude Code CLI sign-in (with older Hadron sign-ins retained) and sharper tree zoom rendering. These changes have local automated/UI checks and a production build. The 6.0.3 installer and source snapshot are backed up together after installer verification.

## Release 6.0.4 — 14 November 2026

The user authorized the installer update after fixing JPEG admission and stuck task recovery. Pictures have separate durable storage so they do not hit the legacy 64 KiB job envelope. Missing admissions are fenced against late Start before the chat is unlocked; status/output checks retry without repeating model requests. JPEG attachment/vision support and its updated guide are included. Source, installer integrity and packaged startup have local verification; fresh-PC sign-in remains a user acceptance test.

## Release 6.0.5 — 14 November 2026

Final delivery includes the follow-up retry guard: failed/stopped/unavailable independent tasks carry their saved text and pictures into a new explicit request, rather than referencing the failed native parent. The verified 6.0.5 installer supersedes the initial 6.0.4 backup; existing release assets are retained unchanged. 177 automated tests and the final package integrity/startup checks passed.

## Release 6.0.6 — 15 November 2026

The user authorized an updated installer containing the inline branch editor, complete branch transcript browsing, provider-backed web research without an extra search key, restored-notification replay correction and updated help. 86 automated tests, isolated interface and packaged startup checks, build/native/vendor validation and complete installer payload comparison passed. Source and the verified 6.0.6 Desktop installer are backed up as a new private release; earlier assets remain unchanged. Actual clean-PC installation and provider sign-in remain separate acceptance checks. See source/hadron-project/RELEASE_6_0_6.md.
