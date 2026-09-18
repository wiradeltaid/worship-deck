# SPEC-43 — Presenter Header, Remote Pairing, Scripture Scaling, Song Set Rows, Text Rotation & Announcement Placeholders

> **Status:** open
> **Release:** presenter-remote-scripture-announcement-ux
> **Component:** presenter
> **Touches:** remote-control, present-channel, scripture, services, hymns, artifacts, pptx, announcements, slide-plan
> **Depends on:** SPEC-42

## Problem Statement

During operational walkthrough and hand-testing on `https://presenter-dev.bic.my.id/services/5/present` and service administration screens, operators identified several critical usability blockers and functional gaps:

1. **Presenter Header Visual Inconsistency & Distorted Layout:**
   The "Run-Sheet" button is rendered as a bare `variant="ghost"` action with no button background, positioned awkwardly at the end of the header actions. When a remote pairing code is active, it sits directly adjacent to an unstyled text block.

2. **Remote Code Generation Defect & Pairing UX Omission:**
   In `internal/httpapi/remote.go`, `generate6DigitCode()` mistakenly used `fmt.Sprintf("%0604d", ...)` instead of `"%06d"`, causing the remote code to render as an unreadable 604-character block of zeroes (`000000...481023`). Furthermore, the presenter console lacks a clear remote pairing workflow (status indicator, 6-digit presentation, direct pairing link or QR guidance).

3. **Presenter Mode Height Clamping & Viewport Crushing:**
   The presenter console root container enforces `lg:h-dvh lg:overflow-hidden`, locking the entire presentation console into the browser viewport without scrolling. On typical operator laptops (e.g. 1366x768), this clamps the stage previews and crushes the slide strip into miniature, unreadable thumbnails while clipping bottom controls. The layout requires vertical scrollability while respecting the carefully tuned `--presenter-stage` sizing formula.

4. **Scripture Push to Projector Blind Spot & Fixed Typography:**
   Pushing a scripture passage broadcasts to the external projector window but fails to update the local `Current` stage canvas in `PresenterOperator.tsx`. Operators must look away at the physical projector to verify the live slide. Additionally, the projector displays verses with fixed `text-3xl` sizing; short passages appear as tiny isolated lines, failing to fill 40-50% of the available display area.

5. **Cluttered 2-Column Song Set Input Cards in Worship Editor:**
   In `EditForm.tsx` and `CreateForm.tsx`, weekly song set inputs are organized in cramped 2-column grid cards (`sm:grid-cols-2`). With book selectors, hymn autocomplete inputs, background options, and lyrics editors crammed together, the UI is disproportionate and visually noisy. Operators need an orderly 1-row-per-song layout.

6. **Missing Canvas Text Element Rotation Across Language Boundaries:**
   `CanvasElement` and `ResolvedElement` lack rotation capability in both TypeScript and Go definitions, and canvas utilities hardcode `lockRotation: true`. Operators cannot rotate text elements (e.g. slanted titles, vertical badges) in the Artifact Editor or PPTX exports.

7. **Obsolete Afternoon Program Text & Weekly Announcement Image Placeholders:**
   The text-based `afternoonProgram` field in worship rundown is obsolete (it should be a poster graphic). Operators require a weekly announcement image insertion mechanism: up to 4 image upload slots in the worship service that dynamically populate designated placeholder slides in any announcement set (e.g. Break or Closing Announcements). If an image is uploaded for a slot, its placeholder slide is projected; if empty, the slide is omitted from the plan.

## Solution

1. **Presenter Header Harmonization:**
   - Standardize the Run-Sheet button to `variant="outline"`, matching adjacent actions.
   - Separate navigation controls from remote pairing tools.

2. **6-Digit Pairing Code Repair & Remote Pairing Workflow:**
   - Fix code generation in `internal/httpapi/remote.go` to strictly format as a 6-digit numeric string (`"%06d"`).
   - Re-architect Remote Pairing in `PresenterOperator.tsx` into a clean dialog or popover displaying: formatted 6-digit code, connection state (pairing, connected, idle), direct URL (`/services/:id/remote`), and disconnect/regenerate actions.

3. **Responsive Height & Vertical Scrolling for Presenter Console:**
   - Replace restrictive `lg:h-dvh lg:overflow-hidden` constraints with `min-h-dvh flex-col overflow-y-auto`.
   - Preserve `--presenter-stage` geometry derivation while allowing the outer console to scroll vertically on viewports under 850px, ensuring both stage previews and slide navigation remain legible without layout clipping.

4. **Scripture Current Stage Mirroring & Dynamic Text Sizing:**
   - Mirror live scripture broadcast on the `Current` stage canvas in `PresenterOperator.tsx` with active status indicator and extension of the existing "Clear scripture" button to dismiss both local preview and live projector.
   - Introduce dynamic scripture text sizing in `ProjectorClient.tsx` and `PresenterOperator.tsx` scaling from large display sizes (4rem-5.5rem) for short verses (filling ~40-50% of canvas height) down to comfortable reading sizes (1.75rem-2.5rem) for longer passages, with safe bounding to guarantee containment.

5. **Orderly 1-Row-per-Song Worship Input Layout:**
   - Redesign song set inputs into a clean horizontal row per song: Slot Label, Song Book selector, Hymn Number autocomplete, Background selector, and quick Edit Lyrics toggle/modal.

6. **Full-Stack Text Element Rotation Engine:**
   - Extend `CanvasElement` and `ResolvedElement` in both TypeScript (`src/lib/registry/types.ts`, `src/lib/artifacts/runtime-contract.ts`) and Go (`internal/plan/types.go`) with optional `rotation?: int` (degrees in [0, 360), default 0 / undefined).
   - Unlock rotation handles on text objects in Fabric canvas (`lockRotation: false`), syncing object angle to element state.
   - Support rotation input in Artifact Editor property panel and registry validator (`validate.ts`).
   - Render rotated elements via CSS `transform: rotate(...)` in web preview/projector and `rotate:` in `pptx-draw.ts`.

7. **Weekly Announcement Image Slots & Placeholder Slide Engine:**
   - Remove legacy `afternoonProgram` text field across types, forms, parser, and plan, with graceful backward-compatible migration for existing DB records.
   - Add weekly announcement image slots (up to 4 slots in `images_payload.announcementInserts`) in worship service data.
   - Enable marking announcement slides in `announcement_set_slides` as weekly placeholder slides bound to a slot (1-4).
   - In `slide-plan.ts` (TS and Go), conditionally expand placeholder slides: if an image is uploaded for that slot, render the slide with the image background; if empty, omit the slide from the live presentation plan (verified via defect-injection absence proof).

## User Stories

1. As a presenter operator, I want the Run-Sheet button in the presenter header to look like a proper button and sit in a logical position, so that I can easily navigate back to the service plan.
2. As a presenter operator, I want the remote pairing code to be a concise 6-digit number with a dedicated pairing dialog and status indicator, so that mobile remote pairing is fast and reliable.
3. As a presenter operator on a laptop, I want the presenter screen to scroll vertically instead of squeezing everything into the viewport, so that slide thumbnails and buttons are legible and easy to click without breaking `--presenter-stage` proportions.
4. As a presenter operator, I want pushed scripture verses to display immediately on my "Current" stage canvas, so that I know what is on the projector without craning my neck.
5. As a congregation member, I want short scripture verses on the projector to be large and prominent (filling ~50% of screen height) rather than tiny text in empty space.
6. As a worship planner, I want song set inputs in the edit worship form to be laid out as 1 row per song, so that entering hymns and backgrounds is orderly and uncluttered.
7. As a slide designer, I want to rotate text elements on the canvas and see that rotation reflected in PPTX and live projections across both Go and TS pipelines, so that I can create dynamic typography without breaking existing templates.
8. As a church administrator, I want to upload weekly announcement poster images in the worship service editor and have them automatically appear on designated placeholder slides across announcement sets, so that weekly posters don't require re-building slide templates.

## Implementation Decisions

1. **Remote Code Formatter:**
   - Update `generate6DigitCode()` in `internal/httpapi/remote.go` to use `fmt.Sprintf("%06d", n.Int64()%1000000)`.

2. **Presenter Layout & Stage Vars Preservation:**
   - Replace `lg:h-dvh lg:overflow-hidden` with `min-h-dvh flex-col overflow-y-auto`.
   - Maintain `--presenter-stage` geometry derivation while setting an explicit floor to prevent stage preview collapse when viewport is vertically constrained.

3. **Scripture Scaling Formula:**
   - Sizing function based on character count: `< 60` chars $\to$ 5rem (text-7xl), `60-120` chars $\to$ 4rem (text-6xl), `120-200` chars $\to$ 3rem (text-5xl), `> 200` chars $\to$ 2rem-2.5rem (text-3xl/4xl), bounded with `max-h-[80%]` containment.

4. **Song Set Row Layout:**
   - Replace `grid sm:grid-cols-2` in `EditForm.tsx` and `CreateForm.tsx` with a responsive table-like or flex row structure.

5. **Rotation Schema & Full-Stack Rendering:**
   - `CanvasElement.rotation` and `ResolvedElement.rotation` as numbers in degrees [0, 360) in both TS and Go (`internal/plan/types.go`).
   - PPTX renderer maps rotation directly to `pptxgen.TextPropsOptions.rotate`.
   - Unrotated templates default to 0 / undefined with identical byte-for-byte fidelity.

6. **Weekly Announcement Image Slots & Placeholder Resolution:**
   - Store weekly image slots in service `images_payload.announcementInserts` (array of up to 4 URLs).
   - In `announcement_set_slides`: slide record stores `is_placeholder: boolean` and `placeholder_slot: 1..4`.
   - In `slide-plan.ts` (TS and Go), evaluate announcement slide: if tagged as placeholder slot $k$, inspect `announcementInserts[k-1]`. If present and valid, render leaf with image background; if absent or whitespace, omit from `children`.

## Testing Decisions

- Test external behavior across endpoints, React components, and plan generation without mocking internal layout calculations.
- Verify remote pairing endpoints with 6-digit validation (including leading zeros).
- Verify slide plan omits empty announcement placeholder slides and includes populated ones, backed by an executable defect-injection absence proof.
- Prior art: `tests/smoke-spec-39.test.mjs`, `tests/smoke-spec-41.test.mjs`, `tests/smoke-spec-42.test.mjs`.

## Out of Scope

- Remote control of audio mixing or lighting systems.
- Arbitrary shape morphing or 3D rotation beyond 2D planar rotation.
- Video upload into announcement placeholder slots (images only).
