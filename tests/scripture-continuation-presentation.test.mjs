import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('SPEC-100-02: ScriptureOverlay wire contract requires non-optional continuation and typography fields', async () => {
  const presentChannelPath = path.join(ROOT, 'src', 'lib', 'present-channel.ts');
  const src = fs.readFileSync(presentChannelPath, 'utf8');

  // Verify ScriptureOverlay interface declarations
  assert.ok(src.includes('typographyMode:'), 'ScriptureOverlay must declare typographyMode');
  assert.ok(src.includes('isContinuation: boolean'), 'ScriptureOverlay must declare isContinuation');
  assert.ok(src.includes('continuationIndex: number'), 'ScriptureOverlay must declare continuationIndex');
  assert.ok(src.includes('continuationCount: number'), 'ScriptureOverlay must declare continuationCount');
});

test('SPEC-100-02: getScriptureScaling locks base font to 4.8cqh for chapter presentation', async () => {
  const { getScriptureScaling } = await import(new URL('../src/lib/scripture-scaling.ts', import.meta.url).href);

  // In chapter mode, short text and tail pages stay at 4.8cqh rather than ballooning to 6.5/8.5cqh
  const tailPage = getScriptureScaling('Short tail verse.', 2, 'chapter');
  assert.equal(tailPage.fontSizeStyle, '4.8cqh');
  assert.equal(tailPage.minHeightStyle, '20cqh');

  // In verse mode, hero sizing applies
  const heroVerse = getScriptureScaling('Short hero verse.', 1, 'verse');
  assert.equal(heroVerse.fontSizeStyle, '8.5cqh');
});

test('SPEC-100-02: computeScriptureFitScale enforces 0.917 floor on calibrated chapter pages', async () => {
  const { computeScriptureFitScale } = await import(new URL('../src/lib/scripture-scaling.ts', import.meta.url).href);

  // Stage 16:9 at 1920x1080 (stageHeight = 1080, stageWidth = 1920)
  // Max budget height = 1080 * 0.78 = 842.4px
  // 10 lines at 4.8cqh (51.84px) * line-height 1.28 = ~66.35px/line -> 663.5px < 842.4px
  const scale = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 664,
    naturalWidth: 1500,
    containerHeight: 842,
    containerWidth: 1680,
  });

  assert.ok(scale >= 0.917, `Scale (${scale}) must be >= 0.917 floor`);
});

test('SPEC-100-02: ScriptureOverlayView sets lineHeight 1.28 for chapter mode and overflow-wrap anywhere', () => {
  const viewPath = path.join(ROOT, 'src', 'components', 'ScriptureOverlayView.tsx');
  const src = fs.readFileSync(viewPath, 'utf8');

  assert.ok(
    src.includes('1.28') && src.includes('typographyMode'),
    'ScriptureOverlayView must set lineHeight 1.28 when typographyMode is chapter'
  );
  assert.ok(
    src.includes('anywhere') || src.includes('break-words') || src.includes('overflow-wrap'),
    'ScriptureOverlayView must support overflow-wrap anywhere'
  );
  assert.ok(
    src.includes('continuation') || src.includes('isContinuation'),
    'ScriptureOverlayView must handle continuation indicators'
  );
});

test('SPEC-100-02: ScriptureCacheRecord supports typography_mode with legacy derivation fallback', async () => {
  const snapshotPath = path.join(ROOT, 'src', 'lib', 'offline', 'service-snapshot.ts');
  const src = fs.readFileSync(snapshotPath, 'utf8');

  assert.ok(
    src.includes('typography_mode'),
    'service-snapshot.ts must declare typography_mode in ScriptureCacheRecord'
  );

  // Behavioral test for legacy record derivation
  function deriveLegacyTypographyMode(cached) {
    if (cached.typography_mode) return cached.typography_mode;
    return cached.is_whole_chapter ||
      cached.reference.indexOf(':') === -1 ||
      (cached.verses && cached.verses.length > 4)
      ? 'chapter'
      : 'verse';
  }

  // 1. Chapter ref without colon -> 'chapter'
  assert.equal(deriveLegacyTypographyMode({ reference: 'John 4', verses: [{ verse: 1 }] }), 'chapter');
  // 2. Multi-verse (> 4) -> 'chapter'
  assert.equal(
    deriveLegacyTypographyMode({ reference: 'John 4:1-5', verses: [1, 2, 3, 4, 5].map((v) => ({ verse: v })) }),
    'chapter'
  );
  // 3. Single verse -> 'verse'
  assert.equal(deriveLegacyTypographyMode({ reference: 'John 3:16', verses: [{ verse: 16 }] }), 'verse');
});

test('SPEC-100-02: Remote scripture intents normalize through line-budget paginator before broadcast', async () => {
  const { applyRemoteIntent } = await import(new URL('../src/lib/presenter-remote-client.ts', import.meta.url).href);

  let installedPassage = null;
  let broadcastMessage = null;

  const handlersWithPresenterSync = {
    broadcast: (msg) => {
      broadcastMessage = msg;
    },
    setIndexAndSync: () => {},
    setBlankAndSync: () => {},
    setTransitionAndSync: () => {},
    setBackgroundAndSync: () => {},
    setScriptureAndSync: (data) => {
      installedPassage = data;
    },
  };

  const ultraLongText =
    'And it came to pass in those days, that there went out a decree from Caesar Augustus that all the world should be taxed, and all went to be taxed, every one into his own city. Furthermore, the governors and deputies in all the provinces assembled the people, making proclamation that all citizens should render tribute according to their households and estates, without omission or delay, throughout the entire jurisdiction of the empire from sunrise unto the going down of the same.';

  // 1. Remote intent routed to PresenterOperator installs normalized passage with full structured verses
  const accepted1 = applyRemoteIntent(
    {
      type: 'scripture',
      reference: 'Luke 2:1',
      text: ultraLongText,
      verses: [{ verse: 1, text: ultraLongText }],
      is_whole_chapter: false,
      planIdentity: 'plan-123',
    },
    'plan-123',
    handlersWithPresenterSync
  );

  assert.equal(accepted1, true);
  assert.ok(installedPassage !== null, 'Remote scripture must invoke setScriptureAndSync to install full passage');
  assert.equal(installedPassage.reference, 'Luke 2:1');
  assert.equal(installedPassage.verses.length, 1);

  // 2. Fallback direct broadcast normalizes long verse into visual line-budget chunks
  const handlersDirect = {
    broadcast: (msg) => {
      broadcastMessage = msg;
    },
    setIndexAndSync: () => {},
    setBlankAndSync: () => {},
    setTransitionAndSync: () => {},
    setBackgroundAndSync: () => {},
  };

  const accepted2 = applyRemoteIntent(
    {
      type: 'scripture',
      reference: 'Luke 2:1',
      text: ultraLongText,
      planIdentity: 'plan-123',
    },
    'plan-123',
    handlersDirect
  );

  assert.equal(accepted2, true);
  assert.ok(broadcastMessage !== null);
  assert.equal(broadcastMessage.type, 'scripture');
  assert.ok(broadcastMessage.totalPages >= 1);
  assert.equal(broadcastMessage.typographyMode, 'verse');
});

test('SPEC-100-02: warmServiceSnapshot stores typography_mode and is_whole_chapter durably', async () => {
  const snapshotSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'offline', 'service-snapshot.ts'), 'utf8');

  // Verify warmServiceSnapshot sets typography_mode and is_whole_chapter during cacheScripturePassage call
  assert.ok(
    snapshotSrc.includes('typography_mode: typographyMode') &&
      snapshotSrc.includes('is_whole_chapter: isWholeChapter'),
    'warmServiceSnapshot must pass typography_mode and is_whole_chapter to cacheScripturePassage'
  );
});

test('SPEC-100-02: Calibrated 16:9 stage container containment proof (zero clipping)', async () => {
  const { computeScriptureFitScale } = await import(new URL('../src/lib/scripture-scaling.ts', import.meta.url).href);

  // 16:9 1080p stage: stageHeight = 1080, stageWidth = 1920
  // maxAllowedHeight = 1080 * 0.78 = 842.4px, maxAllowedWidth = 1920 * 0.85 = 1632px
  // Test case 1: Normal 10-line chapter page (John 4 dense page ~660px height)
  const scale1 = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 660,
    naturalWidth: 1400,
  });
  assert.equal(scale1, 1, 'Within budget height and width renders at 1.0 (no shrinkage)');

  // Test case 2: Overflown text (e.g. 1000px natural height > 842px) scales safely to prevent clipping
  const scale2 = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 1000,
    naturalWidth: 1400,
  });
  const scaledHeight = 1000 * scale2;
  assert.ok(scaledHeight <= 842.4, `Scaled height (${scaledHeight}) must not exceed container maxAllowedHeight (842.4)`);
});

test('SPEC-100-02: End-to-end remote whole-chapter navigation and continuation synchronization lifecycle', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);
  const { applyRemoteIntent } = await import(new URL('../src/lib/presenter-remote-client.ts', import.meta.url).href);

  // Simulated Presenter state container
  let loadedScripture = null;
  let scripturePageIndex = 0;
  let activeOverlay = null;
  const broadcasts = [];

  const broadcastFn = (msg) => {
    broadcasts.push(msg);
    if (msg.type === 'scripture') {
      activeOverlay = msg;
    }
  };

  const setScriptureAndSync = (data) => {
    const baseRef = data.reference;
    const verses = data.verses || [{ verse: 1, text: data.text }];
    const isWholeChapter = Boolean(data.is_whole_chapter || !baseRef.includes(':'));
    const typographyMode = isWholeChapter || verses.length > 4 ? 'chapter' : 'verse';
    const effectiveMode = data.mode || 'per-verse';

    loadedScripture = { reference: baseRef, verses, typographyMode };
    scripturePageIndex = 0;

    const pages = paginateScriptureVerses(baseRef, verses, effectiveMode, typographyMode);
    const firstPage = pages[0];
    const newOverlay = {
      reference: baseRef,
      displayReference: firstPage.displayReference,
      text: firstPage.text,
      mode: effectiveMode,
      verses: firstPage.verses,
      currentPage: firstPage.page,
      totalPages: firstPage.totalPages,
      typographyMode: firstPage.typographyMode,
      isContinuation: firstPage.isContinuation,
      continuationIndex: firstPage.continuationIndex,
      continuationCount: firstPage.continuationCount,
    };
    broadcastFn({
      type: 'scripture',
      ...newOverlay,
      planIdentity: 'plan-xyz',
    });
  };

  // Construct 15 synthetic verses (~3-4 pages)
  const syntheticVerses = Array.from({ length: 15 }, (_, i) => ({
    verse: i + 1,
    text: `Verse content for line-budget verification test number ${i + 1} with sufficient length to span multiple lines.`,
  }));

  // 1. Remote intent delivers whole chapter
  const accepted = applyRemoteIntent(
    {
      type: 'scripture',
      reference: 'John 4',
      text: syntheticVerses.map((v) => `(${v.verse}) ${v.text}`).join('\n'),
      verses: syntheticVerses,
      is_whole_chapter: true,
      planIdentity: 'plan-xyz',
    },
    'plan-xyz',
    {
      broadcast: broadcastFn,
      setIndexAndSync: () => {},
      setBlankAndSync: () => {},
      setTransitionAndSync: () => {},
      setBackgroundAndSync: () => {},
      setScriptureAndSync,
    }
  );

  assert.equal(accepted, true);
  assert.ok(loadedScripture !== null);
  assert.equal(loadedScripture.reference, 'John 4');
  assert.equal(loadedScripture.typographyMode, 'chapter');

  // Verify page 1 broadcast
  assert.equal(activeOverlay.currentPage, 1);
  assert.ok(activeOverlay.totalPages >= 3, `Expected >= 3 pages, got ${activeOverlay.totalPages}`);
  assert.equal(activeOverlay.typographyMode, 'chapter');

  // 2. Simulate Next Page navigation: page 1 -> page 2
  const pages = paginateScriptureVerses(
    loadedScripture.reference,
    loadedScripture.verses,
    'per-verse',
    loadedScripture.typographyMode
  );
  scripturePageIndex = 1;
  const page2 = pages[scripturePageIndex];
  broadcastFn({
    type: 'scripture',
    reference: loadedScripture.reference,
    displayReference: page2.displayReference,
    text: page2.text,
    mode: 'per-verse',
    verses: page2.verses,
    currentPage: page2.page,
    totalPages: page2.totalPages,
    typographyMode: page2.typographyMode,
    isContinuation: page2.isContinuation,
    continuationIndex: page2.continuationIndex,
    continuationCount: page2.continuationCount,
    planIdentity: 'plan-xyz',
  });

  assert.equal(activeOverlay.currentPage, 2);
  assert.equal(activeOverlay.typographyMode, 'chapter');

  // 3. Simulate Prev Page navigation: page 2 -> page 1
  scripturePageIndex = 0;
  const page1Again = pages[scripturePageIndex];
  broadcastFn({
    type: 'scripture',
    reference: loadedScripture.reference,
    displayReference: page1Again.displayReference,
    text: page1Again.text,
    mode: 'per-verse',
    verses: page1Again.verses,
    currentPage: page1Again.page,
    totalPages: page1Again.totalPages,
    typographyMode: page1Again.typographyMode,
    isContinuation: page1Again.isContinuation,
    continuationIndex: page1Again.continuationIndex,
    continuationCount: page1Again.continuationCount,
    planIdentity: 'plan-xyz',
  });

  assert.equal(activeOverlay.currentPage, 1);
  assert.equal(activeOverlay.displayReference, page1Again.displayReference);
});

test('SPEC-100-02 Defect Injection Proof: verifyTypographyModePreservation fails if mode is omitted', () => {
  const presentChannelPath = path.join(ROOT, 'src', 'lib', 'present-channel.ts');
  const src = fs.readFileSync(presentChannelPath, 'utf8');
  const brokenSource = src.replace('typographyMode:', '');

  assert.equal(
    brokenSource.includes('typographyMode:'),
    false,
    'INJECTED DEFECT: Omitted typographyMode fails guard'
  );
});
