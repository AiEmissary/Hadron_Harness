# Revision80 validation

432 server tests passed, 5 skipped, none failed. The 48 coordinator cases include actual Windows replacement through a real coordinator scope and explicit test-only trusted consent. Other coordinator journal/failure cases use the declared filesystem fixture; they do not independently establish native metadata preservation. The 4 separate Windows commit tests retain their native metadata coverage. Additional worker/journal tests:55 passed. Legacy orchestrator:16 passed.

Server/Electron/mobile typechecks and Electron main/mobile build passed. The full server suite, server typecheck, main/mobile build and all three actual startup fixtures passed after the final restricted-boot/storage-failure changes. No renderer source changed or renderer rebuild was needed.

Built startup fixture: node scripts/check-hadron-execution-startup.mjs. It cold-starts the actual main.mjs, server, preload and existing built UI in separate disposable profiles with utility mode configured. Project session: clean gate, pending legacy job and arguments unchanged, no utility available or custom implementation import. Standard session: actual utility available and legacy activity observed. Corrupt-marker session: viewer/server available in frozen restricted mode, no utility, execution denied and damaged evidence unchanged. The initial diagnostic fixture incorrectly assumed utility mode was the desktop default; it was corrected to explicitly request utility mode and verify actual initialization rather than just a marker.

Existing native reader regression: node scripts/check-hadron-desktop.mjs --project. Real desktop/UI/IPC/server and temporary files, simulated model/picker; bounded line read, revoke and missing-grant send denial passed. No project writes or commands.

Reproduce server: npm run test:server. Additional regressions: npm run test:headless -- server/headlessServer/services/__tests__/agentJobJournal.test.ts server/headlessServer/services/__tests__/subagentRunService.test.ts and npm run test:tools -- server/tools/orchestrator/__tests__/ToolOrchestrator.test.ts.

No real subscription request, personal project edit, user-app restart or installed Graviton change. The platform tests did execute the fixed Windows metadata helper on disposable files. No general project shell/build/test capability, native edit grant or live Build UI is enabled. Previous-process recovery proof and advanced metadata policy remain unaccepted. Summary and this README are mirrored into local Git; raw reports/output remain in the root validation directory.
