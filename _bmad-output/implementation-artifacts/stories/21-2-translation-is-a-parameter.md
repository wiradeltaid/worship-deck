---
baseline_commit: be69ce5ffe8e2e940878b2f97404caa09480f4a9
---

# Story 21.2: Translation Is a Parameter, Not a Literal

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want every scripture read path to name the translation it is reading,
so that a second corpus is an addition rather than a rewrite of six call sites.

## What this story is, in one sentence

The `'KJV'` literal leaves the read path, the corpus file moves to
`data/en/bible-translation/kjv.json` and starts declaring its **locale**, the
table it fills becomes an **AD-25 reconcile** instead of a from-zero seed, and
the closure that makes that reconcile safe stops being a grep somebody ran once.

## Scope

**Yours.** Six pieces, and the middle two are the ones the epic text understates:

| # | Piece | Authority |
| --- | --- | --- |
| 1 | Translation as an argument on every read path; `isKjvCorpusEmpty()` → `isBibleTranslationEmpty(code)` | `epics.md` §21.2 |
| 2 | Path move to `data/<locale>/bible-translation/<code>.json`, and `translation` → `translation_code` | `epics.md` §21.2 amendment, AD-26 |
| 3 | A `bible_translations` registry projected from the corpus files, plus a listing that returns **every** installed translation with its locale | AD-26; *Deferred* → *"Where the two corpus registries … physically live is a Story 21.2 / 21.4 / 22.3 schema call"* |
| 4 | The AD-25 **reconcile** for the bible family — the early return goes, removal arrives, a bad file reconciles nothing | *Deferred* → *"AD-25's reconcile exists in neither family yet … Owned by Stories 21.2 and 22.3"* |
| 5 | The **guard** AD-25's closure and AD-26's never-filter rule both rest on | *Deferred* → *"whichever of Stories 21.2 / 22.3 lands the reconcile first should land this"* |
| 6 | The operator-facing `KJV` literals that become false the moment 21.3 lands | `EXPERIENCE.md:45` (presenter heading); §*Two corrections* below (the two form buttons) |

**Not yours. Three of these are one file away and two are one line away.**

| Not yours | Where | Why it matters to you |
| --- | --- | --- |
| `default_bible_translation`, `default_data_locale`, the Presenter translation control, persisting the translation beside a resolved passage | `settings.ts`, `PresenterOperator.tsx`, `parsed_data` | **Story 21.3.** You give the API a parameter; 21.3 gives an operator a way to set it. Add **no** settings key — `settings.ts` is the append-shaped contact point three epics share, and taking a key early is the one way to collide. |
| Book names per translation, the matcher, longest-prefix match, `BOOK_ALIASES`, `shortName`, `bible_books` identity, `parser.ts:152`/`:162` | `scripture.ts:42`, `:65`, `:74-95`, `parser.ts` | **Story 21.4.** `resolveBookId` (`:74-95`) stays exactly as it is. Resolving the book globally while reading verses per translation is the correct interim state, not an oversight. |
| The `Song of Songs` → `Song of Solomon` corpus correction | `data/**/kjv.json` book 22 | **Story 21.4** — the data fix and the matcher land together because correcting the name is what makes `Song` prefix the right book (*Deferred*, 2026-08-01). You are moving that file; **do not fix the name while you are in there.** |
| The returned reference echoing the operator's typed string | `scripture.ts:139-142` | **Story 21.4.** A live *output is exact* violation (`ps 23:1` comes back as `ps 23:1`), independent of the corpus misnaming. It gets worse under AD-28, and it needs the identity the matcher returns. Leave it. |
| One field with inline autocomplete | `PresenterOperator.tsx:696`, `CreateForm.tsx:584`, `EditForm.tsx:615` | **Story 21.5.** You change **label** text, never the inputs or their actions. |
| The 503 you are rewriting never reaching the presenter | `PresenterOperator.tsx:431-433` | **Story 21.5**, recorded in `sprint-status.yaml`'s epic-21 action item after a `bmad-ux` run read `src/` rather than the artifact. The presenter collapses every non-404 status into a flat `'Lookup failed'`, so your improved message reaches the two service forms and **nowhere on the surface used during a service**. Do not fix it here — 21.5 already owns *"an unresolved reference is visible as a defect"* on all three surfaces. Write the good message anyway; it is what 21.5 will surface. |
| Song-book path move, `book_code` → `song_book_code`, `song_books` registry, the song-book file's `language` field | `corpus.ts:55`, `db/index.ts:65-83`, `data/song-book/sdah.json:5` | **Story 22.3.** `songBookCorpusPath` and `upsertHymns` are untouched by you. Both stories edit `corpus.ts`; keep your edit additive so the merge stays append-shaped. |
| The guard that refuses an `aliases` field in a corpus file | corpus loader | Assigned in *Deferred* to *"whichever of Stories 21.4 / 21.5 lands the matcher"*. Not yours even though you are writing the sibling guard. |

## Two corrections made against the source, not inherited

Both were verified in this worktree at `be69ce5`. Neither is a licence to widen scope.

1. **The epic says the 503 message *"stops naming `.work/` and `npm run import:kjv`"*. Story 21.1 already did that.** The shipped message (`route.ts:22-24`) reads *"KJV corpus is empty. It ships at data/bible/kjv.json and seeds on first boot; check the file with npm run corpus:verify."* — no `.work/`, no retired command. What is actually left for this story is different and is AC-2: the message names a **hard-coded translation** and the **old path**, and FR-22 requires absence to be reported *for that translation* while the others keep working.

2. **The measured `'KJV'` surface is four sites in `scripture.ts` plus two importers. Three operator-facing labels were not counted, and one of them is already assigned to this story.** `PresenterOperator.tsx:692` is the `Scripture (KJV)` heading `EXPERIENCE.md:45` names in as many words: *"the shipped panel is headed Scripture (KJV) and Story 21.2 removes that literal."* The other two are `Resolve KJV` buttons at `CreateForm.tsx:581` and `EditForm.tsx:612`, which **no story owns**. They are in scope here as a recorded scope call, on one ground: after 21.3 sets a non-KJV default those two labels state something false, and the fix is label text — not a control, not a component. A reviewer who disagrees can cut AC-11 without touching anything else.

## Acceptance Criteria

1. **Translation is an argument, and no corpus code survives as a literal in a read path** (AD-26). `lookupScripture(ref, translationCode)` takes the code as a **required** parameter — no default in the signature — and `isKjvCorpusEmpty()` becomes `isBibleTranslationEmpty(code)`. All four measured literals are gone: `scripture.ts:6` (the `ScripturePassage.translation` literal type `'KJV'`), `:106` (the emptiness count), `:128` (the lookup predicate), `:144` (the returned value). `DEFAULT_TRANSLATION` (`corpus.ts:21`) stays and is the **only** place the shipped default code is written down.

2. **`/api/scripture` names the translation it read, refuses one it cannot verify, and reports absence per translation.** The parameter is **`?translation=<code>`**, recorded in `docs/api-contracts-monolith.md` in the same change set. Given a request naming a translation, the lookup reads that translation and the response carries its code. Given no translation, it resolves to `DEFAULT_TRANSLATION` — Story 21.3 replaces that resolution with `default_bible_translation`. Given a code that is **not in the registry**, the response is `400` naming the code; never a silent fallback to the default (AD-26: the code is a cross-boundary key validated against the registry, not a string accepted). Given a registered translation whose table is empty, the `503` names **that translation** and the new path, and a different populated translation still resolves.
   **One distinction to carry forward rather than let 21.3 copy:** a *request parameter* naming an unknown code is refused, while a **`default_*` setting** naming an uninstalled corpus is **inert, not an error** — the surface falls back and says so, and the setting is not rewritten, so re-installing restores the choice (AD-26). Two different rules for two different things; this story only owns the first.

3. **The corpus moves, and exactly one module knows where corpora live.** `data/bible/kjv.json` → **`data/en/bible-translation/kjv.json`**, git-moved so history follows. `src/lib/corpus.ts` remains the single owner of both corpus paths; `songBookCorpusPath` is not touched. Installed bible translations are **discovered** by enumerating `data/<locale>/bible-translation/<code>.json` — *the file declares and the path merely locates* (AD-26) — so installing a translation is dropping a file in, with no registration step and no install surface (`EXPERIENCE.md` Flow 9 step 1: *"This is not a surface"*).

4. **The corpus declares `locale`, and disagreement is refused.** The declared field is spelled **`locale`**, replacing `language` at `data/en/bible-translation/kjv.json:5` (AD-26 — the files are the source of record, so it is free now and a migration later). The loader refuses a file whose declared **code** disagrees with the code it was loaded as (already shipped, `corpus.ts:91`) **and, new here, one whose declared locale disagrees with the directory holding it** — without that check, copying a file into another locale directory gives one code two locales and the registry keeps whichever booted last. Two files declaring the same code make the boot **refuse, naming both paths** — never last-wins. `locale` is the one declared field nothing asserts today; `scripts/verify-corpora.mjs` and `tests/corpus.test.mjs` both assert it after this story.

5. **`bible_verses.translation` becomes `translation_code`, as a rebuild rather than a migration** (AD-25: *"a rename inside a projected table is a rebuild, not a migration"*, licensed by AD-4 recording that no deployment exists). The DDL, the `UNIQUE(book_id, chapter, verse, …)` constraint, every read path and the `tests/scripture.test.mjs` fixture all carry the new name. A fresh clone and an existing developer database reach the **same** shape — follow the shipped precedent for exactly this, `migrateHymnsForSongBooks` (`db/index.ts:30-56`), which detects the old shape by `PRAGMA table_info` and rebuilds once.

6. **The bible corpus becomes an AD-25 reconcile.** The early return at `db/index.ts:92-95` — *"return the moment the translation holds one verse"* — goes, so **a corrected corpus reaches the table with no operator step**. The reconcile is **complete within the translation code it names**: a verse row carrying that code and absent from the file is removed, and a row belonging to a sibling translation is never touched. **`bible_books` is excepted and nothing removes a book row** — AD-25's own `Binds` excepts it because the canonical identity is application-fixed rather than corpus-derived (AD-27). A corpus registry row and its content rows are reconciled in **one transaction**, so a boot that fails partway leaves neither half applied.

7. **A missing, unparseable or invalid corpus file reconciles *nothing*.** *"Rows absent from the file are removed"* has a literal reading in which a file that fails to open deletes every verse in the translation. That reading is forbidden (AD-25). The table is left exactly as it stands and the failure is loud — named corpus, named reason — which is what the shipped loader already reaches for by throwing (`corpus.ts:64-79`). **This is negative-tested, not merely intended:** point the loader at a truncated file and assert the existing rows survive.

8. **Boot cost is chosen deliberately and measured.** AD-25 leaves *fingerprint-then-skip* versus *reconcile every boot* to this story and names the cost: the first KJV seed writes 31,102 rows, measured at **~258 ms** in Story 21.1. Reconciling several translations unconditionally on every start is *"the shape that turns a restart into a wait — on the morning AD-1 exists to protect."* Pick one, record the measurement in the Completion Notes, and if it is a per-corpus fingerprint, follow the `artifact_templates.seed_hash` precedent rather than inventing a second mechanism.

9. **Every installed translation is registered and listable with its locale, and no locale reaches a query.** A registry row carries what AD-26 names — **code, display name, locale, licence and provenance** — projected from the corpus file's own declared metadata rather than maintained a second time; the KJV file already declares all five (`code`, `name`, `language`→`locale`, `licence`, `provenance`). A read path returns **all** installed translations with their locale. **No `WHERE locale = …` reaches the database**, in any spelling (FR-24, stated in the PRD as the requirement rather than an implementation note). The control that consumes this listing is Story 21.3's; the listing itself is yours.

10. **The closure AD-25 rests on stops being honour-system, and the guard is proved to react.** A new suite enumerates the corpus tables **from the startup DDL** — not from a hand-written list — and asserts that no `INSERT`/`UPDATE`/`DELETE` against any of them occurs outside `src/lib/db/index.ts`, plus that no corpus read path carries a locale predicate (AC-9). It is registered in `package.json` `scripts.test` **in the same change set**; an unregistered test file never runs and nothing detects the omission. Per this repository's standing rule it is **proved to react**: add a write, watch the suite go red, revert, `git status --short` clean.

11. **The operator surface stops asserting a translation it does not know.** No hard-coded translation code remains at `PresenterOperator.tsx:692` (`Scripture (KJV)`), `CreateForm.tsx:581` or `EditForm.tsx:612` (`Resolve KJV`). Whatever a surface names comes from the response or the resolved default. **Label text only** — no new control, no new component, no change to the three inputs or their actions.

12. **Nothing a reader follows names the old path, and a test keeps it that way.** `tests/corpus.test.mjs` already encodes Story 23.2's criterion as a criterion (`:151` roots, `:174-194` the two assertions); extend it so **no instructional file names `data/bible/`**. Every file listed in Task 7 is updated in the same change set. `data/song-book/` stays legitimate until Story 22.3 and is **not** added to the guard.

13. **No second translation ships in this story, and the reason is written down.** Parameterising the emptiness guard is precisely what **arms** AD-27's two-owner hazard: `bible_books` is one global row per book while `name`/`short_name` are per-translation values, arbitrated by `ON CONFLICT(id) DO UPDATE SET name = excluded.name` (`db/index.ts:99-105`), so *"whichever translation seeded last owns every book name for every reader."* It cannot fire today only because the from-zero guard reads the default translation. Adding a second corpus file here would arm and fire it in one change set. Story 21.4 closes it.

14. **The suite is green, the fresh-clone path works, and the reconcile is observed.** `npm test` green with the new suite registered; `npx tsc --noEmit` clean; `npx eslint src tests` no worse than the clean-checkout baseline and **zero** problems in any file you touched. Two smokes, both recorded: a **fresh database** boots, seeds from the new path and resolves `John 3:16`; and a verse **edited in the database** is corrected back from the file on the next boot — the behaviour the early return prevented, and the whole point of AC-6.

## Tasks / Subtasks

- [ ] **Task 1 — read before writing (AC: all)**
  - [ ] `src/lib/scripture.ts` (145 lines), `src/lib/corpus.ts` (221), `src/lib/db/index.ts` (373), `src/app/api/scripture/route.ts` (42) — all four are files you edit; read them whole.
  - [ ] `ARCHITECTURE-SPINE.md` → **AD-25**, **AD-26**, and the *Deferred* entries beginning *"AD-25's reconcile exists in neither family yet"*, *"Where the two corpus registries …"* and *"AD-25's closure is asserted by nothing"*. These three are the authority for AC-4..AC-10 and two of them name this story by number.
  - [ ] `AD-27`'s last paragraph — the `bible_books` two-owner arbitration AC-13 forbids you to arm — and `AD-28`'s scope clauses, so you can see where your parameter stops and 21.4's begins.
  - [ ] `21-1-verse-database-ships.md` — the supersession box, the seed-from-zero reasoning, and the `258 ms` / `4.36 MB` measurements AC-8 builds on.
- [ ] **Task 2 — parameterise the read path (AC: 1, 2)**
  - [ ] `scripture.ts`: `ScripturePassage.translation` becomes the code (a `string`), `lookupScripture(ref, translationCode)` takes it required, `isBibleTranslationEmpty(code)` replaces `isKjvCorpusEmpty()`, and the two SQL predicates bind the argument.
  - [ ] `route.ts`: read the translation from the query, validate it against the registry (400 with the code named on an unknown one), resolve an absent one to `DEFAULT_TRANSLATION`, rewrite the 503 to name that translation and the new path, and return the code with the passage.
  - [ ] **Do not make an absent parameter an error.** AD-28 requires the *matcher's* scope to be refused when absent, and that is Story 21.4's parameter, not this one — the two arrive *"separately, under different names, into the same module"*, which is the divergence AD-28 exists to close. Say so in a comment beside the fallback so this story is not later cited as precedent for defaulting the matcher's scope.
  - [ ] Update the three callers to keep working unchanged (`PresenterOperator.tsx:429`, `CreateForm.tsx:296`, `EditForm.tsx:312`); none of them sends a translation yet and none should start.
- [ ] **Task 3 — move the corpus and declare its locale (AC: 3, 4)**
  - [ ] `git mv data/bible/kjv.json data/en/bible-translation/kjv.json`, then rename the declared field `language` → `locale` at `:5`.
  - [ ] `corpus.ts`: locale-aware path + discovery over `data/*/bible-translation/*.json`; add the declared-locale-vs-directory refusal beside the existing declared-code refusal (`:91`); add the duplicate-code refusal naming both paths. Update the module header (`:8-16`), which still documents `data/bible/<translation-code>.json`.
  - [ ] Verified already safe, do not re-litigate: no locale code collides with `data/local/`, `data/uploads/` or `data/*.db`, and `.gitignore` does not swallow `data/en/`.
  - [ ] `scripts/verify-corpora.mjs:188` (the hard-coded path) and its licence assertions at `:49-50` gain the `locale` assertion; `scripts/setup.mjs:88-101` names the new path in all three of its messages.
- [ ] **Task 4 — registry, rename, reconcile (AC: 5, 6, 7, 8, 9)**
  - [ ] `db/index.ts`: add the `bible_translations` registry to the startup DDL (AD-9 owns the shape); its physical shape is **yours to choose** and AD-26 fixes only that a row exists per corpus, the code is globally unique and is the key, and locale is an attribute.
  - [ ] Rebuild `bible_verses` with `translation_code`, following `migrateHymnsForSongBooks` (`:30-56`) — `PRAGMA table_info` detection, one rebuild, an `console.info` line in the same voice.
  - [ ] Replace `seedBibleCorpus` (`:91-139`) with the reconcile: no early return, removal scoped to the corpus's own code, registry row and content rows in one transaction, `bible_books` never removed from.
  - [ ] Keep it **after** the data migrations on the `getDb` path — today that is where `seedBibleCorpus` already sits (`:332`), after the seed-hash backfill (`:308-328`). Its order relative to `seedArtifactRegistry` is free (AD-25 says so explicitly); do not reorder anything else in `:330-334`.
  - [ ] Add the listing read path for AC-9. Return every installed translation with its locale — and write no locale predicate anywhere, which AC-10's guard then enforces.
- [ ] **Task 5 — the guard (AC: 10)**
  - [ ] New suite (suggested `tests/corpus-closure.test.mjs`), registered in `package.json:10` in the same change set.
  - [ ] Derive the table names from the startup DDL text rather than listing them, on the `tests/proxy-matcher.test.mjs` shape where an unlisted case is *detectable* — the four hand-maintained lists in `tests/theme-chrome.test.mjs` are the anti-pattern this repository has paid for four review rounds to learn.
  - [ ] Assert no write against a corpus table outside `src/lib/db/index.ts`, and no locale predicate on a corpus read path.
  - [ ] **Prove it reacts twice:** inject a stray `UPDATE hymns …` in a `src/lib` module → red; inject `WHERE locale = ?` into the listing → red. Revert both, confirm `git status --short` clean, and record it as *"2 injections, 2 react"* — a property of those two injections, not a coverage claim.
- [ ] **Task 6 — the operator labels (AC: 11)**
  - [ ] `PresenterOperator.tsx:692`, `CreateForm.tsx:581`, `EditForm.tsx:612`. Text only. Leave `:696` / `:584` / `:615` and the actions beside them for Story 21.5.
  - [ ] **Do not extend `PresentMessage`.** The presenter's `pushScripture` (`:424-446`) broadcasts `{ type: 'scripture', reference, text }`, and the heading you are fixing is on the operator's **own** screen — it reads the API response, so no wire change is needed. AD-10 forbids a surface inventing its own message shape and the channel already has an unbuilt plan-identity obligation in *Deferred*; adding a field here would land inside that decision without owning it.
- [ ] **Task 7 — the artifacts this story makes stale (AC: 12)**
  - [ ] **In this change set (facts that become false):** `README.md:66`; `ATTRIBUTIONS.md:53`; `docs/QUICKSTART.md:90`; `docs/deploy.md:74`; `docs/development-guide-monolith.md:47`; `docs/liveserver-implementation-plan.md:86,247`; `docs/data-models-monolith.md:74,161,168` (the ER row, the column row and the seeding paragraph — the last still describes the from-zero behaviour AC-6 removes); `docs/api-contracts-monolith.md:34,172-182` (the translation parameter and the response shape); `tests/corpus.test.mjs:31`; the comments at `src/lib/scripture.ts:12`,`:98` and `src/lib/corpus.ts:11`.
  - [ ] **In this change set (tracking):** `sprint-status.yaml`'s `21-2-translation-is-a-parameter` row; `epics.md`'s Story 21.2 status tag and the Epic 21 heading's story-status list; `_bmad-output/project-context.md:110`, whose last sentence reads *"until they land, the shipped paths are still `data/bible/kjv.json` and `data/song-book/sdah.json`"* — half of that stops being true here.
  - [ ] **Hand off, do not perform.** `ARCHITECTURE-SPINE.md` goes stale in four places and a spine change routes through a `bmad-architecture` Update run: AD-25's gap bullet (the bible half of *"wrong in opposite directions"* is closed), the *"AD-25's closure is asserted by nothing"* bullet (the guard now exists), the registry-shape bullet (this story chose the bible shape), and AD-26's `[TARGET]` tag (now partly built). **Never renumber an existing `AD-n`.** Name these four precisely in your handoff so the run does not rediscover them.
  - [ ] **Hand off, do not perform.** `EXPERIENCE.md:45` (*"Story 21.2 removes that literal"*) and `:80`'s status note (which cites `scripture.ts:6`'s literal type as shipped) both go stale. That is a `bmad-ux` handoff — three workflows have declined to substitute for that gate; do not be the first. `DESIGN.md` is untouched: no token moves and no component gains a visual delta.
- [ ] **Task 8 — verification (AC: 14)**
  - [ ] `npm test`, `npx tsc --noEmit`, `npx eslint src tests`. **Measure the lint baseline on a clean checkout** — the last recorded figure is **31 problems on 2026-08-01**, and a working copy with agent worktrees under `.claude/worktrees/` has printed 14,528 of one run's 14,559 problems. A number in the thousands means you linted a worktree.
  - [ ] Baseline the suite **before** you start rather than trusting a number from a story record; the last recorded figure is 387 tests / 386 pass / 1 skipped (Story 17.8's baseline) and this story adds a suite.
  - [ ] `npm run corpus:verify` green against the moved file — it is the replacement for the retired importers and it hard-codes the old path at `verify-corpora.mjs:188`, so it fails until Task 3 is complete.
  - [ ] Fresh-database smoke and the corrected-verse smoke from AC-14, both recorded with what you actually observed.
  - [ ] `tests/public-repo-guard.test.mjs` green before committing, per `AGENTS.md`. You are moving a `data/` file: confirm the guard still passes and that nothing under `data/local/`, `data/uploads/` or `data.db*` is staged.

## Dev Notes

### Current state of every site you touch (verified in this worktree at `be69ce5`)

| Site | Today | What changes |
| --- | --- | --- |
| `scripture.ts:6` | `translation: 'KJV'` literal type | the code, as a `string` |
| `scripture.ts:102-110` | `isKjvCorpusEmpty()`, `WHERE translation = 'KJV'` | `isBibleTranslationEmpty(code)`, bound parameter |
| `scripture.ts:116-145` | `lookupScripture(ref)`, `AND translation = 'KJV'` (`:128`), returns `translation: 'KJV'` (`:144`) | required code argument, bound predicate, returned code |
| `scripture.ts:42`, `:65`, `:74-95`, `:139-142` | regex, `BOOK_ALIASES`, `resolveBookId`, reference composition | **nothing — Story 21.4** |
| `route.ts:2`,`:18`,`:22-24`,`:29` | two importers, hard-coded emptiness check, path+translation in the 503, unparameterised lookup | translation parameter, registry validation, per-translation 503 |
| `corpus.ts:21`,`:51-62`,`:82-164` | `DEFAULT_TRANSLATION`, both path helpers, `loadBibleCorpus` | locale-aware bible path + discovery; `songBookCorpusPath` untouched |
| `corpus.ts:64-79` | `readCorpusFile` throws on missing/unreadable | **keep the throw** — it is what AC-7 rests on |
| `db/index.ts:91-139` | `seedBibleCorpus`, early-returns at `:95` | the reconcile |
| `db/index.ts:99-105` | `ON CONFLICT(id) DO UPDATE SET name` on `bible_books` | **unchanged, and AC-13 is why** |
| `db/index.ts:224-239` | `bible_books`, `bible_verses` DDL with `translation` | `translation_code`, plus the new registry table |
| `db/index.ts:330-334` | `migrateHymnsForSongBooks` → `upsertHymns` → `seedBibleCorpus` → registry seed → admin bootstrap | your reconcile replaces one step; **reorder nothing else** |
| `tests/scripture.test.mjs:20-54` | fixture creates `bible_verses` with `translation`, inserts `'KJV'` | new column name; add a second translation row so the per-translation predicate is actually exercised |
| `data/**/kjv.json:5` | `"language": "en"` | `"locale": "en"` |

### The two rules that bind everything here, stated once

- **Filter in the interface, never in the query.** No `WHERE locale = …` reaches the database, and AD-26 makes that *structural* rather than disciplinary: because no key contains a locale, no read path can **need** one. If you find yourself wanting the predicate, the design went wrong upstream.
- **A resolved reference displays the chosen translation's own book name — never a name from a setting or from another translation.** With one translation installed this is satisfied by reading the name from the corpus rather than from anywhere else, which is what `resolveBookId` already does. The *fix* for the reference being echoed from the operator's input is Story 21.4's; your obligation is not to make it worse and not to introduce a second source for a book name.

### Why the reconcile is the risky half, and where the risk actually sits

`seedBibleCorpus` is a from-zero seed today, so it has never deleted a row. AC-6 gives it removal, and AC-7 is the clause that makes removal safe. The failure mode is not subtle and it is not hypothetical — AD-25 records the sibling case in the song-book family: rows stamped `SDAH` by Story 22.1's boot migration that are not among the corpus's 695 *"disappear at the next boot"*, correct under the rule and free **only** because AD-4 records that no deployment exists. That licence expires at first deploy. Write the removal so its scope is visibly the corpus's own code, and note from the same decision that rebuilding rows is safe because **nothing references the surrogate `bible_verses.id`** — grepped across `src/` and `tests/` on 2026-08-01, because a service persists a reference rather than a row id.

A guard that only checks the expected rows are present passes on a table holding more than the file does. AD-25's own note for whoever writes this: *prove it reacts.*

### What must be preserved

- **Story 21.1's assertions all still hold, at the new path.** 66 books / 1,189 chapters / 31,102 verses counted rather than sampled, no `@N` markup, the licence with the UK Crown copyright exception stated rather than glossed, the provenance. `tests/corpus.test.mjs:39-87` is what holds them — update the paths it asserts and change nothing about what it asserts.
- **`upsertHymns` and the song-book corpus are untouched.** They are wrong in the *opposite* direction under AD-25 (they re-apply every boot and remove nothing), and that is Story 22.3's to fix. Do not "while I am here" it.
- **`stripVerseMarkup` stays.** It guards verses that reached the table by some other route.
- The smoke scripts' guards match the **table name** `bible_verses` (`smoke-auth.mjs:37`, `smoke-deck-fidelity.mjs:37`, `smoke-hymn-sections.mjs:111`, `smoke-image-ssrf.mjs:30`), which does not change — so the column rename does not reach them. `smoke-auth.mjs` carries a pre-existing stale check that matches the legitimate `isKjvCorpusEmpty` import in `route.ts`; renaming that function will change what that check reports. It already failed at baseline and is recorded in `deferred-work.md:60,170` — **do not adopt it.**

### Project Structure Notes

Server-side and data only, plus three label strings. `src/lib/*` keeps the domain logic (`corpus.ts` loading and validation, `db/index.ts` the boot path, `scripture.ts` the read path) and the route handler stays thin — the *Boundaries* convention. `better-sqlite3` is synchronous and server-only, so nothing here may be imported by a client component. No new route and no new surface, so `EXPERIENCE.md`'s IA table does not move (`EXPERIENCE.md:73` decided this in as many words: *"the IA table above does not move for FR-24 or FR-25"*). New suite goes in `tests/` as `.test.mjs` under `node:test` with `--experimental-strip-types`; no second runner.

This story **implements** `[TARGET]` decisions rather than changing an invariant, so it needs no new `AD` — only the four-item spine handoff in Task 7.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` → Epic 21 preamble (the three FR-24 changes, and the AD-25/26/27 citation block) and §21.2; §21.3, §21.4, §21.5 for the boundaries; §22.3 for the song-book half]
- [Source: `ARCHITECTURE-SPINE.md` → **AD-25** (a shipped corpus is a projection of its file; the reconcile; the missing-file clause; the `bible_books` exception), **AD-26** (code is the key, locale is an attribute; the renames; *the file declares, the path merely locates*; duplicate-code refusal; inert `default_*`), **AD-27** (canonical identity; the `bible_books` two-owner measurement), **AD-28** (scope is required and refused for the *matcher*)]
- [Source: `ARCHITECTURE-SPINE.md` → *Deferred*: *"AD-25's reconcile exists in neither family yet"* (owned by 21.2 / 22.3), *"AD-25's closure is asserted by nothing"* (the guard, and the never-filter half), *"Where the two corpus registries … physically live is a Story 21.2 / 21.4 / 22.3 schema call"*, *"The shipped default corpus misnames one book"* and *"A second live output is exact violation"* (both 21.4's)]
- [Source: `prd.md` §4.11 FR-22 (translation-parameterised lookup; absence reported per translation) and §4.12 FR-24 (never-filter as *the requirement, not an implementation note*; the corpus paths; terminology)]
- [Source: `EXPERIENCE.md:45` (the presenter heading literal is this story's), `:73` (the IA table does not move), `:80` (the translation control is 21.3's), `:103` (the reference field is 21.5's), `:293-297` (Flow 9 — a corpus registers itself on boot and there is no install surface)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-01-locale.md` §2 (the measured surface; `corpus.ts` as the single path owner materially shrinking this story) and §5 (*"both carry a path move that supersedes a `done` story, so they should not be written casually"*)]
- [Source: `_bmad-output/implementation-artifacts/stories/21-1-verse-database-ships.md` → the supersession box, the from-zero reasoning, and the `258 ms` / `4.36 MB` / 31,102-verse measurements]
- [Source: `_bmad-output/project-context.md` → corpus paths and `corpus.ts` as their single owner; the two-axis and never-filter rules; the fixed `getDb` order; the test-registration rule; the mandatory commit/push audit]
- [Source: `AGENTS.md` → the BMad process gate (same-change-set artifact rules, spine amendments via `bmad-architecture`, never renumber an `AD-n`) and the public-repository rules for anything under `data/`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [ ] [Review][Patch] AC-7 negative test missing [`tests/`]
- [ ] [Review][Patch] README/data-models claim hash-skip reconcile but code reconciles every boot [`README.md:66`, `docs/data-models-monolith.md:161`]
- [ ] [Review][Patch] QUICKSTART still describes from-zero seeding [`docs/QUICKSTART.md:90`]
- [ ] [Review][Patch] 503 error text still says "seeds on first boot" [`src/app/api/scripture/route.ts:56`]
- [ ] [Review][Patch] `listInstalledBibleTranslations()` fully loads every corpus file on each `/api/scripture` request [`src/lib/corpus.ts:283`]
- [ ] [Review][Patch] One invalid sibling corpus file 500s all scripture lookups [`src/app/api/scripture/route.ts:27`, `src/lib/corpus.ts:283`]
- [ ] [Review][Patch] `bibleCorpusPath()` throws during 503 when corpus file absent from disk but DB empty [`src/app/api/scripture/route.ts:48`]
- [ ] [Review][Patch] No HTTP tests for `?translation=` (400/503/200) [`tests/scripture.test.mjs`]
- [ ] [Review][Patch] AC-14 reconcile smoke (DB-edit corrected on reboot) not automated [`tests/`]
- [ ] [Review][Patch] `lookupScripture` does not normalize `translationCode` casing [`src/lib/scripture.ts:98`]
- [ ] [Review][Patch] `getDb` singleton stays assigned if `reconcileBibleCorpus` throws mid-boot [`src/lib/db/index.ts:466`]
- [ ] [Review][Patch] Epic 21 header still lists 21.2 as `ready-for-dev` [`epics.md`]
- [ ] [Review][Patch] `discoverBibleTranslationFiles` does not exclude reserved `data/local/` [`src/lib/corpus.ts:72`]
- [ ] [Review][Patch] `listBibleTranslations()` exported from `db/index.ts` but has zero callers [`src/lib/db/index.ts`]
- [x] [Review][Defer] Partial verse range returns incomplete passage without error [`src/lib/scripture.ts:141`] — deferred, pre-existing
- [x] [Review][Defer] Removed corpus file leaves stale `bible_translations`/`bible_verses` rows [`src/lib/db/index.ts:125`] — deferred, pre-existing
- [x] [Review][Defer] `migrateBibleVersesTranslationCode` assumes `translation` or `translation_code` column exists [`src/lib/db/index.ts:111`] — deferred, pre-existing
