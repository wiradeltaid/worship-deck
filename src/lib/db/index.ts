import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { hashPassword } from '../auth/password';
import {
  DEFAULT_SONG_BOOK,
  bibleCorpusContentHash,
  discoverBibleTranslationFiles,
  loadBibleCorpus,
  loadSongBookCorpus,
  songBookCorpusPath,
  type HymnSeed,
} from '../corpus';
import {
  ARTIFACT_REGISTRY_BOOTSTRAP_KEY,
  bootstrapArtifactRegistry,
  CURRENT_DATA_VERSION,
  DATA_VERSION_KEY,
} from '../registry/seed';
import { migrateServiceBoundSnapshots } from '../registry/service-snapshot';
import { ARTIFACT_ENTRY_KEYS } from '../registry/types';
import { STAMP_NOW_SQL } from './stamp';

let db: Database.Database | null = null;

/**
 * DEC-005 / AD-36: per-book-code settings marker parallel to
 * ARTIFACT_REGISTRY_BOOTSTRAP_KEY (AD-17), extended to hymns. A book whose
 * marker exists has been bootstrapped once; its rows are administrator-owned
 * from then on and are never re-read from the corpus file.
 */
export const SONG_BOOK_BOOTSTRAP_KEY_PREFIX = 'song_book_bootstrapped_';

export function songBookBootstrapKey(bookCode: string): string {
  return SONG_BOOK_BOOTSTRAP_KEY_PREFIX + bookCode.trim().toUpperCase();
}

/**
 * `hymns` was created with `number INTEGER NOT NULL UNIQUE` — globally unique,
 * and every song book has a #1, so a second book could not be stored. SQLite
 * cannot add or drop a table constraint in place, so the table is rebuilt once.
 * Existing rows are all SDAH: it was the only corpus that ever shipped.
 */
function migrateHymnsForSongBooks(database: Database.Database) {
  const columns = database.prepare(`PRAGMA table_info(hymns)`).all() as {
    name: string;
  }[];
  if (columns.length === 0) return;
  if (columns.some((c) => c.name === 'book_code')) return;

  database.exec(`
    CREATE TABLE hymns_with_book_code (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_code TEXT NOT NULL DEFAULT '${DEFAULT_SONG_BOOK}',
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      lyrics TEXT NOT NULL,
      UNIQUE(book_code, number)
    );
    INSERT INTO hymns_with_book_code (id, book_code, number, title, lyrics)
      SELECT id, '${DEFAULT_SONG_BOOK}', number, title, lyrics FROM hymns;
    DROP TABLE hymns;
    ALTER TABLE hymns_with_book_code RENAME TO hymns;
  `);

  console.info(
    `[corpus] migration: hymns keyed by (book_code, number); existing rows ` +
      `recorded as ${DEFAULT_SONG_BOOK}`
  );
}

/**
 * Song book corpus bootstrap (DEC-005 / AD-36): the corpus file at
 * `data/song-book/<code>.json` seeds a book the first time it is seen and
 * never again. Gated by the per-book marker; when the marker is absent it
 * inserts only rows absent from the table (`ON CONFLICT DO NOTHING`) and
 * stamps the marker in the same transaction. Once a book is bootstrapped its
 * rows are administrator-owned: no boot path may overwrite `title` or
 * `lyrics`, and a gap is never refilled — that is what lets an operator's
 * saved lyric correction (UC-28) survive a restart. The bible family stays
 * under AD-25's full reconcile ({@link reconcileBibleCorpus}).
 *
 * Exported for `tests/dec005-song-book.test.mjs`, which proves the
 * no-resurrection and no-overwrite guarantees directly.
 */
export function upsertHymns(database: Database.Database) {
  const corpusPath = songBookCorpusPath(DEFAULT_SONG_BOOK);
  if (!fs.existsSync(corpusPath)) return;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `song book corpus metadata: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const meta = (raw?.book ?? {}) as Record<string, unknown>;
  const code = String(meta.code ?? DEFAULT_SONG_BOOK).trim().toUpperCase() || DEFAULT_SONG_BOOK;
  const name = String(meta.name ?? '').trim();
  const locale = String(meta.language ?? '').trim();
  const licence = String(meta.licence ?? '').trim();
  const provenance = String(meta.attribution ?? '').trim();

  const marker = songBookBootstrapKey(code);

  const already = database
    .prepare(`SELECT 1 FROM settings WHERE key = ?`)
    .get(marker);
  if (already) return;

  const corpus = loadSongBookCorpus(code);

  const insertIfAbsent = database.prepare(`
    INSERT INTO hymns (book_code, number, title, lyrics)
    VALUES (@book_code, @number, @title, @lyrics)
    ON CONFLICT(book_code, number) DO NOTHING
  `);

  const tx = database.transaction((rows: HymnSeed[]) => {
    const defaultRow = database
      .prepare(`SELECT COUNT(*) AS count FROM song_books WHERE is_default = 1`)
      .get() as { count: number } | undefined;
    const defaultCount = defaultRow?.count ?? 0;
    const isDefault = defaultCount === 0 ? 1 : 0;

    database
      .prepare(`
        INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ${STAMP_NOW_SQL})
        ON CONFLICT(book_code) DO NOTHING
      `)
      .run(code, name, locale, licence, provenance, isDefault);

    for (const hymn of rows) {
      insertIfAbsent.run({ ...hymn, book_code: corpus.code });
    }
    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(marker, '1');
  });
  tx.immediate(corpus.hymns);
  console.info(
    `[corpus] bootstrapped ${corpus.hymns.length} ${corpus.code} hymn(s) from the corpus file (DEC-005/AD-36 bootstrap-once)`
  );
}

/**
 * `bible_verses.translation` was renamed to `translation_code` (Story 21.2).
 * SQLite cannot rename a column in place when the UNIQUE constraint names it,
 * so the table is rebuilt once.
 */
function migrateBibleVersesTranslationCode(database: Database.Database) {
  const columns = database.prepare(`PRAGMA table_info(bible_verses)`).all() as {
    name: string;
  }[];
  if (columns.length === 0) return;
  if (columns.some((c) => c.name === 'translation_code')) return;

  database.exec(`
    CREATE TABLE bible_verses_with_translation_code (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      verse_text TEXT NOT NULL,
      translation_code TEXT NOT NULL DEFAULT 'KJV',
      UNIQUE(book_id, chapter, verse, translation_code),
      FOREIGN KEY (book_id) REFERENCES bible_books(id)
    );
    INSERT INTO bible_verses_with_translation_code
      (id, book_id, chapter, verse, verse_text, translation_code)
      SELECT id, book_id, chapter, verse, verse_text, translation FROM bible_verses;
    DROP TABLE bible_verses;
    ALTER TABLE bible_verses_with_translation_code RENAME TO bible_verses;
  `);

  console.info(
    '[corpus] migration: bible_verses.translation renamed to translation_code'
  );
}

/**
 * DEC-004 adds `variable_name` and `ann_set_id` columns to artifact_templates.
 * SQLite ADD COLUMN has no IF NOT EXISTS, so the guard pattern is to wrap each
 * ALTER in a try/catch and ignore the "duplicate column" error path.
 */
function migrateArtifactTemplatesNewColumns(database: Database.Database) {
  for (const stmt of [
    'ALTER TABLE artifact_templates ADD COLUMN variable_name TEXT',
    'ALTER TABLE artifact_templates ADD COLUMN ann_set_id INTEGER',
  ]) {
    try {
      database.prepare(stmt).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }
}

/**
 * DEC-004 allows `artifact_templates.payload` to be NULL — song-set-entry and
 * ann-set-marker rows carry no canvas of their own. SQLite cannot ALTER COLUMN
 * in place, so the table is rebuilt once (same discipline as
 * `migrateHymnsForSongBooks`).
 */
function migrateArtifactTemplatesPayloadNullable(database: Database.Database) {
  const columns = database.prepare(`PRAGMA table_info(artifact_templates)`).all() as {
    name: string;
    notnull: number;
  }[];
  if (columns.length === 0) return;
  const payload = columns.find((c) => c.name === 'payload');
  if (!payload || payload.notnull === 0) return;

  database.exec(`
    CREATE TABLE artifact_templates_payload_nullable (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      base_type TEXT NOT NULL,
      payload TEXT,
      updated_at TEXT NOT NULL,
      seed_hash TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      variable_name TEXT,
      ann_set_id INTEGER
    );
    INSERT INTO artifact_templates_payload_nullable
      (id, label, base_type, payload, updated_at, seed_hash, position, variable_name, ann_set_id)
      SELECT id, label, base_type, payload, updated_at, seed_hash, position, variable_name, ann_set_id
        FROM artifact_templates;
    DROP TABLE artifact_templates;
    ALTER TABLE artifact_templates_payload_nullable RENAME TO artifact_templates;
  `);
  console.info(
    `[registry] migration: artifact_templates.payload made nullable for DEC-004 song-set-entry rows`
  );
}

/**
 * Bible corpus reconciles from its committed file on every boot (AD-25).
 * Measured ~133-152 ms per reconcile on a developer machine (Story 21.2).
 */
export function reconcileBibleCorpus(database: Database.Database) {
  const descriptors = discoverBibleTranslationFiles();

  // AD-27's two-owner hazard, armed by Story 21.2 and closed by Story 21.4. It
  // stays a warning rather than a refusal: installing a translation is a file
  // drop with no registration step (AC-3), so refusing here would break the
  // documented install path to prevent a wrong book name.
  if (descriptors.length > 1) {
    console.warn(
      `[corpus] ${descriptors.length} bible translations installed ` +
        `(${descriptors.map((d) => d.code).join(', ')}) — display names live in ` +
        `bible_book_names per translation; bible_books is identity only.`
    );
  }

  const upsertRegistry = database.prepare(`
    INSERT INTO bible_translations (code, name, locale, licence, provenance, content_hash)
    VALUES (@code, @name, @locale, @licence, @provenance, @content_hash)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      locale = excluded.locale,
      licence = excluded.licence,
      provenance = excluded.provenance,
      content_hash = excluded.content_hash
  `);

  // Identity only: a second translation must not overwrite names on this row.
  // Display names belong in bible_book_names (AD-27 / Story 21.4).
  const insertBook = database.prepare(`
    INSERT INTO bible_books (id, name, short_name)
    VALUES (@id, @name, @short_name)
    ON CONFLICT(id) DO NOTHING
  `);

  const upsertBookName = database.prepare(`
    INSERT INTO bible_book_names (translation_code, book_id, name, short_name)
    VALUES (@translation_code, @book_id, @name, @short_name)
    ON CONFLICT(translation_code, book_id) DO UPDATE SET
      name = excluded.name,
      short_name = excluded.short_name
  `);

  const upsertVerse = database.prepare(`
    INSERT INTO bible_verses (book_id, chapter, verse, verse_text, translation_code)
    VALUES (@book_id, @chapter, @verse, @verse_text, @translation_code)
    ON CONFLICT(book_id, chapter, verse, translation_code) DO UPDATE SET
      verse_text = excluded.verse_text
  `);

  const deleteVerse = database.prepare(`
    DELETE FROM bible_verses
    WHERE translation_code = @translation_code
      AND book_id = @book_id
      AND chapter = @chapter
      AND verse = @verse
  `);

  for (const descriptor of descriptors) {
    const corpusPath = descriptor.corpusPath;
    try {
      const corpus = loadBibleCorpus(descriptor.code);
      const contentHash = bibleCorpusContentHash(corpusPath);
      const reconcileStart = Date.now();

      const reconcileOne = database.transaction(() => {
        upsertRegistry.run({
          code: corpus.code,
          name: corpus.name,
          locale: corpus.locale,
          licence: corpus.licence,
          provenance: corpus.provenance,
          content_hash: contentHash,
        });

        const fileKeys = new Set<string>();

        for (const book of corpus.books) {
          insertBook.run({
            id: book.id,
            name: book.name,
            short_name: book.shortName,
          });
          upsertBookName.run({
            translation_code: corpus.code,
            book_id: book.id,
            name: book.name,
            short_name: book.shortName,
          });
          book.chapters.forEach((verses, chapterIndex) => {
            verses.forEach((verse_text, verseIndex) => {
              const chapter = chapterIndex + 1;
              const verse = verseIndex + 1;
              fileKeys.add(`${book.id}:${chapter}:${verse}`);
              upsertVerse.run({
                book_id: book.id,
                chapter,
                verse,
                verse_text,
                translation_code: corpus.code,
              });
            });
          });
        }

        const stored = database
          .prepare(
            `SELECT book_id, chapter, verse FROM bible_verses
             WHERE translation_code = ?`
          )
          .all(corpus.code) as {
          book_id: number;
          chapter: number;
          verse: number;
        }[];

        for (const row of stored) {
          const key = `${row.book_id}:${row.chapter}:${row.verse}`;
          if (!fileKeys.has(key)) {
            deleteVerse.run({
              translation_code: corpus.code,
              book_id: row.book_id,
              chapter: row.chapter,
              verse: row.verse,
            });
          }
        }
      });

      reconcileOne();

      const elapsedMs = Date.now() - reconcileStart;
      console.info(
        `[corpus] reconciled ${corpus.counts.verses} ${corpus.code} verses across ` +
          `${corpus.counts.books} books (${elapsedMs} ms)`
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        `[corpus] bible translation ${descriptor.code} at ${corpusPath} ` +
          `failed to load — table left unchanged: ${reason}`
      );
    }
  }
}

/** Every installed bible translation with locale — no locale filter on the query. */
export function listBibleTranslations() {
  const database = getDb();
  return database
    .prepare(
      `SELECT code, name, locale, licence, provenance
       FROM bible_translations
       ORDER BY code`
    )
    .all() as {
    code: string;
    name: string;
    locale: string;
    licence: string;
    provenance: string;
  }[];
}

/**
 * AD-21's pre-counter repair: a database holding `artifact_templates` rows
 * with no `data_version` key predates this story's counter, and its absence
 * is not read as version 0 (AD-21). AD-4 records that no deployment exists
 * yet, so AD-18's total-replacement licence applies — the compacted version-1
 * shape is not migrated row by row; the pre-20.1 rows are wiped so the
 * AD-17 bootstrap that runs immediately after reseeds the compacted shape
 * (position included) from zero. This is the story's one recorded repair
 * transition, and it runs at most once: once the bootstrap stamps
 * `data_version`, the guard's own condition is false on every later boot.
 *
 * DEV NOTE (AC-10): if your local `data.db` predates Story 20.1, this wipes
 * its `artifact_templates` rows on your next boot and reseeds fresh at
 * version 1 — any layout edit you made there is not migrated forward, only
 * the shipped seed. This is a one-time developer-database reset, licensed by
 * AD-4 (no deployment exists yet) and AD-18's total-replacement rule; that
 * licence **expires at first deploy**, after which the same kind of change
 * needs a real migration over live `artifact_templates` rows instead.
 *
 * Exported for `tests/registry-reseed.test.mjs`, which calls this and
 * {@link bootstrapArtifactRegistry} directly, in each order, to prove the
 * `getDb` step order matters.
 */
export function repairPreCounterArtifactRegistry(database: Database.Database) {
  const hasVersion = database
    .prepare(`SELECT 1 FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY);
  if (hasVersion) return;

  const { count } = database
    .prepare(`SELECT COUNT(*) AS count FROM artifact_templates`)
    .get() as { count: number };
  if (count === 0) return;

  database.prepare(`DELETE FROM artifact_templates`).run();
  console.info(
    `[registry] Story 20.1: this database predates the AD-21 data-version counter. ` +
      `Compacting ${count} pre-20.1 template row(s) into a fresh data-version-1 bootstrap ` +
      `(developer database reset, licensed by AD-4/AD-18 — that licence expires at first ` +
      `deploy). Any layout edit on those rows was not carried forward; re-apply it after this boot.`
  );
}

/**
 * Story 20.2's one-time reset: a developer database bootstrapped before the
 * three-kind collapse holds rows whose `base_type` is no longer legal. Left
 * alone, every row fails closed on validation and the deck comes out empty.
 * When any such row exists, wipe `artifact_templates` and the AD-17 bootstrap
 * marker in one transaction so the bootstrap in the same boot re-seeds from the
 * re-authored seed. Triggered by that content predicate, not the version
 * counter — `CURRENT_DATA_VERSION` stays `1`. Self-limiting once no retired
 * base type can exist.
 *
 * Licensed by AD-4 (no deployment exists yet) and AD-18's total-replacement
 * rule; that licence **expires at first deploy**, after which the same change
 * needs a real migration over live `artifact_templates` rows plus every service
 * snapshot.
 *
 * DEV NOTE: if you seed from `data/local/default-registry.json`, re-author that
 * file onto the three kinds or delete it to fall back to the shipped seed —
 * the override is not rewritten by this change set. Any administrator layout
 * edit on an otherwise-valid row is destroyed when the reset fires, not only
 * rows carrying a retired base type.
 *
 * Exported for `tests/registry-three-kind-reset.test.mjs`.
 */
export function repairPreThreeKindArtifactRegistry(database: Database.Database) {
  // Story 20.7 widens `base_type` with `songset-*` slot identities; derive the
  // allowed set from ARTIFACT_ENTRY_KEYS so this predicate cannot drift.
  const allowedPlaceholders = ARTIFACT_ENTRY_KEYS.map(() => '?').join(', ');

  const tx = database.transaction(() => {
    const retired = database
      .prepare(
        `SELECT 1 FROM artifact_templates
         WHERE base_type NOT IN (${allowedPlaceholders})
         LIMIT 1`
      )
      .get(...ARTIFACT_ENTRY_KEYS);
    if (!retired) return;

    const { count } = database
      .prepare(`SELECT COUNT(*) AS count FROM artifact_templates`)
      .get() as { count: number };

    database.prepare(`DELETE FROM artifact_templates`).run();
    database
      .prepare(`DELETE FROM settings WHERE key = ?`)
      .run(ARTIFACT_REGISTRY_BOOTSTRAP_KEY);

    console.info(
      `[registry] Story 20.2: this database carries retired template base types. ` +
        `Resetting all ${count} row(s) — including otherwise-valid rows and any ` +
        `administrator layout edits on them — and clearing the bootstrap marker so the ` +
        `re-authored seed can load (developer database reset, licensed by AD-4/AD-18 — ` +
        `that licence expires at first deploy). Re-author ` +
        `data/local/default-registry.json` +
        ` onto the three kinds or delete it to use the shipped seed.`
    );
  });
  tx.immediate();
}

/**
 * Resolves the path to the canonical Go schema file (internal/db/schema.sql).
 * Checks process.cwd() and searches up to parent directories if running from subdirectories.
 */
export function resolveSchemaSqlPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, 'internal', 'db', 'schema.sql');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), 'internal', 'db', 'schema.sql');
}

/**
 * Mirrors `internal/db/bootstrap.go` (and `internal/db/db.go` Bootstrap).
 * Extracted so tests and runtime callers can run the exact boot sequence on any
 * open SQLite handle.
 */
export function bootstrap(database: Database.Database): void {
  // Single-node production defaults (better-sqlite3)
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  database.pragma('foreign_keys = ON');

  // SPEC-57: Read and execute the canonical Go schema.sql directly so there is
  // exactly one source of truth for table and column declarations.
  const schemaPath = resolveSchemaSqlPath();
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schemaSql);

  // Upgrade older pre-existing databases to ensure newer columns exist
  for (const table of [
    'services',
    'hymns',
    'announcement_items',
    'song_set_entries',
    'background_library_images',
  ]) {
    try {
      database.prepare(`ALTER TABLE ${table} ADD COLUMN global_id TEXT`).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }
  for (const stmt of [
    'ALTER TABLE services ADD COLUMN parser_profile_id TEXT',
    'ALTER TABLE services ADD COLUMN parser_profile_version INTEGER',
    'ALTER TABLE service_registry_snapshots ADD COLUMN variable_name TEXT',
    'ALTER TABLE service_registry_snapshots ADD COLUMN ann_set_id INTEGER',
    'ALTER TABLE song_set_entries ADD COLUMN extraction_regex TEXT',
  ]) {
    try {
      database.prepare(stmt).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }

  try {
    database.prepare('ALTER TABLE song_set_entries ADD COLUMN extraction_regex TEXT').run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }

  // Migrate older DBs that predate images_payload / updated_at / participants_payload
  try {
    database.prepare('ALTER TABLE services ADD COLUMN images_payload TEXT').run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  try {
    database.prepare(
      `ALTER TABLE services ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    ).run();
    database.prepare(
      `UPDATE services SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)`
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  try {
    database.prepare(
      'ALTER TABLE services ADD COLUMN participants_payload TEXT'
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  // Migrate DBs created before session revocation existed.
  try {
    database.prepare(
      `ALTER TABLE accounts ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1`
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  // SPEC-39: Media Library category column
  try {
    database.prepare(
      `ALTER TABLE background_library_images ADD COLUMN category TEXT NOT NULL DEFAULT 'background'`
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  // SPEC-40: Media Library name column and category reconciliation
  try {
    database.prepare(
      `ALTER TABLE background_library_images ADD COLUMN name TEXT NOT NULL DEFAULT ''`
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  try {
    database.prepare(
      `UPDATE background_library_images SET category = 'announcement' WHERE category = 'flyer'`
    ).run();
  } catch (e) {
    // ignore
  }
  // SPEC-39: Weekly Afternoon Program column
  try {
    database.prepare(
      `ALTER TABLE services ADD COLUMN afternoon_program TEXT DEFAULT ''`
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  // Migrate DBs created before the registry recorded which seed a row an
  // explicit Reset restores. Schema only — no row's stored value changes.
  try {
    database.prepare(
      'ALTER TABLE artifact_templates ADD COLUMN seed_hash TEXT'
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  // Migrate DBs created before AC-1's ordering column existed. The default
  // is never trusted as a real position — repairPreCounterArtifactRegistry
  // below wipes any row that predates the AD-21 counter, and the AD-17
  // bootstrap that follows assigns every position fresh.
  try {
    database.prepare(
      'ALTER TABLE artifact_templates ADD COLUMN position INTEGER NOT NULL DEFAULT 0'
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  try {
    database.prepare('ALTER TABLE services ADD COLUMN registry_snapshot_at TEXT').run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  try {
    database.prepare('ALTER TABLE announcement_items ADD COLUMN updated_at TEXT').run();
    database.prepare(
      `UPDATE announcement_items
          SET updated_at = COALESCE(created_at, ${STAMP_NOW_SQL})
        WHERE updated_at IS NULL OR updated_at = ''`
    ).run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  migrateHymnsForSongBooks(database);
  migrateBibleVersesTranslationCode(database);
  migrateArtifactTemplatesNewColumns(database);
  migrateArtifactTemplatesPayloadNullable(database);

  // --- data migrations (AD-18 / AD-21) ---
  repairPreCounterArtifactRegistry(database);
  repairPreThreeKindArtifactRegistry(database);

  // --- first-boot bootstrap (AD-17) ---
  bootstrapArtifactRegistry(database);
  migrateSongSetShapeDec004(database);
  migratePredefinedFieldsDec004(database);
  migrateServiceBoundSnapshots(database);
  migrateSongBookBootstrapDec005(database);
  migrateSongBookMetadata(database);
  migrateSongSetInputsDec004(database);
  migrateAnnouncementItemsCascade(database);
  migrateSongBookRow(database);
  migrateParserProfiles(database);
  migrateFormLayout(database);

  // --- corpus load ---
  // DEC-005/AD-36: upsertHymns is a bootstrap-once seed and MUST run after
  // migrateSongBookBootstrapDec005, so an existing install's books are
  // marked first and never re-seeded. The bible reconcile (AD-25) is
  // untouched by DEC-005.
  upsertHymns(database);
  reconcileBibleCorpus(database);

  migrateDataVersionToCurrent(database);

  bootstrapAdminIfEmpty(database);
}

export function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data.db');
    const dir = path.dirname(dbPath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    try {
      bootstrap(db);
    } catch (err) {
      db.close();
      db = null;
      throw err;
    }
  }

  return db;
}

/**
 * DEC-004 data migrations (data_version 3 → 4 → 5).
 *
 * Mirrors `internal/db/migrate_song_set_shape.go` and
 * `internal/db/migrate_predefined_fields.go`. Lives here (not in its own
 * module) so the corpus-closure guard does not flag the song_set writes —
 * db/index.ts is the canonical startup-migration home.
 *
 * Sequence is fixed: 3 → 4 first (physical-shape), then 4 → 5 (vocabulary).
 */
function migrateSongSetShapeDec004(database: Database.Database): void {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  const version = row ? Number(row.value) : 0;
  if (!Number.isFinite(version) || version >= 4) return;

  type SnapshotRow = {
    id: string;
    label: string;
    payload: string | null;
    position: number;
  };
  const snapshot = database
    .prepare(
      `SELECT id, label, payload, position
         FROM artifact_templates
        WHERE base_type = 'song-set'
        ORDER BY position ASC`
    )
    .all() as SnapshotRow[];

  if (snapshot.length === 0) {
    console.info(
      '[registry] migration 3->4: no live song-set rows; refusing (data_version not bumped)'
    );
    return;
  }

  const source = snapshot[0];
  let sourceTemplate: Record<string, unknown>;
  try {
    sourceTemplate = JSON.parse(source.payload ?? '{}') as Record<string, unknown>;
  } catch (err) {
    console.info(
      `[registry] migration 3->4: source row ${source.id} payload invalid; refusing: ${String(err)}`
    );
    return;
  }
  const sourceLayouts = (sourceTemplate.layouts as Record<string, unknown>) ?? {};
  const sourceTitle = sourceLayouts.title as Record<string, unknown> | undefined;
  const sourceLyric = sourceLayouts.lyric as Record<string, unknown> | undefined;
  if (!sourceTitle || !sourceLyric) {
    console.info(
      `[registry] migration 3->4: source row ${source.id} missing title or lyric layout`
    );
    return;
  }

  for (const other of snapshot.slice(1)) {
    let otherTemplate: Record<string, unknown>;
    try {
      otherTemplate = JSON.parse(other.payload ?? '{}') as Record<string, unknown>;
    } catch {
      console.info(
        `[registry] migration 3->4: row ${other.id} payload does not parse; leaving untouched`
      );
      continue;
    }
    const otherLayouts = (otherTemplate.layouts as Record<string, unknown>) ?? {};
    const otherTitle = otherLayouts.title as Record<string, unknown> | undefined;
    const otherLyric = otherLayouts.lyric as Record<string, unknown> | undefined;
    if (JSON.stringify(sourceTitle) !== JSON.stringify(otherTitle)) {
      console.info(
        `[registry] migration 3->4: row ${other.id} title diverges from source; needs-review`
      );
    }
    if (JSON.stringify(sourceLyric) !== JSON.stringify(otherLyric)) {
      console.info(
        `[registry] migration 3->4: row ${other.id} lyric diverges from source; needs-review`
      );
    }
  }

  const rename = (
    layout: Record<string, unknown>,
    mapping: Record<string, string>
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...layout };
    const elements = Array.isArray(layout.elements)
      ? (layout.elements as Record<string, unknown>[])
      : [];
    out.elements = elements.map((el) => {
      const clone: Record<string, unknown> = { ...el };
      const pk = clone.placeholderKey;
      if (typeof pk === 'string' && Object.prototype.hasOwnProperty.call(mapping, pk)) {
        const next = mapping[pk];
        if (next === '') delete clone.placeholderKey;
        else clone.placeholderKey = next;
      }
      return clone;
    });
    return out;
  };

  const titlePayload = rename(sourceTitle, {
    hymnNumber: 'song_number',
    songTitle: 'song_title',
  });
  const versePayload = rename(sourceLyric, {
    label: 'verse_number',
    lyrics: 'verse_content[]',
  });
  delete (versePayload as any).backgroundImage;
  const reffPayload = rename(sourceLyric, {
    label: '',
    lyrics: 'reff[]',
  });
  delete (reffPayload as any).backgroundImage;

  const defaultSeeds: Record<string, string> = {
    'bt-opening-song': 'opening_song_bt',
    'bt-closing-song': 'closing_song_bt',
    'ds-opening-song': 'opening_song_dw',
    'ds-closing-song': 'closing_song_dw',
  };

  const reserved = new Set<string>(Object.values(defaultSeeds));
  const existing = database
    .prepare(
      `SELECT variable_name FROM artifact_templates
        WHERE variable_name IS NOT NULL AND base_type = 'song-set-entry'`
    )
    .all() as { variable_name: string }[];
  for (const e of existing) reserved.add(e.variable_name);

  const derivedCounts = new Map<string, number>();
  const NON_ALNUM = /[^a-z0-9]+/g;
  const derive = (label: string, id: string): string => {
    const folded = label
      .toLowerCase()
      .trim()
      .replace(NON_ALNUM, '_')
      .replace(/^_+|_+$/g, '');
    const base = folded || `song_set_entry_${id}`;
    return base.length > 40 ? base.slice(0, 40).replace(/_+$/, '') : base;
  };
  const dedupe = (
    base: string,
    reserved: Set<string>,
    counts: Map<string, number>
  ): string => {
    if (!reserved.has(base)) return base;
    let n = (counts.get(base) ?? 1) + 1;
    while (reserved.has(`${base}_${n}`)) n++;
    counts.set(base, n);
    return `${base}_${n}`;
  };

  const tx = database.transaction(() => {
    const insertTrio = database.prepare(
      `INSERT OR REPLACE INTO song_set_layouts (role, payload, updated_at, seed_hash)
       VALUES (?, ?, ${STAMP_NOW_SQL}, NULL)`
    );
    insertTrio.run('title', JSON.stringify(titlePayload));
    insertTrio.run('verse', JSON.stringify(versePayload));
    insertTrio.run('reff', JSON.stringify(reffPayload));

    const updateDefault = database.prepare(
      `UPDATE artifact_templates
          SET base_type = 'song-set-entry',
              variable_name = ?,
              payload = NULL,
              seed_hash = NULL,
              updated_at = ${STAMP_NOW_SQL}
        WHERE id = ?`
    );
    const updateDerived = database.prepare(
      `UPDATE artifact_templates
          SET base_type = 'song-set-entry',
              variable_name = ?,
              payload = NULL,
              seed_hash = NULL,
              updated_at = ${STAMP_NOW_SQL}
        WHERE id = ?`
    );
    const deleteGeneric = database.prepare(
      `DELETE FROM artifact_templates WHERE id = ?`
    );

    for (const r of snapshot) {
      if (r.id === 'song-set') {
        deleteGeneric.run(r.id);
        console.info(
          `[registry] migration 3->4: retired generic row ${r.id} (dsMiddle loop)`
        );
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(defaultSeeds, r.id)) {
        updateDefault.run(defaultSeeds[r.id], r.id);
        continue;
      }
      const base = derive(r.label ?? '', r.id);
      const name = dedupe(base, reserved, derivedCounts);
      reserved.add(name);
      updateDerived.run(name, r.id);
      console.info(
        `[registry] migration 3->4: row ${r.id} converted to song-set-entry with derived variable_name=${name} (needs-review)`
      );
    }

    // Compact positions so AD-21's 0..N-1 invariant holds after the row
    // removal (the generic song-set row at position 20 is gone).
    const survivors = database
      .prepare(`SELECT id FROM artifact_templates ORDER BY position`)
      .all() as { id: string }[];
    const reposition = database.prepare(
      `UPDATE artifact_templates SET position = ? WHERE id = ?`
    );
    survivors.forEach((s, i) => reposition.run(i, s.id));

    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, '4');
  });
  tx.immediate();
  console.info('[registry] migration 3->4: applied song-set physical-shape migration');
}

function migratePredefinedFieldsDec004(database: Database.Database): void {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  const version = row ? Number(row.value) : 0;
  if (!Number.isFinite(version) || version < 4) return;
  if (version >= 5) return;

  type Row = { id: string; payload: string };
  const rows = database
    .prepare(`SELECT id, payload FROM artifact_templates WHERE payload IS NOT NULL`)
    .all() as Row[];

  type Mapping = { key: string; shape: 'text' | 'image' };
  const mapKey = (templateID: string, oldKey: string): Mapping | null => {
    const scriptureOrTheme = (kind: 'reference' | 'text'): string => {
      if (templateID === 'verse-reading') {
        return kind === 'reference' ? 'scripture_reference' : 'scripture_text';
      }
      if (templateID === 'bible-verse-contemplation') {
        return kind === 'reference' ? 'theme_reference' : 'theme_text';
      }
      return kind === 'reference' ? 'scripture_reference' : 'scripture_text';
    };
    switch (oldKey) {
      case 'date':
        return { key: 'service_date', shape: 'text' };
      case 'reference':
        return { key: scriptureOrTheme('reference'), shape: 'text' };
      case 'text':
        return { key: scriptureOrTheme('text'), shape: 'text' };
      case 'performer':
        return { key: 'special_song', shape: 'text' };
      case 'title':
        return { key: 'sermon_title', shape: 'text' };
      case 'speaker':
        return { key: 'sermon_speaker_name', shape: 'text' };
      case 'imageUrl':
        return { key: 'sermon_poster', shape: 'image' };
      case 'person':
        return { key: 'closing_prayer_person', shape: 'text' };
      case 'familyText':
        return { key: 'family_request', shape: 'text' };
      case 'youthText':
        return { key: 'youth_request', shape: 'text' };
      case 'familyPhoto':
        return { key: 'family_photo', shape: 'image' };
      case 'youthPhoto':
        return { key: 'youth_photo', shape: 'image' };
    }
    return null;
  };

  const tx = database.transaction(() => {
    const update = database.prepare(
      `UPDATE artifact_templates SET payload = ?, updated_at = ${STAMP_NOW_SQL} WHERE id = ?`
    );
    let touched = 0;
    for (const r of rows) {
      let tmpl: Record<string, unknown>;
      try {
        tmpl = JSON.parse(r.payload) as Record<string, unknown>;
      } catch {
        console.info(
          `[registry] migration 4->5: row ${r.id} payload does not parse; leaving untouched`
        );
        continue;
      }
      const layouts = tmpl.layouts as Record<string, unknown> | undefined;
      if (!layouts) continue;
      let rowTouched = false;
      for (const layoutKey of Object.keys(layouts)) {
        const layout = layouts[layoutKey] as Record<string, unknown> | undefined;
        if (!layout || !Array.isArray(layout.elements)) continue;
        layout.elements = (layout.elements as Record<string, unknown>[]).map((el) => {
          const pk = el.placeholderKey;
          if (typeof pk !== 'string' || pk === '') return el;
          const m = mapKey(r.id, pk);
          if (!m) return el;
          if (m.shape === 'text') {
            const clone: Record<string, unknown> = { ...el };
            clone.content = `{${m.key}}`;
            delete clone.placeholderKey;
            rowTouched = true;
            return clone;
          }
          const clone: Record<string, unknown> = { ...el };
          clone.placeholderKey = m.key;
          rowTouched = true;
          return clone;
        });
      }
      if (!rowTouched) continue;
      update.run(JSON.stringify(tmpl), r.id);
      touched++;
    }
    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, '5');
    if (touched > 0) {
      console.info(
        `[registry] migration 4->5: applied predefined-field vocabulary migration to ${touched} row(s)`
      );
    }
  });
  tx.immediate();
}

/**
 * DEC-005 data migration (data_version 5 → 6): stamp a per-book bootstrap
 * marker for every book already present in `hymns`, so an existing install is
 * never re-bootstrapped and its gaps are never refilled from the corpus file
 * (AD-17 extended to hymns by DEC-005/AD-36). A fresh database holds no hymn
 * rows, so no marker is stamped here; {@link upsertHymns} then seeds the book
 * from zero and stamps the marker itself. Runs once, gated by
 * settings.data_version.
 *
 * Mirrors `internal/db/migrate_song_book_bootstrap.go`.
 *
 * Exported for `tests/dec005-song-book.test.mjs`, same as the two repair
 * transitions above.
 */
export function migrateSongBookBootstrapDec005(
  database: Database.Database
): void {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  const version = row ? Number(row.value) : 0;
  if (!Number.isFinite(version) || version >= 6) return;

  let stamped = 0;
  const tx = database.transaction(() => {
    const codes = database
      .prepare(`SELECT DISTINCT book_code FROM hymns ORDER BY book_code`)
      .all() as { book_code: string }[];
    stamped = codes.length;
    const stamp = database.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
    );
    for (const c of codes) stamp.run(songBookBootstrapKey(c.book_code), '1');
    stamp.run(DATA_VERSION_KEY, '6');
  });
  tx.immediate();
  console.info(
    `[corpus] migration 5->6: stamped ${stamped} song-book bootstrap marker(s) (DEC-005/AD-36)`
  );
}

/**
 * DEC-004 S2 migration (data_version 6 -> 7): backfill song_set_inputs for the
 * four default entries from each Service's stored parsed_data hymn buckets:
 *
 *   bt[0] -> opening_song_bt   bt[1] -> closing_song_bt
 *   ds[0] -> opening_song_dw   ds[1] -> closing_song_dw
 *
 * Mirrors internal/db/migrate_song_set_inputs.go.
 */
export function migrateSongSetInputsDec004(database: Database.Database): void {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  const version = row ? Number(row.value) : 0;
  if (!Number.isFinite(version) || version >= 7) return;

  const services = database
    .prepare(
      `SELECT id, parsed_data FROM services
       WHERE parsed_data IS NOT NULL AND parsed_data != ''
       ORDER BY id`
    )
    .all() as { id: number; parsed_data: string }[];

  const liveRows = database
    .prepare(
      `SELECT variable_name FROM artifact_templates
       WHERE base_type = 'song-set-entry' AND variable_name IS NOT NULL`
    )
    .all() as { variable_name: string }[];
  const live = new Set(liveRows.map((r) => r.variable_name));

  let migrated = 0;
  const tx = database.transaction(() => {
    const upsert = database.prepare(`
      INSERT OR REPLACE INTO song_set_inputs
        (service_id, variable_name, song_number, song_book_code, background_id, lyric_override, updated_at)
      VALUES (?, ?, ?, '', NULL, NULL, ${STAMP_NOW_SQL})
    `);

    for (const svc of services) {
      let parsed: { items?: Array<{ type: string; title?: string; number?: number }> };
      try {
        parsed = JSON.parse(svc.parsed_data);
      } catch {
        continue;
      }
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      let current: 'bt' | 'ds' | null = null;
      const bt: number[] = [];
      const ds: number[] = [];
      const all: number[] = [];
      let hasBT = false;
      let hasDS = false;

      for (const item of items) {
        if (item.type === 'section' && typeof item.title === 'string') {
          if (/^BIBLE\s+TALK\b/i.test(item.title)) {
            current = 'bt';
            hasBT = true;
          } else if (/^DIVINE\s+SERVICE\b/i.test(item.title)) {
            current = 'ds';
            hasDS = true;
          } else {
            current = null;
          }
          continue;
        }
        if (item.type === 'hymn' && typeof item.number === 'number' && item.number > 0) {
          all.push(item.number);
          if (current === 'bt') bt.push(item.number);
          else if (current === 'ds') ds.push(item.number);
        }
      }

      const finalBt = hasBT || hasDS ? bt : all.slice(0, 2);
      const finalDs = hasBT || hasDS ? ds : all.slice(2);

      const pairs = [
        { idx: 0, vn: 'opening_song_bt', nums: finalBt },
        { idx: 1, vn: 'closing_song_bt', nums: finalBt },
        { idx: 0, vn: 'opening_song_dw', nums: finalDs },
        { idx: 1, vn: 'closing_song_dw', nums: finalDs },
      ];

      for (const p of pairs) {
        if (p.idx < p.nums.length && live.has(p.vn)) {
          upsert.run(svc.id, p.vn, p.nums[p.idx]);
          migrated++;
        }
      }
    }

    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, '7');
  });

  tx.immediate();
  console.info(
    `[registry] migration 6->7: backfilled ${migrated} song_set_inputs row(s)`
  );
}

/**
 * Song book metadata migration (AD-26 / data_version 8 -> 9). One-time pass that:
 *   - adds locale, licence, provenance columns to song_books if missing,
 *   - backfills existing rows with a non-NULL locale (sourced from corpus file if reachable,
 *     falling back to shipped default "en" for SDAH),
 *   - bumps data_version to 9.
 *
 * Mirrors `internal/db/migrate_song_book_metadata.go`.
 */
export function migrateSongBookMetadata(database: Database.Database): void {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  const version = row ? Number(row.value) : 0;
  if (!Number.isFinite(version) || version >= 9) return;

  for (const col of ['locale TEXT', 'licence TEXT', 'provenance TEXT']) {
    try {
      database.prepare(`ALTER TABLE song_books ADD COLUMN ${col}`).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }

  const existingRows = database
    .prepare(
      `SELECT book_code FROM song_books WHERE locale IS NULL OR locale = ''`
    )
    .all() as { book_code: string }[];

  const tx = database.transaction(() => {
    const update = database.prepare(
      `UPDATE song_books SET locale = ? WHERE book_code = ?`
    );

    for (const r of existingRows) {
      let locale = 'en';
      try {
        const corpusPath = songBookCorpusPath(r.book_code);
        if (fs.existsSync(corpusPath)) {
          const raw = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as Record<
            string,
            unknown
          >;
          const meta = (raw?.book ?? {}) as Record<string, unknown>;
          const loc = String(meta.locale ?? meta.language ?? '').trim();
          if (loc) locale = loc;
        }
      } catch {
        locale = 'en';
      }
      update.run(locale, r.book_code);
    }

    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, '9');
  });

  tx.immediate();
  console.info(
    `[registry] migration 8->9: migrated song_books metadata columns and backfilled ${existingRows.length} row(s)`
  );
}

/**
 * Announcement-items cascade retirement migration (data_version 9 -> 10).
 * One-time pass that:
 *   - removes foreign key constraint from announcement_items(service_id),
 *   - preserves all existing rows and column values intact,
 *   - bumps data_version to 10.
 *
 * Note on foreign key: In SQLite with PRAGMA foreign_keys = ON, keeping
 * FOREIGN KEY (service_id) REFERENCES services(id) without ON DELETE CASCADE
 * defaults to RESTRICT / NO ACTION, technical trap forbidding deleting a services row
 * if any announcement_items row references it. Since announcement_items must survive
 * Service deletion while retaining service_id, the FK constraint itself is dropped.
 *
 * Gated structurally on PRAGMA foreign_key_list(announcement_items) rather than
 * settings.data_version, ensuring databases already stamped 10 whose FK constraint
 * remained intact are safely repaired on the next boot.
 *
 * Mirrors `internal/db/migrate_announcement_items_cascade.go`.
 */
export function migrateAnnouncementItemsCascade(database: Database.Database): void {
  type FKRow = {
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string;
    on_update: string;
    on_delete: string;
    match: string;
  };
  const fks = database.prepare(`PRAGMA foreign_key_list(announcement_items)`).all() as FKRow[];
  const hasFK = fks.some((fk) => fk.from?.toLowerCase() === 'service_id');
  if (!hasFK) return;

  const tx = database.transaction(() => {
    database.exec(`
      CREATE TABLE announcement_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_url TEXT NOT NULL,
        service_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      );
      INSERT INTO announcement_items_new (id, image_url, service_id, sort_order, created_at, updated_at)
        SELECT id, image_url, service_id, sort_order, created_at, updated_at FROM announcement_items;
      DROP TABLE announcement_items;
      ALTER TABLE announcement_items_new RENAME TO announcement_items;
    `);

    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, '10');
  });

  tx.immediate();
  console.info(
    `[registry] migration 9->10: retired foreign key on announcement_items (data_version=10)`
  );
}

/**
 * Song-book row migration (AD-17 / AD-21 / data_version 10 -> 11).
 * One-time pass that:
 *   - inserts the SDAH song_books registry row from data/song-book/sdah.json when absent,
 *   - sets is_default = 1 only if no existing song_books row is already marked default,
 *   - leaves an existing SDAH row completely untouched (no overwrite, no resurrection),
 *   - bumps data_version to 11.
 *
 * Mirrors `internal/db/migrate_song_book_row.go`.
 */
export function migrateSongBookRow(database: Database.Database): void {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  const version = row ? Number(row.value) : 0;
  if (!Number.isFinite(version) || version >= 11) return;

  const corpusPath = songBookCorpusPath(DEFAULT_SONG_BOOK);
  let metaFound = false;
  let code = DEFAULT_SONG_BOOK;
  let name = '';
  let locale = '';
  let licence = '';
  let provenance = '';

  if (fs.existsSync(corpusPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as Record<string, unknown>;
      const meta = (raw?.book ?? {}) as Record<string, unknown>;
      code = String(meta.code ?? DEFAULT_SONG_BOOK).trim().toUpperCase() || DEFAULT_SONG_BOOK;
      name = String(meta.name ?? '').trim();
      locale = String(meta.language ?? '').trim();
      licence = String(meta.licence ?? '').trim();
      provenance = String(meta.attribution ?? '').trim();
      metaFound = true;
    } catch (err) {
      throw new Error(
        `song book corpus metadata in migration 10->11: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const tx = database.transaction(() => {
    if (metaFound) {
      const defaultRow = database
        .prepare(`SELECT COUNT(*) AS count FROM song_books WHERE is_default = 1`)
        .get() as { count: number } | undefined;
      const defaultCount = defaultRow?.count ?? 0;
      const isDefault = defaultCount === 0 ? 1 : 0;

      const res = database
        .prepare(`
          INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ${STAMP_NOW_SQL})
          ON CONFLICT(book_code) DO NOTHING
        `)
        .run(code, name, locale, licence, provenance, isDefault);

      if (res.changes > 0) {
        console.info(`[corpus] migration 10->11: seeded song book ${code} (is_default=${isDefault})`);
      }
    }

    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, '11');
  });

  tx.immediate();
  console.info(`[registry] migration 10->11: song_books row migration complete (data_version=11)`);
}

import {
  BUILTIN_DEFAULT_PARSER_PROFILE_ID,
  BUILTIN_DEFAULT_PARSER_PROFILE_SLUG,
  BUILTIN_DEFAULT_PARSER_PROFILE_TITLE,
  BUILTIN_DEFAULT_PARSER_PROFILE_DESC,
  BUILTIN_DEFAULT_RULES_JSON,
} from '../parser-constants';

export {
  BUILTIN_DEFAULT_PARSER_PROFILE_ID,
  BUILTIN_DEFAULT_PARSER_PROFILE_SLUG,
  BUILTIN_DEFAULT_PARSER_PROFILE_TITLE,
  BUILTIN_DEFAULT_PARSER_PROFILE_DESC,
  BUILTIN_DEFAULT_RULES_JSON,
};

export function migrateParserProfiles(database: Database.Database): void {
  try {
    database.prepare('ALTER TABLE services ADD COLUMN parser_profile_id TEXT').run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
  try {
    database.prepare('ALTER TABLE services ADD COLUMN parser_profile_version INTEGER').run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }

  const existing = database
    .prepare(`SELECT COUNT(*) AS count FROM rundown_parser_profiles WHERE slug = ?`)
    .get(BUILTIN_DEFAULT_PARSER_PROFILE_SLUG) as { count: number } | undefined;

  if (!existing || existing.count === 0) {
    database
      .prepare(`
        INSERT INTO rundown_parser_profiles (
          id, slug, title, description, rules_json, is_builtin, is_default, version, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 1, 1, 1, ${STAMP_NOW_SQL}, ${STAMP_NOW_SQL}
        )
      `)
      .run(
        BUILTIN_DEFAULT_PARSER_PROFILE_ID,
        BUILTIN_DEFAULT_PARSER_PROFILE_SLUG,
        BUILTIN_DEFAULT_PARSER_PROFILE_TITLE,
        BUILTIN_DEFAULT_PARSER_PROFILE_DESC,
        BUILTIN_DEFAULT_RULES_JSON
      );
    console.info(`[parser] seeded builtin-default rundown parser profile`);
  }
}

export function migrateFormLayout(database: Database.Database): void {
  try {
    database.prepare('ALTER TABLE song_set_entries ADD COLUMN extraction_regex TEXT').run();
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }

  const existingLayout = database
    .prepare(`SELECT COUNT(*) AS count FROM form_layouts WHERE id = 'default-layout'`)
    .get() as { count: number } | undefined;

  if (!existingLayout || existingLayout.count === 0) {
    database.prepare(`
      INSERT OR IGNORE INTO form_layouts (id, title, description, is_active, version)
      VALUES ('default-layout', 'Default Form Layout', 'Standard layout for worship services', 1, 1)
    `).run();

    const fields = [
      {
        seedKey: 'default.verse_reference',
        variableName: 'scripture_reference',
        shownText: 'Verse Reading Reference',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: '(?i)^(?:Verse\\s+Reading|Memory\\s+(?:Verse|Text)|Ayat\\s+Bacaan)\\s*[:\\-]\\s*(?<value>.*)$',
      },
      {
        seedKey: 'default.verse_text',
        variableName: 'scripture_text',
        shownText: 'Verse Reading Text',
        fieldType: 'text_area',
        inputLength: null,
        initialLines: 5,
        extractionRegex: null,
      },
      {
        seedKey: 'default.sermon_speaker',
        variableName: 'sermon_speaker_name',
        shownText: 'Sermon Speaker',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: '(?i)^Sermon\\s*[:\\-]\\s*(?<value>.+?)(?:\\s+[\"“](?<title>[^\"”]+)[\"”])?\\s*$',
      },
      {
        seedKey: 'default.sermon_title',
        variableName: 'sermon_title',
        shownText: 'Sermon Title',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: null,
      },
      {
        seedKey: 'default.sermon_graphic',
        variableName: 'sermon_poster',
        shownText: 'Sermon Poster',
        fieldType: 'image',
        inputLength: null,
        initialLines: null,
        extractionRegex: null,
      },
      {
        seedKey: 'default.closing_prayer',
        variableName: 'closing_prayer_person',
        shownText: 'Closing Prayer',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: '(?i)^(?:Closing\\s+Prayer|Doa\\s+Tutup)\\s*[:\\-]\\s*(?<value>.*)$',
      },
      {
        seedKey: 'default.special_song',
        variableName: 'special_song',
        shownText: 'Special Song',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: '(?i)^Special\\s+Song\\s*[:\\-]\\s*(?<value>.*)$',
      },
      {
        seedKey: 'default.family_photo',
        variableName: 'family_photo',
        shownText: 'Family Photo',
        fieldType: 'image',
        inputLength: null,
        initialLines: null,
        extractionRegex: null,
      },
      {
        seedKey: 'default.family_name',
        variableName: 'family_name',
        shownText: 'Family Name',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: '(?i)^(?:Family(?:\\s*&\\s*|\\s+and\\s+|/\\s*)Youth|Family\\s+of\\s+the\\s+Week|Keluarga)\\s*[:\\-]\\s*(?<value>.*)$',
      },
      {
        seedKey: 'default.family_request',
        variableName: 'family_request',
        shownText: 'Family Prayer Request',
        fieldType: 'text_area',
        inputLength: null,
        initialLines: 5,
        extractionRegex: null,
      },
      {
        seedKey: 'default.youth_photo',
        variableName: 'youth_photo',
        shownText: 'Youth Photo',
        fieldType: 'image',
        inputLength: null,
        initialLines: null,
        extractionRegex: null,
      },
      {
        seedKey: 'default.youth_name',
        variableName: 'youth_name',
        shownText: 'Youth Name',
        fieldType: 'text',
        inputLength: 100,
        initialLines: null,
        extractionRegex: '(?i)^(?:Youth(?:\\s+of\\s+the\\s+Week)?|Pemuda)\\s*[:\\-]\\s*(?<value>.*)$',
      },
      {
        seedKey: 'default.youth_request',
        variableName: 'youth_request',
        shownText: 'Youth Prayer Request',
        fieldType: 'text_area',
        inputLength: null,
        initialLines: 5,
        extractionRegex: null,
      },
    ];

    const insertField = database.prepare(`
      INSERT OR IGNORE INTO predefined_fields (
        id, variable_name, shown_text, field_type, input_length, initial_lines, extraction_regex, seed_key, is_system, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `);

    for (const f of fields) {
      const fieldId = 'field-' + f.variableName.replace(/_/g, '-');
      insertField.run(
        fieldId,
        f.variableName,
        f.shownText,
        f.fieldType,
        f.inputLength,
        f.initialLines,
        f.extractionRegex,
        f.seedKey
      );
    }

    const groupings = [
      {
        id: 'grouping-song-set',
        label: 'Song Set',
        description: 'Dynamic congregation song sets and hymns',
        sortOrder: 1,
        slots: [] as Array<{ id: string; sortOrder: number; widgetKind: string; refKey: string }>,
      },
      {
        id: 'grouping-bible-talk',
        label: 'Bible Talk',
        description: 'Scripture reading and thematic memory verse',
        sortOrder: 2,
        slots: [
          { id: 'slot-bible-talk-1', sortOrder: 1, widgetKind: 'predefined_field', refKey: 'scripture_reference' },
          { id: 'slot-bible-talk-2', sortOrder: 2, widgetKind: 'predefined_field', refKey: 'scripture_text' },
        ],
      },
      {
        id: 'grouping-divine-worship',
        label: 'Divine Worship',
        description: 'Liturgical music and special ministry items',
        sortOrder: 3,
        slots: [
          { id: 'slot-divine-worship-1', sortOrder: 1, widgetKind: 'predefined_field', refKey: 'special_song' },
        ],
      },
      {
        id: 'grouping-sermon',
        label: 'Sermon',
        description: 'Spoken ministry, title, speaker, and closing prayer',
        sortOrder: 4,
        slots: [
          { id: 'slot-sermon-1', sortOrder: 1, widgetKind: 'predefined_field', refKey: 'sermon_speaker_name' },
          { id: 'slot-sermon-2', sortOrder: 2, widgetKind: 'predefined_field', refKey: 'sermon_title' },
          { id: 'slot-sermon-3', sortOrder: 3, widgetKind: 'predefined_field', refKey: 'closing_prayer_person' },
          { id: 'slot-sermon-4', sortOrder: 4, widgetKind: 'predefined_field', refKey: 'sermon_poster' },
        ],
      },
      {
        id: 'grouping-announcement-posters',
        label: 'Weekly Announcement Posters',
        description: 'Weekly slide announcement poster slots',
        sortOrder: 5,
        slots: [
          { id: 'slot-ann-1', sortOrder: 1, widgetKind: 'announcement_slot', refKey: '1' },
          { id: 'slot-ann-2', sortOrder: 2, widgetKind: 'announcement_slot', refKey: '2' },
          { id: 'slot-ann-3', sortOrder: 3, widgetKind: 'announcement_slot', refKey: '3' },
          { id: 'slot-ann-4', sortOrder: 4, widgetKind: 'announcement_slot', refKey: '4' },
        ],
      },
      {
        id: 'grouping-family-of-the-week',
        label: 'Family of the Week',
        description: 'Weekly highlighted family photo and prayer request',
        sortOrder: 6,
        slots: [
          { id: 'slot-family-1', sortOrder: 1, widgetKind: 'predefined_field', refKey: 'family_photo' },
          { id: 'slot-family-2', sortOrder: 2, widgetKind: 'predefined_field', refKey: 'family_name' },
          { id: 'slot-family-3', sortOrder: 3, widgetKind: 'predefined_field', refKey: 'family_request' },
        ],
      },
      {
        id: 'grouping-youth-of-the-week',
        label: 'Youth of the Week',
        description: 'Weekly highlighted youth photo and prayer request',
        sortOrder: 7,
        slots: [
          { id: 'slot-youth-1', sortOrder: 1, widgetKind: 'predefined_field', refKey: 'youth_photo' },
          { id: 'slot-youth-2', sortOrder: 2, widgetKind: 'predefined_field', refKey: 'youth_name' },
          { id: 'slot-youth-3', sortOrder: 3, widgetKind: 'predefined_field', refKey: 'youth_request' },
        ],
      },
    ];

    // SPEC-54: Idempotent cleanup of obsolete shipped default song set slots
    database.prepare(`
      DELETE FROM form_group_slots
      WHERE layout_id = 'default-layout'
        AND grouping_id = 'grouping-song-set'
        AND id IN ('slot-song-set-1', 'slot-song-set-2', 'slot-song-set-3', 'slot-song-set-4')
        AND ref_key IN ('ds_opening_song', 'praise_song_1', 'praise_song_2', 'ds_closing_song')
    `).run();

    const existingGroupCount = (database.prepare(`
      SELECT COUNT(*) as count FROM form_groupings WHERE layout_id = 'default-layout'
    `).get() as { count?: number })?.count ?? 0;
    if (existingGroupCount > 0) {
      return;
    }

    const insertGrouping = database.prepare(`
      INSERT OR IGNORE INTO form_groupings (id, layout_id, label, description, sort_order)
      VALUES (?, 'default-layout', ?, ?, ?)
    `);

    const insertSlot = database.prepare(`
      INSERT OR IGNORE INTO form_group_slots (id, layout_id, grouping_id, sort_order, widget_kind, ref_key)
      VALUES (?, 'default-layout', ?, ?, ?, ?)
    `);

    for (const g of groupings) {
      insertGrouping.run(g.id, g.label, g.description, g.sortOrder);
      for (const s of g.slots) {
        insertSlot.run(s.id, g.id, s.sortOrder, s.widgetKind, s.refKey);
      }
    }
    console.info(`[form-layout] seeded default-layout with groupings and predefined fields`);
  }
}

/** Story 25.2: stamp the write-path grain change without rewriting rows. */
function migrateDataVersionToCurrent(database: Database.Database) {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY) as { value: string } | undefined;
  if (!row) return;
  const version = Number(row.value);
  if (!Number.isFinite(version) || version >= CURRENT_DATA_VERSION) return;
  database
    .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
    .run(DATA_VERSION_KEY, String(CURRENT_DATA_VERSION));
}

/** When accounts is empty and bootstrap env is set, seed the first admin. */
function bootstrapAdminIfEmpty(database: Database.Database) {
  const row = database.prepare(`SELECT COUNT(*) AS n FROM accounts`).get() as {
    n: number;
  };
  if (Number(row.n) > 0) return;

  const user = process.env.AUTH_BOOTSTRAP_USER?.trim().toLowerCase();
  const password = process.env.AUTH_BOOTSTRAP_PASSWORD;
  if (!user || !password) return;

  if (user.length > 64 || !/^[a-z0-9._-]+$/.test(user)) {
    throw new Error(
      'AUTH_BOOTSTRAP_USER must be 1–64 chars: letters, numbers, . _ -'
    );
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error(
      'AUTH_BOOTSTRAP_PASSWORD must be 8–128 characters'
    );
  }

  try {
    database
      .prepare(
        `INSERT INTO accounts (username, password_hash, role)
         VALUES (?, ?, 'admin')`
      )
      .run(user, hashPassword(password));
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) return;
    throw e;
  }
}
