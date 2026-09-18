# Advisory Second Opinion — SPEC-40

## Verdict
accept-with-changes

The draft captures the requested operator outcomes well, especially category renaming, colocated upload controls, visible selected state, custom names, and in-place replacement. However, its replacement and caching semantics currently permit the exact broken-reference outcome the raw notes seek to eliminate.

## Findings

1. **[blocking] Replacement with a different extension may change the asset URL, violating the primary requirement.**
   SPEC.md and ticket 01 permit a replacement with another extension to update `background_library_images.url` while keeping only the record ID. The raw notes require retaining the existing ID/slug/path specifically so already-linked deck and template references continue working.
   *Required change:* define a single invariant: every successful replacement preserves the stored URL path. Specify how different-extension input is handled—such as rejection with a clear validation error or safe conversion to the existing stored format—rather than changing the URL.

2. **[blocking] The proposed caching approach does not ensure that connected views update immediately.**
   Ticket 01 proposes `Cache-Control: public, max-age=3600, must-revalidate`; a browser may legitimately retain the old image for up to an hour before revalidation. Ticket 02 appends a timestamp only to the gallery-card thumbnail, not to existing artifact, deck, projector, or presenter references. The current upload response is `public, max-age=31536000, immutable`, so the change is necessary but the proposed replacement remains insufficient for the stated outcome.
   *Required change:* define and test cache freshness for every relevant consumer of the unchanged URL. The contract must use a response strategy that forces or reliably permits immediate revalidation, and must state the expected behavior for the browser slideshow, projector/presenter view, and PPTX generation worker.

3. **[blocking] The replace endpoint contract is underspecified for a destructive filesystem operation.**
   Ticket 01 says the handler may accept multipart upload “or JSON URL,” but does not define one authoritative request shape, validation path, maximum size, supported formats, failure cleanup, concurrency behavior, or an atomic-write strategy. It also does not state whether replacement requires the current `updatedAt` token, although normal PATCH uses optimistic concurrency.
   *Required change:* specify one supported replacement input contract and reuse the established upload validation/authorization rules. Define that an invalid upload, a failed write, a missing record, or a concurrent replacement cannot leave the existing bytes, DB row, and URL reference inconsistent. Include authorization, malformed/non-image input, missing ID, write failure, and concurrent-update test cases.

4. **[blocking] Category transition language is internally ambiguous.**
   Ticket 01 says categories are “validated strictly” to `general`, `background`, and `announcement`, while also accepting legacy `flyer` input as an alias. Those are different API contracts. It also needs an explicit guarantee that all list responses are canonicalized to `announcement`, including records that predate or bypass the migration.
   *Required change:* state the transitional contract precisely: whether `flyer` is accepted temporarily, rejected, or normalized; whether it is ever emitted; and how the migration is made idempotent and verified. The canonical public/UI value must be `announcement`.

5. **[non-blocking] Custom-name defaults are inconsistent with the stated fallback behavior.**
   The draft says an optional custom name defaults either to empty or to a sanitized source filename, while ticket 02 says cards fall back to `Media #<id>` when empty. These alternatives yield materially different operator-visible behavior.
   *Required change:* choose one default. The least surprising match to the raw notes and stated fallback is an empty stored name unless the operator supplies one.

6. **[non-blocking] The test plan does not yet prove all promised non-regression paths.**
   Ticket 03 calls for an absence guard, but does not identify the defect forms to inject. It also says a template should automatically display the replacement without changing payload, but lacks a concrete fixture and assertion proving that the stored template/deck reference remains unchanged while its fetched render source changes.
   *Required change:* enumerate the negative-control mutations and prove each causes the relevant test failure before reverting. Add fixtures covering same-path replacement, unchanged artifact/deck payload, category migration, failed replacement rollback, and cache freshness. “Search and identify assets by title” should not be claimed unless name-based search is added; the listed UI work currently provides display only.

## Stamp Recommendation
- **Recommended lenses:** `edge-case-hunter` (required), API-contract/security review, data-migration review, cache-consistency review, UX/accessibility review, and negative-test/absence-guard review.
- **Readiness for trace stamping:** Ready after incorporating the blocking feedback.
