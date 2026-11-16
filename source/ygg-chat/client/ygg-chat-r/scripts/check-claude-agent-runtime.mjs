import {build} from 'esbuild'
import {spawn} from 'node:child_process'
import path from 'node:path'
if(!process.argv.includes('--live'))throw Error('This check uses the existing Claude Code account for a small disposable coding task. Pass --live explicitly.')
const cwd=path.resolve(import.meta.dirname,'..'),outfile=path.join(cwd,'electron','claude-agent-runtime-smoke.mjs')
await build({entryPoints:[path.join(cwd,'electron','hadronClaudeAgentSmoke.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',external:['keytar','node-pty','better-sqlite3'],banner:{js:"import { createRequire as smokeRequire } from 'node:module'; const require = smokeRequire(import.meta.url);"}})
const child=spawn(process.execPath,[outfile],{cwd,windowsHide:true,shell:false,stdio:'inherit'})
child.on('error',()=>{process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
