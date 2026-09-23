# 01: syncPush rejects a request body over 50MB, matching syncAssetUpload

**What to build:** Read `SPEC.md` in this spec folder first. `POST /api/sync/push`
(`internal/httpapi/sync.go`, `syncPush`) currently decodes `r.Body` directly with no size limit,
unlike its sibling `POST /api/sync/assets` (`internal/httpapi/sync_assets.go`, `syncAssetUpload`),
which wraps the body in `http.MaxBytesReader(w, r.Body, 50<<20)`. This ticket closes that gap on the
server side only — chunking the client's own payload is ticket 02.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `internal/httpapi/sync.go`'s `syncPush` and `internal/httpapi/sync_assets.go`'s
      `syncAssetUpload` in full first, to match the exact cap value and error response shape.
- [ ] `syncPush` wraps `r.Body` in `http.MaxBytesReader(w, r.Body, 50<<20)` before
      `json.NewDecoder(...).Decode(...)`, exactly as `syncAssetUpload` already does for its own body.
- [ ] **`json.NewDecoder(...).Decode(...)`'s error path currently maps every decode failure to a
      generic `"Invalid request body"` (`internal/httpapi/sync.go:121`) — a `MaxBytesReader` trip alone
      will land there too, not at a distinct message (confirmed by peer review).** Detect the
      oversized-body case specifically (check the decode error against `*http.MaxBytesError`, or read
      via `http.MaxBytesReader` into a buffer first rather than decoding directly from it) and return
      the same message `syncAssetUpload` already uses ("Failed to read upload body or file too large")
      only for that case; an unrelated malformed-JSON body keeps returning `"Invalid request body"`.
      State a test for each of the two distinct error paths.
- [ ] A push request at or under 50MB is entirely unaffected — every existing test that pushes a
      normal-sized payload keeps passing unchanged.
- [ ] The cap applies before the idempotency check and before the transaction begins (`BEGIN
      IMMEDIATE`) — an oversized request must not open a transaction it will never complete.
