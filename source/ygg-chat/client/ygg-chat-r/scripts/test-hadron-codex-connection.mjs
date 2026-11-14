// Explicit bounded live check: one fixed prompt, Hadron's own subscription profile.
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
if (!process.argv.includes('--live')) throw Error('Use --live to send the fixed Hadron connection prompt')
if (process.platform !== 'win32' || !process.env.APPDATA) throw Error('Windows Hadron profile required')
const appDir = path.resolve(import.meta.dirname, '..')
const output = path.join(appDir, 'node_modules/.cache/hadron/codex-connection.mjs')
await mkdir(path.dirname(output), { recursive: true })
await build({ entryPoints: [path.join(appDir, 'server/auth/hadronCodexRuntime.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm' })
const { HadronCodexRuntime } = await import(pathToFileURL(output))
const runtime = new HadronCodexRuntime({ runtimeDirectory: path.join(appDir, 'vendor/codex'),
  profileDirectory: path.join(process.env.APPDATA, 'Hadron-Harness-Development'),
  openBrowser: async () => { throw Error('Connection check must not start sign-in') },
  onTestDiagnostic: diagnostic => console.log(JSON.stringify({ diagnostic })) })
const result = await runtime.testConnection()
console.log(JSON.stringify({ success: true, text: result.text, ownProfile: true, fixedPrompt: true, deadlineMs: 60000 }))
