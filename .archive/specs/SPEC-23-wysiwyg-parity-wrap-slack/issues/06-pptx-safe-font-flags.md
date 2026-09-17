# SPEC-23-06 — PPTX-Safe Font Flags and Editor Warning

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/lib/registry/font-catalog.ts`, `src/components/admin/ArtifactEditor.tsx`
- **Tests**: `tests/smoke-spec-23.test.mjs` (T-23-14), `tests/artifact-font-catalog.test.mjs`
- **Blocked by**: SPEC-23-05

## Context

PPTX carries a font **name**, not a binary: `<a:latin typeface="Great Vibes"/>` means "find a face called
Great Vibes on this machine". On a LibreOffice box without it, fontconfig substitutes the default sans, and
there is no staged fallback the way CSS has one. The `fallback: 'cursive'` field and the Google Fonts URL
live entirely in the browser and have no effect on the deck.

35 of the 45 catalogue faces are Google-hosted and will substitute on almost every machine that opens the
deck. Nothing in this spec can change that — real embedding is SPEC-24, gated on a reader-support spike.
What this ticket removes is the surprise: the admin learns at selection time, not on Sabbath morning.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. Add to `FontDefinition`:
   - `pptxSafe: boolean` — `true` only for the 10 `system` faces, which are the ones a PowerPoint or
     LibreOffice install can be expected to resolve.
   - `pptxSubstitute: string` — the safe family the deck will show instead. Assign it from the
     catalogue's own `category`, so there is one rule rather than 35 individual judgements:

     | Category | Substitute |
     |---|---|
     | `sans` | `Arial` |
     | `serif` | `Times New Roman` |
     | `display` | `Arial` |
     | `script` | `Georgia` |

     No safe script face exists, so `script` is the least-wrong choice rather than a good one: a face
     with some stroke contrast reads closer to a handwriting face than a neutral grotesque does. A
     face whose category default is visibly wrong MAY override it with an explicit value, with a
     comment saying why — the override is the interesting case, the default is not.
2. Surface it in the editor's font picker: an inline note on an unsafe face naming the substitute that
   will appear in the deck. Follow the existing shadcn and i18n conventions in `ArtifactEditor` — both are
   guarded by tests, and this project's `t` takes **one argument**; a params object is silently dropped.
3. The warning is informational. It MUST NOT block the selection, and it MUST NOT change what is exported —
   `resolveFontFamily` keeps emitting the authored family name, so the deck stays correct on a machine that
   does have the face installed.
4. Add both fields to whatever guard `tests/artifact-font-catalog.test.mjs` already applies to the
   catalogue, so a face added later cannot omit them.

## Acceptance Criteria

- [x] Every catalogue entry carries `pptxSafe`, and every unsafe entry carries a `pptxSubstitute` that is
      itself a `pptxSafe` family in the catalogue.
- [x] The 10 `system` faces are the only `pptxSafe: true` entries.
- [x] Selecting an unsafe face shows a warning naming the substitute; selecting a safe face shows none.
- [x] The exported `fontFace` is unchanged by this ticket for every face.
- [x] The catalogue guard fails when a face is added without the new fields — seen failing, not assumed.
- [x] Operator i18n and shadcn guards stay green.

## Comments

- Added `pptxSafe` and `pptxSubstitute` to `FontDefinition` and all 45 catalog fonts in `font-catalog.ts`.
- Exactly 10 system fonts are `pptxSafe: true`; all other 35 fonts map to universal safe substitutes (sans/display -> Arial, serif -> Times New Roman, script -> Georgia).
- Added warning indicators in both dropdown list rows and PopoverTrigger in `ArtifactEditor.tsx` using i18n key `admin.artifacts.fontUnsafeWarning`.
- Updated `tests/artifact-font-catalog.test.mjs` with strict schema and substitute existence assertions.
- Verified in `tests/smoke-spec-23.test.mjs` (T-23-14), `tests/operator-i18n-guard.test.mjs`, and `tests/operator-shadcn-guard.test.mjs`.

