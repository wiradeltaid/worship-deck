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
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
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

const PROJECTOR_CLIENT_PATH = path.join(
  ROOT,
  'src',
  'projected',
  'ProjectorClient.tsx'
);

const RENDER_MODEL_PATH = path.join(
  ROOT,
  'src',
  'lib',
  'artifacts',
  'render-model.ts'
);

function readPresenterOperatorSource() {
  return readFileSync(PRESENTER_OPERATOR_PATH, 'utf8');
}

function readArtifactSlideSource() {
  return readFileSync(ARTIFACT_SLIDE_PATH, 'utf8');
}

function readProjectorClientSource() {
  return readFileSync(PROJECTOR_CLIENT_PATH, 'utf8');
}

function readRenderModelSource() {
  return readFileSync(RENDER_MODEL_PATH, 'utf8');
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
// 2. Behavioral Unit Verification: isLyricSlide and resolveEffectiveBackgroundImage (SPEC-82-01)
// ---------------------------------------------------------------------------

test('SPEC-82-01: isLyricSlide and resolveEffectiveBackgroundImage preserve deck default on null/empty/whitespace', () => {
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

  // 1. Lyric slides receive explicit non-empty URL override
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, overrideBg), overrideBg);
  assert.equal(resolveEffectiveBackgroundImage(lyricReff, overrideBg), overrideBg);
  assert.equal(resolveEffectiveBackgroundImage(lyricGroup, overrideBg), overrideBg);

  // 2. Non-lyric slides always preserve authored layout background under any override
  assert.equal(resolveEffectiveBackgroundImage(nonLyricTitle, overrideBg), 'title-bg.jpg');
  assert.equal(resolveEffectiveBackgroundImage(nonLyricWelcome, overrideBg), 'welcome-bg.jpg');
  assert.equal(resolveEffectiveBackgroundImage(nonLyricTitle, null), 'title-bg.jpg');

  // 3. SPEC-82-01 Parity: null, undefined, '', and whitespace preserve the deck's authored background
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, null), 'default-song.jpg');
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, undefined), 'default-song.jpg');
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, ''), 'default-song.jpg');
  assert.equal(resolveEffectiveBackgroundImage(lyricVerse, '   '), 'default-song.jpg');
  assert.equal(resolveEffectiveBackgroundImage(lyricReff, null), 'default-song.jpg');
});

test('SPEC-82-01: ProjectorClient forwards backgroundOverride to active and outgoing SlideViews', () => {
  const src = readProjectorClientSource();

  // ProjectorClient backgroundOverride state declaration
  assert.match(
    src,
    /const\s*\[backgroundOverride,\s*setBackgroundOverride\]\s*=\s*useState<\s*string\s*\|\s*null\s*\|\s*undefined\s*>\(\s*undefined\s*\)/,
    'ProjectorClient must declare backgroundOverride state'
  );

  // Outgoing slide view backgroundOverride forwarding
  assert.match(
    src,
    /<SlideView\s+slide=\{outgoingSlide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/,
    'Outgoing SlideView must receive backgroundOverride={backgroundOverride}'
  );

  // Incoming slide view backgroundOverride forwarding
  assert.match(
    src,
    /<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/,
    'Incoming SlideView must receive backgroundOverride={backgroundOverride}'
  );
});

// ---------------------------------------------------------------------------
// 3. Defect Injection Proofs (Absence Guards)
// ---------------------------------------------------------------------------

test('SPEC-82-01: Defect injection proofs — absence guards fail if backgroundOverride omitted or null handling broken', () => {
  const validSource = readPresenterOperatorSource();
  const validProjectorSource = readProjectorClientSource();

  function verifySource(source) {
    const hasCurrent = /<SlideView\s+slide=\{current\}\s+backgroundOverride=\{liveBackground\}\s*\/>/.test(source);
    const hasNext = /<SlideView\s+slide=\{next\}\s+backgroundOverride=\{liveBackground\}\s*\/>/.test(source);
    const hasFilmstripProp = /const FilmstripFrame = memo\(function FilmstripFrame\(\{[\s\S]*?\}\:\s*\{[\s\S]*?backgroundOverride\?\s*:\s*string\s*\|\s*null[\s\S]*?\}\)/.test(source);
    const hasFilmstripFwd = /function FilmstripFrame[\s\S]*?<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/.test(source);
    const hasLoopFwd = /<FilmstripFrame\b[^>]*?backgroundOverride=\{liveBackground\}/.test(source);

    return hasCurrent && hasNext && hasFilmstripProp && hasFilmstripFwd && hasLoopFwd;
  }

  function verifyProjectorSource(source) {
    const hasOutgoing = /<SlideView\s+slide=\{outgoingSlide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/.test(source);
    const hasIncoming = /<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/.test(source);
    return hasOutgoing && hasIncoming;
  }

  // Baseline: valid sources must pass all guards
  assert.equal(verifySource(validSource), true, 'Valid PresenterOperator source must pass all absence guards');
  assert.equal(verifyProjectorSource(validProjectorSource), true, 'Valid ProjectorClient source must pass all absence guards');

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

  // Defect 5: Projector incoming SlideView missing backgroundOverride
  const defect5 = validProjectorSource.replace(
    /<SlideView\s+slide=\{slide\}\s+backgroundOverride=\{backgroundOverride\}\s*\/>/,
    '<SlideView slide={slide} />'
  );
  assert.equal(verifyProjectorSource(defect5), false, 'Must detect missing backgroundOverride in ProjectorClient');

  // -------------------------------------------------------------------------
  // Real-file defect injections with guaranteed restoration on render-model.ts
  // -------------------------------------------------------------------------
  const originalRenderModel = readRenderModelSource();

  function verifyRenderModelSource(source) {
    const hasNonLyricBypass =
      /if\s*\(!isLyricSlide\(instance\)\)\s*\{\s*return\s+instance\.layout\.backgroundImage;\s*\}/.test(source);
    const hasTrimNormalize =
      /const\s+override\s*=\s*typeof\s+backgroundOverride\s*===\s*['"]string['"]\s*\?\s*backgroundOverride\.trim\(\)\s*:\s*['"]['"]/.test(source);
    const hasDeckDefaultFallback =
      /return\s+override\s*\?\s*override\s*:\s*instance\.layout\.backgroundImage/.test(source);

    return hasNonLyricBypass && hasTrimNormalize && hasDeckDefaultFallback;
  }

  assert.equal(
    verifyRenderModelSource(readRenderModelSource()),
    true,
    'Unmodified render-model.ts on disk must pass all source guards'
  );

  const renderModelDefects = [
    {
      name: 'Missing non-lyric bypass guard',
      mutator: (s) =>
        s.replace(
          /if\s*\(!isLyricSlide\(instance\)\)\s*\{\s*return\s+instance\.layout\.backgroundImage;\s*\}/,
          ''
        ),
      assertExecution: `
        import assert from "node:assert/strict";
        import { resolveEffectiveBackgroundImage } from "./src/lib/artifacts/render-model.ts";
        const nonLyric = { layoutKey: "title", layout: { backgroundImage: "title.jpg" } };
        // Under defect, non-lyric slide incorrectly receives override instead of preserving authored background
        assert.equal(resolveEffectiveBackgroundImage(nonLyric, "override.jpg"), "override.jpg");
        process.stdout.write("MUTANT_REGRESSION_CONFIRMED");
      `,
    },
    {
      name: 'Pre-SPEC-82 broken resolver (null returning undefined)',
      mutator: (s) =>
        s.replace(
          /const\s+override\s*=\s*typeof\s+backgroundOverride\s*===\s*['"]string['"]\s*\?\s*backgroundOverride\.trim\(\)\s*:\s*['"]['"];\s*return\s+override\s*\?\s*override\s*:\s*instance\.layout\.backgroundImage;/,
          'return backgroundOverride !== undefined ? backgroundOverride || undefined : instance.layout.backgroundImage;'
        ),
      assertExecution: `
        import assert from "node:assert/strict";
        import { resolveEffectiveBackgroundImage } from "./src/lib/artifacts/render-model.ts";
        const lyric = { layoutKey: "verse", layout: { backgroundImage: "song.jpg" } };
        // Under defect, null incorrectly resolves to undefined instead of preserving authored background
        assert.equal(resolveEffectiveBackgroundImage(lyric, null), undefined);
        process.stdout.write("MUTANT_REGRESSION_CONFIRMED");
      `,
    },
    {
      name: 'Whitespace override not trimmed to deck default',
      mutator: (s) => s.replace(/backgroundOverride\.trim\(\)/, 'backgroundOverride'),
      assertExecution: `
        import assert from "node:assert/strict";
        import { resolveEffectiveBackgroundImage } from "./src/lib/artifacts/render-model.ts";
        const lyric = { layoutKey: "verse", layout: { backgroundImage: "song.jpg" } };
        // Under defect, whitespace is treated as non-empty override instead of preserving authored background
        assert.equal(resolveEffectiveBackgroundImage(lyric, "   "), "   ");
        process.stdout.write("MUTANT_REGRESSION_CONFIRMED");
      `,
    },
  ];

  for (const { name, mutator, assertExecution } of renderModelDefects) {
    const defectiveSource = mutator(originalRenderModel);
    try {
      writeFileSync(RENDER_MODEL_PATH, defectiveSource, 'utf8');
      const diskSource = readRenderModelSource();
      assert.equal(
        verifyRenderModelSource(diskSource),
        false,
        `Real-file structural defect guard must detect: ${name}`
      );

      // Execute fresh node child process against mutated disk file to prove actual behavioral regression
      const out = execFileSync(
        process.execPath,
        [
          '--import',
          './tests/register-ts-resolve.mjs',
          '--experimental-strip-types',
          '--input-type=module',
          '-e',
          assertExecution,
        ],
        { encoding: 'utf8', cwd: ROOT }
      );
      assert.ok(
        out.includes('MUTANT_REGRESSION_CONFIRMED'),
        `Real-file behavioral execution must prove regression for: ${name}`
      );
    } finally {
      writeFileSync(RENDER_MODEL_PATH, originalRenderModel, 'utf8');
    }
  }

  assert.equal(
    readRenderModelSource(),
    originalRenderModel,
    'render-model.ts source must be completely restored after defect injection'
  );
});
