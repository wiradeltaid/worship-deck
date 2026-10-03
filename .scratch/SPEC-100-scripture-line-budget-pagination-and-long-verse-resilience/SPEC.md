# SPEC-100 — Scripture Line-Budget Pagination, Typography Consistency, and Long-Verse Resilience

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-1` (`.how/_platform/ARCHITECTURE-SPINE.md:62`): Sabbath Guarantee — PPTX export is Plan A 100% fail-safe; in-browser presentation is Plan B operator convenience. Browser-side typography consistency strengthens Plan B operational legibility.
  - `AD-24` (`.how/_platform/ARCHITECTURE-SPINE.md:205`): Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It. Line budget calculations and page chunking are deterministic operator functions; room-facing projector receives authoritative formatted text and structured page metadata.
  - `AD-29` (`.how/_platform/ARCHITECTURE-SPINE.md:255`): Projector liveness protocol & BroadcastChannel isolation. Projector-to-presenter messages remain strictly liveness evidence (`projector-alive`), while presenter-to-projector messages carry authoritative presentation state under plan identity fencing (`AD-10`).
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter — Operator Console & Congregation Projector)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-13` (On-Demand Verse Lookup)
- **Components**: `presenter`
- **Touches**: `present-channel`, `scripture`

---

## Problem Statement

In whole-chapter scripture projection on a 16:9 auditorium display, the naive pagination heuristic implemented in SPEC-98 (`maxVerses = 8`, `maxChars = 900`) exhibits severe typographic inconsistency across adjacent slides:

1. **Abrupt Micro-Font Collapse on Narrative Verses**:
   - In `John 4`, page 1 (`John 4:1-8`) has short verses totaling 692 characters and wraps into ~10 lines, rendering at an elegant `4.8cqh` base size without shrinkage.
   - In contrast, page 4 (`John 4:21-27`) and page 7 (`John 4:44-50`) contain long, clause-heavy verses. In `per-verse` mode, each verse forces a hard line break, resulting in **16–17 vertical lines of text**.
   - Because the 16:9 stage height is constrained to `78cqh`, `computeScriptureFitScale` is forced to aggressively shrink the font by ~35% down to `3.3cqh`–`3.5cqh`, creating jarring visual contrast between adjacent pages.

2. **Vulnerability to Extremely Long Verses**:
   - Certain biblical verses are exceptionally long (e.g. Esther 8:9 at 528 characters, or long genealogies/proclamations).
   - Under current logic, a long verse paired with 3–4 neighboring verses explodes the vertical line count to 18–20+ lines, dragging all surrounding verses down into unreadable micro-text.

3. **Uneven Font Sizing on Short Remaining Verses**:
   - The tail page of a chapter (e.g. John 4:51-54 with 4 verses) jumps up to `6.5cqh`, while previous dense pages render at `3.5cqh`, breaking visual rhythm across a continuous reading.

---

## Solution Architecture & Core Invariants

### 1. Single-Origin Durable Passage-Level Typography State
- **Single Source of Truth**:
  - `typographyMode: 'chapter' | 'verse'` is derived **exactly once** upon passage acquisition in `PresenterOperator.tsx`:
    `const typographyMode = (data.is_whole_chapter || verses.length > 4) ? 'chapter' : 'verse'`.
  - Renderers (`ScriptureOverlayView`, `getScriptureScaling`, `ProjectorClient`) **never derive or re-classify** `typographyMode`; they are strictly consumers of the persisted property. Tail pages with <= 4 verses in a whole chapter remain locked to `typographyMode: 'chapter'`.
- **Durable State Preservation**:
  - Carried in `loadedScripture`, `ScripturePageChunk`, `ScriptureOverlay`, and `PresentMessage`.
  - Persisted in IndexedDB `scripture_cache` under `typography_mode: 'chapter' | 'verse'` and `is_whole_chapter: boolean`.
  - Legacy cache read fallback: safely derives mode if missing.
- **Styling Rules**:
  - `typographyMode: 'chapter'`: Base font **`4.8cqh`** with `line-height: 1.28` across all pages.
  - `typographyMode: 'verse'`: Responsive hero sizing for single short verse lookups (`8.5cqh`).

### 2. Conservative Segmented Line Estimation & Budget Accumulation
- **Estimator Constant**: `CHARS_PER_LINE = 60` (conservative safety factor for `4.8cqh` at `88cqw` stage content box).
- **Segmented Line Estimation**:
  - In `per-verse` mode:
    For each verse, formatted text = `(v.label || `(${v.verse}) `) + v.text`.
    Split by newline `\n`. For each segment:
    `segmentLines = Math.max(1, Math.ceil(segment.length / CHARS_PER_LINE))`.
    Total verse lines = sum of `segmentLines`. Total page lines = sum across verses.
  - In `inline` mode:
    Formatted paragraph joined by `"; "`:
    `lines = Math.max(1, Math.ceil(totalJoinedText.length / CHARS_PER_LINE))`.
    Capped at `inlineMaxSourceVerses = 12`.
- **Budgeting Boundaries**:
  - `HARD_LINES = 10` is the normal page accumulation ceiling.
  - `TARGET_LINES = 8` is the target ceiling for split long-verse fragments.
  - Accumulation: Candidate verse is added to `current` page if `totalEstimatedLines <= HARD_LINES (10)`.
  - If adding candidate causes `totalEstimatedLines > HARD_LINES`:
    - If `current` has verses: flush `current` as a completed page, start candidate on fresh page.
    - If candidate alone exceeds `HARD_LINES = 10`: isolate and split into word-boundary continuation fragments.

### 3. Both-Sides Sealed Long-Verse Isolation & Lossless Continuation Splitting
- **Both-Sides Sealed Isolation Rule (`ISOLATE_AT_CHARACTERS = 450`)**:
  - When a verse has `>= 450` characters:
    1. **Pre-flush**: Flush any accumulated prior verses immediately.
    2. **Isolate**: Place the long verse on its own slide (or continuation slides).
    3. **Post-flush**: Flush the long verse slide immediately, so subsequent verses start on a new slide.
    Neighboring verses before and after are strictly prevented from co-locating on the isolated slide.
- **Continuation Splitting (in both `per-verse` and `inline` modes)**:
  - If an isolated verse has `estimatedLines <= HARD_LINES (10)` (e.g. Esther 8:9 with 528 chars at ~9 lines):
    - Renders as an **isolated single-page slide** at base font `4.8cqh` with `isContinuation: false, continuationIndex: 1, continuationCount: 1`.
  - If an ultra-long verse has `estimatedLines > HARD_LINES (10)`:
    - Partitioned into sequential continuation fragments where each fragment (including its label) fits within `TARGET_LINES (8)`.
    - Splitting partitions exact source substrings such that `fragments.map(f => f.text).join('')` losslessly reconstructs the exact original source text. Display labels are omitted from this text reconstruction assertion.
    - Pathological token fallback: if an individual token exceeds line capacity (`> 60` chars without space), cleanly partition at character boundary with `overflow-wrap: anywhere` protection.
    - Fragment 1: `label: "(v)"`, `isContinuation: false`, `continuationIndex: 1`, `continuationCount: N`, `displayReference: "Book C:V"`.
    - Fragment k (k > 1): `label: "(v, continued)"`, `isContinuation: true`, `continuationIndex: k`, `continuationCount: N`, `displayReference: "Book C:V (continued)"`.
    - In `inline` mode, the isolated continuation fragments flow as inline paragraphs without forced newlines, maintaining exact `join('')` source text preservation.

### 4. Canonical Wire Contract & Presenter Authority
Unified authoritative `ScriptureOverlay` type in `src/lib/present-channel.ts`:
```ts
export type ScriptureOverlay = {
  reference: string;
  displayReference: string;
  text: string;
  mode: 'per-verse' | 'inline';
  verses: Array<{ verse: number; text: string; label?: string }>;
  currentPage: number;
  totalPages: number;
  typographyMode: 'chapter' | 'verse';
  isContinuation: boolean;
  continuationIndex: number;
  continuationCount: number;
};
```
- **Operator Navigation Lifecycle**:
  - Presenter operator steps through chunks via `[Next Page]` / `[Prev Page]`.
  - Active chunk immediately updates operator preview and broadcasts authoritative `ScriptureOverlay` to `ProjectorClient`.
  - Projector mounts and restores exact active chunk and typography mode upon reload (`sync.scripture`).
- **Remote Input Normalization (AD-24 Presenter Authority)**:
  - Presenter console remains the sole presentation authority; when a remote scripture intent is received, presenter normalizes it into a valid `ScriptureOverlay` before broadcast, preserving remote control without wire degradation.

### 5. Render Geometry & Container Containment Guarantee
- In `ScriptureOverlayView.tsx`:
  - `lineHeight: typographyMode === 'chapter' ? 1.28 : 1.35`.
  - `overflow-wrap: anywhere` on `data-slot="scripture-text"`.
  - `computeScriptureFitScale` enforces container safety (`maxAllowedHeight = stageHeight * 0.78`) as the authoritative physical invariant (zero clipping).
  - Conservative line budgeting (`<= 10` lines) guarantees that for all calibrated canonical fixtures (KJV & TB John 4, Esther 8:9, Psalm 23), scale remains >= `0.917` (`4.4cqh`) with adjacent-page scale delta `<= 0.08`.
  - If unexpected environmental metrics ever demand `< 0.917`, `computeScriptureFitScale` scales smoothly to maintain strict zero-clipping containment.

---

## Core Invariants

1. **Both-Sides Sealed Isolation**: An unusually long verse (>= 450 characters) flushes both before and after, guaranteeing it never shares a slide with prior or subsequent verses.
2. **Single-Origin Typography Invariant**: `typographyMode` is determined solely upon passage acquisition; renderers and chunkers never re-classify it from partial chunk verse counts.
3. **Proven Fixture Containment**: Every generated scripture page across declared KJV and TB fixtures must satisfy `scrollHeight <= clientHeight` and `scrollWidth <= clientWidth` in a 16:9 stage container (`max-h: 78cqh`).
4. **Anti-Collapse & Adjacent Consistency**: Whole-chapter presentations on KJV and TB must maintain scale >= `0.917` (`4.4cqh`) with adjacent-page scale delta `<= 0.08`.
5. **Lossless Source-Text Reconstruction**: Concatenating continuation fragment text slices `fragments.map(f => f.text).join('')` must losslessly reconstruct the original verse text without omission or token alteration in both `per-verse` and `inline` modes.
6. **Wire Contract Invariant**: All scripture broadcast and sync payloads must carry complete authoritative `ScriptureOverlay` metadata.
7. **Continuation Semantics Invariant**: `isContinuation` is strictly true only when `continuationIndex > 1`.
8. **AD-24 Screen Isolation**: Pagination and line budgeting are operator-local functions; congregation screen renders pre-formatted text.
9. **AD-29 Liveness & Identity**: Overlay messages retain strict `planIdentity` fencing across all producers.

---

## Tickets

- `SPEC-100-01`: Visual Line-Budget Pagination Algorithm & Long-Verse Isolation/Continuation
- `SPEC-100-02`: Presentation Surface Line-Budget Scaling & Scripture Overlay Continuation Rendering
