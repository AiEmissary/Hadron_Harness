import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { BUILTIN_TOOL_DEFINITIONS } from '../../../../../../../shared/builtinToolDefinitions.js'
import type { ResolvedSubagentTools } from '../../subagentRunService.js'

// Execute the production resolver with real built-in definitions without importing
// the composition root's workers/auth/services. Host availability is explicit.
const source = readFileSync(new URL('../../../index.ts', import.meta.url), 'utf8')
const start = source.indexOf('const HEADLESS_RUNTIME_BUILTIN_TOOL_NAMES =')
const end = source.indexOf('const sleep =', start)
if (start < 0 || end < 0) throw new Error('Production tool resolver boundaries changed')
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText
export const productionToolResolver = runInNewContext(`${code}; resolveInferenceToolsByName`, {
  BUILTIN_TOOL_DEFINITIONS,
  isBuiltInToolAvailable: () => true,
  customToolRegistry: { getDefinitions: () => [] },
}) as (names: string[] | undefined) => ResolvedSubagentTools
