# SPEC-112 — Mandatory Dual-Language i18n Reconciliation and Automated Enforcement Guards

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Room display is theme- and locale-invariant; operator chrome adheres to operator's selected `ui_locale`.
  - WDI Coding Playbook 07 § 4 (Pemisahan Bahasa Antarmuka / UI Chrome vs Bahasa Konten Bisnis).
- **Functional Requirements**:
  - `FR-25` (Display the Operator interface in the Operator's language) — Change `ui_locale`; Hub and Presenter console labels follow; projection slides do not change.
- **Use Cases**:
  - `UC-10` (I read Hub in my language) — Operator selects English or Bahasa Indonesia; UI chrome renders cleanly in the chosen language.
- **Components**: `hub`, `presenter`
- **Touches**: `i18n-catalogue`, `operator-present`, `media-player`, `hub-chrome`, `conventions`, `tests`

---

## 1. Problem Statement & Motivation

During recent delivery waves (notably SPEC-110 and SPEC-111 introducing the Media Player Suite, alongside earlier features in emergency reconciliation, run-sheet headers, slide grids, and admin panels), copywriting was hardcoded directly into TSX components in either Bahasa Indonesia or English.

This introduces three critical deficiencies:
1. **Broken Bilingual Promise (`FR-25` / `UC-10`)**: Switching `ui_locale` between English and Bahasa Indonesia leaves newly added surfaces unlocalized or stuck in a single language.
2. **Absence of Hardcoded Chrome Ratchet (`[L2-Guard]`)**: While `tests/i18n.test.mjs` verifies that every declared key in `I18N_KEYS` exists in both catalogues, there is no automated L2 guard detecting hardcoded raw strings in operator/admin components. New UI copy can bypass the catalogue completely while dictionary tests remain green.
3. **Missing Constitution Binding**: While WDI Engineering Playbook 07 § 4 mandates UI chrome i18n separation, project-level `.constitution/project/codebase-conventions-guide.md` lacked explicit normative binding, allowing implementation agents to overlook i18n during rapid delivery cycles.

---

## 2. Technical Architecture & Boundary Invariants

### 2.1 Boundary Contract: UI Chrome vs Business Content vs Room-Facing
Per WDI Playbook 07 § 4, the boundary is strictly delineated:
- **Mandatory Localized (`useT()`)**: All Operator and Admin UI Chrome — menu links, buttons, table headers, form input placeholders, tooltips, dialog titles, empty states, panic controls, accessibility aria-labels, and operator-facing toast notifications.
- **Exempt from i18n Dictionary**:
  1. *User-Authored Service Content*: Sermon titles, speaker names, detected service dates, prayer requests, and member names stored in SQLite.
  2. *Corpora Content*: Bible scripture texts, translation codes (TB, KJV), hymn lyrics, and Song Book names (`name`, `bookCode`) loaded from SQLite models.
  3. *Room-Facing Presentation Routes*: `/projector`, `/slideshow`, and PPTX worker modules remain **100% locale-invariant** per `AD-24` and `tests/i18n.test.mjs` (`projectedTree()` isolation check).
  4. *Non-UI Service Modules*: Logic files like `service-snapshot.ts` MUST NOT import React `useT()`; they return typed status codes (`'ready'`, `'warming'`, `'degraded'`) and count metadata, leaving rendering to UI badge components.

### 2.2 Interpolation API Contract
Upgrade `resolveString` in `src/lib/i18n/resolve.ts` and `useT` in `src/lib/i18n/operator.tsx` to support token replacement without pulling external dependencies:
```ts
export function resolveString(
  key: I18nKey,
  locale: UiLocale,
  params?: Record<string, string | number>
): string;
```
Tokens formatted as `{name}` (e.g. `{count}`, `{percent}`, `{interval}`) in catalogue strings are replaced with corresponding string/number values from `params`. Unresolved keys continue to return the canonical defect marker `[missing:i18n:<key>]`.

### 2.3 Two-Tier Automated L2 Guard Ratchet
Consolidate and extend the existing test suite:
1. **Tier 1 (Catalogue Parity)**: Extend `tests/bilingual-i18n-parity.test.mjs` to assert 100% bidirectional parity across all `I18N_KEYS` (expanded from 820 keys to include all newly reconciled namespaces), verifying non-empty translations and absence of `[missing:i18n:<key>]`.
2. **Tier 2 (Scoped Hardcoded Chrome Detection)**: Implement an AST or regex scanner in `tests/bilingual-i18n-parity.test.mjs` covering target operator/admin UI modules (`src/operator/present/media-player/`, `SlideGridDialog.tsx`), asserting that UI button/badge/title nodes consume `t(...)` rather than raw string literals.
3. **Defect Injection Verification**: Mutation test proves the guard goes red upon injection of a missing catalogue key or hardcoded UI literal, reverting cleanly.

### 2.4 Constitution Ratification
Update `.constitution/project/codebase-conventions-guide.md` with explicit, normative rules binding Playbook 07 § 4:
- All operator and admin UI copywriting MUST be catalogued in `keys.ts` with dual EN/ID translations and consumed via `useT()`.
- Room-facing projection routes (`/projector`, `/slideshow`) remain strictly locale-invariant.

---

## 3. Auditable Scope & File Inventory

The reconciliation strictly covers the following audited components:
- **Media Player Suite**: `src/operator/present/media-player/MediaDrawer.tsx`, `MediaTopBar.tsx`, `MediaStatusBadge.tsx`, `MediaUploader.tsx`, `MediaLauncherButton.tsx`, `MediaDock.tsx`, `MediaStage.tsx`.
- **Presenter Console**: `src/operator/present/PresenterOperator.tsx`, `src/operator/present/SlideGridDialog.tsx`, `src/operator/present/PresenterDisplayControl.tsx`.
- **Run-Sheet & Navigation**: `spa/src/pages/RunSheetPage.tsx`, `src/components/offline/OfflineReadinessBadge.tsx`, `src/components/Header.tsx`.
- **Forms & Admin**: `src/operator/DynamicFormBody.tsx`, `src/components/media/ImageCropDialog.tsx`, `src/lib/images/crop-image.ts`, `src/components/admin/BackgroundLibraryPanel.tsx`, `src/components/admin/FormLayoutAdminPanel.tsx`.

---

## 4. Linear Ticket Structure

1. **`SPEC-112-01`**: *i18n Interpolation Engine, Dictionary Expansion, and Consolidated Parity Guards*
2. **`SPEC-112-02`**: *Media Player Suite Bilingual Reconciliation*
3. **`SPEC-112-03`**: *Presenter Console, Slide Grid, and Display Control Localization*
4. **`SPEC-112-04`**: *Run-Sheet, Dynamic Form, Admin Panels, and Codebase Conventions Ratification*
