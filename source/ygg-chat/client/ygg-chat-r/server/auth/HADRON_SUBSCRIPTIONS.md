# Hadron subscription connections

Windows first. Live collaboration is disabled and approved model lists remain empty.
No real sign-in or paid inference has been performed.

## ChatGPT

`hadronChatgptSignIn.ts` implements a one-use public-client registration attempt
using the official open-source Sign in with ChatGPT flow (verified 2026-11-04):
dynamic registration, stable host ID, issued client IDs, PKCE/state/nonce, strict
returning-account identity, bounded token exchange and JOSE signature validation.
`jose` is pinned to 6.2.15. Its remote JWKS loader does not fetch until verification.

`hadronChatgptLoopback.ts` owns an ephemeral 127.0.0.1 listener before returning
the browser URL. Wrong-state requests do not cancel the legitimate attempt.
Cancellation, timeout, denial and success close the owned listener. Callback pages
contain no account tokens or codes. No browser is opened automatically by imports.

`hadronChatgptStore.ts` takes an injected cipher; production must use Electron
safeStorage after app.ready. It encrypts a single versioned host/account record,
flushes the temporary file and atomically replaces it, with no plaintext fallback.
Host identity survives disconnect. Invalid/corrupt data is preserved and fails closed.
Native Windows synthetic smoke passed encryption/decryption across two Electron
processes and disconnect, without network or real credentials.

The first native fixture incorrectly used app.exit immediately after encryption;
Chromium had not persisted its encryption state, and restart decryption failed.
Normal app.quit fixed the fixture. Abrupt crash on the first encryption session
is NOT validated; do not claim crash-durable key initialization. Production must
handle decrypt failure explicitly, preserve the file and request reconnect.

`hadronChatgptConnection.ts` now coordinates the loopback, system browser and
safeStorage-backed store through trusted main-frame IPC. Start is deduplicated;
Cancel fences both delayed preparation and late verified results; publication is
synchronous after the final generation check. The workspace has separate ChatGPT
and Claude connection cards. Its isolated Electron UI fixture proves both actions
are explicit and cancellation cannot cross providers. Real browser sign-in is
still untested. The old main-chat sign-in/settings flow is not migrated yet.

`headlessServer/providers/hadronResponsesProvider.ts` now provides the separate
tool-free single-attempt Responses transport, using the existing SSE event parser.
Six mocked tests cover endpoint/body restrictions, admission rejection, terminal
completion, no replay on HTTP rejection, disconnected-account fencing and stalled
stream cancellation with visible partial-output preservation. Server typecheck passes.
It is NOT registered in ProviderRouter or connected to account refresh/admission yet.
The injected account resolver must supply an account-lifetime AbortSignal.

These connections are NOT yet wired to the managed credential refresh scheduler
or a production inference route. Do not feed new
SIWC tokens into the legacy ChatGPT backend transport. New flow uses the official
api.openai.com/v1/responses route, store:false/stream:true, and its own model list.
Existing upstream managedOAuthRoutes.ts still uses the old fixed Codex client and
callback; Hadron disables its port listener to avoid Graviton interference.

`hadronChatgptRefresh.ts` implements the rotation transaction foundation, currently
unwired. It coalesces overlapping calls, persists refreshPending BEFORE sending,
uses the issued client/resource with scope omitted, validates optional renewed
identity and retained plan scopes, fences disconnect/account replacement, then
atomically commits replacement credentials. Ambiguous failures or interrupted
rotations require reconnect; they never replay the old refresh token. Six tests
plus related auth regressions and server typecheck pass. Status reports pending
records as reconnect_required. A profile-exclusive cross-process lease must be
implemented before enabling this helper in the account resolver; single-flight
alone only protects one process. Shared refresh should use account-lifetime
cancellation rather than an arbitrary individual job's signal.

Current Disconnect clears the local account only. Official current documentation
also requires attempting remote renewable-session revocation, with an honest
unconfirmed outcome on network failure. That integration remains pending along
with retaining issued registration identity separately from cleared token sets.

## Claude

`headlessServer/providers/claudeCodeRuntime.ts` runs the pinned, unmodified official
Claude Code 2.1.318 binary with Hadron-only config/cwd and sanitized environment.
The official process handles subscription browser login and token storage.
Trusted main-frame IPC exposes status/start/cancel; grants are invalidated by
account actions. Quit cancels an outstanding login. No inference adapter exists yet.
Windows packaging copies the native target plus notices outside ASAR and fails
on missing/wrong versions or unsupported targets. Mac release packaging remains gated.

## Next implementation

1. Connection service/IPC/UI implemented; validate the normal Windows app path.
2. Isolated provider adapters, refresh and qualified mixed-provider allowlists.
3. Align setup metadata/model catalogs with the new connections (currently gated).
4. Normal Windows app launch and user-driven sign-in. Explicit bounded live checks.
5. General review/synthesis, coding controls, release branding and installer.

References:
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/website
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use

## Lease and resolver foundation (revision 41)

hadronAuthLease.ts now provides an exclusive OS file creation lease within the
Hadron profile. It releases on success/failure, refuses overlapping or interrupted
owners, and never removes an externally replaced lock identity. A crashed owner's
lock is deliberately not auto-stolen. Recovery UX still needs implementation.

hadronChatgptResolver.ts connects account lookup and leased refresh, shares one
rotation across concurrent jobs, and supplies an account-lifetime AbortSignal.
An individual job's cancellation does not abort another job's shared refresh.
Explicit account invalidation cancels the old lifetime and fences late results.
Six new lease/resolver tests and six rotation regressions pass; server typecheck
passes. These modules are still not installed in the desktop host: ALL credential
writers (sign-in publication, disconnect, host identity and refresh) must share the
lease before that integration. Do not expose the private resolver over IPC.

## Desktop integration and catalog (revision 42)

The desktop now injects withHadronAuthLease into HadronChatgptConnection. Host-ID
creation, verified sign-in publication and disconnect use that same lease. The
private resolver is installed inside the connection and invalidated on account
actions; its credential-bearing resolveAccount method is never exposed in IPC.
Disconnect IPC now awaits lease completion. Cancel is rechecked inside delayed
publication leases. Seven connection tests and lease/resolver/refresh/bridge
regressions pass (24 combined); Electron/mobile checks and main build pass.

hadronChatgptModels.ts implements account-specific visible model parsing and
intersection with a frozen trusted approval set. It preserves server order,
rejects duplicate/malformed entries, fences account cancellation, suppresses raw
HTTP errors and never retries. Empty approval sets return no choices without
contacting auth or the network. Four mocked catalog tests pass. Catalog/Responses
routing is still not registered, and production model approvals remain empty.

Remaining: remote revocation and registration retention on sign-out; interrupted
lock recovery UX; normal Windows login/coexistence; approved catalog/provider route
integration; Claude execution/mixed-provider contracts. No live inference enabled.

## Explicit connection probe (revision 53, 2026-11-05)

The connected ChatGPT card now provides an explicit Load test models / choose /
Test ChatGPT path through trusted main-frame IPC. HadronChatgptProbe intersects
the current account catalog with a test-only gpt-6.1-sol allowlist. It fixes the
prompt to `Reply with exactly: Hadron connection OK`, caps output at 256 tokens,
uses a 30-second deadline, rejects concurrent tests, sends no tools/files/history,
and never retries. Discovery and inference use one account-lifetime snapshot.
Only response.completed counts as a completed answer. This uses the public
Responses adapter; it does NOT enable general job routing or change the live gate.

Five new mocked probe cases, existing transport cases, bridge regression,
Electron/mobile/server checks and renderer/main builds pass. UI fixture verifies
explicit model load/selection/test with no automatic calls and zero real fetches.
Actual desktop smoke still intercepts browser intent, using no real account.
The user reported real sign-in failed; their screenshot confirms the browser
reached the owned loopback callback and received Hadron's generic failure page.
Real authentication and inference are not yet proven.

Revision54 adds safe, fixed diagnostic stages from code exchange/permission/JWT
checks through the callback page and connection card. Only allowlisted copy,
stage codes and a bounded HTTP error status are exposed; no OAuth body or token.
The old attempt cannot be diagnosed retrospectively. User must reopen the rebuilt
app, start a fresh sign-in and report the bracketed diagnostic code. Public-only
JWKS reachability succeeds with RS256; this does not establish successful auth.

Revision56: user now confirms a fresh token exchange returns HTTP400. Standard
OAuth category was previously discarded, so cause remains unknown. Token-error
reader now caps at16KiB, retaining only allowlisted categories/field names and
response shape, never raw body/descriptions. This survives callback/coordinator.
Main writes a local safe status report at subscription-auth/last-signin-diagnostic.json
on account lifecycle changes, with no identity, OAuth URL, code or tokens. After
reopening the build, the user can retry once and we can inspect that report.
Local real-HTTP serialization/PKCE verification and23 targeted tests pass; this
does not prove OpenAI acceptance. Keep same account until category is known.

## invalid_grant recovery (revision57)

The real rejection is now confirmed as invalid_grant. Official sign-in docs require
discarding that code and retaining the issued client ID for a fresh authorization.
Previously Hadron lost this registration unless the first exchange fully succeeded.
SignIn now privately carries the issued ID on invalid_grant; loopback preserves it
for the coordinator. Under the profile lease, the coordinator saves ONLY the ID
as encrypted pendingRegistration, separately from account. Cancel/account fences
still apply. No code/token replay or automatic browser authorization is introduced.

Next explicit sign-in reuses that client, with fresh state/nonce/PKCE. A pending
registration supplies no verified subject or identity hints; full signature,
issuer/audience/nonce/permissions checks remain required before account publication.
Verified accounts retain exact-subject matching and cannot be overwritten by a
pending recovery ID. Successful save or Disconnect clears the pending entry.
Old encrypted version1 records remain readable; pending data alone never connects.

41 targeted auth tests and a three-process real Windows DPAPI smoke pass, including
pending registration restart recovery. Initial OpenAI rejection cause remains
unproven; real same-account retry still required. Old failed attempts cannot be
recovered retrospectively because their issued ID was discarded. First fresh try
may still fail, then a second explicit Continue can use the newly retained client.
Normal agent jobs and paid inference remain disabled/unproven.

## Official Codex engine is now the primary connection (revision58)

Both same-account SIWC attempts still fail invalid_grant. User requested comparing
Graviton. Its pinned managedOAuthRoutes uses the older Codex public client,
`/oauth/authorize` + `/oauth/token` and localhost1455, unlike dynamic SIWC. Public
OIDC discovery confirms the SIWC endpoints are current; do not mix the protocols.

Added pinned, unmodified official @openai/codex0.166.0 under vendor/codex. Windows
x64 only is currently validated. HadronCodexRuntime runs its explicit native binary
with sanitized env, own CODEX_HOME and cwd, mandatory keyring storage, no inherited
API keys/Node injection/global account import. Pinned upstream storage.rs derives
the OS-keyring key from canonical CODEX_HOME, so Hadron's key is distinct. The
native local version/status probe succeeds signed_out in a fresh own profile.

The primary ChatGPT card uses official `login --device-auth`, avoiding1455 conflicts.
Main-frame IPC exposes only status and the human one-time code/official fixed page;
no access/refresh tokens or raw CLI logs. No auth starts on mount/status. Cancel
awaits own login shutdown before logout. Quit cancels the process. Old SIWC UI and
its separate bounded Responses test are under Advanced; no automatic fallback.

The official native sign-in still needs human validation. Device-code login may
need enabling in ChatGPT Security settings. Native engine inference/catalog/job
integration is NOT implemented, and native connected status does not enable the
old SIWC provider/test. General live gate remains false. No installed Graviton or
global Codex state was modified. Packaging copies pinned target assets/notices
outside ASAR, rejects unsupported platforms, and has not produced an installer.

References checked:
- https://learn.chatgpt.com/docs/auth
- https://learn.chatgpt.com/docs/developer-commands?surface=cli
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
- Pinned official source: openai/codex rust-v0.166.0, codex-rs/login/src/auth/storage.rs

Revision59: real native subscription sign-in and fixed greeting confirmed. The
trusted-main-frame codex-test handler accepts no inputs; Test ChatGPT invokes a
fixed prompt in the own-profile official CLI, read-only sandbox, ephemeral turn,
without user/project config or rules, with shell/search/apps/plugins/hooks and
delegation disabled. One wrapper invocation, 60s deadline, 64KiB output cap. The
CLI may internally retry transport; this is NOT the general single_attempt
proposal policy. Completed turn and exact fixed greeting required; any fatal,
tool/file item, partial result, process failure or account change rejects. Native
item.error is documented non-fatal and alone does not invalidate a completed
answer. No raw diagnostics/tokens/identity/reasoning returned. Disconnect aborts
and waits for the probe before logout; Quit aborts it. Successful result clears
when disconnected. Main-frame guard and 11 runtime cases pass. General native
agent/model routing remains gated pending stronger tool/request policy.

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

Revision65: native per-turn admission now supports branch conversations. Server
resolves selected question/answer ancestry and original file context; only that
path enters conversationHistory. Each turn retains the single upstream request
guard, no tools, deadline/cancellation and independent journal. Completed shared
proposals may seed a provenance-tagged private agent branch without replay.
Hadron desktop server binding is mandatory OS-assigned loopback port; never3002.
Windows can bind wildcard and loopback listeners on the same port, which caused
a confirmed Graviton empty-list incident despite separate databases. Health
discovery now requires own appId and PID. See handoff revision64/65.
