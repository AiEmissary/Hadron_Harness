import type { Request, Response } from 'express'
import type { RunSession, RunSubscriber } from '../services/runSessionRegistry.js'
import { writeSseEvent } from '../stream/sseWriter.js'

/** Shared scoped replay transport. Detaching never cancels the underlying job. */
export function serveOwnedReplay(req: Request, res: Response, session: RunSession, authorize: () => boolean): void {
  const allowed = () => { try { return authorize() } catch { return false } }
  if (!allowed()) { res.status(403).json({ error: 'forbidden' }); return }
  const raw = req.query.fromSeq ?? '0'
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    res.status(400).json({ error: 'invalid_cursor' }); return
  }
  const cursor = Number(raw)
  if (!session.canReplayFrom(cursor)) { res.status(409).json({ error: 'history_unavailable' }); return }
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.flushHeaders()
  const revoke = () => { if (!res.writableEnded && !res.destroyed) { writeSseEvent(res, { type: 'access_revoked' }); res.end() } }
  const subscriber: RunSubscriber = {
    send: frame => {
      if (res.writableEnded || res.destroyed) return
      if (!allowed()) { revoke(); return }
      const payload: Record<string, unknown> = { ...frame.event, seq: frame.seq }; writeSseEvent(res, payload)
    },
    end: () => { if (!res.writableEnded) res.end() },
  }
  const heartbeat = setInterval(() => {
    if (!allowed()) revoke()
    else if (!res.writableEnded && !res.destroyed) res.write(': heartbeat\n\n')
  }, 1000)
  res.on('close', () => { clearInterval(heartbeat); session.detach(subscriber) })
  session.attach(subscriber, cursor)
}
