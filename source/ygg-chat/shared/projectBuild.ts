/** Native desktop project workflow; mutations require host approval. */
export interface ProjectDraftInput {
  participation?:'a'|'b'|'both';
  id:string;workspaceId:string;anchorMessageId:string;task:string;plan:string;deliverables:string[];helpers?:boolean;exploreFolder?:boolean;models:{a:string;b:string};providers?:{a:import('./hadronProviders.js').HadronProvider;b:import('./hadronProviders.js').HadronProvider}
}
export interface ProjectDraftGrant {id:string;label:string;sourcePaths:string[]}
export interface ProjectDraftInspection {
  readOnly:true;canResume:false;checkedAt:string;rootVerified:boolean;workersConfirmedEnded:boolean;
  workerEvidence?:'current-session'|'windows-epoch'|'unconfirmed';
  needsRecovery:boolean;message:string;
  files:Array<{path:string;operation:string;current:'original'|'proposed'|'different'|'unavailable';metadata:'not-required'|'verified'|'unavailable'}>
}
export interface ProjectDraftView {
  discoveredPaths?:string[];folderActivity?:Array<{tool:string;path:string;query:string|null;state:string}>;
  acceptance?:{checked:string[];testsWaived:boolean;acceptedAt:string};
  id:string;state:string;input:ProjectDraftInput&{sourcePaths:string[]};failure:string|null;
  attempts:Array<{stage:string;role:string;model:string;runId:string|null;state:string;response:string|null}>;
  drafts:Array<{id:string;path:string;batch:number;beforeHash:string|null;afterHash:string;before:string|null;after:string;state:string}>;
  tests:{status:'not_run'|'passed'|'failed'|'stopped'|'interrupted'|'declined'|'started'|'stale'};projectFilesChanged:boolean|'uncertain';canApply:boolean;
  workersEnded:boolean;interventionRequired:boolean;journalAvailable:boolean;
  execution:{ready:boolean;reason:string}
  canCheck?:boolean;
  builds?:{status:string};
  automation?:{id:string;state:string;repairs:number};
  checks?:Array<{id:string;state:string;paths:string[];kind:'test'|'build';code:number|null;output:string;createdAt:string}>;
}
export interface ProjectDraftApi {
  fromFolder(workspace:string,slot:'a'|'b'|'shared'|'continuous',grantId:string):Promise<ProjectDraftGrant>;
  asRead(workspace:string,grantId:string,target:'a'|'b'|'shared'):Promise<{id:string;label:string}>;
  milestones(workspace:string):Promise<Array<{id:string;task:string;state:string;accepted:number;total:number;tests:string;parent:string|null}>>;
  accept(id:string,checked:string[],testsWaived:boolean):Promise<ProjectDraftView>;
  nextMilestone(id:string):Promise<ProjectDraftGrant>;
  availability():Promise<{available:boolean;ready:boolean;reason:string}>;
  choose(workspace:string):Promise<ProjectDraftGrant|null>;
  /** Add native-picked files, keeping previous selections; cancel leaves them unchanged. */
  sources(grantId:string):Promise<ProjectDraftGrant|null>;
  clearSources(grantId:string):Promise<ProjectDraftGrant>;
  start(grantId:string,input:ProjectDraftInput):Promise<ProjectDraftView>;
  status(id:string):Promise<ProjectDraftView>;
  check(workspace:string,id:string):Promise<ProjectDraftView|null>;
  list(workspace:string):Promise<Array<{id:string;task:string;state:string}>>;
  stop(id:string):Promise<ProjectDraftView>;
  close(id:string):Promise<ProjectDraftView>;
  journal(id:string,role:'a'|'b'):Promise<{filename:string;markdown:string}>;
  /** Explicit fresh read-only inspection; never resumes, edits or unlocks. */
  inspect(id:string):Promise<ProjectDraftInspection>;
  apply(id:string):Promise<ProjectDraftView>;
  runChecks(id:string):Promise<ProjectDraftView>;
  runBuild(id:string):Promise<ProjectDraftView>;
  repair(id:string):Promise<ProjectDraftView>;
  automate(id:string):Promise<ProjectDraftView>;
}
