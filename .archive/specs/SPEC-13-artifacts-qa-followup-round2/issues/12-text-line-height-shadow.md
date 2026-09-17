# 12: Text line-height and text-shadow controls

**What to build:** Two new icon-only text controls next to the existing font size/color/underline/
bold/italic/align row: a line-height (leading) control and a text-shadow toggle. Both apply to the
selected text element in realtime, and both persist through Save.

**Blocked by:** 11

**Status:** open

- [ ] Ordinary implementation work, no debugging pass needed — the realtime-apply pattern to follow
      already exists (`applyTextStyle`, `handleFontColorChange`, `handleToggleBold` in
      `ArtifactEditor.tsx`).
- [ ] Closes `BUG-22`: add the line-height control (a slider is one acceptable shape, not mandated)
      and the text-shadow toggle, icon-only, wired the same way Bold/Italic/Underline already are —
      a direct `obj.set(...)` + `canvas.requestRenderAll()` + `markDirty()` on change, not a
      state-only update (the exact mistake `BUG-4`/`BUG-5` were).
- [ ] Extend `allowedStyleKeys` in `internal/plan/validate_artifact.go` with whatever style keys
      these two controls write, and extend the render paths (PPTX, slideshow) to draw them —
      following `BUG-10`'s precedent for `textDecoration` exactly (allowlist AND render path, not
      only one).
- [ ] Define multi-selection behaviour explicitly: either extend the bulk `applyTextStyle`
      (`{ fill, fontSize, underline }`) set to include `lineHeight`/`textShadow` so "Apply to
      selection" covers the new controls too, or state plainly that these two are single-selection
      only — do not ship a control that silently no-ops (or only affects the last-focused element)
      under multi-selection with no stated limitation.
- [ ] Define the Presenter Mode render gap explicitly: this SPEC's Out of Scope already excludes
      `Presenter`, so a text styled with line-height/shadow will render correctly in the canvas
      editor, PPTX, and web slideshow but NOT in Presenter Mode. State this as an accepted, known
      limitation (not a silent gap) — extending Presenter's render path is out of scope for this
      ticket, per the SPEC's own scope boundary.
- [ ] Both new controls are seen doing nothing against current code (no line-height/shadow
      controls exist yet) before the fix, then applying correctly and surviving a Save/reload after.
