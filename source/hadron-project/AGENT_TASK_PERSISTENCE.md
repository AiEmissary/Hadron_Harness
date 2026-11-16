# Claude outcome transport and task persistence — 16 November 2026

## Verified failure

The reported shared task started at 09:45:18 UTC. Its Claude Sonnet implementer ended at 09:47:27 with `completion_unconfirmed`, retaining a 3,924-character report. ChatGPT's independent reviewer completed at 09:46:42. Both were admitted with the same ten-minute shared-task budget, and the Claude run used worker contract v7. Its three PowerShell operations completed, confirming that the implementer had coding/execution tools. The separate ChatGPT stage was deliberately read-only. There was no recorded timeout or provider rejection in this task.

The preceding outcome correction had changed the broker's Agent contract to require an explicit `finished` boolean, but did not update Claude's final formatter instruction or its CLI JSON schema. That transport still demonstrated only an answer without the flag and did not declare the flag in its schema. The host therefore rejected the outcome after its one format correction. Earlier full-desktop fixtures substituted a common synthetic generator for both providers; they verified status propagation but did not exercise this Claude-specific schema boundary.

Application metadata and public reports were read only. The original task and project were not replayed or edited during this investigation.

## Corrections

- Claude's Agent formatter schema now explicitly declares and requires its boolean outcome. The final formatter instruction agrees with the host contract. Completed, unfinished and blocked final outcomes survive the CLI's acknowledged `StructuredOutput` exchange.
- The tested pinned CLI uses a compatible flat schema. Tool messages carry `finished:false` as transport metadata; only that false metadata and empty optional placeholders are removed before the host's exact tool-request validation. A tool mixed with a completed or blocked final outcome is rejected before execution. Final answer flags are preserved. The ordinary structured-proposal path remains compatible.
- A candidate union/length-constrained schema was rejected during the live developer probe. It was replaced before delivery, with runtime validation retaining the exact-shape and length rules. Anthropic documents limits on its structured-output schema dialect: [official structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). The final CLI path has a successful real-provider check rather than relying on an assumed schema dialect.
- Agent execution now continues the same assigned task after a partial report while genuinely new successful operation evidence is being returned. It no longer ends merely because the single earlier outcome check was used. Current task, transcript, operation receipts, request allowance and coordinator deadline remain in the same job; no previous job is automatically restarted.
- A model can end unfinished work for an explicit external blocker using `blocked:true` and a concise `blocker`. The report labels this an agent-reported blocker, not independent host verification. Missing outcome confirmation still receives one format correction. Three partial reports with no new successful evidence stop as `agent_stalled`. Repeating an identical successful read does not count as progress. User Stop, permissions and existing request/time limits still apply.
- Shared feedback distinguishes a stalled assignment from a provider failure. Successful operations are not replayed to recover output or restart the task. A completed analysis request need not edit code, and permission to code does not expand a discussion request into unrelated implementation.
- The appointed implementation prompt no longer describes itself as read-only. Agent instructions have a dedicated read/write/command contract rather than embedding and later overriding a whole read-only contract. The same bounded read catalog is reused. Agent B's independent analysis and the later reviews remain read-only; synthesis has no tools. No permissions were widened and no interface controls were added.
- How to use Hadron describes progressive task execution, explicit blockers, stalls and limits. WORK_COMPLETION_OUTCOMES.md is the preceding historical checkpoint; its one-check continuation policy is superseded here.

## Verification

265 focused automated checks passed: 81 tool/protocol/helper/permission checks, 157 native-provider/worker/shared-workflow/status checks and 27 interface/transport/notification checks. The new Claude adapter regression inspects the actual emitted CLI schema and prompt file, then processes acknowledged native formatter frames through the real adapter. It completes read → partial report → edit → partial report → test → confirmed completion, without replacing `generateText` with the old shared fake.

The full isolated desktop host/SQLite/renderer check passed 24 synthetic provider jobs with zero real provider requests in that fixture. It verified two progressive partial reports followed by an actual disposable file edit, passing test and completed reply. Explicitly blocked and unconfirmed jobs retained their text and Not finished labels. Shared-to-single handover, joint synthesis, continuous consensus, long supplied context, copy/append, reload without inference, restored folder and connection refresh also passed. Only the existing unpackaged Electron/Supabase warnings were recorded.

A separate live check used the existing Claude Code account through the pinned CLI and actual `ClaudeCodeRuntime` with Haiku. It made a real edit in a disposable calculator folder, ran its Node test successfully through the existing PowerShell tool, and returned a confirmed complete outcome. Its native worker, runtime prompts, configuration and project work were in a temporary profile; only the official CLI's existing account directory was reused. No credential files were copied or printed, no sign-in/out was started, and no application chat database or unsent draft was opened. The successful live test used Haiku; it is not a claim that every long Sonnet task or every user project will finish.

The live developer check requires an explicit `node scripts/check-claude-agent-runtime.mjs --live` invocation and is not part of the packaged app's file whitelist. Initial probe setup/containment failures and the rejected candidate schema were corrected before the successful run; they are not counted as passes. Local evidence is in `test-results/agent-persistence-*.log`, `agent-persistence-desktop-result.json` and `agent-persistence-live-claude-result.json`.

Production renderer/main/mobile builds, required TypeScript checks and a final Electron typecheck passed. Checked source is committed and backed up using the curated private GitHub export. Saved user conversations, drafts and the open window were preserved.

## Loading and installer

Save/copy any draft, close Hadron and reopen through the existing Desktop shortcut to load this local host and renderer. Continue explicitly from the saved chat. The failed historical task is unchanged and was not automatically replayed. Existing provider limits, task budgets, genuine blockers and Stop remain meaningful; this is a follow-through correction, not a guarantee of unlimited execution or independently verified correctness.

The delivered 6.0.6 installer and its release assets are unchanged. No installer rebuild was authorized in this pass.
