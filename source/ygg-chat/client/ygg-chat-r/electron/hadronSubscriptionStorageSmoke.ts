import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { HadronChatgptStore } from '../server/auth/hadronChatgptStore.js'
import { withHadronAuthLease } from '../server/auth/hadronAuthLease.js'

const profile = process.env.HADRON_AUTH_SMOKE_PROFILE ?? ''
if (!profile || !path.isAbsolute(profile) || !path.basename(profile).startsWith('hadron-auth-smoke-')) throw new Error('Explicit smoke profile required')
app.setPath('userData', profile)
app.setName('Hadron subscription storage smoke')
async function runSmoke(): Promise<void> {
try {
  await app.whenReady()
  const store = new HadronChatgptStore(profile, safeStorage)
  const hostId = await withHadronAuthLease(profile, async () => store.hostId()), phase = process.env.HADRON_AUTH_SMOKE_PHASE
  if (phase === 'registration') {
    await withHadronAuthLease(profile, async () => store.rememberRegistration('oaiapp_smoke'))
    if (store.account() !== null || readFileSync(store.filename).includes(Buffer.from('oaiapp_smoke'))) throw new Error('Recovery registration leaked or authenticated an account')
    writeFileSync(path.join(profile, 'host-fixture.txt'), hostId)
  } else if (phase === 'seed') {
    if (hostId !== readFileSync(path.join(profile, 'host-fixture.txt'), 'utf8') ||
      store.account() !== null || store.registration()?.clientId !== 'oaiapp_smoke') throw new Error('Recovery registration did not survive restart')
    await withHadronAuthLease(profile, async () => store.save({ issuer: 'https://auth.openai.com', clientId: 'oaiapp_smoke', hostId, subject: 'synthetic-subject',
      accessToken: 'synthetic-access-not-a-credential', refreshToken: 'synthetic-refresh-not-a-credential',
      idToken: 'synthetic-id-not-a-credential', expiresAt: 1900000000000,
      scopes: ['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'] }))
    const bytes = readFileSync(store.filename)
    if (bytes.includes(Buffer.from('synthetic-access')) || bytes.includes(Buffer.from('synthetic-refresh'))) throw new Error('Plaintext persisted')
    writeFileSync(path.join(profile, 'host-fixture.txt'), hostId)
  } else if (phase === 'recover') {
    if (hostId !== readFileSync(path.join(profile, 'host-fixture.txt'), 'utf8') ||
      store.account()?.accessToken !== 'synthetic-access-not-a-credential') throw new Error('Protected record did not survive restart')
    await withHadronAuthLease(profile, async () => store.disconnect())
    if (store.account() !== null || store.hostId() !== hostId) throw new Error('Sign-out lost host identity')
    if (existsSync(path.join(profile, 'subscription-auth', 'mutation.lock'))) throw new Error('Owned mutation lock was not released')
    const report = { success: true, platform: process.platform, electron: process.versions.electron,
      encryptionAvailable: safeStorage.isEncryptionAvailable(), restartDecryption: true, plaintextAbsent: true,
      recoveryRegistrationAcrossRestart: true, privateMutationLeaseReleased: true,
      hostIdentityRetainedAfterSignOut: true, realCredentialsUsed: false, networkRequests: 0, profile }
    writeFileSync(path.join(profile, 'storage-result.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } else throw new Error('Unknown phase')
  app.quit()
} catch (error) { console.error(error instanceof Error ? error.message : 'Storage smoke failed'); app.exit(1) }
}
void runSmoke()
