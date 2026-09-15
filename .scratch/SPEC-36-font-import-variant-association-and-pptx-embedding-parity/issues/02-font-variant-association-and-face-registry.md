# SPEC-36-02 — Font Family & Variant Association (Regular, Bold, Italic) across Backend, Database, and Browser FontFace

**Status:** open
**Blocked by:** SPEC-36-01

## What to build

Implement robust font family grouping and variant association so that font files representing different styles of the same family (e.g. `Youngest-Regular.ttf`, `Youngest-Bold.ttf`, `Youngest-Italic.ttf`, `Youngest-BoldItalic.ttf`) share a single `fontFamily` in the catalog while correctly mapping their respective `weight` and `style` descriptors.

1. **Automatic Variant Detection and Safety Guards in Go Backend:**
   - In `internal/httpapi/fonts.go`:
     - Utilize SFNT `name` and `OS/2` table parsing (`ParseSFNTMetadata`) to extract canonical typographic `Family` (IDs 16/17 falling back to 1/2) and detect style variants:
       - Regular: `weight: "normal"`, `style: "normal"`
       - Bold: `weight: "700"`, `style: "normal"`
       - Italic: `weight: "normal"`, `style: "italic"`
       - Bold Italic: `weight: "700"`, `style: "italic"`
     - Reject TTC/OTC font collections and variable fonts with descriptive errors until multi-axis contracts are defined.
     - Inspect `OS/2 fsType` embedding flags; flag restricted fonts so they can be rendered in the browser editor but excluded from PPTX embedding with a visible substitute warning.
     - Maintain a unique database constraint on `(family, weight, style)`. Identical content uploads are idempotent. Different content for an existing identity returns a conflict allowing explicit replacement.
   - Update `s.getFontManifest()` to return all registered font face variants with their `family`, `weight`, `style`, and `path`.

2. **Frontend Multi-Face Registration & Variant Indicators:**
   - In `src/lib/registry/font-catalog.ts`:
     - Key dynamic face registration by `(family, weight, style, url)` rather than family alone, ensuring replacements actively refresh the browser face.
     - Update `registerDynamicFontFace(face)` so multiple faces can be added under the same family name with different `weight` and `style` descriptors in `document.fonts.add(new FontFace(family, url, descriptors))`.
     - In the catalog item `FontDefinition`, track available variants (e.g. `variants: ['regular', 'bold']`).
     - In `ArtifactEditor.tsx`:
       - Show variant badges in the font picker dropdown item (e.g. `Youngest [R, B]`).
       - When the operator selects "Youngest" and toggles Bold (`fontWeight === 'bold'`), the browser's CSS font matching naturally renders the authentic Bold TrueType face instead of artificial faux-bold distortion.

3. **Absence Guards & Unit Tests:**
   - Add Go tests in `internal/httpapi/fonts_test.go` verifying that uploading two variants of the same family creates distinct database entries sharing the same family name.
   - Add frontend unit tests verifying that multiple `FontFace` instances register under the same family without overwriting each other.

## Acceptance criteria

- Uploading `Youngest-Regular.ttf` and `Youngest-Bold.ttf` registers both faces under the single family `"Youngest"` in SQLite and browser `document.fonts`.
- Toggling the Bold button in the editor toolbar renders the true Bold font face rather than synthetic faux-bold.
- The font catalog displays available variants for each custom font family.
- `go test ./internal/httpapi` passes with variant association coverage.
