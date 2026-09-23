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

**Status:** ready-for-agent

- [ ] Read `internal/httpapi/hymns.go`'s `getHymns` and `internal/db/bootstrap.go`'s
      `ResolveSongBook` in full first. Extract a shared helper `SongBookExists(db *sql.DB, code string) bool`
      in `internal/db` (reusable also by `song_books.go`'s inline existence queries) to check whether an
      explicit code is registered in `song_books`.
- [ ] When `book_code` or `bookCode` is explicitly provided in the query params and non-empty, check its
      existence using `SongBookExists` BEFORE calling `ResolveSongBook`. If it does not match any row in
      `song_books`, return `404` with the documented `Song book not found` message.
- [ ] `GET /api/hymns?book_code=<value>` where `<value>` matches a registered Song Book, but that
      book currently has zero hymn rows, still returns `200 { "hymns": [] }` — an empty result for a
      real book must not become a 404. State the test for this explicitly, since it is the case a
      naive "no rows means not found" fix would break.
- [ ] Every existing caller of this endpoint (SPA hymn lookup, `HymnNumberAutocomplete.tsx`, `CreateForm.tsx`,
      `EditForm.tsx`) keeps working for every currently-installed Song Book — this is a new rejection path,
      not a behavior change for any code path that already resolves successfully today. (Note: webhook
      handler was verified to not call `/api/hymns`).
- [ ] **Edge case confirmed by peer review, must not regress:** when `book_code` is omitted and
      `song_books` has no `is_default = 1` row yet (e.g. a fresh database before `upsertHymns` has
      seeded anything), `ResolveSongBook` falls through to a hardcoded `SDAH` constant that, in that
      exact state, is not yet a real row in `song_books`. The new existence check must not 404 this
      no-`book_code`-given default-resolution path — it should apply to an explicitly-supplied,
      unrecognised `book_code` only. State the test for this fresh-DB case explicitly.
