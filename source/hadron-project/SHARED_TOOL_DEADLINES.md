# Shared Claude timeout investigation and correction — 15 November 2026

## Verified cause

Read-only inspection of the reported saved task showed that the shared coordinator admitted a 600,000 ms task budget. Its Claude Sonnet participant started at 21:32:46.426 UTC and ended with `The operation was aborted due to timeout` at 21:37:46.514: 300,088 ms later. ChatGPT completed in 74,597 ms. The saved Claude run had no final answer. Initial proposals failed, so the shared review/synthesis workflow did not produce a combined answer; the visible available report was the other participant's saved work.

The Claude runtime imposed its own fixed 300,000 ms limit around the entire tool conversation, overriding the coordinator's longer task budget. Its last recorded operation completed at 21:37:45.406, roughly one second before cancellation. The journals contained 64 completed read/search/list operations across both participants, with no edit/create/delete or command operation recorded. This was active work cut off by Hadron's timer. There was no recorded provider context, usage or sign-in rejection.

The generic DOMException timeout text did not match the existing provider failure-message prefixes, so the UI omitted the reason and only said that the agent could not finish. No task, provider request, user chat or project operation was replayed during investigation. No user file was inspected beyond Hadron's own saved diagnostic metadata.

## Correction

- Shared proposals, reviews and optional verification receive the same absolute coordinator deadline in their trusted host tool session. Applying another deadline can only shorten an existing one; unadmitted copies cannot acquire this metadata.
- Claude uses the remaining admitted task time instead of imposing a separate five-minute cutoff. The existing bounded fallback remains for callers without a coordinator deadline. The coordinator's overall limit and user cancellation still apply.
- The tool protocol reports remaining time and requires a final answer when the deadline approaches. No further operation is executed if the model asks for another tool in that final response; available evidence is preserved with a time-limit outcome. Once the deadline has expired, no new model request or tool operation is dispatched.
- A time-limited partial record remains Not finished. The subagent record retains its available text and explains the task time limit; it is not presented as a completed or verified result.
- Runtime host timeouts and historical unmapped timeout errors have a stable explanation, including elapsed minutes where trustworthy timestamps are available. Whole-session deadline expiry has a plain-language shared-task explanation. Raw account/provider diagnostic details are not exposed.
- Synthesis still has no tools. Ownership checks, folder permissions, request budgets, Stop, worker cleanup and no-automatic-retry behavior are unchanged. How to use Hadron explains task time limits.

This removes the conflicting timeout; it does not promise that every provider request or large task will finish within the coordinator's finite overall budget. It does not rerun or repair the already failed user task.

## Verification

128 distinct automated tests passed: 81 provider/shared-workflow/folder/deadline/status tests and 47 tool-protocol/context tests. Coverage includes the ten-minute deadline reaching both proposals and both reviews, tool-free synthesis, working beyond the former five-minute boundary, actual short-deadline cancellation with a readable reason, early final-report behavior, operation fencing, retained time-limit evidence, expired admission, shorter inherited deadlines, historical saved-status feedback with no provider replay, cleanup and existing folder/context behavior.

Production renderer/main/mobile builds and required TypeScript checks passed. The full hidden desktop regression uses the real native host, SQLite and renderer with synthetic providers: actual disposable file edit/test, shared and single-agent handover, consensus, attached and long pasted continuations, context preparation, copy/append, saved reload, folder restore and connection refresh. Its local evidence is test-results/shared-deadline-desktop.log. The failed first version of the new deadline test expected reviews sequentially; it was corrected to match the existing parallel review workflow. No product failure was counted as a passing test.

The user's open window, chats, sign-ins, drafts and project files were preserved. Diagnostic evidence stays local in test-results/shared-claude-timeout-investigation.json and shared-deadline-*.log. Checked source is backed up to the private GitHub repository through the curated export.

## Loading and installer scope

Save or copy unsent text, close Hadron and reopen using the existing Desktop shortcut to load the local renderer and host correction. No user window was closed automatically. The failed task and available peer reply remain saved; another provider request requires an explicit user action.

The delivered 6.0.6 installer and its release asset are unchanged and do not include this later correction or the preceding continuous-input correction. No installer was rebuilt in this investigation.
