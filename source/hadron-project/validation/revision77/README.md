# Revision77 validation

The new host-only project coordinator is not connected to live application routes, native grants or UI; canonical writes remain disabled. No app rebuild is needed for this unactivated server-only foundation. No user apps were restarted.

- Full server suite: 380 passed, 5 skipped. The last two added tests were then run in the final focused coordinator suite: 29 passed.
- Writer: 20 passed; reader: 9 passed; production worker regression: 52 passed. Server typecheck passed.
- Coordinator tests use disk-backed Node SQLite, actual temporary project files and automatic per-agent Markdown logs. Five original plus two later integration cases use the production SubagentRunService/ToolLoopService with a simulated provider and run-persistence adapters. No network/model requests or commands.
- Covered actual-run binding, frozen source evidence, one correction, stale reviews, cancellation/deadline, no retries, forbidden tool calls, worker termination, restart/no replay, offline diffs, ownership revocation, partial invalid proposal, journal/storage failure and UTF-8 BOM fidelity.
- Root validation contains raw JSON reports and command output. The compact summary and this note are mirrored in Git; raw reports are local validation evidence.

Reproduce in source/ygg-chat/client/ygg-chat-r:

    npm run test:server
    npm run test:server -- server/__tests__/hadronProjectBuildCoordinator.test.ts
    npm run test:headless -- server/headlessServer/services/__tests__/subagentRunService.test.ts
    npm run typecheck:server

Pending: inherited execution exclusion (including existing background work), explicit interrupted write intervention, file-mode/ACL policy, authenticated native/UI wiring and disposable-project live acceptance. No project test/build success is claimed.
