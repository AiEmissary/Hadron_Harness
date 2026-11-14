/** Native invocation markup is not a final answer or an authorized host operation. */
export function containsRawToolInvocation(text: string): boolean {
  return /<(?:invoke|function_calls|tool_calls|tool_call|tool_use)\b/i.test(text)
}
