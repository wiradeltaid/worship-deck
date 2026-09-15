# SPEC-36-03 — ECMA-376 Standard PPTX Font Obfuscation, Variant Slot Embedding, and Microsoft PowerPoint Conformance Verification

**Status:** open
**Blocked by:** SPEC-36-02

## What to build

Fix PPTX font embedding to achieve strict conformance with the ECMA-376 / ISO/IEC 29500-2 OpenXML font obfuscation standard, ensuring that presentations exported from Worship Presenter open cleanly in Microsoft PowerPoint Desktop with embedded fonts loaded and rendered without fallback drift.

1. **ECMA-376 Part 2 §8.5.2 Font Obfuscation Implementation:**
   - In `src/lib/fonts/embed-fonts.ts`:
     - Derive the font usage set from exported text runs as `{ family, weight, style }` triples rather than bare `family` strings.
     - Generate a valid UUID for each embedded font part (e.g. `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`).
     - Derive the 16-byte XOR key from the UUID according to ECMA-376 Part 2 §8.5.2 (reversing bytes in components 1, 2, and 3, matching `ParseObfuscationKey` in `internal/pptximport/font_extract.go`).
     - Obfuscate the font binary: XOR the first 32 bytes of the font with the 16-byte key (repeated twice), keeping original font buffers immutable.
     - Store the obfuscated font in the ZIP archive at `ppt/fonts/<UUID>.odttf`.
     - In `[Content_Types].xml`, register the standard OpenXML MIME type:
       `<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>`
       (replacing the non-compliant `application/x-fontdata`).

2. **Font Family Variant Slot Mapping in PresentationML:**
   - In `ppt/presentation.xml`:
     - Group embedded font faces by family into a single `<p:embeddedFont>` element.
     - Inject specific variant relationship references matching the resolved font faces:
       - Regular: `<p:regular r:id="..."/>`
       - Bold: `<p:bold r:id="..."/>`
       - Italic: `<p:italic r:id="..."/>`
       - Bold Italic: `<p:boldItalic r:id="..."/>`
     - Register the corresponding relationship entries in `ppt/_rels/presentation.xml.rels`.
     - Ensure `<p:embeddedFontLst>` is inserted in strict schema-compliant sequence within `<p:presentation>` (after `<p:notesSz>` and before `<p:defaultTextStyle>`).

3. **Google Fonts TTF Fetch Reliability:**
   - In `getFontData`:
     - Acquire and validate a static SFNT face for requested Google Fonts variants prior to export, caching only after validation. Never treat WOFF2 responses as TTF binaries.
     - If a font is unavailable offline or restricted, fallback cleanly to declared PowerPoint substitute with a visible warning; deck generation must never fail.

4. **Executable Conformance Tests & Proofs:**
   - Update `tests/smoke-spec-27.test.mjs` and add comprehensive tests in `tests/smoke-spec-36.test.mjs`:
     - Assert that embedded font parts in exported PPTX archives use `<UUID>.odttf` filenames and have their first 32 bytes properly obfuscated.
     - Assert that `[Content_Types].xml` specifies `application/vnd.openxmlformats-officedocument.obfuscatedFont`.
     - Assert that presentations with bold custom text declare `<p:bold>` in `<p:embeddedFont>`.
     - De-obfuscate the exported font using `internal/pptximport.ValidateAndDeobfuscateFont` in a Go integration test to verify round-trip integrity.
     - Add deterministic manual PowerPoint Desktop smoke procedure with uninstalled custom fonts on Windows host to verify no font substitution occurs.

## Acceptance criteria

- Exported PPTX archives contain font parts under `ppt/fonts/{GUID}.fntdata` with ECMA-376 standard obfuscation.
- `[Content_Types].xml` declares `application/vnd.openxmlformats-officedocument.obfuscatedFont`.
- `<p:embeddedFont>` accurately declares `<p:regular>`, `<p:bold>`, `<p:italic>`, and `<p:boldItalic>` according to used variants.
- The exported presentation opens in Microsoft PowerPoint Desktop with embedded fonts active and recognized without fallback.
- Round-trip deobfuscation test passes cleanly.
