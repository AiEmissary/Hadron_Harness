# Hadron verification implementation plan — revision 71

## Goal
Add optional evidence-based verification between cross-review and synthesis, retaining the existing simpler review mode and saved sessions. Agreement must not be presented as proof.

## Workflow
1. Two independent proposals (no peer access or tools).
2. Two focused cross-reviews (one round, no tools).
3. Optional verifier using Agent A model and Hadron public-web/previously user-enabled sandboxed tools. No authoring, shell, project writes, cookies or subagents. At most eight model requests and 32 host operations.
4. Final synthesis receives both proposals/reviews, verifier report and separately recorded host tool receipts. State corrections, evidence limitations, confidence with reasons and unresolved questions. Important unresolved decisions return to the user.

Maximum: 13 model requests with verification; 5 without. Whole-session deadline ten minutes for verification, six minutes for simpler review. No retries or startup replay. Stop applies to every owned stage and its tools.

## Implementation
- Strict opt-in workflow input; visible mode and costs/limits.
- Additive v11 verification-stage persistence; preserve v10 sessions without rebuilding their tables.
- Owned verification run binding, bounded persisted host receipts and mode-aware Markdown logs.
- Verification report, sources/receipts and activity visible in Shared task and restored from saved sessions.
- Branded in-process tool capability only for verification; proposals, reviews and synthesis stay text-only.
- Existing model text remains unverified. Successful tool execution does not certify every claim or establish model confidence numerically.

## Validation
Test workflow ordering, canonical inputs, capability isolation, actual receipts separate from model assertions, failure/Stop/timeout/access revocation and restart without inference. Test v10-to-v11 data preservation. Build and test existing simpler workflows plus the new desktop flow with synthetic model replies and actual sandbox operations. Live ChatGPT/Brave quality remains a separate user acceptance check.

## Later work
Separate revised proposals, configurable rounds/role rotation and evaluated confidence formats remain future extensions. Interactive browser sessions and unrestricted project tools are outside this change.


Revision71 verification results:76 focused headless tests (including4 migration cases),41 tool-core tests and1165 renderer tests/1 skipped passed. Final display change passed17 focused renderer checks. Electron/mobile build and typechecks/server typecheck passed. Real desktop synthetic model flow executed actual approved QuickJS tool and displayed durable receipts; same-profile restart restored report/evidence with0 inference. Legacy independent/shared/branch/project-reopening flow passed. Evidence: validation/revision71. Final renderer release build and final built desktop verification flow passed; screenshots inspected. Live ChatGPT/Brave execution quality remains a user acceptance check.
