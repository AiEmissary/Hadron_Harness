import { expect, it, vi } from 'vitest'
import { chatgptDiagnostic, HadronChatgptSignInError, readChatgptTokenRejection } from '../auth/hadronChatgptDiagnostics.js'

it('retains standard OAuth categories and field names, discarding descriptions and credentials', async () => {
  for (const body of [
    { error: 'invalid_grant', error_description: 'private-code private-token' },
    { error: { code: 'invalid_grant', param: 'code_verifier', message: 'private-code private-token' } },
  ]) {
    const rejection = await readChatgptTokenRejection(new Response(JSON.stringify(body), { status: 400 }))
    const diagnostic = chatgptDiagnostic(new HadronChatgptSignInError('token_http', 400, rejection))
    expect(diagnostic.message).toContain('invalid_grant')
    expect(JSON.stringify(diagnostic)).not.toMatch(/private-code|private-token|error_description/)
  }
})
it('does not publish arbitrary strings placed in machine-readable fields', async () => {
  const rejection = await readChatgptTokenRejection(new Response(JSON.stringify({ error: { code: 'private-token', param: 'private-code', type: 'private-type' } })))
  expect(rejection).toEqual({ format: 'json' })
})
it('identifies non-JSON error pages and caps streamed bodies before retaining them', async () => {
  expect(await readChatgptTokenRejection(new Response('<html>private diagnostic</html>'))).toEqual({ format: 'non_json' })
  const cancel = vi.fn()
  const large = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(16385)) }, cancel }))
  expect(await readChatgptTokenRejection(large)).toEqual({ format: 'too_large' })
  expect(cancel).toHaveBeenCalledOnce()
})
