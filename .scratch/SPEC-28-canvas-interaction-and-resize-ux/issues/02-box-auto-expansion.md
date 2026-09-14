# 02: Bounding Box Auto-Expansion on Font Size Increase

**What to build:** Automatically adjust text bounding box height in reference-canvas coordinates when font size is increased in the editor toolbar across single and multi-selection, ensuring the text renders immediately at full visual scale without requiring manual handle dragging, with persistence flags properly set.

**Blocked by:** 01 (Complete Ghosting Elimination on Fabric Text Proxy)

**Status:** closed

- [x] In `handleFontSizeCommit`, compute the minimum required box height in reference-canvas coordinates (`minTextHeightRefPx = fontSizePx * effectiveLineHeight`) for each active text object.
- [x] If the current box height is smaller than `pxToPct(minTextHeightRefPx, CANVAS_HEIGHT)`, automatically expand `h` to the required single-line minimum, update Fabric `height`, and set persistence flags (`userResizedHeight = true`, `authoredHeight = minTextHeightRefPx`).
- [x] Ensure decreasing font size does not shrink a previously enlarged bounding box.
- [x] Sync the expanded dimensions to `liveElements` and `canvas` in real time.
- [x] Add automated smoke test verifying that increasing font size on a tight box automatically heightens the box, saves correctly, and retains full visual font scale.
