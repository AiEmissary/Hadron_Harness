import { describe, expect, it } from 'vitest'
import { emptyPreview, previewReducer } from './previewState'
import { initialDraft } from './setup'
const draft = { ...initialDraft(), task: 'Fixture task' }
describe('dual participant fixture projection', () => {
  it('keeps channel text separate and ignores duplicate/reordered replay frames', () => {
    let state = previewReducer(emptyPreview(), { type: 'start', sessionId: 'one', draft })
    state = previewReducer(state, { type: 'delta', sessionId: 'one', participant: 'b', seq: 1, text: 'B only' })
    state = previewReducer(state, { type: 'delta', sessionId: 'one', participant: 'a', seq: 2, text: 'A only' })
    const replay = previewReducer(state, { type: 'delta', sessionId: 'one', participant: 'a', seq: 1, text: 'late duplicate' })
    expect(replay).toBe(state)
    expect(replay.text).toEqual({ a: 'A only', b: 'B only' })
  })
  it('fences late completion/deltas after Stop and from a previous session after restart', () => {
    let state = previewReducer(emptyPreview(), { type: 'start', sessionId: 'old', draft })
    state = previewReducer(state, { type: 'stop', sessionId: 'old' })
    expect(previewReducer(state, { type: 'complete', sessionId: 'old' })).toBe(state)
    expect(previewReducer(state, { type: 'delta', sessionId: 'old', participant: 'a', seq: 1, text: 'late' })).toBe(state)
    state = previewReducer(state, { type: 'start', sessionId: 'new', draft })
    expect(previewReducer(state, { type: 'complete', sessionId: 'old' })).toBe(state)
    expect(state.text).toEqual({ a: '', b: '' })
    const done = previewReducer(state, { type: 'complete', sessionId: 'new' })
    expect(done.status?.status).toBe('completed')
    expect(done.status?.artifacts).toEqual([])
  })
})
