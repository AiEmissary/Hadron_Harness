# Branch reading and transcript navigation — 15 November 2026

Selecting an earlier coloured tree node now scrolls the left transcript to that message and retains the later questions and answers on the displayed branch. The old renderer used only the selected message's ancestors, so everything below it disappeared.

The displayed path is now separate from the path supplied for a follow-up. Existing selected-point branching and conversation isolation are retained: displaying later replies does not inject future turns or sibling conversations into the submitted context. Selecting a sibling node opens that branch through its latest available descendant. Selecting a shared ancestor retains the branch already being read. No saved-chat format, data migration or permission change is needed.

The down arrow goes to the end of the displayed branch, rather than whichever sibling message was appended last. Selecting the same node again scrolls back to it. Reply updates do not move a reader who has scrolled away. Ctrl/Shift multiple-selection controls and tree zoom/pan retain their existing behavior.

How to use Hadron now explains this navigation. No buttons were added and the installer was not rebuilt. Save any unsent message, close Hadron and reopen through the existing desktop shortcut to load the local renderer update.

## Verification

- 32 focused renderer tests: branch projection, ancestry/context isolation, current workspace state, Send/Stop and existing chat rendering.
- Hidden Chromium fixture at 173% tree zoom: earlier node scrolling with all 20 later-path messages retained, sibling/common-ancestor navigation, current-branch latest arrow, repeated selection, unsent draft retention and stable reading position during reply updates. Zero provider requests.
- Existing tree geometry/zoom/group-selection regression at 100% and 150% Windows scale.
- Production renderer build and TypeScript checks.

The fixtures use disposable conversations and do not touch saved chats or provider sign-ins. Local evidence is in test-results/branch-transcript-navigation.json and branch-transcript-navigation.png.
