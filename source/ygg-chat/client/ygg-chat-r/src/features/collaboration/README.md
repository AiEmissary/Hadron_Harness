# Collaboration setup and transport

Revision34 (2026-11-04): the docked `CollaborationWorkspace` has Work together and
Independent jobs modes. `IndependentJobs` mounts separate controllers/drafts/files
for A/B. `independentClient.ts` validates private context preparation, one-shot
admission, scoped status/Stop/replay/transcript/journal/continuity reads.
`independentJobController.ts` persists identity only before launch, fences uncertain
delivery across reload, and detaches without cancelling inference. Explicit
follow-up-from-log prepares a new bounded draft; it never starts automatically.
`AgentJobLog` renders plain Markdown source and lets the user save a copy.
Live flag remains false, model lists empty. Full phased/coding workflows and
normal desktop/provider validation remain pending. Historical notes below that
say these existing modules are unwired are superseded by this paragraph.

Gated renderer modules. Desktop Chat opens the provisional CollaborationWorkspace; live inference remains disabled. Later revision notes supersede historical descriptions below.
The separate `/hadron-preview` route mounts a fixture-only setup and dual-pane
preview. Responses are explicitly simulated; it never imports the API client,
connects a provider or writes branches. Its timers clean up on Stop/unmount and
the reducer fences duplicate, previous-session and post-Stop frames.

- `setup.ts`: independent A/B choices, provider changes clear only that agent's
  model, connected/available selection validation and copied admission input.
- `client.ts`: uses the verified desktop server origin and a capability obtained
  from a caller-supplied trusted main-frame bridge. Capability stays in a request
  header, never a URL or persistent settings. Unsupported snapshots and HTTP
  failures reject; no automatic retry of paid actions.
- `stream.ts`: one scoped SSE attachment with bounded frame buffering, UTF-8/CRLF
  decoding, sequence/cursor checks and callback projection. Disconnect/gap/access
  errors carry the last applied cursor; reconnect is explicit. Abort detaches the
  reader and does not call Stop or Start. A terminal frame ends projection. There
  is no auto-reconnect supervisor or normal Chat mount yet.
- `components/CollaborationPanel/CollaborationPanel.tsx`: two labelled provider/model
  fieldsets, connection labels, shared task, disabled/live gate and start/Stop
  callbacks. It supports proposal-only phase setup; no coding workflow selector,
  real-provider streaming, cross-review or synthesis interface is implemented yet.
  `CollaborationStreams.tsx` supplies separate A/B panes for the preview.

Provider lists must come from server-validated capabilities. Tests use synthetic
model lists. Do not ship those lists as provider availability or account evidence.
Same-provider/same-model selection is valid; separate sessions do not imply
different accounts. The client currently targets this UI's fixed A/B identities.

`server/.../collaboration/desktopAccess.ts` is a capability-boundary candidate:
loopback transport, constant-time token check, owner/auth-session binding and
explicit revocation. Issue a grant only through the existing trusted-main-frame
IPC guard. Main/preload now register guarded availability/capability IPC;
availability reports live disabled and grant issuance throws while the shared
build constant is false. The dormant principal adapter binds local owner, auth
generation and Codex session; auth notifications revoke grants. Backend route
registration, stream authorization and Chat mounting are still unwired. A token-bearing URL/test identity
header is not a substitute for this wiring.

Tests cover independent/frozen selections and unavailable models, header transport,
unknown response version/no retries, and static rendering with Start disabled.
Static markup tests do not prove interaction, keyboard accessibility or visual
layout in a running Electron window. Follow UI_DESIGN.md and complete mounted
component/stream lifecycle tests before enabling the feature.

Revision24: supervisor.ts owns separate A/B output/cursors, status polling, explicit GET reconnect, generation fences, explicit Stop and detach-only disposal. CollaborationSessionView connects it to trusted IPC capability behind false gate; not normal-Chat mounted yet. Backend routes are now registered behind false gate (supersedes older unwired note), with empty production model allowlist. Static/render and supervisor tests do not prove visible UI interaction.

Revision25: desktop Chat toolbar now opens disabled CollaborationWorkspace native dialog outside virtual transcript/tree layout. Four separate A/B controls, shared task, two response panes; Start disabled, connection/models not fabricated. Anchor/admission/session selection still pending. Isolated mounted Electron checks Close/Escape/focus restoration/mobile overflow/no fetch; screenshot artifacts in root validation/. No normal-app live interaction claim.

Revision26: workspace freezes selected saved-branch text on open, shows count and Review shared context, excludes files/tool/sibling data and rejects overlimit context. Guarded setup IPC supplies local-user and ChatGPT readiness only with zero approved models. No real Start/admission or saved-session selection yet; live gate false.

Revision29: admission.ts freezes one explicit Start and saves identity-only recovery marker before POST. Uncertain outcome/reload requires GET recovery, never automatic POST retry; next attempt only after confirmed terminal state. Workspace callbacks wired but live flag false/models empty. Context preview now shares parser16000char limit. UI remains provisional pending user input.

Revision31/user direction: workspace now docks beside chat/tree on wide screens and below on narrow screens. ChatCollaborationLayout preserves existing divider coordinate space. No portal/modal/backdrop; main chat stays interactive. Close/Escape restore focus. Prior dialog notes are historical. Fine visual design awaits user review; gate remains false.
