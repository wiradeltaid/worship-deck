# SPEC-32 — PPTX Import Typography Parity, Embedded Font Adoption, and Letter Spacing

> **Status:** Draft / Open — second-opinion review passed with all findings resolved.
> **Review:** 2026-09-15 · baseline `454ff518547895b67c0b747cc4072641bb924d5b` · lenses: structure, prose, edge-case-hunter.
> **Component:** hub, registry, pptx (`internal/pptximport`, `internal/httpapi`, `internal/plan`, `src/lib/registry/font-catalog.ts`, `src/lib/registry/canvas-utils.ts`, `src/components/artifacts/ArtifactSlide.tsx`, `src/components/admin/ArtifactEditor.tsx`, `src/lib/pptx-draw.ts`)
> **Touches:** artifacts, admin, pptx, api, uploads
> **Depends on:** SPEC-31

## 1. Problem statement

SPEC-31 introduced initial whole-deck PPTX import, but typical church decks still lose their typography when imported:

1. DrawingML typeface values often contain a weight/style variant (`Montserrat Bold`, `Montserrat Light`, `Montserrat Black`, `Montserrat Bold Italics`). Exact catalog lookup then fails and currently collapses the face to Arial.
2. A PPTX can contain embedded font faces under `ppt/fonts/*.fntdata`. They are not imported today, and a custom face therefore cannot survive a browser refresh or reach a generated PPTX.
3. DrawingML character spacing (`a:rPr/@spc`, hundredths of a point) is not represented by the artifact schema, DOM presenter, Fabric editor, toolbar, or PPTX output.

The feature promises close parity for a **uniformly styled text element** whose imported typeface can be resolved to a browser-usable local font face. It does not promise pixel-identical glyph metrics across PowerPoint, Fabric, and browser layout; mixed inline-run typography remains outside the current one-style-per-element schema and must produce an import warning rather than being silently claimed as faithful.

## 2. Decisions and invariants

### 2.1 Effective text style and variant normalization

The importer derives one effective style from the first effective run property source it supports: a run property (`a:rPr`), then the paragraph default (`a:defRPr`) or end-paragraph property when no run property exists. A text element with materially different run typefaces, weights, styles, or `spc` values is imported using that first effective style and reports a slide warning naming the unsupported mixed-run condition.

Typeface normalization is token-based and right-to-left. It removes only a complete, recognized suffix sequence, preferring longest matches (`Bold Italic`, `Semi Bold`, `Extra Bold`, `Bold`, `Light`, `Black`, `Medium`, `Thin`, `Heavy`, `Italic`, `Italics`, `Oblique`, and their documented hyphen/space forms). It must not strip an arbitrary final word, alter an unrecognized family, or turn an empty result into a family name. `Regular`, `Roman`, and `Book` mean normal only when they are a complete recognized terminal variant.

The normalized result carries all of the following values:

- `fontFamily`: the canonical CSS family, for example `Montserrat`;
- `fontWeight`: the exact supported CSS weight (`100` through `900`, `normal`, or `bold`), not a boolean approximation;
- `fontStyle`: `normal`, `italic`, or `oblique`; and
- `pptxTypeface`: the trimmed original DrawingML face, retained solely for PPTX output where an arbitrary face such as `Montserrat Light` cannot be represented by DrawingML's boolean bold flag.

Explicit `a:rPr/@b` and `@i` override the suffix's bold and italic decisions. The importer may infer `fontWeight` and `fontStyle` only from the suffix when the corresponding explicit attribute is absent. A source `a:rPr` with no `spc` leaves `letterSpacing` undefined.

Changing the font family, weight, or style in the editor clears `pptxTypeface`; it is source-deck metadata, not a stale override of a later author decision. The DOM and Fabric layers render the numeric `fontWeight` directly. The PPTX renderer uses `pptxTypeface` when present and otherwise the selected `fontFamily`; it must not reduce 300/900 to 400/700.

### 2.2 Durable embedded-font catalogue and safe delivery

An imported font is a durable font-face record, not an ephemeral value returned only by the import response. The API persists a registry-owned record with the canonical CSS family, source typeface, weight, style, immutable local asset identifier, and validated format. Artifact loading exposes the current face catalogue, and the SPA hydrates it before rendering an imported template; refresh, a second administrator session, and presenter mode must therefore retain the same registration.

The isolated Node PPTX worker remains database-free (AD-30). The API resolves the face records needed by a completed plan and includes an explicit, local font-asset manifest in the worker JSON. The worker may read only those validated local assets and embeds the selected faces without fetching Google Fonts or any other network resource.

For every `<p:embeddedFont>` in `ppt/presentation.xml`, the importer resolves only its local relationship from `ppt/_rels/presentation.xml.rels`. It records each declared regular, bold, italic, and bold-italic face separately; a family is not registered as one undifferentiated regular face. It never follows an external relationship.

`*.fntdata` is a container name, not proof of a web-usable font. The importer must:

1. resolve the relationship with `ResolveSafeTarget(..., "ppt/fonts/")`, reject traversal, duplicate/ambiguous references, missing targets, and unsupported font relationship types;
2. apply the existing 100 MiB compressed archive, 32 MiB entry, and 250 MiB total-uncompressed limits, plus 16 MiB per font and 64 MiB cumulative accepted-font bytes;
3. de-obfuscate an Office font only when the package metadata provides an unambiguous standard key; otherwise skip it with a slide/import warning;
4. validate the resulting bounded stream as a structurally valid TTF, OpenType, WOFF, or WOFF2 font, including table/offset bounds and parsed family/face metadata. A magic header alone is insufficient;
5. accept only a parsed family compatible with the declared family after normalization, reject malformed or mismatched data, and never transcode an unsupported EOT/other proprietary stream; and
6. stage assets with private random names, promote them atomically with the templates and font records, and delete every promoted asset if either the database transaction or promotion fails.

Font assets use a dedicated, allow-listed API route and storage vocabulary, not `/api/uploads/`: that existing route intentionally accepts and serves only image extensions. The font route validates an opaque 32-hex asset id, returns the exact font MIME type, sets `X-Content-Type-Options: nosniff`, and may be cacheable only because the identifier is immutable. It must not reveal source archive paths.

The SPA registers a face with the `FontFace` API (or equivalently safe CSSOM APIs), never by string-concatenating an untrusted family into a `<style>` rule. It validates/escapes the family, treats the local URL as opaque, sets the recorded `weight` and `style`, awaits `font.load()`, adds the face to `document.fonts`, and de-duplicates registration by family/weight/style/asset id. A rejected face leaves its named CSS family in the stack with its semantic generic fallback and surfaces a non-sensitive import warning; it does not crash Canvas or the presenter.

Font embedding permissions are respected: fonts absent from the package, malformed, non-embeddable, or not usable by the browser are not claimed as adopted. No new external font request is introduced by import, registration, or worker embedding.

### 2.3 Font stacks and catalog behavior

`getFontStack` continues to prefer an exact, case-insensitive curated catalog match, including a normalized base family. For any uncatalogued valid family it preserves the requested family as the first quoted stack member instead of replacing it with Arial:

- known/declared script faces: `"<family>", cursive, sans-serif`;
- known/declared serif faces: `"<family>", Georgia, serif`;
- all other faces: `"<family>", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

A fallback category is metadata from either the curated catalogue or the parsed imported face. Name heuristics alone must not relabel an arbitrary uncatalogued family as script or serif. The catalog may add a known script face such as `The Youngest`, but catalog expansion is not a substitute for importing a face file. Family strings are preserved as data and safely escaped at CSS boundaries.

### 2.4 Character-spacing model and exact conversion

DrawingML `a:rPr/@spc` is signed hundredths of a point:

$$\text{spcPt} = \frac{\text{spc}}{100}$$

At the 16:9 reference canvas, `PX_TO_PT = 0.75`; therefore the schema stores CSS-reference pixels:

$$\text{letterSpacingPx} = \frac{\text{spcPt}}{0.75} = \frac{\text{spc}}{75}$$

For Fabric, `charSpacing` is thousandths of an em:

$$\text{charSpacing} = \frac{\text{letterSpacingPx}}{\text{fontSizePx}} \times 1000 = \frac{\text{spc}}{\text{sz}} \times 1000$$

The calculation uses the element's unscaled canonical `fontSize`; scaling a Fabric object must not mutate the canonical `letterSpacing`. Serialization performs the inverse against the current canonical font size and preserves finite values, including `0` and negative tracking.

`TextStyle` gains `letterSpacing?: number` and `pptxTypeface?: string`. The registry validator accepts only finite `letterSpacing` values. The DOM applies an explicit `${letterSpacing}px` whenever the value is finite, including `0`; an absent field means normal browser spacing. Fabric receives the corresponding `charSpacing` and serializes it back without treating `0` as absent.

PptxGenJS has no relied-on public character-spacing contract in this repository. Export therefore performs a deterministic OOXML post-process over the text runs generated for each affected artifact element and sets `a:rPr/@spc` to:

$$\text{spc} = \operatorname{round}(\text{letterSpacingPx} \times 75)$$

The association between a rendered element and its generated shape/runs must be explicit and tested; a broad XML replacement is forbidden. Undefined or exactly zero spacing omits `spc`. For an imported integral `spc`, import followed by immediate export must reproduce the same integer exactly, including `1`, `-1`, and large positive/negative representative values. The former “less than 1%” criterion is insufficient around zero and is replaced by this exact property.

The toolbar provides a numeric letter-spacing control with a 0.5 px authoring step. It must display and preserve any finite imported value even when outside its convenient authoring range; a UI clamp must never silently alter an imported value on save.

### 2.5 Parity boundary

This SPEC preserves source face selection where a usable font is available, normalized style metadata, reference-canvas tracking, authored text-box geometry, and the existing shrink/wrap policy. It does not promise identical line breaks or glyph positions among PowerPoint, Fabric, and browsers, because their shaping engines differ. A missing/rejected font degrades through the semantic stack and reports a warning; it never silently becomes a successful imported face.

## 3. Acceptance criteria

1. Token-based normalization correctly handles `Montserrat Bold`, `Montserrat Light`, `Montserrat Black`, `Montserrat Bold Italics`, compound/hyphenated suffix forms, explicit `b`/`i` precedence, a family whose last word is not a recognized suffix, and no effective run properties.
2. Numeric imported weights remain numeric in DOM/Fabric rendering. PPTX output uses the retained original `pptxTypeface` for non-boolean source variants and clears that field after a relevant editor change.
3. The importer parses signed `spc` and stores `letterSpacing = spc / 75`; `1267` produces `16.893333…` px and `-456` produces `-6.08` px. Absence remains undefined.
4. Fabric `charSpacing` and canonical `letterSpacing` round-trip at positive, zero, and negative values without scaling-induced mutation. DOM, editor preview, presenter, and projector apply the same finite CSS value.
5. Each usable embedded regular/bold/italic/bold-italic face is parsed, persisted atomically, served only by the dedicated font route, rehydrated after a page reload, and registered once with its exact weight/style. Invalid, oversized, obfuscated-without-key, malformed, mismatched, external, traversal, or unsupported streams are rejected or skipped safely with no partial database/assets.
6. An uncatalogued family remains first in its CSS stack with metadata-driven semantic fallback; no unknown-family path returns an unconditional Arial stack. A locally installed or imported face can therefore win before its generic fallback.
7. The completed API plan supplies local validated font assets to the database-free worker. Exported PPTX output preserves selected imported faces without any worker network request.
8. Immediate import/export preserves every tested integral `spc` exactly in generated OOXML. Undefined/zero spacing emits no `spc`; post-processing changes only runs belonging to an element carrying non-zero `letterSpacing`.
9. Tests use a synthetic PPTX and synthetic valid/invalid font fixtures only. A human side-by-side PowerPoint smoke procedure records the environment, face-load result, and known shaping differences; it is evidence of visual fidelity, not a claim that source/XML scans are visual proof.
10. Each new absence guard is proved red against the actual production path before reverting: the Arial-collapse guard, a font-route traversal/unsafe stream guard, zero/absent `spc` leakage, and the OOXML element-association guard. The focused Go and Node suites, affected regressions, public-repository guard, and full `npm test` pass.

## 4. Revised vertical work breakdown

- **SPEC-32-01 — Import typography contract:** Add effective-style extraction, safe right-to-left normalization, `spc` parsing, `pptxTypeface`, and one-style mixed-run warnings. Register schema/validator parity across Go and TypeScript. It includes importer fixture tests.
- **SPEC-32-02 — Durable imported font faces:** Add safe per-face extraction/de-obfuscation/validation, atomic dedicated font storage and records, a metadata endpoint, SPA `FontFace` hydration, and plan manifest handoff to the isolated worker. It includes rollback, reload, relationship, and no-network tests.
- **SPEC-32-03 — Tracking and weight parity:** Carry finite `letterSpacing` and numeric weights through DOM, Fabric, editor state, toolbar, and deterministic PPTX OOXML post-processing. It includes exact `spc` import/export and source-change invalidation tests.
- **SPEC-32-04 — Production-path proof:** Add the registered synthetic import-to-render-to-export smoke suite, test the required rejected/missing branches and red-then-green absence proofs, and document the conditional human PowerPoint comparison. It must not be a substitute for tests in the three implementation slices.
