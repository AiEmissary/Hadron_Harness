# Hadron workspace

The application is Hadron Harness. Its original working Git checkout is source; the Electron app is source/ygg-chat/client/ygg-chat-r. Preserve user chats, provider sign-ins and unsent messages when testing.

## GitHub backup

The user owns the public repository https://github.com/AiEmissary/Hadron_Harness and requested regular updates for safekeeping.

On the original development PC, commit and check completed application changes in source, then run python Sync-Hadron-GitHub.py --push from this workspace. This exports committed Hadron source, build instructions and licences to the separate github-backup checkout and verifies the pushed commit. Do not push the original checkout's full history: the curated export deliberately excludes local account metadata. Never upload credentials, chat databases, account configuration, dependency folders or build caches. Never force-push. The user explicitly authorized public visibility on 24 November 2026; do not change visibility again unless the user explicitly requests it.

Only rebuild an installer when the user authorizes it. After an authorized installer is built and verified, python Sync-Hadron-GitHub.py --push --release backs it up as a release asset. Existing release assets must not be silently replaced. Read GITHUB_BACKUP.md for scope and recovery. No unattended schedule has been configured.

In a restored GitHub clone, use normal Git commits and pushes instead of the original-workspace export command.
