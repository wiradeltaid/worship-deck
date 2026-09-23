# 01: Exempt /branding static assets from session gate

**What to build:** `internal/gate/gate.go` defines `exemptPrefixes` for paths that bypass session
authentication. Today, `exemptPrefixes` includes `/api/webhook`, `/api/auth/login`, `/api/auth/logout`,
`/login`, and `/assets`. Public branding assets located in `public/branding/` (such as
`/branding/worship-deck-icon-square.svg`, referenced on the unauthenticated login page `LoginPage.tsx`)
are not exempt. Unauthenticated requests to `/branding/...` are intercepted by `s.gate` in
`internal/httpapi/server.go` and redirected to `/login?next=...`, preventing the login page from
displaying its brand mark. Add `/branding` to `exemptPrefixes` in `internal/gate/gate.go` and add
tests to `internal/gate/gate_test.go` and HTTP test suite.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `internal/gate/gate.go` and `internal/gate/gate_test.go` in full first.
- [ ] Add `"/branding"` to `exemptPrefixes` in `internal/gate/gate.go`.
- [ ] Verify that `gate.IsGated("/branding/worship-deck-icon-square.svg")` returns `false`.
- [ ] Verify that `gate.IsGated("/branding/worship-deck-mark.svg")` returns `false`.
- [ ] Verify that `gate.IsGated("/branding")` and `gate.IsGated("/branding/")` return `false`.
- [ ] Verify that prefix-collision lookalike paths such as `gate.IsGated("/brandingfoo")` return `true`
      (remain strictly gated).
- [ ] Add unit test cases to `internal/gate/gate_test.go` asserting `/branding/worship-deck-icon-square.svg`,
      `/branding/worship-deck-mark.svg`, `/branding`, and `/branding/` in `TestExemptPaths`, and
      `/brandingfoo` in `TestGatedPaths`.
- [ ] Add an HTTP test asserting that an unauthenticated `GET /branding/worship-deck-icon-square.svg`
      returns initial response `200 OK` (using `http.ErrUseLastResponse` on `http.Client.CheckRedirect` or
      `httptest.ResponseRecorder` so redirects are not followed), `Content-Type` starting with
      `image/svg+xml`, and the response body contains valid SVG content.
- [ ] Ensure all existing exempt paths (`/login`, `/assets/...`, `/favicon.ico`, `/api/auth/login`, etc.)
      continue to behave exactly as before.
