# Assigned-work completion and reply status — 16 November 2026

Follow-up: AGENT_TASK_PERSISTENCE.md supersedes the one-check continuation policy below and corrects the missing Claude-specific schema integration. This document records the preceding checkpoint.

## Problem

The reported shared run completed both proposals, both reviews and its combined answer. Its appointed implementer described only a partial investigation. Coding permission was present, while later review/summary stages were deliberately read-only. Two early failed searches were followed by successful operations. This was distinct from the earlier transport/time-limit failures.

Agent-mode final answers could omit the existing `finished` boolean and still be treated as successful. Thus the response could end normally while the assigned work remained incomplete. The interface also used the same Completed label for ended replies and completed operations, and Not finished for individual failed tool attempts.

## Correction

- Native selected-folder Agent admission now requires an explicit final completion outcome. It is preserved through public-web composition, helper decoration and coordinator deadlines. Read-only/Chat and legacy structured proposal contracts retain their existing behavior.
- Agent final reports use `finished:true` when the current request is fulfilled, or `finished:false` with available findings and an actual blocker. A completed discussion or analysis need not edit files or run tests. An incomplete wider project does not automatically make a fulfilled advice request incomplete.
- With remaining request/time budget, the host allows one outcome correction. An omitted outcome asks for explicit confirmation. An unfinished report asks the agent to continue possible authorized work or explain a real blocker. The original task, operation receipts and transcript remain in the same bounded tool conversation. This is not a fresh job, a replay of previous operations or an unlimited review/implementation loop. User Stop and existing task budgets still apply.
- A repeated partial report remains `agent_incomplete`. An omitted outcome after the correction, or with no budget for correction, becomes `completion_unconfirmed`. Both retain the available report and are persisted as unfinished worker results. Existing failed-result handling supplies Not finished in the transcript/tree and the corresponding notification. A failed implementation does not proceed to a falsely successful combined answer; available peer replies remain recoverable under the existing shared stop policy.
- Shared feedback explains unfinished assigned work separately from a failed provider reply. Worker contract v7 asks the implementer to persist within its actual scope and budget. Reviews/summaries must not infer that the implementer lacked coding permissions merely because their own stages cannot edit.
- Activity says Reply finished for ended agent replies and Joint reply finished for the ended combined response. Individual failed operations say Failed, preserving the distinction between a recoverable search error and unfinished assigned work. Actual successful operations still say Completed. No buttons or modes were added. How to use Hadron is updated.
- Helper decoration also retains the inherited absolute deadline, alongside the new completion requirement.

This is a model-reported completion check, not independent proof of code correctness or a guarantee that every assigned task will finish. Historical completed replies are not retrospectively reclassified from natural-language guesses. Saved chats, drafts, sign-ins and the original reported run are preserved.

## Verification

203 focused automated checks passed: 78 tool/protocol/helper/permission tests, 98 worker/shared-status/prompt/folder tests and 27 interface/transport/notification tests. New coverage includes a partial report becoming unfinished with its text preserved, an absent outcome being corrected once, continuing authorized work after a premature partial answer, no completed-operation replay, explicitly completed analysis without edits, no extra clarification at the deadline/request cap, Stop, preserved completion/deadline metadata through helpers, specific shared feedback and separate reply/operation labels.

The production renderer/main/mobile builds and TypeScript checks passed. The final main build includes the bounded persistence check. The isolated real desktop host/SQLite/renderer test passed both partial-work and unconfirmed-work requests: each retained its report and displayed Not finished after the bounded check. Normal actual edit/test, single/shared handover, joint synthesis, continuous consensus, long pasted/attached continuations, copy/append, inference-free saved reload, folder restore and connection refresh also passed. There were 23 synthetic provider jobs and zero real provider requests. The fixture uses a disposable calculator folder, not the user's profile or trading project. Only the existing unpackaged Electron/Supabase warnings were recorded.

Evidence is in `test-results/work-outcome-*.log` and `work-outcome-desktop-result.json`. Notification outcome/voice wording is covered by the focused interface tests; native delivery still depends on Windows settings.

## Loading and release scope

Save/copy unsent text, close Hadron and reopen through the existing Desktop shortcut to load the local host and renderer. New Agent requests receive the outcome contract. Previously saved answers remain unchanged and available for explicit continuation. No original user request or project operation was replayed during this work.

The delivered 6.0.6 installer and its release assets remain unchanged. No installer rebuild was authorized in this pass. Checked source is backed up through the curated private GitHub export.
