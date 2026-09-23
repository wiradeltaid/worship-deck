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

**Status:** closed

- [x] Read `fetchLayout` in both `CreateForm.tsx` and `EditForm.tsx` in full.
- [x] Network-level fetch failures or non-OK HTTP responses show a visible banner state:
      (1) `EditForm` with valid `initialLayoutSnapshot` renders `FORM_WARN_BANNER` indicating live refresh failed but saved snapshot remains active.
      (2) `CreateForm` or `EditForm` without snapshot renders `FORM_ERROR_BANNER` indicating dynamic layout is unavailable and falling back to static fields.
- [x] Non-OK HTTP responses (4xx/5xx) trigger the same visible banner state and error handling.
- [x] Static fields continue to render and remain fully usable in fallback mode.
- [x] Added working "Retry" buttons to both banners that directly re-invoke `fetchLayout()`.
- [x] Started `fetchLayout()` independently in `useEffect` so that rejections in sibling fetches do not block layout loading.
- [x] Failures logged via `console.error`.
