# SPEC-121-04 — Monotonic Telemetry Sequence, Reconnect Full-Snapshot, Projector JSX Mute & Bilingual Parity

**Satisfies:** [FR-16, FR-25, UC-12, UC-29]
**Blocked by:** ["SPEC-121-03"]
**Status:** closed

## Summary
Eliminate presentation telemetry edge-cases, audio leaks, and unlocalized strings:
1. In `PresenterOperator.tsx` and `presenter-remote-client.ts`, add a monotonic sequence number (`seq`), `sessionEpoch`, and timestamp to `broadcastState`. Remote clients drop updates with older `seq` while an optimistic seek hold is pending, with explicit epoch reset on presenter restarts.
2. When a remote client connects or reconnects to the SSE stream, immediately dispatch an unthrottled full presentation state snapshot.
3. In `ProjectedMediaLayer.tsx`, statically declare `defaultMuted` alongside `muted` and `playsInline` on `<video>` elements in JSX to ensure complete DOM state synchronization at mount.
4. Clean up all unlocalized strings ("Warna Teks", "Opasitas:", "Upload & Crop", "Contain/Cover/Fill") in `PresenterOperator.tsx`, mapping them to `I18N_KEYS` in `catalogue-en.ts` and `catalogue-id.ts`.

## Acceptance Criteria
- Seekbar scrubbing on remote clients remains completely stable without rubber-banding under simulated 500ms network jitter.
- Reconnecting remote clients immediately reflect current slide and playback states without waiting for the next natural event.
- Congregation video layer declares static `defaultMuted` in JSX, guaranteeing zero audio output on mount and transition.
- All operator UI controls adhere to bilingual dictionary parity with zero unlocalized raw strings.
- Automated tests verify telemetry monotonicity, reconnect snapshots, static video mute, and bilingual parity.
