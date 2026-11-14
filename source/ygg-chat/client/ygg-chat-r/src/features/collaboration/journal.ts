export interface JournalDocument { filename: string; markdown: string }
export function parseJournal(value: any): JournalDocument {
  if (!value || !/^hadron-job-[a-f0-9]{64}\.md$/.test(value.filename) || typeof value.markdown !== 'string' ||
    new TextEncoder().encode(value.markdown).byteLength > 2 * 1024 * 1024) throw new Error('Unsupported job journal')
  return { filename: value.filename, markdown: value.markdown }
}
