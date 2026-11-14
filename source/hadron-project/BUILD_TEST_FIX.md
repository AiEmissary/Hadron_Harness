# Windows project workflow - revision93

Build a project now supports a current-session reviewed proposal, native approval of the exact file batch, actual Windows file application, Node tests and JavaScript build scripts. Original replacement backups, per-file receipts, saved diffs and automatic agent Markdown logs remain available. The host rechecks the root, review, source hashes and actual workers before writing. A successful review is not a successful test.

## Available workflows

Manual: prepare the A proposal and B review, inspect the files, choose Apply reviewed changes, then Run Node tests or Run build script. The picker accepts Node .test/.spec JavaScript files, or a single .js/.mjs/.cjs build entry script. Hadron uses its bundled Node runtime, captures output and the actual exit code, limits each execution to two minutes/128 KiB output and joins the complete Windows process job. It does not invoke a command interpreter or install packages. A failed check can prepare a fresh reviewed repair using current file evidence and the bounded recorded failure output.

Automatic: choose Run build/test/fix beside a reviewed proposal. Select fixed test files and optionally a build entry script (Cancel skips the build). One native approval lists the project, editable paths, exact test/build script hashes and limits. The host applies the reviewed proposal, runs tests, runs the optional build if tests pass, and obtains up to two fresh independently reviewed repairs when checks fail. Each repair is applied only within the originally approved path set. At most eight further AI requests, three application batches, three test runs and three build runs are allowed. An unchanged approved script is required before each execution. Unapproved paths, changed scripts, review rejection, storage failure, Stop or an exhausted budget end the run. No approval token reaches a model or renderer, persists across restart, or lasts beyond30 minutes.

Tests and builds have separate status. Earlier checks become stale after file application. Passing selected checks is recorded as passing those checks, not proof that every project requirement is complete. Repair attempts retain their own proposals, reviews, application/check receipts and logs. There is no automatic rollback over a later user edit.

## Scope and limits

This is the supported Node workflow, not arbitrary npm/Python/native command execution. Build scripts must be existing local JavaScript entry files; their dependencies must already be installed. Text batches remain limited to20 files/128 KiB, with new files in admitted existing parent directories. Directory creation, delete/move, package installation and broad shell commands remain unavailable.

Project scripts execute with the signed-in Windows user's filesystem/network permissions; process containment is not an OS filesystem sandbox. The native dialog states this. Concurrent external editors remain possible; conflicts retain evidence and stop instead of overwriting or replaying an uncertain operation. Ordinary Windows metadata/backup behavior is tested; enterprise security metadata and power-loss certification remain outside acceptance.

Historical proposals remain inspection-only. Normal Quit joins owned work, preserves results and releases only a safely closed current capability. A forced interruption retains recovery state. This revision does not add cross-process lock retirement, reconstruct an old write lease, resume an interrupted loop or replay paid work. Prepare a fresh proposal from current files for new edits after a normal restart.

Windows first; Mac remains deferred. These additions do not alter the installed Graviton program or profile.

## Acceptance

The synthetic desktop workflow deliberately receives a faulty initial proposal, runs an actual failing test, independently reviews a fresh repair, applies it, passes the actual retest and build script, and reopens without inference. Exactly one native scope approval is required. Unit regressions cover two failed repair rounds, Stop during a repair, changed tests, forbidden paths, expired approvals and original source-selection retention.

A separate live acceptance uses the existing Hadron ChatGPT subscription for two actual gpt-6-luna requests. The real proposal and independent review lead to a reviewed calculator correction and actual passing Node tests in a disposable project. Personal projects and sign-in settings are unchanged. The live script is explicitly opt-in; it is not part of routine automated tests. Evidence: validation/revision93.
