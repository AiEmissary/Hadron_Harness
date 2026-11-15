# Continuous input and attached-report correction — 15 November 2026

## Cause

The reported refusal was Hadron's client-side continuous continuation check, before a provider request. It combined the current message and supplied attachment text, then imposed a separate 4,000-character limit. The attachment picker could accept a text file which that continuation check subsequently refused. Long initial continuous questions also faced a separate 12,000-character check. Earlier tool-evidence condensation did not cover these paths.

Two further admission stages used old 16,000-character limits: saving the native question anchor and writing a continuous job journal checkpoint. In addition, the readable continuous prompt repeated the latest user instruction three times, unnecessarily multiplying the text and attached data sent to a provider.

## Correction

- Start, continuation and in-conversation injection share a 256,000 UTF-8-byte admission bound. This is a local storage/admission bound, not a statement of the provider's model window or account allowance. Text attachments retain their existing 16,000-character supplied-context/excerpt policy; an accepted excerpt no longer encounters the unrelated 4K continuation cap.
- Continuous question-anchor preparation explicitly identifies its workflow and preserves the full question, with the matching byte bound. Owner/capability authorization, deterministic identities and idempotency remain. Ordinary shared-task admission and tool permissions are unchanged. Continuous journal checkpoints accept the same long goal.
- The current instruction appears once, with speaker attribution and references from the chronological history and final priority reminder. Earlier goals cannot supersede it.
- When a working prompt would exceed its reserved budget, accumulated earlier user background is condensed first. If necessary, large current supplied input is processed in consecutive UTF-8-safe parts of at most 16,000 bytes. Every part is supplied to a tool-free memory request; its committed summary and progress are saved before the next part. Only the working projection is reduced. The full original question, attachment context, goal and messages remain saved.
- Source summaries are explicitly labelled as lossy, not full originals or independent verification. The working prompt reserves room for host/tool instructions within the existing provider envelope. Provider-specific context, time, rate and usage limits still apply; this does not promise unlimited context.
- Input preparation uses existing internal memory turns, which do not consume the user's conversation-reply count. It cannot edit files, run commands, access web tools or declare consensus. Stop interrupts preparation; Pause/resume retains committed progress and does not repeat completed parts. The original conversation and provider choices stay in place.
- Activity and progress reports context preparation/condensation. How to use Hadron includes this behavior.

The new durable summary cache is scoped to a native session and content hash, with a foreign key and cascading deletion. No existing table, chat, provider sign-in, user file or draft was removed or rewritten during testing.

## Verification

132 distinct automated tests passed: 49 scheduler/prompt/input/private-journal tests, 47 workspace/transport/persistence/notification tests, 26 anchor/journal/HTTP authorization tests and 10 client tests. Coverage includes attachment text above the former cap reaching both agents through actual composition, Unicode chunk coverage and bounds, retained originals, chronological labels, consensus, 100-turn memory behavior, Stop, committed-part resume, idempotent long injection, authorized full anchor storage and unchanged ordinary shared admission.

The hidden full desktop fixture used the real renderer, native host/preload, authenticated local HTTP preparation, SQLite and scheduler with synthetic providers. It passed an actual text-file input above 4K, followed by a roughly 100,000-character pasted continuation. Receipts recorded two attached-report replies, two pasted-report replies and eight memory requests. All 21 provider invocations were synthetic; zero real provider requests or account allowance were used. Existing handovers, disposable file edit/test, consensus, copy/append, saved reload without inference, folder restore and provider refresh also passed. A first fixture attempt bypassed the normal Attach files target selection and failed to attach; the fixture was corrected to exercise the normal menu and file-input change without opening a system picker. That failed attempt is retained in its local log.

Production renderer/main/mobile builds and required TypeScript checks passed. The final renderer was rebuilt after the small activity-status correction. Evidence: test-results/continuous-input-*.log and the disposable workspace report copied to test-results/continuous-input-desktop-result.json.

## Loading the correction

This is a local source-build correction. Save or copy unsent text, close Hadron and reopen through the existing Desktop shortcut to load the new renderer and host. No user window was closed or restarted automatically, and no user question was sent or replayed.

The previously delivered 6.0.6 installer and its GitHub release asset are unchanged and do not contain this later correction. A new installer requires a separately authorized update; existing release assets must not be replaced. The checked source is backed up to the private GitHub repository using the normal curated export.
