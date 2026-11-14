import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, it } from 'vitest'
const source = readFileSync(new URL('../auth/runtime.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source.slice(source.indexOf('export function publicAuthState()')), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
it('local sign-in supplies a desktop principal without an app or provider account', () => {
  const settings = new Map<string, unknown>()
  const snapshots = { app: { userId: null }, codex: { status: 'signed_out', sessionId: null } }
  const exports: any = {}
  runInNewContext(code, { exports, getSettingsStore: () => ({ get: (key: string) => settings.get(key), set: (key: string, value: unknown) => settings.set(key, value) }),
    getAuthManager: () => ({ snapshot: (slot: 'app' | 'codex') => snapshots[slot], replace: () => {} }) })
  expect(exports.publicAuthState().user).toBeNull()
  const local = exports.enableLocalLogin()
  expect(local.user.id).toBe('a7c485cb-99e7-4cf2-82a9-6e23b55cdfc3')
  expect(local.app.userId).toBeNull()
  expect(local.codex.status).toBe('signed_out')
  exports.disconnectAuth('app')
  expect(exports.publicAuthState().user).toBeNull()
})
