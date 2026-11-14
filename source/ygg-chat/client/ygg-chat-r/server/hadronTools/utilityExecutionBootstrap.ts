// First utility entry import. The parent admitted its child before forking and
// supplies this private profile, so parent/child share one canonical ledger.
import {executionStartup} from './executionStartup.js'
import {assertLegacyExecutionAllowed} from './executionGate.js'

const profile=process.env.HADRON_EXECUTION_PROFILE
if(profile){
  executionStartup.initialize(profile,process.env.HADRON_EXECUTION_SESSION==='project'?'project':'standard')
  assertLegacyExecutionAllowed('utility_process')
}
