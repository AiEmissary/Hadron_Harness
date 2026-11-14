import type {HadronToolSession} from './types.js'
export interface HelperAssignment {jobId:string;role:string}
export const helperHost:{decorate?:(base:HadronToolSession|undefined,input:{owner:string;workspace:string;anchor:string;parentRun:string;provider:string;assignment:HelperAssignment;signal:AbortSignal})=>HadronToolSession|undefined;list?:(owner:string,workspace:string)=>unknown;preference?:(owner:string,enabled?:boolean)=>boolean}={}
