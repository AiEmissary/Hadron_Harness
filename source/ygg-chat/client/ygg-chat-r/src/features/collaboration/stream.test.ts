import { describe, expect, it, vi } from 'vitest'
import { CollaborationStreamError, consumeCollaborationStream } from './stream'
const encoder = new TextEncoder()
const wire = (...frames: unknown[]) => frames.map(frame => `data: ${JSON.stringify(frame)}\r\n\r\n`).join('')
const signal = () => new AbortController().signal
const delta = (seq: number, text: string) => ({ type: 'chunk', seq, part: 'text', delta: text })

describe('collaboration replay reader', () => {
  it('decodes split UTF-8/CRLF frames and stops applying after the terminal frame', async () => {
    const bytes = encoder.encode(': heartbeat\r\n\r\n' + wire(delta(1, 'α'), { type: 'complete', seq: 2 }, delta(3, 'late')))
    const body = new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      controller.close()
    } })
    const received: unknown[] = []
    expect(await consumeCollaborationStream(new Response(body), 0, signal(), frame => received.push(frame))).toEqual({ cursor: 2, terminal: true })
    expect(received).toEqual([delta(1, 'α'), { type: 'complete', seq: 2 }])
  })
  it('preserves the committed cursor on disconnect and deduplicates explicit reconnect replay', async () => {
    const received: number[] = []
    let error: CollaborationStreamError | undefined
    try { await consumeCollaborationStream(new Response(wire(delta(1, 'first'))), 0, signal(), frame => received.push(frame.seq)) }
    catch (failure) { error = failure as CollaborationStreamError }
    expect(error).toMatchObject({ code: 'disconnected', cursor: 1 })
    const result = await consumeCollaborationStream(new Response(wire(delta(1, 'duplicate'), { type: 'complete', seq: 2 })),
      error!.cursor, signal(), frame => received.push(frame.seq))
    expect(result.cursor).toBe(2)
    expect(received).toEqual([1, 2])
  })
  it('bounds individual frames without rejecting a large batch of valid replay frames', async () => {
    const frames = Array.from({ length: 2000 }, (_, i) => delta(i + 1, 'x'.repeat(150)))
    const apply = vi.fn()
    expect(await consumeCollaborationStream(new Response(wire(...frames, { type: 'complete', seq: 2001 })), 0, signal(), apply))
      .toEqual({ cursor: 2001, terminal: true })
    expect(apply).toHaveBeenCalledTimes(2001)
    await expect(consumeCollaborationStream(new Response(wire(delta(1, 'x'.repeat(262145)))), 0, signal(), () => {}))
      .rejects.toMatchObject({ code: 'invalid_frame', cursor: 0 })
  })
  it.each([
    { body: wire(delta(3, 'gap')), code: 'gap' },
    { body: 'data: malformed\n\n', code: 'invalid_frame' },
    { body: 'data: null\n\n', code: 'invalid_frame' },
    { body: wire({ type: 'access_revoked' }), code: 'access_revoked' },
  ])('fails closed on $code without applying a frame', async ({ body, code }) => {
    const apply = vi.fn()
    await expect(consumeCollaborationStream(new Response(body), 0, signal(), apply)).rejects.toMatchObject({ code, cursor: 0 })
    expect(apply).not.toHaveBeenCalled()
  })
  it('cancels a stalled read on detach without applying late frames or sending Stop', async () => {
    const controller = new AbortController(), cancel = vi.fn(), apply = vi.fn()
    const body = new ReadableStream({ start(stream) { stream.enqueue(encoder.encode(wire(delta(1, 'first')))) }, cancel })
    const outcome = consumeCollaborationStream(new Response(body), 0, controller.signal, apply).catch(error => error)
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1))
    controller.abort()
    expect((await outcome).name).toBe('AbortError')
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
