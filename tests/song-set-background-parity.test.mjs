/**
 * SPEC-81-03: Song-Set Background Persistence, Hydration, Placeholder Transparency & PPTX Parity (WSD-W3)
 *
 * Verifies:
 * 1. DynamicFormBody.tsx source guards verifying "Use Song-Set Default" option, thumbnail rendering, and defaultRoles.
 * 2. Canvas utils placeholder stand-in uses transparent fill (eliminating opaque/tinted overlay).
 * 3. PPTX generation embeds resolved background images and deduplicates repeated media to 1 file in ppt/media/.
 * 4. Real-file defect injection proofs asserting guards fail on missing defaults or tinted placeholder fills.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { default: JSZip } = await import(
  pathToFileURL(path.join(ROOT, 'node_modules', 'jszip', 'lib', 'index.js')).href
);
const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(ROOT, 'src', 'lib', 'pptx-draw.ts')).href
);

const FORM_BODY_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'DynamicFormBody.tsx'
);

const CANVAS_UTILS_PATH = path.join(
  ROOT,
  'src',
  'lib',
  'registry',
  'canvas-utils.ts'
);

function readFormBodySource() {
  return fs.readFileSync(FORM_BODY_PATH, 'utf8');
}

function readCanvasUtilsSource() {
  return fs.readFileSync(CANVAS_UTILS_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// 1. DynamicFormBody Source Guards
// ---------------------------------------------------------------------------

test('SPEC-81-03: DynamicFormBody background selector wires Use Song-Set Default', () => {
  const src = readFormBodySource();

  // 1. BackgroundLibrary prop type includes defaultRoles?: string[]
  assert.match(
    src,
    /backgroundLibrary\s*:\s*Array<\{[\s\S]*?defaultRoles\?\s*:\s*string\[\][\s\S]*?\}>/,
    'backgroundLibrary type must declare defaultRoles?: string[]'
  );

  // 2. Looks up songSetDefaultBg
  assert.match(
    src,
    /const\s+songSetDefaultBg\s*=\s*backgroundLibrary\.find/,
    'Must look up songSetDefaultBg from backgroundLibrary'
  );
  assert.match(
    src,
    /b\.defaultRoles\?\.includes\(['"]song_set['"]\)/,
    'Must check defaultRoles?.includes("song_set")'
  );

  // 3. Select placeholder and option use "Use Song-Set Default"
  assert.match(
    src,
    /Use Song-Set Default/,
    'SelectTrigger or content must show "Use Song-Set Default"'
  );
  assert.match(
    src,
    /Use Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)/,
    'Select option must render "Use Song-Set Default (#{id})"'
  );

  // 4. SelectTrigger renders songSetDefaultBg thumbnail img
  assert.match(
    src,
    /<img\s+src=\{songSetDefaultBg\.url\}/,
    'SelectTrigger must render songSetDefaultBg thumbnail img'
  );
});

// ---------------------------------------------------------------------------
// 1b. SPEC-82-02: Song-Set Background Dropdown Containment & Typography
// ---------------------------------------------------------------------------

test('SPEC-82-02: Song-Set Background Dropdown Containment & Typography in DynamicFormBody.tsx', () => {
  const src = readFormBodySource();

  // 1. SelectTrigger must pass w-full to be bounded to its w-48 container
  assert.match(
    src,
    /<SelectTrigger\s+className=['"]w-full\s+h-9\s+text-xs['"]/,
    'SelectTrigger must use className="w-full h-9 text-xs" for dropdown containment'
  );

  // 2. Both trigger flex containers must have min-w-0 for flexbox text truncation
  const minW0Matches = src.match(
    /<div\s+className=['"]flex\s+min-w-0\s+items-center\s+gap-1\.5\s+overflow-hidden['"]/g
  );
  assert.equal(
    minW0Matches?.length,
    2,
    'Both trigger branches (explicit and default) must specify min-w-0'
  );

  // 3. Trigger label spans must specifically use concise text-[11px] truncate on both explicit and default branches
  assert.match(
    src,
    /<span\s+className=['"]truncate\s+text-\[11px\]['"]\s+title=\{`Image \$\{selectedFormBg\.id\}`\}\s*>/,
    'Explicit image trigger label span must specifically declare truncate text-[11px]'
  );
  assert.match(
    src,
    /<span\s+className=['"]truncate\s+text-\[11px\]['"]\s+title=\{`Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)`\}\s*>/,
    'Default trigger label span must specifically declare truncate text-[11px]'
  );

  // 4. Default label in trigger must be concise "Song-Set Default (#id)"
  assert.match(
    src,
    /Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)/,
    'Trigger label for default must use concise Song-Set Default (#id)'
  );

  // 5. Explicit image label in trigger must be strictly concise "Image {selectedFormBg.id}" without suffix
  assert.match(
    src,
    /Image \{selectedFormBg\.id\}\s*<\/span>/,
    'Trigger label for explicit image must be strictly concise without suffix'
  );

  // 7. SelectItem value="default" in SelectContent retains full descriptive label
  assert.match(
    src,
    /<SelectItem\s+value=['"]default['"]>[\s\S]*?Use Song-Set Default/,
    'SelectContent must retain Use Song-Set Default in options list'
  );
});

// ---------------------------------------------------------------------------
// 2. Canvas Utils Placeholder Transparency Guard
// ---------------------------------------------------------------------------

test('SPEC-81-03: canvas-utils placeholder stand-in uses transparent fill', () => {
  const src = readCanvasUtilsSource();

  // Must use fill: 'transparent' for fabric.Rect placeholder stand-in
  assert.match(
    src,
    /if\s*\(typeof fabric\?\.Rect === ['"]function['"]\)\s*\{\s*return new fabric\.Rect\(\{[\s\S]*?fill:\s*['"]transparent['"]/,
    'Placeholder stand-in must use transparent fill'
  );

  // Must NOT use tinted fill rgba(255,255,255,0.08)
  assert.doesNotMatch(
    src,
    /fill:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.08\)['"]/,
    'Placeholder stand-in must NOT use tinted opaque fill'
  );
});

// ---------------------------------------------------------------------------
// 3. PPTX Export Media Deduplication Parity
// ---------------------------------------------------------------------------

test('SPEC-81-03: PPTX export deduplicates identical background images to 1 physical file in ppt/media/', async () => {
  // 5 slides all sharing the exact same background image asset
  const sharedBg = '/assets/welcome-bg.png';
  const plan = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'slide-1',
        templateId: 'tpl-1',
        label: 'Song Title',
        baseType: 'song-set-entry',
        layoutKey: 'title',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          backgroundImage: sharedBg,
          elements: [],
        },
      },
    },
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'slide-2',
        templateId: 'tpl-1',
        label: 'Song Verse 1',
        baseType: 'song-set-entry',
        layoutKey: 'verse',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          backgroundImage: sharedBg,
          elements: [],
        },
      },
    },
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'slide-3',
        templateId: 'tpl-1',
        label: 'Song Chorus',
        baseType: 'song-set-entry',
        layoutKey: 'reff',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          backgroundImage: sharedBg,
          elements: [],
        },
      },
    },
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'slide-4',
        templateId: 'tpl-1',
        label: 'Song Verse 2',
        baseType: 'song-set-entry',
        layoutKey: 'verse',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          backgroundImage: sharedBg,
          elements: [],
        },
      },
    },
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'slide-5',
        templateId: 'tpl-2',
        label: 'General Slide',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          backgroundImage: sharedBg,
          elements: [],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-09-26', plan, 'none');
  const zip = await JSZip.loadAsync(buffer);

  const mediaFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('ppt/media/') && !zip.files[name].dir
  );

  // Exactly 1 physical media file despite being referenced on 5 slides
  assert.equal(
    mediaFiles.length,
    1,
    `Expected exactly 1 deduplicated media file in ppt/media/, found ${mediaFiles.length}: ${JSON.stringify(mediaFiles)}`
  );

  // Verify slide rels point to this deduplicated media file
  const relsFiles = Object.keys(zip.files).filter((name) =>
    name.startsWith('ppt/slides/_rels/slide')
  );
  assert.ok(relsFiles.length >= 5, 'expected at least 5 slide relationship files');
  for (const relsFile of relsFiles) {
    const relsXml = await zip.file(relsFile).async('string');
    assert.match(
      relsXml,
      /Target="\.\.\/media\/image[^"]*\.png"/,
      `Slide rels ${relsFile} must point to deduplicated image in ../media/`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Real-File Defect Injection Proofs
// ---------------------------------------------------------------------------

test('SPEC-81-03: Real-file defect injection proofs for DynamicFormBody and canvas-utils', () => {
  const originalFormBody = readFormBodySource();
  const originalCanvasUtils = readCanvasUtilsSource();

  function verifyFormBody(source) {
    const hasProp = /backgroundLibrary\s*:\s*Array<\{[\s\S]*?defaultRoles\?\s*:\s*string\[\]/.test(source);
    const hasSongSetDefaultBg = /const\s+songSetDefaultBg\s*=\s*backgroundLibrary\.find/.test(source);
    const hasRoleCheck = /b\.defaultRoles\?\.includes\(['"]song_set['"]\)/.test(source);
    const hasLabel = /Use Song-Set Default/.test(source);
    const hasThumb = /<img\s+src=\{songSetDefaultBg\.url\}/.test(source);
    return hasProp && hasSongSetDefaultBg && hasRoleCheck && hasLabel && hasThumb;
  }

  function verifyCanvasUtils(source) {
    const hasTransparent = /if\s*\(typeof fabric\?\.Rect === ['"]function['"]\)\s*\{\s*return new fabric\.Rect\(\{[\s\S]*?fill:\s*['"]transparent['"][\s\S]*?placeholderKey:\s*element\.placeholderKey/.test(source);
    const noTinted = !/fill:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.08\)['"]/.test(source);
    return hasTransparent && noTinted;
  }

  // Baseline
  assert.equal(verifyFormBody(originalFormBody), true, 'Original DynamicFormBody must pass');
  assert.equal(verifyCanvasUtils(originalCanvasUtils), true, 'Original canvas-utils must pass');

  // Defect 1: Injected missing songSetDefaultBg in DynamicFormBody.tsx
  const defectForm1 = originalFormBody.replace(/const\s+songSetDefaultBg\s*=\s*backgroundLibrary\.find[\s\S]*?;/, '');
  try {
    fs.writeFileSync(FORM_BODY_PATH, defectForm1, 'utf8');
    assert.equal(verifyFormBody(readFormBodySource()), false, 'Must detect missing songSetDefaultBg lookup');
  } finally {
    fs.writeFileSync(FORM_BODY_PATH, originalFormBody, 'utf8');
  }

  // Defect 2: Injected missing label in DynamicFormBody.tsx
  const defectForm2 = originalFormBody.replace(/Use Song-Set Default/g, 'Default Background');
  try {
    fs.writeFileSync(FORM_BODY_PATH, defectForm2, 'utf8');
    assert.equal(verifyFormBody(readFormBodySource()), false, 'Must detect reverted label');
  } finally {
    fs.writeFileSync(FORM_BODY_PATH, originalFormBody, 'utf8');
  }

  // Defect 3: Injected missing thumbnail in DynamicFormBody.tsx
  const defectForm3 = originalFormBody.replace(/<img\s+src=\{songSetDefaultBg\.url\}[\s\S]*?\/>/, '');
  try {
    fs.writeFileSync(FORM_BODY_PATH, defectForm3, 'utf8');
    assert.equal(verifyFormBody(readFormBodySource()), false, 'Must detect missing songSetDefaultBg thumbnail');
  } finally {
    fs.writeFileSync(FORM_BODY_PATH, originalFormBody, 'utf8');
  }

  // Defect 4: Injected tinted fill in placeholder stand-in of canvas-utils.ts
  const defectCanvas = originalCanvasUtils.replace(
    /(if\s*\(typeof fabric\?\.Rect === ['"]function['"]\)\s*\{\s*return new fabric\.Rect\(\{[\s\S]*?)fill:\s*['"]transparent['"]/,
    "$1fill: 'rgba(255,255,255,0.08)'"
  );
  try {
    fs.writeFileSync(CANVAS_UTILS_PATH, defectCanvas, 'utf8');
    assert.equal(verifyCanvasUtils(readCanvasUtilsSource()), false, 'Must detect tinted placeholder fill defect');
  } finally {
    fs.writeFileSync(CANVAS_UTILS_PATH, originalCanvasUtils, 'utf8');
  }

  // Verify full restoration
  assert.equal(readFormBodySource(), originalFormBody);
  assert.equal(readCanvasUtilsSource(), originalCanvasUtils);
});

test('SPEC-82-02: Real-file defect injection proofs for DynamicFormBody dropdown containment', () => {
  const originalFormBody = readFormBodySource();

  function verifyContainment(source) {
    const hasTriggerWidth =
      /<SelectTrigger\s+className=['"]w-full\s+h-9\s+text-xs['"]/.test(source);
    const minW0Count = (
      source.match(
        /<div\s+className=['"]flex\s+min-w-0\s+items-center\s+gap-1\.5\s+overflow-hidden['"]/g
      ) || []
    ).length;
    const hasMinW0 = minW0Count === 2;
    const hasExplicitTypography =
      /<span\s+className=['"]truncate\s+text-\[11px\]['"]\s+title=\{`Image \$\{selectedFormBg\.id\}`\}\s*>/.test(
        source
      );
    const hasDefaultTypography =
      /<span\s+className=['"]truncate\s+text-\[11px\]['"]\s+title=\{`Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)`\}\s*>/.test(
        source
      );
    const hasConciseDefault =
      /Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)/.test(source);
    const hasConciseExplicit =
      /Image \{selectedFormBg\.id\}\s*<\/span>/.test(source);
    return (
      hasTriggerWidth &&
      hasMinW0 &&
      hasExplicitTypography &&
      hasDefaultTypography &&
      hasConciseDefault &&
      hasConciseExplicit
    );
  }

  // Baseline on real disk file
  assert.equal(
    verifyContainment(readFormBodySource()),
    true,
    'Unmodified DynamicFormBody must pass containment guards'
  );

  const defects = [
    {
      name: 'Missing w-full on SelectTrigger',
      mutator: (s) =>
        s.replace(
          /<SelectTrigger\s+className=['"]w-full\s+h-9\s+text-xs['"]/,
          '<SelectTrigger className="h-9 text-xs">'
        ),
    },
    {
      name: 'Missing min-w-0 in explicit branch specifically',
      mutator: (s) =>
        s.replace(
          /<div\s+className=['"]flex\s+min-w-0\s+items-center\s+gap-1\.5\s+overflow-hidden['"]/,
          '<div className="flex items-center gap-1.5 overflow-hidden"'
        ),
    },
    {
      name: 'Missing min-w-0 in default branch specifically',
      mutator: (s) => {
        let first = true;
        return s.replace(
          /<div\s+className=['"]flex\s+min-w-0\s+items-center\s+gap-1\.5\s+overflow-hidden['"]/g,
          (m) => {
            if (first) {
              first = false;
              return m;
            }
            return '<div className="flex items-center gap-1.5 overflow-hidden"';
          }
        );
      },
    },
    {
      name: 'Missing text-[11px] on explicit image trigger label specifically',
      mutator: (s) =>
        s.replace(
          /<span\s+className=['"]truncate\s+text-\[11px\]['"]\s+title=\{`Image \$\{selectedFormBg\.id\}`\}\s*>/,
          '<span className="truncate text-xs" title={`Image ${selectedFormBg.id}`}>'
        ),
    },
    {
      name: 'Missing text-[11px] on default trigger label specifically',
      mutator: (s) =>
        s.replace(
          /<span\s+className=['"]truncate\s+text-\[11px\]['"]\s+title=\{`Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)`\}\s*>/,
          '<span className="truncate text-xs" title={`Song-Set Default (#${songSetDefaultBg.id})`}>'
        ),
    },
    {
      name: 'Reverted overlong default trigger label',
      mutator: (s) =>
        s.replace(
          /Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)/g,
          'Use Song-Set Default (#{songSetDefaultBg.id})'
        ),
    },
    {
      name: 'Overlong explicit-image trigger label with suffix',
      mutator: (s) =>
        s.replace(
          /Image \{selectedFormBg\.id\}/,
          'Image {selectedFormBg.id} (Song-Set Default)'
        ),
    },
    {
      name: 'Missing title tooltip on explicit trigger label',
      mutator: (s) =>
        s.replace(
          /title=\{`Image \$\{selectedFormBg\.id\}`\}/,
          ''
        ),
    },
    {
      name: 'Missing title tooltip on default trigger label',
      mutator: (s) =>
        s.replace(
          /title=\{`Song-Set Default \(#\$\{songSetDefaultBg\.id\}\)`\}/,
          ''
        ),
    },
  ];

  for (const { name, mutator } of defects) {
    const defectiveSource = mutator(originalFormBody);
    try {
      fs.writeFileSync(FORM_BODY_PATH, defectiveSource, 'utf8');
      assert.equal(
        verifyContainment(readFormBodySource()),
        false,
        `Must detect containment defect: ${name}`
      );
    } finally {
      fs.writeFileSync(FORM_BODY_PATH, originalFormBody, 'utf8');
    }
  }

  assert.equal(
    readFormBodySource(),
    originalFormBody,
    'Form body source must be fully restored'
  );
});
