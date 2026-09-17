# SPEC-31 — Initial PPTX Import and Smart Background Detection

> **Status:** Draft / Open — second-opinion review passed with all findings resolved.
> **Review:** 2026-09-15 · baseline `ed0f42a8f33e04aa56e1c77667bd92a39a566ecf` · lenses: structure, prose, edge-case-hunter.
> **Component:** hub & registry (`src/components/admin/ArtifactEditor.tsx`, `cmd/api`, `internal/httpapi`, `internal/pptximport`)
> **Touches:** artifacts, admin, api, pptx
> **Depends on:** SPEC-27, SPEC-28, SPEC-30

## 1. Problem statement

During initial church onboarding and setup, administrators may already possess a PowerPoint (`.pptx`) deck containing announcements, liturgy sequences, welcome slides, and sermon slides. Today they must recreate each slide in the Canvas Editor by adding text boxes, uploading backgrounds, and typing text.

The owner requested an **Import PPTX** capability specifically for that initial setup:

- An admin can import an entire `.pptx` presentation from the Artifact Editor.
- Every imported slide becomes an authored artifact template with `baseType: "general"`.
- The importer identifies actual slide backgrounds and puts them in `layout.backgroundImage` or `layout.backgroundColor`, rather than as draggable foreground elements.
- Editable foreground text preserves its usable geometry and basic typography.

This feature imports the first deck only; it does not infer service roles, replace an existing registry, or create specialized templates.

## 2. Decisions and invariants

### 2.1 Process and storage boundary

The importer runs in the always-on Go API as `internal/pptximport`, using Go's ZIP and XML facilities. It does not start a Node process, use JSZip, or add work to the on-demand PPTX drawing worker: AD-30 reserves that worker for drawing a finished plan and it must not open SQLite or assemble registry content.

The Go handler owns archive validation, import parsing, upload persistence, registry validation, and the one database transaction. No input from the PPTX is fetched over the network: external relationships are rejected, not followed. This keeps imported content inside the API's existing trust and durability boundary (AD-4, AD-8, AD-30).

### 2.2 Uniform `baseType: "general"`

Every imported slide MUST be inserted as an authored artifact template with:

- `baseType: "general"` in both the database row and payload;
- `schemaVersion: 1`;
- an empty `placeholders` list; and
- exactly one `layouts.default` layout.

The importer MUST NOT invent base types or assign role-specific entry keys such as `song-set`, `song-set-entry`, `announcement`, or `ann-set-marker`. Imported rows are therefore freely editable under AD-22 and are not resettable seed rows.

### 2.3 Smart background detection and layer placement

A DrawingML presentation may express a background either as a native `p:bg` fill or as a bottom-most, full-covering image shape. The importer MUST evaluate the following ordered rules for every slide.

1. **Effective native background.** Resolve the slide's `p:bg` first. When absent, resolve the related slide layout's `p:bg`; when neither contains a supported image or solid fill, the master/theme is not interpreted and the fallback in rule 4 applies. A `p:bgPr/a:blipFill` image is resolved through the relationship belonging to the part that declares it. A `p:bgPr/a:solidFill/a:srgbClr` is read as a six-digit RGB value.
2. **Bottom full-covering image.** Only when rule 1 produced no supported background, inspect the first renderable shape in the slide's source z-order. It is a background candidate only when it is `p:pic` or `p:sp` with `a:blipFill`, is at the bottom of the stack, and reaches every canvas edge within 5%: `x <= 5%`, `y <= 5%`, `x + w >= 95%`, and `y + h >= 95%`. This covers a normal full-bleed image and a small crop bleed, but rejects a large inset photograph. A candidate may not contain foreground text; otherwise it remains an ordinary foreground shape.
3. **Extracted image.** The importer resolves an embedded `r:embed` relation only. It validates the extracted bytes against the existing hub image vocabulary (`jpg`, `jpeg`, `png`, `gif`, `webp`) and writes them through the shared upload-storage helper, producing the existing random `/api/uploads/<32-hex>.<ext>` reference. This contract is intentionally not an MD5/content-addressed URL and does not claim deduplication. Unsupported embedded media (such as EMF, WMF, TIFF, or BMP) are not stored as an image reference; the importer falls back to the resolved color or black. It MUST NOT create an inline `data:` URL, an arbitrary remote URL, or a new image resolver.
4. **Resulting layout.** A detected image becomes `layout.backgroundImage`; a detected solid fill becomes `layout.backgroundColor` as uppercase `#RRGGBB`; and the corresponding covering shape is omitted from `layout.elements`. `backgroundColor` is always present. If no supported image or explicit six-digit RGB fill is available, it is `#000000`. Theme/scheme colors, pattern fills, gradients, and master-only decoration are not interpreted in this initial import.

A native `p:bg` wins over a covering shape. Content shapes, including a covering image that fails any candidate condition, retain their source z-order and remain editable elements. This avoids both false positives (a large inset photograph is not made a background) and false negatives (a native layout `p:bg` or an image with small crop bleed is recognized).

### 2.4 16:9 coordinate normalization

The registry canvas is fixed to the `REFERENCE_CANVAS` 16:9 coordinate system (`960 × 540`). The importer reads `p:presentation/p:sldSz` in EMUs and accepts a deck only when `width / height` is 16:9 within 0.1%; it rejects other aspect ratios rather than silently stretching a 4:3 deck into the registry canvas.

For accepted decks, all foreground geometries are stored as percentages:

$$x\% = \frac{x_{emu}}{slideWidth_{emu}} \times 100$$
$$y\% = \frac{y_{emu}}{slideHeight_{emu}} \times 100$$
$$w\% = \frac{w_{emu}}{slideWidth_{emu}} \times 100$$
$$h\% = \frac{h_{emu}}{slideHeight_{emu}} \times 100$$

Each value is rounded to four decimal places. Values are not clamped: intentional source-deck clipping may be negative or exceed 100%, consistent with the renderer contract.

DrawingML font sizes use hundredths of a point (`sz="4000"` is 40 pt). Because the Go API cannot import the TypeScript module, it computes the same canonical ratio from the 16:9 reference dimensions rather than introducing a divergent conversion:

$$fontSizePx = \frac{sz / 100 \times 540}{405} = \frac{sz / 100}{PX\_TO\_PT}$$

`render-model.ts` defines `PX_TO_PT` as `405 / 540` (`0.75`). A focused cross-boundary conformance test MUST assert that the Go import formula and the renderer's `PX_TO_PT` conversion produce the same result for representative point sizes, so the two implementations cannot silently drift.

### 2.5 Text and foreground extraction

For every non-background foreground shape containing `p:txBody`, the importer creates an editable `text` element with source z-order, percentage geometry, and these mappings when present:

- Paragraphs (`a:p`) produce newline-separated text; `a:br` produces a soft line break within the paragraph.
- Run text comes from `a:r/a:t`; text directly in `a:fld` or `a:endParaRPr` does not invent content.
- Font face comes from `a:rPr/a:latin/@typeface`; it is normalized through the existing registry font catalog/fallback path, not a new hard-coded catalog.
- RGB color comes from `a:solidFill/a:srgbClr/@val` as uppercase `#RRGGBB`; unsupported scheme/theme colors use the renderer default rather than a guessed color.
- `b="1"`, `i="1"`, and `u="sng"` map to the existing bold, italic, and underline style fields.
- Paragraph alignment maps `l` to `left`, `ctr` to `center`, and `r` to `right`; unsupported alignment uses the existing default.
- `a:lnSpc/a:spcPct` and `a:lnSpc/a:spcPts`, when valid, map to a positive CSS `lineHeight`; otherwise the renderer's normal default applies.

The initial import supports editable text, images that are not classified as backgrounds, and simple shapes only when their geometry/style can be represented by the current `CanvasElement` schema. Unsupported SmartArt, charts, tables, grouped transforms, WordArt effects, animations, speaker notes, and unsupported fills are omitted with a per-slide warning. They must never abort a valid whole-deck import merely because their individual feature is unsupported.

### 2.6 Archive, media, and request hardening

The import endpoint is `POST /api/admin/artifacts/import-pptx` and accepts one multipart `file` field. The endpoint is inside the existing `/api/admin` gate and the handler also calls `requireAdmin`; the gate yields `401` for an unauthenticated API request and an authenticated non-admin receives `403`.

The uploaded name and MIME type are advisory only. Before parsing, the server MUST:

- require a readable ZIP containing the minimum OOXML presentation parts (`[Content_Types].xml`, `ppt/presentation.xml`, and at least one slide relationship);
- reject a compressed upload over 100 MiB;
- reject a deck with more than 200 slides;
- enforce a 32 MiB uncompressed maximum for an individual entry and a 250 MiB running total while inflating entries, rather than trusting ZIP metadata alone;
- reject absolute, drive-qualified, backslash-qualified, or `..` ZIP entry paths;
- parse XML without DTD or external entity resolution;
- resolve only package-local relationship targets and reject an `External` relationship target; and
- enforce the existing image allowlist and a 16 MiB maximum for every extracted image before persistence.

The importer stages validated upload bytes outside their final names, creates all authored template payloads, and validates every payload through the same `ValidateArtifactTemplate` path as ordinary registry writes (AD-15). It then appends the imported rows in source slide order inside one SQLite transaction. A malformed or unrepresentable slide that violates the registry schema fails the entire import: no template rows are committed. Final upload files are published only when the transaction can complete; any failure rolls back rows and removes staged or newly published files best-effort. No persisted template may reference a missing upload.

The response is `201` only when the whole deck succeeds and returns the ordered created template summaries plus the first template. It returns a generic `{ "error": string }` on failure and logs internal detail server-side. The imported local upload references are admitted only through the existing shared safety helpers; no PPTX relationship can cause server-side request forgery.

### 2.7 Admin interaction in `ArtifactEditor`

- The Artifact Editor toolbar has an **Import PPTX** control alongside the authored-template controls.
- Selecting it opens a file picker restricted to `.pptx`; client-side validation is only a convenience and does not replace server validation.
- While the request runs, the UI displays progress based on server-reported parse/import stages (for example, “Importing slide 3 of 25”) and disables a duplicate submission.
- On `201`, the list is refreshed, the first imported template is loaded into the canvas, and it is clean (`isDirty: false`) with the server-issued `updatedAt` token.
- On failure, no imported template is selected, the pre-import editor state remains intact, and the server's safe error is shown.

## 3. Acceptance criteria

1. **Import entry point.** The Artifact Editor exposes an Import PPTX control that selects a `.pptx` file and sends it to the admin-only multipart endpoint.
2. **General base type.** Every created row and payload has `baseType: "general"`, an empty placeholder list, one `default` layout, and an authored (non-resettable) origin.
3. **Native background detection.** A slide `p:bg` image or `p:bg` solid RGB fill, including one declared by its related slide layout, becomes `backgroundImage` or `backgroundColor` before the shape heuristic is considered.
4. **Covering-shape background detection.** A bottom-most image-filled `p:pic`/`p:sp` that reaches all four edges within 5% becomes `backgroundImage` and is absent from `elements`; an inset photograph, a non-bottom image, or an image with foreground text remains an element.
5. **Layer parity.** Imported foreground text renders above the imported background in the Canvas Editor without duplicate background imagery or element-stack occlusion.
6. **Coordinate and typography fidelity.** A 16:9 deck maps EMU geometry to four-decimal percentages without clamping and maps font size through `PX_TO_PT`; a non-16:9 deck is rejected rather than distorted. Paragraph newlines, soft line breaks, basic font style, alignment, and RGB color are retained where the source uses supported primitives.
7. **Transactional outcome.** A successful deck creates all slides in source order and selects the first; a malformed XML part, registry validation failure, or file-publication failure leaves neither partial template rows nor references to missing uploads.
8. **Archive and media hardening.** Tests cover invalid ZIP/OOXML, compressed and expanded-size limits, traversal-like entry names, external relationships, non-image or oversized media, and unsupported media types. No importer code fetches an external URL.
9. **Authorization and cache conformance.** An unauthenticated request receives `401`; an authenticated non-admin receives `403`; both responses retain the gate's `Cache-Control: private, no-store` and `Vary: Cookie` behavior.
10. **Absence guards.** Automated guards prove that a classified background never reaches `elements`. Each claimed detection path is independently proven red by injecting the defect into (a) native `p:bg` handling and (b) the covering-shape handling, then reverting each injected defect.
11. **Privacy.** Fixtures use only synthetic deck content and never commit congregation names, photographs, payment details, source decks, or rendered output.

## 4. Work breakdown

- **Phase 1 — Go parser and background engine:** Add `internal/pptximport` with bounded ZIP/XML parsing, relationship resolution, 16:9 admission, native/covering-shape background detection, and foreground text extraction.
- **Phase 2 — API, uploads, and atomic registry write:** Add the gated multipart endpoint; use the existing shared upload persistence and image-reference validation contract; stage/publish media and append validated authored templates atomically.
- **Phase 3 — Artifact Editor integration:** Add the import control, progress/error behavior, list refresh, first-template selection, and clean concurrency state.
- **Phase 4 — automated and manual proof:** Add parser, archive-hardening, authorization, transactional, and two-form absence-guard tests. Perform the named human smoke test using a synthetic 16:9 deck with a native background, a full-bleed covering image, an inset photo, and multiline editable text.
