import type {HadronProvider} from '../../../../../shared/hadronProviders'
import {isHadronProvider} from '../../../../../shared/hadronProviders'
import type {ProjectDraftGrant,ProjectDraftInput} from '../../../../../shared/projectBuild'
import {sendWorkflowDraft, type ProjectWork} from './workflowDraft'

export type Actor='a'|'b'|'both'
export type FolderSlot='a'|'b'|'shared'|'continuous'
export type Choices=Partial<Record<'a'|'b',{provider:string;modelName:string}>>
export function projectChoices(input:Pick<ProjectDraftInput,'participation'|'models'|'providers'>):Choices{
  if(input.participation&&input.participation!=='both')return {[input.participation]:{provider:input.providers?.a??'openaichatgpt',modelName:input.models.a}}
  return {a:{provider:input.providers?.a??'openaichatgpt',modelName:input.models.a},b:{provider:input.providers?.b??'openaichatgpt',modelName:input.models.b}}
}
const folders=new Map<string,{id:string;label:string;reading:boolean}>()
export function rememberConversationFolder(workspace:string,slot:FolderSlot,folder:{id:string;label:string}|null,reading=true){
  const key=workspace+':'+slot
  if(folder)folders.set(key,{...folder,reading});else folders.delete(key)
}
export function conversationFolder(workspace:string,slot:FolderSlot){return folders.get(workspace+':'+slot)}
export function workContext(text:string){return text.length>12000?'[Earlier conversation omitted to fit context; the following is the most recent selected text.]\n'+text.slice(-12000):text}
export function workChoices(actor:Actor,choices:Choices){
  const required=actor==='both'?['a','b'] as const:[actor] as const
  for(const slot of required){const choice=choices[slot];if(!choice||!isHadronProvider(choice.provider)||!choice.modelName)throw Error('Choose a provider and model for Agent '+slot.toUpperCase()+' in setup.')}
  const a=choices[actor==='both'?'a':actor]!,b=choices[actor==='both'?'b':actor]!
  return {models:{a:a.modelName,b:b.modelName},providers:{a:a.provider as HadronProvider,b:b.provider as HadronProvider}}
}
/** User's Go starts one existing project workflow, never reconstructs write consent. */
export async function startConversationWork(input:{workspace:string;slot:FolderSlot;text:string;context:string;actor:Actor;choices:Choices;permission:'ask'|'task';grant?:ProjectDraftGrant}){
  const chosen=workChoices(input.actor,input.choices),api=window.electronAPI.projectDraft
  if(!(await api.availability()).ready){
    for(const row of await api.list(input.workspace)){
      const saved=await api.check(input.workspace,row.id)
      if(saved&&!saved.execution.ready&&saved.workersEnded&&!saved.interventionRequired)await api.close(saved.id)
    }
    if(!(await api.availability()).ready)throw Error('Another operation is still running or needs recovery. Let it finish, or Pause/Stop it before starting file work. This conversation stays saved.')
  }
  const selected=conversationFolder(input.workspace,input.slot)
  const grant=input.grant??(selected?await api.fromFolder(input.workspace,input.slot,selected.id):await api.choose(input.workspace))
  if(!grant) return false
  const projectWork:ProjectWork={grant,context:workContext(input.context),participation:input.actor,permission:input.permission,...chosen}
  sendWorkflowDraft(input.workspace,'project',input.text,undefined,{projectWork})
  return true
}
