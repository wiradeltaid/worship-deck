/**
 * SPEC-81-01: Fix PresenterOperator Live Background Preview Disconnect (WSD-W1)
 *
 * Verifies:
 * 1. PresenterOperator.tsx passes backgroundOverride={liveBackground} to Current SlideView.
 * 2. PresenterOperator.tsx passes backgroundOverride={liveBackground} to Next SlideView.
 * 3. FilmstripFrame accepts backgroundOverride and forwards it to SlideView.
 * 4. Filmstrip render loop passes backgroundOverride={liveBackground} to FilmstripFrame.
 * 5. ArtifactSlide.tsx delegates to resolveEffectiveBackgroundImage from render-model.ts.
 * 6. resolveEffectiveBackgroundImage respects isVerseOrReff boundary: lyric slides receive override, non-lyric slides preserve authored background.
 * 7. Real-file defect injection proofs asserting absence guards fail cleanly if any backgroundOverride hook is omitted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  isLyricSlide,
  resolveEffectiveBackgroundImage,
} from '../src/lib/artifacts/render-model.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PRESENTER_OPERATOR_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'present',
  'PresenterOperator.tsx'
);

const ARTIFACT_SLIDE_PATH = path.join(
  ROOT,
  'src',
  'components',
  'artifacts',
  'ArtifactSlide.tsx'
);

function readPresenterOperatorSource() {
  return readFileSync(PRESENTER_OPERATOR_PATH, 'utf8');
}

function readArtifactSlideSource() {
  return readFileSync(ARTIFACT_SLIDE_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Source Guards: Wiring in PresenterOperator.tsx & ArtifactSlide.tsx
// ---------------------------------------------------------------------------

test('SPEC-81-01: FilmstripFrame accepts and forwards backgroundOverride', () => {
  const src = readPresenterOperatorSource();

  // FilmstripFrame props declaration must include backgroundOverride
  const filmstripPropsMatch = src.match(
    /const FilmstripFrame = memo\(function FilmstripFrame\(\{[\s\S]*?\}\:\s*\{([\s\S]*?)\}\)/
  );
  assert.ok(filmstripPropsMatch, 'FilmstripFrame props signature must exist');
  assert.match(
    filmstripPropsMatch[1],
    /backgroundOverride\?\s*:\s*string\s*\|\s*null/,
    'FilmstripFrame props type must declare backgroundOverride?: string | null'
  );

  // FilmstripFrame body must forward backgroundOverride to SlideView
  const filmstripSlideViewMatch = src.match(
    /function FilmstripFrame[\s\S]*?<SlideView[\s\S]*?\/>/
  );
  assert.ok(filmstripSlideViewMatch, 'FilmstripFrame must contain SlideView');
  assert.match(
    filmstripSlideViewMatch[0],
    /<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/,
    'FilmstripFrame must forward backgroundOverride={backgroundOverride} to SlideView'
  );
});

test('SPEC-81-01: PresenterOperator passes backgroundOverride to Current and Next SlideView', () => {
  const src = readPresenterOperatorSource();

  // Current slide view
  const currentSlideMatch = src.match(
    /<SlideView\s+slide=\{current\}\s+backgroundOverride=\{liveBackground\}\s*\/>/
  );
  assert.ok(
    currentSlideMatch,
    'Current stage SlideView must receive backgroundOverride={liveBackground}'
  );

  // Next slide view
  const nextSlideMatch = src.match(
    /<SlideView\s+slide=\{next\}\s+backgroundOverride=\{liveBackground\}\s*\/>/
  );
  assert.ok(
    nextSlideMatch,
    'Next stage SlideView must receive backgroundOverride={liveBackground}'
  );
});

test('SPEC-81-01: Filmstrip render loop passes backgroundOverride={liveBackground}', () => {
  const src = readPresenterOperatorSource();

  const loopMatch = src.match(
    /<FilmstripFrame\b[^>]*?backgroundOverride=\{liveBackground\}/
  );
  assert.ok(
    loopMatch,
    'FilmstripFrame invocation in loop must receive backgroundOverride={liveBackground}'
  );
});

test('SPEC-81-01: ArtifactSlide.tsx delegates background resolution to resolveEffectiveBackgroundImage', () => {
  const src = readArtifactSlideSource();

  assert.match(
    src,
    /import\s*\{[\s\S]*?resolveEffectiveBackgroundImage[\s\S]*?\}\s*from\s*['"]@\/lib\/artifacts\/render-model['"]/,
    'ArtifactSlide must import resolveEffectiveBackgroundImage from render-model'
  );
  assert.match(
    src,
    /const\s+effectiveBgImage\s*=\s*resolveEffectiveBackgroundImage\(\s*instance\s*,\s*backgroundOverride\s*\)/,
    'ArtifactSlide must call resolveEffectiveBackgroundImage(instance, backgroundOverride)'
  );
});

// ---------------------------------------------------------------------------
// 2. Behavioral Unit Verification: isLyricSlide and resolveEffectiveBackgroundImage
// ---------------------------------------------------------------------------

test('SPEC-81-01: isLyricSlide and resolveEffectiveBackgroundImage respect isVerseOrReff boundary', () => {
  const lyricVerse = {
    layoutKey: 'verse',
    layout: { backgroundImage: 'default-song.jpg' },
  };
  const lyricReff = {
    layoutKey: 'reff',
    layout: { backgroundImage: 'default-song.jpg' },
  };
  const lyricGroup = {
    layoutKey: 'custom',
    group: { role: 'lyric' },
    layout: { backgroundImage: 'default-song.jpg' },
  };
  const nonLyricTitle = {
    layoutKey: 'title',
    group: { role: 'title' },
    layout: { backgroundImage: 'title-bg.jpg' },
  };
  const nonLyricWelcome = {
    layoutKey: 'default',
    layout: { backgroundImage: 'welcome-bg.jpg' },
  };

  const overrideBg = 'live-selected-bg.jpg';

  // Verification of isLyricSlide classification
  assert.equal(isLyricSlide(lyricVerse), true);
  assert.equal(isLyricSlide(lyricReff), true);
  assert.equal(isLyricSlide(lyricGroup), true);
  assert.equal(isLyricSlide(nonLyricTitle), false);
  assert.equal(isLyricSlide(nonLyricWelcome), false);

  // 1. Lyric slides receive override
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, overrideBg), overrideBg);
  assert.equal(resolveEffectiveBackgroundImage(lyricReff, overrideBg), overrideBg);
  assert.equal(resolveEffectiveBackgroundImage(lyricGroup, overrideBg), overrideBg);

  // 2. Non-lyric slides preserve authored layout background
  assert.equal(resolveEffectiveBackgroundImage(nonLyricTitle, overrideBg), 'title-bg.jpg');
  assert.equal(resolveEffectiveBackgroundImage(nonLyricWelcome, overrideBg), 'welcome-bg.jpg');

  // 3. Lyric slides with empty string or null clear background (undefined)
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, ''), undefined);
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, null), undefined);

  // 4. When backgroundOverride is undefined, authored background is preserved
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, undefined), 'default-song.jpg');
});

// ---------------------------------------------------------------------------
// 3. Defect Injection Proofs (Absence Guards)
// ---------------------------------------------------------------------------

test('SPEC-81-01: Defect injection proofs — absence guards fail if backgroundOverride omitted', () => {
  const validSource = readPresenterOperatorSource();

  function verifySource(source) {
    const hasCurrent = /<SlideView\s+slide=\{current\}\s+backgroundOverride=\{liveBackground\}\s*\/>/.test(source);
    const hasNext = /<SlideView\s+slide=\{next\}\s+backgroundOverride=\{liveBackground\}\s*\/>/.test(source);
    const hasFilmstripProp = /const FilmstripFrame = memo\(function FilmstripFrame\(\{[\s\S]*?\}\:\s*\{[\s\S]*?backgroundOverride\?\s*:\s*string\s*\|\s*null[\s\S]*?\}\)/.test(source);
    const hasFilmstripFwd = /function FilmstripFrame[\s\S]*?<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/.test(source);
    const hasLoopFwd = /<FilmstripFrame\b[^>]*?backgroundOverride=\{liveBackground\}/.test(source);

    return hasCurrent && hasNext && hasFilmstripProp && hasFilmstripFwd && hasLoopFwd;
  }

  // Baseline: validSource must pass all guards
  assert.equal(verifySource(validSource), true, 'Valid source must pass all absence guards');

  // Defect 1: Current missing backgroundOverride
  const defect1 = validSource.replace(
    /<SlideView\s+slide=\{current\}\s+backgroundOverride=\{liveBackground\}\s*\/>/,
    '<SlideView slide={current} />'
  );
  assert.equal(verifySource(defect1), false, 'Must detect missing backgroundOverride on Current');

  // Defect 2: Next missing backgroundOverride
  const defect2 = validSource.replace(
    /<SlideView\s+slide=\{next\}\s+backgroundOverride=\{liveBackground\}\s*\/>/,
    '<SlideView slide={next} />'
  );
  assert.equal(verifySource(defect2), false, 'Must detect missing backgroundOverride on Next');

  // Defect 3: FilmstripFrame not forwarding backgroundOverride
  const defect3 = validSource.replace(
    /<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/,
    '<SlideView slide={slide} />'
  );
  assert.equal(verifySource(defect3), false, 'Must detect missing backgroundOverride in FilmstripFrame');

  // Defect 4: Loop not forwarding backgroundOverride specifically in FilmstripFrame
  const defect4 = validSource.replace(
    /(<FilmstripFrame\b[^>]*?)backgroundOverride=\{liveBackground\}/,
    '$1'
  );
  assert.equal(verifySource(defect4), false, 'Must detect missing backgroundOverride in filmstrip loop');
});
