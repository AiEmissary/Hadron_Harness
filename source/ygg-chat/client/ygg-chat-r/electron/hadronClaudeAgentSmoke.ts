import {profile} from './hadronClaudeAgentBootstrap.js'
import {writeFileSync,readFileSync} from 'node:fs'
import path from 'node:path'
import {ClaudeCodeRuntime} from '../server/headlessServer/providers/claudeCodeRuntime.js'
import {ProjectReadHost} from '../server/hadronTools/projectRead.js'
import {ProjectAgentHost} from '../server/hadronTools/projectAgent.js'
import {admitHadronToolSession} from '../server/hadronTools/types.js'
import {readTextFile} from '../server/tools/readFile.js'
import {editFile} from '../server/tools/editFile.js'
import {runPowerShellCommand} from '../server/tools/powershell.js'
import {buildHadronWorkerPrompt} from '../server/headlessServer/services/collaboration/hadronWorkerPrompt.js'

// Explicit live developer check, isolated from Hadron's saved user profile.
// The official CLI reuses its existing login; no credentials are read or copied.
const root=path.join(profile,'project')
const {mkdirSync}=await import('node:fs');mkdirSync(root)
writeFileSync(path.join(root,'fixture.cjs'),'exports.add=(a,b)=>a-b;\n')
writeFileSync(path.join(root,'fixture.test.cjs'),"const {test}=require('node:test');const assert=require('node:assert/strict');const {add}=require('./fixture.cjs');test('negative operand',()=>assert.equal(add(-2,3),1));\n")
const accountProfile=path.join(process.env.APPDATA!,'Hadron-Harness')
const previousConfig=process.env.CLAUDE_CONFIG_DIR
process.env.CLAUDE_CONFIG_DIR=path.join(accountProfile,'claude-code')
const runtime=new ClaudeCodeRuntime({runtimeDirectory:path.resolve(import.meta.dirname,'..','vendor','claude-code'),nativeHostDirectory:path.resolve(import.meta.dirname,'..','vendor','hadron-worker'),profileDirectory:profile,reuseExistingLogin:true})
if(previousConfig===undefined)delete process.env.CLAUDE_CONFIG_DIR;else process.env.CLAUDE_CONFIG_DIR=previousConfig
// Only the CLI's existing account directory is reused. Runtime prompts, worker
// evidence, configuration and file operations stay in the temporary profile.
const reads=new ProjectReadHost(),agents=new ProjectAgentHost(reads),operations:Array<{tool:string;success:boolean}>=[]
let testPassed=false
try{
 const models=await runtime.models()
 if(!models.some(model=>model.id==='haiku'))throw Error('An existing signed-in Claude Code account is required; this check never opens sign-in.')
 const read=reads.grant('fixture-owner','fixture-workspace','a',root),grant=agents.grant('fixture-owner','fixture-workspace','a',read.id)
 const definitions=[
  {name:'read_file',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}},
  {name:'edit_file',inputSchema:{type:'object',properties:{path:{type:'string'},operation:{type:'string',enum:['replace']},searchPattern:{type:'string'},replacement:{type:'string'}},required:['path','operation','searchPattern','replacement']}},
  {name:'powershell',inputSchema:{type:'object',properties:{command:{type:'string',enum:['node --test fixture.test.cjs']},description:{type:'string'}},required:['command','description']}},
 ]
 const base=agents.session({owner:'fixture-owner',workspace:'fixture-workspace',slot:'a',grantId:grant.id,conversationId:'fixture-chat',anchorMessageId:'fixture-question',definitions,authorize:()=>{},execute:async(call,context)=>{
  const args=JSON.parse(call.arguments);let result:any
  if(call.name==='read_file'&&['fixture.cjs','fixture.test.cjs'].includes(args.path))result=await readTextFile(args.path,{cwd:root})
  else if(call.name==='edit_file'&&args.path==='fixture.cjs'&&args.operation==='replace')result=await editFile(args.path,args.operation,{...args,cwd:root,operationMode:'execute',createBackup:true})
  else if(call.name==='powershell'&&args.command==='node --test fixture.test.cjs'){
   result=await runPowerShellCommand(args.command,{cwd:root,signal:context.signal,timeoutMs:15000,maxOutputChars:8000})
   testPassed=result.success===true&&JSON.stringify(result).includes('negative operand')
  }else throw Error('Only the disposable fixture files and fixed test command are allowed')
  operations.push({tool:call.name,success:result?.success!==false});return result
 }})
 const session=admitHadronToolSession({...base,maxRequests:12,deadlineAt:Date.now()+300000})
 const result=await runtime.generate({modelName:'haiku',requestPolicy:'single_attempt',history:[],tools:[],systemPrompt:buildHadronWorkerPrompt('implementation'),userContent:'Fix the add function in fixture.cjs so add(-2,3) returns 1. Read the fixture first, make the minimal edit, run node --test fixture.test.cjs, and finish with a concise report of the actual results. This is a disposable local coding test. Work only on these two fixture files. Do not inspect other folders, use web tools, sign in/out or change account settings.',hadronToolSession:session,signal:AbortSignal.timeout(300000)})
 const completed=!session.outcome?.incompleteReason&&testPassed&&/a\s*\+\s*b/.test(readFileSync(path.join(root,'fixture.cjs'),'utf8'))
 const report={success:completed,provider:'Claude Code',model:'haiku',existingLoginReused:true,isolatedWorkDirectory:profile,fixtureProject:root,operations,testPassed,outcome:session.outcome,answerChars:result.content.length,savedChatsAndDraftsOpened:false,originalUserTaskReplayed:false}
 writeFileSync(path.join(profile,'result.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report,null,2)+'\n')
 if(!completed)process.exitCode=1
}catch(error){
 const report={success:false,error:error instanceof Error?error.message:'Runtime check failed',isolatedProfile:profile,operations,testPassed}
 writeFileSync(path.join(profile,'result.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=1
}finally{await runtime.shutdown();agents.clear();reads.clear()}
