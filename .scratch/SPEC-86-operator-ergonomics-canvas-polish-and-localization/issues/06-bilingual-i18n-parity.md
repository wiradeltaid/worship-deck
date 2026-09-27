# 06: Strict Bilingual i18n Localization Parity Across Service & Presenter Surfaces

**What to build:** In `src/lib/i18n/`, audit and achieve 100% bilingual parity (English and Indonesian) across all user-facing strings touched by SPEC-85 and SPEC-86:
1. Typed Key Declaration & Dictionary Expansion:
   - Declare all new i18n keys in `src/lib/i18n/keys.ts` to satisfy TypeScript type safety (`I18nKey` union).
   - Provide complete, non-empty string definitions in both `src/lib/i18n/catalogue-en.ts` and `src/lib/i18n/catalogue-id.ts`.
   - String inventory in scope:
     - Run-Sheet header labels, badges, tooltips, and action buttons (`present`, `preview`, `remote`, `downloadPptx`, `syncArtifact`).
     - Song-Set lyric editor buttons: `Edit Lyrics`, `Close Lyrics`, `Save to Book`, `Saving...`.
     - Slide visibility toggle tooltips and badges: `Hide slide`, `Unhide slide`, `Hidden`.
     - Presenter console controls: `All slides`, `Open congregation screen`, `Remote code`, `Kunci Ibadah / Buka Kunci`, `Edit Darurat (Lokal)`, `Run-Sheet`, `Blank screen`, `Resume screen`, `Clear scripture`, `Auto Loop`, `Stop Loop`.
     - Emergency Canvas Designer modal: Titles, descriptions, element inspector labels, shape properties, image upload/crop triggers, apply and cancel buttons.
     - `src/components/media/ImageCropDialog.tsx`: Replace hardcoded Indonesian strings (e.g. title, aspect ratio options, zoom slider, apply/cancel buttons) with `t(...)` keys.
2. Localization Discipline:
   - When interface locale is English (`en`): 100% of user-facing interface text must render in idiomatic English.
   - When interface locale is Indonesian (`id`): 100% of user-facing interface text must render in natural, idiomatic Indonesian, while keeping standard technical terms where conventional (e.g. *Offline*, *ID*, *PPTX*, *Full HD*, *Z-Index*).
   - Eliminate hardcoded untranslated strings across `RunSheetPage.tsx`, `PresenterOperator.tsx`, `DynamicFormBody.tsx`, `SlidePreviewList.tsx`, and `ImageCropDialog.tsx`.
3. Write automated unit and regression tests in `tests/bilingual-i18n-parity.test.mjs` verifying:
   - All newly introduced or touched keys are present in `keys.ts` and have non-empty string entries in both `catalogue-en.ts` and `catalogue-id.ts`.
   - Language switching re-renders buttons, tooltips, and badges in the respective target locale.
   - Absence/injection test proving that missing keys or untranslated fallback in either locale fails the parity assertion.

Satisfies `FR-25`, `UC-5`, and `UC-12`.

**Blocked by:** `SPEC-86-01`, `SPEC-86-02`, `SPEC-86-03`, `SPEC-86-04`, `SPEC-86-05`

**Status:** open

- [ ] Read `src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts`, `src/lib/i18n/catalogue-id.ts`, and `src/components/media/ImageCropDialog.tsx`.
- [ ] In `src/lib/i18n/keys.ts`:
      - Declare all new translation keys for Run-Sheet header, song-set actions, visibility toggles, presenter controls, emergency canvas modal, and image crop dialog.
- [ ] In `src/lib/i18n/catalogue-en.ts` and `src/lib/i18n/catalogue-id.ts`:
      - Add complete English and Indonesian translations for all declared keys.
- [ ] In UI components (`RunSheetPage.tsx`, `PresenterOperator.tsx`, `DynamicFormBody.tsx`, `SlidePreviewList.tsx`, `ImageCropDialog.tsx`):
      - Replace hardcoded Indonesian or English text with `t(...)` localization hooks.
- [ ] In `tests/bilingual-i18n-parity.test.mjs`:
      - Test dictionary key parity between `catalogue-en.ts` and `catalogue-id.ts`.
      - Test component rendering under English and Indonesian locales.
      - Inject defect and prove absence guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/bilingual-i18n-parity.test.mjs` and `npm run typecheck`.
