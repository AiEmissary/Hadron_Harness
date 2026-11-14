# Common file access and large-file excerpts — local test, 9 November 2026

Source revision 53a86b8. This is a local application-resource test on installed 0.4.17, not a new installer release. The installed EXE and all installer EXEs were not modified or rebuilt. The application archive/resources were staged from the installed baseline, with unpacked flags preserved and native files verified unchanged, then applied after a normal idle shutdown. A packaged startup diagnostic passed using an isolated profile and zero model requests; the original workspace reopened afterward.

## Behavior

Every workflow exposes Access: Chat only, Read files, Edit and test — reviewed changes. Choosing Add folder enables scoped read access. Chat only does not pass the selected folder grant; deliberately attached text remains supplied. Independent agent grants, shared collaboration grants and automatic-conversation grants are isolated by owner/workspace/slot and expire on restart. Remove folder revokes access. Build includes read/search and reviewed editing; choosing its Chat only or Read files prepares a shared draft and requires selecting the folder there.

Edit and test from the other workflows prepares the current instruction in Build a project without starting inference or transferring attachments, folder authority or write consent. Choose the project folder/models there, prepare a proposal, inspect exact before/after, approve application, and approve checks under the existing host controls. Existing tasks/chats remain saved. This is not an unrestricted editor in every chat mode.

Automatic conversation can now supply bounded project_list/search/read to either agent. Replies permit up to four model requests; memory compaction has no tools and uses one request. The existing turn limit counts reply/memory runs; underlying tool requests can exceed it, as explained in setup. No helpers, writes or shell are enabled by this read permission. Host Folder activity is persisted and shown. Admission/resume checks the grant; saved history remains readable after a grant expires. Explicit continuation never inherits a stale grant automatically.

Attachments accept up to five files, each up to 8 MiB. The 16,000-character shared-context budget remains. Large UTF-8 text opens an explicit excerpt picker: start line, up to 200 lines, local find, exact preview and explicit confirmation. Up to 8,000 excerpt characters are supplied and clipping/omission is labelled; the attached name says excerpt. Original files remain unchanged. PDF/Word extraction retains its existing text budget. Folder direct reads support text up to 16 MiB, return at most 200 lines/8,000 characters, and retain full-file hashes and identity checks. Content search is capped to 8 MiB per operation; large/skipped/truncated results are not proof of absence. Line scanning avoids arrays containing every line of a large log.

## Checks

14 renderer tests and 40 server tests passed. Production renderer/main/mobile builds and typechecks passed. Native desktop test covered all four Access controls, exclusion of an already-selected folder in Chat only, a >64 KB log with explicit line selection, both GPT/Claude fixture adapters reading the actual selected folder in Automatic conversation, host activity, and a reviewed-edit handoff requiring new folder authority and sending no extra request. Full shared-folder collaboration and text-only continuous-conversation regressions passed, including compaction, Pause/Stop, saved continuation, draft placement and sidebar toggle cycles. Tests used synthetic inference and temporary profiles; no paid provider request was made.

All original logical rows survived the local update, SQLite integrity passed in all three databases, and current history is 3 projects, 56 conversations including bin and 158 messages. See local-application-result.json for EXE/resource hashes and unchanged installer hash. Private database backups and rollback application archive/worker are outside this evidence folder. Do not restore a database backup over newer user work just to roll back application code.

## Recovery and next step

User acceptance is pending. Test these changes in the installed app. Folder grants must be selected again after restart. Do not update an installer or source ZIP until the user explicitly says ready. Current Desktop 0.4.17 packet remains its pre-change baseline and does not contain these local features.

Rollback application resources: private Local-Test-Builds/access-gPkID6 contains baseline-app.asar, baseline-localAnalyticsWorker.mjs and staging.json. With Hadron closed and idle, restore those two application resources only; preserve user databases. Application archive integrity validation was already disabled in the existing Electron fuse configuration; no fuse, display, mouse, Windows security setting or executable was changed. Original Graviton is untouched. No desktop inspection tool was used for this implementation.
