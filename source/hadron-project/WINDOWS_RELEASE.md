# Hadron Harness - Release 5.0

Install **Hadron-Harness-5.0.0-win-x64.exe** on Windows x64. The installer lets you choose a location and creates a desktop shortcut. Close the installed copy of Hadron before upgrading. Its saved chats, projects and account connections remain in `%APPDATA%\Hadron-Harness`; uninstall also preserves that data. The local test build uses this same profile, so close it before opening the installed app.

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

The custom Tool library is in **Settings > Agents and tools > Tool library**. The installed library is `%APPDATA%\Hadron-Harness\hadron-tools`. Normal file-reading, editing and coding tools are built in; they do not require you to add a custom tool. New custom tools are disabled until reviewed and enabled.

## Release checks and scope

The two-pane build was tested through its actual desktop UI with real ChatGPT and Claude subscriptions: alternating replies, memory summarisation/recall, single/shared handovers, consensus stopping, Stop, reopening and continuation. A stale-task continuation issue found during testing was corrected and successfully retested. Saved test history and unsuccessful attempts were retained. Automated tests also cover controlled provider failures. See the accompanying validation report for packaged checks; live tests are bounded evidence, not a guarantee that a provider never fails.

This Windows installer is unsigned. Windows may identify the publisher as unknown. No accounts, credentials or personal chat databases are included. No remote service or Mac build is included. The original application from which Hadron was derived is not changed.

## Source and notices

The matching source archive is **Hadron-Harness-5.0.0-source.zip**. It includes build instructions, a source-revision manifest and dependency/provider notices. Preserve the inherited AGPL licence and third-party attribution. These build materials do not represent certification of third-party redistribution permissions. No public upload is performed by this release process.
