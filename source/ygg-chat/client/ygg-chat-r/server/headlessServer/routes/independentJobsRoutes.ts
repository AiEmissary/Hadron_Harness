import type { Express, Request, Response } from 'express'
import { parseIndependentJob } from '../../../../../shared/independentJobs.js'
import { CollaborationOwnerMismatch } from '../persistence/collaborationRepo.js'
import { ProposalAccessDenied } from '../services/collaboration/proposalSessionService.js'
import type { IndependentJobService } from '../services/collaboration/independentJobService.js'
import type { RunSessionRegistry } from '../services/runSessionRegistry.js'
import { serveOwnedReplay } from './ownedReplay.js'
import type { IndependentJobContexts } from '../services/collaboration/independentJobContexts.js'

export function registerIndependentJobsRoutes(app: Express, deps: { enabled: boolean; service: IndependentJobService;
  streams: RunSessionRegistry; contexts: IndependentJobContexts; authenticatedOwner(req: Request): string | null }): void {
  const base = '/api/collaboration/jobs'
  const owner = (req: Request, res: Response) => {
    if (!deps.enabled) { res.status(404).json({ error: 'not_found' }); return null }
    const id = deps.authenticatedOwner(req)
    if (!id || id.length > 128) { res.status(401).json({ error: 'unauthorized' }); return null }
    return id
  }
  const fail = (res: Response, error: unknown, admission = false) => {
    if (res.headersSent) { res.end(); return }
    res.status(error instanceof ProposalAccessDenied || error instanceof CollaborationOwnerMismatch ? 403 : admission ? 409 : 500).json({ error: 'job_request_rejected' })
  }
  app.post(`${base}/contexts`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try { res.json(deps.contexts.prepare(principal, req.body)) } catch (error) { fail(res, error, true) }
  })
  app.post(base, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    let input; try { input = parseIndependentJob(req.body) } catch { res.status(400).json({ error: 'invalid_job' }); return }
    try { void deps.service.start(principal, input).catch(() => {}); res.status(202).json(deps.service.status(principal, input.id)) }
    catch (error) { fail(res, error, true) }
  })
  app.get(`${base}/workspace`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    const source = req.query.conversationId, slot = req.query.slot
    if (typeof source !== 'string' || !source || source.length > 128 || !['a', 'b'].includes(slot as string)) { res.status(400).json({ error: 'invalid_workspace' }); return }
    const {cursor, focusNodeId} = req.query
    if ((cursor !== undefined && (typeof cursor !== 'string' || !/^[1-9]\d{0,14}:[jp]$/.test(cursor))) || (focusNodeId !== undefined && (typeof focusNodeId !== 'string' || !focusNodeId || focusNodeId.length > 256))) { res.status(400).json({error: 'invalid_workspace'}); return }
    try { res.json(deps.contexts.workspace(principal, source, slot as 'a' | 'b', {cursor: cursor as string | undefined, focusNodeId: focusNodeId as string | undefined})) } catch (error) { fail(res, error) }
  })
  app.get(`${base}/open`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    const id = req.query.conversationId
    if (typeof id !== 'string' || !id || id.length > 128) { res.status(400).json({ error: 'invalid_workspace' }); return }
    try { res.json(deps.contexts.openWorkspace(principal, id)) } catch (error) { fail(res, error) }
  })
  app.post(`${base}/:id/trash-conversation`, (req,res)=>{
    const principal=owner(req,res);if(!principal)return
    try{res.json(deps.contexts.removeConversation(principal,req.params.id as string))}catch(error){fail(res,error,true)}
  })
  app.get(`${base}/:id/edit-draft`, (req, res) => {
    const principal=owner(req,res);if(!principal)return
    try{res.json(deps.contexts.editDraft(principal,req.params.id as string))}catch(error){fail(res,error,true)}
  })
  app.get(`${base}/:id`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try { const status = deps.service.status(principal, req.params.id as string); if (!status) { res.status(404).json({ error: 'not_found' }); return } res.json(status) }
    catch (error) { fail(res, error) }
  })
  app.post(`${base}/:id/close-unstarted`,(req,res)=>{
    const principal=owner(req,res);if(!principal)return
    try{res.json(deps.contexts.closeUnstarted(principal,{...req.body,id:req.params.id}))}catch(error){fail(res,error,true)}
  })
  app.post(`${base}/:id/stop`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try {
      if (!deps.service.status(principal, req.params.id as string)) { res.status(404).json({ error: 'not_found' }); return }
      deps.service.stop(principal, req.params.id as string); res.status(202).json(deps.service.status(principal, req.params.id as string))
    } catch (error) { fail(res, error) }
  })
  app.get(`${base}/:id/transcript`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try { const transcript = deps.service.transcript(principal, req.params.id as string); if (!transcript) { res.status(404).json({ error: 'not_found' }); return } res.json(transcript) }
    catch (error) { fail(res, error) }
  })
  app.get(`${base}/:id/journal`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try { const journal = deps.service.journal(principal, req.params.id as string); if (!journal) { res.status(404).json({ error: 'not_found' }); return } res.json(journal) }
    catch (error) { fail(res, error) }
  })
  app.get(`${base}/:id/continuity`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try { res.json(deps.service.continuity(principal, req.params.id as string)) }
    catch (error) { fail(res, error) }
  })
  app.get(`${base}/:id/tree`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try { const tree = deps.service.tree(principal, req.params.id as string); if (!tree) { res.status(404).json({ error: 'not_found' }); return } res.json(tree) }
    catch (error) { fail(res, error) }
  })
  app.get(`${base}/:id/streams/:streamId`, (req, res) => {
    const principal = owner(req, res); if (!principal) return
    try {
      const id = req.params.id as string, streamId = req.params.streamId as string
      if (!deps.service.ownsStream(principal, id, streamId)) { res.status(404).json({ error: 'not_found' }); return }
      const status = deps.service.status(principal, id)!, stream = deps.streams.get(streamId)
      if (!stream || stream.accessScope !== 'collaboration' || stream.conversationId !== status.conversationId) { res.status(410).json({ error: 'stream_unavailable' }); return }
      serveOwnedReplay(req, res, stream, () => deps.enabled && deps.authenticatedOwner(req) === principal && deps.service.ownsStream(principal, id, streamId))
    } catch (error) { fail(res, error) }
  })
}
