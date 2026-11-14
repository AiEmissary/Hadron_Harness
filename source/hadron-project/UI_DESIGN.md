# Hadron desktop UI specification

Revision66 current UI: Shared task on the left presents the final combined answer first, phase progress, expandable A/B reviews, initial proposals, five journals and Save combined answer (.md). Right setup explains up to5 requests and Agent A synthesis. Old proposal-only sessions remain readable without automatic upgrade. Two private agent trees represent their own conversations; no peer review is silently imported into private ancestry.

## User-selected layout - 2026-11-04

The user chose a separate collaboration workspace beside the main chat and colourful branch tree. This supersedes the provisional pop-up dialog and the unanswered-layout notes. Keep chat and tree interactive while the workspace is open. On narrower screens, stack the workspace below them rather than overlaying them. Existing tree resize coordinates remain scoped to the chat/tree area. Agent A/B keep separate provider/model inputs and response states. Fine layout, colours, sizing and interaction polish remain provisional for user review; this choice is not blanket approval of the current styling.

Accepted direction: 2026-11-02. Design specification; the collaboration renderer is not implemented yet.

Revision 17: a fixture-only `/hadron-preview` route now mounts the first setup panel
and dual response panes with labelled simulated text and Stop/restart handling.
The normal Chat/live-provider workflow remains unmounted and disabled. This preview
does not demonstrate real branching, login, inference, cross-review or synthesis.

## Start a task

Keep a clean chat-first window with a shared task composer and the existing colourful Heimdall branch tree. A compact collaboration setup row contains two independent participant controls:

| Agent A | Agent B |
| --- | --- |
| Provider selector | Provider selector |
| Model selector | Model selector |
| Own connection/availability status | Own connection/availability status |

These are two provider entry points, not one global provider setting shared by both agents. The same provider and model can be selected twice; each participant gets a distinct execution session. Two selections do not automatically mean two different accounts. Separate account/profile selection requires provider support and remains a later contract/UI decision.

Only actually supported and available provider/model choices can start a task. Show unavailable options with a reason; never silently substitute a provider or model. Current internal proposal implementation supports validated ChatGPT models only. Reuse the existing provider integrations when their Hadron safety/availability checks pass.

Choose General collaboration or Coding review in this compact panel. Start launches the shared task for both participants. Preview shared context and limits in expandable details. Provider/model selections are frozen for the session; changes apply to a new session, with explicit retry/recovery for a failed attempt.

## While running

Two labelled live response panes sit beside each other on a wide window; narrow windows use A/B tabs with both status indicators visible. The shared composer remains the task's home. A small phase indicator shows Independent proposals → Cross-review → Verification → Synthesis (or the corresponding coding phases). One session Stop button owns both participants; an agent finishing must not change the selected pane, scroll position or tree selection.

Use participant names and text states alongside colour. Give each pane a branch link and access to its canonical subagent transcript through the existing viewer. Preserve the colourful tree's current navigation and branch interactions. Only committed findings cross the proposal barrier; streamed tokens are not automatically copied to the peer.

Coding workflow names the single implementer and read-only reviewer. Permission requests identify the participant, action and workspace. Never imply that the reviewer has write access. Role assignment and permission controls must match server enforcement.

## Result and recovery

Show synthesis as the primary result, with compact links to each proposal/review branch. Expand evidence, executed/skipped checks, dissent, usage uncertainty and limits on demand. A failed or timed-out participant is visible; partial findings are labelled partial and do not become a successful collaboration by appearance alone. Stop, retry and recovery must reflect durable server state, without automatic paid reruns after restart.

## Implementation boundary

Renderer home: `source/ygg-chat/client/ygg-chat-r/src/features/collaboration/` and `src/components/CollaborationPanel/`. API/event contracts, authenticated routes, strict roles and lifecycle gates precede enabling this interface. This specification does not claim an existing runnable UI or completed cross-review/synthesis workflow.

Revision24: reusable real-session viewer now has independent A/B status and explicit per-agent reconnect, session reconnect and Stop-both controls. Normal Chat mounting/visual verification pending. Future Windows installer configured to create a The Hadron Harness desktop shortcut; no shortcut created during development.

Revision25: desktop Chat toolbar now opens disabled CollaborationWorkspace native dialog outside virtual transcript/tree layout. Four separate A/B controls, shared task, two response panes; Start disabled, connection/models not fabricated. Anchor/admission/session selection still pending. Isolated mounted Electron checks Close/Escape/focus restoration/mobile overflow/no fetch; screenshot artifacts in root validation/. No normal-app live interaction claim.

Revision26: workspace freezes selected saved-branch text on open, shows count and Review shared context, excludes files/tool/sibling data and rejects overlimit context. Guarded setup IPC supplies local-user and ChatGPT readiness only with zero approved models. No real Start/admission or saved-session selection yet; live gate false.

Revision27: user wants design input before UI is finalized; current layout provisional. Saved-session GET discovery now owner/conversation scoped and paged by descending ID (not time), no private packet/handles/run/stream refs. Default20/max50, nextBefore cursor. Production remains disabled. Session picker/controller not yet connected.

User approval2026-11-04: workspace arrangement is fine. Shared task must also have a file chooser. Revision32 Add files/list/remove implemented for local UTF8 text/code, frozen into both-agent context; document/image extractors remain future. User also approved planning Independent jobs mode with per-agent task/files/status/Stop, distinct from Work together.

## Revision 33 - 2026-11-04: document attachments and durable independent jobs

- Shared task supports file-only instructions or typed instructions plus local text/code/PDF/DOCX attachments. PDF worker is bundled locally; DOCX uses plain-text extraction. No upload, OCR, remote worker or silent truncation.
- Independent jobs now have durable migration9 records, owner-scoped status, atomic two-active-job capacity, cancellation/draining, startup interruption reconciliation, guarded cleanup, and private run/stream fencing.
- IndependentJobService and five HTTP routes are registered behind the false live gate with no approved production models. Each job owns one tool-free, single-attempt run. Stopping A leaves B running. Canonical settled output is available only through its authorized job.
- Replay transport is shared with proposal routes and checks authorization throughout viewing; disconnect does not stop inference.
- Renderer independent-job client validates scope/status/transcripts and never retries Start automatically. UI/source-conversation admission remains next.
- Validation: 165 headless + 58 renderer + 17 server = 240 tests passed; main/renderer builds and client typecheck passed. Isolated native/UI reports saved in validation with r33 names. No live AI, installed Graviton access, normal-app sign-in or installer test.
- Next: separate owned job contexts and per-job tasks/files/response/Stop UI, with unknown-admission recovery and no duplicate inference. General cross-review/synthesis and coding write leases remain future work.
## Branding confirmed - 2026-11-04

The user supplied C:/Users/rajka/Desktop/eyehadron.jpg as the Hadron Harness logo. An unchanged project copy is assets/branding/eyehadron.jpg. Use this artwork for Hadron branding; app/installer/desktop icon derivatives and their small-size legibility review are pending. The blue/purple eye and HH artwork does not by itself approve a complete UI colour scheme.

Completion sequence: finish Independent jobs UI and recovery; complete shared-task review/verification/synthesis and coding permission enforcement; show user the branded UI; validate isolated normal desktop login and bounded live provider flows with user input; package/test the independent Windows installer and desktop shortcut, with license/source notices.
## Revision 34 - 2026-11-04: Independent jobs UI and automatic Markdown continuity logs

- Workspace now offers Work together / Independent jobs. Independent A/B have separate task and PDF/DOCX/text/code file inputs, response areas, Start, Stop, status/reconnect and new-job controls. Mode switching preserves drafts. Each launch prepares its own owned local conversation and anchor without copying the selected chat.
- Context preparation is deterministic/idempotent and transactional. It checks owner/local storage/project access and rejects identity/source/slot conflicts. Independent-job admission persists identity before the only inference POST; unknown responses remain fenced across reload. Detaching never cancels inference; closing during context preparation prevents a later launch.
- User requested automatic .md job/project logs. AgentJobJournal writes one local Markdown record per independent job or collaboration participant under the database profile's hadron-job-logs directory. It records goal/context, status, visible progress, work/test/fix caveats and next actions. Writes are atomic and flushed; checkpoints occur at admission/binding, every five seconds while active, Stop and terminal state. Hidden reasoning, tool frames and credentials are excluded.
- Logs survive restart; startup appends interrupted state without repeating provider requests. They are continuity data, never tool authority or proof that a model's claimed test/fix happened. Current jobs are tool-free and logs explicitly say no project edits or tests were executed.
- Owner-authorized journal viewing and Save .md copy are wired for both modes. Independent jobs also offer Prepare follow-up from log: original goal plus a bounded, explicitly excerpted recovery packet; this prepares a NEW draft and never starts it automatically. Reattach original files if the continuity excerpt is insufficient.
- Logs are retained local artifacts in the Hadron profile. Full retention/export/deletion policy remains a release check. A filesystem failure before initial log creation prevents dispatch; later failures do not relaunch inference, and status/read errors expose unavailable logging.
- User's original logo is copied unchanged into the renderer assets and displayed in the workspace header. New independent layout remains provisional for the user's design review.
- Validation: 193 headless tests, 66 renderer tests and 17 server tests (276 total), Electron main/renderer builds and client typecheck. Native smoke now launches TWO isolated Electron processes against a temporary profile: first seeds a running fixture with notes; second confirms interruption reconciliation and preserved Markdown notes with no network. All fifteen proposal/job/context/journal/continuity endpoints remain 404 while live disabled. UI fixture verifies independent drafts/file isolation, mode preservation, bundled PDF/Word extraction, responsive dock and zero HTTP calls.
- Evidence: validation/independent-jobs-light-r34.png and independent-jobs-r34.png; collaboration-ui-r34-2026-11-04.json; native-startup-r34-2026-11-04.json; sample-agent-job-r34.md is synthetic fixture output, not a real task.
- Still pending: complete general cross-review/verification/synthesis scheduler, coding permissions/write leases, usable normal desktop sign-in/coexistence, bounded approved live provider tests and independent Windows installer/shortcut. Live flag false and all production model allowlists empty; installed Graviton untouched.
## Revision 35 - 2026-11-04: separate job trees and subscription-provider requirement

The user accepted the two-mode layout ("a little plain but good") and requested two trees for two independent jobs, then repeated the instruction to continue alone. IndependentJobTree now provides a separate expandable task/run history per job with independent selection, authenticated owner/conversation checks and no mutation of the main Chat tree. This is a read-only projection of the current job's frozen task and one owned run, not full Heimdall editing/branch navigation. Existing shared-task proposal branches remain in the shared conversation.

Tree backend/client and ownership checks pass; mounted Electron fixture proves A's selected response does not alter B's selected task. Renderer/main builds pass (renderer7469 modules). Focused renderer tests11 and service/routes9 pass after tree changes; aggregate previous193 headless + updated67 renderer +17 server =277 tests across the targeted files. New UI report: temp hadron-ui-OGedkY; native two-process report: temp hadron-startup-T3HNoX. Schema9/three Hadron tables, sixteen disabled endpoints, restart notes preserved and no HTTP/provider calls.

New confirmed requirement: OpenAI AND Anthropic/Claude accounts, BOTH via subscription sign-in, with easy Connect buttons like Graviton. Do not substitute an Anthropic API key or assume Claude is already integrated. The current base provider router has ChatGPT/OpenRouter/Bedrock/LMStudio/Zai; NO direct Claude subscription provider. Collaboration contracts/admission/UI are still ChatGPT-only. This is now the next foundation to implement before completing mixed-provider workflow scheduling.

Verified official Anthropic docs 2026-11-04:
- https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use permits end users signing into the UNMODIFIED Claude Code binary using their own subscriptions; third-party apps must not collect/intermediate Claude.ai session tokens.
- https://code.claude.com/docs/en/authentication documents separate CLAUDE_CONFIG_DIR per account, including settings/history/subscription credentials.
- https://code.claude.com/docs/en/cli-reference documents claude auth login/status, --restricted, --safe-mode, --tools "", --disallowedTools "*", --strict-mcp-config, --permission-prompts none, --max-turns1, --no-session-persistence.
- https://code.claude.com/docs/en/env-vars documents nonessential-traffic disabling and CLAUDE_CODE_MAX_RETRIES in the retry-watchdog description.
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan says signed-in SDK/claude -p usage still draws from subscription limits (updated October7).
- npm registry read-only query found official @anthropic-ai/claude-code version2.1.318 with win32-x64/arm64 optional binary packages. Get-Command claude returned no executable. No Claude installed, launched, signed in or paid request yet.

Next: vendor an unmodified pinned official Claude engine locally in Hadron, isolated process/config/runtime and official auth flow, adapt provider contracts/allowlists/grant invalidation for mixed providers, then general cross-review/synthesis and coding controls. Never copy tokens from installed Graviton or other Claude profiles. All model allowlists remain empty/liveflagfalse. General-workflow schema/service work has NOT started; only design discussion, no migration10.
## Release platform requirement - 2026-11-04

The user explicitly requires Windows AND macOS for later sharing. Windows gets an .exe installer; macOS gets separate .dmg/.app (optionally zip) artifacts. Plan/test both Apple Silicon arm64 and Intel x64. Do not claim Mac readiness based on Windows tests. Keep runtime paths, keychain/config isolation, process launch/cancel, bundled Claude engine and native SQLite/keytar/node-pty portable. macOS signing/notarization, real Mac validation and distribution notices are release gates; no installer is created yet.

Claude connection choice is confirmed twice: subscription / official Claude Code sign-in, not an API key. OpenAI continues the existing ChatGPT subscription path. Use easy separate Connect buttons. Official pinned Claude runtime installation has started ONLY inside source/ygg-chat/client/ygg-chat-r/vendor/claude-code, with install scripts disabled; no system-wide install, credentials migration or sign-in.
## 2026-11-04 - Hadron visual identity and persistent Agents tab

User explicitly requested removing the inherited visual design and matching all panes to the new Agents tab. Applied a Hadron-scoped cyan/violet palette, blue-grey light surfaces and navy dark surfaces, consistent thin borders and rounded rectangular cards/controls, coloured pane edges, Hadron chat welcome/logo and a branch-map empty state. Main conversation/tree behaviour remains intact; original decorative empty-state illustrations are hidden by the new scoped design.

Collapse now leaves a labelled Agents rail on desktop (bar on narrow screens). Clicking it reopens the same mounted workspace. Task drafts and selected files survive; collapsing never means Stop. Escape also collapses, and keyboard focus moves to the reopen tab. The default three-pane startup remains. User retains design input; review the real desktop screenshot when giving feedback.
## 2026-11-04 - futuristic button family

User requested all buttons feel like AI style of tomorrow. Introduced a shared Hadron button skin across the desktop application, including title bar, rails, chat/agents, settings and portalled controls. Deep indigo glass surfaces, asymmetrical soft corners, cyan illuminated borders, violet selected states, subtle inset depth and a restrained hover lift. Keyboard focus has a visible violet ring; disabled states remain muted and reduced-motion disables transitions/lift. Labels, actions and gating remain unchanged. Styling activates on the Electron App body marker, with the workspace scope retained for isolated preview validation.
## 2026-11-04 - lighter Hadron button colours (revision51)

User found the deep indigo buttons too harsh and explicitly requested much lighter, prettier, more colourful Hadron colours. Supersedes the dark button faces above: use soft sky cyan through periwinkle to lavender gradients, dark blue-violet labels/icons, and a brighter aqua/lilac/pink selected or primary state. Danger buttons use pale rose/lavender with plum text. Dark mode also keeps light colourful button faces; disabled controls remain muted. Preserve existing shapes, focus indicators, reduced-motion support and all actions.
## 2026-11-04 - profile page without offers (revision52)

User asked to keep the page opened by the bottom-left person icon but remove offers, package details and links for now. Desktop Profile is now a local Hadron placeholder with its logo, a Profile heading and a Back to workspace button. No inherited pricing, tier cards, credit balances, checkout or external promotional links. Desktop /payment and /paymentplan routes use this page without mounting the old payment component or its effects. Provider connection controls remain in Agents.

## 2026-11-05 - explicit first ChatGPT connection test

Connected ChatGPT card can load test models and send one fixed short prompt after explicit model selection and Test ChatGPT. No automatic test on sign-in/mount. Shows actual returned text only after completed response. This is a connection check; normal agent jobs remain gated. Real account sign-in has been reported failing and needs diagnosis.

## 2026-11-05 - official Codex connection in ChatGPT card

Primary Continue with ChatGPT now uses own official Codex engine with device authorization. Shows a short one-time code and Open sign-in page while running, with individual Cancel/Check/Disconnect. No automatic sign-in. Account profile/keyring separate from Graviton. Previous SIWC flow remains under Advanced: app-registration sign-in for diagnosis. Still TWO provider entry cards (ChatGPT and Claude). Native connected state does not imply normal jobs are enabled.

Revision59: Connected primary Codex card includes a separate Test ChatGPT button. User-triggered fixed greeting only, displays Hadron connection OK on verified completed result. No automatic inference from connection checks; general job integration still labelled pending. User's actual connected screenshot confirms successful device sign-in.

## Revision61 implementation and user feedback

Agents supports native ChatGPT model selection and enabled independent/shared text tasks. Shared tasks can use a saved branch or Use task only (no existing chat history copied). Task-only preparation creates an owned anchor transactionally before normal admission. Responses, files and Markdown job logs retain the existing separate-agent lifecycle. Claude remains untested/deferred.

Inherited custom themes currently affect mainly the left chat pane. User confirmed restoring Hadron default by disabling Enable custom theme under Saved Custom Themes. Consistent three-pane theming and an explicit Hadron default preset/reset remain pending UI work.

Revision62: completed independent jobs show New task and Ask a follow-up above the locked settings. Both open a blank focused question box; only follow-up retains the bounded prior log/context. No automatic request; user presses Start explicitly.

Revision63: middle desktop pane offers Chat tree and Agent trees. Independent mode selects two expanded separate current-job trees; shared mode selects chat tree. Task/response nodes show saved content without starting inference. Main-chat tree remains mounted; mobile retains per-agent trees in the workspace. Full historical job graph is not yet implemented.

## Revision65 - user-approved pane roles and preview-card trees

User approved: LEFT selected agent conversation and message/file composer; MIDDLE separate Agent A/B branching histories; RIGHT provider/model, shared task assignment, status, New task/Stop/logs. Left has Agent A, Agent B, Shared task and optional Main chat views. Shared proposals appear on the left and Continue with Agent opens that proposal's private branch. Selecting any preview card opens only its ancestry; the next message continues/branches there. Completed turns leave the composer available. New task explicitly creates a separate root.

Trees use small coloured preview windows showing the start of each question/answer, linked by curved fork lines, with zoom and scrolling. This supersedes revision63's two-node details-only trees. Multiple roots, sibling and nested branches persist. Per-agent selection IDs/view persist across restarts; task/file contents do not enter localStorage. Original main chat remains mounted when hidden. Setup collapse does not discard conversations/drafts.

Validated with synthetic built-app flows, file chooser/extraction, distinct A/B drafts, mobile overflow, restart without inference replay, and inspected screenshots. Real-user acceptance of this revised layout remains next. Full original edit/regenerate/delete tree menus remain later work; do not claim complete feature parity.


## Revision67 approved tree scope controls

Above the middle agent trees: Current task | All workspace chats. Current task is the new-task default and includes the selected conversation's complete branch family for each agent; shared mode shows only the selected collaboration's A/B conversation trees. All workspace chats restores the full workspace forests. The view choice does not alter model context, source records or the left composer. Scope is remembered with navigation preferences. New task/Prepare another task resets to Current task. Check existing session and Prepare another task have separate padding and a16px wrapping gap.

New collaboration is visible beside the Shared task label. It clears the question while retaining provider/model selection and saved conversations. With attachments, it first offers Keep attached files / Remove attached files / Cancel. Prepare another task uses the same file-choice/reset path. Both controls remain unavailable when starting another task would bypass an active or unconfirmed admission. New drafts use task-only context and Current task.

Revision68: Continue with Agent A/B is in the action row directly below that agent response's header, beside Reconnect. It opens the existing private original-proposal branch and focuses its message box. The old bottom-of-session duplicate controls are removed. No implicit sharing of the combined answer.

## Revision69 settings and response controls

Finished initial-proposal cards show Continue with Agent A/B, not Reconnect. Recover response appears only after a recoverable viewer disconnection; session status errors offer Reload session. Stage labels separate initial proposals from reviews/final. Native accounts now appear in app Settings; optional Main chat controls explicitly state their scope. Unsupported LAN access and inherited ownership migration explain unavailability. SETTINGS_AUDIT.md lists verified local behaviour and remaining integration/appearance limits.

## Revision70 tool controls

Independent A/B setup now has Text and attached files / Web research / Create and test tools selectors. Tools mode is an explicit per-message capability; restart defaults new messages to text. Tool activity appears with the current agent conversation. Tool library beside subscription setup offers refresh, manual Add a tool, schema/source review, JSON test inputs/results, Cancel test, exact-version Enable and Disable. New versions remain disabled; testing never enables a draft. Existing colourful button styling is inherited. Shared Work together remains text-only and says so in the library help.


Revision71: Work together has Review mode choices Cross-review and Review + verification. Verification uses Agent A model, shows13-request maximum versus5, and adds expandable verifier report, host tool evidence and activity near the combined answer. Successful stage completion is not labelled all-claims verified. Continue with both is queued separately in TODO.


Revision72: Continue with both beside combined answers; blank editable follow-up with prior-context/files checkbox; linked shared question/combined-answer cards in the middle pane; historical no-check/failed-check output labelled unverified.
