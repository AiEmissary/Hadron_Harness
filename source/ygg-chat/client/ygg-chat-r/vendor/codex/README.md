# Hadron Codex runtime

Pinned, unmodified official `@openai/codex` 0.166.0, installed locally with scripts disabled.
Restore using `npm ci --ignore-scripts --no-audit --no-fund --workspaces=false` in this folder.
The native Windows x64 package is bundled outside ASAR; other platforms remain gated.
Retain the upstream Apache-2.0 LICENSE, NOTICE, native assets and package notices.

Hadron runs the explicit vendor binary with a sanitized environment, its own
`CODEX_HOME` beneath the Hadron profile, its own working directory, and
`cli_auth_credentials_store="keyring"` (no plaintext fallback). The pinned upstream
keyring implementation derives the key from the canonical `CODEX_HOME` path.
No installed Graviton or global Codex account/profile is imported or modified.

Sign-in uses the official CLI's device authorization, avoiding the shared localhost
1455 callback. A human enters the one-time code shown in Hadron at the official
OpenAI page. Device-code login may need enabling in ChatGPT security settings.
Codes and raw CLI output are not written to Hadron diagnostics. No sign-in is
started by status checks. A separate Test ChatGPT button sends a fixed greeting using
`exec --ephemeral --ignore-user-config --ignore-rules --sandbox read-only` in the
empty Hadron runtime working directory, with shell/search/apps/plugins/hooks and
delegation disabled. It requires a completed JSONL turn and the expected answer;
tool/file events, partial output, timeout and account changes reject the result.
This narrowly scoped probe does not qualify the CLI for general tool-free,
single-request jobs: native internal retries/tool registration need a separate
execution contract before those jobs can be enabled.

Revision61 supersedes the earlier job-routing limitations above. Native model/list
is admitted through trusted desktop setup; official exec jobs now use a secret
per-invocation loopback HTTP guard with a fixed ChatGPT upstream. It replaces
context with the trusted task/prompt, advertises zero tools, accepts one inference
request, rejects retries/compaction/tool events, bounds SSE text and requires
completed output. Native keyring authentication/refresh stays in the own profile.
No raw auth or secret guard URL is persisted. Max two jobs; disconnect/quit cancels
owned work. The fixed greeting probe has its separate earlier contract.

Real fixed native and production independent-service tasks passed; synthetic built
UI checks verified two separate jobs plus shared proposals and journals. These
are text/file-analysis attempts only: no project writes, shell/tests, subagents,
cross-review or synthesis. Windows x64 remains the validated runtime target.
