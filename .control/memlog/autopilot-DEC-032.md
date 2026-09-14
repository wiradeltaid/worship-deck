---
artifact: .control/decisions/DEC-032-autopilot-mandate-pptx-word-wrap-and-fit-parity.md
---

## Resume

Iteration: 1
Run branch: autopilot/DEC-032 (PR: draft PR ready for owner review)
Stopped at: Done — all 3 tickets under SPEC-30 implemented and closed; deterministic whole-word fallback layout in render-model.ts with bounded coupled wrap/fit scale convergence; PPTX DrawingML soft breaks (<a:br/>) between complete words preserving explicit paragraphs (<a:p>); unified single fallback-layout source of truth in pptx-draw.ts for textRuns, scale, and valign; non-breaking spaces preserved across fallback tokenization and validateWrapLines; verified by comprehensive smoke suite in tests/smoke-spec-30.test.mjs with real PowerPoint COM export verification; peer-reviewed and approved by kiro-cli gpt-5.6-terra with full 888-test suite passing.
Blocked: —
Parked: [ad-n]
Next: Owner final review and merge into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| Preflight | wdi-autopilot preflight | Mandate DEC-032 accepted by owner kodesh87 for PPTX Whole-Word Fallback Wrapping and Fit Parity (SPEC-30) | Interactive approval at each ticket | Autonomous execution under ledger recording | DEC-032, decisions.yaml |
| Iteration 1 | SPEC-30-01 | Implemented deterministic fallback longest-token width calculation in `render-model.ts` preferring valid stored `longestWordPx`, otherwise deriving positive finite width from explicit paragraphs/tokens, ensuring no branch passes `contentWidth: 0` for non-empty text | Falling back to `contentWidth: 0` for unmeasured text | Unmeasured large text bypassing width-axis downscaling and splitting mid-word in PPTX | render-model.ts |
| Iteration 1 | SPEC-30-02 | Implemented coupled scale-and-wrap fallback loop in `resolveFallbackTextLayout` with iteration bound (`MAX_FALLBACK_LAYOUT_ITERATIONS = 5`), stable scale retention on normal convergence, safe smaller-scale resolution on oscillation, and calibrated character advance ratios from valid stored measurements | Unbounded or decoupled wrapping and scaling | Misaligned line count, scale oscillation, or divergent font size in PPTX | render-model.ts |
| Iteration 1 | SPEC-30-02 | Emitted DrawingML soft breaks (`<a:br/>`) between whole tokens within paragraphs in `resolveTextRunsForPptx` while strictly preserving explicit `\n` paragraphs as separate `<a:p>` elements | Passing raw unpartitioned string to PowerPoint | PowerPoint splitting words at character boundaries (`internationa` / `l community`) | render-model.ts |
| Iteration 1 | Peer Review Finding 1 & 2 | Unified `renderTextElement` in `pptx-draw.ts` so `textRuns`, `scale`, and `valign` all derive exclusively from a single `fallbackLayout` evaluation in the non-authoritative-wrap branch | Recomputing scale and line count through independent paths | Text runs, font scale, and residual overflow top-anchoring diverging | pptx-draw.ts |
| Iteration 1 | Peer Review Finding 4 | Introduced `COLLAPSIBLE_SPACE_REGEX`, `TRIM_COLLAPSIBLE_REGEX`, and `splitCollapsibleWords` in `render-model.ts` to preserve non-breaking spaces (` `) as unbreakable intra-token characters across fallback tokenization and `validateWrapLines` | Splitting indiscriminately on `\s+` | NBSP phrase (`John Doe`) broken into separate words | render-model.ts |
| Iteration 1 | Peer Review Finding 1 (Tests) | Updated `slideText` in `tests/pptx-content.test.mjs` to join `<a:t>` runs with space across soft-wrapped runs while strictly verifying logical content for verse readings and hymn lyrics | Asserting single-run verbatim equality | Red test suite caused by multi-run soft-break emission | tests/pptx-content.test.mjs |
| Iteration 1 | SPEC-30-03 | Implemented `tests/smoke-spec-30.test.mjs` with 6 comprehensive tests including 180px reproduction fixture, trusted vs stale/malformed metadata, whitespace/NBSP preservation, sub-floor residual overflow, real Microsoft PowerPoint COM automated open/export verification, and executable absence guards | Relying solely on static unit tests | Unverified OOXML run structure or COM export failure on Windows host | tests/smoke-spec-30.test.mjs, package.json |
