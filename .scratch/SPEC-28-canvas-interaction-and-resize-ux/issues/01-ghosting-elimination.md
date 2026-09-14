# 01: Complete Ghosting Elimination on Fabric Text Proxy

**What to build:** Enforce 100% non-visual behavior on Fabric text proxy objects across all editor operations (mount, font color change, text style commit, selection sync) to eliminate duplicate ghost text rendering over the DOM slide.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] In `ArtifactEditor.tsx`, audit all text manipulation paths (`handleFontColorChange`, `applyTextStyle`, `handleFontSizeCommit`, `handleFontFamilyChange`, `handleToggleTextShadow`, `handleShadowBlurChange`) to ensure `fill` on Fabric Textbox is always `'transparent'` and `shadow` is `null`.
- [ ] Store font color and text styling attributes in `obj.data` so serialization and toolbar selection read them without ever setting an opaque fill or shadow on the Fabric canvas.
- [ ] Add automated smoke test asserting that changing font color, style, or shadow leaves Fabric text object non-visual.
