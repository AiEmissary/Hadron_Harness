/** Recognise only Hadron's historical host-generated partial records, not ordinary model wording. */
export function isHadronIncompleteRecord(text:string):boolean{
 return text.startsWith('Work stopped at the request or context limit before a final answer was produced.')||
  text.startsWith('### Partial research — limit reached')||text.startsWith('Not finished — Hadron stopped before a final answer was produced.')
}
