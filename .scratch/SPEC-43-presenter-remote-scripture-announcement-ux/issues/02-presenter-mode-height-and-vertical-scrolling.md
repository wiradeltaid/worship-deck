# 02: Presenter Mode Height Relaxation and Vertical Scrolling

**What to build:**
Remove restrictive viewport height clamping (`lg:h-dvh lg:overflow-hidden`) from the presenter operator console, establish minimum display heights for the Current/Next stages and slide navigation list, and enable natural vertical scrolling on standard laptop displays without breaking the tuned `--presenter-stage` sizing formula.

**Blocked by:** 01 (Remote Code Generator Bugfix and Presenter Header UX)

**Status:** closed

- [x] Remove `lg:h-dvh` and `lg:overflow-hidden` from the presenter operator outer container, enabling page-level vertical scrolling (`min-h-dvh flex-col overflow-y-auto`).
- [x] Preserve the `--presenter-stage` geometry derivation (`calc((100dvh - 30rem) * 16 / 9)`) while ensuring the `24rem` minimum floor keeps the slide stage readable and proportioned.
- [x] The slide navigation strip on the right maintains dedicated scroll containment without creating nested scroll traps.
- [x] Transport action buttons (Prev, Next, Auto Loop, Blank) remain reachable and visible without clipping across 768px, 900px, and 1080p screen heights.
- [x] On constrained viewports (< 850px height), page vertical scrolling allows operators to view both the complete stage and all transport/action controls comfortably.
