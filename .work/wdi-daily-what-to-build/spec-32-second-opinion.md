# Second Opinion Request: SPEC-32 — PPTX Import Typography Parity, Embedded Font Adoption, and Letter Spacing

## 1. Path to drafted SPEC and Tickets
- SPEC: `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-32-pptx-import-font-adoption-and-letter-spacing\SPEC.md`
- Tickets:
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-32-pptx-import-font-adoption-and-letter-spacing\issues\01-importer-font-normalization-and-spc.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-32-pptx-import-font-adoption-and-letter-spacing\issues\02-font-catalog-and-dynamic-registration.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-32-pptx-import-font-adoption-and-letter-spacing\issues\03-letter-spacing-dom-fabric-toolbar-export.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-32-pptx-import-font-adoption-and-letter-spacing\issues\04-automated-tests-and-visual-proof.md`

## 2. Original Raw Notes from User (Unedited)
```
adopsi seluruh font yang ada di pptx, dan karena kita embedded font ke pptx maka harusnya semuanya avaialble digunakan font2nya aman tanpa failover. tambahkan fitur letter-spacing, perbaiki masalah import pptx yang belum tolerable hasilnya.
```

## 3. Standing Mandate
If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run `wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that permission is already given for this dispatch. Note: follow `.claude/skills/wdi-review/SKILL.md` as plain instructions.

## 4. Specific Review Prompts
Please review the drafted SPEC-32 and tickets:
1. **Font Variant Normalization**: Does the suffix separation rule (`"Montserrat Bold"` -> `fontFamily: "Montserrat"`, `fontWeight: "bold"`) effectively solve the fallback collapse to Arial without edge cases on non-standard font names?
2. **Embedded Font Extraction & Delivery**: Is the proposed extraction of `<p:embeddedFont>` (`ppt/fonts/font*.fntdata`) and dynamic `@font-face` injection sound, secure (against traversal / zip bombs), and compatible with web rendering?
3. **Character Spacing Math**: Is the conversion from DrawingML `spc` (hundredths of a point) to CSS `letter-spacing` ($\text{spc} / 75\text{ px}$ based on `PX_TO_PT = 0.75`) and Fabric.js `charSpacing` ($(\text{spc} / \text{sz}) \times 1000$) mathematically accurate and preserved across roundtrips?
4. **Resilient Font Catalog**: Does replacing the unconditional `"Arial", sans-serif` fallback with semantic fallbacks (`cursive`, `serif`, `sans-serif`) while preserving the requested family string appropriately handle OS-installed fonts?
5. **Completeness & Absence Proofs**: Are all four tickets vertically sliced, unambiguous, and testable? Are there missing edge cases or failure scenarios?

You are authorized to edit `SPEC.md` directly to apply improvements and record your review stamp under the header.
