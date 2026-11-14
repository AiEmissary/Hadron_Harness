# Revision 109 evidence

Windows preview 0.4.9 fixes mouse-wheel scrolling in Hadron Settings. The previous page was taller than its hidden-overflow app shell without owning a scroll area; section links could move the hidden shell while the wheel could not recover it. Settings now owns a bounded, keyboard-focusable scrolling region with a visible scrollbar. The header, section buttons, Back to workspace and new Back to top stay outside the scrolling content. Section jumps scroll only that content. A palette-aware solid Settings backdrop keeps labels readable.

The startup logo now has the exact text "Where AI's Collide" directly below it. The four-second minimum display remains. How to use Hadron and the separate-PC checklist explain the updated behaviour.

Passed: production renderer/main/mobile typechecks and builds; actual Chromium mouse-wheel down/up, visible scrollbar, persistent navigation, Setup/Appearance jumps, keyboard End and Back to top in a resized 1100x700 window with font/background options expanded; entry-logo/tagline positioning and a 4037 ms startup transition; final packaged 0.4.9 startup/native bridge/Settings scroll checks. Zero real provider requests. The clean-PC test on the user's other computer, full installed upgrade and real-account checks were not repeated here. Existing preview/licensing qualifications remain.

The final installer was copied to C:\Users\rajka\Desktop\Hadron-Harness-0.4.9-win-x64.exe, distribution and the clean-PC kit, with matching SHA-256 checks. A small Hadron-Test-Checklist folder is on the Desktop alongside it. The source archive is refreshed from revision 89717ca0d00ebe24bbc5d9abe418a65fe879081b. The user's running development app was not closed, nor were any personal profile rows or original application files modified.

Hadron-Harness-0.4.9-win-x64.exe: 370850358 bytes; SHA-256 20b247a4de25a9b9748cf4cf9588ce77a1db3e46611913d84598d178d192fe7d
Hadron-Harness-0.4.9-source.zip: 8063005 bytes; SHA-256 521c44bf82cb04347e17011739f785384302b4497581a04a6cec443a928e4771
