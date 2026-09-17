# SPEC-24 Test Plan — Canvas Healing Dirty-State & Persistence Isolation

## 1. Fixtures (synthetic — no congregation data)

**F-1 `UNMEASURED-LEGACY`** — Legacy template containing text elements lacking SPEC-23 measurement fields.

| Field | Value |
|---|---|
| `elements[0].content` | `"Sample Title"` |
| `elements[0].w` | `60` |
| `elements[0].h` | `15` |
| `elements[0].longestWordPx` | `undefined` |
| `elements[0].wrapLines` | `undefined` |
| `elements[0].measuredWith` | `undefined` |

**F-2 `DRAG-MOVED`** — Element authored at `x: 10, y: 10`, but moved by user on canvas to `left: 300, top: 400` (in 960x540 reference pixels).

| Property | Authored | Live Canvas Value |
|---|---|---|
| `x` / `left` | `10%` (96px) | `300px` (31.25%) |
| `y` / `top` | `10%` (54px) | `400px` (74.07%) |

**F-3 `TEXT-AND-STYLE-EDITED`** — Text element whose content was edited to `"Updated Headline"` and style set to `bold`.

---

## 2. Automated Tests (`tests/smoke-spec-24.test.mjs`)

| Test ID | Ticket | Objective | Assertion |
|---|---|---|---|
| **T-24-01** | 24-01 | Decoupled dirty state on open | Mounting F-1 with unmeasured text elements leaves `isDirty = false` |
| **T-24-02** | 24-01 | Seamless slide navigation | `mayDiscard(isDirty && isEditable)` returns `true` immediately without invoking confirm callback |
| **T-24-03** | 24-02 | Healing flag reset on mutation | Canvas mutation events (`object:modified`, `object:moving`, `object:scaling`, `text:changed`, toolbar styling, adding/deleting elements) reset `isHealingOnlyRef.current = false` |
| **T-24-04** | 24-03 | Non-destructive coordinate serialization | `serializeCanvas` with `isHealingSave: true` on F-2 preserves modified `x` and `y` coordinates |
| **T-24-05** | 24-03 | Non-destructive content & style serialization | `serializeCanvas` with `isHealingSave: true` on F-3 preserves updated `content` and `style` |
| **T-24-06** | 24-03 | Healing invariant preserved | Untouched elements in `isHealingSave: true` preserve `source.h` and `source.zIndex` while recording `longestWordPx`, `wrapLines`, and `measuredWith` |
| **T-24-07** | 24-04 | Absence guard (premature dirtying) | Verifies test harness catches and fails red if `markDirty()` is injected into the unmeasured element check |
| **T-24-08** | 24-04 | Absence guard (coordinate reversion) | Verifies test harness catches and fails red if `source.x` overwrite is injected into `serializeCanvas` |

---

## 3. Manual Verification Steps (Dev Environment)

1. Open `https://presenter-dev.bic.my.id/admin/artifacts`.
2. Select any template with multiple slides in `Deck Sequence`.
3. Click through 5 different slides in sequence:
   - **Expected**: Slides switch smoothly and immediately; zero modal confirmation pop-ups appear.
4. On Slide 1, drag a text element 100px to the right and 50px downward.
5. Click **Save** (`Simpan`):
   - **Expected**: Save succeeds. When canvas reloads, the text element stays at the new position and does NOT snap back.
6. Edit the text content, change its color or font size, and click **Save**:
   - **Expected**: Text and style changes remain persisted accurately.
