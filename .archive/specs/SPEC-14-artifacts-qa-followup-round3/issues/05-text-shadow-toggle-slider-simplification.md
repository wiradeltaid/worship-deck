# 05: Text shadow toggle and conditional slider simplification (BUG-22 refinement / SPEC-13-12)

**What to build:** Simplify the text shadow controls on the Text Properties row in `ArtifactEditor.tsx` (~L2518-2527):
- Position the shadow toggle button immediately to the left of the shadow slider.
- Replace the Sparkles icon on the toggle button with a shadow glyph or letter 'S' (with shadow effect) to clearly represent text shadow.
- Conditionally display the shadow slider ONLY when text shadow is active (toggle ON).
- Do NOT alter or remove the line-height controls (keep `MoveVertical` and line-height slider intact).

**Blocked by:** none

**Status:** open

**Done when:**
- The text shadow toggle button sits immediately to the left of its shadow slider.
- The toggle button icon visually reflects text shadow (shadow glyph or stylized 'S').
- The shadow slider is hidden when shadow toggle is OFF, and visible when shadow toggle is ON.
- Line-height controls remain untouched and fully functional.
- Text shadow toggle state and slider values continue to update Fabric text objects in real time and persist upon save.

### Implementation Steps

- [ ] In `src/components/admin/ArtifactEditor.tsx` (~L2517-2527), locate the text shadow toggle button:
  ```tsx
  <Button
    type="button"
    variant={textShadow ? 'default' : 'outline'}
    size="icon-sm"
    onClick={handleToggleTextShadow}
    disabled={busy}
    title="Text Shadow"
  >
    <Sparkles className="w-3.5 h-3.5" />
  </Button>
  ```
- [ ] Replace `Sparkles` with a shadow-specific icon or a styled typography 'S' glyph (`<span className="font-bold text-xs drop-shadow">S</span>` or suitable Lucide icon).
- [ ] Ensure the shadow toggle button is placed directly to the left of its adjustment slider.
- [ ] Conditionally render the shadow adjustment slider: `{textShadow && ( <input type="range" min={0} max={20} step={1} value={shadowBlur} onChange={...} className="w-14 h-3 accent-primary cursor-pointer" title={`Shadow Blur: ${shadowBlur}`} /> )}` so that it only occupies space when shadow is toggled ON. The slider controls shadow blur/softness (range 0..20, default 4) and applies to `fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: shadowBlur, offsetX: 2, offsetY: 2 })` in real time.
- [ ] Maintain the existing line-height controls (`MoveVertical` button and line-height range slider at ~L2491-2516) untouched.
- [ ] Add regression tests in `tests/artifact-editor-controls.test.mjs` verifying that:
  - The shadow toggle button switches shadow state ON/OFF.
  - The shadow slider is conditionally rendered only when `textShadow` is true.
  - Line-height controls remain mounted and operative.
