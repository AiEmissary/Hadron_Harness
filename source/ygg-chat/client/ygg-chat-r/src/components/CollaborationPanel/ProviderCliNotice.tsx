export function ProviderCliNotice() {
  return <aside aria-label='Provider CLI notice' className='mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100'>
    <p><strong>Before connecting:</strong> Hadron uses the official Codex and Claude Code CLIs. Sign in with your own account. Prompts and selected context are sent to that provider and count against your account’s allowances.</p>
    <p className='mt-2'>Your plan, workspace rules and provider terms must allow this use. Hadron is independent of OpenAI and Anthropic; using their CLI does not guarantee permission or prevent account restrictions. Never share sign-in codes or tokens.</p>
    <p className='mt-2'><a href='https://learn.chatgpt.com/docs/auth' target='_blank' rel='noreferrer' className='underline'>Codex sign-in guidance</a>{' · '}<a href='https://code.claude.com/docs/en/legal-and-compliance' target='_blank' rel='noreferrer' className='underline'>Claude Code terms and eligibility</a></p>
  </aside>
}
