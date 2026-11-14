// Explicit own-profile catalog / bounded fixed-task validation. No user files.
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
if (!process.argv.includes('--models') && !process.argv.includes('--live')) throw Error('Select --models or --live')
const appDir = path.resolve(import.meta.dirname, '..')
const outfile = path.join(appDir, 'node_modules/.cache/hadron/codex-job-check.mjs')
await mkdir(path.dirname(outfile), { recursive: true })
await build({ entryPoints: [path.join(appDir, 'server/auth/hadronCodexRuntime.ts')], outfile, bundle: true, platform: 'node', format: 'esm' })
const { HadronCodexRuntime } = await import(pathToFileURL(outfile))
const runtime = new HadronCodexRuntime({ runtimeDirectory: path.join(appDir, 'vendor/codex'),
  profileDirectory: path.join(process.env.APPDATA, 'Hadron-Harness-Development'), openBrowser: async () => { throw Error('No sign-in during job check') },
  onJobDiagnostic: diagnostic => console.log(JSON.stringify({ diagnostic })) })
const models = await runtime.models()
if (!models.length) throw Error('No subscription models available')
console.log(JSON.stringify({ models }))
if (process.argv.includes('--live')) {
  const result = await runtime.generate({ requestPolicy: 'single_attempt', modelName: models[0].id,
    systemPrompt: 'Answer the supplied task briefly. Do not use tools.', history: [], userContent: 'What is 7 plus 5? Reply with the number only.' })
  if (result.content.trim() !== '12') throw Error('Unexpected fixed-task response')
  console.log(JSON.stringify({ success: true, text: result.content.trim(), model: models[0].id, fixedTask: true }))
}
