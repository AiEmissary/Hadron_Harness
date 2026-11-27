export type ContinuousProviders={a:'openaichatgpt'|'claudecode';b:'openaichatgpt'|'claudecode'}
/** Admission/storage bound, separate from the smaller per-provider working prompt. */
export const CONTINUOUS_INPUT_MAX_BYTES=256_000
export interface ContinuousChatInput {images?:import('./hadronImages.js').HadronImage[];
 /** Sent on start only; stored beside the session and never returned in its view. */
 documents?:import('./hadronDocuments.js').HadronDocument[];projectGrantId?:string;id:string;workspaceId:string;anchorMessageId:string;goal:string;models:{a:string;b:string};providers?:ContinuousProviders;maxTurns:number;maxSeconds:number;continuationOf?:string;continuationInstruction?:string}
export interface ContinuousContinuationInput {images?:import('./hadronImages.js').HadronImage[];
 /** Omitted: the saved conversation's documents are kept. */
 documents?:import('./hadronDocuments.js').HadronDocument[];projectGrantId?:string;id:string;models:{a:string;b:string};providers?:ContinuousProviders;maxTurns:number;maxSeconds:number;instruction?:string}
export interface ContinuousMemory {throughTurn:number;text:string}
export interface ContinuousChatHistory {memory?:ContinuousMemory;sourceId:string;turns:Array<{role:'a'|'b';text:string;provider?:'openaichatgpt'|'claudecode';model?:string}>;messages:Array<{afterTurn:number;text:string}>}
export interface ContinuousChatView {
 folderActivity?:Array<{time:string;tool:string;state:string}>;
 memory?:ContinuousMemory;
 id:string;input:ContinuousChatInput;state:string;reason:string|null;revision:number;workersEnded:boolean;canResume:boolean;currentHost?:boolean;history?:ContinuousChatHistory;
 turns:Array<{kind?:'reply'|'memory';ordinal:number;role:'a'|'b';state:string;text:string|null;runId:string|null;errorCode?:string|null}>;
 messages:Array<{id:string;afterTurn:number;text:string}>;
}
export interface ContinuousChatApi {
 claudeModels():Promise<Array<{id:string;label:string}>>;
 start(input:ContinuousChatInput):Promise<ContinuousChatView>;
 continueSaved(id:string,input:ContinuousContinuationInput):Promise<ContinuousChatView>;
 status(id:string):Promise<ContinuousChatView>;
 check(workspace:string,id:string):Promise<ContinuousChatView|null>;
 list(workspace:string):Promise<Array<{id:string;goal:string;state:string}>>;
 pause(id:string):Promise<ContinuousChatView>;
 stop(id:string):Promise<ContinuousChatView>;
 resume(id:string,revision:number,extraTurns:number):Promise<ContinuousChatView>;
 inject(id:string,messageId:string,text:string):Promise<ContinuousChatView>;
}
