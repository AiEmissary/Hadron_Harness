export type HadronCodexSignInMethod = 'browser' | 'device'
/** Credential-free desktop projection. Keep OAuth URLs, state and PKCE in the host. */
export interface HadronCodexStatus {
  installed: boolean; connected: boolean; reason: 'ready' | 'signed_out' | 'not_installed' | 'status_unavailable' | 'different_auth_method'
  loginState: 'idle' | 'running' | 'failed'
  loginMethod?: HadronCodexSignInMethod
  browserReady?: boolean
  device?: { verificationUri: string; userCode: string }
}
