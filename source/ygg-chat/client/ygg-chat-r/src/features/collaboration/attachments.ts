
export interface SharedAttachment { id: string; name: string; text: string }
export const SHARED_FILE_ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonl,.py,.html,.css,.scss,.xml,.yaml,.yml,.toml,.ini,.log,.sql,.rs,.go,.java,.c,.h,.cpp,.hpp,.cs,.sh,.ps1,.r'
const extensions = new Set(SHARED_FILE_ACCEPT.split(','))

/** Read only files explicitly picked by the user. No paths, disk scanning or HTTP upload. */
export async function readSharedFiles(files: readonly File[], existing: readonly SharedAttachment[] = []): Promise<SharedAttachment[]> {
  if (files.length + existing.length > 5) throw new Error('Choose up to five shared files.')
  const prepared = await Promise.all(files.map(async file => {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!extensions.has(extension)) throw new Error(`${file.name}: choose a PDF, Word (.docx), text or code file.`)
    const document = extension === '.pdf' || extension === '.docx'
    const maxBytes = 8 * 1024 * 1024
    if (file.size > maxBytes) throw new Error(`${file.name}: the file exceeds Hadron's 8 MiB attachment limit. Use Add folder for bounded text excerpts instead.`)
    let text: string
    if (document) {
      try { text = await (await import('./documentText')).readDocumentText(extension, await file.arrayBuffer()) }
      catch (error) { throw new Error(`${file.name}: ${error instanceof Error ? error.message : 'Document text could not be read.'}`) }
    } else {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()) }
      catch { throw new Error(`${file.name}: the file must contain UTF-8 text.`) }
    }
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error(`${file.name}: empty or binary files cannot be shared as text.`)
    return { id: crypto.randomUUID(), name: file.name, text }
  }))
  return [...existing, ...prepared]
}

export {composeSharedContext} from './attachmentContext'
