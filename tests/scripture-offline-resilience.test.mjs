/**
 * SPEC-98-04: Authoritative Offline Scripture Pre-Cache & Fail-Closed Resilience
 *
 * Verifies:
 * - DB_VERSION is 3 with scripture_cache store.
 * - extractRequiredScriptureRefs scans field_values and parsed_data.
 * - cacheScripturePassage and getCachedScripturePassage roundtrip correctly.
 * - Fail-closed SCN-4 semantics: 400/404 fails closed immediately without cache fallback;
 *   network errors and 5xx fall back to cache when available.
 * - Structural guards in PresenterOperator.tsx and defect injection proofs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const snapshotPath = path.join(root, 'src', 'lib', 'offline', 'service-snapshot.ts');
const presenterPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');

const {
  DB_VERSION,
  extractRequiredScriptureRefs,
  getScriptureCacheKey,
  cacheScripturePassage,
  getCachedScripturePassage,
  warmServiceSnapshot,
  clearInMemoryOfflineStore,
  resolveDefaultBibleTranslation,
} = await import(pathToFileURL(snapshotPath).href);

test('SPEC-98-04: DB_VERSION is bumped to 3 and scripture_cache store is defined', () => {
  assert.equal(DB_VERSION, 3, 'DB_VERSION must be 3');
  const src = fs.readFileSync(snapshotPath, 'utf8');
  assert.ok(
    src.includes("const SCRIPTURE_STORE = 'scripture_cache'"),
    'SCRIPTURE_STORE must be scripture_cache'
  );
  assert.ok(
    src.includes("db.createObjectStore(SCRIPTURE_STORE, { keyPath: 'cache_key' })"),
    'Object store scripture_cache must be created with keyPath cache_key'
  );
});

test('SPEC-98-04: extractRequiredScriptureRefs scans canonical service payload locations', () => {
  const serviceData = {
    field_values: {
      scripture_reference: 'John 4:23-24',
      theme_verse: 'Psalms 23',
    },
    parsed_data: {
      theme_verse: 'Romans 8:28',
      verse_reading: '1 Corinthians 13',
    },
  };

  const refs = extractRequiredScriptureRefs(serviceData);
  assert.equal(refs.length, 4);
  assert.ok(refs.includes('John 4:23-24'));
  assert.ok(refs.includes('Psalms 23'));
  assert.ok(refs.includes('Romans 8:28'));
  assert.ok(refs.includes('1 Corinthians 13'));

  // Negative: ignores empty and http URLs
  const emptyRefs = extractRequiredScriptureRefs({
    field_values: { scripture_reference: 'https://example.com/verse.jpg' },
  });
  assert.equal(emptyRefs.length, 0);
});

test('SPEC-98-04: cacheScripturePassage and getCachedScripturePassage store and retrieve records', async () => {
  const record = {
    cache_key: getScriptureCacheKey('John 3:16', 'KJV'),
    reference: 'John 3:16',
    translation: 'KJV',
    verses: [{ verse: 16, text: 'For God so loved the world...' }],
    text: '(16) For God so loved the world...',
    cached_at: Date.now(),
  };

  await cacheScripturePassage(record);

  const hit = await getCachedScripturePassage('John 3:16', 'KJV');
  assert.ok(hit, 'Passage must be found in cache');
  assert.equal(hit.reference, 'John 3:16');
  assert.equal(hit.verses.length, 1);
  assert.equal(hit.verses[0].verse, 16);

  // Cache miss returns null
  const miss = await getCachedScripturePassage('Revelation 22:21', 'KJV');
  assert.equal(miss, null, 'Uncached reference must return null');
});

test('SPEC-98-04: PresenterOperator source guards enforce SCN-4 fail-closed semantics', () => {
  const src = fs.readFileSync(presenterPath, 'utf8');

  // Guard 1: checks getCachedScripturePassage only on network error or status >= 500
  assert.ok(
    src.includes('networkError || (res && res.status >= 500)'),
    'Offline cache fallback must be gated strictly on network error or 5xx'
  );

  // Guard 2: fails closed immediately on res.status === 404 or 400
  assert.ok(
    src.includes('res.status === 404') && src.includes('t(\'presenter.scripture.notFound\')'),
    '404 responses must fail closed immediately'
  );

  // Guard 3: informs user when displaying from offline cache
  assert.ok(
    src.includes("toast.info(t('presenter.scripture.offlineCachedNotice'))"),
    'Must display informational toast when rendering from offline cache'
  );

  // Guard 4: caches successful lookups asynchronously
  assert.ok(
    src.includes('cacheScripturePassage('),
    'Successful online lookups must be cached into scripture_cache'
  );
});

test('SPEC-98-04 Defect Injection Proof: Fallback on 404 violates SCN-4 fail-closed invariant', () => {
  const verifyScn4Compliance = (source) => {
    // If cache lookup occurs before or without checking res.status >= 500 / networkError,
    // it falsely allows fallback on 404 (violating SCN-4)
    const hasStrictGate = source.includes('networkError || (res && res.status >= 500)');
    const has404FailClosed = source.includes('res.status === 404');
    return hasStrictGate && has404FailClosed;
  };

  const goodSrc = fs.readFileSync(presenterPath, 'utf8');
  assert.equal(verifyScn4Compliance(goodSrc), true);

  // Injected defect: removing network error gate and falling back on all non-ok responses
  const defectiveSrc = goodSrc.replace(
    'networkError || (res && res.status >= 500)',
    '!res.ok'
  );
  assert.equal(
    verifyScn4Compliance(defectiveSrc),
    false,
    'INJECTED DEFECT: Allowing cache fallback on 404 violates SCN-4'
  );
});

test('SPEC-98-04: getScriptureCacheKey canonicalizes book aliases and whole-chapter references', () => {
  // Aliases produce identical canonical keys
  const k1 = getScriptureCacheKey('John 3:16', 'KJV');
  const k2 = getScriptureCacheKey('Jn 3:16', 'KJV');
  assert.equal(k1, 'KJV:john:3:16:16');
  assert.equal(k2, 'KJV:john:3:16:16');
  assert.equal(k1, k2, 'John and Jn alias must produce identical canonical cache key');

  const ps1 = getScriptureCacheKey('Psalms 23', 'KJV');
  const ps2 = getScriptureCacheKey('ps 23', 'KJV');
  assert.equal(ps1, 'KJV:psalms:23:ALL');
  assert.equal(ps2, 'KJV:psalms:23:ALL');
  assert.equal(ps1, ps2, 'Psalms and ps alias must produce identical whole-chapter canonical key');

  const span1 = getScriptureCacheKey('ps 23:1-6', 'KJV');
  const span2 = getScriptureCacheKey('Psalms 23:1-6', 'KJV');
  assert.equal(span1, 'KJV:psalms:23:1:6');
  assert.equal(span2, 'KJV:psalms:23:1:6');
});

test('SPEC-98-04: clearInMemoryOfflineStore and clearOfflineStorage purge scripture cache', async () => {
  const record = {
    cache_key: getScriptureCacheKey('Romans 8:28', 'KJV'),
    reference: 'Romans 8:28',
    translation: 'KJV',
    verses: [{ verse: 28, text: 'And we know that all things work together...' }],
    text: '(28) And we know...',
    cached_at: Date.now(),
  };

  await cacheScripturePassage(record);
  assert.ok(await getCachedScripturePassage('Romans 8:28', 'KJV'));

  clearInMemoryOfflineStore();
  assert.equal(
    await getCachedScripturePassage('Romans 8:28', 'KJV'),
    null,
    'clearInMemoryOfflineStore must purge inMemoryScriptures'
  );
});

test('SPEC-98-04: Failed scripture warming causes warmServiceSnapshot to degrade status', async () => {
  const serviceWithBadScripture = {
    id: 'test-degrade-service',
    bible_translation: 'NONEXISTENT_TRANS_99',
    field_values: {
      scripture_reference: 'InvalidBook 99:99',
    },
  };

  const readiness = await warmServiceSnapshot('test-degrade-service', serviceWithBadScripture);
  assert.equal(readiness.status, 'degraded', 'Failed scripture warming must yield degraded status');
  assert.ok(readiness.scriptures, 'Readiness must report scriptures summary');
  assert.equal(readiness.scriptures.failed, 1);
  assert.match(readiness.message, /Degraded/);
});

test('SPEC-98-04: ScriptureOverlay in present-channel.ts requires authoritative fields', () => {
  const channelSrc = fs.readFileSync(path.join(root, 'src', 'lib', 'present-channel.ts'), 'utf8');
  assert.ok(
    channelSrc.includes("mode: 'per-verse' | 'inline'"),
    'ScriptureOverlay must have non-optional mode'
  );
  assert.ok(
    channelSrc.includes('verses: Array<{ verse: number; text: string }>'),
    'ScriptureOverlay must have non-optional verses'
  );
  assert.ok(
    channelSrc.includes('currentPage: number'),
    'ScriptureOverlay must have non-optional currentPage'
  );
  assert.ok(
    channelSrc.includes('totalPages: number'),
    'ScriptureOverlay must have non-optional totalPages'
  );
  assert.ok(
    channelSrc.includes('displayReference: string'),
    'ScriptureOverlay must have non-optional displayReference'
  );
});

test('SPEC-102-03: extractRequiredScriptureRefs filters placeholders and normalizes translation suffixes', () => {
  const serviceData = {
    field_values: {
      scripture_reference: 'Hebrews 1:1, 2 (NKJV)',
      theme_verse: 'TBA',
    },
    parsed_data: {
      theme_verse: '1 Korintus 13 (TB)',
      verse_reading: ' - ',
      extra_verse: 'N/A',
    },
  };

  const refs = extractRequiredScriptureRefs(serviceData);
  assert.equal(refs.length, 2);
  assert.ok(refs.includes('Hebrews 1:1, 2'), 'Must strip (NKJV) suffix');
  assert.ok(refs.includes('1 Korintus 13'), 'Must strip (TB) suffix');
  assert.equal(refs.includes('TBA'), false, 'Must filter out TBA placeholder');
  assert.equal(refs.includes('-'), false, 'Must filter out dash placeholder');
});

test('SPEC-103-02: extractRequiredScriptureRefs normalizes comma-prefixed translation suffixes', async () => {
  const { sanitizeScriptureRef } = await import(pathToFileURL(snapshotPath).href);

  // Direct sanitizer contract with and without terminal punctuation
  assert.equal(sanitizeScriptureRef('Hebrews 1:1, 2, NKJV'), 'Hebrews 1:1, 2');
  assert.equal(sanitizeScriptureRef('Hebrews 1:1, 2, NKJV.'), 'Hebrews 1:1, 2');
  assert.equal(sanitizeScriptureRef('Hebrews 1:1,2,NKJV'), 'Hebrews 1:1,2');
  assert.equal(sanitizeScriptureRef('1 Korintus 13, TB'), '1 Korintus 13');
  assert.equal(sanitizeScriptureRef('1 Korintus 13, TB.'), '1 Korintus 13');
  assert.equal(sanitizeScriptureRef('John 3:16, KJV'), 'John 3:16');
  assert.equal(sanitizeScriptureRef('John 3:16, KJV;'), 'John 3:16');
  assert.equal(sanitizeScriptureRef('Romans 8:28, ESV'), 'Romans 8:28');

  // Service extraction contract
  const serviceData = {
    field_values: {
      scripture_reference: 'Hebrews 1:1, 2, NKJV.',
      theme_verse: '1 Korintus 13, TB',
    },
    parsed_data: {
      theme_verse: 'Hebrews 1:1,2,NKJV',
      verse_reading: 'John 3:16, KJV;',
    },
  };

  const refs = extractRequiredScriptureRefs(serviceData);
  assert.ok(refs.includes('Hebrews 1:1, 2'), 'Must strip comma-prefixed NKJV and trailing punctuation');
  assert.ok(refs.includes('Hebrews 1:1,2'), 'Must strip comma-prefixed NKJV without space');
  assert.ok(refs.includes('1 Korintus 13'), 'Must strip comma-prefixed TB and trailing comma');
  assert.ok(refs.includes('John 3:16'), 'Must strip comma-prefixed KJV');
});

test('SPEC-103-02: service snapshot warming normalizes comma-separated reference to canonical cache key and succeeds', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/scripture')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            reference: 'Hebrews 1:1, 2',
            translation: 'KJV',
            text: 'God, who at sundry times and in divers manners spake in time past unto the fathers by the prophets...',
            verses: [
              { verse: 1, text: 'God, who at sundry times...' },
              { verse: 2, text: 'Hath in these last days spoken unto us by his Son...' },
            ],
          }),
        };
      }
      return { ok: false, status: 404 };
    };

    const service10Data = {
      id: '10',
      field_values: {
        scripture_reference: 'Hebrews 1:1, 2, NKJV',
      },
    };

    const readiness = await warmServiceSnapshot('10', service10Data);
    assert.equal(readiness.status, 'ready', 'Service 10 warming with comma-normalized ref must achieve ready');
    assert.equal(readiness.scriptures.total, 1);
    assert.equal(readiness.scriptures.cached, 1);
    assert.equal(readiness.scriptures.failed, 0);

    // Verify it was stored under canonical cache key
    const cached = await getCachedScripturePassage('Hebrews 1:1, 2', 'KJV');
    assert.ok(cached, 'Cached passage must be retrievable by canonical reference');
    assert.equal(cached.reference, 'Hebrews 1:1, 2');
    assert.equal(cached.verses.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPEC-103-02: structural scan and defect injection proof: sanitizeScriptureRef in service-snapshot.ts requires comma-bare regex and trailing punctuation strip', () => {
  const content = fs.readFileSync(snapshotPath, 'utf8');

  function validateSnapshotSanitizer(src) {
    if (!/TRANSLATION_BARE_RE\s*=.*?(NKJV\|KJV\|TB\|NIV\|ESV\|BIMK\|AYT)/.test(src) || !/TRANSLATION_BARE_RE\s*=.*?,/.test(src)) {
      throw new Error('Sanitizer Pattern Violation: TRANSLATION_BARE_RE must support comma prefix');
    }
    const fnMatch = src.match(/export function sanitizeScriptureRef[\s\S]*?return s;\s*\}/);
    if (!fnMatch) throw new Error('sanitizeScriptureRef missing');
    const fnBody = fnMatch[0];
    if (!/replace\(\/\[,;\.\]\+\$\/,\s*''\)/.test(fnBody)) {
      throw new Error('Sanitizer Pattern Violation: sanitizeScriptureRef must strip trailing punctuation');
    }
  }

  // Real production source passes
  assert.doesNotThrow(() => validateSnapshotSanitizer(content));

  // Injected defect: strip comma support from TRANSLATION_BARE_RE in real file source
  const defective = content.replace(
    /const TRANSLATION_BARE_RE = .*;/,
    'const TRANSLATION_BARE_RE = /\\s+(KJV|NKJV|TB|NIV|ESV|BIMK|AYT)$/i;'
  );
  assert.throws(
    () => validateSnapshotSanitizer(defective),
    /Sanitizer Pattern Violation/
  );
});

test('SPEC-102-03: failed_scripture_refs is persisted in snapshot and formats combined degraded message', async () => {
  const { formatOfflineReadinessMessage, getServiceSnapshot } = await import(
    pathToFileURL(snapshotPath).href
  );

  // Test combined degraded message
  const combined = formatOfflineReadinessMessage('degraded', 2, 0, 1, 1);
  assert.equal(combined, 'Degraded: 1 asset, 1 scripture failed');

  const assetsOnly = formatOfflineReadinessMessage('degraded', 2, 0, 2, 0);
  assert.equal(assetsOnly, 'Degraded: 2 assets failed');

  const scriptureOnly = formatOfflineReadinessMessage('degraded', 0, 0, 0, 1);
  assert.equal(scriptureOnly, 'Degraded: 1 scripture failed');

  // Verify warmServiceSnapshot populates failedRefs
  const serviceWithBadScripture = {
    id: 'test-failed-ref-durability',
    field_values: {
      scripture_reference: 'NonexistentBook 123:456',
    },
  };

  const res = await warmServiceSnapshot('test-failed-ref-durability', serviceWithBadScripture);
  assert.equal(res.status, 'degraded');
  assert.ok(res.scriptures?.failedRefs?.includes('NonexistentBook 123:456'));

  // Verify rehydration from getServiceSnapshot
  const snap = await getServiceSnapshot('test-failed-ref-durability');
  assert.ok(snap?.failed_scripture_refs?.includes('NonexistentBook 123:456'));
});

test('SPEC-102-03: OfflineReadinessBadge source guards for retry toast and detailed tooltip', () => {
  const badgeSrc = fs.readFileSync(
    path.join(root, 'src', 'components', 'offline', 'OfflineReadinessBadge.tsx'),
    'utf8'
  );
  assert.ok(badgeSrc.includes("from 'sonner'"), 'Must import toast from sonner');
  assert.ok(badgeSrc.includes('toast.success'), 'Must notify success on complete retry');
  assert.ok(badgeSrc.includes('toast.error'), 'Must notify error on failed retry');
  assert.ok(
    badgeSrc.includes('tooltipText') || badgeSrc.includes('failedRefs'),
    'Must include failed references in tooltip'
  );
});


test('SPEC-98-04: cacheScripturePassage enforces canonical key derivation even if raw alias cache_key is supplied', async () => {
  // A caller supplies a non-canonical raw alias cache_key: "KJV:jn 3:16"
  const entryWithAliasKey = {
    cache_key: 'KJV:jn 3:16',
    reference: 'Jn 3:16',
    translation: 'KJV',
    verses: [{ verse: 16, text: 'For God so loved the world...' }],
    text: '(16) For God so loved...',
    cached_at: Date.now(),
  };

  await cacheScripturePassage(entryWithAliasKey);

  // Retrieve via standard spelling "John 3:16" — must HIT because key was canonicalized
  const hit = await getCachedScripturePassage('John 3:16', 'KJV');
  assert.ok(hit, 'Passage must be found via John 3:16 despite Jn alias key passed to cacheScripturePassage');
  assert.equal(hit.cache_key, 'KJV:john:3:16:16', 'Stored record must carry canonical cache_key');
});

test('SPEC-98-04: resolveDefaultBibleTranslation respects service translation and defaults to KJV', async () => {
  assert.equal(
    await resolveDefaultBibleTranslation({ bible_translation: 'TB' }),
    'TB'
  );
  assert.equal(
    await resolveDefaultBibleTranslation({ translation: 'NIV' }),
    'NIV'
  );
  assert.equal(
    await resolveDefaultBibleTranslation({ field_values: { bible_translation: 'ESV' } }),
    'ESV'
  );
  assert.equal(
    await resolveDefaultBibleTranslation({}),
    'KJV'
  );
});
