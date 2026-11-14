import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {fileExecutionLedger,ProjectExecutionGate,projectExecutionGate} from './executionGate.js'
import {PrivateProfilePaths} from './privateProfilePaths.js'

export type ExecutionSessionMode='standard'|'project'

/** Host bootstrap only. The mode and profile are frozen before any legacy code
 * is loaded. Neither renderer settings nor model packets can change them. */
export class ExecutionStartup {
  private readonly workerEpoch=randomUUID()
  private session:{profile:string;mode:ExecutionSessionMode}|undefined
  private startupBlocked=false
  private privatePaths:PrivateProfilePaths|undefined
  constructor(private readonly gate:ProjectExecutionGate){}
  initialize(profile:string,mode:ExecutionSessionMode):void{
    if(!path.isAbsolute(profile)||!['standard','project'].includes(mode))throw Error('Invalid execution startup configuration')
    fs.mkdirSync(profile,{recursive:true,mode:0o700})
    const stat=fs.lstatSync(profile)
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Plain private execution profile required')
    const canonical=fs.realpathSync(profile)
    if(this.session){
      this.privatePaths!.relative('')
      if(this.session.profile!==canonical||this.session.mode!==mode)throw Error('Execution startup cannot switch profile or mode in a running host')
      return
    }
    this.privatePaths=new PrivateProfilePaths(canonical)
    try{
      this.gate.configure(fileExecutionLedger(path.join(canonical,'project-execution')),{projectOnly:mode==='project'})
    }catch{
      // Keep the saved-chat/checkpoint viewer usable without starting any legacy
      // work. This state cannot be reset by initialize or a renderer request.
      this.gate.blockHost();this.startupBlocked=true
    }
    this.session=Object.freeze({profile:canonical,mode})
  }
  isProjectSession():boolean{return this.session?.mode==='project'}
  isConfigured():boolean{return !!this.session}
  workerEpochId():string{if(!this.session)throw Error('Worker epoch is not configured');return this.workerEpoch}
  privatePath(relative:string):string{
    if(!this.privatePaths)throw Error('Private execution profile is not configured')
    return this.privatePaths.relative(relative)
  }
  assertPrivatePath(target:string):string{
    if(!this.privatePaths)throw Error('Private execution profile is not configured')
    return this.privatePaths.absolute(target)
  }
  holdsLegacyStartup():boolean{return this.isProjectSession()||this.startupBlocked}
  childEnvironment():NodeJS.ProcessEnv{
    const environment={...process.env}
    delete environment.HADRON_EXECUTION_PROFILE
    delete environment.HADRON_EXECUTION_SESSION
    if(this.session){
      environment.HADRON_EXECUTION_PROFILE=this.session.profile
      environment.HADRON_EXECUTION_SESSION=this.session.mode
    }
    return environment
  }
  /** No paths/IDs: suitable for diagnostics. Never a capability. */
  status(){return {mode:this.session?.mode??'unconfigured',startupBlocked:this.startupBlocked,execution:this.gate.status()}}
}

export const executionStartup=new ExecutionStartup(projectExecutionGate)
