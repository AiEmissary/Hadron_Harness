import {expect,it} from 'vitest'
import {hadronTimeFailure} from '../collaboration/timeFailure.js'
it('explains the historical five-minute host timeout without exposing raw diagnostic text',()=>{
 const reason=hadronTimeFailure('The operation was aborted due to timeout','2026-11-15T21:32:46.426Z','2026-11-15T21:37:46.514Z')
 expect(reason).toContain('Hadron');expect(reason).toContain('5 minutes');expect(reason).toContain('not a provider usage-limit')
 expect(hadronTimeFailure('Unknown private diagnostic')).toBeUndefined()
 expect(hadronTimeFailure('Claude reported that its usage allowance has been reached.')).toBeUndefined()
 expect(hadronTimeFailure('Hadron stopped Claude at its tool-work time limit.')).toContain('time limit')
})
