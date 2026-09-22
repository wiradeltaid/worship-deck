---
type: sdd
component: presenter
status: draft
created: 2026-08-18
updated: 2026-08-22
realizes: [UC-11, UC-12, UC-13, UC-27, UC-29]
binds: [AD-1, AD-5, AD-7, AD-10, AD-12, AD-23, AD-24, AD-25, AD-26, AD-27, AD-28, AD-29, AD-30, AD-33, AD-34, AD-37]
reviewed:
  date: '2026-09-22'
  sha: '06edf6796b34abf825756a307c040e57ca9157dd'
  lenses: [structure, prose]
  note: 'Re-review of the delta since 411a59d only: the "Inherited Constraints" table dropped its "Quoted rule" column (restated ARCHITECTURE-SPINE.md''s own AD-N Rule text verbatim). No promise or rule content changed — this is the restated-derived-fact class this skill''s own guide says to delete, and the deletion is what happened. Zero findings.'
---

# SDD — Presenter

As-built. Offline guarantee is not this component's responsibility (AD-1).

## Decision Summary · [outline]

Presenter is three URLs: slideshow and projector on the projected SPA shell, plus presenter controls on the operator shell. Presenter↔projector sync is client `BroadcastChannel`, no WebSocket (AD-10); slideshow does not join the channel. On-demand verses use the local corpus via the Go API.

Expensive choice: one channel module `@/lib/present-channel`; Operator chrome does not paint the room screen (AD-24).

A live Verse/Reff background choice (UC-27, FR-33, AD-34) rides the same channel and the same shape as the
existing live transition override (AD-23): a session-only value, never persisted, resolved fresh from AD-33's
normal order on every new generate or Sync. No new boundary, no new table — LC-10 carries one more message
variant and LC-14 holds one more piece of session state.

**A remote control device (UC-29, FR-35, AD-37, DEC-006) is the first thing here that needs a server.**
`BroadcastChannel` reaches only tabs of one browser on one device, so a phone cannot join it — and that
is deliberate, not a gap. DEC-006 admits a server realtime channel for the **remote-to-laptop leg
only**, and the design's whole job is to keep that admission from leaking: the phone sends intents to
the presenting client, the presenting client stays the only sender the projector follows, and the
laptop-to-projector path keeps working with the remote closed, asleep, or off the network. Two new
boundaries land on `api` (LC-17, LC-18) — **not** on `spa`, because a relay between two browsers cannot
live in either of them. Nothing about the existing channel changes and no new intent is minted; the six
the remote sends already exist on `PresentMessage`.

## Structure · [outline]

| LC | type | Responsibility |
| --- | --- | --- |
| LC-9 | gateway | `GET /api/scripture` |
| LC-10 | gateway | presenter↔projector `BroadcastChannel` |
| LC-14 | service | index / blank / overlay / liveness session |
| LC-17 | gateway | remote↔presenting-client relay: pair, claim, stream, intent (`api`, new — `[MISSING]`) |
| LC-18 | service | which remote may drive which presenting client, and for how long (`api`, new — `[MISSING]`) |

Direction: Operator controls → LC-14 → LC-10 → projector. **Remote path, and it converges rather than
forking:** remote → LC-17 → LC-18 authorises → LC-17 streams the intent to the presenting client →
LC-14 → LC-10 → projector. The remote's intent enters at the same place the Operator's own hand does,
which is what keeps AD-10's single controller literally true instead of merely intended. LC-17 and
LC-18 are on `api` because a relay between two browsers cannot live in either browser. Slideshow is a separate projected page; it does not join LC-10 and must not ack. LC-9 from the controls. Plan from LC-16 (Hub), which for a persisted Service reads the AD-16 snapshot and is served to both shells on `GET /api/services/[id]` (inventory row 35). Does not write Registry.

## Inherited Constraints · [guarded]

| AD | How it lands here |
| --- | --- |
| AD-1 | Slideshow is best-effort (OQ-5). |
| AD-5 | Scripture GET and the three screens are inside the matcher; no session → 401 / login, Deck unchanged. As-built until cutover: `internal/gate`. |
| AD-7 | Slideshow and projector do not order themselves. |
| AD-10 | LC-10, unchanged for the projector leg. Plan identity **has** shipped — every shared-state variant carries `planIdentity` (`src/lib/present-channel.ts`) — so this row's old claim that it was unbuilt is corrected here. **Superseded in part by AD-37 (DEC-006):** the *no server realtime channel* clause, for the remote-to-laptop leg only. The remote never opens this channel. |
| AD-12 | Dumb renderer. |
| AD-23 | Live-session override may travel on the channel; PPTX does not follow. |
| AD-24 | Projected SPA shell. |
| AD-25 | Verse tables. |
| AD-26 | Verse lookup. |
| AD-27 | [PARTIAL] — the AD names book-name debt. |
| AD-28 | Verse overlay. |
| AD-29 | Liveness. |
| AD-30 | Screens and LC-10/LC-14 on `spa`; LC-9 on `api`. |
| AD-33 | Presenter renders whatever background AD-33's resolution order (plus this component's own live override, AD-34) hands it for the current Verse/Reff slide; it authors nothing (Registry's lane). |
| AD-34 | LC-10 carries the override; LC-14 holds it in window memory only, for the length of one presenter session (UC-27). |
| AD-37 | LC-17 accepts an intent only from a remote holding a live pairing (LC-18), and forwards it to the presenting client, which applies it exactly as if the Operator had pressed the key there. LC-14's liveness evaluator gains **no** input from the relay: a dead remote and a dead projector are different facts and AD-29 owns the second one. The relay is absent from the projector path entirely, which is how the third sentence is satisfied by construction rather than by care. |

## Failure Behaviour · [guarded]

Process timeout: the Go API default. The "Next/Node default" this line used to name is gone — DEC-003 retired the Next.js shape and these three screens are Vite SPA routes under `spa/src/pages/`. Presenter does not retry to the client; the Operator presses again. No numeric per-route timeout was read [ASSUMED].

| Boundary | Slow | Absent | Lying | User | Logged |
| --- | --- | --- | --- | --- | --- |
| GET /api/scripture | Overlay waits. After timeout, fail closed (SCN-4); no retry | 500; empty corpus → 503 reported as absent (FR-22) | Ambiguous / not found → no guess (NFR-5, SCN-4). Empty `ref` → 400 (SCN-4, not a silent no-op). No session → 401. Unknown translation → 400 | Verse does not appear; Deck stays; Operator sees lookup failed | `console.error` on 500 (`internal/httpapi`) |
| LC-10 channel | Delayed message; no spinner on the room screen | Projector `lost` (AD-29). `BroadcastChannel` missing → no sync | Another tab on the same name; plan identity mismatch refuses the index (AD-10) | Control: `lost` verdict. Congregation: room-facing refuse copy, not an offset slide | — |
| LC-10 background override (UC-27) | Delayed message; projector keeps its last-known background until the message lands | No projector live yet: choice is held in LC-14 session state and applied on the projector's first sync (same shape as index/blank/transition) | Background Library empty → resolution falls through to AD-33's normal order, no error; plan identity mismatch refuses the override exactly as it refuses an index | Congregation: no visible change until a projector is live. Operator: no error — the choice is simply pending | — |
| /services/[id]/slideshow | Slow first load. After load, in-memory show may continue (OQ-5) | Required: missing Service → Hub, slideshow does not open (UC-11). As-built: `notFound()` → projected "Slides unavailable" [PARTIAL] | Plan failed | Required: Hub; PPTX remains the guarantee (OQ-26). As-built: black failure copy on this URL with run-sheet links [PARTIAL] | `console.error` on plan fail (`spa/src/pages/SlideshowPage.tsx`) |
| /services/[id]/present | Slow first load | Required: missing Service or plan → Hub as UC-11; presenter does not open (OQ-26). As-built: missing Service → `notFound()` [PARTIAL] | Plan failed | Required: Hub. As-built: error card on this URL (run-sheet / PPTX); `PresenterOperator` does not mount [PARTIAL] | `console.error` on plan fail (`spa/src/pages/PresentPage.tsx`) |
| /services/[id]/present/projector | Slow first load | Window closed → `lost`. Presenter open with no projector yet → AD-29 `no evidence yet` (silent), not `lost`. Missing Service → projected not-found | Slideshow tab answering as projector; a second projector window | Forbidden by AD-29; only one projector window may ack. Plan fail: black "Slides unavailable", no Operator chrome | `console.error` on plan fail (`spa/src/pages/ProjectorPage.tsx`) |

| POST `/api/present/[id]/remote/pair` (**`[MISSING]`**) | Presenting client waits; no code shown yet, and it keeps presenting throughout | 403 not signed in; 404 no such Service | A pairing already live → 409 rather than replacing it, because two remotes is two controllers by another route | A short-lived code on the laptop, or a failure message beside a service that never stopped | server-side on 500 |
| POST `/api/present/[id]/remote/claim` (**`[MISSING]`**) | Remote waits; nothing is bound until it answers | 403 not signed in; wrong, expired or reused code → 400 with no hint which of the three | Claiming a pairing already held → 409; claiming a Service the caller is not presenting → 404, not 403, so a probe learns nothing about what exists | Remote either shows the presenter view or says the code did not work | server-side on 500; **never the code itself** |
| GET `/api/present/[id]/remote/stream` (**`[MISSING]`**) | The stream *is* a wait; that is not a failure. Silence past the agreed window is a lost verdict on that leg only | 403 not signed in; no live pairing → 409 with pair-again | Another tab on the same pairing and role → the older stream is closed, so exactly one holder per role | Remote: a lost badge and input refused. **Room screen: nothing at all** — the laptop keeps driving (AD-37) | reconnect and close server-side; not per message |
| POST `/api/present/[id]/remote/intent` (**`[MISSING]`**) | Remote waits; the room does not change until it lands | 403; no live pairing → 409; presenting stream gone → 409 pair-again | Unknown `type` → 400, never a silent drop, because a dropped intent looks like a dead remote. `planIdentity` mismatch → refused (AD-10): the phone may be looking at a deck the laptop no longer has | The room screen follows, or the remote says the intent did not land. Either way the laptop's own control is unaffected | server-side on 500 |
| DELETE `/api/present/[id]/remote/pair` (**`[MISSING]`**) | Either side waits | 403; already gone → 204, ending is idempotent | — | Remote stops controlling; the service continues | — |

**The property that outranks every row above:** none of these failures reaches the congregation. The
relay is not in the laptop-to-projector path, so a relay that is slow, down, restarted, or deleted
outright leaves the room screen exactly as it was (AD-37, and AD-1's offline guarantee behind it). A
test for this feature that does not include unplugging the remote mid-service has not tested it.

Intents are **intended values, not deltas** — `blank: true`, an absolute index — so a duplicate is
harmless and a lost one is corrected by the next. That is what makes an unreliable phone network
survivable with no queue and no replay, and replaying a stale intent is the failure that queue would
introduce: a slide advanced three minutes ago is not an instruction any more.

No server retry. Operator re-opens the URL or the projector from control.

## Robustness Analysis · [deep]

Presenter has no `critical` UC. ABCE below is for the UCs this component has (presenting), so `deep` is not empty on the design side.

| UC | Boundary in | Control | Entity | Boundary out |
| --- | --- | --- | --- | --- |
| UC-11 | `/slideshow` | slideshow page (not LC-14) | (read) Service + plan | projected screen; miss → Hub |
| UC-12 | `/present` + projector | LC-14 | ProjectorLiveness | LC-10 (index, overlay, blank) |
| UC-13 | verse form | LC-14 | BibleVerse (read) | projector overlay; refuse if projector not live |
| UC-27 | Background Library picker on presenter control | LC-14 | (read) session-only background override; no entity — never persisted (AD-34) | LC-10 background message → every live projector window |
| UC-29 | Remote presenter view on a second device → LC-17 | LC-18 authorises, then LC-14 applies the intent as if it were local | RemotePairing — which remote may drive which presenting client, and until when. Session-scoped, not a Service row | LC-10 → projector, unchanged. The remote is upstream of the single controller, never beside it |

Contracts: `02-contracts/` (`00-inventory`, `01-scripture`, `02-present-channel`, and `03-remote-control` new). No `06-flows/` — not money, not delete, not a third party. `01-ux/` skipped with `wdi-ux`, which is where the remote's own screen would be designed.

## Evidence

| Claim | Label | Read to decide | Disposition |
| --- | --- | --- | --- |
| One GET scripture | verified | `internal/httpapi` scripture handler | empty `ref` → 400; 401 is the gate, not this file |
| Plan identity on PresentMessage | [MISSING] | spine AD-10 *Not yet closed*; `src/lib/present-channel.ts` `PresentMessage` union has no identity field | planned: AD-10 / OQ-26 / deferred-work; not a BUG until a wave closes it |
| Overlay on `sync` / request-sync resend of overlay | [MISSING] | `PresentMessage` `sync` is `index`, `blank`, `transition` only; `PresenterOperator` `currentState()` matches; `ProjectorClient` `setOverlay(null)` on `sync` | planned: OQ-25; not a BUG until a wave closes it |
| Unblank reveals overlay if still open | verified | `ProjectorClient.tsx` blank is a covering `z-50` layer; overlay state is not cleared by blank | matches OQ-25 / BR-6 |
| No projector → refuse verse lookup | [MISSING] | `PresenterOperator.pushScripture` fetches and broadcasts with no liveness check | planned: OQ-26 |
| Missing Service/plan → Hub | [PARTIAL] | `spa/src/pages/PresentPage.tsx`, `spa/src/pages/SlideshowPage.tsx`: missing Service → `notFound()`; plan fail → error card / black copy, `PresenterOperator` does not mount | required UC-11/OQ-26 is Hub; as-built is not a redirect |
| Presenter scripture fetch omits `translation` | [PARTIAL] | `PresenterOperator.pushScripture` query is `ref` only; route falls back to `DEFAULT_TRANSLATION` | AD-28 required param not yet on this caller |
| Projected shell is literal black | verified | AD-24; `tests/theme-chrome.test.mjs` guards it | — |
| LC-14 session in window memory | verified | `src/lib/present-channel.ts`; `PresenterOperator` refs; not a table | — |
| Live background override on `PresentMessage` | [MISSING] | `src/lib/present-channel.ts` union has no `background` variant; `transition` is the nearest existing shape it should mirror | planned: UC-27 / FR-33 / AD-34; not a BUG until a wave closes it |
| Background Library read by Presenter | [MISSING] | No Background Library reader exists yet in `src/lib/` at any layer this component can cite | planned: UC-27; Presenter only consumes a resolved image reference, it does not own the library (Admin/Registry's lane, DEC-004 S10/S11) |
| The remote relay, its pairing store, and every path in `02-contracts/03-remote-control.md` | `[MISSING]` | `internal/httpapi/server.go` has no `/api/present/*` route; no `text/event-stream`, WebSocket or `EventSource` anywhere under `internal/`, `src/`, `spa/` | FR-35 promised and unbuilt. Planned work, not a `BUG-`. The transport choice is this document's (G4) and is recorded in the contract |
| Plan identity is on every shared-state message | verified | `src/lib/present-channel.ts` — `planIdentity` on `sync`, `blank`, `transition`, `background`, `scripture`, `clear-scripture` | **Corrected 2026-08-22.** An earlier revision of this SDD and of `02-contracts/02-present-channel.md` both called it unbuilt; AD-10's own *Not yet closed* records that it shipped |
| The live background variant exists on `PresentMessage`, and `sync` resends it | verified | `src/lib/present-channel.ts` — `background` variant, and `background?` on `sync` | **Corrected 2026-08-22.** The contract labelled it `[MISSING]` and planned for a later wave; it landed with UC-27 |
| Overlay is still absent from `sync`, so a projector reload clears it | verified | `sync` carries index, blank, transition, background and planIdentity — no overlay field | Still open: **OQ-25**. This is the one of the three that the correction above does *not* close |
| Group markers (Song Set, Announcement Set) never carry a slide number | [MISSING] | `src/operator/present/presenter-model.ts` groups contiguous SongSet children into one row today; an Announcement Set group row does not exist yet on this reader | planned: BR-9 / DEC-004 AD-35. The shared `@/lib/artifacts/preview-model.ts` labelling this reads from is also consumed by Hub's Service-form preview (`src/operator/CreateForm.tsx`, `EditForm.tsx`); a change there is cross-component drift, reported to Hub's G4, not made here |

---

## Slots

`01-ux/` is not written — belongs to `wdi-ux`. `02-contracts/` (00-inventory, scripture, present-channel, remote-control). No `03-integrations/` (not a third party). `04-components/LC-14-session.md`. `05-model/data-model.md`. No `06-flows/` — not money, delete, or a third party.

## Open Items

OQ-5 · OQ-25 · OQ-26 · OQ-28 · OQ-29. Session display (showing / blanked / overlay) is ephemeral on the
channel, not a table.

**New from this pass (DEC-006 / FR-35 / UC-29), and none of it is answered here:**

- **The pairing's lifetime is designed, not decided.** The contract says a code is single-use and
  short-lived and that both ends read one exported number, which is the discipline AD-29 sets for the
  heartbeat pair. The number itself is the build's to pick and to justify — long enough for an Operator
  to walk from the laptop to the back of the hall, short enough that a code on a screen nobody watches
  is not a key. Filed as **OQ-53**.
- **A second remote is refused, not queued or promoted.** One pairing per presenting client, and a
  second claim gets 409. That follows AD-37, but a hall with two volunteers will want two phones one
  day, and that is a new decision rather than a limit to relax quietly. Filed as **OQ-54**.
- **Whether the remote survives a laptop reload** is unanswered. The presenting client's stream dies
  with the page; a pairing that outlives it would let the Operator reload without re-pairing, and a
  pairing that does not would be safer. Not decided here. Filed as **OQ-55**.
