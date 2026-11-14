# 0.4.14 update — 9 November 2026

The actual Desktop installer failure was matched to the upstream NSIS folder-detection issue and addressed with the hash-checked PR 9564 backport. Fifty fresh-path probes, full Desktop installer acceptance and actual current-user installation now pass. The root research is in validation/revision114. Provider public-distribution and signing decisions remain external; no terms were accepted. Mac remains deferred. Older checkpoints below are historical.

---

# Release 0.4.13 review — 8 November 2026

Official Claude Code legal/compliance documentation was checked again at https://code.claude.com/docs/en/legal-and-compliance . Its published conditions still require attention before Hadron is publicly distributed. The technical build preserves the unmodified official binary and native sign-in, but that alone does not establish all contractual permissions. No agreement has been accepted or public upload performed. This is the publisher’s remaining external review, not an application test result.

No code-signing certificate with a private key is available in the current Windows account. Decision for this delivery: an explicitly unsigned private testing installer and matching source, not an invented publisher signature.

History pagination, answer edit/regenerate drafts, whole-agent-conversation bin controls and portable reference-history archives are now implemented. Arbitrary single-subtree removal, configurable helper policies and broader language execution are separate future refinements; the UI states the deletion scope. Existing same-provider bounded helper policy is unchanged.

The additional real mixed-provider memory acceptance completed 18 requests: 16 replies and two summaries, retaining the marker and rollback constraint. This is bounded evidence, not an unlimited service guarantee. A separate fresh-Windows machine is not accessible in this session, so its remaining checklist cannot be certified here.

---

# Distribution and helper research - 8 November 2026

Anthropic's official Claude Code legal/compliance page says product preinstallation or hosting requires its Commercial Terms and conditions including an unmodified binary, preserving built-in authentication methods, and each end user authenticating and paying under their own account. It distinguishes an end user signing into the official binary from a third-party application collecting subscription credentials or routing them on the user's behalf. Hadron's existing use of the official binary is relevant, but does not itself certify compliance with every condition. Product authentication flow and distribution terms still need review before public redistribution. No agreement was accepted and nothing was publicly published.

Source checked: [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), sections Can customers offer Claude Code in their products? and Authentication and credential use. This is a technical reading, not legal certification.

Helper policy inspection: helpers.ts already chooses an admitted same-provider lightweight tier (OpenAI nano, mini, then Luna; Claude Haiku), refuses unknown premium fallback, limits each agent/job to two children and prevents nesting/writes. Tier-name matching is not verified price ranking; subscription allowances and model availability vary. Keep this conservative default. A later optional policy should expose a capped helper count, explicit lightweight model choice and saved usage evidence rather than claiming an automatically cheapest model or automatic cost savings. Automatic conversation memory uses the next speaker's chosen model and counts against its request budget; it is a distinct operation, not a hidden helper.

Branch/history inspection: the agent context service still uses a bounded workspace query (257 independent jobs and 129 completed proposals) instead of a cursor-based history API. Existing follow-up branches and selected ancestry work. Remaining work is cursor-based loading with stable selected nodes and explicit edit/regenerate/delete operations that preserve descendants and never replay old paid jobs. Simply raising the query limits would increase memory and rendering work without solving navigation or context selection. Treat these as a distinct product increment after current reliability fixes.
