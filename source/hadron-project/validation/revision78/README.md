# Revision78 validation

Implemented the cooperating-host project execution gate, guards at audited legacy entry points, and binding to the host-only project coordinator. Production writer admission remains disabled: the singleton has no configured durable project ledger. No live UI route or canonical apply operation was enabled.

The full server count is in test-summary.json. Focused checks include 13 gate cases and 31 coordinator cases. Production protected worker/REPL regressions passed 88 cases; legacy chat passed 27 with 22 skipped. Selected tools passed 45 with 5 skipped; all 16 orchestrator cases passed again after the final interrupted-queue no-replay fix. Server/Electron/mobile typechecks and Electron main/mobile build passed.

The built desktop reader fixture used an isolated temporary profile, actual bounded file reads and the existing native/IPC/server/database path with simulated picker/provider. It passed revoke and send-block behavior with zero project writes, commands or real provider requests. Its result is retained as project-reader-result.json. It ran before the last queue-submission/interruption tweak; the final main rebuild and targeted orchestrator checks include that tweak. No running user app or Graviton process was restarted or edited.

Raw test reports/outputs stay in root validation/revision78; this note, the summary and desktop result are mirrored in Git. This is cooperative application exclusion, not OS containment. PROJECT_EXECUTION_BOUNDARIES.md lists the remaining startup, recovery, permission/metadata and UI activation requirements. Do not clear a held marker merely to enable writing.

The execution scope ID is durably linked to the build record before acquiring its folder lease and checked against the live capability before provider admission. After this final pre-activation schema linkage, all44 focused gate/coordinator cases and server typecheck passed. The earlier full-server total remains397 passed/5 skipped; production chat schema remains unchanged.
