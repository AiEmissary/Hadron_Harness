import { expect, it } from 'vitest'
import type { ProjectDraftView } from '../../../../../shared/projectBuild'
import { projectOutcome, projectTaskFeedback } from './projectOutcome'
const fixture = (overrides: Partial<ProjectDraftView> = {}) => ({
  id: 'saved-proposal', state: 'ready_to_apply', input: { task: 'Improve calculator', deliverables: ['Documentation'] },
  attempts: [{ role: 'a', state: 'completed', response: JSON.stringify({ summary: 'Add an example.' }) }, { role: 'b', state: 'completed', response: JSON.stringify({ summary: 'Example is correct.' }) }],
  drafts: [{ path: 'README.md', batch: 0, state: 'prepared' }], tests: { status: 'not_run' }, projectFilesChanged: false,
  canApply: true, interventionRequired: false, ...overrides,
} as ProjectDraftView)
it('distinguishes peer review from applied changes, tests and user acceptance', () => {
  const result = projectOutcome(fixture())
  expect(result.outcome).toContain('files have not been changed')
  expect(result.text).toContain('Files changed: no. Tests: not_run. Build: not_run.')
  expect(result.text).toContain('Milestone acceptance: not recorded')
  expect(result.recommendation).toContain('Add an example.')
  expect(result.review).toContain('Example is correct.')
  expect(result.next).toContain('Approve the file changes')
})
it('carries failure and uncertainty without claiming completion', () => {
  const result = projectOutcome(fixture({ failure: 'worker_failed', state: 'failed', projectFilesChanged: 'uncertain', canApply: false }))
  expect(result.text).toContain('worker_failed'); expect(result.text).toContain('Files changed: uncertain')
  expect(result.next).toContain('before retrying')
})
it('reports actual failed checks after application and tests waived on acceptance', () => {
  const result = projectOutcome(fixture({ canApply: false, projectFilesChanged: true, tests: { status: 'failed' }, builds: { status: 'passed' }, acceptance: { checked: ['Documentation'], testsWaived: true, acceptedAt: 'now' } }))
  expect(result.text).toContain('Files changed: yes. Tests: failed. Build: passed.')
  expect(result.text).toContain('tests waived by you')
})
it('uses the latest peer response and batch, and explicitly labels bounded excerpts', () => {
  const view = fixture(); view.input.task = 'x'.repeat(30000)
  view.attempts.push({ ...view.attempts[1], response: 'y'.repeat(30000) })
  view.drafts.push({ ...view.drafts[0], path: 'new.md', batch: 1 })
  const result = projectOutcome(view)
  expect(result.review).toContain('Excerpt ends')
  expect(result.text).toContain('new.md'); expect(result.text).not.toContain('README.md')
  expect(result.text.length).toBeLessThan(15000)
})

it('labels single-agent checks honestly instead of presenting a second main agent',()=>{
 const view=fixture();view.input.participation='b'
 const result=projectOutcome(view)
 expect(result.text).toContain('Agent B recommendation')
 expect(result.text).toContain('Self-check by Agent B')
 expect(result.text).not.toContain('Agent A recommendation')
})

it('gives Agent B a factual saved-file receipt even when tests were not run',()=>{
 const view=fixture({projectFilesChanged:true,canApply:false,workersEnded:true});view.input.participation='b';view.drafts[0]={...view.drafts[0],state:'applied',before:null,path:'PLAN.md'}
 const result=projectTaskFeedback(view)
 expect(result.headline).toBe('Agent B: saved 1 file.')
 expect(result.files[0]).toMatchObject({path:'PLAN.md',action:'Created'})
 expect(result.checks).toBe('Tests: not run. Build: not run.')
})
it('does not turn a proposed file or uncertain application into a saved-file success',()=>{
 const proposed=projectTaskFeedback(fixture())
 expect(proposed.headline).toContain('No files have been saved')
 expect(proposed.files[0].action).toBe('Not applied')
 expect(projectTaskFeedback(fixture({projectFilesChanged:'uncertain'})).headline).toContain('needs attention')
})

it('explains an empty proposal without claiming a system crash or invented repairs',()=>{
 const view=fixture({failure:'proposal_empty',state:'failed',canApply:false,drafts:[],workersEnded:true,attempts:[]});view.input.participation='b'
 expect(projectOutcome(view).outcome).toBe('No file changes were proposed or applied.')
 expect(projectOutcome(view).next).toContain('Continue the conversation')
 expect(projectOutcome(view).review).toBe('This stage did not run.')
 expect(projectTaskFeedback(view).headline).toBe('Agent B: no file changes were proposed or saved.')
})
