import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {spawn,execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const require=createRequire(import.meta.url),cwd=path.resolve(import.meta.dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-desktop-smoke-workspace-'))
const history=process.argv.includes('--history')
if(history){
 const source=path.join(process.env.APPDATA,'Hadron-Harness')
 execFileSync('python',['-c',`import sqlite3,sys,os,json
source,target=sys.argv[1:]
for name in ['local-sync.db','hadron-project-builds.db','hadron-continuous-chat.db']:
 original=sqlite3.connect('file:'+os.path.join(source,name)+'?mode=ro',uri=True);copy=sqlite3.connect(os.path.join(target,name));original.backup(copy);copy.close();original.close()
c=sqlite3.connect(os.path.join(target,'local-sync.db'))
row=c.execute('SELECT id,project_id FROM conversations WHERE id=?',('af80ad58-3739-4160-b7fe-a0fca2b83b5c',)).fetchone()
if not row: row=c.execute("SELECT id,project_id FROM conversations WHERE project_id IS NOT NULL AND id NOT LIKE 'hadron-job-%' AND id NOT LIKE 'hadron-proposal-%' ORDER BY updated_at DESC LIMIT 1").fetchone()
if not row: raise Exception('No saved workspace available')
with open(os.path.join(target,'history-target.json'),'w',encoding='utf-8') as f:json.dump({'chatId':row[0],'projectId':row[1]},f)
b=sqlite3.connect(os.path.join(target,'history-baseline.db'));c.backup(b);b.close();c.close()
`,source,profile],{windowsHide:true,stdio:'pipe'})
}
const outfile=path.join(cwd,'electron','workspace-smoke.mjs')
await build({entryPoints:[path.join(cwd,'electron','hadronWorkspaceSmoke.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',external:['electron','better-sqlite3','keytar','node-pty'],banner:{js:"import { createRequire as fixtureRequire } from 'node:module'; const require = fixtureRequire(import.meta.url);"},define:{'process.env.VITE_SUPABASE_URL':'""','process.env.VITE_SUPABASE_ANON_KEY':'""'}})
const env={...process.env,HADRON_DESKTOP_SMOKE_PROFILE:profile,HADRON_USE_BUILT_RENDERER:'1',...(history?{HADRON_WORKSPACE_HISTORY_ONLY:'1'}:{}),...(process.argv.includes('--consensus')?{HADRON_WORKSPACE_CONSENSUS_ONLY:'1'}:{})};delete env.ELECTRON_RUN_AS_NODE
console.log(profile)
const child=spawn(require('electron'),[outfile],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
const log=fs.createWriteStream(path.join(profile,'process.log'));child.stdout.pipe(log);child.stderr.pipe(log)
const timer=setTimeout(()=>child.kill(),150000)
child.on('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1})
child.on('exit',code=>{clearTimeout(timer);log.end();
if(history&&code===0){
 try{execFileSync('python',['-c',`import sqlite3,sys,os,json
p=sys.argv[1];c=sqlite3.connect(os.path.join(p,'local-sync.db'));c.execute('ATTACH DATABASE ? AS baseline',(os.path.join(p,'history-baseline.db'),))
changed=c.execute("SELECT count(*) FROM baseline.messages b LEFT JOIN main.messages m ON m.id=b.id WHERE m.id IS NULL OR m.content IS NOT b.content OR m.parent_id IS NOT b.parent_id OR m.role IS NOT b.role OR m.conversation_id IS NOT b.conversation_id").fetchone()[0]
if changed:raise Exception('Original saved message content or topology changed in the clone')
report=os.path.join(p,'workspace-result.json')
with open(report,encoding='utf-8') as f:r=json.load(f)
r['originalMessagesPreserved']=c.execute('SELECT count(*) FROM baseline.messages').fetchone()[0]
with open(report,'w',encoding='utf-8') as f:json.dump(r,f,indent=2)
c.close()
`,profile],{windowsHide:true,stdio:'pipe'})}catch(error){console.error(String(error));code=1}
}
const report=path.join(profile,code===0?'workspace-result.json':'workspace-failure.json');console.log(fs.existsSync(report)?fs.readFileSync(report,'utf8'):'No workspace report produced; inspect '+profile);process.exitCode=code??1})
