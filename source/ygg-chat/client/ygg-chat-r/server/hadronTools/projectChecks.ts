import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {projectPath} from './projectPaths.js'
export interface ProjectCheckResult {code:number|null;output:string}
export interface ProjectCheckRecord {id:string;state:string;paths:string[];kind:'test'|'build';code:number|null;output:string;createdAt:string}
/** Exact native-picked Node test files. No shell command interpolation, package
 * installation or inherited account environment. Tests are executable code. */
export function freezeProjectChecks(root:string,paths:string[],kind:'test'|'build'='test'){
 if(!Array.isArray(paths)||!paths.length||paths.length>20||new Set(paths).size!==paths.length)throw Error('Choose 1–20 distinct Node test files')
 return paths.map(relative=>{
  if(!['test','build'].includes(kind)||!(kind==='test'?/\.(?:test|spec)\.(?:js|mjs|cjs)$/:/\.(?:js|mjs|cjs)$/).test(relative)||kind==='build'&&paths.length!==1)throw Error('Choose Node test files, or one JavaScript build script')
  const file=projectPath(root,relative),stat=fs.lstatSync(file)
  if(!stat.isFile()||stat.nlink!==1||stat.size>131072)throw Error('Choose a plain test file up to128 KiB')
  return {path:relative,hash:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
 })
}
class ProjectCheckHost {
 private adapter:((root:string,files:Array<{path:string;hash:string}>,signal:AbortSignal,kind:'test'|'build',approval?:object)=>Promise<ProjectCheckResult|null>)|undefined
 install(adapter:NonNullable<ProjectCheckHost['adapter']>){if(this.adapter)throw Error('Check host already installed');this.adapter=adapter}
 available(){return !!this.adapter}
 run(root:string,files:Array<{path:string;hash:string}>,signal:AbortSignal,kind:'test'|'build'='test',approval?:object){if(!this.adapter)throw Error('Native test runner unavailable');return this.adapter(root,files,signal,kind,approval)}
}
export const projectCheckHost=new ProjectCheckHost()
