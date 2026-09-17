---
title: 'Sync Artifact tells the truth, reports success, and refreshes the preview'
type: 'bugfix'
created: '2026-08-21'
status: 'done'
baseline_revision: 'a8db8e34c323cbbed8587922745e1bf6d0a55128'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/_platform/ARCHITECTURE-SPINE.md'
  - '.what/registry/SRS-registry.md'
  - '.how/registry/SDD-registry.md'
  - '.what/registry/04-usecases/UC-16-sync-artifact.md'
  - '_bmad-output/specs/spec-w3-registry/SPEC.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `src/operator/SyncArtifactButton.tsx` contains outdated confirmation dialog copy promising announcement flyer preservation (which became false upon FR-3 retirement), succeeds silently without operator feedback or refreshing the Live Slide Preview, and uses untranslated hardcoded English strings.

**Approach:** Update `SyncArtifactButton.tsx` and its parent integration to use translated confirmation copy accurately describing current sync behavior, display success and error toasts via Sonner, refresh the Live Slide Preview and service snapshot via an explicit success callback without calling `router.refresh()` or `navigate(0)`, and fully translate all button labels and error messages.

## Boundaries & Constraints

**Always:**
- Keep user-facing strings localized using `useT()` from `src/lib/i18n/operator.tsx` and register all new keys in `src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts`, and `src/lib/i18n/catalogue-id.ts`.
- Trigger a visible toast notification via `toast.success` / `toast.error` from `sonner` upon sync completion or failure.
- Refresh the Live Slide Preview upon successful sync without remounting the route, updating the parent container's snapshot state and calling the preview refresh mechanism.
- Ensure every acceptance criterion asserting an absence has an automated source or runtime guard test that is proved to fail upon defect injection.
- Add all new test files to the `scripts.test` entry in `package.json` so they execute under `npm test`.

**Block If:**
- Any requirement emerges to modify the backend sync contract (`POST /api/services/{id}/sync-artifact`), auth rules, or snapshot schema.
- Unattended decisions arise regarding altering the retirement status of `/api/announcements`.

**Never:**
- Never call `router.refresh()` or `navigate(0)` anywhere in operator or preview components (`tests/no-router-refresh-guard.test.mjs` enforces this).
- Never leave untranslated raw string literals in `SyncArtifactButton.tsx`.
- Never mention legacy announcement flyer lists in confirmation copy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin Confirms Sync (Success) | Admin clicks Sync Artifact, confirms dialog | Sends `POST /api/services/{id}/sync-artifact`, displays `toast.success`, calls `onSuccess` callback with updated payload/timestamp, refreshes preview without full-page remount | If network/server fails, shows `toast.error` with server error message |
| Admin Cancels Confirmation | Admin clicks Sync Artifact, clicks Cancel in dialog | No network request sent, button returns to idle state | None |
| Stale Conflict (409) | Admin confirms sync but Service was modified elsewhere | `POST` returns 409, button displays error text / toast indicating conflict | Display conflict error message |
| Unauthorized Operator (403) | Non-admin triggers sync request | `POST` returns 403, error displayed | Display permission error message |

</intent-contract>

## Code Map

- `src/operator/SyncArtifactButton.tsx` -- Sync button component: confirmation dialog copy, localized UI labels, `toast` notifications via Sonner, and `onSuccess` callback execution.
- `spa/src/pages/RunSheetPage.tsx` -- Parent page mounting `SyncArtifactButton` and `EditForm`: receives sync success callback to refresh service state (`updated_at`, snapshot) and reload the form/preview seamlessly.
- `src/operator/EditForm.tsx` -- Operator edit form: contains `reloadFromServer` and `refreshSlidePreview` mechanisms for updating slide plan and preview entries.
- `src/lib/i18n/keys.ts` -- Central i18n key registry for sync artifact strings (button label, syncing state, confirm dialog, success toast, error states).
- `src/lib/i18n/catalogue-en.ts` -- English translations for sync artifact keys.
- `src/lib/i18n/catalogue-id.ts` -- Indonesian translations for sync artifact keys.
- `tests/no-router-refresh-guard.test.mjs` -- Invariant guard ensuring `router.refresh()` and `navigate(0)` are never called.
- `tests/sync-artifact-button.test.mjs` -- Automated unit & invariant test suite validating absence of legacy confirmation copy, presence of i18n keys, and absence-guard failure verifications.
- `package.json` -- Test runner script definitions registering new test files.

## Tasks & Acceptance

**Execution:**
- `src/lib/i18n/keys.ts` -- Register new translation keys for sync artifact button, syncing label, confirmation copy, success toast, and error messages. -- Ensure complete localization keys.
- `src/lib/i18n/catalogue-en.ts` -- Add English translations for sync artifact strings. -- Complete English catalog.
- `src/lib/i18n/catalogue-id.ts` -- Add Indonesian translations for sync artifact strings. -- Complete Indonesian catalog.
- `src/operator/SyncArtifactButton.tsx` -- Refactor component to accept `onSuccess?: (updatedAt: string) => void`, use `useT()`, display `toast.success` and `toast.error`, and use updated truthful confirm dialog. -- Implement accurate sync feedback and callback flow.
- `spa/src/pages/RunSheetPage.tsx` -- Wire `onSuccess` callback from `SyncArtifactButton` to reload service snapshot and refresh preview without route navigation. -- Seamless in-place preview refresh without route remounts.
- `tests/sync-artifact-button.test.mjs` -- Create automated test suite validating copy veracity, i18n key usage, Absence Guard for legacy flyers copy, and `onSuccess` callback invocation. -- Enforce test-first verification.
- `package.json` -- Register `tests/sync-artifact-button.test.mjs` and `tests/no-router-refresh-guard.test.mjs` in `scripts.test`. -- Ensure CI execution of all guards and unit tests.

**Acceptance Criteria:**
- Given an Admin on the RunSheetPage, when they click Sync Artifact, then the confirmation dialog accurately states that frozen deck structure is replaced with the live Artifact Registry while weekly values stay, without mentioning announcement flyer preservation.
- Given an Admin confirming Sync Artifact, when the server returns 200 OK, then a success toast is displayed via Sonner, the button returns to idle, and the Live Slide Preview refreshes with the new deck structure.
- Given the `src/operator/SyncArtifactButton.tsx` file, when inspected by an absence guard, then no instance of hardcoded English literals or references to `'Announcement flyers stay'` exists in the file.
- Given the entire operator surface, when inspected, then zero calls to `router.refresh()` or `navigate(0)` exist across all components and pages.

## Spec Change Log

_None._

## Review Triage Log

### 2026-08-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 11
- addressed_findings:
  - `[low]` `[patch]` Made `onSuccess` callback invocation robust to missing/empty `payload.updated_at` in `SyncArtifactButton.tsx`.

## Design Notes

1. **In-Place Refresh Strategy:**
Rather than triggering navigation or remounting `RunSheetPage`, `SyncArtifactButton` accepts an `onSuccess?: (updatedAt: string) => Promise<void> | void` prop. When sync succeeds:
- `toast.success(t('sync.success'))` is emitted.
- `onSuccess(data.updated_at)` is invoked.
- `RunSheetPage` re-fetches `/api/services/:id` (or triggers `EditForm` reload) to update `svc` state and refresh `SlidePreviewList` via `refreshSlidePreview`.

2. **Absence Guard Discipline:**
`tests/sync-artifact-button.test.mjs` must scan `src/operator/SyncArtifactButton.tsx` source directly to ensure:
- Forbidden literal `'Announcement flyers'` does NOT appear.
- Forbidden literal `'Sync Artifact'` or `'Syncing…'` does NOT appear unlocalized.
- Absence guard is proven by defect injection.

## Verification

**Commands:**
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/sync-artifact-button.test.mjs` -- expected: all sync button tests and absence guards pass
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/no-router-refresh-guard.test.mjs` -- expected: no forbidden router refresh calls
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/i18n.test.mjs` -- expected: all i18n keys and catalogs match
- `npm test` -- expected: entire project test suite passes

## Auto Run Result

### Summary of Implemented Change
- Updated `SyncArtifactButton.tsx` to eliminate outdated announcement flyer copy, provide full i18n localization in English and Indonesian, display Sonner toasts (`toast.success` and `toast.error`), and emit an `onSuccess` callback.
- Updated `RunSheetPage.tsx` to handle `onSuccess` by reloading the service snapshot in-place to refresh previews without route remounts.
- Created `tests/sync-artifact-button.test.mjs` with absence guards for legacy copy and hardcoded English literals, proved with defect injection.
- Registered `tests/sync-artifact-button.test.mjs` and `tests/no-router-refresh-guard.test.mjs` into `package.json` test runner.

### Files Changed
- `src/operator/SyncArtifactButton.tsx` -- Localized sync button with Sonner toasts and `onSuccess` callback.
- `spa/src/pages/RunSheetPage.tsx` -- Seamless in-place service reload on sync success without calling `router.refresh()`.
- `src/lib/i18n/keys.ts` -- Central registry of sync artifact translation keys.
- `src/lib/i18n/catalogue-en.ts` -- English translation catalog for sync artifact keys.
- `src/lib/i18n/catalogue-id.ts` -- Indonesian translation catalog for sync artifact keys.
- `tests/sync-artifact-button.test.mjs` -- Absence guard test suite with defect injection proofs.
- `package.json` -- Added new test suites to `scripts.test`.

### Review Findings Breakdown
- Patches applied: 1 (low severity: made `onSuccess` invocation robust to empty or missing `payload.updated_at`).
- Items deferred: 0.
- Items rejected: 11 (formatting, style overrides, timeout hooks, non-actionable suggestions).

### Follow-up Review Recommendation
- Patched counts: high 0, medium 0, low 1.
- Score: 1 (threshold 5).
- Recommendation: `false`.

### Verification Performed
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/sync-artifact-button.test.mjs` (PASSED - 3 tests)
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/no-router-refresh-guard.test.mjs` (PASSED - 2 tests)
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/i18n.test.mjs` (PASSED - 13 tests)
- `npm test` (PASSED - 637 tests, 634 passed, 3 skipped)

### Absence Guard Defect Injection Verifications
1. **AC-03 Legacy Copy / Unlocalized literals Absence Guard in `tests/sync-artifact-button.test.mjs`:**
   - Injected `if (!window.confirm("Replace frozen structure? Announcement flyers stay this Service's list.")) {` into `src/operator/SyncArtifactButton.tsx`.
   - Verified verbatim failure:
     ```
     ✖ SyncArtifactButton contains no legacy announcement copy and no hardcoded English literals (2.2699ms)
       AssertionError [ERR_ASSERTION]: Found forbidden copy in SyncArtifactButton.tsx:
         SyncArtifactButton.tsx:20 [legacy-announcement-flyers-copy] if (!window.confirm("Replace frozen structure? Announcement flyers stay this Service's list.")) {
         SyncArtifactButton.tsx:20 [hardcoded-confirm-dialog] if (!window.confirm("Replace frozen structure? Announcement flyers stay this Service's list.")) {
     ```
   - Reverted injection.

2. **AC-04 No Router Refresh Absence Guard in `tests/no-router-refresh-guard.test.mjs`:**
   - Injected `navigate(0);` into `src/operator/SyncArtifactButton.tsx`.
   - Verified verbatim failure:
     ```
     ✖ no operator surfaces or components call router.refresh() or navigate(0) (15.0073ms)
       AssertionError [ERR_ASSERTION]: Found router.refresh() or navigate(0) calls:
         src/operator/SyncArtifactButton.tsx:20 <navigate(0)> navigate(0);
     ```
   - Reverted injection.

### Residual Risks
- None. Backend contracts, schema, and auth rules remain untouched and intact.
