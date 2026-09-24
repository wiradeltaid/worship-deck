# 02: Retire legacy parser profiles and song set matching algorithms across backend, client libraries, and corpus

**What to build:** With macro parser profiles and legacy 3-pass song matching completely retired from both operator service forms (SPEC-69) and the administrative sandbox (Ticket 01), clean up and retire the underlying legacy code across the backend, client libraries, and corpus. Retire `/api/parser-profiles` and `/api/admin/parser-profiles...` HTTP endpoints in `internal/httpapi/server.go` and `parser_profiles.go`. In `internal/parse/`, retire `song_set_matching.go` (`MatchSongSets`) and decouple `ParseRundown` from `LoadDefaultParserProfile(db)` so fallback rundown parsing uses a permanent static internal parser (`StaticDefaultParser`) supporting standard date, section, and hymn book resolution (SDAH). Ensure incoming `parserProfileId` in service payloads is handled gracefully as optional/ignored. In `src/lib/`, clean up legacy profile structures in `song-set-matching.ts`, `parser-rules.ts`, and `parser.ts`. In the corpus, formally document UC-30 / FR-36 as retired in favor of UC-31 across `usecases.yaml`, `SRS-hub.md`, `SDD-hub.md`, and `09-rundown-parser-profiles.md`. Run the entire test suite ensuring zero regressions.

**Blocked by:** 01 (retire-sandbox-parser-profile-and-song-overflow — implementation sequencing constraint to ensure frontend UI cleanups land before backend endpoints and legacy helper libraries are removed).

**Status:** closed

- [x] Read `internal/httpapi/server.go`, `internal/httpapi/parser_profiles.go`, `internal/parse/parser.go`, and `internal/parse/song_set_matching.go` in full.
- [x] In `internal/httpapi/`:
      (1) Remove `/api/parser-profiles` and `/api/admin/parser-profiles...` route registrations from `server.go`.
      (2) Remove or cleanly retire `parser_profiles.go` and `parser_profiles_test.go`.
      (3) Ensure `createServiceHandler`, `updateServiceHandler`, and `parseRundownHandler` gracefully ignore legacy/omitted `parserProfileId` parameters without throwing errors.
- [x] In `internal/parse/`:
      (1) Retire `song_set_matching.go` and `song_set_matching_test.go`.
      (2) In `parser.go`, replace dynamic database profile loading with a permanent static internal parser (`StaticDefaultParser`) that provides built-in date, section, and standard hymn book resolution (SDAH) without querying `rundown_parser_profiles`.
      (3) Remove obsolete profile unit tests that assert database profile customization.
- [x] In `src/lib/`:
      (1) Clean up `src/lib/song-set-matching.ts` to remove `matchSongSets` and `songOverflow` types.
      (2) Clean up `src/lib/parser-rules.ts` and `src/lib/parser.ts` to remove obsolete profile-based matching in favor of dynamic regex matching.
- [x] In the method corpus:
      (1) In `.control/registry/usecases.yaml`: Mark UC-30 as retired / superseded by UC-31 (Dynamic Form Layout, Predefined Fields, and Song Set Regex).
      (2) In `.what/hub/SRS-hub.md`: Update Actor Register and references to UC-30.
      (3) In `.how/hub/SDD-hub.md`, `.how/hub/02-contracts/09-rundown-parser-profiles.md`, `.how/hub/02-contracts/00-inventory.md`, and `.how/_platform/inventory-api.md`: Mark parser profile contracts as retired / historical.
- [x] Verify test suite passes cleanly:
      (1) Run `go test ./...` in Go backend and verify all tests pass.
      (2) Run `npm test` and verify all tests pass.
      (3) Verify zero broken imports or references across the repository.
