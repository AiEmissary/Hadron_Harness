import sanitizeHtmlLib from 'sanitize-html'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { isWindows, resolveToWindowsPath } from '../utils/wslBridge.js'

interface HtmlRendererInput {
  html?: string
  path?: string
  cwd?: string
  allowUnsafe?: boolean
}

function expandHome(filePath: string): string {
  if (filePath === '~') return os.homedir()
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

async function resolveHtmlPath(filePath: string, cwd?: string): Promise<string> {
  let effectivePath = expandHome(filePath)
  let effectiveCwd = cwd ? expandHome(cwd) : process.cwd()
  if (isWindows()) {
    if (effectivePath.startsWith('/')) effectivePath = await resolveToWindowsPath(effectivePath)
    if (effectiveCwd.startsWith('/')) effectiveCwd = await resolveToWindowsPath(effectiveCwd)
  }
  // cwd is a resolution base only, not an access boundary. Any readable local file is allowed.
  return path.resolve(effectiveCwd, effectivePath)
}

/**
 * Cleans tool HTML before it is shown: no scripts, event handlers, frames, plug-ins,
 * forms or javascript: links. Styling (style tags, style/class attributes) and
 * ordinary layout, tables, lists and images are kept, so pages still
 * look right. allowUnsafe returns the HTML unchanged for callers that explicitly ask.
 */
export function sanitizeHtml(html: string, allowUnsafe = false): string {
  if (allowUnsafe) return html
  // Keep a leading <!doctype html> so cleaned pages still render in standards mode.
  const doctype = /^\s*<!doctype html>/i.exec(html)?.[0].trim() ?? ''
  return doctype + sanitizeHtmlLib(html, {
    allowedTags: [
      ...sanitizeHtmlLib.defaults.allowedTags,
      'html', 'head', 'body', 'title', 'meta', 'style', 'img', 'figure', 'figcaption', 'picture',
      'details', 'summary', 'mark', 'small', 'sub', 'sup', 'del', 'ins', 'u', 's', 'kbd', 'samp', 'var',
      'progress', 'meter', 'time', 'colgroup', 'col', 'center', 'font', 'label',
    ],
    disallowedTagsMode: 'discard',
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title', 'lang', 'dir', 'role', 'aria-*', 'data-*', 'align', 'valign', 'width', 'height', 'hidden'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'alt', 'loading', 'decoding'],
      meta: ['charset', 'name', 'content'],
      td: ['colspan', 'rowspan', 'headers', 'scope'],
      th: ['colspan', 'rowspan', 'headers', 'scope', 'abbr'],
      col: ['span'], colgroup: ['span'],
      ol: ['start', 'reversed', 'type'], li: ['value'],
      progress: ['value', 'max'], meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
      time: ['datetime'], details: ['open'], font: ['color', 'face', 'size'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    // Style sheets cannot run code in current browsers; they are needed for faithful rendering.
    allowVulnerableTags: true,
    // A meta refresh can redirect the viewer; keep only charset/name metadata.
    exclusiveFilter: frame => frame.tag === 'meta' && 'http-equiv' in frame.attribs,
  })
}

export async function run(params: HtmlRendererInput) {
  const { html, path: filePath, cwd, allowUnsafe = false } = params
  if (html !== undefined && filePath !== undefined) {
    return { success: false, error: 'Provide either html or path, not both' }
  }

  let sourceHtml = html
  if (filePath !== undefined) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      return { success: false, error: 'path must be a non-empty string' }
    }
    if (cwd !== undefined && (typeof cwd !== 'string' || cwd.trim().length === 0)) {
      return { success: false, error: 'cwd must be a non-empty string' }
    }
    try {
      const resolvedPath = await resolveHtmlPath(filePath, cwd)
      const stat = await fs.stat(resolvedPath)
      if (!stat.isFile()) return { success: false, error: 'path must point to a regular file' }
      sourceHtml = await fs.readFile(resolvedPath, 'utf8')
    } catch (error) {
      return { success: false, error: `Unable to read HTML file: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  if (typeof sourceHtml !== 'string' || sourceHtml.trim().length === 0) {
    return { success: false, error: 'Provide non-empty html or a path to a non-empty HTML file' }
  }

  const sanitized = sanitizeHtml(sourceHtml, allowUnsafe)

  return {
    success: true,
    html: sanitized,
  }
}

export default { run }
