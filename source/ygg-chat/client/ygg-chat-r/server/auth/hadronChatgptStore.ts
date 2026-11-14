import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { HadronChatgptAccount, HadronChatgptRegistration } from './hadronChatgptSignIn.js'
import { PrivateProfilePaths } from '../hadronTools/privateProfilePaths.js'
import { executionStartup } from '../hadronTools/executionStartup.js'

interface Cipher {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}
interface RecordV1 { version: 1; hostId: string; account: HadronChatgptAccount | null; pendingRegistration?: { clientId: string } }

function validate(value: unknown): asserts value is RecordV1 {
  const record = value as RecordV1
  if (!record || record.version !== 1 || !/^urn:uuid:[0-9a-f-]{36}$/i.test(record.hostId)) throw new Error('Invalid Hadron connection record')
  if (record.pendingRegistration !== undefined && (!record.pendingRegistration ||
    typeof record.pendingRegistration.clientId !== 'string' || !/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(record.pendingRegistration.clientId) ||
    Object.keys(record.pendingRegistration).some(key => key !== 'clientId'))) throw new Error('Invalid pending Hadron registration')
  const account = record.account
  if (account === null) return
  if (!account || account.issuer !== 'https://auth.openai.com' || !/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(account.clientId) ||
    account.hostId !== record.hostId || typeof account.subject !== 'string' || !account.subject || account.subject.length > 1024 ||
    !Number.isSafeInteger(account.expiresAt) || account.expiresAt <= 0 ||
    (account.refreshPending !== undefined && typeof account.refreshPending !== 'boolean') ||
    !Array.isArray(account.scopes) || account.scopes.length > 50 || account.scopes.some(scope => typeof scope !== 'string' || scope.length > 200) ||
    !['openid', 'resource.invoke', 'chatgpt.tokens.use.direct'].every(scope => account.scopes.includes(scope)) ||
    [account.accessToken, account.refreshToken, account.idToken].some(token => typeof token !== 'string' || !token || token.length > 65536) ||
    (account.email !== undefined && (typeof account.email !== 'string' || account.email.length > 1024))) throw new Error('Invalid Hadron ChatGPT account')
}

/** Host-only encrypted record. Cipher is Electron safeStorage on Windows (DPAPI).
 * No plaintext fallback, renderer storage, Graviton migration or global credentials.
 * Call only after app.ready, with Hadron's explicit profile directory.
 */
export class HadronChatgptStore {
  readonly filename: string
  private readonly paths: PrivateProfilePaths
  constructor(profileDirectory: string, private readonly cipher: Cipher) {
    if (!path.isAbsolute(profileDirectory)) throw new Error('Absolute Hadron profile required')
    if (executionStartup.isConfigured()) executionStartup.assertPrivatePath(profileDirectory)
    this.paths = new PrivateProfilePaths(profileDirectory)
    this.filename = path.join(profileDirectory, 'subscription-auth', 'chatgpt-v1.enc')
  }
  private assertStorage(filename = this.filename): void {
    if (executionStartup.isConfigured()) executionStartup.assertPrivatePath(filename)
    this.paths.absolute(filename)
  }
  private available(): void {
    if (!this.cipher.isEncryptionAvailable()) throw new Error('Protected Hadron credential storage is unavailable')
  }
  private read(): RecordV1 | null {
    this.available()
    try {
      this.assertStorage()
      let descriptor: number
      try { descriptor = fs.openSync(this.filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)) }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { this.assertStorage(); return null }; throw error }
      let encrypted: Buffer
      try {
        const before = fs.fstatSync(descriptor, { bigint: true }), named = fs.lstatSync(this.filename, { bigint: true })
        if (!before.isFile() || before.nlink !== 1n || before.size <= 0n || before.size > 262144n ||
          named.isSymbolicLink() || named.dev !== before.dev || named.ino !== before.ino) throw new Error('Invalid protected storage')
        const bytes = Buffer.alloc(Number(before.size) + 1); let size = 0
        while (size < bytes.length) { const count = fs.readSync(descriptor, bytes, size, bytes.length - size, size); if (!count) break; size += count }
        this.assertStorage()
        const after = fs.fstatSync(descriptor, { bigint: true }), current = fs.lstatSync(this.filename, { bigint: true })
        if (BigInt(size) !== before.size || after.size !== before.size || after.nlink !== 1n ||
          after.ctimeNs !== before.ctimeNs || after.mtimeNs !== before.mtimeNs ||
          current.dev !== before.dev || current.ino !== before.ino) throw new Error('Protected storage changed while reading')
        encrypted = bytes.subarray(0, size)
      } finally { fs.closeSync(descriptor) }
      const record: unknown = JSON.parse(this.cipher.decryptString(encrypted))
      validate(record); return record
    } catch { throw new Error('Hadron connection storage could not be read; existing data was preserved') }
  }
  private write(record: RecordV1): void {
    this.available(); validate(record)
    const encrypted = this.cipher.encryptString(JSON.stringify(record))
    if (!encrypted.length || encrypted.length > 262144) throw new Error('Invalid protected Hadron credential size')
    this.assertStorage()
    fs.mkdirSync(path.dirname(this.filename), { recursive: true, mode: 0o700 })
    this.assertStorage()
    const temporary = `${this.filename}.${randomUUID()}.tmp`
    let identity: { dev: bigint; ino: bigint } | undefined
    try {
      this.assertStorage(temporary)
      const descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600)
      try {
        const stat = fs.fstatSync(descriptor, { bigint: true }); identity = { dev: stat.dev, ino: stat.ino }
        fs.writeFileSync(descriptor, encrypted); fs.fsyncSync(descriptor)
      } finally { fs.closeSync(descriptor) }
      this.assertStorage(); this.assertStorage(temporary)
      const temporaryStat = fs.lstatSync(temporary, { bigint: true })
      if (temporaryStat.dev !== identity.dev || temporaryStat.ino !== identity.ino) throw new Error('Protected temporary identity changed')
      fs.renameSync(temporary, this.filename)
    } finally {
      if (identity && fs.existsSync(temporary)) {
        this.assertStorage(temporary)
        const stat = fs.lstatSync(temporary, { bigint: true })
        if (!stat.isSymbolicLink() && stat.dev === identity.dev && stat.ino === identity.ino) fs.unlinkSync(temporary)
      }
    }
  }
  hostId(): string {
    const existing = this.read()
    if (existing) return existing.hostId
    const record: RecordV1 = { version: 1, hostId: `urn:uuid:${randomUUID()}`, account: null }
    this.write(record); return record.hostId
  }
  account(): HadronChatgptAccount | null { return this.read()?.account ?? null }
  registration(): HadronChatgptRegistration | null {
    const record = this.read(), account = record?.account
    return account ? { clientId: account.clientId, subject: account.subject, idToken: account.idToken, email: account.email }
      : record?.pendingRegistration ? { clientId: record.pendingRegistration.clientId } : null
  }
  rememberRegistration(clientId: string): void {
    const record = this.read()
    if (!record || !/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(clientId)) throw new Error('Invalid Hadron recovery registration')
    if (record.account) return // Never replace the registration of a verified account.
    this.write({ ...record, pendingRegistration: { clientId } })
  }
  save(account: HadronChatgptAccount): void {
    const record = this.read()
    if (!record || account.hostId !== record.hostId) throw new Error('Hadron host identity mismatch')
    this.write({ version: 1, hostId: record.hostId, account })
  }
  disconnect(): void {
    const record = this.read()
    if (record) this.write({ version: 1, hostId: record.hostId, account: null }) // Stable host identity survives sign-out.
  }
}
