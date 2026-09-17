# 06: Main Spine toolbar and title-area consistency pass

**What to build:** The Main Spine toolbar reads cleanly (icon-only add buttons, a correct
Background icon/label, a sensible order), the Element Properties panel is always visible instead of
appearing and disappearing, and create-action buttons and the title-area button grouping follow the
project's now-standard patterns (`DEC-009`, `DEC-010`, `DEC-011` — all `status: accepted` 2026-09-08,
applied into `.how/_platform/design-system.md`).

**Blocked by:** 05

**Status:** done

- [x] Ordinary UX work, no debugging pass needed — these are unbuilt-as-specified, not regressions.
- [x] Closes `BUG-12`: Text/Rectangle/Image add-buttons show icon only, no "(Drag)" suffix text; the
      Change Background control uses an image/background icon (not one that reads as a
      color-picker swatch) and drops the word "Background" from its visible label; toolbar order is
      `Add: [Text] [Shape] [Image] | [Background icon] | [Placeholder dropdown] [Add Placeholder]`.
- [x] Closes `BUG-13`: the Element Properties row is always mounted regardless of selection state,
      showing `Properties (Image): No properties to change` or `Properties (None): Select element
      first` as appropriate, instead of being conditionally rendered.
- [x] Per `DEC-009` (the Main Spine "New Slide" panel's `+ Add` button's gray/low-contrast look was
      the QA finding that opened this decision, folded directly into `DEC-009`'s Why rather than
      given its own `BUG-` id) and closing `BUG-17`: drop the hand-written
      `className="bg-primary hover:bg-blue-600 text-white ..."` on `ArtifactEditor.tsx:1730` (Main
      Spine "New Slide" panel's `+ Add`) AND `:1751` (Toolbar's "+ Add Placeholder", `BUG-17`) — use
      `Button` with no `variant` prop (defaults to `default`/primary) instead.
- [x] Per `DEC-010`: confirm the "New Slide" panel's wording already matches the accepted New/Add
      convention (it should — kind is chosen by the dropdown first, so "Add" reads correctly under
      that rule); relabel only if it does not.
- [x] Per `DEC-011` (Main Spine's own instance): the title area reads `[Rename] | Canvas: [Reset]
      [Save]`, switching to `[Cancel] [Save] | Canvas: [Reset] [Save]` while rename is active.
- [x] A static structural guard (`tests/operator-shadcn-guard.test.mjs`) confirms no hand-rolled
      element was introduced by the button-variant change.
- [x] A new test asserts the Properties row is present in the DOM regardless of selection state,
      with both placeholder-text variants — seen failing against the current conditional-render
      code first, then passing.
