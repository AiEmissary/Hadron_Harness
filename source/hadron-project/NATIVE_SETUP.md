# Hadron Windows native development setup

Build-machine instructions only. Recipients of the future packaged installer must
not need Visual Studio, Node or this source checkout.

The lockfile currently pins Electron 38.8.4 and better-sqlite3 11.10.0. Electron
uses ABI 139. A Windows x64 SQLite prebuild for this pair was unavailable during
the 2026-11-03 check, so SQLite needs a local C++ compilation. Keep these versions
pinned unless a separate dependency change is reviewed.

## Prerequisites

Install Microsoft Visual Studio Build Tools 2022 with the C++ build workload and
recommended Windows SDK components. This is a system-wide developer prerequisite;
the user approved installation on 2026-11-03. Never install it as part of starting
the finished app. The installation command used here was:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-source-agreements --accept-package-agreements --silent --disable-interactivity --override "--wait --quiet --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

## Prepare the pinned runtime

Run from `source/ygg-chat/`:

```powershell
node node_modules/electron/install.js
```

Dependencies are hoisted into this workspace's `node_modules/`. A broad rebuild
from the client directory can report success without rebuilding hoisted modules.
Always check the actual binding under the pinned Electron runtime.

Run from `source/ygg-chat/client/ygg-chat-r/` to compile SQLite directly:

```powershell
node -e 'const path=require("path");const {rebuild}=require("@electron/rebuild");rebuild({buildPath:path.resolve("../../node_modules/better-sqlite3"),electronVersion:"38.8.4",force:true}).then(()=>console.log("SQLite native build complete"),e=>{console.error(e.message);process.exitCode=1;});'
npm run check:hadron-native
```

The check runs Electron as a hidden Node process. It loads SQLite/keytar/node-pty
and performs an in-memory SQLite query, without starting the app, opening a PTY,
reading credentials or creating an application profile. Exit 0 is required before
testing desktop startup. It does not prove tool execution or packaging works.

The normal desktop build commands remain `build:electron:main` and
`build:electron`. Build results, native readiness and actual app startup are
separate gates. See `wherearewe.md` for the latest observed results.

## Observed result (2026-11-03)

Build Tools installation completed successfully. The direct SQLite rebuild exited
0. `check:hadron-native` exited 0 under Electron 38.8.4/ABI139 with SQLite, keytar
and node-pty all ready. No normal Electron app launch, credential access or live
provider request was performed by these checks.

## Windowless startup smoke

From `source/ygg-chat/client/ygg-chat-r/`, run `npm run check:hadron-startup`.
This bundles a dedicated Electron entry, uses a fresh temporary Hadron profile,
starts the production local server on an ephemeral loopback port, checks its PID,
closes it, and inspects the resulting database schema. It blocks fetch-based
network access, uses synthetic in-memory settings/disabled secrets and tool
execution, and creates no BrowserWindow. It does not exercise the normal main
window, renderer, login or tools. Each run preserves `smoke-result.json` in the
printed temporary profile for diagnosis.

2026-11-03 result: exit 0, schema version 7, both Hadron tables present, health PID
matched, shutdown closed the listener, no fetch attempts. Portable evidence:
[native startup result](validation/native-startup-2026-11-03.json).

Revision59 Codex vendor restoration: run npm ci --ignore-scripts --no-audit --no-fund --workspaces=false inside source/ygg-chat/client/ygg-chat-r/vendor/codex. Windows x64 only for now; pinned official0.166.0. Account data stays in Hadron's own Windows profile/keyring and is never included in builds or Git. Explicit scripts/test-hadron-codex-connection.mjs --live sends a fixed subscription greeting; never include it in automated CI/status checks.
