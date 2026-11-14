# Hadron tools

Choose **Independent jobs → Agent A/B → Tools → Create and test tools**. Ask the agent to build a tool, describe its inputs and test it with examples. It saves versioned source inside Hadron's own tool library. Open **Tool library → Refresh tools → Review source** and enable the reviewed version to reuse it in new Web research or tool-building jobs.

Developers can also use **Tool library → Add a tool** to enter a definition and JavaScript source directly. Save the disabled version, enter JSON test inputs in its source review, and use **Test this version**. The returned value is displayed without enabling the draft. **Cancel test** stops a pending manual test. Update a tool by saving the same name with changed source; the previous approved version remains active until the user enables its replacement.

Each tool has a name, description, JSON object input schema and JavaScript source:

```json
{"name":"page_links","description":"Read the title and links from a public page","inputSchema":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"],"additionalProperties":false}}
```

```javascript
function* run(args) {
  const page = yield {tool: "web_read", arguments: {url: args.url}};
  return {title: page.title, url: page.url, links: page.links};
}
```

Use a synchronous generator named `run`. Return JSON data. Yield a request for `web_read`, `web_search`, `web_navigate`, `web_back` or `web_forward` to receive evidence from Hadron. No host object, filesystem, shell, `require`, `process`, DOM, cookie jar or unrestricted network API is exposed inside QuickJS. Plain computation and JSON/text processing need no yield.

This is a Hadron generator-tool format, not the legacy Graviton Node module format. Existing arbitrary Node tools are not automatically imported or executed. The first capability set is public read-only web research. Interactive forms, logged-in browsing, downloads, arbitrary project writes and shell/package installation are not enabled. Search requires a Brave Search API key configured separately in Hadron; opening a supplied public URL does not.

New versions stay disabled even when an older version is enabled. Testing a draft is limited to its creating job. Agents cannot publish tools. Enablement applies to an exact content hash, and changing source invalidates it. Disabled versions cannot be invoked by other jobs. Navigation and operation budgets are private to each job; tool definitions enabled by the user are reusable by either agent under that owner.

Limits: 8 model requests per tool-enabled answer, 32 host operations per job, 12 generator steps per invocation, 16 MiB JavaScript memory, 200 ms CPU per step, bounded inputs/results and a 5-minute job deadline. Stop cancels active generation and web requests; restarting does not replay them. Source and activity records persist. The normal Markdown job log retains the task/result; `job-logs` in this library records tool operation status without full arguments or page bodies.

Development stores this library in `Hadron-Harness/custom-tools`. Packaged installations use their own Hadron profile so upgrades and installation-folder permissions do not overwrite tool source. This guide is bundled with Hadron. No library path, profile, cookie store or tool state is shared with Graviton.

Shared collaborations optionally run Review + verification: only the verifier may use public-web and user-enabled tools between cross-review and synthesis. Tool authoring stays in independent jobs. Proposals, critiques and the final synthesizer remain text-only. Native Claude execution remains a separate integration task; these controls currently use the working ChatGPT/Codex path.
