/** Large attached documents (PDF, Word, text) kept whole and read by the agent through search/read tools,
 * instead of being pasted into the 16,000-character shared context. */
export interface HadronDocument { name: string; text: string }
export const HADRON_DOCUMENT_MAX_CHARS = 2_000_000
export const HADRON_DOCUMENTS_MAX_TOTAL_CHARS = 4_000_000
export const HADRON_DOCUMENT_MAX_COUNT = 5
/** Attached text longer than this is kept as a searchable document rather than inlined. */
export const HADRON_DOCUMENT_INLINE_CHARS = 12_000

export function parseHadronDocuments(value: unknown): HadronDocument[] {
  if (!Array.isArray(value) || value.length > HADRON_DOCUMENT_MAX_COUNT) throw new Error(`Use up to ${HADRON_DOCUMENT_MAX_COUNT} large documents.`)
  const names = new Set<string>()
  let total = 0
  const documents = value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['name', 'text'].includes(key))) throw new Error('Invalid document')
    const { name, text } = item as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim() || name.length > 1000 || names.has(name)) throw new Error('Invalid document name')
    if (typeof text !== 'string' || !text.trim() || text.length > HADRON_DOCUMENT_MAX_CHARS) throw new Error(`${name}: documents can hold up to ${HADRON_DOCUMENT_MAX_CHARS.toLocaleString('en-GB')} characters of text.`)
    names.add(name); total += text.length
    return { name, text }
  })
  if (total > HADRON_DOCUMENTS_MAX_TOTAL_CHARS) throw new Error(`Large documents can hold up to ${HADRON_DOCUMENTS_MAX_TOTAL_CHARS.toLocaleString('en-GB')} characters in total.`)
  return documents
}
