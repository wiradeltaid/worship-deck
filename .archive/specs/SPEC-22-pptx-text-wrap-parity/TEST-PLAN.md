# SPEC-22 Test Plan: PPTX Text Wrap Parity

## 1. Fixture Definition — `BIC-TITLE-WRAP` (synthetic)

Canonical regression fixture (no real congregation data):

| Field | Value |
|---|---|
| `content` | `Bandung international community` |
| `w` | Authored width where `international` wraps to line 2 in Canvas at default font size (capture exact `%` from failing dev template or reproduce: ~35–45% at 32px Arial — **lock in test** once measured) |
| `h` | Auto-synced from Fabric after save (3 lines × line-height) |
| `style.fontSize` | 32 (or value from dev template) |
| `style.fontFamily` | default / Arial stack |

Expected line breaks (all renderers):

```
Bandung
international
community
```

**Forbidden** in PPTX XML text runs (joined): `internationa` immediately followed by `l` as separate wrap, or `l community` as line start.

---

## 2. Automated Tests (`tests/smoke-spec-22.test.mjs`)

| Test ID | Ticket | Objective | Assertions |
|---|---|---|---|
| **T-22-01** | SPEC-22-01 | PPTX zero margin source guard | `pptx-draw.ts` `renderTextElement` passes `margin: 0` (or `[0,0,0,0]`) to `slide.addText` |
| **T-22-02** | SPEC-22-01 | OOXML body inset guard | Generate minimal single-text-slide PPTX; parse `ppt/slides/slide1.xml`; `bodyPr` `lIns`/`rIns`/`tIns`/`bIns` are `0` or attribute absent with zero effective inset per PptxGenJS output |
| **T-22-03** | SPEC-22-02 | `wrapLines` persisted on save | `serializeCanvas` with Fabric textbox mock reporting `textLines: ['Bandung', 'international', 'community']` → serialized element includes matching `wrapLines` |
| **T-22-04** | SPEC-22-02 | Legacy backward compatibility | Element without `wrapLines` serializes without error; field omitted |
| **T-22-05** | SPEC-22-03 | `resolveElementTextForPptx` hard breaks | Given element with `wrapLines`, export text equals `wrapLines.join('\n')` |
| **T-22-06** | SPEC-22-03 | `estimateTextFitScale` uses wrap count | Fixture with `wrapLines` length 3 and no `\n` in content → scale computed with 3 lines, not 1 |
| **T-22-07** | SPEC-22-03 | PPTX end-to-end line integrity | `generatePptxFromPlan` (or thin wrapper) with BIC-TITLE-WRAP artifact; slide XML must contain `international` as contiguous run; must NOT match `/internationa[\s\S]*<\/a:t>\s*<a:t>l/` |
| **T-22-08** | SPEC-22-04 | Documentation guard | `canvas-authoring-controls.md` documents PPTX `margin: 0`, `wrapLines` snapshot, and Canvas-authoritative line breaks |
| **T-22-09** | SPEC-22-04 | `artifact-render-model.test.mjs` extension | Existing shrink-to-fit tests unchanged; add soft-wrap fixture test alongside `estimateTextFitScale` block |

### T-22-02 Defect Injection Proof (guard discipline)

Per AGENTS.md absence-guard rule:

1. Inject `margin` removal from `pptx-draw.ts` → T-22-01 and T-22-02 MUST fail.
2. Revert → green.

### T-22-07 Defect Injection Proof

1. Remove `wrapLines` join in export path → T-22-07 MUST fail on Bandung fixture (or produce `internationa` split when margin also present).
2. Revert → green.

---

## 3. Extensions to `tests/artifact-render-model.test.mjs`

| Test | Description |
|---|---|
| `resolveWrapLineCount prefers wrapLines over content newlines` | `wrapLines: ['a','b']`, `content: 'a b\nc'` → count 2 from wrapLines (define precedence in spec) |
| `estimateTextFitScale soft-wrap fixture` | 3-line `wrapLines`, single-line `content`, tight `h` → scale < 1 when box cannot fit 3 lines |

---

## 4. Manual QA Gate (Dev: `presenter-dev.bic.my.id`)

```markdown
SPEC-22 / Screen: /admin/artifacts → /presenter → Download PPTX → LibreOffice Impress

Prerequisite: SPEC-22 deployed to dev.

1. Bandung Title Wrap Parity
   [ ] Open canvas editor; create or open template with text "Bandung international community".
   [ ] Size box so Canvas shows: L1 Bandung, L2 international, L3 community (whole words).
   [ ] Save template.
   [ ] Open /presenter — confirm identical three lines.
   [ ] Download PPTX; open in LibreOffice Impress.
   [ ] Confirm L2 is "international" (not "internationa").
   [ ] Confirm L3 is "community" (not "l community").
   [ ] Confirm descenders (y in community) are not clipped at box bottom.

2. MS PowerPoint spot check (if available)
   [ ] Same PPTX in Microsoft PowerPoint — same three lines.

3. Legacy template (no wrapLines in JSON)
   [ ] Open pre-SPEC-22 saved template; export PPTX — no crash; note parity may be best-effort.

4. Explicit newline preservation
   [ ] Text with manual Shift+Enter line breaks — PPTX preserves both manual and canvas-wrapped lines.
```

---

## 5. TDD Execution Order (for wdi-autopilot)

1. **Red**: Add T-22-01, T-22-03, T-22-05, T-22-06, T-22-07 (failing).
2. **Green**: SPEC-22-01 → SPEC-22-02 → SPEC-22-03.
3. **Red**: T-22-02 (OOXML parse) if not already green after step 2.
4. **Green**: Confirm margin emits correct XML.
5. **Docs**: T-22-08.
6. **Manual**: Section 4 on dev after deploy.
