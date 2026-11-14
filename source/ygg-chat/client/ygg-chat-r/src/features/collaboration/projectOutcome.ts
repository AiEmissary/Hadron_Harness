import type { ProjectDraftView } from '../../../../../shared/projectBuild'
const excerpt = (text: string, limit: number) => text.length > limit ? text.slice(0, limit) + '\n[Excerpt ends; inspect the saved stage for the full text.]' : text
export function projectOutcome(view: ProjectDraftView) {
  const stage = (role: 'a' | 'b') => {
    const attempt = view.attempts.filter(item => item.role === role && item.response).at(-1)
    if (!attempt) return view.workersEnded ? 'This stage did not run.' : 'No recorded response yet.'
    let text = attempt.response!
    try { const parsed = JSON.parse(text); text = typeof parsed.summary === 'string' ? parsed.summary : typeof parsed.text === 'string' ? parsed.text : 'Structured proposal recorded; inspect the saved stage and file changes.' } catch { /* Plain text response. */ }
    return `${attempt.state}: ${excerpt(text, 2000)}`
  }
  const batch = Math.max(0, ...view.drafts.map(file => file.batch))
  const files = view.drafts.filter(file => file.batch === batch)
  const outcome = view.failure==='proposal_empty' ? 'No file changes were proposed or applied.' : view.failure ? 'This project step needs attention.' : view.acceptance ? 'You accepted this milestone.' : view.projectFilesChanged === 'uncertain' ? 'File changes need inspection.' : view.projectFilesChanged ? 'File changes recorded; review the checks below.' : view.state === 'ready_to_apply' ? 'Changes are ready; files have not been changed.' : `Project step: ${view.state}.`
  const next = view.failure==='proposal_empty' ? 'Read the agent explanation. Continue the conversation to clarify the task, or use Try again with a more specific instruction.' : view.failure ? 'Inspect the failure and saved state before retrying.' : view.interventionRequired ? 'Inspect saved state and resolve recovery before continuing execution.' : view.acceptance ? 'Choose the next milestone, or continue the conclusion in another workflow.' : view.canApply ? 'Approve the file changes when you are ready; you can inspect them in the Changes list.' : view.tests.status !== 'passed' && view.projectFilesChanged === true ? 'Run the relevant project checks and review their results.' : 'Review deliverables and any remaining checks before accepting this milestone.'
  const lines = [
    '# Hadron project conclusion', `Saved proposal: ${view.id}`, `Goal: ${excerpt(view.input.task, 1800)}`,
    `Outcome: ${outcome}`, `${view.input.participation&&view.input.participation!=='both'?'Agent '+view.input.participation.toUpperCase():'Agent A'} recommendation: ${stage('a')}`, `${view.input.participation&&view.input.participation!=='both'?'Self-check by Agent '+view.input.participation.toUpperCase():'Agent B check'}: ${stage('b')}`,
    `Latest proposed files (${files.length}): ${excerpt(files.map(file => `${file.path} (${file.state})`).join(', ') || 'None', 1500)}`,
    `Files changed: ${view.projectFilesChanged === true ? 'yes' : view.projectFilesChanged === false ? 'no' : 'uncertain'}. Tests: ${view.tests.status}. Build: ${view.builds?.status ?? 'not_run'}.`,
    `Milestone acceptance: ${view.acceptance ? `recorded${view.acceptance.testsWaived ? '; tests waived by you' : ''}` : 'not recorded'}.`,
    ...(view.failure ? [`Failure: ${excerpt(view.failure, 700)}`] : []), `Next step: ${next}`,
    'Agent review is not proof that the project works. This summary contains recorded findings and check states, not the full files or logs.',
  ]
  return { outcome, next, recommendation: stage('a'), review: stage('b'), text: lines.join('\n\n') }
}

/** Receipt reports host-recorded effects, never a model's claim of completion. */
export function projectTaskFeedback(view: ProjectDraftView) {
  const actor = view.input.participation && view.input.participation !== 'both' ? 'Agent ' + view.input.participation.toUpperCase() : 'Agents A and B'
  const batch = Math.max(0, ...view.drafts.map(file => file.batch))
  const files = view.drafts.filter(file => file.batch === batch)
  const saved = files.filter(file => file.state === 'applied')
  const headline = view.failure==='proposal_empty' && view.projectFilesChanged===false ? actor + ': no file changes were proposed or saved.' : view.failure || view.interventionRequired || view.projectFilesChanged === 'uncertain'
    ? actor + ': this task needs attention.'
    : saved.length ? actor + ': saved ' + saved.length + ' file' + (saved.length === 1 ? '.' : 's.')
    : view.projectFilesChanged === true ? actor + ': file changes are recorded.'
    : view.canApply ? actor + ': changes are ready for your approval. No files have been saved yet.'
    : view.state === 'cancelled' || view.state === 'interrupted' ? actor + ': the task stopped. No new file changes are confirmed.'
    : !view.workersEnded ? actor + ': working on your task.'
    : actor + ': no file changes were saved.'
  return { headline, files: files.map(file => ({id: file.id, path: file.path, action: file.state === 'applied' ? file.before === null ? 'Created' : 'Updated' : file.state === 'prepared' ? 'Not applied' : file.state})), checks: 'Tests: ' + view.tests.status.replaceAll('_', ' ') + '. Build: ' + (view.builds?.status ?? 'not_run').replaceAll('_', ' ') + '.' }
}
