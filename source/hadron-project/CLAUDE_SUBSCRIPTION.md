## Revision98 - Claude across Hadron modes and visual help guide (2026-11-07)

User accepted mixed Automatic conversation and authorized Claude in Work together, Independent jobs and Build a project. Implemented shared ChatGPT/Claude provider selection, strict provider-specific model admission and provider-preserving execution, reviews, branch history and journals. Independent jobs now send the selected provider instead of hard-coding ChatGPT. Shared proposal/review/synthesis use each frozen participant's provider; verifier and final use Agent A's selection. Project configurations optionally persist providers per role; legacy configurations without the field retain ChatGPT semantics and unchanged serialized hashes. A proposes, B reviews, and the existing coordinator still owns approved file application/tests/repair.

Claude CLI stays restricted, text-only and without native tools. Trusted Hadron tool sessions now use the same bounded text/JSON broker as ChatGPT: the host executes only the admitted web/project/custom-tool capability, returns evidence to subsequent text requests, and stops within the existing request budget. Untrusted cloned capabilities reject. Cancellation/shutdown abort and join broker jobs and owned native captures. No automatic provider fallback, new account storage or installed Graviton dependency was introduced.

Added How to use Hadron beside Collapse in the workspace header. The accessible modal has four mode choices, a numbered arrow flowchart for each, steps for saved work/branching/connections/tools, and buttons that open the selected mode. In-page flowchart navigation does not change the app route or dispatch inference. Native modal focus/escape behavior is used. User clarified each agent and asked why helpers were unavailable: inherited sub-agent run infrastructure remains, but delegation is explicitly disabled in A/B jobs. New SUBAGENT_PLAN.md records optional per-agent helpers, ownership/budgets, visible activity, cancellation and no-replay restart work; no helpers are enabled in this increment.

Validation: server typecheck, renderer build, Electron/main/mobile build pass. 59 focused runtime/routing/collaboration/independent tests, 99 project/build/tool-protocol tests and 79 renderer collaboration tests pass (237). New cases cover mixed providers through reviews/synthesis/journals, separate Claude admission, exact project review, and trusted Claude host-tool protocol with native tools still absent. Built disposable desktop UI ran mixed independent jobs and shared collaboration/follow-ups, with 4 actual native Claude-adapter calls to synthetic inference, help flowchart/navigation checks and zero inference when reopening views. Mixed project UI proposed/reviewed, stopped, inspected diffs and reopened saved proposals; cold restart made zero provider requests. No real paid inference was repeated; previous actual subscription generation was already accepted by the user. Evidence: validation/revision98. Models remain official Sonnet/Haiku/Opus aliases; account limits remain vendor-controlled.

Next user action: quit/reopen Hadron to load the new main/renderer. In any mode choose each agent's provider/model (either can be Claude). How to use Hadron opens the guide. Next implementation item: per-agent sub-agent support per SUBAGENT_PLAN.md, after this increment's user acceptance. Mac remains deferred. No user chat/project data or installed Graviton profile was changed by these fixture tests.

---
# Claude subscription: first mixed mode

Automatic conversation supports separate ChatGPT/Claude provider and model choices for A and B. Claude choices are Sonnet, Haiku and Opus aliases resolved by the installed official Claude Code runtime. Availability/limits and the versions behind aliases belong to Anthropic. Haiku and Sonnet passed live acceptance; Opus has not been exercised live.

Connect through Subscriptions -> Connect Claude and finish official browser sign-in. Google sign-in is supported by the provider's browser flow. No API key is required for the intended Claude subscription route. The runtime uses Hadron's private CLAUDE_CONFIG_DIR and drops inherited API keys, external Claude config, OAuth-token environment overrides and injection variables. It never adopts another app's runtime/profile or copies credential files.

## Execution

The Windows runtime has a separate native adapter and explicit claudecode route. Tool-free admission, provider/model/run bindings and supported aliases must agree. There is no fallback to ChatGPT, another account, API-key billing or a system CLI. Requests run from Hadron's private work directory in a native kill-on-close job. Stop and Quit wait for actual process/tree closure. Account restart/change invalidates in-flight output. Model refresh does not temporarily erase valid admission while checking an unchanged connection.

Flags: --safe-mode, --restricted, --disable-slash-commands, --tools empty, --disallowedTools *, --strict-mcp-config with empty MCP, --no-chrome, --no-session-persistence, --setting-sources empty, --permission-mode dontAsk, --max-turns1. The parser requires a tool-free init and one successful one-turn final text result, rejecting tool-bearing/partial/error output and permission denials. The host makes no automatic retry. A CLI turn limit is not a certified network-request/billing counter. Tool denial is not a filesystem sandbox for the trusted vendor executable.

Use safe mode for subscription auth. Bare mode deliberately skips OAuth/keychain auth and requires API credentials, so it is incompatible with this subscription route. Anthropic documents the distinction in [programmatic usage](https://code.claude.com/docs/en/headless) and the flag semantics in [CLI reference](https://code.claude.com/docs/en/cli-reference).

## Current boundaries

Claude is currently exposed only in Automatic conversation, including fresh saved continuations. The other three modes still require ChatGPT. Their expansion needs provider-aware configuration, histories, reviews, verifiers and exact project admission; the presence of a connected card is not proof those paths are enabled. No Claude project edits, native tools or autonomous subagents are enabled by this change. Mac testing remains deferred.

Validation and live/test distinctions are recorded in validation/revision96 and the revision96 handover.
