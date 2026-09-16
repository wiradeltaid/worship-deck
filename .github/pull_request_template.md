## Summary of changes

A clear and concise summary of what changes are introduced by this pull request.

## Problem or motivation

Why is this change necessary or desirable? (Link to issue if applicable: `Fixes #...`).

## Pre-submission verification checklist

Before opening this pull request, please ensure:

- [ ] Automated tests pass cleanly: `npm test`
- [ ] Public repository guard passes: `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs`
- [ ] No private congregation details, real member names, uploaded photos, or live credentials (`.env`, `data/local/`, `data/uploads/`, `data.db*`) are committed
- [ ] TypeScript type checks pass without errors: `npm run typecheck`
- [ ] Linter checks pass: `npm run lint`
- [ ] Documentation (`README.md`, `README.en.md`, or relevant guides) updated if behavior changed
- [ ] Contributions are submitted under the project's MIT license and respect project trademark policies (see `README.md` §The name and the icon)
