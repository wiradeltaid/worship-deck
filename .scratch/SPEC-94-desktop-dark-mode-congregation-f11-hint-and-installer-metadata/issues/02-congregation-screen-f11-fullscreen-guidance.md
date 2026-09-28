# 02: Congregation Screen F11 Fullscreen Guidance Banner

**What to build:** In `src/projected/ProjectorClient.tsx`, `package.json`, and `tests/congregation-fullscreen-guidance.test.mjs`:

1. **Authorized Startup Exception to Room-Facing Chrome Constraint**:
   - `UC-12` and `SRS-presenter.md` prohibit persistent operator chrome on the congregation screen.
   - Authorized Exception: A transient, self-dismissing onboarding cue is permitted strictly at congregation window startup when in windowed mode (`!document.fullscreenElement`).
   - Invariant: It renders strictly below the blanking layer (`blank === true`), never appears while blanked, immediately dismisses upon `F11` keydown or fullscreen entry, auto-dismisses after 5 seconds, and never becomes persistent room-facing chrome.

2. **Self-Contained Bilingual Fullscreen Guidance Overlay (`src/projected/ProjectorClient.tsx`)**:
   - Scope: strictly `ProjectorClient.tsx` (the room-facing congregation view under `UC-12`).
   - Provider isolation: Projected routes run outside `OperatorUiLocaleProvider`. To prevent coupling or runtime errors, render a self-contained static bilingual cue:
     Text: `"Press F11 for full screen · Tekan F11 untuk layar penuh"`
   - Implement state and lifecycle:
     - `const [showHint, setShowHint] = useState<boolean>(() => typeof document !== 'undefined' ? !document.fullscreenElement : false);`
     - On mount, if not already in fullscreen, start a 5-second timer to auto-dismiss:
       ```ts
       useEffect(() => {
         if (!showHint) return;
         const timer = setTimeout(() => setShowHint(false), 5000);
         return () => clearTimeout(timer);
       }, [showHint]);
       ```
     - Listen to `keydown` event on `window` for `F11` (browser-mode aware: immediate dismissal, without `preventDefault()` so native browser fullscreen proceeds):
       ```ts
       useEffect(() => {
         const onKeyDown = (e: KeyboardEvent) => {
           if (e.key === 'F11') {
             setShowHint(false);
           }
         };
         window.addEventListener('keydown', onKeyDown);
         return () => window.removeEventListener('keydown', onKeyDown);
       }, []);
       ```
     - Listen to `fullscreenchange` DOM event on `document`:
       ```ts
       useEffect(() => {
         const onFullscreenChange = () => {
           if (document.fullscreenElement) {
             setShowHint(false);
           }
         };
         document.addEventListener('fullscreenchange', onFullscreenChange);
         return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
       }, []);
       ```
   - Render overlay component with room-facing safeguards:
     - Positioned fixed at the bottom-center of the screen with `z-40 pointer-events-none`.
     - Placed below the emergency blanking layer (`blank === true` overlays the entire screen at higher z-index so blanked state remains pure black).
     - Interactive badge container has `pointer-events-auto`:
       `bg-black/80 text-white/90 border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm flex items-center gap-2 cursor-pointer`.
     - Display shortcut badge `<kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[11px] font-mono">F11</kbd>` and bilingual instruction text.
     - Clicking the badge dismisses it immediately.

3. **Automated Verification Suite (`tests/congregation-fullscreen-guidance.test.mjs`)**:
   - Assert `ProjectorClient.tsx` includes the F11 fullscreen hint overlay.
   - Assert `keydown` event listener dismisses hint on F11 without calling `preventDefault()`.
   - Assert `fullscreenchange` event listener handles auto-dismissal when entering fullscreen mode.
   - Assert 5-second auto-dismiss timeout is configured.
   - Assert hint does not obstruct or leak through blanking state (`blank === true`).
   - Provide defect injection proofs.

Satisfies `FR-16`, `UC-12`.

**Blocked by:** none

**Status:** done

- [x] In `src/projected/ProjectorClient.tsx`:
      - Implement floating F11 fullscreen hint with dual dismissal (F11 keydown and fullscreenchange) and room-facing safeguards.
- [x] In `package.json`:
      - Register `tests/congregation-fullscreen-guidance.test.mjs`.
- [x] In `tests/congregation-fullscreen-guidance.test.mjs`:
      - Implement contract assertions, static checks, and defect injection proofs.
