# Revision 102 - project restart controls and agent monitor

User reported floating agents could only be minimized and failed projects had no visible retry/new-task route. Added a true Close agent monitor control in compact/expanded states, separate Minimize, and a title-bar Agent monitor entry to reopen. Closing the viewer does not stop jobs.

Added prominent Try again / New project task controls at the top of both project setup and result panes. Retry retains task, plan, deliverables, models and selected files. New task clears task/deliverables and honours Keep selected source files. Both prepare an editable form without inference; Prepare proposal is still the explicit submission. Existing saved proposals remain available. Current unsettled workers/recovery requirements remain enforced by the host; historical views with a clean execution gate can be left without reconstructing old capabilities.

Fixed lifecycle polling to continue after a current-host failure until worker termination is confirmed. The latest real development profile failure was proposal_empty (no usable changes), observed read-only; no personal data, grants or execution markers were reset.

Focused renderer tests passed (18 initial tests plus an added failed-worker lifecycle regression). Actual desktop fixture and final installer checks follow below when completed. Fixture outputs use synthetic models, not paid accounts.

Actual built desktop acceptance passed: monitor close/reopen/minimize, failed empty-proposal explanation and retry preserving goal, new tasks, keep/clear files, Stop/join, saved history and clean Quit releasing the execution scope. Six fixture model requests; zero real provider requests. All 19 focused renderer tests passed; renderer/main builds passed. Earlier fixture attempts exposed outdated nested-directory assumptions and an asynchronous submission-button assertion; corrected the fixture to reproduce proposal_empty and wait for settled state.

Final installer acceptance PASSED: real 0.4.1 installation, same-version reinstall, genuine 0.4.1 -> 0.4.2 upgrade, both saved synthetic messages preserved, SQLite backup/recovery, unfinished helper not replayed, uninstall and restoration of original shortcuts. Current-host acceptance only; separate-PC test remains pending.
