import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

/** Process-local capability. Issue ONLY from a trusted main-frame IPC handler.
 * Never expose through HTTP, storage, logs, query parameters or child frames. */
export function createDesktopCollaborationAccess(currentPrincipal: () => { ownerId: string; sessionId: string } | null) {
  let issued: { ownerId: string; sessionId: string; token: string } | undefined
  return {
    issue(): string {
      const principal = currentPrincipal()
      if (!principal?.ownerId || !principal.sessionId) throw new Error('Desktop owner unavailable')
      // Concurrent status/start requests share one current grant. Explicit
      // revoke or a new auth session rotates it, not every IPC read.
      if (issued?.ownerId === principal.ownerId && issued.sessionId === principal.sessionId) return issued.token
      issued = { ...principal, token: randomBytes(32).toString('hex') }
      return issued.token
    },
    revoke(): void { issued = undefined },
    authenticatedOwner(req: Request): string | null {
      const address = req.socket.remoteAddress
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '')) return null
      const authorization = req.get('authorization')
      const principal = currentPrincipal()
      if (issued && (issued.ownerId !== principal?.ownerId || issued.sessionId !== principal?.sessionId)) issued = undefined
      if (!issued || !authorization?.startsWith('Bearer ')) return null
      const candidate = authorization.slice(7)
      if (!/^[a-f0-9]{64}$/.test(candidate)) return null
      return timingSafeEqual(Buffer.from(candidate), Buffer.from(issued.token)) ? issued.ownerId : null
    },
  }
}
