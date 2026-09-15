# SPEC-31-04 — Automated Test Suite and Absence Guards

**Status:** closed
**Blocked by:** 03

## What to build

In `tests/smoke-spec-31.test.mjs` and Go unit/integration tests in `internal/pptximport`, provide comprehensive automated test coverage:

1. **Parser and engine unit tests**:
   - 16:9 ratio admission and rejection of non-16:9 aspect ratios.
   - Native slide `p:bg` image and solid fill resolution.
   - Layout `p:bg` fallback resolution when slide lacks `p:bg`.
   - Bottom-most covering shape ($\ge 95\%$ bounds) recognized as `backgroundImage` and removed from `elements`.
   - Inset photo (<95% coverage) or shape with text remains in `elements`.
   - Cross-boundary coordinate and font size parity ($sz / 100 / 0.75$ matches TypeScript `PX_TO_PT`).
2. **Archive hardening tests**:
   - Rejection of zip slip paths (`../`, drive letters, absolute paths).
   - Rejection of external relationships (`TargetMode="External"`).
   - Rejection of zip bomb / entry size limits.
   - Malformed XML handling.
3. **HTTP API integration tests**:
   - Authentication gates (`401` unauthorized, `403` non-admin).
   - End-to-end import of synthetic 16:9 test presentation.
   - Atomic rollback verification when an invalid slide is included.
4. **Absence guards**:
   - Injected defect 1: Native `p:bg` image retained in `elements` fails guard.
   - Injected defect 2: Bottom covering shape retained in `elements` fails guard.
5. **UI and conformance tests**:
   - ArtifactEditor source guard verifying "Import PPTX" button, multipart upload, clean selection, and `isDirty: false` handling.

## Acceptance criteria

- All unit and integration tests pass cleanly.
- Executable absence guards fail when defects are injected and pass when reverted.
- Zero private or non-synthetic congregation data committed.
