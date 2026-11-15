# Hadron online tools — 15 November 2026

The current workspace includes online research in individual Chat and Agent, Work together, and Continuous conversation. A selected folder is optional for research. Folder permissions and online tools are composed; attaching a folder no longer removes web access.

## Search after provider sign-in

The host web_search operation uses the agent's existing signed-in provider. Claude runs a dedicated, non-interactive claude -p invocation with only WebSearch enabled. ChatGPT uses a dedicated provider-hosted search request through the existing Codex subscription transport. These requests receive only the public search query, not the conversation, attachments or selected-folder contents. No separate API key is needed.

Normal generation and JSON formatting still have native execution tools disabled. File edits and commands remain in Hadron's existing Agent host and require its selected-folder grant. Model-generated tool names cannot enable a native file, shell, browser, plugin or MCP capability.

The host accepts search evidence only after observing an actual completed search. It does not treat an unsupported model's memory-based answer as a completed search. Account policy, geography, connection, allowance and model support can prevent provider search. The locally accepted models were Claude Haiku and ChatGPT GPT-6.1-Sol; this is not certification of every provider/model combination.

A saved Brave Search key selects Brave as an optional alternative. Keys are personal configuration and are never included in an installer or Git backup. A missing or unavailable optional credential vault does not prevent provider-backed search. Brave failures now distinguish missing configuration, rejected keys, rate/usage limits and service errors without exposing provider response bodies.

## Other tools

web_read, web_navigate, web_back and web_forward read public HTTP(S) pages without a key. Reading is bounded text and links, with checked DNS, redirect checks, no cookies and no page-script execution. The current web tools do not operate a signed-in browser or submit forms, send messages, make purchases or perform account actions.

Enabled custom web tools are available alongside built-in research operations. Their QuickJS sandbox and per-owner version/enablement checks are retained. Chat does not acquire file editing or command permission from online access.

The existing three-dot setup pop-up explains Online tools and shows optional Brave-key status without exposing its value. Settings > Agents and tools > Web search explains provider search and contains the optional Brave setup. Tool library now explains built-in availability rather than suggesting its custom-tool list contains all tools. How to use Hadron is updated.

## Checks and delivery

- Regression tests cover no-folder research, read-folder plus web, Agent grant plus web, revocation, cancellation, optional vault failure and recorded failed searches.
- Native search validators reject unconfirmed results and native file/shell tools.
- Work-together tests verify research admission for both proposals and reviews; synthesis uses recorded evidence. Continuous memory remains tool-free.
- A real Claude Haiku search returned the official IANA Example Domains page through the existing Claude Code sign-in.
- A real ChatGPT GPT-6.1-Sol hosted search returned IANA source links through its existing subscription sign-in.
- Those live probes used no separate API key, started no sign-in flow and modified no user chats. Local reports are in test-results; raw account data is not included in source.
- The local renderer/main build is prepared for acceptance. The distributable installer is unchanged. No automatic restart, replay of user tasks or website publication is part of this change.

After saving any unsent message and closing Hadron, use Test Hadron.cmd in the workspace to test this source build with the existing saved-work profile. Rebuild the installer only after the user authorizes it.

## Restored-task notification correction

Reopening older tasks can emit Running while recovery loads their stored final transcripts. The completion watcher previously armed on that status alone, then announced the restored terminal state as new completion. Recovery only reads/replays saved status; it does not send a new model request.

Completion alerts now require an ephemeral launch record from this window's WorkspaceRunner. Archive loads and recovery have no such record and remain quiet. Newly sent tasks still notify once, including a task finishing in another chat, failed work and explicit Stop. Regression tests restore twelve historical tasks without a notice, check an initially restored Running task with an unsent draft, and check normal new-work, voice/ping and duplicate behavior.

The web correction was opened through the user's desktop shortcut with authorization. The notification correction is prepared for the next restart; do not close an active user window or discard an unsent draft automatically. No installer update was authorized for this work.

Validation completed: 196 distinct focused automated tests passed, plus the hidden desktop workflow regression (real disposable file edit/test, 100 synthetic continuous turns, copy/append, reload and connection refresh). Renderer, main and required typechecks passed. These are local checks; a fresh-PC installer test remains separate.
