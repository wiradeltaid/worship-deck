# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning is [semantic](https://semver.org/). Below `1.0` the **minor** digit carries the breaking change - `0.1.x` to `0.2.0` is the incompatible step.

Two things depend on the shape of this file, so the headings are not free-form:

- `release.yml` extracts the `## [x.y.z]` section matching the git tag and publishes it as the
  release notes. A tag with no matching section fails the release rather than shipping
  notes nobody wrote.
- The in-app updater or presentation hub shows the section for the version it is offering, so this is what a user
  reads before deciding to update. Write it for them, not for the commit log.

Who may move which digit is a rule, not a convention. Work that needs a minor or major bump
belongs under **Unreleased** and stays there until the owner decides.

## [Unreleased]

## [0.1.0] - 2026-09-22

### Added
- **Rundown Intake & Parsing:** Form-based pasting and secret-gated webhook (`POST /api/webhook`) supporting natural church rundown formats with automated hymn and scripture detection, plus a configurable, Admin-authored parser profile so the recognised rundown shape is not hard-coded.
- **Offline Hymn Resolution:** Shipped Seventh-day Adventist Hymnal (SDAH) corpus (`data/song-book/sdah.json`) automatically expanded into title and verse slides with refrains, with dynamic (non-hymnal) song sets an Admin can define directly.
- **Offline Scripture Lookup:** Local King James Version (KJV) corpus (`data/en/bible-translation/kjv.json`) reconciled into SQLite on startup for zero-network passage projection.
- **Canvas Slide Template Editor:** 28 editable slide templates in SQLite with full WYSIWYG canvas controls (drag, resize, text styling, undo/redo, and resets), plus PowerPoint-faithful text wrapping and 1:1 canvas-to-PPTX geometry parity.
- **Artifact Registry:** Announcement Sets and a Background/Media Library with their own composition, ordering, and grouping, independent of any one week's Service — including asset replacement, custom naming, and announcement-loop dynamic binding.
- **Configurable Intake Forms:** Admin-defined form layouts and a dynamic predefined-field catalog for weekly service intake, expandable without a code change.
- **Dual-Screen Presenter & Projector Modes:** Synchronized operator console (filmstrip, slide run sheet, notes), clean projector second-window display with blanking (`B`), and a Presenter Remote for controlling a running service from a second device.
- **Widescreen 16:9 Slide Geometry:** Native 12192000 x 6858000 EMU PPTX export geometry and 1:1 Canvas-to-PowerPoint layout parity, including modern-widescreen and smart-background handling on PPTX import.
- **Custom Font Import & Embedding:** Multi-file font uploading, variant association, availability/acquisition status tracking, and ECMA-376 font obfuscation for true offline rendering in Microsoft PowerPoint Desktop.
- **Offline PowerPoint Deck Export:** Standalone `.pptx` generator creating downloadable presentation decks runnable without internet or active servers.
- **Authentication & Multi-Role Sessions:** Cryptographic scrypt password hashing, HMAC-SHA256 session cookies with instant revocation, and IP/account brute-force rate limiting.
- **Security & Privacy Baseline:** Published `PRIVACY.md`, `SECURITY.md`, `docs/threat-model.md`, and operator privacy template for self-hosting church administrators.
- **Manual Device Sync (experimental):** Admin-initiated push/pull between two instances, content-addressing shared image assets by SHA-256. Verified for an instance exchanging data with itself; exchanging with a genuinely separate second machine is not yet confirmed end-to-end — see `docs/threat-model.md` §3.7. Shipped alongside an offline desktop installer (Inno Setup) for the same self-hosting workflow.
- **Offline Desktop Installer:** Inno Setup-based Windows installer for running the application without a hosted server.

### Changed
- Announcement/flyer composition and ordering moved fully to the Artifact Registry; the Hub no longer composes or reorders announcement lists (DEC-004).
- Migrated the application frontend from its prior stack to a Go API paired with a React/Vite single-page app.

### Fixed
- A long series of canvas/PowerPoint-export parity fixes: text wrapping and box fidelity, shape anchor positioning, resize and drag interaction UX, and healing/persistence isolation issues between the canvas and generated decks.
