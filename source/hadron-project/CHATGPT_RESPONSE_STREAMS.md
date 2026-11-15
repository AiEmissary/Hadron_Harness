# ChatGPT response-stream investigation and correction — 15 November 2026

## What the saved record proves

Read-only Hadron metadata shows that Claude completed its proposal in 39,159 ms. ChatGPT failed after 137,951 ms, before any ChatGPT broker tool operation was recorded. The shared workflow stopped in its proposal phase, so its combined-answer stage never ran. The available Claude report stayed saved. This was not the earlier five-minute Claude timer cutoff.

The saved ChatGPT diagnostic contains one request, stage `stream`, `completed: false` and category `incomplete`. The old code reused that category for an upstream interruption, malformed stream, disallowed event, explicit provider failure and internal stream limit. It also overwrote its first process diagnostic with a generic failure record. There are no historical byte/event counters or specific failure code for this attempt. The precise trigger of this historical failure cannot be reconstructed; neither quota exhaustion nor context rejection is established by this record.

## Defects corrected

- The proxy counted every byte of SSE protocol traffic against a cumulative 2 MB ceiling, including reasoning and repeated event envelopes. A short final answer can legitimately arrive after more traffic than that. The proxy now bounds the retained pending frame (8 MiB) and answer (200,000 characters) separately, without the cumulative traffic cutoff.
- Job-mode CLI stdout/stderr were separately subject to a cumulative capture limit, even though the answer comes from the guarded transport. These unused logs are drained without retention or a cumulative capture cutoff. Process timeouts, cancellation, pipe errors and joining the actual process close remain in force. Sign-in/probe captures retain their original limits.
- A validated `response.completed` with a nonempty canonical final message ends the stream promptly. Hadron no longer waits for the upstream socket to close after that terminal event. Commentary alone, text deltas without completion, empty final output and unsupported native tools cannot establish successful completion. A failed CLI exit still fails the job even if the provider terminal event arrived.
- Failure feedback distinguishes premature EOF, malformed framing/JSON, individual frame/answer processing limits, native tools, network errors, known provider context/usage/output-limit codes and other provider failures. Raw provider error bodies, reasoning, prompts, credentials and CLI logs do not enter diagnostics.
- One whitelisted diagnostic records elapsed time, actual capture result/category, byte/event counters, known last event/item types, output character count, provider completion and overall job completion. A second generic callback no longer erases the first record. Historical generic errors are retained as historical errors rather than guessed retrospectively.
- Shared-task feedback retains the new specific reasons. Explicit provider input-context rejections still enter the existing bounded context-condensation path where applicable, without repeating an already completed file operation. Interrupted streams are not automatically retried. How to use Hadron explains the distinction.

No original provider request, chat or trading-project operation was replayed during investigation or testing. No user window was closed. Available work, chats, sign-ins and unsent messages were preserved.

## Verification

171 distinct automated tests passed: 117 runtime/stream/process/tool/context checks and 54 shared-workflow/review/deadline/status checks. Synthetic transport integration uses the real loopback guard and fake upstream streams, with no paid provider requests. Coverage includes more than 2 MB of valid reasoning traffic followed by a short confirmed answer, terminal completion without socket EOF, split UTF-8/CRLF, premature EOF, malformed JSON, excessive individual frames/answers, provider error codes, commentary-only output, nonzero worker exit, private diagnostic exclusion, no automatic retry, process cancellation/join, and context condensation without operation replay.

Production renderer/main/mobile build and TypeScript checks passed; the final main build includes the completed diagnostic changes. The isolated real desktop host/SQLite/renderer regression also passed: single/shared handover, a disposable actual file edit and test, consensus, long pasted/attached continuations and their summaries, copy/append, saved reload without inference, connection refresh and folder restore. It used 21 synthetic provider requests and zero real provider requests. The user's profile was not the test profile. Only the existing unpackaged Electron/Supabase warnings were recorded.

Results are recorded locally in `test-results/chatgpt-stream-*.log`; historical read-only evidence is in `test-results/chatgpt-stream-investigation.json`. These checks exercise reproducible transport defects; they do not prove the old historical attempt hit the removed traffic limit or guarantee every provider request will succeed.

## Loading and installer scope

Save or copy unsent text, close Hadron and reopen through the existing Desktop shortcut to load the local update. The already failed task is not automatically rerun. The 6.0.6 installer and its release assets are unchanged; no installer rebuild was authorized in this pass.
