# Revision 104 - fix missing milestone desktop bridge

User reported the minified error `we.milestones is not a function`. Root cause was not their project: the renderer and shared ProjectDraftApi expected milestones, accept and nextMilestone, but electron/preload.ts never exposed those three IPC forwarding functions. The compiled preload also lacked them. The host handlers already existed. Earlier desktop fixtures exercised project flows without rejecting this optional-list refresh alert, so they did not catch the missing connection.

Added all three forwards, with exact argument order, and a `satisfies ProjectDraftApi` assertion on the actual preload object so missing future methods fail Electron typechecking. Added a regression test which compiles/evaluates the real preload with mocked Electron transport, checks all project methods are functions and verifies exact milestone/list/accept/next IPC arguments. No fake UI milestone shim is used.

The project screen now gives a plain full-restart instruction if an older preload is loaded, rather than displaying a minified TypeError. Actual desktop folder fixture explicitly calls the real milestone IPC before proceeding. The final packaged startup diagnostic checks the three methods and invokes milestones for its actual current owned workspace; projectBridgeReady must be true.

Passed: preload contract regression, Electron/mobile typechecks and production renderer/main builds, actual desktop folder-only search/read/review with the real bridge, and final 0.4.4 packaged startup with projectBridgeReady true. No model charges, personal project edits or profile changes. Installer/source artifact hashes follow. Existing separate-PC and version-upgrade reliability qualifications remain in RELEASE_VALIDATION.md.
