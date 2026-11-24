import * as esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'
import { runTasks } from '../scripts/build-tasks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
if(process.platform==='win32')await import('../scripts/build-hadron-worker-host.mjs')

// Hadron never distributes upstream account/cloud configuration. Provider sign-in uses the bundled official engines.
const authDefines = Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].map(key => [`process.env.${key}`, JSON.stringify('')]))

// Each build has a separate output. Limit concurrency to two esbuild jobs.
const tasks = []

// Bundle main.ts with all dependencies
tasks.push(() => esbuild.build({
  entryPoints: [path.join(__dirname, 'main.ts')],
  bundle: true,
  define: authDefines,
  platform: 'node',
  target: 'node20',
  outfile: path.join(__dirname, 'main.mjs'),
  format: 'esm',
  external: [
    'electron',
    'better-sqlite3',  // Native module - must be external
    'keytar',
    'node-pty',
  ],
  banner: {
    // Required for ESM to use require() for native modules. Bundled CommonJS libraries (such as
    // the OCR engine's host side) also expect Node's __filename/__dirname, which ESM lacks;
    // esbuild renames the app's own variables of those names, so these do not clash.
    js: "import { createRequire } from 'module'; import { fileURLToPath as __hadronFileURLToPath } from 'url'; const require = createRequire(import.meta.url); const __filename = __hadronFileURLToPath(import.meta.url); const __dirname = __hadronFileURLToPath(new URL('.', import.meta.url));"
  },
  sourcemap: true,
  // Resolve .ts files when importing .js extensions
  resolveExtensions: ['.ts', '.js', '.mjs', '.json'],
}).then(() => console.log('✅ main.ts bundled to main.mjs')))

// Compile preload.ts (no bundling needed - only uses electron). Windows run sandboxed,
// and Electron only loads a sandboxed preload as a CommonJS script, hence .cjs.
tasks.push(() => esbuild.build({
  entryPoints: [path.join(__dirname, 'preload.ts')],
  bundle: false,  // Don't bundle, just transpile
  platform: 'node',
  target: 'node20',
  outfile: path.join(__dirname, 'preload.cjs'),
  format: 'cjs',
  sourcemap: true,
}).then(() => console.log('✅ preload.ts compiled to preload.cjs')))

// Bundle the scanned-PDF text recognition (OCR) worker thread, with its WebAssembly engine inlined.
// Packaged copies live in resources/hadron-ocr beside the English language data.
tasks.push(() => esbuild.build({
  entryPoints: [path.join(__dirname, '..', 'server', 'hadronTools', 'ocrWorkerThread.cjs')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(__dirname, 'ocrWorker.cjs'),
  format: 'cjs',
}).then(() => console.log('✅ OCR worker bundled to ocrWorker.cjs')))

// Bundle utility process runtime entry
tasks.push(() => esbuild.build({
  entryPoints: [path.join(__dirname, '..', 'server', 'toolRuntimeUtility.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(__dirname, 'toolRuntimeUtility.mjs'),
  format: 'esm',
  external: [
    'electron',
    'better-sqlite3',
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  sourcemap: true,
  resolveExtensions: ['.ts', '.js', '.mjs', '.json'],
}).then(() => console.log('✅ toolRuntimeUtility.ts bundled to toolRuntimeUtility.mjs')))

// Bundle local analytics worker so expensive SQLite dashboard queries run off the main thread
tasks.push(() => esbuild.build({
  entryPoints: [path.join(__dirname, '..', 'server', 'localAnalyticsWorker.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(__dirname, 'localAnalyticsWorker.mjs'),
  format: 'esm',
  external: [
    'better-sqlite3',
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  sourcemap: true,
  resolveExtensions: ['.ts', '.js', '.mjs', '.json'],
}).then(() => console.log('✅ localAnalyticsWorker.ts bundled to localAnalyticsWorker.mjs')))

// Bundle mobile headless UI (React) for LAN access
tasks.push(() => esbuild.build({
  entryPoints: [path.join(__dirname, '..', 'server', 'headlessServer', 'ui', 'mobile', 'src', 'main.tsx')],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  outfile: path.join(__dirname, '..', 'server', 'headlessServer', 'ui', 'mobile', 'assets', 'mobile-app.js'),
  format: 'esm',
  sourcemap: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  resolveExtensions: ['.tsx', '.ts', '.js', '.mjs', '.json'],
  logLevel: 'info',
}).then(() => console.log('✅ mobile React UI bundled to server/headlessServer/ui/mobile/assets/mobile-app.js')))

await runTasks(tasks)
