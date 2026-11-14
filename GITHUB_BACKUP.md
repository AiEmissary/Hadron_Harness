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
