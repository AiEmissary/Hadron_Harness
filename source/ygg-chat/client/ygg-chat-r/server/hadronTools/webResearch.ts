import {admitHadronToolSession, type HadronToolSession} from './types.js'

const folderTools = new Set(['project_list','project_search','project_read','read_file','read_files','glob','ripgrep','edit_file','multi_edit','create_file','delete_file','bash','powershell'])

/** Web access is independent of the selected folder. Preserve its native read/write grant. */
export function withWebResearch(web: HadronToolSession, folder?: HadronToolSession): HadronToolSession {
  if (!folder) return web
  return admitHadronToolSession({
    ...folder,
    bindWebSearch: web.bindWebSearch,
    evidenceAttempted: () => !!folder.evidenceAttempted?.() || !!web.evidenceAttempted?.(),
    evidenceInstruction: 'Attempt a relevant selected-folder or public-web operation using the supplied JSON host protocol. Native CLI tools remain disabled; the named host operations are available. Report a failed operation honestly.',
    instructions: web.instructions + '\n' + folder.instructions + '\nCOMBINED TOOL ACCESS: The public-web operations and enabled custom tools above are available alongside the selected-folder tools. This overrides only the earlier no-web restriction. Folder reads, writes and commands retain exactly their existing grant; web access never grants a file operation. Choose tools relevant to the current question; never send private file text, credentials or attached contents to a search engine or web page. Search uses the signed-in provider, with Brave as an optional configured alternative. No browser sign-in, forms, account actions or purchases are provided by these read-only web tools.',
    invoke: (name, args, signal) => folderTools.has(name) ? folder.invoke(name, args, signal) : web.invoke(name, args, signal),
  })
}
