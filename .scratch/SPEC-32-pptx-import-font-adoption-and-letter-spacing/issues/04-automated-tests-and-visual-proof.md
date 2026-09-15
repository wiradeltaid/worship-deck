# SPEC-32-04 — Production-Path Typography Proof

**Status:** open
**Blocked by:** SPEC-32-03

## What to build

Add the registered synthetic end-to-end proof suite and evidence procedure:

1. Exercise a synthetic PPTX through import, durable font registration, rendered artifact data, plan handoff, and PPTX export. Inspect the generated OOXML and worker behavior on the real production paths.
2. Cover rejected/missing branches: absent `spc`, unsafe or invalid font streams, external/traversal relationships, failed promotion rollback, unknown font fallback, and incorrect OOXML run association.
3. Prove every new absence guard red by injecting its corresponding real production defect, then reverting it. Register the test file in `package.json`.
4. Record a conditional human PowerPoint comparison using only synthetic fixtures, including environment, loaded face status, and known shaping differences. Do not represent a source/XML scan as visual proof.

## Acceptance criteria

- The focused Go/Node suites, affected regressions, public-repository guard, and full `npm test` pass.
- Each claimed absence guard has recorded red-then-green proof against the production file/path it protects.
- The synthetic smoke suite confirms durable face loading, fallback behavior, exact tested `spc` round trips, and no worker font-network request.
