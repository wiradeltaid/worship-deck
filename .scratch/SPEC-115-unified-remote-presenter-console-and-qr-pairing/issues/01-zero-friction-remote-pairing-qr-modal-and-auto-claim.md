# SPEC-115-01 — Zero-Friction Remote Pairing: Scannable QR Modal, Auto-Claim Token URL, and Generic `/remote` Route

**Satisfies:** [UC-29, FR-35, FR-25]
**Blocked by:** []
**Status:** closed

## Summary
Implement scannable QR Code pairing modal on Host Presenter Console, support instant auto-claim URL tokens (`/remote?service=X&code=Y`), enforce single-use token lifecycle with URL hygiene (`history.replaceState`), and establish a universal `/remote` top-level route in the SPA.

## Key Responsibilities
1. **Scannable QR Code Dialog (`PresenterOperator.tsx`)**:
   - In `PresenterOperator.tsx`, upgrade the header pairing code trigger into a dialog modal displaying:
     - A clear, high-contrast SVG QR code encoding the direct pairing URL with auto-claim query parameters (`${window.location.origin}/remote?service=${serviceId}&code=${remoteCode}`).
     - A 6-digit numeric PIN fallback display.
     - A "Salin Tautan" (*Copy Link*) button that copies the auto-claim URL to clipboard with confirmation toast.
2. **Universal `/remote` SPA Route & URL Hygiene (`App.tsx`, `RemotePage.tsx`)**:
   - Register top-level route `/remote` alongside existing `/services/:id/remote`.
   - In `RemotePage.tsx`, inspect `window.location.search` for `service` and `code` parameters.
   - If present, automatically invoke `session.claim(code)` on mount without requiring the user to type the 6-digit PIN.
   - **URL Token Hygiene**: Upon successful claim, call `window.history.replaceState({}, '', '/remote')` (or `/services/:id/remote`), cleanly stripping the single-use `code` query parameter from the address bar to prevent token leakage in history, bookmarks, or link sharing.
   - If opened bare without service ID or code, provide clean 6-digit PIN entry with active service auto-resolution.
3. **Pairing Lifecycle & Single Controller Model (AD-37)**:
   - Retain deliberate authenticated pairing: 60s code expiry, single-use token consumption.
   - Rejects replay attempts, expired codes, and mismatched service IDs with opaque 400.
   - Enforce single active remote controller per service: secondary claim against an active pairing returns 409 Conflict.
   - If host presenter disconnects, remote state immediately drops to `role-lost` or `disconnected`.
4. **Bilingual Localization (`keys.ts`, `catalogue-en.ts`, `catalogue-id.ts`)**:
   - Add localization keys for QR pairing modal:
     - `presenter.remote.qrTitle`: "Scan to Control Remotely" / "Pindai untuk Mengontrol dari Jauh"
     - `presenter.remote.qrHint`: "Scan with phone or tablet camera to instantly connect" / "Pindai dengan kamera ponsel atau tablet untuk langsung terhubung"
     - `presenter.remote.copyLink`: "Copy Link" / "Salin Tautan"
     - `presenter.remote.linkCopied`: "Link copied to clipboard" / "Tautan berhasil disalin"

## Acceptance Criteria
- Clicking the Remote code badge in Presenter Console header opens a modal displaying a scannable QR Code and copy link button.
- Scanning the QR Code with a mobile phone or opening the copied link immediately connects without manual typing of service ID or PIN.
- Navigating to `/remote?service=1&code=123456` immediately triggers auto-claim, connects, and strips `?code=...` from the browser address bar.
- Attempting to connect a second remote controller while one is active returns 409 Conflict.

## Comments
