import {isHadronProvider} from '../../../../../shared/hadronProviders'
import type {WorkspaceChat} from './unifiedWorkspace'

export interface WorkspaceModelPreferences {load():WorkspaceChat['models'];save(models:WorkspaceChat['models']):void}
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>

/** Account-scoped provider/model names only. Never stores credentials, prompts or folder permissions. */
export function workspaceModelPreferences(owner:string,storage?:Storage):WorkspaceModelPreferences{
 const key='hadron:agent-models:'+encodeURIComponent(owner)
 const clean=(value:unknown):WorkspaceChat['models']=>{
  const models:WorkspaceChat['models']={}
  if(!value||typeof value!=='object'||Array.isArray(value))return models
  for(const agent of ['a','b'] as const){
   const model=(value as Record<string,unknown>)[agent] as Record<string,unknown>|undefined
   if(model&&typeof model==='object'&&isHadronProvider(model.provider)&&typeof model.modelName==='string'&&model.modelName.length<=256)
    models[agent]={provider:model.provider,modelName:model.modelName}
  }
  return models
 }
 return {
  load(){try{return clean(JSON.parse((storage??localStorage).getItem(key)??'null'))}catch{return {}}},
  save(models){try{(storage??localStorage).setItem(key,JSON.stringify(clean(models)))}catch{/* Storage failure must not interrupt chatting. */}},
 }
}
