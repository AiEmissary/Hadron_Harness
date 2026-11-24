# Hadron Harness

Source code and Windows releases for the Hadron Harness desktop application.

[Download the latest Windows installer](https://github.com/AiEmissary/Hadron_Harness/releases/latest).

Current release: **6.0.8**.

- Questions and answers on the left, conversation branches on the right.
- Agent A, Agent B, Work together and Continuous conversation.
- Chat and Agent permissions, folder/file tools, visual previews and saved projects.
- Browser OAuth for ChatGPT, optional device codes, and Claude Code print mode.

## Build and restore

Read [SOURCE_BUILD.md](SOURCE_BUILD.md) and [WINDOWS_RELEASE.md](WINDOWS_RELEASE.md).
The application sources are in source/ygg-chat. Licences and notices are in distribution/licences.
SOURCE_REVISION.json identifies the original checked source revision and file hashes.

Personal chat databases, provider credentials, local account settings, dependencies and build caches are excluded.
Large installers are kept in GitHub Releases rather than source history.

## Updates

On the original development PC, run python Sync-Hadron-GitHub.py --push after committing and checking changes.
The updater exports only committed source and reviewed build materials. It does not force-push.
On a restored clone, normal Git commits and pushes can be used.
