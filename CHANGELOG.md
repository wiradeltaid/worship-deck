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

## [0.1.1] - 2026-10-01

### Added
- **Bilingual Windows Installer:** The Windows desktop installer now natively supports Indonesian alongside English, automatically following the operator's Windows display language while retaining the official English MIT license text.
- **Dual-Hash PowerPoint Image Embedding Parity:** Full discrete dual-hash support (64-hex SHA-256 and 32-hex legacy MD5) across uploaded images. Sermon graphics, family photos, youth photos, and announcement slide backgrounds uploaded with modern SHA-256 addressing now embed cleanly into exported `.pptx` decks without fallback placeholder boxes.
- **Orphaned Upload Cleanup for SHA-256 Assets:** Deleting a worship service now correctly unlinks and cleans up associated SHA-256 uploaded media files from disk, preventing disk bloat.

### Changed
- **Documentation Restructure:** Post-release alignment of public repository documentation, threat model data sync disclosures, and owner-approved privacy and security policies.

### Boundaries and Limitations
- Direct cloud Microsoft OneDrive OAuth sync has been retired and marked abandoned; operators syncing presentations to OneDrive should save or direct exports to their local Windows OneDrive synchronized folders, which provides reliable, offline-safe cloud syncing without requiring Microsoft Entra ID or Azure application registration.

## [0.1.0] - 2026-09-28

### Added
- **Rundown Intake and Parsing:** Form-based pasting supporting natural church rundown formats with automated hymn and scripture detection, with configurable predefined field extraction regexes.
- **Offline Hymn Resolution:** Bundled Seventh-day Adventist Hymnal (SDAH) corpus (`data/song-book/sdah.json`, English) automatically expanded into title and verse slides with refrains, plus dynamic song sets that an administrator can define directly.
- **Offline Scripture Lookup:** Bundled King James Version (KJV) corpus (`data/en/bible-translation/kjv.json`, English) reconciled into SQLite on startup for zero-network passage projection.
- **Canvas Slide Layout Editor:** Clean slide registry in SQLite with full WYSIWYG canvas controls (drag, resize, text styling, undo/redo, and resets), plus PowerPoint-faithful text wrapping and 1:1 canvas-to-PPTX geometry parity. An optional set of 38 sample layouts can be seeded for demonstration.
- **Artifact Registry:** Announcement sets and a background media library with their own composition, ordering, and grouping, independent of any single service.
- **Configurable Service Forms:** Administrator-defined form layouts and dynamic predefined-field catalog for weekly service intake, expandable without code changes.
- **Dual-Screen Presenter and Congregation Output:** Synchronized operator console (filmstrip, slide run sheet, slide navigation grid), clean congregation screen second-window display with blanking (`B`), and a mobile remote interface for controlling a running service from a smartphone on the local network.
- **Widescreen 16:9 Slide Geometry:** Native 12192000 x 6858000 EMU PPTX export geometry and 1:1 canvas-to-PowerPoint layout parity, including widescreen and smart-background handling on PPTX import.
- **Bundled Typography and Custom Font Embedding:** Offline font families packaged locally via modular web fonts, expanded with additional curated presentation typefaces, plus support for importing custom font files with automated variant pairing and ECMA-376 font embedding for true offline rendering in Microsoft PowerPoint. An optional word-wrap toggle controls whether exported PowerPoint text boxes wrap natively.
- **Offline PowerPoint Deck Export:** Standalone `.pptx` generator creating downloadable presentation decks runnable without internet or active servers.
- **Authentication and Multi-Role Sessions:** First-run administrator onboarding screen, cryptographic scrypt password hashing, HMAC-SHA256 session cookies with instant revocation, and IP/account rate limiting.
- **Security and Privacy Baseline:** Published privacy policy, security policy, threat model, third-party font notices, and operator privacy guidance for self-hosting church administrators.
- **Offline Desktop Installer:** Inno Setup-based Windows installer for running the application on a single desktop machine without setting up a dedicated server, packaged as a native WebView2 desktop window with its own taskbar and window icons rather than a browser tab. The installer is available in English and Indonesian and follows the Windows display language; the license text shown is the English MIT license in both. The installer shows the MIT license text before installing and, on uninstall, asks whether to also remove locally stored service data, or keep it for a future reinstall.
- **In-App About Panel:** A legal About panel inside the app itself, reachable from the operator console, showing the app version, publisher, MIT license, a note that hymn texts are separately licensed, and a support contact.
- **Desktop Appearance:** The desktop app's title bar follows Windows dark mode, and the congregation screen shows a brief one-time hint on how to enter full screen (`F11`) the first time it opens.
- **Slide Visibility Toggle:** An eye icon in the run sheet lets the operator hide a slide for one run without deleting it: a hidden slide is skipped on the congregation screen and left out of the exported PowerPoint deck, and can be unhidden the same way.
- **Emergency Canvas Designer:** A visual, in-the-moment canvas for drafting a replacement slide during a service, including uploading a background image and cropping it to the 16:9 congregation screen, alongside a general offline presentation resilience mode: if the server briefly becomes unreachable mid-service, the presenter keeps projecting from a local cached copy of the rundown, with local emergency edits saved and applied without a live server connection.
- **Separate Default Backgrounds:** Songs and liturgy/scripture slides can each fall back to their own default background image, instead of sharing one background across every slide type.
- **Bilingual Service Editing and Presenting:** English/Indonesian parity, checked by automated dictionary tests, across the service editor's run sheet header, offline and emergency-edit banners, song-set lyric actions, slide visibility controls, and the presenter console.
- **Cross-Machine Cloud Sync (Experimental):** Administrator-initiated push and pull between any two WorshipDeck servers the church controls (for example, a laptop and the church's own server), authenticated on demand with credentials held only in memory for that session, content-addressing shared image assets by SHA-256, and an interactive conflict resolution dialog (keep local, use remote, or save both) when a rundown was edited on both sides. Sync is entirely operator-directed: nothing is pushed or pulled automatically, and the destination is always a WorshipDeck server address the operator enters themselves, never a Wira Delta Indonesia service.
- **Factory Reset:** From the same Sync screen, an administrator can delete all services, announcements, backgrounds, slide layouts, and uploaded images and return the instance to its built-in starting data by typing `factory reset` to confirm, for repurposing a machine or clearing a demo instance. Accounts, settings, and uploaded fonts are kept, and the reset cannot be undone.

### Changed
- Canonical domain in public documentation, legal texts, and the in-app About panel is now `wiradelta.com`; the `security@` reporting-channel guard rejects both retired domains.

### Boundaries and Limitations
- Bundled hymnbook (SDAH) and scripture (KJV) corpora are currently provided in English.
- Smartphone remote control requires hosting WorshipDeck on a server reachable by devices on the church local network.
- Cross-machine cloud sync and the Windows desktop installer are experimental features in this initial release.
- The Sync screen (cross-machine sync and factory reset) is in English only, except for its Factory Reset confirmation dialog.
