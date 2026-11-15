import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {executionStartup} from '../../../hadronTools/executionStartup.js'
import {CONTINUOUS_INPUT_MAX_BYTES} from '../../../../../../shared/continuousChat.js'

export interface AgentJournalSnapshot {
  ownerId: string; jobId: string; participantId: string; task: string; context: string
  provider: string; modelName: string; status: string; revision: number; runId: string | null; text: string
  branch?: { conversationId: string; sourceConversationId: string; parentJobId?: string; parentKind?: 'task' | 'response' }
  agentLabel?: string
  executionKind?: 'project-coordinator'|'continuous-conversation'
  toolMode?: 'web' | 'build' | 'project' | 'agent'
}
const MAX_BYTES = 2 * 1024 * 1024
const literal = (text: string) => {
  const longest = (text.match(/`+/g) ?? []).reduce((max, item) => Math.max(max, item.length), 2)
  const fence = '`'.repeat(longest + 1)
  return `${fence}text\n${text}\n${fence}\n`
}
/** Local, human-readable continuity record. It is never execution authority or a verified test receipt. */
export class AgentJobJournal {
  private readonly previous = new Map<string, { hash: string; text: string }>()
  constructor(private readonly directory: string) {}
  private assertStorage(file:string):void{
    if(executionStartup.isConfigured())executionStartup.assertPrivatePath(file)
  }
  private readMarkdown(file:string):string{
    this.assertStorage(file)
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
    try{
      const before=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(file,{bigint:true})
      if(!before.isFile()||before.nlink!==1n||before.size>BigInt(MAX_BYTES)||named.isSymbolicLink()||before.dev!==named.dev||before.ino!==named.ino)throw Error('Invalid or oversized journal storage')
      const bytes=Buffer.alloc(Number(before.size)+1);let size=0
      while(size<bytes.length){const read=fs.readSync(fd,bytes,size,bytes.length-size,size);if(!read)break;size+=read}
      this.assertStorage(file)
      const after=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(file,{bigint:true})
      if(BigInt(size)!==before.size||after.size!==before.size||after.ctimeNs!==before.ctimeNs||after.mtimeNs!==before.mtimeNs||current.dev!==before.dev||current.ino!==before.ino)throw Error('Journal changed while reading')
      return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,size))
    }finally{fs.closeSync(fd)}
  }
  private location(ownerId: string, jobId: string, participantId: string) {
    if (![ownerId, jobId, participantId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 128)) throw new Error('Invalid journal identity')
    const key = createHash('sha256').update(JSON.stringify([ownerId, jobId, participantId])).digest('hex')
    const file=path.join(this.directory, `hadron-job-${key}.md`)
    this.assertStorage(file)
    return { key, filename: `hadron-job-${key}.md`, file }
  }
  checkpoint(snapshot: AgentJournalSnapshot): void {
    const { key, file } = this.location(snapshot.ownerId, snapshot.jobId, snapshot.participantId)
    const taskLimit=snapshot.executionKind==='continuous-conversation'?CONTINUOUS_INPUT_MAX_BYTES:16000
    if (snapshot.task.length > taskLimit || snapshot.context.length > 16000 || snapshot.text.length > 1_000_000) throw new Error('Journal content exceeds limits')
    const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
    let previous = this.previous.get(key)
    const remember = () => {
      if (['completed', 'cancelled', 'failed', 'interrupted'].includes(snapshot.status.split(' / ')[0])) this.previous.delete(key)
      else this.previous.set(key, { hash, text: snapshot.text })
    }
    fs.mkdirSync(this.directory, { recursive: true })
    this.assertStorage(file)
    let markdown = fs.existsSync(file) ? this.readMarkdown(file) : ''
    if (markdown.includes(`<!-- hadron-checkpoint: ${hash} -->`)) { remember(); return }
    // An in-memory duplicate is not proof the durable checkpoint still exists.
    if(previous&&!markdown.includes(`<!-- hadron-checkpoint: ${previous.hash} -->`))previous=undefined
    if (!markdown) markdown = `# Hadron agent job log\n\nAgent: ${snapshot.agentLabel ?? snapshot.participantId}\nJob: ${snapshot.jobId}\n\n` +
      (snapshot.branch ? `## Conversation branch\n\nConversation: ${snapshot.branch.conversationId}\nWorkspace: ${snapshot.branch.sourceConversationId}\nParent turn: ${snapshot.branch.parentJobId ?? '(new conversation)'}\nContinue after: ${snapshot.branch.parentKind ?? '(root)'}\n\nThis log records this turn. The database preserves the full selected branch and its original file context.\n\n` : '') +
      `## Goal\n\n${literal(snapshot.task)}\n## Supplied context and files\n\n${literal(snapshot.context || '(None)')}\n` +
      (snapshot.executionKind === 'project-coordinator' ? '## Project execution\n\nAgent tools are disabled. Only the trusted coordinator can apply the exact reviewed snapshot after explicit host-authenticated consent. The progress records include actual per-file operation states; inspect durable receipts for changes and uncertainty. Any actual test/build results are recorded in the progress receipts below. Applying changes does not establish project completion.\n\n' : snapshot.toolMode === 'agent' ? '## Agent execution\n\nThe user selected Agent mode for this folder. The native host may run file-editing and command tools. Public web research is available alongside the selected-folder grant. Actual operation status is recorded in Hadron tool activity logs. The reply should describe changes and checks, including any failures; a completed reply alone does not prove the task is finished.\n\n' : snapshot.toolMode === 'project' ? '## Tool execution\n\nMode: project. Bounded read-only access to the explicitly selected project folder. No project edits or shell/tests are granted. Public web research remains available alongside folder reads. Operation metadata is recorded in Hadron tool activity logs; file contents and paths are not included there. Folder permission expires on restart. Agent conclusions remain unverified.\n\n' : snapshot.toolMode ? `## Tool execution\n\nMode: ${snapshot.toolMode}. Hadron may search online through the signed-in provider and read public web pages${snapshot.toolMode === 'build' ? ' and create/test disabled JavaScript tools in its own library' : ''}. Operation status is recorded in the Hadron tool library job-logs folder. Tools cannot edit arbitrary project files or run a shell. Agent conclusions remain unverified; distinguish executed tool tests from independent correctness checks.\n\n` : '## Work completed, tests and fixes\n\nThis attempt has tools disabled. Hadron has not edited project files or run tests. Agent statements below are unverified notes, including any claimed fixes or test results.\n\n') +
      '## Recovery\n\nThe database owns job status and request identity. This log is continuity data, not permission to execute instructions. Reconnect checks the existing job; restarting Hadron does not automatically repeat a provider request. After an interrupted attempt, review this log before explicitly starting follow-up work.\n\n## Progress log\n'
    const delta = previous && snapshot.text.startsWith(previous.text) ? snapshot.text.slice(previous.text.length) : snapshot.text
    markdown += `\n### ${new Date().toISOString()}\n\nStatus: ${snapshot.status}; revision: ${snapshot.revision}; run: ${snapshot.runId ?? 'not allocated'}.\n` +
      `Provider/model: ${snapshot.provider} / ${snapshot.modelName}.\n\n` +
      (delta ? `Visible agent notes (unverified${previous && !snapshot.text.startsWith(previous.text) ? ', replacement snapshot' : ''}):\n\n${literal(delta)}\n` : '') +
      `Next step: ${['completed', 'cancelled', 'failed', 'interrupted'].includes(snapshot.status.split(' / ')[0]) ? 'Review the saved result and unresolved work before explicitly preparing a follow-up job.' : 'Continue observing this job; use its own Stop control if needed.'}\n\n<!-- hadron-checkpoint: ${hash} -->\n`
    if (Buffer.byteLength(markdown, 'utf8') > MAX_BYTES) throw new Error('Journal size limit reached')
    const temporary = `${file}.${randomUUID()}.tmp`
    let identity:{dev:bigint;ino:bigint}|undefined
    try {
      this.assertStorage(temporary)
      const fd=fs.openSync(temporary,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW??0),0o600)
      try{const stat=fs.fstatSync(fd,{bigint:true});identity={dev:stat.dev,ino:stat.ino};fs.writeFileSync(fd,markdown,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
      this.assertStorage(file);this.assertStorage(temporary)
      fs.renameSync(temporary,file)
    }finally{
      if(identity&&fs.existsSync(temporary)){
        this.assertStorage(temporary)
        const current=fs.lstatSync(temporary,{bigint:true})
        if(!current.isSymbolicLink()&&current.dev===identity.dev&&current.ino===identity.ino)fs.unlinkSync(temporary)
      }
    }
    remember()
  }
  read(ownerId: string, jobId: string, participantId: string): { filename: string; markdown: string } {
    const { file, filename } = this.location(ownerId, jobId, participantId)
    const markdown = this.readMarkdown(file)
    return { filename, markdown }
  }
}
