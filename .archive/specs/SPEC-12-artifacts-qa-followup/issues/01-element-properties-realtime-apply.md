# 01: Element Properties realtime apply (font size, font color, shape color sync, underline)

**What to build:** In the Artifact Registry canvas editor, changing Font Size or Font Color for a
selected text element visibly changes that element immediately. Selecting a shape shows that
shape's actual current color in the picker instead of a default. An Underline toggle sits next to
Bold and Italic and survives a save.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Start with `wdi-systematic-debugging` for the font size / font color parts — `defects.yaml`
      BUG-4/BUG-5 record a strong hypothesis (`applyTextStyle()` never called from those two
      handlers) but it has not been reproduced live; confirm before patching.
- [x] Editing Font Size on a selected text element changes its rendered size on the canvas with no
      extra "Apply" step.
- [x] Editing Font Color on a selected text element changes its rendered color on the canvas with
      no extra "Apply" step.
- [x] The Font Size input is wide enough to show a 3-digit value without truncation.
- [x] Selecting a shape element shows that shape's own current fill color in the color picker, not
      a default color (BUG-6 — this element sync currently only has a branch for text, none for
      shapes).
- [x] An Underline toggle exists next to Bold and Italic, toggles the selected text's underline on
      the canvas, and a template saved with underline round-trips through
      `internal/plan/validate_artifact.go`'s `allowedStyleKeys` without being rejected (BUG-10,
      closes `OQ-41` — `textDecoration` is not currently in that allowlist).
- [x] Every new absence/regression assertion is seen failing against the current code before the
      fix, then passing after — per this project's TDD guard convention, and because BUG-2's own
      ticket (`W11-03`) was marked `done` with tests that never asserted the behaviour they claimed.
