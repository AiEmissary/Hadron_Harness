# The Hadron Harness — project todo list

Updated: 2026-11-06 (revision71). Authoritative context: [wherearewe.md](wherearewe.md). Design: [PLAN.md](PLAN.md).

Status legend: `[x]` completed and evidenced; `[ ]` not completed. Exactly one active item is labelled **IN PROGRESS**. This is a roadmap, not a claim of working software.

## Planning package

- [x] Confirm the correct upstream repository: zayr0-9/Graviton.
- [x] Inspect pinned upstream source/docs; identify reuse and integration risks.
- [x] Confirm user choices: Desktop folder; general collaboration plus coding review; existing providers, ChatGPT initially.
- [x] Write implementation plan and transportable progress/handoff documents.
- [x] User accepted the plan and safe feasibility start; added bundled .exe export, modular code and clean UI/colourful tree requirements (PROJECT_MAP.md).

## P0 — safe baseline and feasibility gate

- [x] Create a separate development checkout in `source/`; actual SHA matches `44a142fc5be3af5ae963a58fe20ceedcba9223c1`.
- [x] Read upstream instructions; Node 22.23.2/npm 10.9.8/git available; locked npm ci with install scripts disabled completed. Native/Electron runtime setup still deferred.
- [x] Configure isolated Hadron development app/profile/database/credentials/context home and disable upstream cloud/update access; isolated native startup tested. Normal desktop coexistence still pending.
- [ ] Run and record baseline tests/builds; list pre-existing failures without attributing them to Hadron.
- [x] Compare existing subagent path: four mocked dual-channel scenarios pass with distinct provider keys, model forwarding, separate transcripts and child cancellation. Combined regression: 103 passed/20 skipped.
- [x] Prove internal hybrid checkpoint-to-branch integration on real Node SQLite with existing repositories: 12 new cases pass (barrier, scope/provenance, retry/conflict, atomic rollback, Stop races). Unwired; production permissions/auth/live UI remain unproven.
- [ ] **IN PROGRESS:** Live acceptance of revision70 independent tools and revision71 Review + verification. Automated desktop create/test/review/enable/reuse, manual editor/test and zero-inference restart passed; real ChatGPT protocol quality and Brave search key acceptance remain. Optional shared tool-assisted verification is now implemented; live provider quality is not yet accepted. Interactive/signed-in browser actions and Claude execution remain further work. See TOOLS.md.
- [ ] Audit automatic hooks, compaction, shared context/REPL state, provider session keys and cloud-mirror behavior.
- [ ] Prove cancellation/reconnect behavior and tree/currentPath invariants in a small spike; document required narrow extension seams.
- [ ] Decide supported MVP routes from evidence. Unsupported configurations fail explicitly, not by fallback.

**Exit:** isolated development setup and two-branch proof; otherwise revise PLAN before adding UI.

## P1 — records and contracts

- [ ] Define validated versioned session, participant attempt, artifact, evidence and event types.
- [ ] Store frozen context/task/model/limits snapshot and server-owned branch/stream/provider-session references.
- [ ] Add collaboration repositories and indexes with idempotent launch/delivery keys and transactional phase revisions.
- [ ] Add fresh-install DDL, next unused append-only migration, migration log and legacy-data tests.
- [ ] Define redaction, deletion, retention and checkpoint export/import behavior; never export credentials.

**Exit:** fresh/upgraded DB parity, cross-conversation rejection, duplicate-operation tests passing.

## P2 — coordinator and lifecycle

- [ ] Wire a feature-flagged coordinator into the existing local server; keep ToolLoopService single-sourced.
- [ ] Implement frozen-anchor branching, two independent runs and the proposal barrier.
- [ ] Implement bounded exchange/review artifacts with receipts, context limits and prompt-injection boundaries.
- [ ] Add general verification and a separate synthesis branch; preserve source branches and dissent.
- [ ] Implement explicit attempt retry/intervention and fork-session-from-checkpoint semantics.
- [ ] Implement admission/budget limits, estimated/unknown usage, partial-result choices and no silent provider substitution.
- [ ] Track/cancel all owned streams/tool jobs; fence stale events and late synthesis.
- [ ] Add durable status/reattach and startup reconciliation; require explicit recovery for ambiguous paid requests or writes.

**Exit:** deterministic fake-provider scenarios complete, cancel and recover honestly with no duplicate transitions.

## P3 — coding safety

- [ ] Enforce server-owned participant capabilities at tool advertisement and execution.
- [ ] Test denial through direct calls, multi_call, REPL, shell, MCP/custom, hooks, mode changes and delegation escape paths.
- [ ] Add a single canonical-workspace write lease covering all relevant Graviton execution entry points; detect unsupported external changes.
- [ ] Implement one implementer plus revision-bound read-only reviewer; invalidate review after edits.
- [ ] Add explicitly approved verification commands/results; no fabricated test success or blanket reviewer shell permission.
- [ ] Bound one fix/recheck round by default; return unresolved issues to the human.

**Exit:** enforced read-only reviewer and no competing Hadron writers; failures remain visible.

## P4 — Electron experience and provider validation

- [ ] Add Hadron action and setup panel with workflow, participant model/provider, synthesis choice, context-sharing preview and limits.
- [ ] Add simultaneous participant streams, phase timeline, permission attribution, Stop/retry/intervention and branch navigation.
- [ ] Prevent stream completion from stealing selected pane/currentPath/scroll focus.
- [ ] Show final evidence, dissent, executed/skipped checks, usage uncertainty and branch links.
- [ ] Test ChatGPT/ChatGPT using available credentials and user-approved limits.
- [ ] Validate additional providers only when actually available; include Anthropic/DeepSeek route/capability checks after upstream support is confirmed.
- [ ] Keep multi-agent lists in records but disable more than two participants until later acceptance.

**Exit:** both workflows work end-to-end in an isolated desktop build; single-agent use unchanged when disabled.

## P5 — validation and release

- [ ] Run focused/new tests followed by impacted headless, server, renderer and tool suites.
- [ ] Run server typecheck, Electron renderer build and Electron main build; record commands/exit codes.
- [ ] Run cancel/crash/reconnect/migration/permissions/provider-pair matrix from PLAN.
- [ ] Compare a labelled pilot task set with a same-context single-model baseline; report quality, missed defects, cost and latency.
- [ ] Review AGPL/license notices, app identity, data/backup/export behavior and upstream update strategy.
- [ ] Package Hadron Windows installer .exe with bundled tools/resources and corresponding source/notices; audit optional external runtimes and test on clean Windows without developer tools or personal data.
- [ ] Apply PROJECT_MAP.md module ownership and clean chat-first UI requirements, retaining the colourful Heimdall branches.
- [ ] Isolate Hadron app/config/credential/update namespaces; audit packaged defaults and disable upstream auto-updates.
- [ ] Update wherearewe.md with changed files, evidence, bugs/fixes and exact next action after every work session.

## Later — deliberately deferred

- [ ] More than two agents: explicit participant limits, targeted reviews and aggregate budgets, not unbounded all-to-all messaging.
- [ ] Optional custom role presets, additional providers and richer checkpoint export tooling.
- [ ] Separate worktrees/multi-writer merge workflow only if requested and separately designed.
- [ ] Optional remote/A2A transport only when a real multi-machine requirement appears.















- [ ] Verify installer creates independent The Hadron Harness desktop shortcut and launches correct installed executable/profile (NSIS shortcut configuration added revision24).

## Revision 33 - 2026-11-04: document attachments and durable independent jobs

- Shared task supports file-only instructions or typed instructions plus local text/code/PDF/DOCX attachments. PDF worker is bundled locally; DOCX uses plain-text extraction. No upload, OCR, remote worker or silent truncation.
- Independent jobs now have durable migration9 records, owner-scoped status, atomic two-active-job capacity, cancellation/draining, startup interruption reconciliation, guarded cleanup, and private run/stream fencing.
- IndependentJobService and five HTTP routes are registered behind the false live gate with no approved production models. Each job owns one tool-free, single-attempt run. Stopping A leaves B running. Canonical settled output is available only through its authorized job.
- Replay transport is shared with proposal routes and checks authorization throughout viewing; disconnect does not stop inference.
- Renderer independent-job client validates scope/status/transcripts and never retries Start automatically. UI/source-conversation admission remains next.
- Validation: 165 headless + 58 renderer + 17 server = 240 tests passed; main/renderer builds and client typecheck passed. Isolated native/UI reports saved in validation with r33 names. No live AI, installed Graviton access, normal-app sign-in or installer test.
- Next: separate owned job contexts and per-job tasks/files/response/Stop UI, with unknown-admission recovery and no duplicate inference. General cross-review/synthesis and coding write leases remain future work.
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
Revision50: removed inherited Hadron desktop cloud-login redirect; actual Agents ChatGPT button verified through full main/preload/renderer to official OpenAI with Hadron name, intercepted before real browser. Real account completion remains pending. See wherearewe.md.

Revision53/54 (2026-11-05): first bounded user-initiated ChatGPT response test implemented, not general job routing. User reports actual callback failure. Added fixed, non-secret diagnostic stages/HTTP status; awaiting fresh sign-in after full app reopen. Do not claim live account/inference success. General live gate remains false.

Revision57: real rejection is invalid_grant. Fixed documented recovery: retain issued client separately in encrypted storage, reuse on next explicit fresh OAuth attempt, preserve all JWT/account fences.41 auth cases and three-process native DPAPI recovery smoke pass. Awaiting SAME-account manual verification; general jobs still disabled.

Revision58: SIWC fails both attempts. Compared upstream Graviton (read-only): it uses Codex client protocol. Added isolated official Codex0.166.0 device sign-in as PRIMARY ChatGPT card; own CODEX_HOME/keyring key, no Graviton/global account import. Native login still needs human verification; native inference/catalog/job adapter pending. General live gate false.

Revision59: DONE real ChatGPT subscription login + bounded live greeting verified; Test ChatGPT button and protected bridge implemented. General Codex job/model integration remains IN PROGRESS; live job gate stays disabled until strict execution policy is resolved. Claude sign-in/execution and release remain pending.

Revision60 DONE: Graviton-based Hadron worker contract v1 in proposal/independent coordinators; focused reading, honest handoffs, independent initial views, evidence-based challenge and authority boundaries. 40 job tests and builds pass. ChatGPT-only runtime job integration remains IN PROGRESS. Leave legacy menu unchanged; Claude postponed until user is ready tomorrow. See AGENT_PROMPTS.md.

## Revision61 current delivery status

- [x] Official native ChatGPT subscription routing for independent jobs and two initial proposals.
- [x] Own-profile model discovery/admission; bounded one-inference guard; tool-free enforcement and disconnect cancellation.
- [x] Task-only shared start without the inherited main-chat provider menu.
- [x] Saved real production-service response and Markdown journal; built synthetic concurrent jobs/shared flow; restart checks.
- [ ] Manual real-account Agent A UI acceptance, then concurrent A/B and shared task acceptance.
- [ ] Claude subscription login/execution when user ready.
- [ ] Cross-review, synthesis, coding tools/write permissions and full release checks.
- [ ] Apply custom themes consistently across chat/tree/Agents; offer explicit Hadron preset/reset. Default restored successfully by disabling custom theme.

Earlier phase checklists retain broader roadmap items; revision61 current status supersedes old Live disabled/job routing pending statements.

- [x] Show separate current Agent A/B job trees in the central desktop tree area with Chat tree / Agent trees navigation (revision63).
- [x] Persist agent conversation forests and linked follow-up/sibling/nested branches; select a preview card to open its exact path on the left (revision65).

## Revision65 delivery

- [x] Left selected-agent conversation and follow-up composer; right setup/status/logs.
- [x] Same-conversation follow-ups, branches from earlier questions/answers, separate New task roots.
- [x] Preview-card branch graphs with connecting forks and zoom; per-agent branch selection and restart restoration.
- [x] Shared proposal roots and private follow-up branches without replaying initial proposals.
- [x] Canonical selected ancestry/file context; no sibling/other-agent leakage; branch references in new Markdown journals.
- [x] Fix Windows wildcard/loopback port collision; own random port, own health identity, original Graviton normal address again returns325 local chats.
- [ ] User confirms Graviton UI chat list and new Hadron follow-up/fork interaction.
- [ ] Complete edit/regenerate/delete branch menus and larger-history pagination/compaction, as later enhancements.


Revision66 supersedes older proposal-only/future-synthesis notes above:
- [x] Implement bounded two-review plus one-synthesis scheduler, durable stage ownership/status, Stop/drain/deadline and interruption without replay.
- [x] Display/export combined answer, expandable reviews and separate stage logs; retain original proposals/private continuations.
- [ ] Real ChatGPT acceptance of full collaboration, Claude acceptance when ready, shared combined-answer follow-up branches, coding capabilities and release checks.

Revision66 follow-up: [x] Resolve saved private conversation project-list entries back to the correct immediate A/B workspace and saved response. Preserve nested historical scopes, refresh inherited lists, fail visibly on recovery error, and never repeat inference while opening a saved chat. User acceptance after reopening remains next.

Revision67: [x] Add Current task / All workspace chats, default new tasks to Current task, preserve sibling/nested branches and unchanged model context, persist view preference, and space the two session action buttons. Renderer/build/synthetic desktop checks pass.

Revision67 follow-up: [x] Add visible New collaboration beside Shared task; clear question/focus without losing models or saved chats; offer explicit keep/remove/cancel attachment choice before resetting. No inference occurs from draft preparation.

Revision68: [x] Move Continue with Agent A/B onto the matching response cards and focus the selected private composer; preserve canonical proposal-only continuation. User acceptance after reopen remains next.

- [x] Revision69: inspect all19 Settings sections and separate Main chat settings, fix proven persistence/validation/feedback issues, distinguish native A/B scope and disable unsupported inherited LAN/ownership controls. See SETTINGS_AUDIT.md.
- [ ] Configured-service acceptance for optional providers, embeddings, hooks/skills/MCP, wallpaper playback; complete three-pane custom theming.

- [x] Revision70: implement Hadron-owned versioned tool library, public-web driver, sandboxed JavaScript generator creation/testing, user-only exact-version enablement, manual add/test/cancel, private agent navigation, controlled native coordinator and durable activity. No Graviton imports.


## Shared conversation continuation (user requested, 2026-11-06)

- [ ] Add Continue with both near the combined answer. Start an explicit shared follow-up with both selected agents, carrying the preceding combined answer, relevant shared ancestry and selected attached files. Preserve the previous session and tree links; allow branching from earlier shared answers. Do not silently include unrelated conversations or replay inference on restart. Distinguish this from private Continue with Agent A/B and New collaboration. User authorized adding this to the TODO list while revision71 verification is implemented.

- [x] Revision71: optional collaboration verifier with trusted web/approved tools, separate durable host evidence, UI inspection, stage journal, additive migration11, Stop/failure/access fences and no startup replay. See VERIFICATION_PLAN.md and validation/revision71.

- [ ] Live acceptance follow-up: revision71 real shared verifier completed with zero tool calls/receipts. Remove conflicting tool-free verifier guidance, clearly distinguish no-check completion, test the actual native tool protocol, and explicitly verify a public URL before accepting real shared tool use. Do not replay the user task automatically.
