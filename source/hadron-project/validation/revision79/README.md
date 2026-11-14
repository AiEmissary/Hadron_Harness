# Revision79 validation

Full server suite:411 passed,5 skipped. Focused modules total78: execution gate14, coordinator35, writer25, actual Windows commit4. The final coordinator terminal-before-marker-release ordering change was then checked with all35 coordinator tests passing again. Server/Electron/mobile typechecks and Electron main/mobile build passed before this final statement-order-only adjustment.

Windows tests invoke the actual system Windows PowerShell/.NET File.Replace adapter in disposable folders under the OS temp directory. They verify protected DACL/owner/group, Hidden/Archive attributes, creation time, named-stream preservation, Unicode/metacharacter paths, read-only refusal, changed-permission retention and receipt loss after a real replacement. Their write admission is bound to a real temporary execution scope. Journal tests explicitly use a fault-injection filesystem adapter and are not used as native ACL evidence.

Recovery tests cover fresh/stale observations, unknown/manual versions, changed permissions, worker activity, foreign/restarted hosts, serialized/async assertions, durable reconciliation, a failed execution-marker release, new explicit closure and zero paid/write replay. Default canonical apply without host admission is denied. Previous-process unlock remains unavailable; restarted inspection does not issue write authority.

No real provider requests, user-project edits, user-app restarts, installed Graviton changes or project build/test commands occurred. Fixed platform-helper processes did run for the isolated Windows metadata tests. No desktop reader repeat was needed: live routes/UI and reader behavior were unchanged. Live editing remains disabled.

Raw full-suite JSON/output remain in this root validation directory; the compact summary and this note are mirrored in Git. Reproduce from source/ygg-chat/client/ygg-chat-r:

    npm run test:server
    npm run test:server -- server/__tests__/hadronWindowsCommit.test.ts server/__tests__/hadronProjectWrites.test.ts server/__tests__/hadronProjectBuildCoordinator.test.ts server/__tests__/hadronExecutionGate.test.ts
    npm run typecheck:server
    npm run build:electron:main

See PROJECT_RECOVERY.md for supported metadata, fail-closed cases and activation gaps. No Mac/enterprise auditing/OS power-loss acceptance is claimed.
