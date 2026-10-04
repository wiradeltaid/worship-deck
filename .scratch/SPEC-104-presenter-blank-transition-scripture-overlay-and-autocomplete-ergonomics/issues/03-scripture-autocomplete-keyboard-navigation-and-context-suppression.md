# 03: Scripture Autocomplete Keyboard Navigation and Chapter/Verse Context Suppression

**Satisfies:** [UC-13, FR-19]
**Blocked by:** ["SPEC-104-02"]
**Status:** done

**What to build:** In `src/components/ScriptureRefAutocomplete.tsx`, `internal/scripture/match.go`, `internal/scripture/match_test.go`, and `tests/scripture-controls-ergonomics.test.mjs`:

1. **Compositional Keyboard Navigation & Accessibility**:
   - In `src/components/ScriptureRefAutocomplete.tsx`:
     - Maintain an `activeIndex` state (`-1` initially).
     - Intercept `onKeyDown` on `<Input>` only when list is relevant (`showList && hits.length > 0`):
       - `ArrowDown`: prevent default, increment `activeIndex` clamped to `[0, hits.length - 1]`.
       - `ArrowUp`: prevent default, decrement `activeIndex` clamped to `[-1, hits.length - 1]`.
       - `Enter`: if `activeIndex >= 0 && activeIndex < hits.length`:
         - Prevent default (stop form submission or global slide navigation).
         - Select the book: `onChange(`${hits[activeIndex].name} `)`.
         - Close dropdown (`setOpen(false)`), reset `activeIndex = -1`.
         - If `activeIndex === -1`, allow `Enter` to pass through to parent `onKeyDown`.
       - `Escape`: if dropdown is visible, prevent default, close dropdown (`setOpen(false)`), reset `activeIndex = -1`. If dropdown is closed, pass through to parent.
     - When `hits.length === 0` or dropdown is closed, pass all keys through to parent `onKeyDown`.
     - Accessibility attributes:
       - `<Input>`: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded={showList}`, `aria-controls="scripture-autocomplete-list"`, `aria-activedescendant={activeIndex >= 0 ? `scripture-opt-${activeIndex}` : undefined}`.
       - Dropdown container: `role="listbox"`, `id="scripture-autocomplete-list"`.
       - Option buttons: `role="option"`, `id={`scripture-opt-${index}`}`, `aria-selected={index === activeIndex}`, styled with `bg-accent text-accent-foreground`.
       - Mouse hover (`onMouseEnter`) syncs `activeIndex` to the hovered item index.

2. **Chapter/Verse Context-Aware Autocomplete Suppression**:
   - In `src/components/ScriptureRefAutocomplete.tsx`:
     - Implement shared predicate `shouldSuggestBooks(query: string): boolean`:
       - If `query` is empty or `looksComplete(query)` -> return `false`.
       - Split tokens on whitespace: `tokens = query.trim().split(/\s+/)`.
       - Leading-number books (e.g. `tokens[0]` is a digit):
         - `1`, `1 C`, `1 Cor`, `1 Corinthians` -> return `true` (suggestions OPEN).
         - `1 Corinthians 13`, `1 Cor 13`, `1 Corinthians 13:4` -> return `false` (suggestions CLOSED).
       - Standard books:
         - `mat`, `Matthew`, `Matthew ` -> return `true` (suggestions OPEN).
         - `Matthew 4`, `Mat 4`, `Matthew 0`, `Matthew 4:1` -> return `false` (suggestions CLOSED).
     - Only query `/api/scripture` and display dropdown when `shouldSuggestBooks(query)` is true.
   - In `internal/scripture/match.go`:
     - In `SuggestBooks`: if `q` contains a complete recognized book followed by digits, return `nil` to avoid redundant queries and returning the book name itself for `Matthew 4`.

3. **Automated Unit & Guard Tests with Defect-Injection Verification**:
   - In `tests/scripture-controls-ergonomics.test.mjs`:
     - Test that pressing `ArrowDown` increments `activeIndex` and highlights the suggestion with `aria-selected="true"`.
     - Test that pressing `Enter` with an active selection calls `onChange` with the book name and trailing space, and closes the dropdown.
     - Test that pressing `Enter` with `activeIndex === -1` forwards to parent `onKeyDown`.
     - Test the complete boundary table for `shouldSuggestBooks`:
       - Assert `true` for `mat`, `Matthew`, `1`, `1 C`, `1 Cor`, `1 Corinthians`.
       - Assert `false` for `Matthew 4`, `Mat 4`, `Matthew 0`, `Matthew 4:1`, `1 Corinthians 13`, `1 Cor 13`.
     - **Absence Guard Defect Injection**:
       - Verify that removing the suppression check causes `Matthew 4` to fail (RED) by triggering suggestions.
       - Revert defect, observe GREEN.
   - In `internal/scripture/match_test.go`:
     - Add test cases proving `SuggestBooks("Matthew 4", ...)` returns `nil`.
