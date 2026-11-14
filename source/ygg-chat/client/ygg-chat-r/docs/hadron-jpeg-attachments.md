# JPEG attachments in Hadron

Included in release 6.0.4. Earlier installers do not contain this change.

Use the paperclip → Attach files and select `.jpg` or `.jpeg`. No folder or coding permission is needed to discuss an attached picture. The current Chat/Agent permissions still govern file and coding tools.

The same attachment path supports Agent A, Agent B, Work together and continuous conversation. ChatGPT receives Responses image content; Claude receives base64 image blocks through its existing official print-mode login using streaming JSON input. Neither path substitutes a filename or text-only description for the picture. Native tools remain disabled; Hadron's existing host-controlled tools are unchanged.

Pictures appear beside their user message. They remain with that message when saved, reopened, edited, copied or moved into another chat. Follow-ups receive pictures from the selected conversation path only. Starting a fresh chat or branching before a picture excludes it. Selecting a different provider does not remove the picture.

Limits: five total attachments per selection, and five pictures per selected conversation path. Originals may be up to 8 MiB and 40 megapixels. Hadron prepares a JPEG copy up to 2048 pixels on its longest edge and 1 MiB, stripping metadata through canvas re-encoding. Dense pictures may be reduced further to fit. Original files are unchanged. Fine text may require a closer crop. These are attachment preparation limits, separate from provider context and usage allowances. Images do not consume the 16,000-character text-attachment allowance; providers still charge/count image context according to their own rules. The local archive retains its existing 32 MiB conversation limit.

## Verification

- Renderer tests cover request capture, follow-ups, fresh-chat and sibling-branch isolation, draft preservation when a branch exceeds the image count, and all three work-mode transports.
- Native service/provider tests cover image delivery to independent jobs, both shared proposals, both reviews and synthesis, strict admission, Codex guard authority, Claude print-mode input, archive round-trips/copies, and continuous saved-session continuation.
- `node scripts/check-jpeg-attachments.mjs` opens an isolated hidden Electron window. It exercises the existing file input, JPEG preparation, thumbnails, corrupt/oversized input rejection, large-picture reduction, original-file preservation, and the rendered message. It blocks network access and uses a separate temporary profile.
- `node scripts/check-hadron-live-vision.mjs --run-live --profile <Hadron profile>` is an explicitly opted-in check that spends one subscription request per provider. It sends only the synthetic fixture JPEG, asks a question with no description of its contents, and checks the returned shapes/colours/order. It never signs in/out, resets a lock, opens personal chats or reads credentials. It requires an already-connected idle profile.
- The live acceptance check on the development PC passed for Claude Sonnet and GPT-6.1-Sol: both identified the red square on the left and blue circle on the right. This verifies provider image understanding for the fixture; the multi-stage workflow checks use deterministic service fixtures.

The in-app How to use Hadron guide includes these attachment instructions. Release 6.0.4 also stores picture bytes separately from legacy job envelopes, preserving the old text budgets. Tests include pictures larger than 64 KiB in independent and shared workflows. Missing admissions are closed with a durable host fence before the chat is unlocked; a delayed Start for the same ID cannot launch work. Original questions, pictures and drafts remain saved.

Release 6.0.5 completes retry handling: follow-ups after a failed/stopped/unavailable task use the selected saved text and pictures, rather than reusing an invalid native parent job.
