# SPEC-120 — Decouple Presenter Remote Pairing Session from Projector Liveness Verdict

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — Screen evaluator integrity preserved; projector liveness is evaluated by its own heartbeat and window handle.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Remote control pairing session must remain stable for the lifetime of the operator presenter view, without being invalidated by projector window lifecycle events.
- **Functional Requirements**:
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling with stable pairing codes.
- **Use Cases**:
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `present-channel`, `remote-control`

---

## 1. Problem Statement & Motivation

During operator usage, whenever the operator opens, closes, focuses, or reloads the Congregation Screen (Projector window), the 6-digit remote pairing PIN and QR code regenerates and changes:
1. When Presenter starts, `liveness.verdict` begins as `'never-opened'`.
2. `PresenterOperator.tsx` instantiates `PresenterRemoteSession` inside a `useEffect` that had `liveness.verdict` in its dependency array.
3. When the Congregation Screen opens, its initial heartbeat ack transitions `liveness.verdict` from `'never-opened'` to `'live'`.
4. This triggers the `useEffect` cleanup function (`session.stop()`) and mounts a new `PresenterRemoteSession`, executing `session.start()`.
5. `session.start()` issues `POST /api/present/{id}/remote/pair` to the Go backend.
6. Per `remote.go`, claiming the presenting role cancels any existing pairing code and issues a brand-new random 6-digit code.
7. Any mobile remote operator scanning the QR code or entering the PIN while the projector is being opened has their code invalidated or active connection terminated.

---

## 2. Technical Solution

1. **Use Mutable Ref for Liveness inside Intent Handlers (`src/operator/present/PresenterOperator.tsx`)**:
   - `livenessRef` (`livenessRef.current.verdict`) is already maintained in `PresenterOperator.tsx:1029` by `dispatchLiveness`.
   - In `handleGuestProject`, read `livenessRef.current.verdict === 'live'` rather than the closed-over state `liveness.verdict`.
2. **Remove `liveness.verdict` from Remote Session `useEffect` Dependency Array**:
   - Remove `liveness.verdict` from the dependency array in `PresenterOperator.tsx:1989`.
   - The remote session lifecycle is tied solely to `serviceId` and presenter mount/unmount.
3. **Automated Guard Test (`tests/remote-presenting-client.test.mjs`)**:
   - Add a static AST/regex scan guard test in `tests/remote-presenting-client.test.mjs` verifying that the remote session `useEffect` dependency array in `PresenterOperator.tsx` does NOT include `liveness` or `liveness.verdict`.
   - Include defect injection verification for the guard.
