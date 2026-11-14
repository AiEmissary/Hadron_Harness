# Official Claude Code runtime

This directory pins the unmodified Anthropic-published Claude Code package.
Install with `npm ci --prefix vendor/claude-code --ignore-scripts --workspaces=false`
on the target build platform/architecture. Do not copy credentials or settings
into this directory. Native packages are installed by npm for the current target.

Hadron must run the official binary with an isolated `CLAUDE_CONFIG_DIR` under
its own profile. Login remains Anthropic's own `claude auth login` flow. Hadron
must not read/store Claude.ai session tokens. This runtime is separate from the
existing generic `claude_bridge` tool and from installed Graviton/Claude profiles.

Supported intended release targets: Windows x64, macOS arm64 and macOS x64.
macOS builds and native runtime/signing tests require their own Mac runners.
Release packaging, licensing/notices and live subscription validation remain gates.

References verified 2026-11-04:

- https://code.claude.com/docs/en/legal-and-compliance
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/cli-reference
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
