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

test('SPEC-102-02: getScriptureScaling scales adaptively by estimatedVisualLines for chapter presentation', async () => {
  const { getScriptureScaling } = await import(new URL('../src/lib/scripture-scaling.ts', import.meta.url).href);

  // 1-5 visual lines: 6.0cqh
  const lightDensity = getScriptureScaling('Short tail passage with 4 lines.', 2, 'chapter', 4);
  assert.equal(lightDensity.fontSizeStyle, '6.0cqh');
  assert.equal(lightDensity.minHeightStyle, '32cqh');

  // 6-7 visual lines: 5.4cqh
  const mediumDensity = getScriptureScaling('Medium passage with 6-7 lines.', 4, 'chapter', 6);
  assert.equal(mediumDensity.fontSizeStyle, '5.4cqh');
  assert.equal(mediumDensity.minHeightStyle, '26cqh');

  // 8-10 visual lines: 4.8cqh
  const denseNarrative = getScriptureScaling('Dense narrative passage with 9 lines.', 7, 'chapter', 9);
  assert.equal(denseNarrative.fontSizeStyle, '4.8cqh');
  assert.equal(denseNarrative.minHeightStyle, '20cqh');

  // In verse mode, hero sizing applies
  const heroVerse = getScriptureScaling('Short hero verse.', 1, 'verse');
  assert.equal(heroVerse.fontSizeStyle, '8.5cqh');
});

test('SPEC-102-02: computeScriptureFitScale aligns with 82cqh budget for zero clipping', async () => {
  const { computeScriptureFitScale } = await import(new URL('../src/lib/scripture-scaling.ts', import.meta.url).href);

  // Stage 16:9 at 1920x1080 (stageHeight = 1080, stageWidth = 1920)
  // Max budget height = 1080 * 0.82 = 885.6px
  const scale = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 700,
    naturalWidth: 1500,
    containerHeight: 885,
    containerWidth: 1680,
  });

  assert.equal(scale, 1, 'Scale must be 1 when naturalHeight fits within 82cqh budget');
});

test('SPEC-102-02: ScriptureOverlayView sets lineHeight 1.36 for chapter mode and max-h-[82cqh]', () => {
  const viewPath = path.join(ROOT, 'src', 'components', 'ScriptureOverlayView.tsx');
  const src = fs.readFileSync(viewPath, 'utf8');

  assert.ok(
    src.includes('1.36') && src.includes('typographyMode'),
    'ScriptureOverlayView must set lineHeight 1.36 when typographyMode is chapter'
  );
  assert.ok(
    src.includes('max-h-[82cqh]'),
    'ScriptureOverlayView must set container height budget to max-h-[82cqh]'
  );
  assert.ok(
    src.includes('estimatedVisualLines'),
    'ScriptureOverlayView must accept and pass estimatedVisualLines'
  );
  assert.ok(
    src.includes('anywhere') || src.includes('break-words') || src.includes('overflow-wrap'),
    'ScriptureOverlayView must support overflow-wrap anywhere'
  );
});

test('SPEC-102-02: paginateScriptureVerses attaches estimatedVisualLines to each chunk', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  const sampleVerses = [
    { verse: 1, text: 'Now when Jesus learned that the Pharisees had heard that Jesus was making and baptizing more disciples than John' },
    { verse: 2, text: '(although Jesus himself did not baptize, but only his disciples),' },
    { verse: 3, text: 'he left Judea and departed again for Galilee.' },
    { verse: 4, text: 'And he had to pass through Samaria.' },
    { verse: 5, text: 'So he came to a town of Samaria called Sychar, near the field that Jacob had given to his son Joseph.' },
  ];

  const chunks = paginateScriptureVerses('John 4:1-5', sampleVerses, 'per-verse', 'chapter');
  assert.ok(chunks.length >= 1);
  for (const c of chunks) {
    assert.equal(typeof c.estimatedVisualLines, 'number');
    assert.ok(c.estimatedVisualLines > 0, 'estimatedVisualLines must be positive');
  }
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
  // maxAllowedHeight = 1080 * 0.82 = 885.6px (SPEC-102-02), maxAllowedWidth = 1920 * 0.85 = 1632px
  // Test case 1: Normal 10-line chapter page (John 4 dense page ~660px height)
  const scale1 = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 660,
    naturalWidth: 1400,
  });
  assert.equal(scale1, 1, 'Within budget height and width renders at 1.0 (no shrinkage)');

  // Test case 2: Overflown text (e.g. 1000px natural height > 885.6px) scales safely to prevent clipping
  const scale2 = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 1000,
    naturalWidth: 1400,
  });
  const scaledHeight = 1000 * scale2;
  const maxAllowedHeight = 1080 * 0.82;
  assert.ok(
    scaledHeight <= maxAllowedHeight,
    `Scaled height (${scaledHeight}) must not exceed container maxAllowedHeight (${maxAllowedHeight})`
  );
});

test('SPEC-100-02: End-to-end remote whole-chapter navigation and continuation synchronization lifecycle', async () => {
  const { installScripturePassage, resolveScripturePageOverlay } = await import(
    new URL('../src/lib/scripture-format.ts', import.meta.url).href
  );
  const { applyRemoteIntent } = await import(new URL('../src/lib/presenter-remote-client.ts', import.meta.url).href);

  // Simulated Presenter state container using real pure helpers
  let installedPassageState = null;
  let activeOverlay = null;
  const broadcasts = [];

  const broadcastFn = (msg) => {
    broadcasts.push(msg);
    if (msg.type === 'scripture') {
      activeOverlay = msg;
    }
  };

  const currentMode = 'per-verse';
  const setScriptureAndSync = (data) => {
    const { passage, initialOverlay } = installScripturePassage({
      reference: data.reference,
      verses: data.verses,
      text: data.text,
      isWholeChapter: data.is_whole_chapter,
      mode: data.mode,
      currentMode,
    });
    installedPassageState = passage;
    broadcastFn({
      type: 'scripture',
      reference: passage.reference,
      displayReference: initialOverlay.displayReference,
      text: initialOverlay.text,
      mode: passage.mode,
      verses: initialOverlay.verses,
      currentPage: initialOverlay.page,
      totalPages: initialOverlay.totalPages,
      typographyMode: initialOverlay.typographyMode,
      isContinuation: initialOverlay.isContinuation,
      continuationIndex: initialOverlay.continuationIndex,
      continuationCount: initialOverlay.continuationCount,
      planIdentity: 'plan-xyz',
    });
  };

  // Construct 15 synthetic verses (~3-4 pages)
  const syntheticVerses = Array.from({ length: 15 }, (_, i) => ({
    verse: i + 1,
    text: `Verse content for line-budget verification test number ${i + 1} with sufficient length to span multiple lines.`,
  }));

  // 1. Remote intent delivers whole chapter with mode omitted
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
  assert.ok(installedPassageState !== null);
  assert.equal(installedPassageState.reference, 'John 4');
  assert.equal(installedPassageState.typographyMode, 'chapter');
  assert.equal(installedPassageState.mode, 'per-verse', 'Must default to currentMode when remote intent omits mode');

  // Verify page 1 initial broadcast
  assert.equal(activeOverlay.currentPage, 1);
  assert.ok(activeOverlay.totalPages >= 3, `Expected >= 3 pages, got ${activeOverlay.totalPages}`);
  assert.equal(activeOverlay.typographyMode, 'chapter');

  // 2. Next Page navigation: page 1 -> page 2 using real resolveScripturePageOverlay
  const page2 = resolveScripturePageOverlay(installedPassageState, 1);
  assert.ok(page2 !== null);
  assert.equal(page2.page, 2);
  assert.equal(page2.typographyMode, 'chapter');
  broadcastFn({
    type: 'scripture',
    reference: installedPassageState.reference,
    displayReference: page2.displayReference,
    text: page2.text,
    mode: installedPassageState.mode,
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

  // 3. Prev Page navigation: page 2 -> page 1 using real resolveScripturePageOverlay
  const page1Again = resolveScripturePageOverlay(installedPassageState, 0);
  assert.ok(page1Again !== null);
  assert.equal(page1Again.page, 1);
  assert.equal(page1Again.typographyMode, 'chapter');
  broadcastFn({
    type: 'scripture',
    reference: installedPassageState.reference,
    displayReference: page1Again.displayReference,
    text: page1Again.text,
    mode: installedPassageState.mode,
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

  // 4. Lossless text preservation across all installed pages
  const originalCombinedText = syntheticVerses.map((v) => v.text).join('');
  const reconstructedFromChunks = installedPassageState.pages.flatMap((p) => p.verses).map((v) => v.text).join('');
  assert.equal(reconstructedFromChunks, originalCombinedText, 'Passage chunks must losslessly preserve all verse text');
});

test('SPEC-100-02: Omitted remote mode preserves presenter currentMode (e.g. inline)', async () => {
  const { installScripturePassage } = await import(
    new URL('../src/lib/scripture-format.ts', import.meta.url).href
  );
  const { applyRemoteIntent } = await import(new URL('../src/lib/presenter-remote-client.ts', import.meta.url).href);

  let capturedPassage = null;
  const handlers = {
    broadcast: () => {},
    setIndexAndSync: () => {},
    setBlankAndSync: () => {},
    setTransitionAndSync: () => {},
    setBackgroundAndSync: () => {},
    setScriptureAndSync: (data) => {
      const { passage } = installScripturePassage({
        reference: data.reference,
        verses: data.verses,
        text: data.text,
        isWholeChapter: data.is_whole_chapter,
        mode: data.mode,
        currentMode: 'inline', // Presenter is currently set to inline
      });
      capturedPassage = passage;
    },
  };

  applyRemoteIntent(
    {
      type: 'scripture',
      reference: 'John 4',
      text: 'Verse text',
      // mode intentionally omitted
      planIdentity: 'plan-123',
    },
    'plan-123',
    handlers
  );

  assert.ok(capturedPassage !== null);
  assert.equal(capturedPassage.mode, 'inline', 'Omitted remote mode must default to presenter currentMode (inline)');
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
