/**
 * SPEC-73: Third-party font notices verification (WSD-H-08)
 *
 * Enforces:
 * 1. THIRD-PARTY-NOTICES exists as a standalone file at the repository root.
 * 2. It covers all 41 font families from src/lib/registry/font-catalog.ts.
 * 3. It includes both SIL OFL 1.1 and Apache 2.0 license texts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const fontCatalogUrl = pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href;
const { FONT_CATALOG } = await import(fontCatalogUrl);

test('WSD-H-08: THIRD-PARTY-NOTICES exists as a standalone file at root', () => {
  const noticesPath = path.join(root, 'THIRD-PARTY-NOTICES');
  assert.ok(fs.existsSync(noticesPath), 'THIRD-PARTY-NOTICES must exist at repository root');
  const stat = fs.statSync(noticesPath);
  assert.ok(stat.size > 1000, `THIRD-PARTY-NOTICES must be a non-trivial license document, got ${stat.size} bytes`);
});

test('WSD-H-08 / SPEC-79: THIRD-PARTY-NOTICES covers all 41 typography font families', () => {
  const noticesPath = path.join(root, 'THIRD-PARTY-NOTICES');
  const content = fs.readFileSync(noticesPath, 'utf8');

  // Verify full OFL 1.1 and Apache 2.0 license texts are present
  assert.ok(content.includes('SIL OPEN FONT LICENSE Version 1.1'), 'OFL 1.1 text missing');
  assert.ok(content.includes('Apache License'), 'Apache 2.0 text missing');
  assert.ok(content.includes('Version 2.0, January 2004'), 'Apache 2.0 version text missing');

  // Non-system fonts (41)
  const nonSystemFonts = FONT_CATALOG.filter((f) => f.category !== 'system');
  assert.equal(nonSystemFonts.length, 41, 'Expected 41 non-system font families in catalog');

  const missing = [];
  for (const font of nonSystemFonts) {
    if (!content.includes(font.family)) {
      missing.push(font.family);
    }
  }

  assert.deepEqual(missing, [], `Missing font families in THIRD-PARTY-NOTICES:\n${missing.join(', ')}`);
});
