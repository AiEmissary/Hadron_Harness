import { expect, it, vi } from 'vitest'
import { withDocumentTools, documentLines } from '../hadronTools/documentTools.js'
import { admitHadronToolSession } from '../hadronTools/types.js'
import { parseHadronDocuments, HADRON_DOCUMENT_MAX_CHARS } from '../../../../shared/hadronDocuments.js'
import { parseIndependentJob } from '../../../../shared/independentJobs.js'

const signal = new AbortController().signal
const pdfText = Array.from({ length: 300 }, (_, page) => `Page ${page + 1}\n` + (page === 241 ? 'The lane_open_cap rule blocks entries. ' : 'Ordinary text. ').repeat(60)).join('\n\n')

it('lets the agent search and read a long PDF in parts, and passes other tools through', async () => {
  const base = admitHadronToolSession({ instructions: 'base', invoke: vi.fn(async () => ({ passed: true })) })
  const session = withDocumentTools(base, [{ name: 'report.pdf', text: pdfText }])
  expect(session.instructions).toContain('document_search')
  const found = await session.invoke('document_search', { query: 'LANE_OPEN_CAP' }, signal) as any
  expect(found.totalMatches).toBeGreaterThan(0)
  expect(found.matches[0]).toMatchObject({ document: 'report.pdf', page: 242 })
  const read = await session.invoke('document_read', { document: 'report.pdf', startLine: found.matches[0].line, lineCount: 3 }, signal) as any
  expect(read.text).toContain('lane_open_cap')
  expect(read.endLine - read.startLine).toBeLessThan(3)
  expect(await session.invoke('read_file', { path: 'a' }, signal)).toEqual({ passed: true })
  await expect(session.invoke('document_read', { document: 'missing.pdf' }, signal)).rejects.toThrow('Unknown document')
})

it('splits very long extracted lines so each read stays bounded', () => {
  expect(documentLines('x'.repeat(1200)).map(line => line.length)).toEqual([500, 500, 200])
})

it('returns the same session when no documents are attached', () => {
  const base = admitHadronToolSession({ instructions: 'base', invoke: vi.fn() })
  expect(withDocumentTools(base, undefined)).toBe(base)
})

it('validates documents on jobs: limits, tool mode and unknown fields', () => {
  expect(() => parseHadronDocuments([{ name: 'a.pdf', text: 'x'.repeat(HADRON_DOCUMENT_MAX_CHARS + 1) }])).toThrow()
  expect(() => parseHadronDocuments([{ name: 'a.pdf', text: 'x', extra: 1 }])).toThrow()
  const job = { schemaVersion: 1, id: 'j', conversationId: 'c', anchorMessageId: 'm', task: 't', context: '', provider: 'claudecode', modelName: 'sonnet', documents: [{ name: 'a.pdf', text: pdfText }] }
  expect(() => parseIndependentJob(job)).toThrow('tool-enabled')
  expect(parseIndependentJob({ ...job, toolMode: 'web' }).documents?.[0].name).toBe('a.pdf')
})
