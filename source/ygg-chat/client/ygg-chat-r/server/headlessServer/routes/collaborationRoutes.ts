import type { Express, Request, Response } from 'express'
import { parseProposalSession } from '../../../../../shared/collaboration.js'
import { CollaborationOwnerMismatch } from '../persistence/collaborationRepo.js'
import { ProposalAccessDenied, type ProposalSessionService } from '../services/collaboration/proposalSessionService.js'
import type { RunSessionRegistry } from '../services/runSessionRegistry.js'
import { serveOwnedReplay } from './ownedReplay.js'

interface CollaborationRoutesDeps {
  enabled: boolean
  service: Pick<ProposalSessionService, 'start' | 'status' | 'stop' | 'ownsStream' | 'list' | 'transcript'> & Partial<Pick<ProposalSessionService, 'journal' | 'tree' | 'preflight'>>
  streams?: Pick<RunSessionRegistry, 'get'>
  contexts?: { prepare(owner: string, raw: unknown): unknown }
  /** Trusted host authentication; never obtain identity from request body/query. */
  authenticatedOwner(req: Request): string | null
}

/** Proposal routes registered by the composition root behind the disabled live gate. */
export function registerCollaborationRoutes(app: Express, deps: CollaborationRoutesDeps): void {
  const base = '/api/collaboration/proposals'
  const principal = (req: Request, res: Response): string | null => {
    if (!deps.enabled) { res.status(404).json({ error: 'not_found' }); return null }
    const owner = deps.authenticatedOwner(req)
    if (!owner || !owner.trim() || owner.length > 128) { res.status(401).json({ error: 'unauthorized' }); return null }
    return owner
  }
  const fail = (res: Response, error: unknown, admission = false) => {
    if (error instanceof ProposalAccessDenied || error instanceof CollaborationOwnerMismatch) {
      res.status(403).json({ error: 'forbidden' })
    } else res.status(admission ? 409 : 500).json({ error: admission ? 'admission_rejected' : 'internal_error' })
  }
  app.post(`${base}/preflight`, (req,res)=>{
    const owner=principal(req,res);if(!owner)return
    if(!deps.service.preflight){res.sendStatus(404);return}
    try{res.json(deps.service.preflight(owner,req.body))}catch{res.status(409).json({error:'shared_context_unavailable'})}
  })
  app.get(`${base}/tree`, (req, res) => {
    const owner = principal(req,res); if(!owner)return
    try {
      if(!deps.service.tree){res.sendStatus(404);return}
      if(typeof req.query.conversationId!=='string'){res.sendStatus(400);return}
      res.json(deps.service.tree(owner,req.query.conversationId))
    }catch(error){fail(res,error)}
  })
  app.post(`${base}/context`, (req, res) => {
    const owner = principal(req, res); if (!owner) return
    try {
      if (!deps.contexts) { res.status(404).json({ error: 'not_found' }); return }
      res.json(deps.contexts.prepare(owner, req.body))
    } catch (error) { fail(res, error, true) }
  })
  app.get(`${base}/:sessionId/participants/:participantId/journal`, (req, res) => {
    const owner = principal(req, res); if (!owner) return
    try {
      const journal = deps.service.journal?.(owner, req.params.sessionId as string, req.params.participantId as string)
      if (!journal) { res.status(404).json({ error: 'not_found' }); return }
      res.json(journal)
    } catch (error) { fail(res, error) }
  })
  app.get(base, (req, res) => {
    const owner = principal(req, res)
    if (!owner) return
    const { conversationId, limit = '20', before } = req.query
    if (typeof conversationId !== 'string' || !conversationId.trim() || conversationId.length > 128 ||
      typeof limit !== 'string' || !/^[1-9][0-9]?$/.test(limit) || Number(limit) > 50 ||
      (before !== undefined && (typeof before !== 'string' || !before || before.length > 128))) {
      res.status(400).json({ error: 'invalid_page' }); return
    }
    try { res.json(deps.service.list(owner, conversationId, Number(limit), before as string | undefined)) }
    catch (error) { fail(res, error) }
  })
  app.post(base, (req, res) => {
    const owner = principal(req, res)
    if (!owner) return
    let input
    try { input = parseProposalSession(req.body) }
    catch { res.status(400).json({ error: 'invalid_request' }); return }
    try {
      // Admission is synchronous; completion is durable/polled and independent of
      // this HTTP connection. Observe rejection to prevent an unhandled promise.
      const completion = deps.service.start(owner, input)
      void completion.catch(() => {})
      res.status(202).json(deps.service.status(owner, input.sessionId))
    } catch (error) { fail(res, error, true) }
  })
  app.get(`${base}/:sessionId`, (req, res) => {
    const owner = principal(req, res)
    if (!owner) return
    try {
      const status = deps.service.status(owner, req.params.sessionId as string)
      if (!status) { res.status(404).json({ error: 'not_found' }); return }
      res.json(status)
    } catch (error) { fail(res, error) }
  })
  app.get(`${base}/:sessionId/participants/:participantId/transcript`, (req, res) => {
    const owner = principal(req, res)
    if (!owner) return
    try {
      const transcript = deps.service.transcript(owner, req.params.sessionId as string, req.params.participantId as string)
      if (!transcript) { res.status(404).json({ error: 'transcript_unavailable' }); return }
      res.json(transcript)
    } catch (error) { fail(res, error) }
  })
  app.get(`${base}/:sessionId/streams/:streamId`, (req, res) => {
    const owner = principal(req, res)
    if (!owner) return
    try {
      const id = req.params.sessionId as string, streamId = req.params.streamId as string
      if (!deps.service.ownsStream(owner, id, streamId)) { res.status(404).json({ error: 'not_found' }); return }
      const status = deps.service.status(owner, id)!
      const session = deps.streams?.get(streamId)
      if (!session || session.accessScope !== 'collaboration' || session.conversationId !== status.conversationId) { res.status(410).json({ error: 'stream_unavailable' }); return }
      serveOwnedReplay(req, res, session, () => deps.enabled && deps.authenticatedOwner(req) === owner && deps.service.ownsStream(owner, id, streamId))
    } catch (error) {
      if (res.headersSent) res.end()
      else fail(res, error)
    }
  })
  app.post(`${base}/:sessionId/stop`, (req, res) => {
    const owner = principal(req, res)
    if (!owner) return
    try {
      const id = req.params.sessionId as string
      if (!deps.service.status(owner, id)) { res.status(404).json({ error: 'not_found' }); return }
      deps.service.stop(owner, id)
      res.status(202).json(deps.service.status(owner, id))
    } catch (error) { fail(res, error) }
  })
}
