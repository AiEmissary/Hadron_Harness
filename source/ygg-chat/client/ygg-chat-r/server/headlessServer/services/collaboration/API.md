# Internal proposal API contract, version 1

`routes/collaborationRoutes.ts` is implemented and tested, but **not registered**
by the production server. It requires an explicit enabled flag and a trusted
`authenticatedOwner(request)` supplied by the host. The test principal header is
a fixture only; it must not become production authentication. Workspace access
must be rechecked by `ProposalSessionService` on start, status reads and Stop.

| Method/path | Result |
| --- | --- |
| `POST /api/collaboration/proposals` | Strict `ProposalSessionInput`; synchronous admission then 202 status, without waiting for inference. |
| `GET /api/collaboration/proposals/:sessionId` | Version-1 status snapshot, or 404. |
| `POST /api/collaboration/proposals/:sessionId/stop` | Owner-authorized Stop; 202 snapshot, which may still be stopping while cleanup drains. |
| `GET /api/collaboration/proposals/:sessionId/streams/:streamId?fromSeq=N` | Scoped, cursor-checked SSE replay from the existing registry; disconnect detaches, explicit Stop cancels. |

Replay requires current owner/workspace authorization, participant stream membership
and matching registry conversation. Cursor must be a nonnegative safe integer no
later than the latest frame and no earlier than retained history (including zero).
Missing registry history returns 410; unavailable cursor range 409; malformed
cursor 400. Re-check access before every data frame and on one-second idle ticks;
revocation closes the viewer with `access_revoked` without cancelling inference.
The stream registry is still in-memory; process loss requires durable status and
canonical transcript recovery, never an automatic paid rerun.

Generic stream read/abort and duplicate chat-POST replay now reject collaboration
IDs. Trusted child preparation marks the scope before the first event. Registry
scope tombstones survive replay eviction; production registry additionally consults
indexed durable participant bindings so saved IDs remain fenced after restart.
Scope replacement/recycling through generic registry calls rejects before cancellation.
Ordinary chat scope remains the default. Transcript CRUD and subagent-manager
entry points still require an ownership/resume audit before live registration;
this stream fence is not the full production authorization perimeter.

Disabled routes return 404; unauthenticated requests 401; wrong owner/revoked
workspace access 403; malformed input 400; rejected/conflicting admission 409.

`desktopAccess.ts` supplies a candidate process-local capability validator bound
to owner ID and authentication session ID, accepting loopback/header transport
only. Repeated grant reads are stable for concurrent requests; revoke/auth-session
replacement invalidates old grants. Main-frame IPC issuance and a real desktop
principal provider are still unwired. Never derive the principal/session from
body fields, query parameters or a caller-selected owner header.
Unhandled read/Stop errors return a generic 500 without private diagnostics.
The request connection does not own admitted work. Observe completion rejection
in the route; failures are reflected in durable state and never automatically rerun.

The public `ProposalSessionStatus` type in `shared/collaboration.ts` contains the
phase/status, session revision, effective server limits, participant model/run/stream
references and canonical checkpoint references labelled `verified:false`. It omits
private child handles, task/context packets, owner credentials and provider errors.
The session revision tracks session transitions, not every provider stream event.
Live participant text uses existing stream references after separately authorized
stream access. Polling snapshots are not an append-only event log.

Only two tool-free ChatGPT proposals are implemented here. Status `completed`
means the proposal barrier/checkpoint operation completed; it does not mean a full
cross-review/verification/synthesis workflow completed. The phase explicitly says
`independent_proposals`. Other workflows, typed evidence/events, retries/recovery
actions, host authentication and route registration remain separate gates.

Tests: `routes/__tests__/collaborationRoutes.test.ts` uses real service/repositories
and Node SQLite with fake providers over local HTTP. Covers successful admission,
stream projection, duplicate replay, disabled/auth/validation gates, cross-owner
access, revoked access, Stop and asynchronous provider failure. No live providers.

Revision21: legacy runStateRoutes now rejects protected run/stream read/write IDs and filters transcript/ledger lists using durable collaboration ownership. Generic manager controls remain fenced by service lookup. Parent deletion, retention and surviving provenance still need lifecycle tests before enabling real sessions.

Revision22/migration8: source deletion is blocked atomically until Stop drains and session becomes terminal. Terminal session deletion purges owned canonical transcript/run and durable stream ledger records before ownership cascades away. Automatic Stop-and-delete UI remains pending.

Revision23: backend proposal routes now registered under false live gate; desktopHost shares trusted main-frame grant authentication. Exact local owner/project checks, EMPTY production model allowlist, trusted provider userId forwarding. Native probes all four endpoints404. Real local identity/login/model validation remains pending.

Revision27: user wants design input before UI is finalized; current layout provisional. Saved-session GET discovery now owner/conversation scoped and paged by descending ID (not time), no private packet/handles/run/stream refs. Default20/max50, nextBefore cursor. Production remains disabled. Session picker/controller not yet connected.

Revision28: GET /:sessionId/participants/:participantId/transcript returns owner/workspace-authorized settled visible output only (max1Mchars, verified=false). Browser only falls back after scoped live replay410, never on auth failure and never resumes. Session browser reauthorizes each explicit selection and fences old conversation responses. Selector remains hidden by false live gate.


Revision71: `workflow: review_verify_and_synthesis` explicitly admits one tool-enabled verification stage after both critiques. The previous `review_and_synthesis` path stays five requests. Verification is bounded to eight model requests, giving thirteen total; whole session ten minutes. Only the trusted server factory grants web mode. Status exposes verification stage text, host evidence receipts (bounded excerpts with omission count) and tool activity; every model stage retains verified:false. Additive migration11 preserves old session/stage tables. Stop and restart fencing apply to verification; no replay.
