# 01: A failed form-layout fetch is shown to the Operator, not swallowed

**What to build:** `fetchLayout` in both `src/operator/CreateForm.tsx` (~line 92-102) and
`src/operator/EditForm.tsx` (~line 132-142) is identical: it fetches `/api/worship-form-layout`
inside a `try`/`catch`, and a network-level failure is caught and silently ignored (`catch { //
ignore }`), while a non-OK response is also a silent no-op (no `else` branch on `res.ok`). This is
already documented precisely in `.how/hub/SDD-hub.md`'s Failure Behaviour table, confirmed still true
by a 2026-09-23 reconciliation pass. Give the Operator a visible error state instead of a silently
incomplete form.

**Two nuances found by peer review — do not treat the two forms as identical in effect:**
- `EditForm.tsx` initializes `layoutData` from `initialLayoutSnapshot` (~line 110-111) — when a valid
  snapshot exists, dynamic fields keep rendering even after the live `fetchLayout` fails; only an
  Edit Form with no usable snapshot falls back to the legacy static form. Create Form has no such
  snapshot and falls back whenever the fetch fails. Acceptance criteria must cover both distinct
  states, not assume they fail identically.
- Both forms only call `fetchLayout()` after an unrelated `Promise.all` (song-set entries, backgrounds,
  song books) succeeds (~line 134/243 and the `void fetchLayout()` calls after). If any of those three
  requests rejects, the outer catch runs and `fetchLayout()` is **never called at all** — leaving no
  dynamic layout and no layout-specific error under a `fetchLayout`-only fix. Either start the layout
  fetch independently of that `Promise.all`, or make that outer catch path also show the same
  layout-unavailable state.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `fetchLayout` in both `CreateForm.tsx` and `EditForm.tsx` in full first — the fix must land
      in both, and they must not drift into two different error-handling shapes.
- [ ] A network-level fetch failure (offline, connection reset) or non-OK HTTP response (4xx/5xx)
      shows a visible error notice using the existing reusable banner tokens in `src/operator/form-banners.ts`:
      (1) On `EditForm` when a valid `initialLayoutSnapshot` exists: render a `FORM_WARN_BANNER`
      indicating that the live dynamic layout refresh failed, but existing saved layout snapshot remains active.
      (2) On `CreateForm` or `EditForm` with no usable snapshot: render a `FORM_ERROR_BANNER`
      indicating that the dynamic field layout could not be loaded, with the form falling back to static fields.
- [ ] A non-OK HTTP response (4xx/5xx from `/api/worship-form-layout`) shows the same visible banner state
      according to the severity rules above — this is the case the current code silently treats as identical to success.
- [ ] The rest of the form (the static/built-in fields) still renders and remains usable — this is an added
      error surface, not a full-page crash that blocks the Operator from doing anything at all.
- [ ] **A retry path must be a real, working control in the error/warning banner itself.**
      Add an explicit "Retry" button to the layout banner that re-invokes `fetchLayout()` directly.
      Ensure that if the outer `Promise.all` rejected, the retry control is capable of re-triggering the
      necessary layout fetch sequence.
- [ ] `console.error` (or equivalent) logs the failure the way other fetch failures in this codebase
      already do, so it isn't only visible to the Operator in the moment — check
      `internal/httpapi`/`src/operator` sibling error paths for the existing logging convention and
      match it.
