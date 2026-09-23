# 01: Presenter mode renders raw rundown text directly in Run-Sheet sidebar

**What to build:** Today, `spa/src/pages/PresentPage.tsx` extracts `const parsed = data.parsed_data || {}`
and passes `runSheetItems={parsed.items || []}` to `PresenterOperator.tsx`. Inside
`src/operator/present/PresenterOperator.tsx`, the Run-Sheet sidebar loops through `runSheetItems`
rendering only categorized `section`, `role`, or `hymn` lines. Any line that the parser could not
categorize is unmapped and omitted, causing the presenter to miss crucial bulletin lines, speaker notes,
or special announcements.

Update `PresentPage.tsx` to pass `rundownText={data.raw_payload || ''}` to `PresenterOperator.tsx`.
Remove the obsolete `runSheetItems` prop from `PresenterOperatorProps` and its callers. Update
`PresenterOperator.tsx` to render `rundownText` directly in the sidebar with `whitespace-pre-wrap`
and `overflow-y-auto`, ensuring 100% faithful representation of the original schedule without any
dropped lines.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `spa/src/pages/PresentPage.tsx` (~lines 20-33) and `src/operator/present/PresenterOperator.tsx`
      (~lines 280-305 and 1270-1310) in full first.
- [ ] Remove `runSheetItems` from `PresenterOperatorProps` in `src/operator/present/PresenterOperator.tsx`
      and add `rundownText?: string`.
- [ ] Update `spa/src/pages/PresentPage.tsx` to pass `rundownText={data.raw_payload || ''}` to `PresenterOperator`.
- [ ] In `src/operator/present/PresenterOperator.tsx`, replace the `runSheetItems.map(...)` list with a
      dedicated text container rendering `rundownText` with `whitespace-pre-wrap font-sans text-sm text-foreground/90`.
- [ ] Ensure the container preserves `overflow-y-auto` so long bulletin texts scroll smoothly without breaking
      the presenter viewport or slide preview layout.
- [ ] Add translation key `presenter.noRundownText` to `src/lib/i18n/catalogue-en.ts` ("No rundown text provided")
      and `src/lib/i18n/catalogue-id.ts` ("Tidak ada teks susunan acara").
- [ ] When `rundownText` is empty, undefined, or contains only whitespace, render `t('presenter.noRundownText')`
      as the empty state notice.
- [ ] Add unit/component tests in `tests/presenter-raw-rundown.test.mjs` verifying:
      (1) Raw text with blank lines, indentation, punctuation, and emoji renders with exact `textContent` equality.
      (2) Empty or whitespace-only text renders the localized `t('presenter.noRundownText')` placeholder.
      (3) All callers compile cleanly with only `rundownText` (no obsolete `runSheetItems` prop).
