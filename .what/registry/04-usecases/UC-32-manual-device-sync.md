---
type: uc
id: UC-32
component: registry
satisfies: [FR-40]
critical: true
created: '2026-09-22'
---

# UC-32 — I sync this WorshipDeck with another instance

**Experimental — see `docs/threat-model.md` §3.7.** Verified only as one instance exchanging data
with itself; genuine cross-machine operation has not been confirmed working end to end.

## Trigger

Admin opens the Admin Sync screen and presses Push or Pull, having entered the peer instance's
address.

## Precondition

Admin is signed in on the instance running the action. No presenter is actively projecting on the
instance being pushed to (the Presenter Liveness Guard, `TryAcquireSyncLock`) — Pull carries no
such guard.

## Main Flow

1. Admin enters the peer address on the Admin Sync screen and chooses Push or Pull.
2. On Push: the system gathers local Services, hymns, Song Set entries, background images, and
   announcement items changed since the last sync, and any content-addressed assets they reference.
3. The system checks which of those assets the peer is missing (`POST /api/sync/assets/check`) and
   uploads only the missing ones, by hash.
4. The system sends the record mutations to the peer's `POST /api/sync/push`, tagged with a
   `mutation_id` so a retried send is not applied twice.
5. On Pull: steps 2–4 run in the opposite direction, reading from the peer's `GET /api/sync/pull`.
6. Admin sees the result: how many records moved, or the specific rejection.

## Alternate Flows

| From step | Condition | What happens |
| --- | --- | --- |
| 2 | A presenter is actively projecting on the receiving instance | The receiving instance's sync lock refuses the push with `409 presenter_active`; Admin retries once the presentation ends |
| 4 | The same `mutation_id` is sent twice (a retried request after a dropped response) | The second send is a no-op; nothing is applied twice |

## Failure Flows

| From step | Failure | What the system does | What the user is left with |
| --- | --- | --- | --- |
| 1 | The peer address is on a different origin than the instance Admin is signed into | The browser's own CORS policy refuses the request before it reaches either instance's sync code — no WorshipDeck error, no partial write | Nothing moves; the Admin Sync screen shows whatever generic failure the browser surfaces |
| 1 | Admin is not signed in as Admin on the receiving instance | 403 | Nothing moves |
| 3 | An asset upload exceeds 50 MB | The Go API's `http.MaxBytesReader` refuses the upload before the handler runs | That asset does not transfer; the record mutation referencing it may still send, leaving a dangling reference until the asset is retried |

## Outcome

Both instances hold the same Services, Song Set entries, background images, and announcement items
as of the moment the sync ran — **when it succeeds.** As shipped, a genuine two-machine run is
expected to fail at the CORS layer before reaching this outcome; see Failure Flows.

## Business Rules

None yet — this use case's local rules are G4 work, not written at G3.
