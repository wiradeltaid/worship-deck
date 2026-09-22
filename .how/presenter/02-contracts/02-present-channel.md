---
type: contract
component: presenter
lc: LC-10
direction: exposed
created: 2026-08-18
updated: 2026-08-22
---

# Contract — Present channel

## Source of truth

`src/lib/present-channel.ts` — `PresentMessage` union. Not HTTP.

## Purpose

UC-12, UC-13, UC-27, AD-10, AD-29. Session display: showing / blanked / overlay (OQ-25). Slideshow (UC-11) does not use this channel.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| index / blank / overlay | Controls → projector | UC-12 · UC-13 |
| transition | Live-session override of app-wide style (AD-23); PPTX does not follow | UC-12 |
| background | Live-session override of the current Verse/Reff background (AD-34), same shape as `transition`: a value the sender intends, not a toggle; resends on `sync` so a reload does not lose it. Neither the Service payload nor the Registry follow. **Shipped** — `PresentMessage` carries a `background` variant and `sync` resends it (`src/lib/present-channel.ts`). This row read `[MISSING]` until 2026-08-22 | UC-27 |
| clear-scripture | Dismiss overlay | UC-13 |
| request-sync | Projector asks for state; answer resends index, overlay, and blank (OQ-25) | UC-12 |
| liveness ack | Projector → presenter, own condition only | AD-29 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Same-origin BroadcastChannel; not a server session |
| Validation | Only the shape in the shared module; a surface may not open another channel name (AD-10) |
| Error handling | Plan identity: **shipped** — every shared-state variant carries `planIdentity` and a receiver whose own identity differs refuses the index (`src/lib/present-channel.ts`, 8 occurrences). `background` on `sync`: **shipped** — `sync` carries `background?` so a reload resends the current override. Overlay on `sync`: **shipped** — `sync` carries `scripture?: {...} | null` and `ProjectorClient.tsx` resends it via `setOverlay(msg.scripture ?? null)` on `sync`. OQ-25 is closed. All three read `[MISSING]` here until they shipped |
| Rate limiting | Heartbeat interval exported once from the liveness evaluator (`PROJECTOR_HEARTBEAT_INTERVAL_MS`); not unbounded and not silent. No HTTP quota — this is not an HTTP API. |
| Idempotency | Intended values on the wire (`blank`, `index`, `transition`, overlay text). Ack idempotent by construction (AD-29). `request-sync` may be answered twice with the same triple. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Projector closed | `lost` verdict | Re-open from the controls |
| Slideshow tab ack | Forbidden — projector window only | Do not add a sender |
| Second projector window | Forbidden — one projector on the channel | Close the extra window |
| Control or projector reload | Resend index, overlay, and blank (OQ-25); planned: also resend the live background override | Do not treat reload as a new index |
| Background Library empty, or no live override chosen | No `background` message sent | Projector resolves through AD-33's normal order (weekly → global default → blank) |

## Compatibility

A new variant outside `@/lib/present-channel` is an AD-10 violation.

## Constraints

Ephemeral; not `localStorage` (AD-24). No liveness notice on the Congregation screen. Plan identity stays deferred (AD-10, OQ-26); the [MISSING] on `PresentMessage` is not deleted. `background` follows AD-34: never written to the Service payload, the Registry, or any table; it does not survive past the presenter session, and the next generate or Sync resolves through AD-33's normal order as if it had never happened.
