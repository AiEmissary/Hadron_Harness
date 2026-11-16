import {mkdtempSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {configureHadronEnvironment} from '../server/runtimeIdentity.js'
import {executionStartup} from '../server/hadronTools/executionStartup.js'
export const profile=mkdtempSync(path.join(os.tmpdir(),'hadron-claude-agent-live-'))
configureHadronEnvironment(profile)
executionStartup.initialize(profile,'standard')
