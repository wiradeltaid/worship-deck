# 02: Operator UI Legal About Modal & Profile Menu Integration

**What to build:** In `<src/components/AboutModal.tsx>`, `src/components/Header.tsx`, `src/lib/i18n/operator.tsx`, `package.json`, and `tests/about-modal.test.mjs`:

1. **About Modal Component (`<src/components/AboutModal.tsx>`)**:
   - Create responsive Dialog component rendered with `@/components/ui/dialog`.
   - Authoritative Version Source: Synchronize version directly from `package.json` (via Vite define `__APP_VERSION__` in `spa/vite.config.ts`), ensuring zero version drift across SPA, installer, and PE binary.
   - Display:
     - WorshipDeck logo mark (`/branding/worship-deck-icon-square.svg`) and display title `WorshipDeck`.
     - Version badge dynamically reading `v${__APP_VERSION__}`.
     - Publisher Copyright: `Copyright (c) 2026 Wira Delta Indonesia`.
     - License Notice: `Free software under the MIT License. Source: LICENSE`.
     - Church Operator Liability Separation:
       `This installation is operated by the local church administration, not by the publisher. What is stored, and who answers for it: PRIVACY.md`.
     - Hymn Text License Exclusion:
       `Hymn texts are not covered by the MIT license and are not ours to license. See ATTRIBUTIONS.md`.
     - Publisher Identity & Support Contact:
       `Wira Delta Indonesia` (`https://wiradelta.id/worship-deck`) and `support@wiradelta.com`.
     - Local-First & Zero Telemetry Notice:
       Explicit disclosure that WorshipDeck operates strictly local-first with zero telemetry and zero background outbound calls.

2. **Header Dropdown Trigger (`src/components/Header.tsx`)**:
   - Add dropdown menu item `About WorshipDeck` with `Info` icon in `DropdownMenuContent`.
   - Wire state to open `<src/components/AboutModal.tsx>`.

3. **Localization Support (`src/lib/i18n/operator.tsx`)**:
   - Add bilingual dictionary entries under `chrome.about.*` for English (`en`) and Indonesian (`id`).
   - Keep canonical English text visible alongside localized explanations for mandatory legal disclaimers.

4. **Automated Guard Tests & Test Registration (`package.json`, `tests/about-modal.test.mjs`)**:
   - Register `tests/about-modal.test.mjs` in `package.json` under `"test"` and `"smoke:spec-90"`.
   - Assert About Modal contains all mandatory legal strings verbatim.
   - Assert `Header.tsx` includes the trigger element.
   - Defect injection proof: verify omitting the church operator disclaimer or hymn text disclaimer fails the test suite.

Satisfies `FR-40`.

**Blocked by:** 01

**Status:** closed

- [x] In `<src/components/AboutModal.tsx>`:
      - Implement Dialog modal rendering canonical WDI About copy.
- [x] In `src/components/Header.tsx`:
      - Add menu item in profile dropdown with `Info` icon opening the modal.
- [x] In `src/lib/i18n/operator.tsx`:
      - Add localization keys for About dialog.
- [x] In `package.json`:
      - Add `tests/about-modal.test.mjs` to `test` and `smoke:spec-90` scripts.
- [x] In `tests/about-modal.test.mjs`:
      - Assert legal copy integrity and trigger rendering with defect injection.
