# SPEC-82 — Song-Set Background Dropdown Containment & Presenter Preview Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`, `offline-deck`
- **Use Cases**:
  - `UC-27` (Presenter Live Background Override — satisfies `FR-33`)
  - `UC-25` (Background & Media Library Management — satisfies `FR-31`)
- **Functional Requirements**:
  - `FR-33` (Live Lyric Background Override)
  - `FR-32` (Configurable Song-Set Inputs & Background Selection)
  - `FR-31` (Song Sets & Background Management)
  - `FR-16` (Presentation Controller — broader context)

## Problem Statement

During hand-testing of the dual default backgrounds feature (SPEC-81), two visual disconnects were discovered:

1. **Dropdown Trigger Offset & Overflow in Song Set Row (`DynamicFormBody.tsx`)**:
   - In `src/operator/DynamicFormBody.tsx` line 412, `SelectTrigger` does not pass `w-full` and therefore defaults to `w-fit` from `src/components/ui/select.tsx`.
   - The flex child `<div className="flex items-center gap-1.5 overflow-hidden">` lacks `min-w-0`, preventing text truncation inside flexbox.
   - The trigger text `"Use Song-Set Default (#${songSetDefaultBg.id})"` (e.g. "Use Song-Set Default (#2)") is ~25+ characters long, expanding the trigger button past 214px and overflowing the `w-48` (192px) wrapper and card boundary (as shown in user-provided screenshot).
   - When an explicit image is selected, the trigger text `Image ${selectedFormBg.id} (Song-Set Default)` is up to 27+ characters and also causes severe clipping/overflow.

2. **Presenter & Projector Live Background Override Treating Default (`null`) as Blank/Clear**:
   - In `PresenterOperator.tsx`, `liveBackground` state is initialized to `null`:
     `const [liveBackground, setLiveBackground] = useState<string | null>(null);`
     which represents the "Deck default" state (no active live override, use the deck's authored/resolved background).
   - In lines 954, 1170, and 1239, `PresenterOperator` passes `backgroundOverride={liveBackground}` to Current SlideView, Next SlideView, and FilmstripFrame.
   - Similarly, `ProjectorClient.tsx` receives `background: null` from `PresentMessage` and passes `backgroundOverride={backgroundOverride}` (which is `null`) to `SlideView`.
   - In `src/lib/artifacts/render-model.ts`, `resolveEffectiveBackgroundImage` was authored as:
     ```ts
     export function resolveEffectiveBackgroundImage(
       instance: {
         layoutKey?: string;
         group?: { role?: string };
         layout: { backgroundImage?: string };
       },
       backgroundOverride?: string | null
     ): string | undefined {
       const isLyric = isLyricSlide(instance);
       return isLyric && backgroundOverride !== undefined
         ? backgroundOverride || undefined
         : instance.layout.backgroundImage;
     }
     ```
   - In JavaScript, `null !== undefined` is `true`. When `backgroundOverride` is `null` or `''`, `backgroundOverride || undefined` evaluates to `undefined`.
   - For all lyric slides (`isLyricSlide`), this returns `undefined` instead of `instance.layout.backgroundImage`, erasing the resolved song-set background from:
     - Slide preview (Current & Next stage monitors in PresenterOperator)
     - Slide filmstrip (FilmstripFrame in PresenterOperator)
     - Slide screen present (`ProjectorClient.tsx`)
   - Downloaded PPTX renders the background image properly because `src/lib/pptx-draw.ts` directly consumes and renders `layout.backgroundImage` without invoking the browser-side runtime resolver.

## Solution

1. **Presenter & Projector Deck Default Resolution (`SPEC-82-01`)**:
   - In `src/lib/artifacts/render-model.ts`, calibrate `resolveEffectiveBackgroundImage`:
     - If `!isLyricSlide(instance)`, always return `instance.layout.backgroundImage` (non-lyric authored preservation).
     - If `isLyricSlide(instance)`:
       - Normalize override: `const override = typeof backgroundOverride === 'string' ? backgroundOverride.trim() : '';`
       - Return `override ? override : instance.layout.backgroundImage;`
   - Update comments and documentation in `src/lib/artifacts/render-model.ts` and `src/lib/present-channel.ts` to accurately reflect that `null`/`undefined`/`''`/whitespace resets to the authored deck background rather than clearing it.
   - In `tests/presenter-live-background-preview.test.mjs`:
     - Assert that `resolveEffectiveBackgroundImage(lyricVerse, null)` and `(lyricVerse, undefined)` preserve the slide's authored background (`'default-song.jpg'`).
     - Assert that `''` and whitespace `'   '` also preserve the authored background.
     - Assert that non-empty string URLs override the lyric background.
     - Add source guard and integration assertion verifying that `ProjectorClient.tsx` passes `backgroundOverride={backgroundOverride}` to both incoming and outgoing `SlideView` instances.

2. **Song-Set Background Dropdown Containment & Typography (`SPEC-82-02`)**:
   - In `src/operator/DynamicFormBody.tsx`:
     - Set `<SelectTrigger className="w-full h-9 text-xs">` so the trigger is constrained to its container width.
     - Add `min-w-0` to the flex container: `<div className="flex min-w-0 items-center gap-1.5 overflow-hidden">`.
     - In the trigger label when default is active: display concise text `Song-Set Default (#${songSetDefaultBg.id})` with `text-[11px] truncate` and `title` tooltip, fitting cleanly inside the `w-48` slot.
     - In the trigger label when an explicit image is selected: display concise text `Image ${selectedFormBg.id}` with `text-[11px] truncate`.
     - Keep `SelectContent` `<SelectItem value="default">` displaying full label `Use Song-Set Default (#${songSetDefaultBg.id})` (or `Use Song-Set Default`) so the options menu remains comprehensive and backward-compatible with tests.
   - Update and augment `tests/song-set-background-parity.test.mjs` to guard trigger containment (`w-full`, `min-w-0`, `text-[11px]`, and `truncate`) alongside defect injection tests.
