# Hadron 0.4.15 — 9 November 2026

Passed this maintenance release: nine context-copy service tests, production renderer/main/mobile builds and typechecks, full native desktop jobs regression, real mouse/keyboard project naming, automatic name-field focus after keyboard destination selection, direct New project button, separate A/B copies into one destination with an existing chat preserved, no inference during copying, and packaged 0.4.15 startup with matching trace and unchanged sign-in registration.

The naming report was not reproduced after explicitly clicking the input; the UI now focuses after the native select closes and also provides a separate New project button. Validation exercises both routes using native character events rather than assigning the input value.

The actual current-user installer upgraded this PC from 0.4.14 to 0.4.15. The installed application archive matches the release. History preservation and launch shortcuts are checked separately in the local revision115 record. A stale pinned taskbar shortcut was the source of development-version launches; Desktop, pinned and current-user Start menu links now target the installed program. Latest development history was transferred only after every existing logical destination row was verified unchanged in the newer source, with backups and no credentials copied.

These are existing-PC checks. Fresh-Windows acceptance, publisher permissions and signing remain open. The installer is unsigned. No new live paid-provider tests were needed for this copy/shortcut change; earlier provider results remain historical evidence. Folder search in Independent jobs and Work together is still pending; it exists only in Build a project. Mac work remains deferred.

Actual upgrade receipt: installed-upgrade-result.json. Synthetic desktop and packaged startup: desktop-result.json and packaged-startup-result.json. The desktop fixture now tests native destination keyboard selection, automatic name focus, typing Draft without a mouse click, the direct New project button, native clicking and Ctrl+A replacement with Copied workspace fixture, copying A/B together, and retaining the pre-existing destination chat. This is covered by assertions in hadronDesktopSmoke.ts, although the legacy result object does not expose separate flags for each added assertion.

Private backups remain under LocalAppData/Hadron-Harness; no user databases or full chat text are included in this evidence folder. The app was closed normally for the upgrade, never force-killed.
