# Revision74 validation


## Revision74 - restore the workspace on actual cold startup (2026-11-06)

The user's next screenshot showed Agent B / Independent jobs immediately after launching the shortcut. Revision73 repaired project-entry resolution but its desktop test manually opened that entry after launch, so it did not establish automatic startup restoration. This distinction supersedes the earlier expectation that the shortcut would automatically restore the shared view.

Root cause: HomepageRedirect selected the latest updated stored conversation, which can be a materialized private agent proposal rather than the workspace the user was viewing. Hadron now remembers the last resolved workspace ID per local owner and reads it at startup. A fresh server GET validates the conversation owner/project before navigation; deleted, malformed and foreign references fall back safely. For older installs without the new reference, a recent managed agent/proposal entry is resolved back to its owning workspace first. Stored preferences contain navigation IDs only, no text, files, tokens or inference request.

Validation: 12 focused renderer tests passed, including newer-proposal vs last-workspace priority, legacy startup migration and deleted/foreign preferences. Renderer build and Electron typecheck passed. A fresh isolated desktop fixture created a private conversation, a nested shared verification task, a shared follow-up and an earlier-answer fork. After full process exit, an actual cold launch restored the nested workspace route, Work together / Shared task, the earlier selected combined answer and its tool evidence. The test now explicitly rejects any wrong startup route and performs NO project-list click, route injection or mode switch on reopening. The built native-model fixture recorded zero inference requests on reopening; fixture inference is synthetic, no personal account or Graviton files/processes were used or changed.

Next personal check: fully quit Hadron and reopen its existing shortcut; keep the subscription sign-in. It should return to the shared workspace automatically. The wider project-edit/build phase remains gated on Windows MVP acceptance.
