# Revision91 validation

76 focused worker/runtime/coordinator tests pass; full server507 passed/five skipped. Server/Electron/mobile checks and main/mobile builds pass. Twelve new owned-child tests include real local-process cancellation and actual failed spawn. Two additional runtime tests verify shutdown waits for in-flight status and device sign-in without logout or admitting new work.

The actual built main/preload shutdown fixture substitutes a controlled real local Node child for the provider binary, delays cancellation600ms, and attempts Quit twice. Every actual owned child closes before will-quit; lateStarts=0 and logoutCalls=0. It makes no provider request and uses no actual credentials. The independent bundled Codex version/status probe runs only in a fresh disposable profile and confirms signed out, with no browser or login.

Built proposal/Stop/inspection/source-retention/clean-Quit and final cold-reopen/log/no-inference-replay checks pass. Four built startup/admission cases pass. Renderer source was unchanged and its existing compiled UI was retained. All changes are in Hadron source and its disposable fixtures; the user's running Hadron and installed Graviton were not restarted or modified.

This confirms graceful current-host joins only. It does not certify termination after a main-process crash or arbitrary descendants, recover a prior execution capability, enable project edits/commands, delete stale records or migrate credentials. See WORKER_LIFECYCLE.md.
