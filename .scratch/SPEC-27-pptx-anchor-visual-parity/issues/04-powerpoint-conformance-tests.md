# 04: Real Microsoft PowerPoint conformance test suite and absence guards

**What to build:** An automated conformance test suite that drives real Microsoft PowerPoint desktop via Windows COM automation to export slides to PNG and verify 1-to-1 pixel parity against Presenter web rendering, along with proven absence guards.

**Blocked by:** 03 (Embedded TrueType font packaging in PPTX export)

**Status:** closed

- [x] Implement `tests/pptx-conformance.test.mjs` that exports a presentation via the backend, drives Microsoft PowerPoint COM (`PowerPoint.Application`) to export slide 1 to PNG at 1920x1080, and compares bounding box, text line position, and clipping against `<ArtifactSlide>`.
- [x] Prove absence guards fail red when defects are injected (e.g. font embedding disabled, line spacing normalized factor removed, stage clipping disabled) and pass green when resolved.
- [x] Register `tests/pptx-conformance.test.mjs` in `package.json`'s `test` script and ensure all test suites pass green.
