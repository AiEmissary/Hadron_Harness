# External application launch policy - revision90

## Covered dispatch

Electron main-window window.open links, authenticated auth:openExternal and shell:openPath now use the same host gate before any native shell call. The file channel now requires the main window and its main frame, like account channels. Generic web handoff accepts only bounded HTTP/HTTPS addresses without credentials/control characters; it does not accept arbitrary custom schemes or file URLs.

Project-only sessions refuse generic external applications between tasks as well as during tasks. Any currently held project scope, unavailable/corrupt execution state or persisted project record blocks generic handoff and dedicated provider login. A second host cannot use a saved project marker to launch an external app. Denials do not modify or clear the ledger or start a process. IPC callers receive an explanatory error; a refused main-window window.open is logged by the existing link handler. A visible notification for that latter route is not yet implemented.

Standard sessions retain ordinary browser/file handoffs, including when their known inherited utility activity has already been recorded. Ordinary clicks do not manufacture an unresolved legacy marker or clear an existing one. This preserves current chat/navigation behavior; it does not certify standard sessions for canonical edits.

## Dedicated provider login

Only host-owned ChatGPT connection callbacks pass the login exception. Exact HTTPS auth.openai.com paths /codex/device and /api/accounts/authorize are allowed in a clean project-only session; arbitrary hosts/ports/credentials/fragments/paths are refused. A renderer passing the same official-looking URL through a generic channel receives no exception. This preserves the official Codex device sign-in and advanced app-registration flow without a generic renderer privilege. No authentication codes or tokens are logged by the policy.

The inherited embedded OAuth window is separately gated before creation, accepts only web addresses, denies new popup windows and rechecks non-callback redirects/navigation. The existing application-protocol callback remains its completion path. Its generic channel cannot use the dedicated login exception. Native startup tests exercise refusal without opening a remote OAuth page. Full legacy embedded-provider sign-in acceptance remains separate; the accepted Hadron subscription flow uses the dedicated host callback.

## Limits and remaining gates

These are dispatch checks, not OS process containment. Existing browsers/editors, applications started earlier in standard mode and unrelated external writers are not joined, stopped or proved terminated. Future canonical-write composition must require a clean project-only host epoch or independently establish equivalent containment. Do not infer write safety from standard preview admission or a model review. Previous-process/descendant proof, other private stores, unsupported Windows metadata and exact native application consent remain open. Actual project editing, commands and cross-process unlocking stay disabled.

## Evidence

Seventeen policy/dispatch unit tests plus eight startup tests pass using real disposable ledgers. The built four-case startup fixture invokes actual main/preload web/file channels and main-window window.open with Electron shell methods intercepted: standard receives exactly three intended calls, project/blocked/damaged-draft cases receive zero. Restricted/non-web embedded OAuth requests are refused before window creation. No browser/editor/executable or real provider request is launched by those fixture calls. Full server suite493 passed/five skipped; server/Electron/mobile checks and main/mobile builds pass. Built proposal/cold-reopen checks are recorded in validation/revision90. An initial assertion used a matcher unavailable in the installed Vitest version; it was corrected and the successful rerun is retained alongside the initial output.
