import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import Ajv, { type ValidateFunction } from 'ajv'
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-cjs-release-sync'

const NAME = /^[a-z][a-z0-9_]{2,47}$/
const HASH = /^[a-f0-9]{64}$/
const RESERVED = new Set(['web_read', 'web_search', 'web_navigate', 'web_back', 'web_forward', 'tool_list', 'tool_create', 'tool_test', 'tool_enable', 'tool_publish', 'project_list', 'project_search', 'project_read', 'project_write', 'project_command','helper_analyse','helper_read','helper_search'])
const validators = new Map<string, ValidateFunction>()
function validator(schema: Record<string, any>): ValidateFunction {
  const key = JSON.stringify(schema)
  let validate = validators.get(key)
  if (!validate) {
    validate = new Ajv({ strict: false, allErrors: false, validateFormats: false }).compile(schema)
    if (validators.size >= 128) validators.delete(validators.keys().next().value!)
    validators.set(key, validate)
  }
  return validate
}
export interface HadronToolDefinition { name: string; description: string; inputSchema: Record<string, any> }
export interface LibraryTool { definition: HadronToolDefinition; hash: string; creatorJob: string; enabled: boolean }
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
function plain(value: unknown): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
}
export function validateToolDefinition(value: unknown): HadronToolDefinition {
  plain(value)
  if (Object.keys(value).sort().join(',') !== 'description,inputSchema,name' || typeof value.name !== 'string' || !NAME.test(value.name) || RESERVED.has(value.name) ||
    typeof value.description !== 'string' || !value.description.trim() || value.description.length > 1000) throw new Error('Invalid tool definition')
  plain(value.inputSchema)
  if (value.inputSchema.type !== 'object' || JSON.stringify(value.inputSchema).length > 8000) throw new Error('Expected a bounded object input schema')
  // No external schemas, regex compilation or recursive definitions supplied by a model.
  const inspect = (node: unknown, depth = 0) => {
    if (depth > 12) throw new Error('Schema is too deeply nested')
    if (Array.isArray(node)) { node.forEach(child => inspect(child, depth + 1)); return }
    if (node && typeof node === 'object') for (const [key, child] of Object.entries(node)) {
      if (['$ref', '$dynamicRef', '$recursiveRef', '$async', '$id', 'pattern', 'patternProperties', 'format'].includes(key)) throw new Error('This schema feature is unavailable')
      inspect(child, depth + 1)
    }
  }
  inspect(value.inputSchema); validator(value.inputSchema)
  return { name: value.name, description: value.description, inputSchema: value.inputSchema }
}

/** Versioned Hadron-only source. Created versions are never enabled by a model. */
export class HadronToolLibrary {
  constructor(readonly root: string) {
    if (!path.isAbsolute(root)) throw new Error('Absolute library root required')
    fs.mkdirSync(root, { recursive: true })
    if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Tool library links are unavailable')
  }
  private directory(owner: string, name?: string, hash?: string) {
    if (!owner || owner.length > 128 || (name !== undefined && !NAME.test(name)) || (hash !== undefined && !HASH.test(hash))) throw new Error('Invalid tool identity')
    const target = path.join(this.root, 'library', digest(owner), ...(name ? [name] : []), ...(hash ? [hash] : []))
    // Reject existing symlink/junction components rather than following them out of this library.
    for (let current = target; ; current = path.dirname(current)) {
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Tool links are unavailable')
      if (current === this.root) break
      if (path.dirname(current) === current) throw new Error('Library containment failed')
    }
    return target
  }
  create(owner: string, job: string, raw: unknown, code: unknown): LibraryTool {
    const definition = validateToolDefinition(raw)
    if (typeof code !== 'string' || !code.trim() || code.length > 32000) throw new Error('Tool code must be 1-32000 characters')
    const hash = digest(JSON.stringify(definition) + '\n' + code), directory = this.directory(owner, definition.name, hash)
    if (!fs.existsSync(directory)) {
      if (this.list(owner).length >= 128) throw new Error('Tool library version limit reached')
      const parent = this.directory(owner, definition.name); fs.mkdirSync(parent, { recursive: true })
      const temporary = path.join(parent, '.draft-' + randomUUID()); fs.mkdirSync(temporary)
      try {
        fs.writeFileSync(path.join(temporary, 'index.js'), code, { flag: 'wx', flush: true })
        fs.writeFileSync(path.join(temporary, 'definition.json'), JSON.stringify({ definition, hash, creatorJob: digest(job) }, null, 2), { flag: 'wx', flush: true })
        fs.renameSync(temporary, directory)
      } finally {
        // Delete only this invocation's two known temporary files, never a recursive library path.
        if (fs.existsSync(temporary)) {
          for (const filename of ['index.js', 'definition.json']) { const file = path.join(temporary, filename); if (fs.existsSync(file)) fs.unlinkSync(file) }
          fs.rmdirSync(temporary)
        }
      }
    }
    return this.read(owner, definition.name, hash)
  }
  read(owner: string, name: string, hash: string): LibraryTool {
    const directory = this.directory(owner, name, hash)
    const manifest = path.join(directory, 'definition.json')
    if (fs.lstatSync(manifest).isSymbolicLink() || fs.statSync(manifest).size > 20000) throw new Error('Invalid tool manifest')
    const value = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    const definition = validateToolDefinition(value.definition), code = this.code(owner, name, hash)
    if (definition.name !== name || digest(JSON.stringify(definition) + '\n' + code) !== hash) throw new Error('Tool version changed; review it again')
    return { definition, hash, creatorJob: value.creatorJob, enabled: this.enabledHash(owner, name) === hash }
  }
  private code(owner: string, name: string, hash: string): string {
    const file = path.join(this.directory(owner, name, hash), 'index.js')
    if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 128000) throw new Error('Invalid tool source')
    return fs.readFileSync(file, 'utf8')
  }
  private enabledHash(owner: string, name: string): string | null {
    const file = path.join(this.directory(owner, name), 'enabled.json')
    if (!fs.existsSync(file)) return null
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Invalid tool state')
    const hash = JSON.parse(fs.readFileSync(file, 'utf8')).hash
    return typeof hash === 'string' && HASH.test(hash) ? hash : null
  }
  enable(owner: string, name: string, hash: string | null): void {
    if (hash) this.read(owner, name, hash)
    if (hash) {
      const definitions = this.list(owner).filter(tool => tool.enabled && tool.definition.name !== name).map(tool => tool.definition)
      definitions.push(this.read(owner, name, hash).definition)
      if (JSON.stringify(definitions).length > 16000) throw new Error('Enabled tool definitions exceed the context budget')
    }
    const dir = this.directory(owner, name); fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'enabled.json')
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Invalid tool state')
    const temporary = path.join(dir, '.enabled-' + randomUUID() + '.tmp')
    try { fs.writeFileSync(temporary, JSON.stringify({ hash }), { flag: 'wx', flush: true }); fs.renameSync(temporary, file) }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  }
  list(owner: string): LibraryTool[] {
    const root = this.directory(owner), tools: LibraryTool[] = []
    if (!fs.existsSync(root)) return tools
    for (const name of fs.readdirSync(root).filter(value => NAME.test(value))) {
      const dir = this.directory(owner, name)
      for (const hash of fs.readdirSync(dir).filter(value => HASH.test(value))) {
        if (tools.length >= 128) throw new Error('Tool library exceeds display limit')
        tools.push(this.read(owner, name, hash))
      }
    }
    return tools
  }
  source(owner: string, name: string, hash: string) { this.read(owner, name, hash); return this.code(owner, name, hash) }
  async execute(owner: string, name: string, hash: string, args: unknown, signal: AbortSignal,
    invoke: (tool: string, args: unknown) => Promise<unknown>): Promise<unknown> {
    signal.throwIfAborted()
    const tool = this.read(owner, name, hash), code = this.code(owner, name, hash)
    if (!validator(tool.definition.inputSchema)(args)) throw new Error('Tool inputs do not match the schema')
    if (JSON.stringify(args).length > 16000) throw new Error('Tool input exceeds limit')
    const module = await newQuickJSWASMModuleFromVariant(variant), runtime = module.newRuntime()
    runtime.setMemoryLimit(16 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024)
    let deadline = Date.now() + 200
    runtime.setInterruptHandler(() => signal.aborted || Date.now() > deadline)
    const vm = runtime.newContext()
    const evaluate = (source: string) => {
      signal.throwIfAborted(); deadline = Date.now() + 200
      const result = vm.evalCode(source, 'hadron-custom-tool.js')
      try {
        if (result.error) throw new Error('Custom JavaScript tool failed validation/execution')
        const text = vm.getString(result.value)
        if (text.length > 20000) throw new Error('Custom tool output exceeds limit')
        return JSON.parse(text)
      } finally { result.dispose() }
    }
    try {
      evaluate(`${code}\n;globalThis.__hadronIterator=run(${JSON.stringify(args)});JSON.stringify({ready:!!__hadronIterator&&typeof __hadronIterator.next==='function'})`)
      let result: unknown = undefined
      for (let step = 0; step < 12; step++) {
        const next = evaluate(`JSON.stringify(__hadronIterator.next(${result === undefined ? '' : JSON.stringify(result)}))`)
        if (next.done) return next.value ?? null
        plain(next.value)
        if (Object.keys(next.value).sort().join(',') !== 'arguments,tool' || !['web_read', 'web_search', 'web_navigate', 'web_back', 'web_forward'].includes(next.value.tool)) throw new Error('Custom tools can only request the granted web operations')
        result = await invoke(next.value.tool, next.value.arguments)
        if (JSON.stringify(result).length > 20000) throw new Error('Web evidence exceeds limit')
      }
      throw new Error('Custom tool operation limit reached')
    } finally { vm.dispose(); runtime.dispose() }
  }
}
