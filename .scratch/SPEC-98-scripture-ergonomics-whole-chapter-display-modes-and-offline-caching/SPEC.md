# SPEC-98 — Scripture Ergonomics, Whole Chapter Lookup, Dual Display Modes, and Offline Caching

## Requirement Traceability & Scope
- **PRD**: `operator-turn`, `offline-deck`
- **Architectural Decisions**:
  - `AD-1` (`.how/_platform/ARCHITECTURE-SPINE.md:37`): Sabbath Guarantee — PPTX export is Plan A 100% fail-safe; in-browser presentation is Plan B operator convenience. Browser-side scripture caching is an elevation of Plan B operational resilience, not a replacement of Plan A.
  - `AD-24` (`.how/_platform/ARCHITECTURE-SPINE.md:205`): Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It. Operator controls (mode selector, chapter navigation, clear button) are strictly browser-local in `PresenterOperator.tsx`; projected surface (`ProjectorClient.tsx`) receives pre-formatted content and structured metadata.
  - `AD-29` (`.how/_platform/ARCHITECTURE-SPINE.md:255`): Projector liveness protocol & BroadcastChannel isolation. Synchronizes scripture overlay state (`type: 'scripture'`, `type: 'clear-scripture'`) and mount-time reload synchronization (`sync.scripture`) with plan identity fencing.
- **Functional Requirements**:
  - `FR-14` (Offline Presentation Guarantee — Plan B browser presentation resilience enhancement)
  - `FR-16` (Two-Screen Presenter — Operator Console & Congregation Projector)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-13` (On-Demand Verse Lookup)
  - `UC-18` (Offline Presentation Deck Guarantee — Plan B browser cache extension)
  - `UC-22` (Projector Dual-Screen Display)
- **Components**: `presenter`, `hub`
- **Touches**: `present-channel`, `scripture`, `services`

---

## Problem Statement

During live liturgical rehearsals and auditorium operations, the on-demand scripture projection workflow in `PresenterOperator.tsx` and `ProjectorClient.tsx` has five operational limitations:

1. **Ergonomic Control Disconnection (Clear Scripture)**:
   - The *Clear Scripture* button is currently located in header row 1 (`presenter-header-row-1`) beside *Blank Screen* and live transition select (`PresenterOperator.tsx:1760-1770`), isolated from the scripture panel in the right sidebar.
   - Operators pushing verses on-demand must constantly shift focus between the sidebar input and the top navigation bar to clear an overlay, increasing cognitive load and misclick risk during live sermons.

2. **Rigid Reference Syntax (Lack of Whole-Chapter Lookup)**:
   - Reference parsing (`src/lib/scripture.ts:parseScriptureRef` and `internal/scripture/match.go:ParseRef`) strictly requires a colon (`:`) separating chapter and verse range (e.g. `John 4:1-10`).
   - Typing whole chapter references like `John 4`, `Yohanes 4`, `Mazmur 23`, or `1 Korintus 13` fails immediately with a validation error, preventing pastors or operators from opening an entire chapter on demand.

3. **Inflexible Typography & Multi-Verse Pagination Absence**:
   - `getScriptureScaling` (`src/lib/scripture-scaling.ts`) relies purely on crude character length thresholds (`<60`, `<120`, `<200`, `>200`).
   - Single short verses are constrained to a fixed tier rather than prominent, elegant hero display, while multi-verse passages or full chapters shrink abruptly.
   - For extensive passages (e.g. John 4 with 54 verses, ~10,000 characters), naive shrink-to-fit shrinks font size down to unreadable text, violating readability requirements. A deterministic projection-safe pagination policy is required.

4. **Monolithic Unformatted Text (Missing Display Modes)**:
   - Multiple verses are returned and rendered as raw text joined with single spaces (`strings.Join(texts, " ")` in `internal/httpapi/scripture.go:184`), stripping verse identity.
   - Operators cannot choose between:
     - **Mode (a) Per Baris Ayat**: Line-by-line verse blocks (`(1) Verse text...\n(2) Next verse...`) for responsive responsorial reading.
     - **Mode (b) Digabung**: Continuous flowing paragraphs with inline verse numbers (`(1) Verse text...; (2) Next verse...`) for narrative flow.

5. **Network-Bound Vulnerability in Offline Presentation**:
   - While `SPEC-84` implemented auto-warming for slides and media assets in IndexedDB, scripture lookups remain bound to runtime HTTP `fetch('/api/scripture?ref=...')`.
   - If church Wi-Fi or LAN drops during a service, any impromptu scripture lookup fails immediately (`t('presenter.scripture.lookupFailed')`), violating `FR-14` / `FR-16` operator resilience expectations.

---

## Solution Architecture & Core Invariants

### 1. Unified Operator Scripture Action Cluster
- Reposition `t('presenter.clearScripture')` from `presenter-header-row-1` into the Scripture Lookup panel in the right sidebar, directly adjacent to the `[Push to congregation screen]` button.
- Group both buttons in a shared action flex container (`data-testid="presenter-scripture-actions"`):
  - Primary button: `[Push to congregation screen]` (`onClick={pushScripture}`).
  - Secondary button: `[Clear Scripture]` (`variant="outline"`, always accessible as an idempotent emergency clear action).
- Remove the orphaned clear button from header row 1, keeping session-level screen blanking cleanly isolated.

### 2. Whole-Chapter Reference Parsing & Structured Data Contract
- Upgrade `ParseRef` (`internal/scripture/match.go`) and `parseScriptureRef` (`src/lib/scripture.ts`):
  - Support pattern `<BookName> <Chapter>` without colon (e.g. `John 4`, `Yohanes 4`, `1 Korintus 13`, `2 Tawarikh 7`, `Mazmur 23`).
  - Flag whole chapter queries (`isWholeChapter: true`).
  - Preserve full backward compatibility for existing colon-based ranges (`Book C:V` and `Book C:V-V`).
- Backend query update (`internal/httpapi/scripture.go` and `src/lib/scripture.ts:lookupScripture`):
  - When whole-chapter is requested, query all verses in the chapter:
    `SELECT verse, verse_text FROM bible_verses WHERE book_id = ? AND chapter = ? AND translation_code = ? ORDER BY verse ASC`.
  - Format canonical reference as `<Book> <Chapter>` (e.g. `John 4`).
  - Return structured payload:
    ```json
    {
      "reference": "John 4",
      "chapter": 4,
      "is_whole_chapter": true,
      "verses": [
        { "verse": 1, "text": "When therefore the Lord knew..." },
        { "verse": 2, "text": "Though Jesus himself baptized not..." }
      ],
      "text": "(1) When therefore... \n(2) Though Jesus...",
      "translation": "KJV"
    }
    ```

### 3. Dual Display Modes, Adaptive Scaling & Projection-Safe Pagination
- Unified Display Mode Definition:
  - **Mode (a) Per Baris Ayat (`'per-verse'`)**: Every verse is prefixed with `(verse)` and separated by newlines:
    `(1) Verse text...\n(2) Next verse...`
  - **Mode (b) Digabung (`'inline'`)**: Verses flow continuously separated by semicolons and verse numbers:
    `(1) Verse text...; (2) Next verse...`
  - Single-verse deterministic rule: Always prefixed with `(verse)` according to the chosen mode (e.g. `(16) For God so loved...`), ensuring zero ambiguity.
- Mode Selector & Persistence:
  - Radio/segmented toggle in `PresenterOperator.tsx` (`data-testid="presenter-scripture-mode-selector"`).
  - Persisted in browser `localStorage` as an operator-local preference under `AD-24`.
  - Changing mode immediately updates the preview and broadcasts the re-formatted overlay if a scripture is currently active.
- Adaptive Scaling & Pagination Policy for Long Passages:
  - Sizing brackets:
    - 1 verse: prominent hero size (`7.5cqh`–`8.5cqh`, line-height `1.35`).
    - 2–4 verses: comfortable reading (`5.2cqh`–`6.2cqh`, line-height `1.3`).
    - 5–8 verses: dense readable tier (`3.6cqh`–`4.5cqh`, line-height `1.25`).
  - Strict pagination threshold: When verse count > 8 OR character count > 900, the passage is automatically chunked into sequential pages (e.g. Page 1/6: John 4:1-9, Page 2/6: John 4:10-18):
    - Presenter operator shows page navigation controls `[Prev Page] [Page X / Y] [Next Page]`.
    - Both operator preview and projector render the current active page cleanly within the 78cqh bounding box at `3.6cqh`–`4.2cqh`, eliminating micro-text font collapse.
- End-to-End Channel Synchronization (`present-channel.ts`):
  - Authoritative `ScriptureOverlay` type:
    ```ts
    export type ScriptureOverlay = {
      reference: string;
      text: string;
      mode: 'per-verse' | 'inline';
      verses: Array<{ verse: number; text: string }>;
      currentPage: number;
      totalPages: number;
      displayReference: string; // e.g. "John 4 (1-9)" on multi-page
    };
    ```
  - Both `msg.type === 'scripture'` and `sync.scripture` carry this exact structure, ensuring projector reloads restore identical formatting and pagination.

### 4. Authoritative Offline Pre-Cache & Fail-Closed Resilience
- Pre-Cache Extraction Contract in `warmServiceSnapshot` (`src/lib/offline/service-snapshot.ts`):
  - Scan canonical service data: `field_values.scripture_reference`, `field_values.theme_verse`, `parsed_data.theme_verse`, `parsed_data.verse_reading`.
  - Translation resolution: use service's configured translation or system resolved default.
  - Canonical cache key: `${translation}:${canonicalBookId}:${chapter}:${verseStart}:${verseEnd}` (or `${translation}:${canonicalBookId}:${chapter}:ALL` for whole chapter).
  - Readiness tracking: extend `OfflineReadiness` with `scriptures?: { total: number; cached: number; failed: number }`.
- IndexedDB Store (`scripture_cache` in `worship_deck_offline_db` v3):
  - Key path: `cache_key`.
  - Stores canonical passage payload with timestamp.
- Fail-Closed Fallback Semantics (Preserving `SCN-4`):
  - Online 200: cache result in IndexedDB, display immediately.
  - Network Failure / `TypeError: Failed to fetch` / Server 5xx: check `scripture_cache`:
    - Cache Hit: render passage with calm toast (`"Ditampilkan dari cache offline"`).
    - Cache Miss: fail closed with `t('presenter.scripture.lookupFailed')`.
  - 400 Bad Request / 404 Not Found: **fail closed immediately** (never fallback to cache or substitute another verse).

---

## Core Invariants

1. **Fail-Closed Aspect Containment**: All scripture rendering (whether 1 verse or multi-page chapter) MUST remain strictly contained within the 16:9 stage area without horizontal overflow, pillarbox deformation, or text bleeding outside the screen bounds.
2. **AD-24 Screen Isolation**: Mode selectors, page navigation buttons, and clear controls MUST exist solely on the operator console (`PresenterOperator.tsx`) and MUST NOT render on the congregation projector window (`ProjectorClient.tsx`).
3. **AD-1 Plan B Offline Resilience**: Pre-warmed service scriptures and previously cached passages MUST be 100% accessible and projectable when offline.
4. **Deterministic Single Source of Presentation Truth**: The operator console formats the passage text and page chunk, transmitting both canonical text and structured metadata so `ProjectorClient` renders identically without layout divergence.
5. **Idempotent BroadcastChannel Protocol**: `clear-scripture` and `scripture` messages must retain `planIdentity` validation to prevent cross-service overlay contamination.

---

## Tickets

- `SPEC-98-01`: Clear Scripture Button Repositioning & Ergonomics
- `SPEC-98-02`: Whole Chapter Reference Parsing & Backend/Client Data Parity
- `SPEC-98-03`: Dual Display Modes, Adaptive Scaling & Projection-Safe Pagination
- `SPEC-98-04`: Authoritative Offline Scripture Pre-Cache & Fail-Closed Resilience
