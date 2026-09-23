import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { ArtifactTemplate } from './types';
import { validateArtifactTemplateList } from './validate';
import {
  assertContiguousPositions,
  insertArtifactTemplateIfMissing,
  RegistryNotFoundError,
} from './store';

/** AD-17: the marker that gates the one-time bootstrap. */
export const ARTIFACT_REGISTRY_BOOTSTRAP_KEY = 'artifact_registry_bootstrapped';

/** AD-21: the one monotonic data-version counter, stamped with the bootstrap. */
export const DATA_VERSION_KEY = 'data_version';

/** W1 ships the AD-16 snapshot table as data version 2; Story 25.2 is 3.
 * DEC-004 lands the song-set physical-shape migration (3→4) and the
 * predefined-field vocabulary migration (4→5); DEC-005 lands the song-book
 * bootstrap-once migration (5→6). The bootstrap stamps the shipped seed at
 * `BOOTSTRAP_DATA_VERSION`, then the migrations bump the counter to
 * `CURRENT_DATA_VERSION` in the same boot.
 */
export const BOOTSTRAP_DATA_VERSION = 3;

/** The full target version after every migration has landed. */
export const CURRENT_DATA_VERSION = 12;

const SEED_PATH = path.join(process.cwd(), 'data', 'default-registry.json');

/**
 * Optional private override, git-ignored in full.
 *
 * The committed seed is a worked example with placeholder contact and payment
 * details, because this repository is public and a congregation's real details
 * do not belong in it. A deployment drops its own registry here and the app
 * seeds from that instead — same shape, same validation, never committed.
 *
 * See `docs/PRIVATE-DATA.md`.
 */
const LOCAL_SEED_PATH = path.join(
  process.cwd(),
  'data',
  'local',
  'default-registry.json'
);

/**
 * The private override when present, otherwise the committed seed.
 *
 * Automated tests and fidelity smokes set `WPW_USE_SHIPPED_REGISTRY=1` so a
 * developer's gitignored `data/local/` override cannot change expected PPTX
 * copy or fail the public-repo placeholder assertions.
 *
 * Story 20.2: if your local override still carries retired base types, delete
 * it or re-author it onto `general` / `song-set` / `announcement` — the
 * startup reset will wipe a database seeded from stale kinds, but it does not
 * rewrite this file.
 */
export function resolveSeedPath(): string {
  if (process.env.WPW_USE_SHIPPED_REGISTRY === '1') return SEED_PATH;
  return fs.existsSync(LOCAL_SEED_PATH) ? LOCAL_SEED_PATH : SEED_PATH;
}

/**
 * The shipped seed is a build artifact: it cannot change while the process is
 * running, yet it used to be re-read and fully re-validated on every registry
 * snapshot — i.e. on every plan build, which is once per debounced keystroke in
 * the Live Preview. Parse and validate it once per process instead.
 *
 * The cached templates are shared by every caller and must be treated as
 * read-only; nothing in the registry mutates them in place (the store and the
 * snapshot both copy before writing).
 */
let cachedSeedTemplates: ArtifactTemplate[] | null = null;

export function loadSeedTemplates(): ArtifactTemplate[] {
  if (cachedSeedTemplates) return cachedSeedTemplates;

  const seedPath = resolveSeedPath();
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Missing registry seed at ${seedPath}`);
  }
  if (seedPath === LOCAL_SEED_PATH) {
    console.info(
      '[registry] seeding from the private override at data/local/default-registry.json'
    );
  }
  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as unknown;
  // Only cache after a clean validation, so a bad seed keeps throwing.
  cachedSeedTemplates = validateArtifactTemplateList(raw);
  return cachedSeedTemplates;
}

export type BootstrapReport = { inserted: string[] } | null;

/**
 * AD-17: seed the registry from zero, once. Gated on
 * {@link ARTIFACT_REGISTRY_BOOTSTRAP_KEY} rather than on the table being
 * empty, so a row an administrator deletes afterwards stays deleted through a
 * restart (AC-7) — the seeder never re-inserts a gap, and no later boot
 * re-applies a shipped correction over an edit. Reset-from-seed
 * (`resetArtifactTemplate`) remains the explicit per-template escape hatch.
 *
 * The bootstrap marker and the AD-21 data-version counter are stamped in the
 * *same* transaction as the inserts (AC-9): a database that ran this once
 * always reports both together, never one without the other.
 */
export function bootstrapArtifactRegistry(
  database: Database.Database
): BootstrapReport {
  const already = database
    .prepare(`SELECT 1 FROM settings WHERE key = ?`)
    .get(ARTIFACT_REGISTRY_BOOTSTRAP_KEY);
  if (already) return null;

  const templates = loadSeedTemplates();
  const tx = database.transaction((rows: ArtifactTemplate[]): string[] => {
    const inserted: string[] = [];
    rows.forEach((template, position) => {
      if (insertArtifactTemplateIfMissing(database, template, position)) {
        inserted.push(template.id);
      }
    });
    assertContiguousPositions(database);
    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(ARTIFACT_REGISTRY_BOOTSTRAP_KEY, '1');
    database
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(DATA_VERSION_KEY, String(BOOTSTRAP_DATA_VERSION));
    return inserted;
  });
  // BEGIN IMMEDIATE, not the default deferred BEGIN: this pass reads every row
  // and then writes, so a deferred transaction takes its read snapshot first and
  // upgrading to a write lock afterwards fails with SQLITE_BUSY_SNAPSHOT, which
  // `busy_timeout` does not retry. Several maintenance scripts open the same
  // file directly (`scripts/auth-unlock.mjs`, `auth-set-password.mjs`,
  // `import-kjv.mjs`), so one of them running while the server boots would
  // otherwise crash startup. Taking the write lock up front closes that window.
  const inserted = tx.immediate(templates);
  console.info(
    `[registry] bootstrap: inserted ${inserted.length} template(s), stamped data version ${CURRENT_DATA_VERSION}`
  );
  return { inserted };
}

export function getSeedTemplateById(id: string) {
  const templates = loadSeedTemplates();
  const found = templates.find((t) => t.id === id);
  if (!found) {
    throw new RegistryNotFoundError(id);
  }
  return found;
}
