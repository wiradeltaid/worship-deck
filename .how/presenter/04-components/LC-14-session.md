---
type: lc
id: LC-14
name: Presenter session
lc_type: service
container: spa
component: presenter
created: 2026-08-18
updated: 2026-08-20
---

# LC-14 — Presenter session

## Responsibility

Coordinate index, blank, overlay, live background override, and liveness between the controls and the
projector.

## Depends on

LC-10 (channel) · LC-9 (verse) · LC-16 (plan, owned by Hub)

## Interface

State in window memory + channel messages. Not a table.

Blank covers overlay without clearing it. Required (OQ-25): `request-sync` answers with index, overlay, and blank — **shipped**, `sync` carries `scripture?: {...} | null` and resends it. OQ-25 is closed. Required (OQ-26): verse lookup is refused while liveness is not `live`. As-built: no-projector refuse is [MISSING] — see SDD Evidence. Plan identity is not on the message (AD-10, OQ-26).

Required (UC-27, FR-33, AD-34): the session holds one live background override, applying to every Verse/Reff
slide for the rest of the session; it is never written anywhere durable, and `request-sync` must resend it
exactly as it resends index/overlay/blank. As-built: no `background` variant exists on `PresentMessage` yet
— [MISSING], see SDD Evidence.

## Notes

`src/lib/present-channel.ts`, AD-29 liveness evaluator. No-projector refuse and the live background
override are [MISSING] in code; see SDD Evidence. Overlay-on-sync is shipped (OQ-25 closed).
