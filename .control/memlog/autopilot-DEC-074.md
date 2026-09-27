---
artifact: .control/decisions/DEC-074-daily-autopilot-mandate-emergency-canvas-bg-crop-parity.md
---

# Autopilot Ledger — DEC-074

## Resume

- State: Applied / Finished — All SPEC-87 tickets (SPEC-87-01 and SPEC-87-02) closed, verified, and peer-reviewed (APPROVED by Terra)
- Run branch: autopilot/DEC-074
- Stopped at: Done — all FRs in mandate scope completed and verified
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite
- Next: Ready for maintainer PR merge into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-074 for Emergency Canvas Background Image Crop Parity (SPEC-87) | waiting for interactive manual dispatch | low | .control/decisions/DEC-074-daily-autopilot-mandate-emergency-canvas-bg-crop-parity.md |
| I-1 (SPEC-87-01 & 02) | src/operator/present/PresenterOperator.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts, package.json, tests/emergency-canvas-bg-crop.test.mjs, tests/bilingual-i18n-parity.test.mjs | Emergency Canvas Background Image Upload & Cropping with 16:9 widescreen aspect containment, target context branching (element vs background), dual persistence (/api/upload online URL + offline base64 Data URL fallback), Apply button race prevention (isUploadingImage), and strict bilingual parity (emergency.modal.bgUpload), approved by Terra peer review | requiring operators to manually type background image URLs on stage without cropping or upload capabilities | low | src/operator/present/PresenterOperator.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts, package.json, tests/emergency-canvas-bg-crop.test.mjs, tests/bilingual-i18n-parity.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1535 pass, 0 fail), working tree clean.
- SPEC-87-01 & SPEC-87-02 verification: PASS — `tests/emergency-canvas-bg-crop.test.mjs` (8/8 passed), `tests/bilingual-i18n-parity.test.mjs` (5/5 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Go test suite (11/11 packages passed), authoritative `npm test` full suite (1543 passed, 0 fail, 3 skipped), Terra independent peer review APPROVED.
