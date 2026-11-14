/** Account status only; no runtime implementation or credentials cross IPC. */
export interface ClaudeRuntimeStatus {
 installed:boolean;version:string|null;connected:boolean;
 reason:'ready'|'not_installed'|'signed_out'|'unsupported_version'|'status_unavailable'|'different_auth_method'|'profile_mismatch';
 loginState?:'idle'|'running'|'failed';
}
