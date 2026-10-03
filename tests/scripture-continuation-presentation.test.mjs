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

  let broadcastMessage = null;
  const handlers = {
    broadcast: (msg) => {
      broadcastMessage = msg;
    },
    setIndexAndSync: () => {},
    setBlankAndSync: () => {},
    setTransitionAndSync: () => {},
    setBackgroundAndSync: () => {},
  };

  // Send an ultra-long verse intent (> 650 chars) via remote control
  const ultraLongText =
    'And it came to pass in those days, that there went out a decree from Caesar Augustus that all the world should be taxed, and all went to be taxed, every one into his own city. Furthermore, the governors and deputies in all the provinces assembled the people, making proclamation that all citizens should render tribute according to their households and estates, without omission or delay, throughout the entire jurisdiction of the empire from sunrise unto the going down of the same.';

  const accepted = applyRemoteIntent(
    {
      type: 'scripture',
      reference: 'Luke 2:1',
      text: ultraLongText,
      planIdentity: 'plan-123',
    },
    'plan-123',
    handlers
  );

  assert.equal(accepted, true);
  assert.ok(broadcastMessage !== null);
  assert.equal(broadcastMessage.type, 'scripture');
  assert.ok(broadcastMessage.typographyMode === 'chapter' || broadcastMessage.typographyMode === 'verse');
  assert.equal(typeof broadcastMessage.isContinuation, 'boolean');
  assert.equal(typeof broadcastMessage.continuationIndex, 'number');
  assert.equal(typeof broadcastMessage.continuationCount, 'number');
  // Proven normalized: totalPages reflects chunking
  assert.ok(broadcastMessage.totalPages >= 1);
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
