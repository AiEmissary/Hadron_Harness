import { useQuery } from '@tanstack/react-query'

/** Saved task links only: listing and opening never dispatch an agent request. */
export function SavedAutomaticConversations({ conversationId, onOpen, filter = '' }: {
  conversationId: string; onOpen(id: string): void; filter?: string
}) {
  const { data = [], error, refetch } = useQuery({
    queryKey: ['hadron-saved-automatic-conversations', conversationId],
    queryFn: () => window.electronAPI!.continuousChat.list(conversationId),
    enabled: !!window.electronAPI?.continuousChat && !/^(hadron-job-|hadron-proposal-)/.test(conversationId),
    staleTime: 0,
    retry: false,
  })
  if (error) return <button type='button' className='my-1 text-xs' onClick={() => void refetch()}>Retry loading saved agent conversations</button>
  const matches = data.filter(item => item.goal.toLowerCase().includes(filter.trim().toLowerCase()))
  if (!matches.length) return null
  return <section aria-label='Saved automatic conversations' className='my-2 space-y-2 border-l-2 border-cyan-300 pl-3'>
    <p className='text-xs font-semibold'>Agent conversations</p>
    {matches.map((item, index) => <button key={item.id} type='button' className='block w-full rounded-lg border px-3 py-2 text-left text-xs' onClick={() => onOpen(item.id)} title='Open saved replies without restarting the agents'>
      <span className='block line-clamp-2'>{item.goal}</span>
      <span className='mt-1 block opacity-70'>{item.state.replaceAll('_', ' ')} · saved session {index + 1} · {item.id.slice(0, 8)}</span>
    </button>)}
  </section>
}
