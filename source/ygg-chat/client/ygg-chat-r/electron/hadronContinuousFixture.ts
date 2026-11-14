/** Inspect the actual readable prompt in synthetic desktop tests only. */
export function continuousFixturePacket(prompt:string):any{
 if(!prompt.startsWith('Hadron continuous_'))return JSON.parse(prompt)
 const kind=/^Hadron (\w+) v2/.exec(prompt)?.[1]
 const next=/Next speaker: Agent ([AB]) \(turn (\d+)\)/.exec(prompt)
 const proposeMarker=/proposeMarker: (\[HADRON_CONSENSUS_PROPOSE:[^\]]+\])/.exec(prompt)?.[1]
 const confirmMarker=/confirmMarker: (\[HADRON_CONSENSUS_CONFIRM:[^\]]+\])/.exec(prompt)?.[1]
 return {kind,goal:/You: \(shared goal(?: — CURRENT active task)?\)\n> ([^\n]+)/.exec(prompt)?.[1],speaker:next?.[1].toLowerCase(),turn:Number(next?.[2]),
  transcript:[...prompt.matchAll(/Agent ([AB]): \(turn (\d+)\)\n> ([^\n]*)/g)].map(match=>({speaker:match[1].toLowerCase(),turn:Number(match[2]),text:match[3]})),
  userMessages:[...prompt.matchAll(/You: \(after turn (\d+)\)\n> ([^\n]*)/g)].map(match=>({afterTurn:Number(match[1]),text:match[2]})),
  consensus:{proposeMarker,peerProposal:confirmMarker?{confirmMarker}:null}}
}
