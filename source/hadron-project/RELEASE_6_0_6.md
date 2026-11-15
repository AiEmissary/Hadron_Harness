# Hadron Harness 6.0.6 — 15 November 2026

The user requested an updated installer after the branch-editor changes. The Windows x64 installer is Hadron-Harness-6.0.6-win-x64.exe on the Desktop, with a retained distribution copy. Close Hadron before installing; the installer preserves the existing Hadron-Harness profile. The open user application was not closed, restarted or installed over during this release check.

## Included changes

- Branch opens an editor in place of the chosen message. A revised user question becomes an alternative sibling; an agent answer accepts a new follow-up. The original path and unsent bottom-composer draft/files remain intact. Right-click tree/chat actions use the same editor.
- Selecting an earlier tree message retains later replies on that branch. Sibling branches stay separate and the down arrow follows the displayed branch.
- Provider-backed web search and public-page reading work through provider sign-in, without requiring a Brave key. Brave remains optional. Provider/model/account restrictions still apply; this does not add interactive signed-in browsing or account actions.
- Loading saved conversations does not replay completion notifications. New locally started work still notifies normally.
- How to use Hadron and the Windows release/build guides describe the current workflow.

## Verification

- 86 automated checks passed: 70 workspace/branch/storage/transport/notification/renderer tests, 14 web research/provider/public-page tests and two provider packaging tests.
- The hidden inline-editor fixture passed in single-agent, shared and continuous work types, including cancellation, original preservation, duplicate-send fencing, drafts/files, right-click follow-up, local failure retention and chat isolation. It used synthetic requests only.
- Production renderer, Electron main and required typechecks passed. The packaging hooks checked native SQLite/vector, keytar, PTY and bundled Codex 0.166.0 / Claude Code 2.1.318 engines.
- The packaged app started with a disposable private profile, zero model requests, a matching startup trace, one composer/tree/setup/help and unchanged sign-in protocol registration.
- Package feature inspection found all latest fixes and 266 compiled files identical to the current build. The private-file pattern audit passed. Tools, worker, engines and licence resources are present.
- The installer running-app guard preserved its fixture process and executable, returning exit 32 while it was running. Fifty fresh-path NSIS probes passed without application or registry changes.
- Read-only installer integrity and all 1,959 payload filenames, sizes and CRC32 values match the tested unpacked package. Desktop, release and distribution copies have identical SHA256 hashes.

The first packaging attempt hit the build machine's missing symbolic-link privilege while extracting unused macOS libraries from the pinned legacy winCodeSign tool archive. The local Windows build-tool cache was populated from that archive with its darwin directory excluded; normal executable metadata editing was retained. Packaging then passed. An initial standalone guard check also ran before the absent NSIS compiler had been downloaded; it passed after the normal packaging download. Failed attempts are retained in local logs, not counted as passing checks.

## Artifacts and scope

Installer: 370,778,405 bytes.

SHA256: ca80dbd96185d267bfeee8abc0122cfbe37415ab32979ea205c304cf9b6cb93d

Matching source: distribution/Hadron-Harness-6.0.6-source.zip. Its SOURCE_REVISION.json records the committed source and per-file hashes, which the source packager checks after writing. Personal profiles, credentials, chat databases, dependency directories and build caches are excluded. Source and the verified installer are backed up to the private AiEmissary/Hadron_Harness repository, preserving older release assets.

Evidence is in test-results/release-6.0.6-*.log, release-6.0.6-installer-verification.json, release-6.0.6-manifest.json, release-6.0.6-source-package.json and github-backup-verification.json. The former Desktop 6.0.5 installer is removed only after comparison with its retained distribution copy.

This is an unsigned Windows release. Actual NSIS installation/upgrade and provider sign-in on a clean PC were not performed on this development PC. The build and payload checks are not a claim that those separate acceptance tests have run.
