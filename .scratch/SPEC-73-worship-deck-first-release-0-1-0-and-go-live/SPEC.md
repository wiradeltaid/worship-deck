# SPEC-73 — WorshipDeck First Release (0.1.0) and Go-Live

## Problem Statement

WorshipDeck is preparing for its initial public release (version 0.1.0) and go-live deployment. A comprehensive pre-launch codebase and copy audit (documented in `D:\Developer\wiradeltaid\ops\research\wdi-ecosystem-strategy\worship-deck\handover-rilis-perdana.md` and `font-bundling-spec.md`) revealed critical gaps across five key domains that contradict approved legal, architectural, and operational commitments:

1. **Release Pipeline and Artifact Names:**
   The Inno Setup installer script (`installer/worship-deck.iss`) and release workflow (`.github/workflows/release.yml`) emit legacy artifact names (`WorshipDeckSetup.exe` and `SHA256SUMS.txt`), contradicting the WDI release artifact standard (`WorshipDeck-<X.Y.Z>-x64-setup.exe` and `SHA256SUMS`). No single public facts file (`docs/public-facts.yaml`) exists for external site consumption.

2. **Desktop Mode, First-Time Setup, and Secrets Management:**
   - The desktop runtime entrypoint (`cmd/api/main.go`) only enters desktop mode if `--desktop` or `DESKTOP=1` is passed, or if the binary name contains `worship-presenter`. The Windows installer currently launches `worship-deck.exe` without arguments, causing installed instances to execute in server mode, placing runtime data in the installation directory rather than `%LOCALAPPDATA%\WorshipDeck\`.
   - `internal/desktop/datadir.go` still references the retired brand `WorshipPresenter` and `Local\WorshipPresenter.SingleInstance`.
   - In desktop mode, `AUTH_SECRET` is not automatically initialized when absent from the environment, causing fresh desktop installations to fail authentication with 503 "Auth not configured". Furthermore, server mode must explicitly refuse execution on startup if example placeholders (such as `change-me`, `change-me*`, or `your-secret-here`) are used for `AUTH_SECRET` or `JWT_SECRET`.
   - The desktop installer provides no initial account; the first administrator must be created via a dedicated loopback setup screen on first boot rather than requiring manual environment variable injection.
   - The legacy `POST /api/webhook` endpoint remains active in default source installations, contradicting the owner's decision to disable webhooks in code for the initial release.

3. **Offline Font Bundling and PPTX Parity (K4):**
   - The operator console and congregation screen currently load 35 font families from `fonts.googleapis.com` via `<link>` tags in `spa/index.html` and `spa/projected.html`, exposing user IP addresses to third parties and violating privacy commitments.
   - PPTX export (`src/lib/fonts/embed-fonts.ts`) downloads TTF fonts from Google Fonts on demand over the network rather than embedding from local bundled assets.
   - Branding SVG assets in `public/branding/` use `@import` rules targeting Google Fonts.
   - Third-party notices and font attributions do not list the 35 bundled font families and their respective SIL OFL 1.1 / Apache 2.0 licenses.

4. **Corpora and Installer Packaging:**
   The Windows installer currently omits `data/`, resulting in missing SDAH hymnbooks and KJV scripture on fresh installs. Meanwhile, source installations erroneously seed 38 demo templates on first boot. Fresh installations must start with an empty registry while providing bundled SDAH and KJV corpora.

5. **Public Documentation, Feature Nomenclature, and Legal Alignment:**
   - Application terminology inconsistently refers to "projector", "proyektor", "templates", "parser profiles", and "Uraikan". Terms must be unified into approved nomenclature: "congregation screen" / "layar jemaat", "operator console" / "konsol operator", "order of service" / "susunan acara", "Baca susunan acara", and "Layout" / "Tata letak".
   - The experimental mockup route `/new` is exposed in production routing.
   - `CHANGELOG.md`, `README.md`, the 9 translated READMEs, and `docs/` contain obsolete claims regarding in-app updaters, portable ZIPs, 38 templates, and parser profiles, and contain em-dashes violating public copy standards.
   - Legal documents (`PRIVACY.md`, `SECURITY.md`, `PRIVACY.id.md`, `SECURITY.id.md`) must be synchronized verbatim with the ops SSOT with official English copy stamps, and `docs/threat-model.md` aligned with actual data deletion semantics, gated by external ops steps C-01 to C-03 and owner date confirmation B-04.

## Solution

Deliver the 16 go-live handover work items (WSD-H-01 through WSD-H-17) across 16 sequenced tickets. Items 01 through 15 represent pre-tag release engineering and copy harmonization; Item 16 (WSD-H-17) is explicitly post-publication work:

1. **Release Artifacts & Facts (WSD-H-01, WSD-H-15, WSD-H-10, WSD-H-17):**
   - Standardize installer output to `WorshipDeck-<X.Y.Z>-x64-setup.exe` and `SHA256SUMS` without unversioned aliases.
   - Establish `docs/public-facts.yaml` linking product version, installer names, font counts (35), and corpora facts.
   - Rewrite `CHANGELOG.md` section `## [0.1.0]` based strictly on release build capabilities, with no internal IDs or dashes.
   - Restructure README (WSD-H-17) strictly after v0.1.0 publication (gated by GitHub release asset availability).

2. **Desktop Runtime & Security (WSD-H-02, WSD-H-03, WSD-H-04, WSD-H-05, WSD-H-09):**
   - Configure installer shortcuts and run actions to pass `--desktop`; resolve data directory to `%LOCALAPPDATA%\WorshipDeck\` with mutex `Local\WorshipDeck.SingleInstance`.
   - Auto-generate cryptographically secure `AUTH_SECRET` in desktop mode if absent from environment, persisted with owner-only permissions; refuse startup in server mode if secrets (`AUTH_SECRET` or `JWT_SECRET`) contain `change-me*` or example defaults.
   - Introduce loopback-only Setup Screen for initial admin account creation when database has 0 accounts, with restricted status inspection.
   - Hard-disable `POST /api/webhook` in code, returning immediate error responses without reading request bodies.
   - Package bundled SDAH and KJV corpora, licenses, and notices in installer; start fresh databases with empty registries (no default templates).

3. **Font Bundling & PPTX Embedding (WSD-H-06, WSD-H-07, WSD-H-08, WSD-H-11):**
   - Bundle all 35 font families locally using `@fontsource` packages; remove Google Fonts `<link>` tags and URL builders.
   - Bundle local TTF font assets for PowerPoint export, removing runtime network font fetching in `embed-fonts.ts`.
   - Convert branding SVGs to path-based artwork or local fonts; produce `THIRD-PARTY-NOTICES` covering all bundled fonts and licenses.
   - Sequence WSD-H-11 after WSD-H-08 to coordinate `ATTRIBUTIONS.md` updates and eliminate file-touch collisions.

4. **Public Text, Nomenclature, & Legal Copies (WSD-H-12, WSD-H-13, WSD-H-14):**
   - Narrow `ATTRIBUTIONS.md` non-monetisation statement to the software and bundled corpora.
   - Unify UI and catalog terms to approved nomenclature ("congregation screen", "operator console", "Layout", "Baca susunan acara"); hide `/new` mockup route.
   - Align `README.md`, 9 translations, and `docs/` with actual build features and limitations (server-first, experimental installer, no portable ZIP).
   - Copy `PRIVACY.md`, `SECURITY.md`, and their `.id.md` counterparts verbatim from ops with copy stamps; update `docs/threat-model.md`, gated by ops C-01 to C-03 and owner B-03/B-04.

## User Stories

1. As an operator running the Windows installer, I want the application to automatically set up its data directory in `%LOCALAPPDATA%\WorshipDeck\`, generate a persistent auth secret, and prompt me to create the initial admin account, so that I can immediately start using WorshipDeck offline without manual terminal configuration.
2. As a church media team projecting lyrics, I want all 35 typography families to render locally without making external network calls to Google Fonts, so that congregation privacy is preserved and presentations work reliably in offline environments.
3. As a church coordinator exporting presentations, I want PowerPoint exports to embed local font assets directly into the `.pptx` file without network access, ensuring visual fidelity on presentation computers.
4. As a public user downloading WorshipDeck, I want clear, unhyped documentation, accurate release checksums, synchronized multilingual READMEs, and verifiable legal notices reflecting actual open-source software rights.

## Implementation & Dependency Decisions (Folded from Advisory Review)

- **Sequencing Rationale for WSD-H-11:**
  While raw notes initially listed WSD-H-11 in the first cohort, both WSD-H-08 (font notices) and WSD-H-11 (attribution scope) modify `ATTRIBUTIONS.md`. In accordance with handover §8.1 line 372 ("digabung PR dengan WSD-H-08 bila lebih rapi") and method rule `parallel-tickets-blocked`, sequencing WSD-H-11 downstream of WSD-H-08 eliminates branch collisions and provides clean, atomic commit boundaries for legal notices.
- **External Release Gates:**
  - WSD-H-14 explicitly declares non-ticket external blockers: ops legal updates C-01 (effective date), C-02 (first-admin security fact), C-03 (cross-language links), B-03 (GitHub private vulnerability reporting), and B-04 (owner-confirmed go-live date).
  - WSD-H-17 is formally classified as post-publication work, gated by release tag v0.1.0 publication (B-07), and excluded from pre-tag sign-off gates.
- **Strict Startup-Path Secret Guards:**
  Server-mode validation rejects any startup attempt where `AUTH_SECRET` or `JWT_SECRET` contains `change-me`, `change-me*`, `your-secret-here`, or common insecure defaults. Tested directly in startup routines.
- **Approved Feature-Name SSOT:**
  The complete feature-name list is locked:
  - English: "congregation screen", "operator console", "Layout", "order of service" (in prose).
  - Indonesian: "layar jemaat", "konsol operator", "Tata letak", "susunan acara", "Baca susunan acara" (button).

## Testing Decisions

- **Automated Absence Guards (Proven Red First):**
  - `tests/release-artifact-names.test.mjs`: asserts absence of `WorshipDeckSetup` and `SHA256SUMS.txt`.
  - `tests/desktop-mode-guard.test.mjs`: asserts absence of `WorshipPresenter` across codebase.
  - `tests/bundled-fonts-guard.test.mjs`: asserts complete absence of `fonts.googleapis.com` and `fonts.gstatic.com` across SPA HTML, source, and SVGs.
  - `tests/operator-i18n-guard.test.mjs`: asserts absence of "projector", "proyektor", "Uraikan", and "Template" in UI catalogs.
- **Go Unit & Startup Integration Tests:**
  - `internal/desktop/desktop_test.go`: verifies data directory resolution and single instance mutex.
  - `internal/auth/session_test.go` & startup tests: verifies auto-generation of desktop auth secret, failure handling for malformed secret files, and process exit rejection of placeholder secrets (`change-me*`, `your-secret-here`).
  - `internal/httpapi/auth_test.go` & `internal/gate/gate_test.go`: verifies loopback setup screen endpoint security and restricted status inspection.
  - `internal/httpapi/webhook_test.go`: verifies disabled webhook error behavior and unread body reader.
- **Staging & Packaging Verification:**
  - Verify `dist-desktop` and installer payload staging include SDAH, KJV, licenses, and notices.
  - Execute full test suite via `npm test` and `go test ./...`.
