# Build Hadron Harness 6.0.2 from this source

The source archive contains source/ygg-chat plus the inherited licence and upstream readme, distribution/licences, this guide and SOURCE_REVISION.json. It intentionally excludes user profiles, credentials, private validation history, node_modules, generated binaries and build output.

Use Windows x64, Node.js 22 or a compatible newer LTS, npm, Git and the native build prerequisites for Electron modules. These are developer build requirements; recipients of the installer do not need an editor or Electron installed separately.

From source/ygg-chat:

    npm ci

From source/ygg-chat/client/ygg-chat-r:

    npm ci --prefix vendor/codex
    npm ci --prefix vendor/claude-code
    node scripts/build-hadron-worker-host.mjs
    npm run rebuild:client
    npm run build:electron:parallel
    npx electron-builder --win nsis --x64 --publish never

The vendor wrappers lock Codex 0.166.0 and Claude Code 2.1.318. They are separate official executables, not modified vendor source. Their notices and published terms apply. The Windows worker is built from native/windows/HadronWorkerHost.cs using the Windows .NET compiler. Native dependencies need appropriate Visual Studio C++ build tools when no matching prebuild is available. The packaging hook verifies the target Electron SQLite/vector, keytar and PTY bindings; it does not silently accept a mismatched native build.

Hadron's Electron build explicitly disables inherited upstream cloud configuration. No upstream .env or API secrets are needed for the native Hadron workflows. Users sign into their own provider accounts after launch.

The supplied distribution/licences folder is copied into the installer. To regenerate its dependency inventory from an installed source tree:

    node scripts/release-license-inventory.mjs --fetch-missing-notices

That command uses installed package manifests and licences, exact upstream licence commits/tags where available, and explicitly labelled publisher declarations where original text is absent. It writes no credentials. Review its report and distribution/licences/README.md before wider redistribution. Preserve the inherited GNU AGPLv3 and third-party notices. This guide is not a representation that third-party commercial permissions have been obtained.

Useful checks:

    npm run test:server
    npm run test:headless
    npm run test:renderer
    node scripts/check-hadron-desktop.mjs --jobs --mixed-continuous
    node scripts/check-packaged-ui.mjs

Live helper and actual installer checks require explicit command flags; they can spend subscription requests or temporarily install/uninstall Hadron. Read their scope and guards before invoking them. No publishing/upload step is included.

Portable archives: Settings → Saved data. The .hadron format contains data-only reference history, not provider credentials, executable tools or resumable worker authority. Back up closed native profile databases separately when an exact same-PC operational checkpoint is needed.

The Windows beforePack hook applies a hash-checked Hadron-local backport of electron-builder PR 9564 to the pinned 26.8.1 NSIS template. It skips the Windows 7 known-folder compatibility call on Windows 8 and newer. Run node scripts/check-hadron-nsis-path.mjs for 50 fresh-path launches and template-integrity checks. The original application and system installation tools are not modified.
