# Inline branching correction — 15 November 2026

Branch now opens an editor in place of the chosen message in the left conversation. A user question is prefilled for an alternative question; an agent answer opens a blank follow-up. Opening or cancelling sends no request and creates no tree nodes. Send branch creates one new question and response path on the right. Original questions and answers remain on their own saved branch.

An alternative question uses the original question's parent, attached context and pictures. It does not include the original question or its later answers as preceding conversation. A follow-up to an agent answer uses ancestry through that answer. Both use the current work type, provider/model selections and permissions. The bottom composer's unsent text and attachments are left intact and are not silently sent with the branch. Branch drafts remain scoped to their chat while switching views in the same workspace; they are temporary until sent, so send or cancel before closing the app.

The hover Branch control and right-click Branch from here action use the same editor, including tree nodes. Cancel restores the previous selected message. Duplicate submissions are fenced. Local validation failures retain the branch text. Shared and continuous requests still use the existing admission, execution and recovery paths. No saved-data format change or migration is required.

## Verification

- 70 focused renderer tests passed: branching, original/context/picture preservation, all work types, draft retention, save/reload, existing transports, navigation, completion notifications and message rendering.
- Hidden Chromium checks passed for single-agent, Work together and continuous work types: editor placement, prefilled question, cancellation, sibling creation, original preservation, double-send prevention, independent bottom draft/files, tree right-click answer follow-up, local failure retention and branch draft isolation while switching chats.
- Existing 173% tree zoom/navigation fixture passed, including later replies, sibling/ancestor selection and reading position.
- Production renderer build and TypeScript checks passed.

The fixtures use disposable synthetic chats, block network access and make no real provider requests. Saved user chats and provider sign-ins are not touched. Evidence is in test-results/inline-branching.json and inline-branching.png. How to use Hadron includes the branch workflow.

This is a local application update. The 6.0.5 installer is unchanged. Save any unsent message, close Hadron, and reopen through the existing desktop shortcut to load the update.
