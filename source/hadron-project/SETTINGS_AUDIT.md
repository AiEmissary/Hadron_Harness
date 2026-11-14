# Hadron settings audit - revision69

Revision71 update: optional Work together verification can now use public-web/user-enabled tools. Revision70 update: native independent A/B jobs now have their own explicit web/tool-building modes and Tool library; these are separate from the inherited Main chat settings audited below. Read TOOLS.md. The remaining statements describe the revision69 audit.

Date: 2026-11-06. Scope: Hadron checkout and isolated temporary test profiles only. No installed Graviton changes, user chat repair, account sign-out or live inference.

## What the evidence means

Every main Settings section and the separate Chat Settings panel was reviewed in source, including persistence handlers and the execution path it configures. The built desktop audit opens all 19 main sections, exercises the local controls listed below, remounts settings to check persistence, and records a runtime control inventory. The source inventory also includes conditional/legacy controls; neither inventory is a count of successful functional tests.

Automated evidence lives in validation/revision69. Reproduce UI checks with `node scripts/check-hadron-desktop.mjs --settings` from the application directory; it always uses a new temporary Hadron profile. Never test credential writes/consolidation against the user's OS vault: the Hadron credential service is shared between Hadron development profiles. The audit reads configuration/status only and does not save or delete credentials.

## Main Settings, in display order

| Section | Controls and intended effect | Review and verification |
| --- | --- | --- |
| Chat Interface | Token bar, hover detail, file pills, auto-compaction | All four switches toggled and persisted through remount. These configure optional Main chat, not native Agent A/B. |
| Chat Mode Prompt | Select/create/update/delete/reset prompt; Plan verbosity | Create/select and persistence tested in built app; verbosity dropdown exercised. CRUD normalization and bundled defaults inspected. Applies Main chat baseline only. |
| Agent Mode Prompt | Save/reset Main chat execute-mode baseline | Actual save and remount tested. Does not change the native A/B worker contract. |
| Tool Approval Defaults | Ask/Allow all for Main chat | Dropdown exercised; 10 approval regression checks cover saved default and restoration. No tools executed by audit. A/B remain tool-free. |
| Chat Reasoning Defaults | Thinking and effort | Switch roundtrip and effort dropdown tested. Fixed missing thinking field incorrectly becoming false in older partial settings. Provider/model support still determines applicability. |
| Provider Settings | Selector/default provider; context cap; compaction threshold/prompt; LM Studio address; OpenRouter temperature; Z.AI/Bedrock credentials | Selector roundtrip tested and fixed its forced reset. Context limit normalization tests pass. LM Studio fallback now matches backend localhost default. Native subscription connection cards added above sections; the incompatible legacy OAuth account card is hidden in Hadron. Live non-native providers not certified without configured services. |
| Memory | Manual note embedding index; information on project auto-memory | Handler/server wiring and 5 auto-memory tests reviewed/passed. Indexing needs LM Studio embedding model and actual notes; not invoked against user content. Native A/B durable logs are separate from this optional Main chat memory. |
| Subagent | Provider/model/effort/turns, orchestrator/tools, baseline save/reset | Orchestrator switch, baseline save/remount tested. Fixed malformed tool-list/bool loading and positive fractional turns rounding to zero; regression tests added. Native A/B do not spawn subagents. |
| Context files | .ygg/.claude/both/custom presets; directory order/add/remove/write target | Built UI adds a directory and rejects traversal. Shared normalization, directory ordering and outgoing Main chat request wiring inspected. No user project files written. |
| Tools Configuration | Stream/tool/bash timeouts; reload; enable/disable tools | All three timeout editors saved through real handlers and survived remount; clamp tests and tool-row tests pass. Reload/toggle routes inspected. Native A/B tool policy remains none. |
| HTML Tools Cache | Favorite, hibernate/restore, remove, clear | Registry callbacks inspected. Empty fresh-profile cache renders; populated executable HTML content was not created/run as part of audit. |
| API Keys | Explicit secure Brave load/save/delete and consolidation | Native boundary tests pass; 3 credential-lock tests and provider-auth route checks pass. No OS credential writes/deletion/consolidation performed. Brave service use requires its own key and live test. |
| Built-in Browser | Guest page DevTools | Switch persists across remount, including native store hydration. Main/preload consumers inspected. External embedded page DevTools opening not exercised. |
| Remote Mobile Access | Inherited LAN URL/QR | Previously misleading: Hadron deliberately binds loopback only. Now explains unavailable; LAN inputs and automatic third-party QR request removed from Hadron UI. Remote URL helper rejects unusable schemes/credentials/query/hash and avoids duplicate /mobile. No LAN exposure enabled. |
| Local Ownership Migration | Inherited source/destination migration | Unavailable in Hadron: inherited migration omits canonical A/B owner/journal records and could strand chats. Replaced with explanation; no migrations run. A complete Hadron-aware migration remains future work. |
| Typography | Google Fonts apply/reset; local font upload/use/remove | Invalid Google host rejected in built app. Valid bundled local font loaded; broken replacement rejected while preserving working font. Validate before writing IndexedDB. Fixed malformed percent-family crash. External Google Fonts download availability is network-dependent. |
| Custom Upload | MP4/WebM wallpaper library | File-type/8 MB admission, IndexedDB and library events inspected. No user video selected or replaced; decode/playback not certified by this audit. |
| Solid Color Background | Video/solid mode; light/dark color/transparent | Light color persisted in built UI; fixed invalid transparent value passed to native color input. Existing custom theme/backdrop behaviour inspected. Opaque Hadron workspace panels keep their own surfaces; this is not full three-pane theme coverage. |
| Saved Wallpapers | Select/remove/default/clear; text contrast | Library storage and event handlers inspected, empty gallery rendered. Populated video playback/removal/contrast still needs a fixture/video acceptance test. No user gallery changed. |

## Separate Main chat Settings panel

| Area | Behaviour and audit result |
| --- | --- |
| System Prompt and Context | Saved prompts, per-conversation prompt/context and PDF/DOCX/text attachment extraction. Storage/action paths inspected; existing isolated collaboration file extraction checks retained. Not an A/B prompt editor. |
| Chat Settings | Thinking placement; font size; grouping; step labels; diff animation; truncation; memory; composer animations. Panel opened in actual app, grouping/step-label/memory buttons exercised. Fixed nonfinite/out-of-range stored font size. Truncation and animation suites pass. |
| Custom theme / Saved custom themes | Toggle/edit/save/apply local themes. Theme normalization tests pass; Hadron's full three-pane theming remains incomplete and is not certified here. Default Hadron palette restored by disabling custom theme. |
| Tools | Main chat built-in/custom/MCP groups and tool rows reviewed; row/group tests pass. Does not activate tools for native A/B. |
| Hooks | Listing/toggling own profile/project hooks reviewed; storage/service/permission tests pass. No actual user hook executed. |
| Skills | Listing/install/toggle/uninstall reviewed. Fixed silent load/toggle/remove failures so user sees an error. Built UI injects a failed list request and verifies visible feedback. No external skill repository installed or user skill removed. |
| MCP Servers | Stdio/HTTP add/edit/start/stop/auth/remove/refresh reviewed. JSON validation, secret-preserving edit semantics, OAuth and lazy-auth tests pass. Fixed silent list/remove failures and uncaught delayed tool-refresh failure. Built UI injects a failed list request and verifies visible feedback. Live third-party server/auth compatibility not certified. |
| Shortcuts / App Store | Existing navigation reviewed; no shortcut reassignment or third-party install performed. |
| App header | Home/back and Changelog use local navigation. Logout signs out of the inherited app identity; it is not the native ChatGPT/Claude Disconnect action. That scope remains a follow-up UX improvement. |

## Collaboration changes

Reconnect was a saved-stream replay control, not a follow-up. It now appears only after a recoverable disconnection, named Recover Agent A/B response. Finished responses retain Continue with Agent A/B. Session status failure offers Reload session. Recovery remains read-only and never starts inference.

Read-only inspection of the reported Hadron session located the quoted no-peer statement in Agent B's INITIAL proposal, not its final combined answer. Both cross-reviews received canonical proposals; a final was saved separately. Do not rewrite user history. Initial cards are now labelled by stage; final remains first. Worker contract v3 prevents initial proposals from declaring a failed consensus, tells reviewers to respect stage timing, and requires synthesis to resolve preferences with a practical default while preserving genuine dissent/uncertainty. No prompt guarantees model compliance or forces false agreement. New wording applies to new requests, not old saved output.

## Verification and outstanding acceptance

Full renderer suite: 140 files, 1,163 passed, 1 skipped. Initial wide run exposed three Windows CRLF-sensitive source assertions and an absent desktop-runtime fixture in branch tests; tests now normalize source newlines and explicitly mock the runtime they exercise. Product runtime guards were not relaxed.

Focused service checks: 18 worker/collaboration/system-prompt tests, 32 provider-auth/hook/MCP-permission tests and 34 storage/OAuth/auto-memory tests passed. Full renderer, Electron/mobile and server typechecks/builds plus built settings/jobs/restart evidence are recorded in verification.json.

Still requires configured-service acceptance: new live collaboration quality with the user's task; Claude subscription when user ready; optional Main chat providers/API keys, live embeddings, actual hooks/skills/MCP servers and wallpaper playback. These are explicitly not claimed as fully working based on source inspection. No need to sign out or change accounts to try the UI changes: fully quit Hadron normally and reopen its shortcut, then start a NEW collaboration so contract v3 is used.


Revision72: full unit/service suites and real native URL acceptance passed. Fixture repairs do not certify live hooks/MCP/optional services. Those remain after the Windows MVP gate.


## Revision75 - Windows MVP confirmed; selected-project read foundation (2026-11-06)

The user confirmed that cold startup opened correctly, then requested continued work. Core Windows two-agent acceptance now includes actual ChatGPT independent chats, shared proposals/reviews/synthesis, contextual shared follow-up, saved chats/trees and correct cold startup. The remaining shared-file choice was exercised end to end: a real text-file fixture passed through the file input, was excluded from one follow-up and retained on an alternate branch. The settings desktop audit again opened all 19 sections, persisted supported local changes and used no inference. Optional configured services and Claude are still separately unaccepted.

Implemented the first project-building increment: each independent agent has Read a project folder in its Tools selector. Choose project for Agent A/B opens a native read-only folder selection. The main process issues an opaque in-memory grant bound to local owner, resolved workspace and agent. Server admission resolves canonical job metadata and only then creates branded host tools. Native CLI tools remain disabled. This mode supplies only project_list and bounded UTF-8 project_read line ranges with SHA-256; no writes, shell/build/test commands, web, library tools or subagents. Project files are untrusted data. Traversal, absolute/device/alternate-stream paths, links/hard links, oversized/binary files, common credential directories/files and protected application/account folders are denied. Root identity, authorization and cancellation are rechecked. Activity logs store tool names/status only, never file paths/text. A grant is revoked on replacement/removal and expires on restart; saved answers/logs remain readable without replay.

The title-bar Select a work folder does not grant this new access. A and B require separate explicit selections. Work together verification remains web/enabled-tool only; project collaboration edits are the next distinct increment, not enabled by this reader. PROJECT_BUILD_PLAN.md defines implementer/reviewer separation, durable overlapping-folder write leases, expected-hash edits, interrupted-operation reconciliation, review invalidation, command containment and disposable-project acceptance before editing is enabled.

Validation: 333 server tests passed, 5 skipped; 1173 renderer tests passed, 1 skipped. Focused independent/context/journal routes and prompt tests: 24 passed; branching/service checks: 13 passed. Project read boundary tests include actual file reads, no-write protocol roundtrip, owner/workspace/agent isolation, forged grants, revoke/replacement, traversal/device paths, links/hard links, protected directories, size/line/output limits, cancellation, changed roots, restart expiry, operation budget and metadata-only activity. Renderer/main/mobile builds and server/Electron/mobile typechecks passed. Built desktop fixture used the actual UI/IPC/server/database/native host protocol and real temporary project files; only the model and native folder-picker result were fixtures. It read the exact requested line, made zero file changes/commands, revoked access and blocked another send. Cold restart restored the saved answer but required a fresh folder grant and sent zero inference requests. No real provider requests, personal project access, Graviton changes or user-app restarts were performed during this pass. Evidence: validation/revision75.

NEXT LIVE CHECK: reopen Hadron, choose Independent jobs, choose ChatGPT/model for Agent A, Tools -> Read a project folder -> Choose project for Agent A. Select C:/Users/rajka/Desktop/Hadron-Harness/demo-project. Suggested task: Read README.md and src/calculator.js. Explain the function and suggest one useful test. Do not edit files or run commands. This checks the real native folder picker and subscription path before the writer increment. The demo has no personal data or dependency installation. Do not claim project building is complete; coordinated writes and command execution remain in TODO order.
