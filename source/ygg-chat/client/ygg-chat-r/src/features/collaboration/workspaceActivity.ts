import type {WorkspaceMessage} from './unifiedWorkspace'
import type {ProposalSessionStatus} from '../../../../../shared/collaboration'
const tools:Record<string,string>={project_list:'List project folder',project_search:'Search project',project_read:'Read project file',read_file:'Read file',read_files:'Read files',glob:'Find files',ripgrep:'Search files',edit_file:'Edit file',multi_edit:'Edit files',create_file:'Create file',delete_file:'Delete file',powershell:'Run PowerShell command',bash:'Run command',web_read:'Read web page',web_search:'Search web'}
const states:Record<string,string>={created:'Waiting',reserved:'Waiting',queued:'Waiting',pending:'Waiting',running:'Working',completed:'Completed',failed:'Not finished',error:'Not finished',cancelled:'Not finished · Stopped',aborted:'Not finished · Stopped',started:'Started',stopping:'Stopping',interrupted:'Not finished · Interrupted'}
/** Public status and operation receipts only; never provider thinking blocks. */
export function workspaceActivity(events:ReadonlyArray<{time:string;tool:string;state:string}>=[],agents:ReadonlyArray<{id:string;status:string}>=[]):NonNullable<WorkspaceMessage['activity']>{
 return [...agents.map(agent=>({label:`Agent ${agent.id.toUpperCase()}: ${states[agent.status]??'Waiting'}`,state:states[agent.status]??'Waiting'})),...events.slice(-80).filter(event=>/^[a-zA-Z0-9_.:-]{1,80}$/.test(event.tool)).map(event=>({time:event.time,label:tools[event.tool]??event.tool.replaceAll('_',' '),state:states[event.state]??'Reported'}))]
}
export function sharedWorkspaceActivity(status:ProposalSessionStatus){
 const workflow=status.collaboration,phase=workflow?.phase
 const labels:Record<string,string>={proposals:'Preparing independent answers',reviews:'Cross-reviewing answers',verification:'Checking evidence',synthesis:'Combining answers',finished:'Work together finished'}
 const stages=workflow?.stages.filter(stage=>phase==='reviews'?stage.id==='review_a'||stage.id==='review_b':phase==='synthesis'?stage.id==='final':phase==='verification'?stage.id==='verification':false)??[]
 return [...(phase?[{label:labels[phase],state:states[status.status]??'Waiting'}]:[]),...workspaceActivity([...(workflow?.folderActivity??[]),...(workflow?.toolActivity??[])],stages.length?stages.map(stage=>({id:stage.participantId,status:stage.status})):status.participants)]
}
