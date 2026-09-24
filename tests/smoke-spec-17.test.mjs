import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('SPEC-17-01: Font catalog module structure verified', () => {
  const fontCatalogPath = path.resolve('src/lib/registry/font-catalog.ts');
  const fontCatalogContent = fs.readFileSync(fontCatalogPath, 'utf8');

  assert.ok(fontCatalogContent.includes('export const FONT_CATALOG: FontDefinition[] = ['), 'FONT_CATALOG missing');
  assert.ok(fontCatalogContent.includes("export const DEFAULT_FONT_FAMILY = 'Arial';"), 'DEFAULT_FONT_FAMILY missing');
  assert.ok(!fontCatalogContent.includes('getGoogleFontsStylesheetUrl'), 'getGoogleFontsStylesheetUrl must be deleted');
});

test('WSD-H-06: HTML templates do NOT include Google Fonts stylesheet links (offline bundled)', () => {
  const indexHtml = fs.readFileSync(path.resolve('spa/index.html'), 'utf8');
  const projectedHtml = fs.readFileSync(path.resolve('spa/projected.html'), 'utf8');

  for (const [name, content] of [['index.html', indexHtml], ['projected.html', projectedHtml]]) {
    assert.ok(!content.includes('fonts.googleapis.com'), `${name} must not contain fonts.googleapis.com`);
    assert.ok(!content.includes('fonts.gstatic.com'), `${name} must not contain fonts.gstatic.com`);
  }
});

test('SPEC-17-02: Two-row properties toolbar locked at 88px fixed height with font selector', () => {
  const editorPath = path.resolve('src/components/admin/ArtifactEditor.tsx');
  const editorContent = fs.readFileSync(editorPath, 'utf8');

  assert.ok(
    editorContent.includes('h-[88px] min-h-[88px] max-h-[88px]'),
    'Toolbar missing fixed h-[88px] min-h-[88px] max-h-[88px]'
  );
  assert.ok(
    !editorContent.includes('h-11 min-h-[44px] max-h-[44px]'),
    'Toolbar still carries old 44px container'
  );
  assert.ok(
    editorContent.includes('handleFontFamilyChange'),
    'ArtifactEditor missing handleFontFamilyChange'
  );
});

test('SPEC-17-03: PPTX fontFace and Web Slide getFontStack synchronized', () => {
  const pptxDrawContent = fs.readFileSync(path.resolve('src/lib/pptx-draw.ts'), 'utf8');
  const artifactSlideContent = fs.readFileSync(path.resolve('src/components/artifacts/ArtifactSlide.tsx'), 'utf8');

  assert.ok(
    pptxDrawContent.includes('fontFace: resolveFontFamily(style)'),
    'pptx-draw.ts missing fontFace: resolveFontFamily(style)'
  );
  assert.ok(
    artifactSlideContent.includes('fontFamily: getFontStack(style.fontFamily)'),
    'ArtifactSlide.tsx missing fontFamily: getFontStack(style.fontFamily)'
  );
});
