# Revision73 validation


## Revision73 - saved shared workspace navigation (2026-11-06)

The user's screenshots confirm a real public-URL shared answer with recorded tool evidence and a successful Continue with both follow-up. The later screenshot manually recovered that same answer and both agent trees: the chats were saved. Read-only inspection confirmed the root and completed follow-up were owned by a managed hadron-job conversation that had become a workspace itself.

Fixed: opening a managed conversation that owns shared sessions now retains its own workspace scope before consulting its original private-agent provenance. Ordinary private entries still reopen their owning workspace and selected agent branch. Shared answer selection is persisted as a navigation ID only; an earlier selected answer survives reopening rather than being replaced by the latest admission reference. Recovery reads the last admission with GET, enabling continuation after confirmation without retrying inference. Ownership checks remain in force; no user database changes, model requests, Graviton edits or app restarts were performed for this repair.

Validation: 8 focused headless branching/ownership tests; 1169 renderer tests passed, 1 skipped. Renderer build, server/Electron/mobile typechecks and main build passed. Built desktop fixture created a private chat, admitted a shared verification task inside that managed scope, continued with both, forked from an earlier combined answer, and selected the original answer again. Cold launch plus opening the saved project-list entry restored the shared pane, original selected answer, both trees and actual QuickJS evidence with zero inference requests. Existing independent A/B project-list restoration and branching regression passed (9 independent turns, one shared workflow, 14 logs). These fixture models are synthetic; the user's final personal restart/reopen check remains outstanding.

Next: quit Hadron normally, reopen its shortcut, and open the saved project/chat if startup shows Quick Chat. Its Shared task answer and tree should appear automatically, without switching out of Independent jobs manually. No sign-out needed. Confirm this before advancing to project-file editing/build execution; the wider TODO order remains Windows MVP first.
