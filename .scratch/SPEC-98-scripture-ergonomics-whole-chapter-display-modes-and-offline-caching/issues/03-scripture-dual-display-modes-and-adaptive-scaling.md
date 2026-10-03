# 03: Scripture Dual Display Modes, Adaptive Scaling & Projection-Safe Pagination

**What to build:** In `src/operator/present/PresenterOperator.tsx`, `src/components/ScriptureOverlayView.tsx`, `src/lib/scripture-scaling.ts`, and `src/lib/present-channel.ts`:

1. **Dual Display Modes (Per Baris vs Digabung)**:
   - Provide two deterministic display modes for scripture passages:
     - **Mode (a) Per Baris Ayat (`'per-verse'`)**:
       Each verse rendered on a new line prefixed with its verse number in parentheses:
       `(1) When therefore the Lord knew how the Pharisees had heard...`
       `(2) (Though Jesus himself baptized not, but his disciples,)`
     - **Mode (b) Digabung (`'inline'`)**:
       Verses flow continuously as a single paragraph separated by semicolons and verse numbers:
       `(1) When therefore the Lord knew...; (2) (Though Jesus himself baptized not...`
   - Single verse deterministic rule: Always prefixed with `(verse)` matching the selected mode (e.g. `(16) For God so loved the world...`), ensuring zero ambiguity.
   - In `PresenterOperator.tsx`:
     - Add mode selector toggle in the Scripture panel with `data-testid="presenter-scripture-mode-selector"`.
     - Options: "Per baris" (`per-verse`) and "Digabung" (`inline`). Default: `per-verse`.
     - Persist selection in browser `localStorage` (`worship_deck_scripture_mode`).
     - Immediate update: Changing mode immediately updates the preview and broadcasts the re-formatted overlay if a scripture is currently active.

2. **Adaptive Proportional Scaling & Long-Passage Pagination**:
   - In `src/lib/scripture-scaling.ts`:
     - Scale calculation accounts for both verse count and total character count:
       - Single verse (< 150 chars): `8.0cqh` hero size, comfortable letter spacing, prominent reading presence.
       - Short multi-verse (2–4 verses, 150–400 chars): `5.2cqh`–`6.2cqh`, line-height `1.3`.
       - Medium passage (5–8 verses, 400–900 chars): `3.6cqh`–`4.5cqh`, line-height `1.25`.
   - **Deterministic Pagination Policy**:
     - When verse count > 8 OR character count > 900, the passage is automatically chunked into sequential pages (e.g. Page 1/6: John 4:1-9, Page 2/6: John 4:10-18):
       - Presenter operator shows page navigation controls: `[Prev Page] [Page X / Y] [Next Page]` (`data-testid="presenter-scripture-paging"`).
       - Both operator preview and projector render the current active page cleanly within the 78cqh bounding box at `3.6cqh`–`4.2cqh`.
       - In `ScriptureOverlayView.tsx`: apply `whitespace-pre-wrap` when `mode === 'per-verse'` and enforce 16:9 stage containment without text clipping.

3. **Authoritative Channel Contract & Reload Synchronization**:
   - Extend `ScriptureOverlay` in `src/lib/present-channel.ts`:
     ```ts
     export type ScriptureOverlay = {
       reference: string;
       text: string;
       mode: 'per-verse' | 'inline';
       verses: Array<{ verse: number; text: string }>;
       currentPage: number;
       totalPages: number;
       displayReference: string;
     };
     ```
   - Both `msg.type === 'scripture'` and `sync.scripture` carry this exact structure.
   - `ProjectorClient.tsx` mounts and restores the exact formatted text and page state upon reload, maintaining a single source of presentation truth.
   - Add automated integration tests in `tests/scripture-display-modes-and-scaling.test.mjs`.

**Blocked by:** SPEC-98-02

**Status:** closed

- [x] Implement mode selector in `PresenterOperator.tsx` (Per baris vs Digabung) with `localStorage` persistence.
- [x] Format verse text deterministically according to active mode in both preview and projector.
- [x] Implement long-passage pagination policy with operator page navigation controls.
- [x] Upgrade `getScriptureScaling` and `ScriptureOverlayView` with proportional formulas and 16:9 containment.
- [x] Synchronize authoritative `ScriptureOverlay` across BroadcastChannel (`scripture` and `sync`).
