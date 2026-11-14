# Hadron Settings review - revision 108

The Windows Settings entry now mounts HadronSettings, not the inherited Settings component. The legacy component is retained solely for the repository's non-Hadron web fallback; its fetch/migration/credential/default-setting hooks never mount in Hadron. No saved preferences, accounts, chats or theme files were deleted.

| Previous section | Decision for Hadron | Reason / replacement |
| --- | --- | --- |
| Chat Interface | Remove | Token/hover/pill/compaction preferences belong to inherited Main chat, not A/B runtimes. |
| Chat Mode Prompt | Remove | Not a Hadron workflow or agent instruction setting. |
| Agent Mode Prompt | Remove | Does not configure Hadron's implementer/reviewer instructions. |
| Tool Approval Defaults | Remove | Legacy allow-all default must not suggest bypassing Hadron's actual task permissions and native project approvals. |
| Chat Reasoning Defaults | Remove | Does not configure the subscription-job models selected per workflow. |
| Provider Settings | Replace with Connections | Use actual Codex/Claude subscription status and sign-in. Legacy default provider, ChatGPT token limit, compaction providers, LM Studio URL and other provider credentials do not configure Hadron agent jobs. |
| Memory | Remove | LM Studio note embeddings are not Hadron A/B memory. |
| Subagent | Replace with Automatic lightweight helpers | Native helpers.preference is read/written; same-provider bounded helper policy is described accurately. |
| Context files | Remove | Use the selected task's attachments, branch and explicit project-folder access. |
| Tools Configuration | Replace with actual Hadron tool library | Inherited bash/tool/stream timeout values are not Hadron job deadlines. Do not expose ineffective controls. |
| HTML Tools Cache | Remove | Legacy HTML iframe registry is separate from Hadron's sandboxed tool library. |
| API Keys | Keep only optional Brave Search settings | Hadron toolSession calls braveSearch. Use secure has/set/delete IPC; never expose a saved key in the form. Remove unrelated MCP/macOS migration language. |
| Built-in Browser | Remove | Legacy guest DevTools preferences do not configure Hadron web tools. |
| Remote Mobile Access | Remove | Hadron is loopback-only; no remote configuration is available. |
| Local Ownership Migration | Remove | Does not migrate Hadron sessions/recovery records and is unsupported. |
| Typography | Keep inside Appearance | Actual app font storage/FontFace apply flow, validated URL/file controls. |
| Custom Upload | Keep inside Appearance backgrounds | Actual IndexedDB video library; upload now selects video mode as well as active video. |
| Solid Color Background | Keep as Backdrop colours inside Appearance | Actual VideoBackground storage; reset now restores the backdrop colours, not only video selection. |
| Saved Wallpapers | Keep inside Appearance backgrounds | Select/remove saved video and per-video text setting; asynchronous deletion is awaited and failures surfaced. |
| Giant inherited Advanced Custom Theme editor | Do not expose | Numerous controls target legacy auth/tool/HTML/main-chat widgets. Hadron uses palette, text, font and background controls instead. Stored data remains intact. |
| Inherited logout/changelog | Remove from Hadron Settings | Provider-specific disconnect remains in Connections; setup reports the actual Hadron version/resources. |

New page groups: Appearance; Connections; Agents and tools; Saved data; Setup. Per-task provider/model, review and tool permissions remain alongside the relevant workflow. Recovery opens the real 30-day Recycle Bin. Setup calls hadronSetup without installing anything. No runtime approval or authorization policy was weakened.

Native fixture validation exercises the new page, palette/text/display settings, native helper preference, library read, search-key status/form (no secret writes), Recycle Bin, native software check, font URL validation, valid local font and invalid replacement, and actual backdrop reset. Paid provider calls, live Brave search and fresh OS installation remain separate checks.
