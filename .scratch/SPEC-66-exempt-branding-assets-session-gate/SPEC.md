# SPEC-66 — Exempt branding static assets from session gate

## Problem Statement

The Go API's session authentication gate (`internal/gate/gate.go`) intercepts all incoming HTTP
requests and redirects unauthenticated requests to `/login?next=...`. The gate allows exemptions for a
hardcoded list in `exemptPrefixes` (`/api/webhook`, `/api/auth/login`, `/api/auth/logout`, `/login`,
`/assets`) plus `/favicon.ico`.

However, public brand assets relocated under `public/branding/` (such as
`/branding/worship-deck-icon-square.svg`, `/branding/worship-deck-mark.svg`, etc.) are referenced
directly by public views like `LoginPage.tsx` (`<img src="/branding/worship-deck-icon-square.svg" alt="WorshipDeck" ... />`).
When an unauthenticated user loads `/login`, the browser requests `/branding/worship-deck-icon-square.svg`.
Because `/branding` is missing from `exemptPrefixes`, `gate.IsGated` returns `true`, causing the Go
server's `unauthorized()` handler to redirect the image request with a `307 Temporary Redirect` back to
`/login?next=%2Fbranding%2Fworship-deck-icon-square.svg`. As a result, the brand icon fails to render on
the login page (broken image) until an authenticated session is established.

## Solution

Add `/branding` to `exemptPrefixes` in `internal/gate/gate.go` alongside `/assets`. This allows
unauthenticated requests for public brand SVG/image assets under `/branding/` to bypass the session gate
and be served directly by `fallback()` from `public/branding/` or `spa/dist/branding/`. Update
`internal/gate/gate_test.go` with tests asserting `/branding/...` paths are exempt while prefix-collision
lookalikes (`/brandingfoo`) remain gated.

## User Stories

1. As an unauthenticated operator or admin arriving at the login page (`/login`), I want to see the
   WorshipDeck brand icon (`/branding/worship-deck-icon-square.svg`) rendered clearly, so that I have visual
   confirmation that I am on the authentic WorshipDeck application.
2. As a browser fetching `/branding/worship-deck-icon-square.svg` without a session cookie, I want to receive
   HTTP 200 with the SVG asset and appropriate headers rather than a 307 redirect to `/login`.
3. As a developer or maintainer, I want `internal/gate/gate_test.go` to explicitly test that `/branding` paths
   are exempt from session checks, while prefix-collision lookalikes (`/brandingfoo`) remain gated.

## Implementation Decisions

- Add `"/branding"` to `exemptPrefixes` in `internal/gate/gate.go`.
- `gate.IsGated(pathname)` handles prefix matching: `pathname == prefix || strings.HasPrefix(pathname, prefix+"/")`.
  So `/branding` and `/branding/...` will be exempt, while prefix collisions like `/brandingfoo` will continue to
  return `true` (gated).
- Static file serving in `internal/httpapi/server.go` (`fallback`) already includes `public/` and `spa/dist/`
  in its candidate search paths, so no router changes in `server.go` are required.
- Add test cases in `internal/gate/gate_test.go` in both `TestExemptPaths` (`/branding/worship-deck-icon-square.svg`,
  `/branding/worship-deck-mark.svg`) and `TestGatedPaths` (`/brandingfoo`).

## Testing Decisions

- Go unit test in `internal/gate/gate_test.go` to prove `/branding` and `/branding/...` are exempt, and `/brandingfoo` is gated.
- Integration test or HTTP test asserting that an unauthenticated `GET /branding/worship-deck-icon-square.svg`
  returns `200 OK` (with `image/svg+xml` content type) and NOT `307/302` redirect.
- The HTTP test must use an explicit redirect-proof mechanism: either a client with redirect following disabled
  (`CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }`) or
  a direct handler invocation using `httptest.ResponseRecorder`, ensuring the initial response is observed and
  asserted as 200 OK rather than transparently following a redirect.

## Out of Scope

- Modifying how `/assets` or other public assets are packaged.
- Changing `LoginPage.tsx` or `Header.tsx` JSX or paths.
- Changing auth cookie lifetime, session validation, or admin route permissions.

## Further Notes

This gap was discovered during manual hand-testing on the live dev web target where `/login` displayed a
broken brand mark because the SVG asset was intercepted by session redirect.
