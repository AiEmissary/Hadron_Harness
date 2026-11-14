# Revision76 validation


## Revision76 - editing journal foundation and approved project entry (2026-11-06)

The user supplied a successful real Agent A project-read answer: README.md and src/calculator.js were read, add(a,b) was correctly explained, a negative-operand test was suggested, and the answer correctly stated no edits/tests ran. The selected-project native-picker/subscription acceptance is complete.

Implemented a coordinator-only ProjectWriteStore backend in server/hadronTools/projectWrites.ts. It has immediate SQLite transactions, overlapping parent/child folder exclusion across connections/owners, opaque process-local lease handles, immutable before/after text proposals and SHA-256 snapshots, exact-snapshot Agent B review records, retained review/proposal history, one bounded staged correction, expected-hash text create/replace, write-start and applied/uncertain receipts, partial-batch reporting and read-only recovery inspection. It never replays a completed, superseded or uncertain operation. A reopened host cannot recreate a write capability from serialized IDs; interrupted leases remain held for intervention. SQLite FULL synchronization is required.

This is a backend foundation, NOT an enabled editing feature. It has no production import, HTTP/model tool, permission grant, provider runner or live UI connection. The argument identifying reviewer B is trusted coordinator metadata, not authentication in itself. Do not expose recordReview or apply as model-callable approvals. Before enabling writes, finish authenticated role/admission integration, cover inherited tool/Node module/IPC/shell/MCP/hooks/REPL paths, implement explicit interrupted-operation intervention and review file-mode/ACL preservation. Existing parent folders are required; deletion, moving, directory creation and commands are not implemented. Operation atomicity is per file, not all-or-nothing for a batch. Tests cover process/storage failure handling; do not claim OS power-loss or non-cooperating external-writer containment certification.

Windows tests found inode values beyond JavaScript's safe integer range. Folder/file identity and timestamps now use BigInt statistics; persisted writer identities use decimal text. The existing project reader shares the same path policy through projectPaths.ts and also uses exact identities.

Validation: 19 editing backend tests plus 9 project-read tests passed. Full server suite: 352 passed, 5 skipped. Server/Electron/mobile typechecks and Electron main/mobile build passed. Built desktop reader regression passed with real temporary files, simulated model/picker, read/revoke/block behavior and zero project writes/commands/real provider requests. The user's successful real reader acceptance remains recorded separately. No personal project files, Graviton files or running user apps were modified/restarted.

Design: design/project-building.html is an interactive, isolated three-pane design preview, not live execution. Screenshot and design audit are in validation/revision76. It has no native bridge/network/AI or file access; tree/review/log navigation and simulation controls were checked. The user explicitly chose a new Build a project entry beside Work together and Independent jobs. Keep those three entry points and the existing three-pane layout when integrating. Agent A is the initial implementer and Agent B is read-only reviewer. The preview proposes showing changes before apply; automatic application was not requested/approved by this design choice.

Later visual requests from the user, intentionally deferred while project work proceeds:
- Open Hadron maximized to fill the desktop, retaining normal window controls.
- Full-page logo introduction/login screen, with the word Hadron at the bottom; use the existing user-supplied logo.
- Sign-in configured specifically for Hadron, separate from Graviton. Do not reuse Graviton account data or upstream OAuth branding/client registrations. Confirm the intended app-account versus provider-subscription login when this stage is implemented; the current local workspace/subscription behavior remains the accepted baseline.
- Larger project name centred at the top of the workspace.

Next implementation: wire the approved Build a project entry to a persisted task/stage coordinator and authenticated implementer/reviewer capabilities; complete execution-path exclusion and recovery controls before enabling canonical project writes. Keep proposal/review snapshots visible and tests explicitly not run until actual command containment and receipts exist. No user action is needed on the current backend foundation.
