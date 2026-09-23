# 01: syncPush rejects a request body over 50MB, matching syncAssetUpload

**What to build:** Read `SPEC.md` in this spec folder first. `POST /api/sync/push`
(`internal/httpapi/sync.go`, `syncPush`) currently decodes `r.Body` directly with no size limit,
unlike its sibling `POST /api/sync/assets` (`internal/httpapi/sync_assets.go`, `syncAssetUpload`),
which wraps the body in `http.MaxBytesReader(w, r.Body, 50<<20)`. This ticket closes that gap on the
server side only — chunking the client's own payload is ticket 02.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/httpapi/sync.go`'s `syncPush` and `internal/httpapi/sync_assets.go`'s
      `syncAssetUpload` in full.
- [x] `syncPush` wraps `r.Body` in `http.MaxBytesReader(w, r.Body, 50<<20)` before decoding.
- [x] Detected oversized body using `errors.As(err, &maxErr)` on `*http.MaxBytesError` returning
      `"Failed to read upload body or file too large"` with status 400, while malformed JSON keeps
      returning `"Invalid request body"`. Both paths tested in `TestSyncPush_BodyCapAndErrorFormatting`.
- [x] Push requests under 50MB continue to pass unchanged.
- [x] Cap is enforced before idempotency check and before `BEGIN IMMEDIATE`.
