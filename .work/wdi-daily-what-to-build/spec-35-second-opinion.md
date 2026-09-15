# Second Opinion Review Packet — SPEC-35

## 1. Drafted Spec & Ticket Paths
- `.scratch/SPEC-35-pptx-modern-widescreen-parity/SPEC.md`
- `.scratch/SPEC-35-pptx-modern-widescreen-parity/issues/01-pptx-modern-widescreen-dimensions-and-export-scale.md`
- `.scratch/SPEC-35-pptx-modern-widescreen-parity/issues/02-pptx-import-slide-dimensions-and-dynamic-font-scaling.md`
- `.scratch/SPEC-35-pptx-modern-widescreen-parity/issues/03-character-spacing-parity-and-full-suite-verification.md`

## 2. Original Raw Notes from Owner (Unedited)
`oke, kerjakan agar bisa 1:1 buatkan spek/tiketnya, jangan sampai miss lagi.`

### Context from Discussion:
The owner identified that font size 12 in the web Canvas Editor currently does not match font size 12 in PowerPoint PPTX export/import.
The cause was verified in the codebase: PPTX export was hardcoded to legacy PowerPoint 2007-2010 dimensions (10" x 5.625" / 25.4 cm x 14.288 cm / 405 pt height), resulting in an artificial scaling ratio `PX_TO_PT = 405 / 540 = 0.75`.
The owner prepared PPTX with standard modern 16:9 widescreen dimensions: 33.867 cm x 19.05 cm (13.3333" x 7.5" = 960 pt x 540 pt).
With modern widescreen dimensions, `PX_TO_PT = 540 pt / 540 px = 1.0` (direct 1:1 point-to-pixel equivalence across Canvas, Presenter, PPTX Import, and PPTX Export).

## 3. Review Mandate
*"If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run `wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that permission is already given for this dispatch."*

(Note: Since you do not have a native `Skill` tool, please read and follow `.claude/skills/wdi-review/SKILL.md` as plain instructions directly. Review lenses: `structure`, `prose`, `edge-case-hunter`).

Please review SPEC-35 and its 3 tickets thoroughly:
1. Verify whether the mathematical conversions ($PX\_TO\_PT = 1.0$, $spc = letterSpacing \times 100$) are complete and airtight across all four surfaces (Canvas Editor, Presenter/Projector, PPTX Import, PPTX Export).
2. Check for any subtle edge cases in dynamic import slide height adaptation (e.g. non-zero division, legacy 405 pt vs modern 540 pt, handling zero or missing dimensions).
3. Ensure no regressions in existing templates, positioning percentages, or test suites.
4. Edit the spec/tickets directly if adjustments are needed, apply your review stamp in `SPEC.md`, and report your verdict and findings.
