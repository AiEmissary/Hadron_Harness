/** Stable explanations for host deadlines, including historical unmapped DOMException text. */
export function hadronTimeFailure(error:string,createdAt?:string|null,updatedAt?:string|null):string|undefined{
 if(!/^The operation was aborted due to timeout$|^Hadron stopped Claude at its tool-work time limit\.|^Not finished — the task time limit was reached/.test(error))return
 const elapsed=Date.parse(updatedAt??'')-Date.parse(createdAt??'')
 const duration=Number.isFinite(elapsed)&&elapsed>=1000&&elapsed<=3600000
  ?elapsed>=60000?` after about ${Math.round(elapsed/60000)} minute${Math.round(elapsed/60000)===1?'':'s'}`:` after about ${Math.round(elapsed/1000)} seconds`:''
 return `Hadron's tool-work time limit stopped this agent${duration}. This is not a provider usage-limit or sign-in error.`
}
