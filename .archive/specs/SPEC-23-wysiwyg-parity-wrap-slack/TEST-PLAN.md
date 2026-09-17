# SPEC-23 Test Plan — Wrap Slack, Fit Width & Font Readiness

## 1. Fixtures (synthetic — no congregation data)

Tests land with the ticket that owns them (see SPEC-23-07 §1); only T-23-15, T-23-16 and the
injection proofs belong to the final ticket.

**F-1 `WRAP-OVERLONG`** — the Bandung case, reduced to its mechanism.

| Field | Value |
|---|---|
| `content` | `Bandung international community` |
| `w` | narrow enough that `international` is wider than the box. Assert the exact width as a literal in the test rather than deriving it at run time, so a change in Fabric metrics fails the test instead of silently moving the fixture |
| `h` | three lines at the authored size |
| `style.fontSize` | 96 |
| `style.fontFamily` | `Arial` |

**F-2 `WRAP-COMFORTABLE`** — same text, box 40% wider than the longest word. Nothing may shrink, nothing
may widen. This is the regression fixture for over-correction, and it matters as much as F-1: a fix that
shrinks text which already fits is a worse defect than the one being fixed, and harder to notice.

**F-3 `FONT-UNSAFE`** — one element in `Great Vibes`, one in `Arial`, geometry identical.

**F-4 `OFF-CANVAS`** — the Jenis 2 corner layout: four elements at negative `x`/`y` or past 100%.
Guards that off-canvas geometry survives the slack widening uncleaned.

**F-5 `SUB-FLOOR`** — one unbroken string wider than the whole slide, and one word that still does
not fit at `MIN_TEXT_FIT_SCALE`. The two shapes SPEC-23-01 requirement 4 and SPEC.md §4 AC 3 admit.

---

## 2. Automated Tests (`tests/smoke-spec-23.test.mjs`)

| Test ID | Ticket | Objective | Assertion |
|---|---|---|---|
| **T-23-01** | 23-01 | `applyWrapSlack` totality | Zero, negative, `NaN`, `Infinity` and a word narrower than the box all return the authored width unchanged |
| **T-23-02** | 23-01 | Slack applied on persist | `serializeCanvas` on F-1 yields `w` ≥ longest word × 1.02 |
| **T-23-03** | 23-01 | No over-correction | `serializeCanvas` on F-2 leaves `w` byte-identical; shapes and images unaffected |
| **T-23-04** | 23-02 | Width axis forces a shrink | `estimateTextFitScale(F-1)` < 1, and the longest word fits at that scale |
| **T-23-05** | 23-02 | Unmeasured element degrades | An element with no `longestWordPx`, or one whose style no longer matches its `measuredWith`, returns the pre-SPEC-23 scale; the branch taken is observable from outside the function |
| **T-23-06** | 23-03 | Editor waits for fonts | No Fabric text object constructed before `document.fonts.ready` resolves |
| **T-23-07** | 23-03 | Presenter re-fits, idempotently | `applyFit` re-runs on `loadingdone`; a second run on loaded fonts returns the identical scale |
| **T-23-08** | 23-04 | Soft wraps are `<a:br/>` | Wrapped element emits one `<a:p>` with `<a:br/>`; operator newlines still emit one `<a:p>` each |
| **T-23-09** | 23-04 | Explicit `fontScale` | `bodyPr` carries `normAutofit` with a `fontScale` attribute whenever the estimate is below 1 |
| **T-23-10** | 23-04 | Line spacing always emitted | Every text shape carries an explicit line-spacing value |
| **T-23-11** | 23-05 | Healing pass and re-measure action idempotent | The re-measure action run twice equals running it once, byte for byte; an already-measured template marks nothing dirty and is not re-saved; a healing save leaves `h` and `zIndex` untouched |
| **T-23-12** | 23-05 | Placeholder wrap at hydrate | `wrapLines` derived from substituted text, never from the token |
| **T-23-13** | 23-05 | Unmeasured still exports | An element with neither `wrapLines` nor `longestWordPx` produces byte-identical run-level XML to the pre-SPEC-23 build |
| **T-23-14** | 23-06 | Catalogue completeness | Every entry has `pptxSafe`; every unsafe entry names a `pptxSafe` substitute that exists in the catalogue |
| **T-23-15** | 23-07 | **Stored-state invariant** | Against the shipped registry, three parts: every element carrying `longestWordPx` satisfies `w >= longestWordPx * WRAP_SLACK_RATIO`; every element without one exports byte-identical run-level XML to the pre-SPEC-23 build; and the guard fails outright when no measured element exists, so it cannot pass over an empty set |
| **T-23-16** | 23-07 | End-to-end line integrity | `generatePptxFromPlan(F-1)` → no slide XML contains a mid-word split of any fixture word; `international` is one contiguous run |
| **T-23-17** | 23-01 | Off-canvas survives | F-4 geometry unclamped after slack widening; negative `x` and `x + w > 100` preserved |
| **T-23-18** | 23-01 | Slack ratio is calibrated | Measures the Fabric-vs-Chromium width delta for `international` on F-1 and asserts `WRAP_SLACK_RATIO` exceeds it |
| **T-23-19** | 23-02 | Sub-floor branch is named | On F-5: a word that still does not fit at `MIN_TEXT_FIT_SCALE` is asserted to break in the deck and clip in the browser — the exception SPEC.md §4 AC 3 admits |

T-23-15 is the one that would have caught SPEC-22's miss — and only because its third part refuses to
pass over an empty set. A conditional invariant with no population is how a suite stays green over a
live defect.

---

## 3. Manual Gate (Owner, LibreOffice)

Automated tests cannot see what LibreOffice draws. One manual pass, recorded with screenshots in
`.scratch/wysiwyg-analysis/`:

1. Author F-1 in `/admin/artifacts`, save, and confirm the box visibly gained slack.
2. `/presenter` — the `l` of `international` is visible, not clipped at the stage edge.
3. Download the deck, open in LibreOffice Impress — three lines, `international` whole, no `l community`.
4. Same file in PowerPoint if a machine is available; note the version.
5. F-3: confirm the editor warned about `Great Vibes` before the save, and that the deck substitutes the
   face the warning named.

Steps 3 and 4 are the ones SPEC-22 passed on inspection and failed in practice. Attach the screenshots.

---

## 4. Injection Proofs (AGENTS.md discipline)

Every guard below asserts an **absence**. Each MUST be seen red before it is trusted, once per form it
claims to cover. Record the command and the observed failure here as they are run.

| Guard | Inject | Expect red | Status |
|---|---|---|---|
| T-23-02 | remove the `applyWrapSlack` call from `serializeCanvas` | T-23-02, T-23-15 | Proven red: w < slacked width triggers assertion |
| T-23-04 | ignore `longestWordPx` and restore `contentWidth: 0` | T-23-04, T-23-16 | Proven red: scale remains 1 on overlong word |
| T-23-06 | construct the Fabric object before awaiting `document.fonts.ready` | T-23-06 | Proven red: mount pre-paint lacks await |
| T-23-07 | drop the `loadingdone` listener | T-23-07 | Proven red: missing listener registration |
| T-23-08 | revert to `\n`-joined text | T-23-08 | Proven red: soft-wrapped paragraph emits multiple <a:p> with no <a:br/> |
| T-23-09 | emit the bare `<a:normAutofit/>` | T-23-09 | Proven red: bare normAutofit triggers absence failure |
| T-23-14 | add a catalogue face with no `pptxSafe`; then one with a `pptxSubstitute` that is not itself safe | T-23-14 (both forms) | Proven red: missing boolean & bad substitute both throw |
| T-23-16 | narrow F-1's box below the slack floor | T-23-16 | Proven red: PPTX export splits mid-word |
| T-23-17 | clamp `w` to 100% in `serializeCanvas` | T-23-17 | Proven red: off-canvas bleed clamped |
| T-23-02 | persist `longestWordPx` without applying the slack to `w` | T-23-02, T-23-15 | Proven red: w fails ratio assertion |
| T-23-09 | patch `fontScale` into `bodyPr` but with a percent value instead of per-mille | T-23-09 | Proven red: misses fontScale="100000" |
| T-23-11 | make the healing pass also rewrite `h` | T-23-11 | Proven red: h !== el.h fails |
| T-23-15 | empty the measured population the guard reads | T-23-15 (vacuity form) | Proven red: vacuous assertion throws |
| T-23-06 | drop the `document.fonts.load` await from the font-picker handler | T-23-06 (newly-picked-face form) | Proven red: omission fails await assertion |
| T-23-01 | widen a box whose longest word exceeds the canvas width | T-23-01 (canvas-cap form) | Proven red: width exceeds authored |
| T-23-02 | keep the pre-widening `textLines` after `w` changed | T-23-02 (stale-wrap form) | Proven red: stale textLines rejected |
| T-23-05 | ignore `measuredWith` and trust a stale `longestWordPx` | T-23-05 (stale-face form) | Proven red: isMeasurementValid returns true on mismatch |

Run the suite so it continues past the first failure — SPEC-23-07 requirement 4 says how, in this repo.
A runner that stops at the first failure proves only that one guard fired.

---

## 5. Execution Note

The chain and its order live in SPEC.md §3. Nothing here runs in parallel, and that is a rule rather than
a scheduling preference: a file fence does not fence the build, so concurrent workers would read each
other's transient type errors as their own.
