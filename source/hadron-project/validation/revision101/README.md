# Release validation - revision 101, 8 November 2026

Passed on the existing Windows development PC:
- Real subscriptions: GPT-6.1 Sol -> GPT-6 Luna helper -> parent, and Claude Sonnet -> Haiku helper -> parent. Six successful physical requests; official runtimes and durable helper journals. An earlier loose-prompt check used one request without optional delegation, so was not counted as a helper pass. No credentials exported.
- Real NSIS installation, installed startup, correct shortcut, same-version reinstall, 0.4.0 to 0.4.1 upgrade, uninstall and restoration of original shortcuts.
- Two seeded synthetic messages preserved through upgrade. Native SQLite backup restored after deliberately simulated corruption; unfinished helper marked interrupted without replay. Whole disposable profile backup restored nine job trees/selection without inference.
- 24 focused execution-startup/private-profile/journal tests passed. Earlier full regression counts remain 559 server, 894 headless, 1182 renderer, six focused helper tests.
- 593-package production dependency licence inventory, zero missing accompanying notices. JSZip uses its MIT alternative. dingbat-to-unicode and lazy-val lack original standalone licence texts: publisher declarations and clearly labelled standard terms are supplied, not invented original notices. Unused GSAP removed.

Qualification and pending external work:
- Separate Windows PC selected by user; clean-PC test pack prepared. No access to that PC is configured and no result is claimed. Existing-host tests cannot prove fresh Windows compatibility without developer tools.
- Two 0.4.0 installer invocations returned 0xC0000005 before installing, including the final repeated baseline check. Later runs passed; cause remains unconfirmed and clean-PC reliability testing is required. Other failed attempts were test-fixture startup/invalid lineage seed issues, corrected before the passing run.
- Root project is AGPLv3 with original provenance retained. Source archive includes committed build sources, locks, worker source, vendor install recipes, notices and build instructions. This is a technical source-package review, not legal certification.
- Official Claude Code product/preinstallation conditions need confirmation before public redistribution. No contracts accepted or public upload performed. Primary source: https://code.claude.com/docs/en/legal-and-compliance .
- Installer unsigned; publisher signing requires a certificate. Mac and previously deferred expansion remain later work.

Original Graviton, personal chats and credentials were not modified. Test installation/profile directories were disposable. Installed and development Hadron profiles remain separate.

Final repeat: old 0.4.0 baseline again crashed before installation. The final 0.4.1 installed and launched; its recovery diagnostic then hung waiting for requestAnimationFrame in a covered window. Diagnostic now uses a bounded timer, avoiding suspended animation-frame waits. No data-loss conclusion is inferred from that diagnostic timeout. Final revalidation follows.

Final exact 0.4.1 installer verification PASSED after the diagnostic correction: current-user install, shortcut target, installed startup, SQLite backup/restore after simulated corruption, interrupted helper with no replay, same-version reinstall, both saved messages preserved, uninstall and original shortcut restoration. Final packaged startup and all required resource probes passed with zero model requests. Separate-PC acceptance is pending and the user will run the provided test pack there. Matching source revision 7a903e587a29015ab2a5a616cdb4312786001afb; artifacts.json records exact installer/source hashes. Earlier successful 0.4.0 -> 0.4.1 upgrade remains valid evidence, alongside the recorded intermittent old-installer baseline failures.
