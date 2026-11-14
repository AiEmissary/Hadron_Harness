import { describe, expect, it } from 'vitest'
import type { Request } from 'express'
import { createDesktopCollaborationAccess } from '../collaboration/desktopAccess.js'

const request = (token?: string, address = '127.0.0.1') => ({
  socket: { remoteAddress: address }, get: (name: string) => name === 'authorization' && token ? `Bearer ${token}` : undefined,
  body: { ownerId: 'owner' }, query: { token },
}) as unknown as Request

describe('desktop collaboration capability boundary', () => {
  it('requires an issued capability and never trusts body/query identity', () => {
    const access = createDesktopCollaborationAccess(() => ({ ownerId: 'owner', sessionId: 'login-1' }))
    expect(access.authenticatedOwner(request())).toBeNull()
    const token = access.issue()
    expect(access.authenticatedOwner(request(token))).toBe('owner')
    expect(access.authenticatedOwner(request('x'.repeat(64)))).toBeNull()
    expect(access.authenticatedOwner(request(token, '192.168.1.5'))).toBeNull()
    expect(access.authenticatedOwner({ ...request(), query: { token } } as unknown as Request)).toBeNull()
  })
  it('invalidates capability on rotation, explicit revoke, sign-out and owner replacement', () => {
    let principal: { ownerId: string; sessionId: string } | null = { ownerId: 'owner', sessionId: 'login-1' }
    const access = createDesktopCollaborationAccess(() => principal)
    const first = access.issue()
    expect(access.issue()).toBe(first)
    access.revoke()
    const second = access.issue()
    expect(access.authenticatedOwner(request(first))).toBeNull()
    principal = { ownerId: 'replacement', sessionId: 'login-2' }
    expect(access.authenticatedOwner(request(second))).toBeNull()
    principal = null
    expect(() => access.issue()).toThrow()
    access.revoke()
    principal = { ownerId: 'owner', sessionId: 'login-3' }
    expect(access.authenticatedOwner(request(second))).toBeNull()
    const third = access.issue()
    principal = { ownerId: 'owner', sessionId: 'login-4' }
    expect(access.authenticatedOwner(request(third))).toBeNull()
  })
})
