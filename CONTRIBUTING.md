# Contributing to WorshipDeck

Thank you for your interest in contributing to WorshipDeck! We welcome contributions, particularly from other congregations adapting this system to different liturgies and orders of service.

## 1. Ground Rules & Scope
- We keep WorshipDeck lean, offline-first, and zero-telemetry. We prioritize correctness and congregation privacy over feature volume.
- For non-trivial features or architectural changes, please open an Issue to discuss before opening a PR.

## 2. Before Your First Commit (Private Data Invariant)
Read [`.constitution/project/private-data.md`](.constitution/project/private-data.md). This repository is public and a congregation's own data (member names, photographs, prayer requests, account numbers) must never enter it. Automated tests enforce this invariant; if `public-repo-guard.test.mjs` fails, the finding is the point.

## 3. Reporting Bugs & Security Vulnerabilities
- Search existing issues to avoid duplicates.
- Provide a clear description and minimal reproduction steps.
- **Security vulnerabilities:** DO NOT report security issues via public issues. Report them privately through [GitHub Security Advisories](https://github.com/wiradeltaid/worship-deck/security/advisories/new) on this repository (see [SECURITY.md](SECURITY.md)). Questions that are not about security can go to support@wiradelta.com.

## 4. Local Development Setup

Requires Node.js and Go (`npm run dev` shells out to `go run ./cmd/api` for the API server).

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

## 5. Pre-Submission Checklist

Before opening a pull request, verify that all test suites pass cleanly:

```bash
npm test                          # includes the public-repo guard
go test ./cmd/... ./internal/...  # Go API test suite
npx tsc --noEmit
npm run lint
npm run build
```

Tests use Node's built-in runner (`node:test`) — there is no Jest or Vitest. If you add a new test file, register it in the `test` script in `package.json`.

## 6. Code Conventions
- TypeScript strict: prefer `unknown` and narrow at boundaries over `any`.
- Domain logic in `src/lib/*`, route handlers thin.
- kebab-case filenames, PascalCase components, camelCase functions.
- Existing shadcn / Base UI components rather than introducing new UI dependencies.

## 7. Changing Slide Templates
Slide layouts are data, not code. Edit them in the browser at `/admin/artifacts` rather than by hand where possible. A change to the shipped example registry affects every installation that has not customised that template, so keep example content generic and synthetic.

## 8. Commit Message Standard
- Use Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Keep the first line under 72 characters, written in imperative mood ("add feature", not "added feature").

## 9. Licensing of Contributions & Trademarks
- By submitting a pull request, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
- Contributions do not grant ownership of the project's trademarks, names ("Wira Delta Indonesia", "WDI", "WorshipDeck"), or visual logos (see `README.md` §Nama dan Ikon).
