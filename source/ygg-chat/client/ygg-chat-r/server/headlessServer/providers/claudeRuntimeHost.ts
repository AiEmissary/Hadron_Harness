import type { ClaudeCodeRuntime } from './claudeCodeRuntime.js'
let runtime: ClaudeCodeRuntime | undefined
/** Installed by the trusted desktop bootstrap, never a model/request argument. */
export function installClaudeRuntime(value: ClaudeCodeRuntime): void {
  if (runtime && runtime !== value) throw new Error('Claude runtime already configured')
  runtime = value
}
export const getClaudeRuntime = () => runtime
