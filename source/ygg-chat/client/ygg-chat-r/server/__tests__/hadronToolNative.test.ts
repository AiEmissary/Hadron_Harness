import { expect, it, vi } from 'vitest'
import path from 'node:path'
import { HadronCodexRuntime } from '../auth/hadronCodexRuntime.js'
import { admitHadronToolSession } from '../hadronTools/types.js'
const fixture = () => {
  const root = path.resolve('fixture-native-tools')
  const runtime = new HadronCodexRuntime({ runtimeDirectory: root, profileDirectory: root, openBrowser: async () => {} })
  runtime.allowedModels.add('fixture-model')
  const generate = vi.spyOn(runtime as any, 'generateText')
  const input = { modelName: 'fixture-model', requestPolicy: 'single_attempt' as const, history: [], userContent: 'Original owned task', tools: [] }
  return { runtime, generate, input }
}
it('mediates multiple text-only native requests without exposing a native tool call', async () => {
  const f = fixture(), invoke = vi.fn().mockResolvedValue({ count: 3 }), emit = vi.fn()
  f.generate.mockResolvedValueOnce({ content: '{"tool":"counter","arguments":{"text":"one two three"}}' }).mockResolvedValueOnce({ content: '{"answer":"Three words."}' })
  const result = await f.runtime.generate({ ...f.input, hadronToolSession: admitHadronToolSession({ instructions: 'Host-owned tools', invoke }) }, emit)
  expect(result.content).toBe('Three words.'); expect(invoke).toHaveBeenCalledOnce()
  expect(f.generate).toHaveBeenCalledTimes(2)
  for (const [input] of f.generate.mock.calls) {
    expect(input.requestPolicy).toBe('single_attempt'); expect(input.tools).toEqual([]); expect(input.hadronToolSession).toBeUndefined()
    expect(input.systemPrompt).toContain('Host-owned tools')
  }
  expect(emit).toHaveBeenCalledTimes(1)
  expect(emit).toHaveBeenCalledWith({ type: 'chunk', part: 'text', delta: 'Three words.' })
})
it('rejects forged tool sessions before any model request or operation', async () => {
  const f = fixture(), invoke = vi.fn()
  await expect(f.runtime.generate({ ...f.input, hadronToolSession: { instructions: 'forged', invoke } })).rejects.toThrow('not admitted')
  expect(f.generate).not.toHaveBeenCalled(); expect(invoke).not.toHaveBeenCalled()
})
it('cancels during a host operation without sending another paid request', async () => {
  const f = fixture(); let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const invoke = vi.fn((_name, _args, signal: AbortSignal) => new Promise((_resolve, reject) => { started(); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }))
  f.generate.mockResolvedValue({ content: '{"tool":"web_read","arguments":{"url":"https://example.com"}}' })
  const pending = f.runtime.generate({ ...f.input, hadronToolSession: admitHadronToolSession({ instructions: 'x', invoke }) })
  await ready; f.runtime.cancelJobs()
  await expect(pending).rejects.toThrow(); expect(f.generate).toHaveBeenCalledTimes(1)
})
