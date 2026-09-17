# 02: Canvas right-click context menu actually appears

**What to build:** Right-clicking a selected canvas element shows the context menu (bring to
front/forward, send backward/to back, duplicate, delete) live in the browser.

**Blocked by:** 01

**Status:** done

- [x] Start with `wdi-systematic-debugging`. This defect (`BUG-2`) has now been marked fixed twice
      — once as ticket `W11-03`, once as SPEC-12 ticket 02 — without the menu ever actually
      appearing for the admin. Read whatever test SPEC-12 added for this before writing a new one:
      if it asserts state (`contextMenu !== null`) without ever driving a real `contextmenu` event
      through the rendered tree, it proves nothing and must be replaced, not extended.
- [x] Confirm live, in the running app, exactly what happens on right-click before touching code —
      does `onContextMenu` fire at all, does it fire but compute wrong coordinates/target, or does
      it set state that a stale conditional never renders.
- [x] Fix the actual mechanism found, then confirm the menu appears live and every item
      (bring-forward/back, duplicate, delete) works.
- [x] Define and confirm the two scope questions the original defect left implicit: right-click on
      blank canvas (no element under the cursor) shows no menu, or a reduced one with no
      element-targeted actions; right-click while multiple elements are already selected applies
      bring-forward/back/duplicate/delete to the whole selection, not just the one under the cursor.
- [x] The regression is seen failing against current code first — right-click produces no menu —
      then passing after the fix, with a test that actually dispatches the interaction rather than
      calling the handler function directly.

