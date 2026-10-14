# SPEC-123-04 — UI Cloud Pairing Modal & Sunday Readiness Indicator

**Satisfies:** [FR-16, FR-40, UC-12, UC-32]
**Blocked by:** ["SPEC-123-03"]
**Status:** open

## Summary
Implement the React UI components for Cloud Workplace Pairing and the FOH Sunday Stage Readiness Indicator:
1. In `CloudPairingModal.tsx` (mounted from Operator settings/header):
   - Modal dialog providing:
     - Cloud Instance URL input (`https://{slug}.worshipdeck.org`) with automatic protocol prefixing and whitespace trimming.
     - Pairing Token input (`foh_<id>.<secret>`) with paste helper and format validation.
     - "Test Connection" button testing remote instance reachability.
     - "Hubungkan ke Cloud" (`[ Connect / Pair ]`) action button calling `POST /api/desktop/pairing`.
     - When paired, shows church badge, instance domain, last sync time, and a red `[ Putus Hubungan / Unpair ]` button with confirmation prompt.
2. In `FohSyncIndicator.tsx` (mounted in Operator Header):
   - Action Button: `[ ⇅ Sync from Cloud ]`:
     - Displays spinner during active sync.
     - Shows progress bar during asset download.
     - Disabled when presentation is live (`🔒 PANGGUNG AKTIF (BEKU)`).
   - Sunday Readiness Status Badge:
     - 🟢 **SIAP IBADAH MINGGU (Tersinkronisasi)**: Paired, database up to date, all media assets verified locally.
     - 🟡 **SINKRONISASI DIPERLUKAN**: Unsynced cloud updates pending or last sync > 24 hours.
     - 🔴 **BELUM TERHUBUNG KE CLOUD**: Unpaired or remote instance unreachable.
     - 🔒 **PANGGUNG AKTIF (BEKU)**: Presentation live, sync locked out.
3. In `tests/foh-cloud-pairing-ui.test.mjs`:
   - End-to-end / component tests verifying:
     - Opening pairing modal, submitting token, and updating paired state.
     - Clicking sync button, showing sync progress, and transitioning to 🟢 SIAP IBADAH MINGGU.
     - Locking sync button and showing 🔒 PANGGUNG AKTIF (BEKU) when projector is live.

## Acceptance Criteria
- Operator can pair desktop app with cloud instance via clean, accessible modal dialog.
- Single-click `[ ⇅ Sync from Cloud ]` triggers delta sync with visible progress feedback.
- Sunday Readiness Indicator accurately reflects stage status (green, yellow, red, locked).
- Lock state prevents triggering sync while presentation is active.
- Automated tests pass in `tests/foh-cloud-pairing-ui.test.mjs`.
