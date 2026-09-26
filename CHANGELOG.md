# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning is [semantic](https://semver.org/). Below `1.0` the **minor** digit carries the breaking change: `0.1.x` to `0.2.0` is the incompatible step.

Two things depend on the shape of this file, so the headings are not free-form:

- `release.yml` extracts the `## [x.y.z]` section matching the git tag and publishes it as the
  release notes. A tag with no matching section fails the release rather than shipping
  notes nobody wrote.
- The presentation hub displays release notes so operators can review changes before deploying.
  Write for operators, not for the commit log.

Who may move which digit is a rule, not a convention. Work that needs a minor or major bump
belongs under **Unreleased** and stays there until the owner decides.

## [Unreleased]

### Changed
- Canonical domain in public documentation and legal texts moved from `wiradelta.id` to `wiradelta.com` (ODR-011); `security@` reporting-channel guard now rejects both domains.

## [0.1.0] - 2026-09-24

### Added
- **Rundown Intake and Parsing:** Form-based pasting supporting natural church rundown formats with automated hymn and scripture detection, with configurable predefined field extraction regexes.
- **Offline Hymn Resolution:** Bundled Seventh-day Adventist Hymnal (SDAH) corpus (`data/song-book/sdah.json`, English) automatically expanded into title and verse slides with refrains, plus dynamic song sets that an administrator can define directly.
- **Offline Scripture Lookup:** Bundled King James Version (KJV) corpus (`data/en/bible-translation/kjv.json`, English) reconciled into SQLite on startup for zero-network passage projection.
- **Canvas Slide Layout Editor:** Clean slide registry in SQLite with full WYSIWYG canvas controls (drag, resize, text styling, undo/redo, and resets), plus PowerPoint-faithful text wrapping and 1:1 canvas-to-PPTX geometry parity. An optional set of 38 sample layouts can be seeded for demonstration.
- **Artifact Registry:** Announcement sets and a background media library with their own composition, ordering, and grouping, independent of any single service.
- **Configurable Service Forms:** Administrator-defined form layouts and dynamic predefined-field catalog for weekly service intake, expandable without code changes.
- **Dual-Screen Presenter and Congregation Output:** Synchronized operator console (filmstrip, slide run sheet, slide navigation grid), clean congregation screen second-window display with blanking (`B`), and a mobile remote interface for controlling a running service from a smartphone on the local network.
- **Widescreen 16:9 Slide Geometry:** Native 12192000 x 6858000 EMU PPTX export geometry and 1:1 canvas-to-PowerPoint layout parity, including widescreen and smart-background handling on PPTX import.
- **Bundled Typography and Custom Font Embedding:** 35 offline font families packaged locally via modular web fonts, plus support for importing custom font files with automated variant pairing and ECMA-376 font embedding for true offline rendering in Microsoft PowerPoint.
- **Offline PowerPoint Deck Export:** Standalone `.pptx` generator creating downloadable presentation decks runnable without internet or active servers.
- **Authentication and Multi-Role Sessions:** First-run administrator onboarding screen, cryptographic scrypt password hashing, HMAC-SHA256 session cookies with instant revocation, and IP/account rate limiting.
- **Security and Privacy Baseline:** Published privacy policy, security policy, threat model, third-party font notices, and operator privacy guidance for self-hosting church administrators.
- **Manual Device Sync (Experimental):** Administrator-initiated push and pull between two instances on the same local network, content-addressing shared image assets by SHA-256. Verified for local communication; cross-machine sync remains experimental.
- **Offline Desktop Installer (Experimental):** Inno Setup-based Windows installer for running the application on a single desktop machine without setting up a dedicated server.

### Boundaries and Limitations
- Bundled hymnbook (SDAH) and scripture (KJV) corpora are currently provided in English.
- Smartphone remote control requires hosting WorshipDeck on a server reachable by devices on the church local network.
- Manual device sync and the Windows desktop installer are experimental features in this initial release.
