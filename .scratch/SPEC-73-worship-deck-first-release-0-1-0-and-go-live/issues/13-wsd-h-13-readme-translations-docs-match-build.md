# 13: [WSD-H-13] README, nine translations, and docs match the release build

**What to build:** In `README.md`, `README.<locale>.md` (all 9 translations), and `docs/*.md`:
1. Align Root `README.md` with Release Build Reality:
   - Present self-hosted server installation as the primary, recommended deployment model; position the Windows desktop installer as "experimental".
   - Remove references to non-existent portable ZIP bundles (`worship-deck-portable.zip`).
   - Remove claims of "38 editable slide templates": slides are authored from scratch or imported from PowerPoint; explain that 38 sample slides are strictly an optional demo mode.
   - Remove references to parser profiles: document dynamic predefined field regexes.
   - Document webhook intake as "coming soon" without fake payload examples.
   - Accurately state platform and runtime prerequisites: Linux (tested on Ubuntu) for server; Windows for desktop installer; macOS not tested; Node.js 22.12+, React 19.
   - Use approved feature nomenclature from WSD-H-12 ("congregation screen", "Layout").
   - Eliminate all em-dashes (`—`) and en-dashes (`–`), adhering strictly to WDI public copy standards.
2. Synchronize 9 Language Translations:
   - Apply identical section ordering, claims, and nomenclature across all nine `README.<locale>.md` translations (`de`, `es`, `fr`, `id`, `ja`, `ko`, `pt`, `ru`, `zh`), retaining existing translation disclaimer banners.
3. Clean Documentation (`docs/`):
   - In `docs/getting-started.md`, `docs/configuration.md`, `docs/features.md`, and `docs/overview.md`: remove claims of portable ZIPs, 38 default templates, speaker notes, countdown timers, and parser profiles.
4. Testing & Guards:
   - Add `tests/readme-claims-guard.test.mjs` asserting that `README*.md` and `docs/*.md` contain zero occurrences of: `WorshipDeckSetup`, `portable.zip`, `(Recommended)` describing the installer, "38 ... templates", "parser profile", U+2014, or U+2013. Verify red first on today's files, then green.
   - Verify that cross-document links in `README.md` pointing to `docs/` remain 100% valid via `tests/doc-citations.test.mjs`.

**Blocked by:** 01-wsd-h-01-release-artifact-names, 05-wsd-h-05-webhook-disabled-in-code, 09-wsd-h-09-installer-ships-corpora-licenses-notices, 12-wsd-h-12-feature-name-list-and-app-labels, 15-wsd-h-15-public-facts-file.

**Status:** open

- [ ] Read `README.md` and docs files (`docs/getting-started.md`, `configuration.md`, `features.md`, `overview.md`).
- [ ] Rewrite `README.md` to prioritize server install, note experimental installer, remove portable ZIPs, templates, and profiles.
- [ ] Synchronize all 9 `README.<locale>.md` files with matching claims and structure.
- [ ] Clean obsolete claims in `docs/*.md`.
- [ ] Add `tests/readme-claims-guard.test.mjs` asserting absence of prohibited claims and dashes. Verify red first, then green.
- [ ] Add `tests/readme-claims-guard.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify `tests/doc-citations.test.mjs` and `npm test` pass cleanly.
