# SPEC-31-01 — Go Parser and Smart Background Engine

**Status:** closed
**Blocked by:** none

## What to build

In `internal/pptximport`, implement bounded OOXML presentation parsing and smart background detection using Go stdlib `archive/zip` and `encoding/xml`.

1. **ZIP archive and part validation**: Require a valid ZIP package containing `[Content_Types].xml`, `ppt/presentation.xml`, and slide relationship mappings. Enforce limits: max 100 MiB compressed, max 200 slides, max 32 MiB per entry, max 250 MiB uncompressed total. Reject paths with `..`, absolute paths, drive letters, or backslashes.
2. **16:9 coordinate admission & normalization**: Read `p:presentation/p:sldSz`. Require 16:9 ratio within 0.1%; reject non-16:9 decks. Map EMU coordinates to four-decimal percentages ($x\%, y\%, w\%, h\%$). Map DrawingML hundredths-of-a-point font size (`sz="4000"` = 40pt) to CSS pixels using the canonical ratio $sz / 100 / 0.75$.
3. **Smart background detection**:
   - Rule 1 (Native background): Inspect slide `p:bg`. If absent, inspect slide layout `p:bg`. Resolve `p:bgPr/a:blipFill` image via relationships or `p:bgPr/a:solidFill/a:srgbClr` as `#RRGGBB`.
   - Rule 2 (Bottom covering image): If no native background, check the bottom-most shape in source z-order. If it is `p:pic` or `p:sp` with `a:blipFill` without foreground text, and reaches all 4 edges within 5% ($x \le 5\%$, $y \le 5\%$, $x+w \ge 95\%$, $y+h \ge 95\%$), classify it as background.
   - Omit the detected covering shape from `elements`.
4. **Foreground text and shape extraction**: For non-background shapes with `p:txBody`, extract `text` elements with paragraphs (`a:p`), runs (`a:r/a:t`), soft breaks (`a:br`), font typeface (`a:latin/@typeface`), color (`#RRGGBB`), bold, italic, underline, alignment (`left`/`center`/`right`), and line height.
5. **Uniform template creation**: Return authored templates with `baseType: "general"`, `schemaVersion: 1`, empty placeholders, and single `layouts.default`.

## Acceptance criteria

- 16:9 presentations are accepted and normalized; non-16:9 presentations are rejected with a clear error.
- Native slide `p:bg` and layout `p:bg` are resolved to `backgroundImage` or `backgroundColor`.
- Bottom full-covering images ($\ge 95\%$ coverage) become `backgroundImage` and are omitted from `elements`.
- Inset photographs, non-bottom images, or shapes with text remain foreground elements.
- Extracted text preserves paragraphs, soft breaks, formatting (bold/italic/underline), alignment, and font sizes.
- Uncompressed and compressed ZIP size bounds, path traversal safety, and local relationship constraints are strictly enforced.
