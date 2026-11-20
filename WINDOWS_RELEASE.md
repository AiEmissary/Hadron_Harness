# Hadron Harness - Release 6.0.7

Install **Hadron-Harness-6.0.7-win-x64.exe** on Windows x64. The installer lets you choose a location and creates a desktop shortcut. Close the installed copy of Hadron before upgrading. Its saved chats, projects and account connections remain in `%APPDATA%\Hadron-Harness`; uninstall also preserves that data. The local test build uses this same profile, so close it before opening the installed app.

## Using Hadron

- Create or open a project. The conversation is on the left, its branch tree on the right, and the message box stays at the bottom left.
- Open the three-dot chat setup to choose Agent A only, Agent B only, Work together or Continuous conversation. Choose each agent's provider/model there.
- Chat permits discussion and reading a selected folder. Agent permits coding and tool work. Work together follows the same permission choice. Continuous conversation uses Chat permissions and has a limit of up to 100 replies; it stops at confirmed consensus, limits or repeated replies. Stop interrupts the current work.
- Switch between shared and single-agent discussion in the setup popup. The selected discussion remains available; ordinary independent chats retain their separate histories. A new instruction takes priority over older tasks.
- Attach files or a folder using the paperclip. Selected folders are remembered between restarts; access is rechecked when reopened. A missing or inaccessible folder must be selected again.
- Right-click a message or tree selection to copy or move it into another or new chat/project. Copies append rather than overwrite. Deleted sidebar chats/projects can be restored from the bin for 30 days.
- How to use Hadron is beside the composer. Settings contains appearance, provider connections, agents/tools, saved data and setup checks.

## Tools and software

Electron, its Node engine, the Windows worker, Codex 0.166.0, Claude Code 2.1.318 and the native runtime dependencies are bundled. You do not need to install Electron or Visual Studio Code. Connect your own ChatGPT and/or Claude subscription after opening Hadron. Internet access is needed for sign-in and AI work. Project-specific language toolchains or programs may still need installing; Setup reports optional software.

ChatGPT defaults to the official Codex browser OAuth flow. Device-code sign-in is an optional alternative and may require enabling in account security settings or by your workspace administrator. Claude automatically reuses your normal Claude Code subscription sign-in and runs requests through the bundled official CLI's non-interactive print mode (claude -p / --print). Existing Hadron-only sign-ins remain usable as a fallback. No separate Hadron login is needed when Claude Code is already connected. If no sign-in is available, Connect Claude uses the official CLI's normal login. The provider CLI notice in Settings and the setup popup explains account eligibility, provider terms, workspace rules and allowances. Browser sign-in does not bypass a workspace restriction on Codex access.

The custom Tool library is in **Settings > Agents and tools > Tool library**. The installed library is `%APPDATA%\Hadron-Harness\hadron-tools`. Normal file-reading, editing and coding tools are built in; they do not require you to add a custom tool. New custom tools are disabled until reviewed and enabled.

## New in release 6.0.7

- Large PDFs (up to 2,000 pages) and large Word or text files (up to 2,000,000 characters each, 5 per chat) are kept whole. Agents search and read the parts they need with document tools in single-agent chats, Work together and Continuous conversation. Large documents stay attached for follow-ups and branches.
- Pictures can be JPEG, PNG, WebP, GIF or BMP (up to 20). Videos (MP4, WebM, MOV) are sent as up to 12 still frames.
- Agent jobs can run for up to 10 minutes and return a Not finished report with saved work instead of stopping abruptly. Repeated searches, stalls, oversized requests, long commands and unusable replies are handled more reliably.
- A clear Done mark shows when a reply has finished.

## Included from release 6.0.6

- Branch opens an editable box in place of the selected message on the left. Alternative questions create sibling branches on the right; an agent answer opens a blank follow-up. The original path and unsent bottom-composer draft/files stay intact. Hover and right-click actions use the same editor in all work types.
- Selecting an earlier coloured tree message scrolls to it while retaining later questions and replies on that branch. The down arrow goes to the end of the displayed branch; siblings remain separate.
- Provider-backed web search and public-page reading are available after provider sign-in, without an extra Brave API key, including individual, shared and continuous conversations. Brave remains an optional alternative. Provider/model restrictions and usage limits can still prevent a search. These tools do not operate logged-in websites or perform account actions.
- Reopening saved conversations does not replay their completion alerts. Notifications are armed only for work started in the current application session.
- How to use Hadron includes the updated branch navigation, inline editor, web access and notification behavior.

## Included from release 6.0.5

- Follow-ups after a failed, stopped or unavailable independent task use the selected saved conversation text and pictures, without trying to reuse the failed native task as a parent. This lets the user send again after recovery unlocks the controls.
- Supersedes the initial 6.0.4 backup with the complete retry fix; earlier release assets are retained unchanged.

## Included from release 6.0.4

- Attach JPEG pictures using the existing paperclip. ChatGPT and Claude receive actual image content in single-agent, shared and continuous conversations. Pictures remain with their saved message and selected branch; the in-app guide is updated.
- Image bytes are stored separately from legacy 64 KiB job envelopes. Ordinary pictures no longer fail job admission because their encoded size exceeds that old text limit. Existing task tables and saved work are preserved.
- A missing task admission no longer leaves the chat locked forever. Hadron confirms and durably closes the pending admission before unlocking it, retains the question/picture/draft, and prevents a late request from starting that same job. It never automatically repeats coding work.

## Included from release 6.0.3

- Reuse an existing Claude Code CLI sign-in automatically, retaining older Hadron connections. The account card identifies the connection and avoids another Connect action while already connected. Hadron does not copy credentials or import the user's global hooks, plugins or project instructions.
- Tree nodes and text are laid out at the actual zoomed pixel size, keeping them sharp. Panning, dragging, hover actions and group selection remain available. Checked at 300% zoom on 100% and 150% display scaling.
- Source archives also exclude local AI account metadata folders.

## Included from release 6.0.2

- Browser OAuth is the normal ChatGPT sign-in; device codes are optional. Pending OAuth details stay in the host and are cleared when sign-in finishes or is cancelled.
- Interrupted or incomplete jobs show **Not finished** in replies, branches and completion alerts. Completed file operations stay saved even when a later stage fails.
- Long tool context can be condensed using bounded excerpts, operation receipts and an available same-provider lightweight helper. Oversized text requests can be retried with shorter context without repeating completed tool operations. Context, time and request budgets still apply.
- The current How to use Hadron guide includes the updated connections, context handling and unfinished-job behaviour.

## Included from release 6.0.1

- Agent A and Agent B now remember their last chosen provider and model across new chats, projects and app restarts. Saved chats keep their own selections, and unavailable selections remain visible without choosing another provider automatically.

- Visual answers open over the tree automatically; follow-up drawings replace the previous preview, and ordinary replies return to the tree.
- The tree supports zooming and dragging, with message actions available on hover.
- Chat opening, new-chat focus and shared coding failure feedback have been improved. Shared coding uses one writer and read-only review stages.
- Completion alerts are in Settings > Agents and tools. Choose a taskbar notification with a ping, with voice, or Off. Voice mode never plays the ping.

## Release checks and scope

The two-pane build was tested through its actual desktop UI with real ChatGPT and Claude subscriptions: alternating replies, memory summarisation/recall, single/shared handovers, consensus stopping, Stop, reopening and continuation. A stale-task continuation issue found during testing was corrected and successfully retested. Saved test history and unsuccessful attempts were retained. Automated tests also cover controlled provider failures. See the accompanying validation report for packaged checks; live tests are bounded evidence, not a guarantee that a provider never fails.

This Windows installer is unsigned. Windows may identify the publisher as unknown. No accounts, credentials or personal chat databases are included. No remote service or Mac build is included. The original application from which Hadron was derived is not changed.

## Source and notices

The matching source archive is **Hadron-Harness-6.0.6-source.zip**. It includes build instructions, a source-revision manifest and dependency/provider notices. Preserve the inherited AGPL licence and third-party attribution. These build materials do not represent certification of third-party redistribution permissions. Source and the validated installer are backed up to the user's private GitHub repository.
