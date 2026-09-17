# SPEC-36 — Font Import UX, Variant Association, and PPTX Microsoft OpenXML Embedding Parity

> **Status:** Draft / Open — second-opinion review passed with edits applied.
> **Review:** 2026-09-15 · baseline `e57144795bc99ec6859e218206d2ba6a1c5d9472` · lenses: structure, prose, edge-case-hunter.
> **Component:** registry, hub, pptx (`src/components/admin/ArtifactEditor.tsx`, `src/lib/registry/font-catalog.ts`, `src/lib/fonts/embed-fonts.ts`, `internal/httpapi/fonts.go`, `internal/pptximport/font_extract.go`)
> **Touches:** artifacts, pptx, admin, typography
> **Depends on:** SPEC-35

## 1. Problem statement

Operators need to import custom font files repeatedly, including a family split across static faces such as `Youngest-Regular.ttf`, `Youngest-Bold.ttf`, `Youngest-Italic.ttf`, and `Youngest-BoldItalic.ttf`. Today, the only upload control is the selected-element-only **Acquire Font** action. An uploaded face can also be ambiguous or overwritten in the runtime catalog rather than being associated with its family and CSS descriptors.

The current PPTX exporter writes raw font bytes to `ppt/fonts/fontN.fntdata`, declares `application/x-fontdata`, and creates one `<p:regular>` relationship for each family. PowerPoint Desktop can therefore substitute a system font. The current Google Fonts path requests a browser stylesheet, then searches only for `.ttf` URLs; a modern response can contain only WOFF2, so the exporter silently embeds nothing.

## 2. Decisions and invariants

### 2.1 Repeatable custom-font import

- Provide a reusable **Import Font** action in the Font Family popover and an equivalent toolbar launcher. It is available on every editable canvas, with or without a selected text element.
- One hidden input and one upload handler accept a multi-file selection of `.ttf` and `.otf` files. The handler must reset the input after every completed or cancelled selection so the same file can be imported again.
- Upload each selected file with per-file success or failure feedback. A partial batch remains useful: successful faces register immediately, failed filenames and reasons remain visible, and no request freezes the editor.
- Importing a complete family must not repeatedly change the active element. If the successful files resolve to one family, apply that family once to the text selection that existed when the batch began; otherwise leave the selection unchanged and report the imported families.
- Add the `custom` category at the top of the picker. It contains each uploaded family once, shows its available static-face badges, and becomes selectable as soon as all successful `FontFace.load()` calls complete.
- The existing **Acquire Font** flow remains. It reuses this upload handler, pre-associates the selected unresolved typeface, and does not become the only import path.

### 2.2 Face identity, association, and browser matching

- A face identity is `(family, weight, style)`, with a trimmed, case-insensitive family key; `weight` is a valid CSS numeric weight and `style` is `normal` or `italic`. Family names come from the typographic-family name (name IDs 16/17, falling back to 1/2), not from a filename. The stored source typeface remains available for diagnostics.
- Parse static SFNT metadata, including name data and `OS/2` weight/embedding flags. Support `.ttf` and `.otf` static faces. Reject TTC/OTC and variable-font uploads with a precise error until axis selection has its own contract.
- A client-supplied family may group a face only after normalization and explicit confirmation; it never changes that face's detected weight or style. Reject malformed or empty overrides.
- Add a case-insensitive unique database constraint/index for `(family, weight, style)`. Re-uploading the same content for the same identity is idempotent. A different binary for an existing identity returns a conflict that explicitly offers replacement; replacement is transactional, preserves the old file until the database update commits, removes the old browser face, and then registers the new immutable URL. The same content hash must not silently attach to a different identity.
- `getFontManifest()` returns every imported face, not one entry per family. The frontend maintains a custom-family definition with its complete variant list and registers each face with `new FontFace(family, url, { weight, style })`. Registration must be keyed by face identity and URL, not family alone, so a replacement actually refreshes the browser face.
- Browser preview follows normal CSS font matching. The PPTX path uses the same resolved face data, rather than inferring a face from a family string. PowerPoint has only `regular`, `bold`, `italic`, and `boldItalic` slots: CSS weights without an exact 400/700 counterpart use a documented nearest-face policy and display an export warning rather than promising exact parity.
- Respect `OS/2 fsType` embedding restrictions. A restricted face can remain available in the editor, but the exporter must not embed it and must name its PowerPoint substitute or missing-face warning before export.

### 2.3 Standards-conformant PPTX packaging

- Derive the font usage set from every exported text run as `{ family, weight, style }`; the current `Iterable<string>` family-only contract is insufficient to choose a variant slot.
- For each embeddable resolved face, generate a unique UUID, use its canonical hexadecimal form in `ppt/fonts/<UUID>.odttf`, and derive the 16-byte key with the same component-byte ordering as `ParseObfuscationKey`. XOR the first 32 bytes, repeating the key twice. Preserve the original font buffer; do not mutate it before another use.
- Register exactly one `odttf` default in `[Content_Types].xml` with `application/vnd.openxmlformats-officedocument.obfuscatedFont`. Do not emit a font part with the legacy `application/x-fontdata` type.
- Create a unique font relationship for each emitted face. Escape XML typeface values and merge with any existing `<p:embeddedFontLst>` by family, producing at most one `<p:embeddedFont>` element per family. Populate only the slots represented by resolved faces: `<p:regular>`, `<p:bold>`, `<p:italic>`, and `<p:boldItalic>`. Insert the list in the schema sequence after `p:notesSz` and before `p:defaultTextStyle`.
- Google Fonts acquisition is not an export-time guarantee. Acquire and validate a static SFNT face for each requested variant before export, cache it only after validation, and never treat a WOFF/WOFF2 stylesheet result as an embeddable TTF. If the face is unavailable offline, export with the declared substitute and a visible warning; no network failure may fail deck generation.

### 2.4 Verification and unchanged invariants

- Add backend tests for metadata-derived family/weight/style, same-family distinct-face insertion, identity conflict/replacement, content-hash mismatch, malformed/variable/embedding-restricted inputs, and complete manifest output.
- Add frontend tests for multi-face registration, replacement refresh, custom category ordering, badges, repeated picker activation, batch partial failure, and the one-family-only selection rule.
- Add archive tests that inspect an exported deck: UUID `.odttf` parts; independently de-obfuscated first 32 bytes; the standard content type; unique relationships; one family block; and each expected variant slot. Pair every new absence guard with defect injection and a confirmed red result before restoring the implementation.
- Add a deterministic PowerPoint Desktop smoke procedure on Windows with the custom family absent from the host: open the generated deck, verify no substitution warning and each supported quartet face in the Font Substitution dialog. Automated tests prove package structure and round-trip de-obfuscation; they do not by themselves prove Microsoft PowerPoint rendering.
- System fonts (Arial, Calibri, Times New Roman, and similar) continue to bypass embedding. `LAYOUT_WIDE` (960 pt × 540 pt), character spacing, and `PX_TO_PT = 1.0` remain unchanged.

## 3. Tickets

- **SPEC-36-01:** Font Import UX and reusable multi-file upload flow.
- **SPEC-36-02:** Font family and static-face association across SQLite, browser `FontFace`, and export manifest.
- **SPEC-36-03:** ECMA-376 font obfuscation, OpenXML face-slot packaging, and executable plus PowerPoint Desktop conformance proof.
