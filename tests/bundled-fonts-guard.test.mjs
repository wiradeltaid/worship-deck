/**
 * SPEC-73: Bundled fonts and Google CDN absence guard (WSD-H-06)
 *
 * Enforces:
 * 1. spa/*.html contains zero references to fonts.googleapis.com or fonts.gstatic.com
 * 2. src/lib/registry/font-catalog.ts contains zero references to fonts.googleapis.com or fonts.gstatic.com
 * 3. spa/src/fonts.css imports local bundled @fontsource packages for all 35 font families.
 * 4. Real-file defect injection proofs for HTML templates and font-catalog.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanGoogleFontCdnReferences() {
  const violations = [];
  const targets = [
    'spa/index.html',
    'spa/projected.html',
    'src/lib/registry/font-catalog.ts',
  ];

  const prohibited = ['fonts.googleapis.com', 'fonts.gstatic.com'];

  for (const rel of targets) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const p of prohibited) {
        if (lines[i].includes(p)) {
          violations.push(`${rel}:${i + 1}: contains prohibited Google font CDN reference "${p}"`);
        }
      }
    }
  }

  return violations;
}

test('WSD-H-06: zero Google font CDN references in spa/*.html and font-catalog.ts', () => {
  const violations = scanGoogleFontCdnReferences();
  assert.deepEqual(violations, [], `Found Google font CDN references:\n${violations.join('\n')}`);
});

test('WSD-H-06: guard proof — injected Google Fonts link in spa/index.html is detected', () => {
  const target = path.join(root, 'spa', 'index.html');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace(
      '</head>',
      '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />\n</head>'
    );
    assert.notEqual(mutated, original);
    fs.writeFileSync(target, mutated);
    const violations = scanGoogleFontCdnReferences();
    assert.ok(
      violations.some((v) => v.includes('spa/index.html') && v.includes('fonts.googleapis.com')),
      'Injected Google Fonts link in index.html must be caught'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-06: guard proof — injected Google Fonts link in spa/projected.html is detected', () => {
  const target = path.join(root, 'spa', 'projected.html');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace(
      '</head>',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" />\n</head>'
    );
    assert.notEqual(mutated, original);
    fs.writeFileSync(target, mutated);
    const violations = scanGoogleFontCdnReferences();
    assert.ok(
      violations.some((v) => v.includes('spa/projected.html') && v.includes('fonts.gstatic.com')),
      'Injected gstatic link in projected.html must be caught'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-06: guard proof — injected Google Font URL in src/lib/registry/font-catalog.ts is detected', () => {
  const target = path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original + '\n// Injected defect: https://fonts.googleapis.com/css2\n';
    fs.writeFileSync(target, mutated);
    const violations = scanGoogleFontCdnReferences();
    assert.ok(
      violations.some((v) => v.includes('src/lib/registry/font-catalog.ts') && v.includes('fonts.googleapis.com')),
      'Injected Google URL in font-catalog.ts must be caught'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-06: all 35 font families are bundled locally in spa/src/fonts.css', () => {
  const fontsCssPath = path.join(root, 'spa', 'src', 'fonts.css');
  assert.ok(fs.existsSync(fontsCssPath), 'spa/src/fonts.css must exist');
  const content = fs.readFileSync(fontsCssPath, 'utf8');

  const expectedFamilies = [
    'inter',
    'roboto',
    'open-sans',
    'lato',
    'montserrat',
    'poppins',
    'nunito',
    'raleway',
    'oswald',
    'barlow-condensed',
    'dm-sans',
    'work-sans',
    'merriweather',
    'playfair-display',
    'lora',
    'cinzel',
    'cormorant-garamond',
    'pt-serif',
    'eb-garamond',
    'baskervville',
    'bebas-neue',
    'anton',
    'league-spartan',
    'righteous',
    'teko',
    'abril-fatface',
    'alfa-slab-one',
    'russo-one',
    'great-vibes',
    'pacifico',
    'caveat',
    'dancing-script',
    'sacramento',
    'shadows-into-light',
    'satisfy',
  ];

  for (const family of expectedFamilies) {
    assert.ok(
      content.includes(`@fontsource/${family}`),
      `spa/src/fonts.css must import @fontsource/${family}`
    );
  }
});
