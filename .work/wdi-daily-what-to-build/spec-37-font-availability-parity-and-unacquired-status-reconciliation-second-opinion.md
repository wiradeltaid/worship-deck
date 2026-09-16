# Second Opinion Review Request — SPEC-37

## Drafted Specification & Tickets

- Spec File: `D:/Developer/wiradigital.id/worship-presenter-web/.scratch/SPEC-37-font-availability-parity-and-unacquired-status-reconciliation/SPEC.md`
- Ticket 1: `D:/Developer/wiradigital.id/worship-presenter-web/.scratch/SPEC-37-font-availability-parity-and-unacquired-status-reconciliation/issues/01-artifact-editor-unacquired-font-logic-and-status-reconciliation.md`
- Ticket 2: `D:/Developer/wiradigital.id/worship-presenter-web/.scratch/SPEC-37-font-availability-parity-and-unacquired-status-reconciliation/issues/02-global-and-presenter-window-multi-context-font-hydration.md`
- Ticket 3: `D:/Developer/wiradigital.id/worship-presenter-web/.scratch/SPEC-37-font-availability-parity-and-unacquired-status-reconciliation/issues/03-pptx-font-embedding-variant-fallback-and-typeface-parity.md`

## Original Raw Notes (Verbatim)

```markdown
# Review 2026-09-16 06:02

## Finding 1

![Finding 1](<D:/SnapdownVault2/bundles/01a0a74e-f747-71d2-9fe4-66f5e7395aae/finding_1_burned.png>)

### Notes

Font berbeda antara presenter command center dan presenter window. Bahkan pptx export juga mirip presenter window.

### Marker Notes

1. di presenter command center. Tapi begitu di restart dia balik seperti nomor 2 fontnya.
2. di presenter window.

## Finding 2

![Finding 2](<D:/SnapdownVault2/bundles/01a0a74e-f747-71d2-9fe4-66f5e7395aae/finding_2_burned.png>)

### Marker Notes

1. kenapa unacquired font padahal font sudah diimport?
2. di canvas, visual sudah oke
```

## Standing Mandate

"If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run `wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that permission is already given for this dispatch."

Note for reviewer: Since you do not have a native Skill tool, please open and follow `.claude/skills/wdi-review/SKILL.md` as plain instructions to conduct the review. Review the draft against the original notes and the codebase (`src/components/admin/ArtifactEditor.tsx`, `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, `src/lib/fonts/embed-fonts.ts`, `spa/src/App.tsx`). Provide critique, identify any edge cases or gaps, edit SPEC.md directly if warranted, and return your verdict.
