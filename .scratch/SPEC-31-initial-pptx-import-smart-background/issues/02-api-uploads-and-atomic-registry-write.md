# SPEC-31-02 — API Uploads and Atomic Registry Write

**Status:** closed
**Blocked by:** 01

## What to build

In `internal/httpapi`, implement the HTTP endpoint `POST /api/admin/artifacts/import-pptx` to process PPTX imports, persist extracted images, and commit templates atomically.

1. **Authentication & Authorization**: Gated behind `requireAdmin` / `/api/admin/artifacts/*`. Returns `401` for unauthenticated requests and `403` for non-admin requests, with `Cache-Control: private, no-store` and `Vary: Cookie`.
2. **Multipart file upload handling**: Accept multipart `file` field. Enforce 100 MiB limit on upload stream.
3. **Media persistence**: For each extracted background image, validate bytes against image allowlist (`jpg`, `jpeg`, `png`, `gif`, `webp`, max 16 MiB), stage outside final destination, and write to `/api/uploads/<32-hex>.<ext>`.
4. **Registry validation & atomic transaction**:
   - Validate every authored template through `ValidateArtifactTemplate` (`internal/plan`).
   - If any slide fails validation or image extraction fails, abort the entire import, roll back the transaction, and clean up staged/published files.
   - Commit all imported templates inside a single SQLite database transaction in source slide order.
5. **API Response**: On success, return `201 Created` with JSON containing `{ importedCount: number, templates: ArtifactTemplateSummary[], firstTemplate: ArtifactTemplate }`. On failure, return safe generic `{ error: string }` with server-side logging.

## Acceptance criteria

- `POST /api/admin/artifacts/import-pptx` requires admin session; unauthenticated returns `401`, non-admin returns `403`.
- Valid PPTX imports create templates with `baseType: "general"` in one atomic transaction.
- Extracted images are safely validated and saved in `/api/uploads/`.
- Failure at any slide (invalid XML, validation failure, media error) commits zero templates and leaves no dangling files or orphaned records.
- Successful response returns `201` with created template summaries and the first template.
