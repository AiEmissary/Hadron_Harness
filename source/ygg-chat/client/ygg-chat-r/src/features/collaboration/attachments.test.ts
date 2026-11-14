import { expect, it, vi } from 'vitest'
import { composeSharedContext, readSharedFiles } from './attachments'
import { buildProposalInput, initialDraft } from './setup'
it('reads selected text/code files locally and packs the same immutable data for both agents', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    const files = await readSharedFiles([new File(['Task instructions'], 'brief.md'), new File(['print("hello")'], 'sample.py')])
    const draft = { ...initialDraft(), attachments: files,
      participants: [{ id: 'a' as const, provider: 'openaichatgpt', modelName: 'model' }, { id: 'b' as const, provider: 'openaichatgpt', modelName: 'model' }] as const }
    const input = buildProposalInput({ ...draft, participants: [...draft.participants] }, [{ provider: 'openaichatgpt', label: 'ChatGPT', connected: true, models: [{ id: 'model', label: 'Model' }] }],
      { sessionId: 's', conversationId: 'c', sourceLineageId: 'l', anchorMessageId: 'm', context: 'branch text' })
    const packet = JSON.parse(input.context)
    expect(packet.files).toEqual([{ name: 'brief.md', text: 'Task instructions' }, { name: 'sample.py', text: 'print("hello")' }])
    expect(packet.branchContext).toBe('branch text')
    expect(input.task).toBe('Work on the attached files.')
    files[0].text = 'edited later'
    expect(input.context).toContain('Task instructions')
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
it('rejects unsupported, binary, invalid UTF-8, excessive count/size and oversized context explicitly', async () => {
  await expect(readSharedFiles([new File(['binary'], 'image.png')])).rejects.toThrow('PDF, Word')
  await expect(readSharedFiles([new File([new Uint8Array([0, 1])], 'binary.txt')])).rejects.toThrow('binary')
  await expect(readSharedFiles([new File([new Uint8Array([255])], 'invalid.txt')])).rejects.toThrow('UTF-8')
  await expect(readSharedFiles([new File([' '.repeat(5)], 'empty.txt')])).rejects.toThrow('empty')
  await expect(readSharedFiles([new File(['x'.repeat(8*1024*1024+1)], 'big.txt')])).rejects.toThrow('8 MiB')
  await expect(readSharedFiles(Array.from({ length: 6 }, (_, i) => new File(['a'], `${i}.txt`)))).rejects.toThrow('five')
  expect(() => composeSharedContext('b'.repeat(15000), [{ id: 'a', name: 'a.md', text: 'f'.repeat(2000) }])).toThrow('shared-context limit')
})

it('accepts large local text for explicit excerpt selection without increasing the shared context budget',async()=>{const [file]=await readSharedFiles([new File(['line\n'.repeat(20000)],'debug.log')]);expect(file.text.length).toBe(100000);expect(()=>composeSharedContext('',[file])).toThrow('shared-context limit')})
