# Deferred Work

Last hygiene pass: **2026-07-19** (see [`audit-code-doc-epic-bmad-flow-2026-07-19.md`](./audit-code-doc-epic-bmad-flow-2026-07-19.md)).

## Resolved (shipped — do not treat as open blockers)

Items below were open after the Jules / post-merge reviews; Epic 6+ closed them in code.

| Former open item | Closed by | Evidence |
|------------------|-----------|----------|
| Zero automated tests | Story **6.6** | `package.json` `test`; `tests/*.test.mjs` |
| PPTX image SSRF (scheme-only check) | Story **6.7** (+ Epic **13.3**) | `src/lib/images.ts` host allowlist for remote URLs; hub-local `/api/uploads/...` exception |
| `better-sqlite3` / cwd DB / production harden | Story **6.8** | `DB_PATH`, WAL/busy timeout, deploy notes |
| Hymn-to-Part A/B positional-only mapping | Story **6.4** | Section-aware hymn mapping |
| Standing liturgy "We Have This Hope" title-only | Story **6.3** | `resolveWeHaveThisHope()` + lyric slides in `slide-plan` |
| FR-6 theme/verse/family graphic slots + much of FR-4 standing structure | Stories **6.3** / **6.4** + Epic **7** | Slide-plan Part A/B/C |
| Shared Basic Auth as sole FR-18 path | Story **6.2** | Per-person admin/operator accounts |
| picoclaw skill package missing | Story **6.5** | `.claude/skills/picoclaw-webhook/SKILL.md` |
| Intercessory standing hymns `#671` / `#684` | Spec **close-audit-product-partials** | `resolveIntercessoryStandingHymns()` + divider→671→divider→684 in `slide-plan` |
| Empty Part C Announcements title when flyers empty | Spec **close-audit-product-partials** | `announcements` id gated on non-empty `isAnnouncementImageUrl` flyers |
| Extensionless / video announcement URLs accepted | Spec **close-audit-product-partials** | `assertAnnouncementImageUrl` + flyer filter require image pathname extension |
| Login has no rate limiting / lockout | Spec **auth-hardening-rate-limit-and-revocation** | `src/lib/auth/rate-limit.ts` + `login_attempts`; 5/username and 20/IP per 15 min → `429` + `Retry-After`; `tests/auth-rate-limit.test.mjs` |
| Logout / password change do not revoke issued cookies | Spec **auth-hardening-rate-limit-and-revocation** | `sid` + `tv` in the session payload, `revoked_sessions` + `accounts.token_version`, enforced at the gate in `src/proxy.ts` (Node.js runtime); `tests/auth-revocation.test.mjs` |

Historical source reviews: code review `jules main...2d87307` (2026-07-18); specs `spec-phase1-hymnal-fr4-parser.md`, `spec-6-1-*`, `spec-6-2-*`.

## Still open

### Product / FR gaps

- source_spec: `_bmad-output/implementation-artifacts/spec-6-1-persistent-announcement-list.md`  
  summary: Service EditForm still edits legacy `images_payload` while PPTX prefers Announcement List when non-empty.  
  evidence: Dual-path intentional for migration; richer FR-11 edit surface still open.

- source_spec: FR-19 / Story **12.1**
  owner: **Epic 21 / Story 21.1** (`21-1-verse-database-ships`) — assigned 2026-08-01 by `bmad-correct-course`
  summary: The KJV corpus reaches no fresh clone at all.
  evidence: Restated 2026-08-01 after measuring, because the previous wording — *"import remains an operator/ops path"* — reads as an inconvenience when it is a feature that cannot run. `bible_books` and `bible_verses` are created by the startup DDL (`src/lib/db/index.ts:156-171`) and have **no writer** outside `scripts/import-kjv.mjs`, which reads the git-ignored `.work/tp_bible_*.json`. A fresh clone therefore ships FR-19's UI, its API route and its empty-corpus message, and no corpus. The export holds 31,102 verses across 66 books — the canonical count — and normalises to ≈4.3 MB against 14.5 MB raw. Owner decision the same day: commit it at `data/bible/kjv.json` as the default seeder corpus, and delete the export only once the completeness assertion is green.
  resolved: **2026-08-01, Story 21.1.** `data/bible/kjv.json` (4.36 MB) is committed and `seedBibleCorpus()` fills an empty database on first boot in ~258 ms. Completeness is asserted structurally in `tests/corpus.test.mjs` and `npm run corpus:verify` — 66 books / 1,189 chapters / 31,102 verses, every chapter dense from verse 1 — rather than sampled, which is what let this sit unnoticed from 2026-07-19. The ordering held: assertion green, then a full round-trip comparison of all 31,102 verses and 66 book name pairs against the export, then deletion. `scripts/import-kjv.mjs` is retired. **Open behind it:** the `'KJV'` literal in `lookupScripture()` (Story 21.2) and the default-translation setting (Story 21.3).

- source_spec: `_bmad-output/implementation-artifacts/spec-close-audit-product-partials.md`
  summary: **Blocked on a product decision, not on code.** Part C Announcements title is gated correctly but flyer image slides still appear after standing Part C slides (not a contiguous Announcements block).
  evidence: Two canonical sources contradict each other about the same worship deck. `_bmad-output/specs/spec-slide-artifact-model/artifact-catalog.md` — a SPEC companion, and the authority for product behaviour — documents Part C as `announcements` (1), `welcome-repeat` (2), `offering-tithe` (3), `midweek-prayer` (4), `fellowship-etiquette` (5), `contact` (6), `family-youth` (7), `flyer-*` (8–N), `thank-you` (N+1), which is exactly what `slide-plan.ts` emits. Reordering silently would change what the congregation sees on a Sabbath, so it needs the project lead to pick a source, not an unattended code change. Explicitly out of scope for spec `auth-hardening-rate-limit-and-revocation` (2026-07-26).

### Ops / security leftovers

- source_spec: `_bmad-output/implementation-artifacts/spec-phase1-hymnal-fr4-parser.md`
  owner: **Epic 22** — licence and corpus move to `22-1-song-book-ships-with-book-code`, titles to `22-2-hymn-title-is-a-title`; assigned 2026-08-01 by `bmad-correct-course`
  summary: The SDAH corpus is unattributed, unreproducible, and its titles are lyric lines.
  evidence: **Licence closed by owner decision 2026-08-01** — the lyrics ship with attribution to the copyright holder and a stated willingness to take them down on request, an accepted risk rather than a review outcome. Two things were found while verifying this entry that it did not record. (1) `.work/lirik-lagu.json`, the only source `scripts/import-hymnal.mjs` can read, **does not exist anywhere under the project root**, so the committed output is the last surviving copy and `npm run import:hymnal` cannot run at all. (2) `deriveTitle()` (`import-hymnal.mjs:23`) stores the first lyric line after a `Verse` header — by design, per `:115` of this same spec, because the dump carried no title column. SDAH #522 is stored as *"My hope is built on nothing less"* rather than *"The Solid Rock"*; 40 of 695 titles exceed 45 characters. That matters beyond tidiness: PRD `:120` makes the resolved-title readback the only defence against a valid-but-wrong SDAH number, and a readback echoing a lyric line is not a check a human can fail. The owner will supply the number→title list (tracked in `sprint-status.yaml` action items). **For the title half, the fuller record is the 2026-08-01 section at the end of this file** — it enumerates the four consumer boundaries and the test impact, and is owned by the same Story 22.2; this entry keeps the licence and the missing-source halves, which that section does not cover.
  resolved: **2026-08-01, Stories 22.1 + 22.2.** All three halves are closed. *Attribution:* the corpus at `data/song-book/sdah.json` carries `book.attribution` and `book.licence` with the takedown offer, inside the file, so the statement travels with the data and not only with `ATTRIBUTIONS.md`. *Reproducibility:* accepted rather than repaired — the source is gone, so `import:hymnal` is **retired** and the committed corpus is the source of record; `npm run corpus:verify` asserts it is whole instead of pretending it can be rebuilt. *Titles:* the owner supplied the 695-entry index the same day; every title now comes from it, none exceeds 45 characters (40 did), and `tests/corpus.test.mjs` pins the four hardest cases. Four index entries the lyrics contradict were left **verbatim** and raised as an owner decision — see `sprint-status.yaml` action items.

- source_spec: code review jules main...2d87307  
  summary: Concurrent first-boot hymn seed UNIQUE race.  
  evidence: Rare under single-process Next.js; harden if multi-instance deploy.

## Deferred from: spec-auth-hardening-rate-limit-and-revocation (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: `scripts/smoke-auth.mjs` carries two stale checks that predate this change and already failed at baseline `c0c3ecb` — `no bible/kjv imports in src/` (the guard's own regex matches `src/app/api/scripture/route.ts`, which legitimately imports `isKjvCorpusEmpty`) and `operator can access hub` (asserts the literal `Worship Hub`, a string that no longer appears anywhere under `src/`).
  evidence: `git grep -l "Worship Hub" HEAD -- src/` returns nothing at the pre-change commit. Left untouched rather than masked; the four session-gate checks in the same script pass.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: The client address used for IP rate limiting is taken from request headers (`cf-connecting-ip`, then leftmost `x-forwarded-for`, then `x-real-ip`), all of which a direct caller can forge, so the 20-per-IP threshold is evadable by header rotation.
  evidence: Documented as best-effort in `src/lib/auth/client-ip.ts`. Review replaced the global per-username lockout with `(username, address)` pair scoping, so the address is now part of the primary key rather than a secondary check; a header the caller controls therefore buys extra attempts against one account. Only values that parse as a real IPv4/IPv6 address are used as keys, and the shared unknown bucket is never counted, so the failure mode is extra attempts rather than a lockout of third parties. Closing it properly needs the real socket address, which Next does not expose to a Proxy.

## Deferred from: code review of 14-1-worship-web-input-boundary (2026-07-19)

- Duplicate-date race without UNIQUE(`services.date`) on concurrent POSTs — deferred; CAP-4 decision **2a** allows multiple service rows for the same date by design.
- PUT edit can move a service onto another service’s date without collision check — deferred; create-path CAP-4 is primary; optional warn-on-edit follow-up.
- Fat `src/app/api/services*` route handlers / `any` typing — style debt from Antigravity bypass; extract to `src/lib/*` in a follow-up refactor.

## Deferred from: code review re-run of 14-1-worship-web-input-boundary (2026-07-19)

- Concurrent POST same-date TOCTOU without UNIQUE — acceptable under CAP-4 multi-row design.
- Full `hymnIndex` (~695) embedded in create/edit page HTML — follows decision 5a; lazy/chunk later if payload size matters.

## Deferred from: code review of 14-2-worship-web-input-ux-refinements.md (2026-07-19)

- failedHymnNumbers wiped on preview error � deferred, pre-existing [src/app/services/new/CreateForm.tsx]


## Deferred from: spec-16-2-artifact-pipeline-completion (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: Existing production databases keep the OLD rows for `welcome`, `verse-reading`, `special-song`, `family-youth` and `bible-verse-contemplation`; the seed content fixes reach them only via a fresh DB or an admin reset of those five templates.
  evidence: Startup seeding is missing-only by design (Story 16.1 AC-16.1-001), so a corrected seed never overwrites a persisted row. `welcome` additionally changed `baseType` `general` → `text-placeholder` to carry the optional `date` placeholder.

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: Live Preview still shows `title`/`subtitle` from hardcoded strings in `slide-plan.ts`, so an admin editing a template's text changes the deck and projector but not the operator's preview.
  evidence: The legacy `SlidePlanItem` fields were deliberately preserved for consumer compatibility; only the badge labels and grouping were moved onto the registry projection.

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: `preview-model.TEMPLATE_LABELS` is a hand-maintained second list of template ids alongside the request map in `slide-plan.ts`; nothing asserts either stays in sync with `data/default-registry.json`.
  evidence: Adding a seed template silently falls back to a humanized label and is silently absent from the plan; a conformance test over the seed id set would close it.

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: The `verse-reading` template draws a full-bleed opaque black shape over its own `bible-bg.jpg` background, so the background asset is embedded but never visible.
  evidence: Inherited from the v0 source-deck extraction; harmless after media dedup, but the layout carries a contradiction an admin cannot see.

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: A 409 conflict in the artifact editor discards unsaved authored elements; the message is now explicit but there is no merge or recovery path.
  evidence: Reloading the server version remounts the canvas and clears the added-element tracking. A full merge was out of scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: The generated deck is ~10 MB with no automated ceiling on bytes, generation time or peak memory.
  evidence: Registry backgrounds are already-compressed JPEGs; dedup + DEFLATE cut 39 MB to ~10 MB, but only structural properties are asserted, so a future seed asset change could regress size unnoticed.

- source_spec: `_bmad-output/implementation-artifacts/spec-16-2-artifact-pipeline-completion.md`
  summary: `scripts/smoke-deck-fidelity.mjs` carries two pre-existing stale checks that predate this change — `EditForm has structured fields + raw payload` (expects `themeReference` / `familyYouth` / `Raw Telegram text`, none of which exist since the Epic 14 renames) and `structured family update in PPTX` (expects `Youth: Aldi` although split family/youth fields take precedence over the legacy combined `familyYouth`).
  evidence: `themeReference` matches nowhere in `src/`, and `EditForm.tsx` at baseline `338c1a2` already contained zero occurrences of `familyYouth` and `Raw Telegram text`. Left untouched rather than masked.

## Deferred from: spec-epic-14-debt-service-routes-and-hymn-index (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: The date-collision check in `createService` still reads outside the transaction it guards, so two concurrent POSTs for one date can both insert.
  evidence: No `UNIQUE(services.date)` backs the `SELECT id FROM services WHERE date = ?`. CAP-4 decision 2a deliberately allows multiple rows per date, so the 409 is a convenience guard, not an invariant — but the refactor documents the sequence as load-bearing while leaving it non-atomic.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: `updated_at` uses `CURRENT_TIMESTAMP` at second granularity, so two edits landing in the same second both pass the optimistic guard and the first editor's changes are lost.
  evidence: Pre-existing. A sub-second timestamp (`strftime('%Y-%m-%d %H:%M:%f','now')`) or a monotonic version counter would close it.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: `readUpdatedAt` returns `''` when both `updated_at` and `created_at` are NULL, and its `||` fallback diverges from the SQL `COALESCE` when `updated_at` is the empty string — a row in that state can never be updated.
  evidence: Reachable only through direct DB manipulation today; `tests/services-lib.test.mjs` exploits the same seam deliberately to reach the in-transaction conflict branch.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: A successful `PUT` does not invalidate the cached generated PPTX for that service, so a stale deck can stay on disk after an edit.
  evidence: `src/lib/pptx-cache.ts` exposes no invalidation function; only the pptx download route and admin settings touch the cache. Explicit non-goal of this refactor.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: `deleteService` removes the row (and cascades `announcement_items`) but never reclaims upload files referenced only by that service's `images_payload`.
  evidence: FR-10 asks for one-off asset cleanup on delete. Explicit non-goal of this refactor.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: There is still no `GET /api/services/[id]`; clients must list and filter to read one service.
  evidence: Only `DELETE` and `PUT` exist on that route. Explicit non-goal of this refactor.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: `GET /api/hymns?all=1` is now dead code and still returns the unbounded ~40 KB hymn dump this change removed from the page payload.
  evidence: Nothing in `src/` calls it after the seed refactor. Kept because removing it is an explicit spec non-goal; revisit once a legacy caller is confirmed absent.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-14-debt-service-routes-and-hymn-index.md`
  summary: In the hymn autocomplete, a `?numbers=` lookup that returns no row (typo hymn 9999) and one that fails are both rendered as a bare number, and neither is retried.
  evidence: Cosmetic today because the seed covers every stored value on the edit page; only the create-page Parse-hydrate path can hit it.

## Deferred from: spec-auth-hardening-rate-limit-and-revocation (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: A distributed attacker now gets 5 attempts per source address against one username instead of 5 in total, because the lockout is scoped to the (username, address) pair.
  evidence: Deliberate trade-off made during review. The global per-username counter it replaces let any single host deny the admin account permanently at one request per 2.5 minutes, which is the worse outcome for a hub that must work at a fixed hour on Sabbath morning. Cloudflare is the volumetric layer in front.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: Reaching a 429 remains a weak activity oracle: an attacker who parks a (username, address) pair at the threshold can infer from an early 401 that the real owner just signed in successfully and cleared the ledger.
  evidence: Inherent to any lockout that clears on success. Much narrower after pair scoping than with the global username counter, since the attacker can only observe pairs on their own address.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: `/api/webhook`, the other internet-exposed unauthenticated endpoint, still has no throttling and compares its secret with `!==` rather than a constant-time comparison.
  evidence: `src/lib/webhook-auth.ts`; the route is exempt from the gate by design (`src/proxy.ts` matcher). Out of scope here because the spec forbids changing the webhook auth mechanism, but it is the same class of gap this spec closed on login.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: Nine API routes and the gated pages carry no in-route authorization and rely entirely on the proxy gate.
  evidence: `/api/services*`, `/api/hymns`, `/api/scripture`, `/api/announcements`, `/api/upload`, `/api/uploads/[filename]` contain no `requireSession` call. The Next docs (`proxy.md:219`) recommend verifying inside each route as well. `tests/proxy-matcher.test.mjs` now pins the matcher, and the six gated pages were moved onto the DB-checked path, but the APIs still have a single enforcement layer.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: A rotating-key flood (fresh username and fresh forwarded address per request) never trips either threshold, so each request still runs a synchronous scrypt plus several SQLite statements on the single Node thread.
  evidence: The login route was entirely unthrottled before this change, so this is not a regression in reachability, but the added DB work makes each unthrottled request more expensive. `login_attempts` is capped at 5000 rows so the table cannot grow without bound.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: `scripts/smoke-auth.mjs` has two pre-existing failing checks unrelated to this change - a KJV-import regex that matches the legitimate `isKjvCorpusEmpty` import in `src/app/api/scripture/route.ts`, and an assertion on the literal string `Worship Hub`, which is absent from `src/` at HEAD too.
  evidence: Confirmed against the baseline with `git grep -l "Worship Hub" HEAD -- src/`. Left unmasked rather than edited to pass.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-hardening-rate-limit-and-revocation.md`
  summary: `docs/architecture.md:79` and `docs/development-guide-monolith.md:86` still describe the request gate as "middleware" in prose.
  evidence: Neither links the deleted `src/middleware.ts`, so nothing is broken; `docs/index.md` and `docs/source-tree-analysis.md` were corrected to point at `src/proxy.ts`.

## Deferred from: spec-presenter-powerpoint-and-deck-fidelity (2026-07-26)

Deck-parity gaps this change deliberately leaves. All were found by the paint-order audit of `260704 - BIC Worship Presentation.pptx` and `July 18 - BIC PPT 2026.pptx (Presentation).pptx`. The three divergences the registry vocabulary *can* express were fixed in `data/default-registry.json` and are not listed here: the `fellowship-etiquette` sentence the deck hides behind its own full-bleed picture, the `song-set` title cover geometry (`[0, 60.39, 100, 39.61]`, matching `asset-map.json` `coverFraction: 0.3961`), and `welcome-repeat.e2.h` (`6.19`).

- source_spec: `_bmad-output/implementation-artifacts/spec-presenter-powerpoint-and-deck-fidelity.md`
  summary: `offering-tithe` shows the plate’s empty gold frame, because the deck’s QR code has no registry element and the asset it would reference was never extracted.
  evidence: Both decks paint `ppt/media/image11.jpeg` at `[82.92, 63.33, 14.13, 25.93]` over `offering-bg.png`. The template’s `layouts.default.elements` are `e1`/`e2`/`e3`, all `text` (title, bank name, account number) — there is no `image` element. `data/asset-map.json` has no entry for `image11` and `public/assets/` holds no QR file, so `isRegistryImageRef` (which admits only `/assets/...` refs) has nothing to point at. Closing this needs an asset-extraction step first, then an `image` element — not a seed edit alone.

- source_spec: `_bmad-output/implementation-artifacts/spec-presenter-powerpoint-and-deck-fidelity.md`
  summary: `family-youth` diverges from the deck three ways — two translucent scrim panels are missing, the family and youth *name* lines have no element at all, and the rotated “Prayer Request” label renders horizontally.
  evidence: (a) The deck draws two `solidFill 2F3B2D` panels at 35.7% and 80.4% behind the text columns; the template has no `shape` element at all. This part *is* expressible today (`shape` + `style.fillColor` + `style.opacity`, honoured by `ShapeElement` in `src/components/artifacts/ArtifactSlide.tsx` and by `toPptxTransparency` in `src/lib/pptx.ts`), so it is scope, not vocabulary. (b) Element ids run `e1, e3, e4, e5, e7, e8, e9, e10, e11` — `e2` and `e6` are absent, and they are exactly the family-name and youth-name lines (`asset-map.json` slide 56 evidence records “TheExampleFamily(…)’s Family”). The `familyText`/`youthText` placeholders bind to `e7`/`e9`, the prayer-request bodies, so the name lines are unreachable from any placeholder. (c) `e4` is stored at `[-14.44, 49.56, 42.01, 8.54]` — the *unrotated* box of a label the deck rotates −90°. `ALLOWED_ELEMENT_KEYS` and `ALLOWED_STYLE_KEYS` in `src/lib/registry/validate.ts` carry no rotation property, so this is a genuine Block If under the spec’s “do not invent a property” rule: it renders horizontally and its negative `x` pushes it off the left edge.

- source_spec: `_bmad-output/implementation-artifacts/spec-presenter-powerpoint-and-deck-fidelity.md`
  summary: `verse-reading` renders roughly twice as bright as the deck, because the deck’s 50% picture alpha cannot be expressed where the picture actually lives.
  evidence: Both decks draw `verse-reading-bg.jpeg` with `alphaModFix 50%` over the full-bleed black `e1` shape. Our template carries the picture as `layouts.default.backgroundImage`, a bare string — `ALLOWED_LAYOUT_KEYS` admits no style slot, so there is nowhere to put an opacity. Restructuring it into an `image` element would not help either: `resolveOpacity` is applied only by `ShapeElement`, and `ImageElement` ignores `style.opacity` entirely. Closing this needs a vocabulary addition (layout background opacity, or image-element opacity honoured in both renderers), which the spec’s Block If forbids inventing here.

- source_spec: `_bmad-output/implementation-artifacts/spec-presenter-powerpoint-and-deck-fidelity.md`
  summary: `thank-you` and `midweek-prayer` carry hand-authored text matching neither deck, and it was left untouched on purpose.
  evidence: `thank-you` reads “Thank You” / “Bandung International Community”; `midweek-prayer` reads “Midweek Prayer Meeting” plus a body still containing a literal `[placeholder]` where the day and time belong. Neither string appears in either deck’s text runs, and their round geometry (`[15, 35, 70, 18]`, `[10, 40, 80, 35]`) shows they were authored here rather than extracted. The spec’s Never list forbids changing worship-facing wording the deck does not settle, so this needs a product decision — note that the `midweek-prayer` `[placeholder]` will be projected verbatim until someone supplies the real day and time.

## Deferred from: code review of 17-1-reachable-dark-mode (2026-07-31)

- source_spec: `_bmad-output/implementation-artifacts/stories/17-1-reachable-dark-mode.md`
  summary: `DESIGN.md` describes slide chrome as a `slide-surface` class that exists nowhere in the codebase.
  evidence: `DESIGN.md:164` (Component Patterns) reads "Slide chrome is `slide-surface`; the preview list is a scrollable strip of scaled `slide-surface` instances." `grep -rn slide-surface` over `src/` and over all `.ts`/`.tsx`/`.css`/`.mjs` returns nothing outside `_bmad-output/`. Pre-existing and not caused by Story 17.1 — recorded because it sits in the table row directly above the one 17.1 edited to add `ThemeToggle`, so the next reader of that table is one line away from a dead reference. Whoever next touches `DESIGN.md` → *Component Patterns* should either name the real class (`ArtifactSlide` resolves its own geometry from the registry) or drop the claim. **Note added by round 2 of the same review:** the *second* half of that sentence is a separate falsehood and was NOT covered by this defer — it is now a patch item, because round 1 dismissed AC-4's word *previewed* on precisely the ground that the preview list renders no slide.

### Round 2 of the same review (2026-07-31)

- source_spec: `_bmad-output/implementation-artifacts/stories/17-1-reachable-dark-mode.md`
  summary: The contrast audit ran in one direction only; the light half of the two service forms is worse than anything Story 17.1 fixed.
  evidence: `CreateForm.tsx:444,447,473,481,483` and `EditForm.tsx:463,471,473` paint `text-amber-200`, `text-amber-300` and `text-red-200` on `bg-amber-500/10` / `bg-red-500/10` over `bg-background`, with no `dark:` half and no `.dark` ancestor (`services/new/page.tsx:39` is `bg-background text-foreground`). In the **light** theme the amber banners land near 1.15:1 — effectively invisible. These are the date-collision warning, the save-error banner and the missing-hymn warning, in the same two forms Story 17.1 names as `SlidePreviewList`'s host. Pre-existing and unchanged by 17.1: these shades never had a dark ancestor to key against, so they always rendered light and always failed there. Recorded because 17.1's new AC-6 test asserts only the **presence** of a `dark:` half, so it is structurally incapable of catching a dark shade stranded on a light surface — the direction 17.1 did not audit has no regression net either. Belongs with Story 17.2 or `DESIGN.md` Open Item 4.

- source_spec: `_bmad-output/implementation-artifacts/stories/17-1-reachable-dark-mode.md`
  summary: `PresenterOperator` pins `dark` on its own wrapper but never on the shell behind it, so a light-theme operator gets a white canvas framing the dark Presenter.
  evidence: AC-3's opt-out is a wrapper class, so `html`/`body` keep `bg-background` plus the `scrollbar-gutter: stable` reservation from `globals.css:127-129`. With the operator on light, a white canvas and a white gutter strip frame the dark Presenter — in the dim sanctuary the AC's own rationale invokes. Pre-existing in that nothing outside the presenter carried `.dark` before 17.1 either, so the mismatch already shipped; recorded because the mechanism is identical to the one `useProjectedShell` was extracted for. If the open AC-4 decision adopts a route-group shell owning every full-screen surface, this is the obvious third consumer.

- source_spec: `_bmad-output/implementation-artifacts/stories/17-1-reachable-dark-mode.md`
  summary: `LogoutButton` hand-rolls what `ui/button.tsx`'s `destructive` variant already provides, and drops the focus treatment doing it.
  evidence: `ui/button.tsx:18-19` ships `destructive` as `bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20` plus the `dark:` and `aria-invalid` handling. `LOGOUT_CLASS` (`LogoutButton.tsx:16`) reproduces a subset by hand — `hover:bg-red-500/10 text-red-600 dark:text-red-400` — with no focus-visible treatment at all, and the file imports `Button` without using it (`LogoutButton.tsx:5`, the only lint problem in any of Story 17.1's 13 changed files). Distinct from the `text-destructive` patch filed against 17.1, which is the one-class colour fix inside the current shape; this is the larger refactor to the variant, and it is pre-existing.

### Round 3 of the same review (2026-07-31)

- source_spec: `_bmad-output/implementation-artifacts/stories/17-1-reachable-dark-mode.md`
  owner: Story 17.7 (`17-7-projected-shell-route-group`)
  summary: `claimProjectedShell` silently ignores its `doc` argument after the first claim, so a second document gets neither the reset nor a working restore.
  evidence: `src/lib/projected-shell.ts:75-87` — a claim raised while `claims !== 0` takes the short path, so the snapshot and all five style writes are skipped for that document, and the release closure it returns restores nothing on it. No throw and no warning. Driven against the real module, `docB.body.style.backgroundColor` stays `white`. Not reachable today: both callers pass the same `document`, and the projector runs in a separate window with its own module instance, so the counter is per-realm. The file's own header at `:29` names Story 17.7's route-group layout as the third caller over the same URLs — the same document again — so 17.7 is where this is either fixed with per-document state or closed by stating the single-document contract in the file. Deferred rather than patched because the choice between those two is part of what that layout's design decides.

### `bmad-architecture` Update run, 2026-07-31 (AD-24 ratification)

- source_spec: `_bmad-output/planning-artifacts/architecture/architecture-bic-pptx-workflow-2026-07-10/ARCHITECTURE-SPINE.md`
  owner: Story 17.7 (`17-7-projected-shell-route-group`)
  summary: `projected-shell.ts`'s own header comment tells the next implementer that a Server Component can reach the shell reset without a hook. It cannot, and that is the exact misreading Story 17.7 has to avoid.
  evidence: `src/lib/projected-shell.ts:34-36` reads *"it is testable with a document stub in the `node:test` harness, and a Server-Component layout can reach it without a hook."* The first clause is true and is the reason the module was split out; the second is false — a Server Component never executes in the browser and has no `document` at all, so `claimProjectedShell(document)` cannot be called from one. It reaches this module only through a client child, which reintroduces the very timing problem the split appears to solve: the paint that leaks on a projected load is the **server's first paint**, and no browser-side mechanism runs before it. Story 17.1's own implementer note says as much (*"`useLayoutEffect` is not a shortcut, because the paint that leaks is the server's"*), so the module comment and the story record now disagree in the one file a 17.7 implementer opens first — sitting two lines below the correct reasoning, which is what makes it convincing. `ARCHITECTURE-SPINE.md` AD-24's gap clause was corrected by this run to state the constraint explicitly and to name this comment as wrong; the code comment itself is untouched, because an architecture Update run does not patch production code. Owned by 17.7 rather than filed loose: that story's whole design call is *where* the reset mounts, and this sentence mis-states what the candidate mounts can do.

### Round 4 of the same review (2026-08-01)

- source_spec: `_bmad-output/implementation-artifacts/stories/17-1-reachable-dark-mode.md`
  owner: **Story 17.8** (`17-8-guard-criteria-encoding`) — assigned 2026-08-01 by `bmad-create-story`; that story exists to close these four by stating the rule rather than adding the next spelling
  summary: `DARK_VARIANT` misses `dark:!…` and `dark:<digit>…`, so a `dark:` variant painting a literal colour in the projected tree escapes the guard that advertises `dark:` as one of exactly three routes in.
  evidence: `tests/theme-chrome.test.mjs:533` — `/(?<![\w:])dark:[a-z[-]/` requires a lowercase letter, `[` or `-` after the colon, so Tailwind's important suffix and a stacked breakpoint both fall outside the character class. Reproduced by injection into `src/components/SlideView.tsx`, each reverted: `className="dark:!bg-zinc-900"` → 47/47 green, `className="dark:2xl:bg-zinc-900"` → 47/47 green, `className="dark:bg-zinc-900"` → fails. A `dark:` class naming a *token* is still caught by `TOKEN_UTILITY` (`dark:!bg-card` does react), so the live hole is narrow: a `dark:` variant painting a **literal** colour on a projected surface, which makes that surface theme-dependent while every token guard stays green. Deferred rather than patched because the constant is unchanged since round 2's remediation and is not in round 4's diff — but recorded with the adjacency, because the `!` terminator this guard lacks is precisely what the same change set added to `EDGE_END` one guard over, which is the fourth consecutive round in which a rule was widened at the spelling a reviewer named and not at its siblings.

### `bmad-architecture` Update run, 2026-08-01 (AD-24 closure-gate ceiling repair)

Five findings from that run's Reviewer Gate, all in `tests/theme-chrome.test.mjs`, none patched here — an architecture Update run does not patch production code, and the guard file is the gate `AD-24` depends on rather than incidental test scaffolding. Each was verified in the shipped file by the parent, and the first two were reproduced at the keyboard. `ARCHITECTURE-SPINE.md`'s ceiling bullet now records all five as live; these entries are the code-side owners.

- source_spec: `_bmad-output/planning-artifacts/architecture/architecture-bic-pptx-workflow-2026-07-10/ARCHITECTURE-SPINE.md`
  owner: **Story 17.8** (`17-8-guard-criteria-encoding`) — assigned 2026-08-01 by `bmad-create-story`; that story exists to close these four by stating the rule rather than adding the next spelling
  summary: `LITERAL_OUTLINE_COLOUR` accepts the arbitrary-value spelling of the two keywords round 4 just excluded, so a projected focusable can still ring in the operator's theme with the suite green.
  evidence: `tests/theme-chrome.test.mjs:697`. Run against the shipped regex: `focus-visible:outline-[transparent]`, `focus-visible:outline-[inherit]` and `focus-visible:outline-[color:inherit]` are **accepted**; the bare `focus-visible:outline-transparent` and `focus-visible:outline-inherit` are rejected. `outline-[inherit]` takes its `outline-color` from the universal `* { @apply outline-ring/50 }`, which is exactly the leak this guard exists to stop, and none of the three carries a token name so `TOKEN_UTILITY` / `TOKEN_SHORTHAND` / `TOKEN_CSS_VAR` do not see them either. Arbitrary values are house idiom on these very surfaces (`ProjectorClient`'s `bg-[#0B1220]`), and `EDGE_WIDTH` at `:597` already models the `[…]` form for widths — so the vocabulary was available and was not applied. **Round 3 had named the fix**: *"exclude the CSS-wide keywords and `transparent`, **or** match a positive colour vocabulary rather than a subtraction list."* Round 4 took the first, widening four excluded spellings to nine. A positive vocabulary is the encoding.
- source_spec: `_bmad-output/planning-artifacts/architecture/architecture-bic-pptx-workflow-2026-07-10/ARCHITECTURE-SPINE.md`
  owner: **Story 17.8** (`17-8-guard-criteria-encoding`) — assigned 2026-08-01 by `bmad-create-story`; that story exists to close these four by stating the rule rather than adding the next spelling
  summary: The `className` props guard is defeated by an inline index signature, and its call-site belt cannot see a `.ts` call site — so the compile-error guarantee AC-4 rests on is still walkable two ways.
  evidence: `tests/theme-chrome.test.mjs:1051` — `propsAnnotation` returns a string starting with `{` for `{ slide: SlidePlanItem; [key: string]: unknown }`, so `exportedPropsShape` short-circuits and returns the parameter list, which contains no `className`; the caller's `className="bg-card"` then compiles onto the wrapper the congregation sees. `Record<string, unknown>` fails loudly (not locally declared) but the index-signature spelling does not. The belt that would catch it at the call site iterates `allTsxFiles()` (`:340`), so `React.createElement(SlideView, { slide, className: 'bg-card' })` from a `.ts` module is invisible — and a `.ts` call site is one of the four things the guard's own comment (`:1080-1084`) gives as its reason for existing. Encoding the criterion means asserting the props shape is a **closed** object literal — no index signature, no rest element — rather than asserting the absence of one word.
- source_spec: `_bmad-output/planning-artifacts/architecture/architecture-bic-pptx-workflow-2026-07-10/ARCHITECTURE-SPINE.md`
  owner: **Story 17.8** (`17-8-guard-criteria-encoding`) — assigned 2026-08-01 by `bmad-create-story`; that story exists to close these four by stating the rule rather than adding the next spelling
  summary: The edge-width guard never received the transitive sweep the token and focusable guards did, so a `.tsx` reachable from a projected client is token-scanned, focus-scanned and not edge-scanned.
  evidence: `EDGE_UTILITY` is consumed at `tests/theme-chrome.test.mjs:631` and nowhere else in the file, inside `for (const file of PROJECTED)`. The token guard pairs its roots-only loop (`:644`) with a `projectedTree()` sweep (`:867`) and the focusable guard sweeps the tree directly (`:718`); the edge guard has no companion. A `border-2` in a reached component inherits `border-border` from the universal selector and changes between themes on the room-facing screen with the suite green. Latent only because all 27 walked modules are `.ts` today and carry no JSX — and the `>= 27` floor at `:881` constrains count, not extension, so nothing pins that. Fix: sweep `EDGE_UTILITY` over `projectedTree()` filtered to `.tsx`, exactly as the focusable guard does.
- source_spec: `_bmad-output/planning-artifacts/architecture/architecture-bic-pptx-workflow-2026-07-10/ARCHITECTURE-SPINE.md`
  owner: Story 17.7 (`17-7-projected-shell-route-group`)
  summary: The gate keeps four hardcoded room-facing lists where one derivation would do, and two of them are hand-duplicates of a third.
  evidence: `PROJECTED` (`tests/theme-chrome.test.mjs:546`, six entries), `ROUTE_SHELLS` (`:740`, hand-duplicating two of them, feeding the scroll guard at `:745`), `FULL_SCREEN` (`:1100`), and an inline pair at `:1087` feeding the `className` props guard. `AD-24`'s rule clause named only two of the four until this run corrected it, so an implementer obeying it exactly would register a new room-facing failure branch in both named sets and still miss the scroll guard — whose own comment records that the two existing branches diverged immediately after a change set declared them one failure. Owned by 17.7 because its route-group segment is the first real value the roots could be *derived from* rather than listed, which is what would make the spine's *encode the criterion* instruction satisfiable instead of merely correct.
- source_spec: `_bmad-output/planning-artifacts/architecture/architecture-bic-pptx-workflow-2026-07-10/ARCHITECTURE-SPINE.md`
  owner: Story 17.7 (`17-7-projected-shell-route-group`)
  summary: `exportedProps` cannot read an `async` default export, which is the shape of every Server Component the closing change set will add.
  evidence: `tests/theme-chrome.test.mjs:927` matches the literal string `export default function`; both route shells are `export default async function` (`projector/page.tsx:30`, `slideshow/page.tsx:31`). It fails **loudly** (`assert.ok(at !== -1, 'expected a default-exported function')`) rather than passing, so it is safe where it is applied today — but it is why adding the two shells to `FULL_SCREEN` produces four failures rather than the two the shell gap accounts for, measured on 2026-08-01 (52 tests, 4 failures; probe reverted). Recorded so an implementer does not read two of those reds as noise.

## Hymnal corpus: every title in `data/hymns.json` is a first lyric line (2026-08-01)

Found while answering a routing question, not by a review — so there is no source spec, only the code and the corpus. **Deferred by the owner on the day it was found: not started, and deliberately so.** It cannot start, because the missing piece is an input nobody in the repository can produce. Recorded here rather than as a story for exactly that reason: a story would have to state a testable AC for *"the title is correct"*, and there is nothing yet to compare a title against.

- source_spec: FR-2 / Epic **2** (`2-2-rundown-parser-and-hymnal-db-integration`) — the corpus that epic delivered
  owner: **Epic 22 / Story 22.2** (`22-2-hymn-title-is-a-title`) — assigned 2026-08-01 by `bmad-correct-course`, which is the route this entry itself named. Still blocked on an owner-supplied input, not on code and not on a decision; what changed is that the block now has a key rather than sitting under *no open epic owns it*
  summary: All 695 titles in `data/hymns.json` are the hymn's **first lyric line**, not its title. The source dump `.work/lirik-lagu.json` carries no title field at all, so `deriveTitle()` was written to fall back to the lyrics — the corpus is faithful to its source and the source is insufficient. Regeneration is therefore blocked until a replacement source carrying an authoritative number→title index exists. **Fix at the generator and re-run the import; do not hand-patch 695 rows** (AGENTS.md, *prefer not producing the value to blocking it afterwards* — same shape as the `evidenceFor` filter in `extract-pptx-assets.mjs`).
  evidence: `scripts/import-hymnal.mjs:23` `deriveTitle()` returns the first non-label line after a `Verse` header, final fallback `SDAH {n}` (`:54`), applied at `:105`; source path `.work/lirik-lagu.json` (`:7`), **absent from this machine**. Observed in the shipped corpus: `#83` = `"O worship the King, all-glorious above"` while `epics.md:369` states the intended title slide as `"O Worship the King · SDAH #83"` — the artefact and the data already disagree in writing; `#1` = `"Praise to the Lord, the Almighty, the King of creation!"`; `#100` = `"Great is Thy faithfulness, O God my Father"`. The value is **payload, not internal**: it reaches the song title slide (`src/lib/slide-plan.ts:158`, `songTitle: hymn.title`, FR-5), the group label (`:192`), the number+title autocomplete (Story 14.6) and picoclaw's `resolvedHymns` readback (Story 6.5). `tests/pptx-content.test.mjs` asserts title text, so regeneration moves the suite.

When the source exists, the route is `bmad-correct-course` (to give it an owning epic — Epic 2 is `done`) → `bmad-create-story` → `bmad-dev-story` → `bmad-code-review`. Not `bmad-quick-dev`: three consumer boundaries and a moving test suite put it past *bugfix tightly scoped to existing behavior*.

**First leg done, 2026-08-01 (`sprint-change-proposal-2026-08-01.md`).** The Correct Course ran and the owning epic exists: **Epic 22**, *The song book is a choice, and its titles are real*, with this finding as **Story 22.2**. Two things that entry could not know when it was written, both measured by the same pass: the corpus is not only un-regenerable in principle — `.work/lirik-lagu.json` is **absent**, so `npm run import:hymnal` cannot run at all and the committed output is the last copy; and `hymns.number` is globally `UNIQUE`, so the same file move carries a per-book key (Story 22.1) rather than being a rename. The *fix at the generator* instruction above is carried into Story 22.2 verbatim, with one adjustment forced by the missing source: the generator now reads the committed corpus plus the owner-supplied index. Story 22.2 additionally waits on a `bmad-architecture` Update — correcting 695 already-persisted titles is AD-21's case and its counter does not exist.

**Closed, 2026-08-01, later the same day.** The owner supplied the number→title index — the input this entry was written to say nobody in the repository could produce — and Story 22.2 shipped against it. The *fix at the generator, do not hand-patch 695 rows* instruction was honoured: the join happened once, inside the 22.1 file move, and no row was edited individually.

Two things this entry predicted, checked rather than assumed. **It was right about the consumer boundaries** — the title is payload, reaching the song title slide, the group label, the autocomplete and picoclaw's readback. **It was wrong about the test suite:** it warned that regeneration "moves the suite", and `tests/pptx-content.test.mjs` did not move at all, because the fixtures it asserts contain no hymn whose title changed. That is worth recording as a gap rather than as luck — the suite would not have caught a badly joined index either, which is why `tests/corpus.test.mjs` now pins four titles directly.

The architecture wait resolved differently than expected, and the distinction matters. Story 22.2 shipped **without** the AD, not by bypassing it: it added no channel, because `upsertHymns` already overwrote `title` from the corpus on every boot. The corrected titles rode the path that was already there. The `bmad-architecture` Update is still **open**, re-scoped to the forward question it always really was — should a shipped reference corpus keep an every-boot overwrite? If the answer is AD-21's counter, its target is `upsertHymns`, not this data.

## Deferred from: code review of 21-2-translation-is-a-parameter (2026-08-02)

- Partial verse range returns incomplete passage without error (`src/lib/scripture.ts:141`) — pre-existing scripture behavior; Story 21.4 owns reference/matcher semantics.
- Removed corpus file leaves stale `bible_translations`/`bible_verses` rows (`src/lib/db/index.ts:125`) — reconcile only processes discovered files; corpus-file deletion cleanup is out of AC scope for Story 21.2.
- `migrateBibleVersesTranslationCode` assumes `translation` or `translation_code` column exists (`src/lib/db/index.ts:111`) — edge case for exotic legacy DB shapes; no observed failure path on normal upgrade from shipped schema.
