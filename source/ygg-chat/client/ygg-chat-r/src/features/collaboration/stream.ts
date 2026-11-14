export interface CollaborationFrame extends Record<string, unknown> { type: string; seq: number }
export class CollaborationStreamError extends Error {
  constructor(public readonly code: 'disconnected' | 'gap' | 'invalid_frame' | 'access_revoked', public readonly cursor: number) {
    super(`Collaboration stream ${code}`)
  }
}

/** One attachment only. Reattach explicitly using error.cursor; never relaunch inference. */
export async function consumeCollaborationStream(response: Response, fromSeq: number, signal: AbortSignal,
  onFrame: (frame: CollaborationFrame) => void): Promise<{ cursor: number; terminal: true }> {
  if (!response.body) throw new CollaborationStreamError('disconnected', fromSeq)
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let cursor = fromSeq, buffer = ''
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  const parse = (block: string): boolean => {
    if (block.length > 262144) throw new CollaborationStreamError('invalid_frame', cursor)
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data) return false
    let frame: CollaborationFrame
    try { frame = JSON.parse(data) } catch { throw new CollaborationStreamError('invalid_frame', cursor) }
    if (!frame || typeof frame !== 'object') throw new CollaborationStreamError('invalid_frame', cursor)
    if (frame.type === 'access_revoked') throw new CollaborationStreamError('access_revoked', cursor)
    if (typeof frame.type !== 'string' || !Number.isSafeInteger(frame.seq) || frame.seq < 1) throw new CollaborationStreamError('invalid_frame', cursor)
    if (frame.seq <= cursor) return false
    if (frame.seq !== cursor + 1) throw new CollaborationStreamError('gap', cursor)
    onFrame(frame)
    cursor = frame.seq
    return frame.type === 'complete' || frame.type === 'error'
  }
  try {
    signal.throwIfAborted()
    for (;;) {
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      buffer += decoder.decode(value, { stream: !done })
      // Normalize only complete CRLF pairs so a pair split across reads survives.
      buffer = buffer.replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (parse(block)) return { cursor, terminal: true }
      }
      if (buffer.length > 262144) throw new CollaborationStreamError('invalid_frame', cursor)
      if (done) throw new CollaborationStreamError('disconnected', cursor)
    }
  } catch (error) {
    if (signal.aborted) signal.throwIfAborted()
    if (error instanceof CollaborationStreamError) throw error
    throw new CollaborationStreamError('disconnected', cursor)
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
