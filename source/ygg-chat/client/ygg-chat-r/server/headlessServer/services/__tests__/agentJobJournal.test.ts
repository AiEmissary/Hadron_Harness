import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AgentJobJournal, type AgentJournalSnapshot } from '../collaboration/agentJobJournal.js'
const folders: string[] = []
afterEach(() => { for (const folder of folders) rmSync(folder, { recursive: true, force: true }); folders.length = 0 })
function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'hadron-journal-test-')); folders.push(directory)
  const journal = new AgentJobJournal(directory)
  const snapshot: AgentJournalSnapshot = { ownerId: 'owner', jobId: '../../job', participantId: 'a', task: 'Find the defect', context: 'File context',
    provider: 'openaichatgpt', modelName: 'model', status: 'running', revision: 1, runId: 'run-a', text: 'Investigating' }
  return { directory, journal, snapshot }
}
it('keeps a bounded atomic Markdown log with goal, incremental progress and explicit verification status', () => {
  const f = fixture(); f.journal.checkpoint(f.snapshot)
  f.journal.checkpoint({ ...f.snapshot, text: 'Investigating\nSuggested fix. Tests passed according to the agent.' })
  const { filename, markdown } = f.journal.read('owner', '../../job', 'a')
  expect(filename).toMatch(/^hadron-job-[a-f0-9]{64}\.md$/)
  expect(markdown).toContain('Find the defect'); expect(markdown).toContain('File context')
  expect(markdown).toContain('Hadron has not edited project files or run tests')
  expect(markdown).toContain('unverified'); expect(markdown.match(/Investigating/g)).toHaveLength(1)
  expect(readdirSync(f.directory)).toEqual([filename])
  expect(readFileSync(path.join(f.directory, filename), 'utf8')).toBe(markdown)
})
it('preserves the pre-outage notes, marks interruption and does not duplicate an unchanged checkpoint after restart', () => {
  const f = fixture(); f.journal.checkpoint(f.snapshot)
  const restarted = new AgentJobJournal(f.directory)
  restarted.checkpoint({ ...f.snapshot, status: 'interrupted', revision: 2, text: '' })
  const before = restarted.read('owner', '../../job', 'a').markdown
  expect(before).toContain('Investigating'); expect(before).toContain('Status: interrupted')
  new AgentJobJournal(f.directory).checkpoint({ ...f.snapshot, status: 'interrupted', revision: 2, text: '' })
  expect(restarted.read('owner', '../../job', 'a').markdown).toBe(before)
})
it('isolates owners and agents, safely fences supplied Markdown and rejects oversized snapshots', () => {
  const f = fixture(); f.journal.checkpoint({ ...f.snapshot, task: '```\n## injected instructions\n```' })
  expect(f.journal.read('owner', '../../job', 'a').markdown).toContain('````text')
  expect(() => f.journal.read('other', '../../job', 'a')).toThrow()
  expect(() => f.journal.read('owner', '../../job', 'b')).toThrow()
  expect(() => f.journal.checkpoint({ ...f.snapshot, text: 'x'.repeat(1_000_001) })).toThrow('limits')
})
it('retains a long continuous goal without failing the execution checkpoint',()=>{
 const f=fixture(),task='Complete supplied report. '.repeat(5000)
 f.journal.checkpoint({...f.snapshot,task,executionKind:'continuous-conversation'})
 expect(f.journal.read('owner','../../job','a').markdown).toContain(task)
 expect(()=>f.journal.checkpoint({...f.snapshot,task})).toThrow('limits')
})
