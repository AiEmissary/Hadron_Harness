import fs from 'node:fs'
import path from 'node:path'

export const insideProject = (root: string, target: string): boolean => {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
}
export const deniedProjectName = (name: string): boolean => /^(\.git|node_modules|\.ssh|\.aws|\.azure|\.gnupg|\.kube|\.config|\.codex|\.claude|\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.hadron-write-.*|credentials\.json|auth\.json|\.env(?:\..*)?|.*\.(?:pem|key|pfx|p12))$/i.test(name)

export function selectedProjectRoot(root: string, protectedRoots: string[] = []): string {
  if (!path.isAbsolute(root)) throw Error('Absolute selected project required')
  const canonical = fs.realpathSync(root), stat = fs.lstatSync(root)
  const protectedPaths=protectedRoots.flatMap(item=>{
    const absolute=path.resolve(item)
    try{return [absolute,fs.realpathSync(absolute)]}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [absolute];throw Error('Protected application folder could not be verified')}
  })
  if (stat.isSymbolicLink() || !stat.isDirectory() || canonical === path.parse(canonical).root ||
    canonical.split(path.sep).some(deniedProjectName) || protectedPaths.some(item => insideProject(item, canonical) || insideProject(canonical, item))) {
    throw Error('Choose a project folder outside protected application and account folders')
  }
  return canonical
}

/** Existing ancestors must be plain directories; only the final file may be absent. */
export function projectPath(root: string, raw: unknown, options: { rootAllowed?: boolean; missingLeaf?: boolean; missingParents?:boolean } = {}): string {
  if (typeof raw !== 'string' || raw.length > 1024 || raw.includes('\\') || raw.includes(':') || raw.includes('\0') || path.posix.isAbsolute(raw)) throw Error('Use a project-relative path with forward slashes')
  const parts = raw === '' && options.rootAllowed ? [] : raw.split('/')
  if (parts.length>16)throw Error('Project path is too deeply nested')
  if (parts.some(part => !part || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' ') || deniedProjectName(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw Error('Project path is unavailable')
  let target = root
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part)
    try {
      const stat = fs.lstatSync(target)
      if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())) throw Error('Linked or invalid project paths are unavailable')
    } catch (error) {
      if((error as NodeJS.ErrnoException).code==='ENOENT'&&options.missingParents){const candidate=path.join(root,...parts);if(!insideProject(root,candidate))throw Error('Project path escaped its folder');return candidate}
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !options.missingLeaf || index !== parts.length - 1) throw error
      if (!insideProject(root, fs.realpathSync(path.dirname(target)))) throw Error('Project path escaped its folder')
      return target
    }
  }
  if (!insideProject(root, fs.realpathSync(target))) throw Error('Project path escaped its folder')
  return target
}
