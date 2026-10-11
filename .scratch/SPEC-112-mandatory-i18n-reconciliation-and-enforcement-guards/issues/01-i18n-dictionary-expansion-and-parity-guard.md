# SPEC-112-01 — i18n Interpolation Engine, Dictionary Expansion, and Consolidated Parity Guards

**Satisfies:** [UC-10, FR-25]
**Blocked by:** []
**Status:** open

## Summary
Upgrade the i18n resolver with token interpolation (`{variable}`), expand dictionary keys in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`, and consolidate automated guards in `tests/bilingual-i18n-parity.test.mjs` with parity validation and scoped raw string detection.

## Key Responsibilities
1. **Interpolation API (`resolve.ts`, `operator.tsx`)**:
   - Enhance `resolveString(key, locale, params)` to support `{param}` token replacement for numbers and strings without external dependencies.
   - Update `useT().t(key, params)` to accept optional params object.
   - Maintain defect marker invariant: unresolved keys return `[missing:i18n:<key>]`.
2. **Dictionary Namespace Expansion**:
   - `media.drawer.*`: `title`, `close`, `tabCloud`, `tabLocal`, `emptyCloudTitle`, `emptyCloudDesc`, `emptyLocalTitle`, `emptyLocalDesc`, `moveUp`, `moveDown`, `play`, `pause`, `projectLive`, `projectSend`, `cannotDeleteActive`, `deleteItem`, `localStoredHeader`, `localStoredDesc`, `addLocal`, `processing`, `availableBadge`.
   - `media.badge.*`: `local`, `downloading`, `cancel`, `detached`, `reconnect`, `streaming`, `download`.
   - `media.topBar.*`: `playTitle`, `pauseTitle`, `playLabel`, `pauseLabel`, `stopTitle`, `fadeTitle`, `fadeLabel`, `unmuteTitle`, `muteTitle`, `takeOffTitle`, `takeOffLabel`, `projectVideoTitle`, `projectVideoLabel`, `sourceLocal`, `sourceCloud`, `emptyPlaceholder`, `openDrawerTitle`, `drawerCount`.
   - `media.uploader.*`: `addMedia`, `uploading`, `maxSizeExceeded`, `unsupportedFormat`, `uploadFailed`, `genericError`.
   - `presenter.stage.*`: `current`, `projectorBlanked`, `scriptureLive`, `loopingBadge`, `next`, `endOfDeck`, `slidesHeader`, `announcementChip`, `songSetChip`, `bgLive`, `bgLiveBadge`, `deckDefault`, `runSheetHeader`.
   - `grid.*`: `title`, `desc`, `nowBadge`, `hiddenBadge`.
   - `runsheet.*`: `headerTitle`, `serviceId`, `resumeAction`, `resumeMenuOption`, `startBeginningOption`, `screenBlankedTitle`, `exporting`.
   - `crop.*`: `dialogTitle`, `zoomLabel`, `ratioLabel`, `presetOriginalDesc`, `presetWidescreenDesc`, `presetStandardDesc`, `presetSquareDesc`, `presetPortraitDesc`, `presetCoverDesc`, `presetStoryDesc`, `presetFlyerDesc`, `presetCustomDesc`.
3. **Consolidated L2 Guards (`tests/bilingual-i18n-parity.test.mjs`, `tests/i18n.test.mjs`)**:
   - Extend existing `tests/bilingual-i18n-parity.test.mjs` to validate bidirectional parity across all `I18N_KEYS`.
   - Add unit tests for `{variable}` interpolation and missing key defect markers.
   - Add scoped scanner guard asserting operator media components do not contain un-interpolated hardcoded literals.
   - Prove guard fails under simulated defect injection and restores cleanly.

## Acceptance Criteria
- `npm test` runs `tests/i18n.test.mjs` and `tests/bilingual-i18n-parity.test.mjs` completely green.
- Interpolation correctly replaces `{count}`, `{percent}`, and `{interval}` in both EN and ID catalogues.
- Defect injection test proves guard goes red on missing key or hardcoded text and reverts cleanly.

## Comments
