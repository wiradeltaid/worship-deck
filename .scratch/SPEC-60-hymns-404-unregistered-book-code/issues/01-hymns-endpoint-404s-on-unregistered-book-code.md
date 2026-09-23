# 01: GET /api/hymns 404s when book_code names no registered Song Book

**What to build:** `.how/hub/02-contracts/05-hymns.md` promises: *"`book_code` not registered in
`song_books` at all → 404 `Song book not found`."* The live handler (`internal/httpapi/hymns.go`,
`getHymns`) never checks this — `db.ResolveSongBook` (`internal/db/bootstrap.go`) just upper-cases
whatever code was passed with no existence check, so an unrecognised `book_code` (a typo, or a code
from a Song Book that was never installed) silently returns `200 { "hymns": [] }` instead of the
documented 404. This is a low-severity gap (no data exposure, no privacy impact) but it means a
client can't tell "this book has no hymns yet" apart from "this book_code doesn't exist" — the
distinction the 404 exists to make.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/httpapi/hymns.go`'s `getHymns` and `internal/db/bootstrap.go`'s `ResolveSongBook`.
      Extracted shared helper `SongBookExists(db *sql.DB, code string) bool` in `internal/db`.
- [x] When `book_code` or `bookCode` is explicitly provided in query params and non-empty, checks existence
      using `SongBookExists` before resolving book code. If not found, returns `404` with `"Song book not found"`.
- [x] `GET /api/hymns?book_code=<value>` where `<value>` matches a registered Song Book with 0 hymns returns
      `200 { "hymns": [] }` without returning 404.
- [x] Verified existing callers and queries remain fully functional.
- [x] Verified edge case: when `book_code` is omitted, default resolution succeeds with 200 without requiring 404.
