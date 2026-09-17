---
type: design-system
scope: _platform
status: draft
created: '2026-08-19'
updated: '2026-08-19'
name: Worship Presenter Web
description: Operator hub for preparing and projecting a worship service.
---

# Design system — operator chrome

Tokens and base components for Hub and Presenter **operator** surfaces. The Congregation screen is the Artifact Registry, not this file.

As-built: shadcn/ui (base-nova) + Tailwind 4. Target UI is the React SPA (DEC-003); tokens stay here. Zero brand hue in `globals.css` tokens. `wdi-ux` was not run; this file is extracted so the archive can retire (DEC-001).

## Tokens (from `src/globals.css`)

Light: background `oklch(1 0 0)`, foreground `oklch(0.145 0 0)`, primary `oklch(0.205 0 0)`, primary-foreground `oklch(0.985 0 0)`, muted `oklch(0.97 0 0)`, muted-foreground `oklch(0.543 0 0)`, border `oklch(0.922 0 0)`, ring `oklch(0.708 0 0)`, destructive `oklch(0.577 0.245 27.325)`.

Dark: background `oklch(0.145 0 0)`, foreground `oklch(0.985 0 0)`, primary `oklch(0.922 0 0)`, destructive `oklch(0.704 0.191 22.216)`.

Typography: Geist Sans / Geist Mono via `@fontsource/geist-sans` and `@fontsource/geist-mono`, imported in the SPA entry stylesheet and bound through `:root --font-geist-sans` / `--font-geist-mono` in `src/globals.css`. Radius `--radius: 0.625rem`.

## Contrast on load-bearing combinations

Measured 2026-08-03 (Story 17.2), light theme. Reproduced from `globals.css` in `tests/theme-chrome.test.mjs`.

| Combination | sRGB | Measured | WCAG |
| --- | --- | --- | --- |
| `foreground` on `background` | `#0a0a0a` on `#ffffff` | **19.80:1** | AAA |
| `primary-foreground` on `primary` | `#fafafa` on `#171717` | **17.18:1** | AAA |
| `muted-foreground` on `background` | `#6f6f6f` on `#ffffff` | **5.02:1** | AA |
| `muted-foreground` on `muted` | `#6f6f6f` on `#f5f5f5` | **4.61:1** | AA |

Story 17.2 changed `:root --muted-foreground` from `oklch(0.556 0 0)` to `oklch(0.543 0 0)`.

#### The same four pairs in the dark palette

**Measured 2026-07-30**, same method. Story 17.1 (AC-6).

| Combination | sRGB | Measured | WCAG |
| --- | --- | --- | --- |
| `foreground` on `background` | `#fafafa` on `#0a0a0a` | **18.97:1** | AAA |
| `primary-foreground` on `primary` | `#171717` on `#e5e5e5` | **14.23:1** | AAA |
| `muted-foreground` on `background` | `#a1a1a1` on `#0a0a0a` | **7.66:1** | AAA |
| `muted-foreground` on `muted` | `#a1a1a1` on `#262626` | **5.86:1** | AA (not AAA) |

The dark palette passes all four of these pairs. The two themes hold independent `--muted-foreground` values.

Untokenized hues (amber, leftover red tints, emerald, indigo, sky) and non-text contrast (border 1.4.11) remain recorded design debt. Service-form warning and error banners use `text-destructive` and amber-950/amber-100 pairs so they stay readable on both light and dark hosts.

## Components

shadcn/ui (base-nova), generated into `src/components/ui/`. Add primitives with `npx shadcn@latest add <name>`; `components.json` points at `src/globals.css` (`rsc: false`).

**Installed:** `alert`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `select`, `separator`, `sonner`, `textarea`.

**Operator chrome rule:** Hub, admin, service-edit, and Presenter operator surfaces compose UI from `@/components/ui/*` — not hand-rolled `<button>`, `<select>`, `<textarea>`, or text `<input>`. `tests/operator-shadcn-guard.test.mjs` enforces this on every change.

**Exemptions:**

- **Top navbar** — `Header.tsx` and `ThemeToggle.tsx` keep bespoke pill layout and profile trigger styling.
- **Native file picker** — `<input type="file">` (`ImageUploadField`, flyer upload helpers, announcements upload).
- **Color wells** — `<input type="color">` in `ArtifactEditor` (no shadcn equivalent).

Presenter `<Select>` controls that hand keyboard focus back to the deck call `blurFocusedControl()` after `onValueChange` (`PresenterOperator`).

Slide geometry is Registry, not a `slide-surface` CSS class.

## Create-action buttons (DEC-009)

Every button whose sole job is to create a new entity or insert a new item renders with `Button`
`variant="default"` (the primary token) — never `secondary`, `outline`, or a bespoke muted style. A
disabled state uses the `Button` `disabled` prop, never a manually chosen gray. `default` is already
`buttonVariants`' fallback (`src/components/ui/button.tsx`) — a create-action button needs no
`variant` prop at all, only no *override* of it. In dark mode `primary` is a near-white token
(`oklch(0.922 0 0)`, § Tokens); pairing it with a hardcoded `text-white` instead of the variant's own
`text-primary-foreground` renders unreadable, not merely low-contrast — this was the actual W11 bug
DEC-009 fixes, not a missing token.

## "New" vs "Add" vs "Insert" (DEC-010)

A create-action button reads **"New"** when it starts a top-level entity that needs its own identity
(name/code) filled in before it exists — e.g. "New Song Set", "New Announcement Set". It reads
**"Add"** when it inserts one more item into a collection whose context is already open and
named — e.g. "Add Slide", "Add Placeholder", Main Spine's "New Slide" panel's own `+ Add` button
(the slide *kind* is chosen by the dropdown next to it first). **"Insert" is retired** from the
product vocabulary — nothing is relabelled to it, and an existing use renames to "New" or "Add" per
this rule.

## Per-slide title area (DEC-011)

Every per-slide title area in the Registry canvas editor — Main Spine's own slide, a Song Set's
Title/Verse/Reff sub-slide, an Announcement Set's slide-in-set — keeps its own Rename action (its
display name is not its parent's name). Reset and Save move under a "Canvas:" label instead of
standing beside Rename as peer buttons: `[Rename] | Canvas: [Reset] [Save]`, switching to
`[Cancel] [Save] | Canvas: [Reset] [Save]` while rename is active.
