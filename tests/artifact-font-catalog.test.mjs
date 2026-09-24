/**
 * SPEC-17-01: 45-Font Catalog Verification, Fallback Stacks, and Constant Deduplication
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const srcUrl = (...parts) =>
  pathToFileURL(path.join(root, 'src', ...parts)).href;

const {
  FONT_CATALOG,
  FONT_CATEGORY_LABELS,
  DEFAULT_FONT_FAMILY,
  getFontDefinition,
  isFontExportReady,
  getFontStack,
} = await import(srcUrl('lib', 'registry', 'font-catalog.ts'));

const { DEFAULT_FONT_FAMILY: CANVAS_DEFAULT_FONT } = await import(
  srcUrl('lib', 'registry', 'canvas-utils.ts')
);

const { DEFAULT_FONT_FAMILY: RENDER_DEFAULT_FONT } = await import(
  srcUrl('lib', 'artifacts', 'render-model.ts')
);

test('FONT_CATALOG contains exactly 45 unique font definitions', () => {
  assert.equal(FONT_CATALOG.length, 45, 'Font catalog must contain exactly 45 fonts');

  const families = new Set(FONT_CATALOG.map((f) => f.family.toLowerCase()));
  assert.equal(families.size, 45, 'All font family names must be unique');
});

test('FONT_CATALOG is distributed across exactly 5 distinct categories', () => {
  const counts = {
    system: 0,
    sans: 0,
    serif: 0,
    display: 0,
    script: 0,
  };

  for (const font of FONT_CATALOG) {
    assert.ok(font.category in counts, `Unknown category: ${font.category}`);
    counts[font.category]++;
  }

  assert.equal(counts.system, 10, 'Must have 10 system/PowerPoint safe fonts');
  assert.equal(counts.sans, 12, 'Must have 12 modern sans-serif fonts');
  assert.equal(counts.serif, 8, 'Must have 8 dignified serif fonts');
  assert.equal(counts.display, 8, 'Must have 8 bold display & title fonts');
  assert.equal(counts.script, 7, 'Must have 7 script & handwriting fonts');

  const categories = Object.keys(FONT_CATEGORY_LABELS);
  assert.deepEqual(
    categories.sort(),
    ['custom', 'display', 'sans', 'script', 'serif', 'system'],
    'Categories must match defined types'
  );
});

test('every font entry has valid family, label, category, fallback, and pptxSafe flags', () => {
  const safeFamilies = new Set(
    FONT_CATALOG.filter((f) => f.pptxSafe).map((f) => f.family)
  );

  for (const font of FONT_CATALOG) {
    assert.ok(typeof font.family === 'string' && font.family.trim().length > 0, 'Family required');
    assert.ok(typeof font.label === 'string' && font.label.trim().length > 0, 'Label required');
    assert.ok(['sans-serif', 'serif', 'cursive', 'monospace'].includes(font.fallback), `Valid fallback required: ${font.fallback}`);
    assert.ok(typeof font.pptxSafe === 'boolean', `pptxSafe boolean required on ${font.family}`);

    if (font.category === 'system') {
      assert.equal(font.pptxSafe, true, `System font ${font.family} must be pptxSafe: true`);
      assert.equal(font.pptxSubstitute, undefined, `Safe font ${font.family} does not need substitute`);
    } else {
      assert.equal(font.pptxSafe, false, `Non-system font ${font.family} must be pptxSafe: false`);
      assert.ok(
        typeof font.pptxSubstitute === 'string' && safeFamilies.has(font.pptxSubstitute),
        `Unsafe font ${font.family} must specify a pptxSubstitute that is a pptxSafe font, got ${font.pptxSubstitute}`
      );
    }
  }
});

test('getFontDefinition resolves case-insensitively and handles whitespace', () => {
  assert.equal(getFontDefinition('inter')?.family, 'Inter');
  assert.equal(getFontDefinition('  Montserrat  ')?.family, 'Montserrat');
  assert.equal(getFontDefinition('GREAT VIBES')?.family, 'Great Vibes');
  assert.equal(getFontDefinition('NonExistentFont'), undefined);
  assert.equal(getFontDefinition(undefined), undefined);
});

test('getFontStack returns appropriate CSS font stack', () => {
  assert.equal(getFontStack('Inter'), '"Inter", sans-serif');
  assert.equal(getFontStack('Playfair Display'), '"Playfair Display", serif');
  assert.equal(getFontStack('Pacifico'), '"Pacifico", cursive');
  assert.equal(getFontStack('UnknownFont'), '"UnknownFont", "Arial", sans-serif');
  assert.equal(getFontStack('The Youngest'), '"The Youngest", cursive, sans-serif');
  assert.equal(getFontStack('Custom Script MT'), '"Custom Script MT", cursive, sans-serif');
  assert.equal(getFontStack(undefined), '"Arial", sans-serif');
});

test('SPEC-33-01: isFontExportReady decouples system fonts and embeddable web fonts', () => {
  // System fonts are universally export-ready without font embedding
  const systemFonts = ['Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Verdana'];
  for (const f of systemFonts) {
    assert.equal(isFontExportReady(f), true, `System font ${f} must be export ready`);
  }

  // Curated Google Fonts are export-ready via TrueType embedding
  const googleFonts = ['Montserrat', 'Roboto', 'Inter', 'Lora', 'Playfair Display', 'Caveat'];
  for (const f of googleFonts) {
    assert.equal(isFontExportReady(f), true, `Curated Google Font ${f} must be export ready`);
  }

  // Unacquired custom fonts without catalog or font_faces registration are NOT export-ready
  assert.equal(isFontExportReady('The Youngest'), false, 'Unacquired font must not be export ready');
  assert.equal(isFontExportReady('NonExistentFont123'), false, 'Unknown font must not be export ready');
  assert.equal(isFontExportReady(undefined), true, 'Empty / undefined font defaults to safe');
});

test('DEFAULT_FONT_FAMILY is canonical Arial and deduplicated across modules', () => {
  assert.equal(DEFAULT_FONT_FAMILY, 'Arial');
  assert.equal(CANVAS_DEFAULT_FONT, 'Arial');
  assert.equal(RENDER_DEFAULT_FONT, 'Arial');

  // Absence guard: verify canvas-utils.ts and render-model.ts re-export rather than declaring literal
  const canvasUtilsSrc = fs.readFileSync(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts'), 'utf8');
  assert.ok(
    canvasUtilsSrc.includes("from '@/lib/registry/font-catalog'") && canvasUtilsSrc.includes('export { DEFAULT_FONT_FAMILY }'),
    'canvas-utils.ts must re-export DEFAULT_FONT_FAMILY from font-catalog'
  );
  assert.ok(
    !canvasUtilsSrc.includes("export const DEFAULT_FONT_FAMILY = 'Arial'"),
    'canvas-utils.ts must not declare hardcoded DEFAULT_FONT_FAMILY'
  );

  const renderModelSrc = fs.readFileSync(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts'), 'utf8');
  assert.ok(
    renderModelSrc.includes("from '@/lib/registry/font-catalog'") && renderModelSrc.includes('export { DEFAULT_FONT_FAMILY }'),
    'render-model.ts must re-export DEFAULT_FONT_FAMILY from font-catalog'
  );
  assert.ok(
    !renderModelSrc.includes("export const DEFAULT_FONT_FAMILY = 'Arial'"),
    'render-model.ts must not declare hardcoded DEFAULT_FONT_FAMILY'
  );
});

test('WSD-H-06: Google Fonts stylesheet URL builder and googleFont properties removed from font catalog', async () => {
  const fontCatalogModule = await import(srcUrl('lib', 'registry', 'font-catalog.ts'));
  assert.equal(fontCatalogModule.getGoogleFontsStylesheetUrl, undefined, 'getGoogleFontsStylesheetUrl must be deleted');

  for (const font of FONT_CATALOG) {
    assert.equal(font.googleFont, undefined, `Font ${font.family} must not have googleFont property`);
  }
});

test('WSD-H-06: spa/index.html and spa/projected.html do not embed Google Fonts CDN links', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'spa', 'index.html'), 'utf8');
  const projectedHtml = fs.readFileSync(path.join(root, 'spa', 'projected.html'), 'utf8');

  for (const [name, content] of [['index.html', indexHtml], ['projected.html', projectedHtml]]) {
    assert.ok(!content.includes('fonts.googleapis.com'), `${name} must NOT include fonts.googleapis.com`);
    assert.ok(!content.includes('fonts.gstatic.com'), `${name} must NOT include fonts.gstatic.com`);
  }
});
