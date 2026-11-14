# Hadron redesign specification - 10 November 2026

Status: desktop integration is connected and ready for local acceptance. See REDESIGN_IMPLEMENTATION_2026-11-10.md for test evidence, the local launcher and remaining acceptance work. The current installed interface is NOT the redesigned interface. No installer change or automatic switch is authorized by this document.

## Authority and scope

The user's three annotated reference images and 10 November instructions supersede the November 9 three-pane design. Red rectangles/arrows and parenthesised explanations are annotations, not UI elements. Three images were supplied (Examples 1-3); the described message/branch selection behaviour is sufficient to specify the referenced Example 4 without inventing another screen. Original Graviton is a layout/interaction reference only; do not change its installation, profiles or accounts and do not restore its branding/remote links.

Ask the user before introducing ANY button, feature, mode, intermediate screen or new user decision beyond the requested design. Do not add extra dashboard cards, workflow selectors, status panels or approval stages to compensate for implementation structure.

## Visual style

The user also requested a modern borderless interface. Remove decorative borders from boxes and buttons; use spacing and soft filled backgrounds. Do not change OS display or pointer settings.

## Confirmed placement and permissions

User clarification: Chat/Agent controls permissions for Work together too. Selecting Work together must NOT automatically enable writes.

User clarification: work-type selection, Chat/Agent permissions, Agent A/B switching, provider/model setup, subscription sign-in and continuous-conversation limits belong in the three-dot POP-UP, NOT the main page or a right-hand settings pane. The bottom compact strip may display the selected agent(s)/provider/model as Figure 2 shows; it must not expand into setup cards on the canvas.

## One page for every chat

1. Keep Hadron's existing logo entry page/tagline.
2. New project asks for title and optional project prompts/instructions. It opens the empty Example 1 workspace. Opening an existing project/chat uses the SAME workspace.
3. Exactly two primary panes: chronological questions/replies on the LEFT and the active conversation/branch tree on the RIGHT. The project/chat sidebar pulls out from the left and opens AND closes using its existing toggle.
4. Exactly one composer, fixed at the bottom LEFT, in every work type and permission mode. It never moves into another pane. The selected chat owns the draft, scroll position and branch selection.
5. First question, replies, tool/work results and conclusions appear in sequence in the left transcript. Another question is the next message on that same path; no Continue/Prepare/New collaboration/Work on this handoff is required.
6. Keep the familiar jump-to-latest arrow. Completion is an ordinary concise assistant message reporting actual changes, checks and limitations. Do not hide it behind a separate conclusion screen.
7. Keep the initial Start building/Open project folder presentation and empty tree placeholder from Example 1. Replace reference branding with Hadron. No AI request is started merely by opening this page.

## Bottom toolbar and pop-ups

Main toolbar follows the references: compact selected-agent/model strip, How to use Hadron in the Example 2 bottom position, three-dot menu, existing reasoning control, attachment control, and the existing Send/Stop control. No top-level work-mode tabs, setup dock, model cards or permission cards.

Three-dot pop-up contains:
- Work type: Individual agents; Work together; Continuous conversation.
- Agent A / Agent B switching for individual chats.
- Chat / Agent permission choice.
- Provider/model choices and existing subscription connection/sign-in controls.
- Continuous conversation opens its small turn-limit pop-up, capped at 100 replies. One agent reply counts as one turn. No additional timer/limit controls on the main page.

The attachment control provides files OR a project folder with subfolder access. Folder selection, permission and the chosen working directory must stay consistent rather than resetting one another.

Permission semantics:
- Individual + Chat: conversation and reading within selected access; no file changes.
- Individual + Agent: coding with the selected agent in the selected folder.
- Together + Chat: both agents discuss/read, no file changes.
- Together + Agent: both agents collaborate with coding access in the selected folder.
- Continuous conversation: back-and-forth chat with selected turn limit and reading access when supplied; the same transcript/composer/tree remain in place.

Agent mode is an actual execution policy, not a relabelled read-only proposal generator. Do not route it through another visible Build/Preview/Review mode. Native runtime/tool execution and the permission boundary must be tested before claiming this works.

## Separate agents without losing work

A and B have independent active chat IDs, histories, running jobs, drafts, folder settings and branch selections. Clicking B while on A opens B's existing chat if one exists. It does not replace, cancel or restart B's current work. If B is free and has no active chat, prepare a blank B chat; creation/sending is explicit, not a hidden inference request. Clicking A restores A exactly. Switching agents is navigation, never a reset.

Each project can hold multiple saved chats. A sidebar entry has a short text preview to make it recognisable. Choosing a saved chat restores its work type and agent configuration in the SAME page; it does not fork or rerun the chat.

Work together displays both agents in the compact strip and identifies each reply in the transcript. Both agents receive the relevant selected path and project instructions. Work on shared files requires internal coordination to avoid conflicting writes, not extra user workflow screens.

## Tree and reusable conversation parts

Reuse the original conversation/branch tree and its established interactions. The selected branch determines the transcript and where the next question goes.

Hovering a message/tree node reveals the requested model, copy, edit, branch, delete and three-dot information actions. Message metadata stays in that information pop-up. Keep this small; no permanent row of these buttons across the page.

A tree selection tool selects one or several messages/branch segments. The selected parts can be copied/moved into another chat or project, pasted into a new question, annotated with a note, or deleted. Destination selection includes existing projects/chats and creating a named project/chat. Preserve ordering and selected content; importing another selection appends it rather than overwriting earlier imported content. A copied segment remains in its source. A move is explicit and must preserve the source until the destination save succeeds.

Deletion uses Hadron's existing recoverable-bin policy (30 days), retaining enough branch structure for restoration. No silent permanent deletion, transcript rewriting or background agent restart during selection/copy/move.

## Retire from the visible workflow

Retire the added third setup pane, Agent A/B/Shared task/Project build/Conversation/Main chat navigation tabs, duplicate Shared task versus Work together terminology, separate Build a project workflow, proposal/preview/review navigation cards, Continue with/Work on this transfer buttons, saved-mode-specific dropdowns, and the scattered file-access/model controls. Their useful internal services may be reused but must not determine the visible layout.

Keep settings/themes, saved projects/chats, connections, recovery, tool capability and the How to use Hadron guide through their requested/existing locations. Do not surface unrelated legacy settings or add replacements without asking.

## Implementation sequence

1. Data/navigation foundation. Back up existing stores; define stable project/chat/branch/agent identities and an adapter for old independent/shared/build/continuous records. Preserve the original records. Separate navigation from dispatch and from mode permissions.
2. Restore the original two-pane Chat/Heimdall shell and bottom-left composer. Remove the collaboration dock from the new shell. Implement ONLY the requested three-dot pop-up/compact controls and help placement. Show empty Example 1 and populated Example 2 with the same component tree.
3. Individual agents. Route A/B through the common transcript/composer/tree; preserve each draft, branch and in-progress job while switching. Connect actual Chat/Agent runtime policies and selected folder access. Validate both providers.
4. Work together and continuous conversation. Use the same message/branch representation and composer. Integrate two-agent coordination/actual coding, clear inline completion and follow-up. Put the continuous 1-100 reply choice in its pop-up. No extra work page or handoff step.
5. Branch operations and project sidebar. Adapt the existing hover/selection menus for cross-chat/project segments, append imports, notes, reversible deletion, previews and stable sidebar navigation. Rework How to use Hadron around the requested flows.
6. Acceptance and local activation. Validate the references and real mode transitions in an isolated local build, then test locally with existing saved data. Update installer/source package ONLY after the user says local testing is ready for packaging.

## Acceptance checks

- New project title and optional prompts open the same empty two-pane page in every work type.
- A single composer stays bottom-left before/after replies, mode changes, file access and agent switching.
- Work-type, permission, login and model setup controls are absent from the main canvas and present in the three-dot pop-up. Only the compact selected-model strip is visible normally.
- Every sent question receives a saved reply, a visible error or an explicit stopped state; no silent completion/failure. Work feedback appears inline with the questions and answers.
- A/B switching preserves drafts, scroll, branch and active jobs; a busy agent's chat is never overwritten.
- Chat has no write authority. Agent can perform actual coding in the chosen folder. This holds for individual AND Work together.
- Together and continuous replies are labelled, ordered and branchable. Follow-up uses the same composer without a preparation button. Turn limits never exceed 100.
- Copying two selected segments into one destination retains both; moving is committed only after a successful destination save. Notes and 30-day deletion recovery work on branches.
- Sidebar toggle opens AND closes and previews identify stored chats. Restart restores saved chats without replaying jobs.
- Hadron entry branding and help placement match the requested references. No remote/Graviton links, extra mode buttons, installer update or changes to the original Graviton installation.

## Explicit right-click requirement (10 November, later clarification)
Right-click every transcript message or branch node, including highlighted text within a message and multi-node selections. Offer existing chat/project and new named chat/project destinations directly; open the destination after successful copy/move. Append without overwriting previous messages. Opening the menu sends no AI request and does not change the current branch. Copies leave the source; moves remove only the selected portion and preserve surrounding text/branch links, with 30-day recovery. Keep this inside context/hover menus, not permanent canvas controls.
