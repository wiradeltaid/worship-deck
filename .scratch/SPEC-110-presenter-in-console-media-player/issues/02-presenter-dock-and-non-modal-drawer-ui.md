# SPEC-110-02 — Presenter Dock and Non-Modal Preparation Drawer UI

**Satisfies:** [UC-12, UC-28, FR-16, FR-33]
**Blocked by:** [SPEC-110-01]
**Status:** closed

## Summary
Integrate the Two-Tier Media Player interface into `PresenterOperator.tsx`: a header launcher button, a persistent bottom grid dock with instant panic controls, and a non-modal slide-over drawer for playlist preparation.

## Key Responsibilities
1. **`MediaLauncherButton.tsx`**:
   - Header button situated alongside existing control rows, displaying icon and item count badge.
2. **`MediaDock.tsx`**:
   - Permanent 48–56px grid row spanning the console base when media is loaded.
   - Panic group on far left: Play/Pause, Fade (3s), Mute, Take off screen.
   - Seekbar updating on pointer release (`pointerup`).
   - Remains visible after track finishes until explicit dismissal (■ Stop & Tutup) to prevent disruptive layout shifts while clicking slides.
   - Invariant: Retains panic functionality even under presentation lock.
3. **`MediaDrawer.tsx`**:
   - Non-modal slide-over drawer positioned exclusively over the right column.
   - No backdrop; clicking slides outside drawer does not close it.
   - Reorderable playlist with audio/video badges, delete button, and video preview stage.
   - Multi-file uploader filtering for supported browser media types (`.mp3/.wav/.m4a/.ogg/.mp4/.webm`) with an explicit 500 MiB per file cap.
4. **Keyboard & Focus Safety**:
   - Transport buttons apply `onMouseDown={(e) => e.preventDefault()}` (precedent from `HymnNumberAutocomplete.tsx` and `ScriptureRefAutocomplete.tsx`) to prevent button focus retention so global `Space` reliably advances slides.

## Acceptance Criteria
- Clicking outside the open drawer allows normal slide navigation without closing the drawer.
- Engaging presentation lock still permits 1-click Pause, Fade, and Mute.
- Closing the drawer while media plays does not interrupt or restart playback.
- Pressing `Space` with any dock control recently clicked advances the slide and does not toggle playback.
