# 03: Remote Control Pairing & Live Presenter Unification

**What to build:**
Implement the Remote Control Pairing affordance and Live Presenter unification within the unified workspace:
1. In-Workspace Live Presenter Launch & Rendering Invariants:
   - Primary launchpad "▶ Tayangkan Sekarang" in the workspace header/action bar launches `PresenterOperator.tsx`.
   - Consumes the single-source-of-truth planner (`plan.BuildSlidePlan` in Go):
     - If `schedule_mode = 'legacy'`, reads `service_registry_snapshots`.
     - If `schedule_mode IN ('preset', 'free')`, reads `schedule_items`.
   - Parity guarantee: Web slideshow, PowerPoint export (`draw.mjs`), and Live Presenter console render from identical `[]DrawItem` plan.
   - Presenter Liveness Guard: if presentation is active (`is_live = true`), mutating schedule structure is gated with a confirmation modal and broadcasts atomic plan updates via `present-channel.ts`.
   - Integrated Quick Scripture Lookup modal (UC-13) for spontaneous verse projection during live service without disturbing the schedule sequence.
2. In-Workspace Remote Control Pairing Security Protocol:
   - Dedicated **"📱 Remote Control"** button in the workspace header and canvas preview panel opens a Remote Pairing Modal:
     - High-contrast dynamic QR Code generated on-the-fly for smartphone camera scanning.
     - Direct URL: `https://[host]/services/:id/remote?token=...` containing a cryptographically secure, scoped token with a 4-hour TTL tied to the service window.
     - 4-digit pairing PIN with rate-limiting / brute-force throttling (max 5 attempts before a 15-minute lockout).
     - Connected devices monitor with immediate revocation button: "Putuskan Semua Remote".
3. Mobile Remote Controller Parity & Touch Controls:
   - Ensure the target `RemotePage` (`/services/:id/remote`) and `RemoteOperator.tsx`:
     - Accurately renders slide thumbnails and labels for all polymorphic item types (`custom_slide`, `song_set_entry`, `announcement_set`, `predefined_card`).
     - Provides tactile touch controls: Next Slide, Previous Slide, Black Screen, Clear Text.
     - Displays live slide countdown/timer and preacher notes.

**Satisfies:** UC-11, UC-12, UC-13, FR-20, FR-32

**Touches:** presenter, operator

**Blocked by:** 02

**Status:** open

- [ ] Connect workspace primary launchpad to Live Presenter Console with single-source-of-truth planner and Presenter Liveness Guard.
- [ ] Implement Remote Control Pairing modal with scoped token QR Code, rate-limited PIN, and revocation affordance.
- [ ] Ensure mobile RemoteOperator supports all polymorphic schedule item types with touch controls.
