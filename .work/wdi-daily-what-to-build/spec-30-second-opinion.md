# Second Opinion Review Packet: SPEC-30 PPTX Word-Wrap and Fit Parity

## 1. Path to Drafted Spec & Tickets
- Spec: `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-30-pptx-word-wrap-and-fit-parity\SPEC.md`
- Tickets:
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-30-pptx-word-wrap-and-fit-parity\issues\01-pptx-longest-word-fallback-and-fit.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-30-pptx-word-wrap-and-fit-parity\issues\02-pptx-whole-word-soft-break-partition.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-30-pptx-word-wrap-and-fit-parity\issues\03-pptx-cross-renderer-visual-parity.md`
- Registry:
  - `.control/registry/specs.yaml` (entry: `SPEC-30`)

## 2. Original Raw Owner Notes (Unedited)
```
ini pptx: [Image #2]
ini canvas: [Image #3]

canvas dengan present di test case ini cukup sama, tiba di pptx berbeda sekali, itu kenapa yah.
```
*(Context: The user provided screenshots comparing template `custom-08bbe5aa` where text is `"Bandung international community"` with `fontSize: 180`, `w: ~102.15%`. In Canvas/Presenter, the text wraps across 3 lines with whole words: "Bandung" / "international" / "community". In PPTX export, PowerPoint splits the word "international" mid-character into "internationa" and "l community".)*

## 3. Standing Reviewer Mandate
If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run `wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that permission is already given for this dispatch.

*(Note: When following the review mandate, open and follow `.claude/skills/wdi-review/SKILL.md` as plain instructions.)*

## 4. Technical Diagnostics & Specific Review Questions
We have diagnosed the following technical chain of events:
1. **Missing `longestWordPx` on raw or legacy templates**:
   In `src/lib/artifacts/render-model.ts`, `estimateTextFitScale`:
   ```ts
   const longestWordWidth = typeof element.longestWordPx === 'number' && element.longestWordPx > 0
     ? element.longestWordPx
     : 0;
   const contentWidth = Math.max(
     longestWordWidth,
     typeof element.measuredWith?.boxWidthPx === 'number' ? element.measuredWith.boxWidthPx : 0,
   );
   ```
   When `longestWordPx` is missing, `contentWidth` defaults to `0`.
   And in `resolveWrapLineCount`:
   ```ts
   if (!element.wrapLines || element.wrapLines.length === 0) {
     return text.split('\n').length;
   }
   ```
   For `"Bandung international community"`, `text.split('\n').length` returns `1`.
2. **Fit Scale calculation bypass**:
   Because `contentWidth = 0` and `lines = 1`, `estimateTextFitScale` checks only `1 * (180 * 0.8) = 144px` against `boxHeightPx = ~1057px`, returning `scale = 1.0` (135pt in PPTX).
3. **PowerPoint DrawingML Word Splitting**:
   In PowerPoint OOXML DrawingML text frames, when `wrap: true` is set and an unbroken word (e.g. `"international"` at 135pt is ~765pt) exceeds the text box width (e.g. 10.21 inches = 735.5pt), PowerPoint splits the word at the character boundary (`"internationa"` + `"l"`).
   In contrast, CSS with `word-break: normal` wraps at whitespace boundaries without breaking mid-word unless forced.
4. **No Fallback Line Partitioning in `resolveTextRunsForPptx`**:
   When `wrapLines` is absent, `resolveTextRunsForPptx` outputs the entire paragraph as a single un-partitioned run without soft breaks (`<a:br/>`), delegating wrapping entirely to PowerPoint.

Please evaluate:
1. **Mechanics & Robustness**: Does our proposed solution—adding fallback longest-word width estimation, width-aware scale estimation, and fallback whole-word soft-break line partitioning in `resolveTextRunsForPptx`—completely and safely resolve the PowerPoint word-splitting defect?
2. **Invariants**: Are there any unintended side effects or edge cases (e.g. explicit author newlines `\n`, multi-run styling, or short text boxes) that need tighter constraints?
3. **Spec & Ticket Quality**: Review `SPEC.md` and the 3 issue tickets in `.scratch/SPEC-30-pptx-word-wrap-and-fit-parity/`. Please edit, refine, or stamp the spec and tickets directly as authorized by the mandate.
