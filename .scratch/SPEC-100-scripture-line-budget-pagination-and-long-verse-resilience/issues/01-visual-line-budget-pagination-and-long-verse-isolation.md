# 01: Visual Line-Budget Pagination Algorithm & Long-Verse Isolation/Continuation

**What to build:** In `src/lib/scripture-format.ts`:

1. **Conservative Segmented Line Estimation Logic**:
   - `CHARS_PER_LINE = 60` (conservative safety factor for `4.8cqh` font at `88cqw` stage content box).
   - Mode-specific estimation:
     - `per-verse`: For each verse, formatted text = `(v.label || `(${v.verse}) `) + v.text`.
       Split formatted verse by newline `\n`. For each newline-delimited segment:
       `lines = Math.max(1, Math.ceil(segment.length / CHARS_PER_LINE))`.
       Total verse lines = sum of segment lines. Total page lines = sum across verses.
     - `inline`: Format joined paragraph joined by `"; "`:
       `lines = Math.max(1, Math.ceil(joinedText.length / CHARS_PER_LINE))`.
       Capped at `inlineMaxSourceVerses = 12`.

2. **Budgeting Boundaries & Accumulation Policy**:
   - `HARD_LINES = 10` (normal page ceiling), `TARGET_LINES = 8` (continuation fragment ceiling).
   - Accumulate verses into current page while `totalEstimatedLines <= HARD_LINES (10)`.
   - If adding candidate causes `totalEstimatedLines > HARD_LINES`:
     - If `current` is non-empty: flush `current`, start candidate on fresh page.
     - If candidate alone exceeds `HARD_LINES = 10`: isolate and split into word-boundary continuation fragments.

3. **Both-Sides Sealed Long-Verse Isolation, Splitting & Lossless Reconstruction**:
   - Threshold `ISOLATE_AT_CHARACTERS = 450`:
     - When verse `>= 450` characters: pre-flush prior verses, place long verse on isolated slide, post-flush immediately so subsequent verses cannot join.
   - If the verse has `estimatedLines <= HARD_LINES (10)` (e.g. Esther 8:9 with 528 chars at ~9 lines):
     - Renders as an **isolated single-page slide** at base font `4.8cqh` with `isContinuation: false, continuationIndex: 1, continuationCount: 1`.
   - If an ultra-long verse has `estimatedLines > HARD_LINES (10)`:
     - Partitioned into sequential fragments where each fragment (including its label) fits within `TARGET_LINES (8)`.
     - Splitting partitions exact source substrings such that `fragments.map(f => f.text).join('')` losslessly reconstructs the exact original source text in both `per-verse` and `inline` modes.
     - Pathological token fallback: if an individual token exceeds line capacity (`> 60` chars without space), cleanly partition at character boundary.
     - Fragment 1: `label: "(v)"`, `isContinuation: false`, `continuationIndex: 1`, `continuationCount: N`, `displayReference: "Book C:V"`.
     - Subsequent fragments: `label: "(v, continued)"`, `isContinuation: true`, `continuationIndex: k (k > 1)`, `continuationCount: N`, `displayReference: "Book C:V (continued)"`.

4. **Durable Passage-Level Typography Propagation**:
   - `paginateScriptureVerses` takes `typographyMode: 'chapter' | 'verse'` from acquired passage and attaches it to every generated `ScripturePageChunk`.

5. **Automated Unit Tests in `tests/scripture-line-budget-pagination.test.mjs`**:
   - Both-sides sealed isolation: isolated verse with preceding and subsequent verses is proven isolated on its own slide without neighbors.
   - Calibrated bilingual fixture matrix:
     - KJV John 4 & TB Yohanes 4 (all 54 verses) produce pages where every page has `<= 10` visual lines without micro-font compression.
     - KJV Esther 8:9 & TB Ester 8:9 render on an isolated single slide without neighbors and without splitting.
     - Synthetic ultra-long verse (> 650 chars / 11+ lines) isolates and splits cleanly at word boundaries with correct continuation labels and indices in both `per-verse` and `inline` modes.
     - Lossless text preservation assertion: `assert.equal(fragments.map(f => f.text).join(''), originalText)`.
     - Boundary edge-case tests (Terra edge-case-hunter):
       - Exactly 449 vs 450 vs 451 characters in short-long-short sequence.
       - Exactly 9 vs 10 vs 11 estimated lines.
       - Newline-delimited and punctuation-dense source text.
       - Unbroken tokens > 60 characters cleanly partitioned.
     - Short chapter (Psalm 117 / Mazmur 117) and short verses (John 11:35) batch efficiently up to line budget.
     - Both `per-verse` and `inline` modes tested.
     - Defect injection proofs.

**Blocked by:** none

**Status:** closed

- [x] Implement conservative segmented visual line estimation (`CHARS_PER_LINE = 60`) in `src/lib/scripture-format.ts`.
- [x] Implement deterministic line-budget chunking (`hardLines: 10`, `targetLines: 8`).
- [x] Implement both-sides sealed long-verse isolation (>= 450 chars) and word-boundary continuation splitting (> 10 lines) with lossless text preservation.
- [x] Add comprehensive unit tests in `tests/scripture-line-budget-pagination.test.mjs`.
