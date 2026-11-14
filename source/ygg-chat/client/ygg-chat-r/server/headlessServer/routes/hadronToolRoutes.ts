import type { Express, Request } from 'express'
import { HadronToolLibrary } from '../../hadronTools/toolLibrary.js'
import { createHadronToolSession } from '../../hadronTools/toolSession.js'
import { randomUUID } from 'node:crypto'

/** User-only library controls. The model capability never includes these routes/actions. */
export function registerHadronToolRoutes(app: Express, deps: { enabled: boolean; authenticatedOwner(req: Request): string | null }) {
  const base = '/api/collaboration/tools'
  let activeTests = 0
  const library = () => {
    if (!process.env.HADRON_TOOLS_LIBRARY) throw new Error('Tool library is not configured')
    return new HadronToolLibrary(process.env.HADRON_TOOLS_LIBRARY)
  }
  app.get(base, (req, res) => {
    if (!deps.enabled) { res.sendStatus(404); return }
    const owner = deps.authenticatedOwner(req); if (!owner) { res.sendStatus(401); return }
    try { const store = library(); res.json({ root: store.root, tools: store.list(owner) }) }
    catch { res.status(503).json({ error: 'Tool library could not be read' }) }
  })
  app.post(base, (req, res) => {
    if (!deps.enabled) { res.sendStatus(404); return }
    const owner = deps.authenticatedOwner(req); if (!owner) { res.sendStatus(401); return }
    if (!req.body || Object.keys(req.body).sort().join(',') !== 'code,definition') { res.sendStatus(400); return }
    try { res.status(201).json(library().create(owner, 'manual:' + randomUUID(), req.body.definition, req.body.code)) }
    catch { res.status(400).json({ error: 'Invalid tool source/schema or library limit reached' }) }
  })
  app.post(`${base}/:name/:hash/test`, async (req, res) => {
    if (!deps.enabled) { res.sendStatus(404); return }
    const owner = deps.authenticatedOwner(req); if (!owner) { res.sendStatus(401); return }
    if (!req.body || Object.keys(req.body).join(',') !== 'arguments') { res.sendStatus(400); return }
    if (activeTests >= 2) { res.status(429).json({ error: 'Two manual tests are already running. Wait or cancel a test first.' }); return }
    activeTests++
    const controller = new AbortController()
    const closed = () => { if (!res.writableEnded) controller.abort() }
    res.on('close', closed)
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60000)])
    try {
      const store = library(), session = createHadronToolSession({ root: store.root, owner, job: 'manual-test:' + randomUUID(), mode: 'web' })
      const result = await store.execute(owner, req.params.name as string, req.params.hash as string, req.body.arguments, signal, (name, args) => session.invoke(name, args, signal))
      signal.throwIfAborted(); res.json({ success: true, result })
    } catch { if (!res.destroyed) res.status(409).json({ error: 'Test failed, timed out, or requested an unavailable capability. Check the source and test inputs.' }) }
    finally { activeTests--; res.off('close', closed) }
  })
  app.get(`${base}/:name/:hash/source`, (req, res) => {
    if (!deps.enabled) { res.sendStatus(404); return }
    const owner = deps.authenticatedOwner(req); if (!owner) { res.sendStatus(401); return }
    try { res.json({ code: library().source(owner, req.params.name as string, req.params.hash as string) }) }
    catch { res.status(404).json({ error: 'Tool version unavailable' }) }
  })
  app.post(`${base}/:name/enabled`, (req, res) => {
    if (!deps.enabled) { res.sendStatus(404); return }
    const owner = deps.authenticatedOwner(req); if (!owner) { res.sendStatus(401); return }
    if (!req.body || Object.keys(req.body).join(',') !== 'hash' || (req.body.hash !== null && typeof req.body.hash !== 'string')) { res.sendStatus(400); return }
    try { library().enable(owner, req.params.name as string, req.body.hash); res.json({ success: true }) }
    catch { res.status(409).json({ error: 'Tool version changed or is unavailable; refresh and review it again' }) }
  })
}
