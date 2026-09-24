/**
 * SPEC-73: Branding SVGs without external font URLs absence guard (WSD-H-08)
 *
 * Enforces:
 * 1. Zero @import statements across all SVG files in public/ and spa/.
 * 2. Zero external font URLs (fonts.googleapis.com, fonts.gstatic.com) in all SVGs.
 * 3. Real-file defect injection proofs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(root, 'public'),
  path.join(root, 'spa'),
];

function listSvgFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        listSvgFiles(full, out);
      }
    } else if (entry.isFile() && entry.name.endsWith('.svg')) {
      out.push(full);
    }
  }
  return out;
}

export function scanSvgExternalFontImports() {
  const violations = [];
  const svgFiles = SCAN_DIRS.flatMap((d) => listSvgFiles(d));

  const prohibitedPatterns = [
    { pattern: /@import\s+url\s*\(/i, name: '@import url' },
    { pattern: /fonts\.googleapis\.com/i, name: 'fonts.googleapis.com' },
    { pattern: /fonts\.gstatic\.com/i, name: 'fonts.gstatic.com' },
  ];

  for (const file of svgFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const rel = path.relative(root, file).split(path.sep).join('/');

    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, name } of prohibitedPatterns) {
        if (pattern.test(lines[i])) {
          violations.push(`${rel}:${i + 1}: prohibited ${name} found in SVG`);
        }
      }
    }
  }

  return violations;
}

test('WSD-H-08: zero @import or external font URLs in public/ and spa/ SVGs', () => {
  const violations = scanSvgExternalFontImports();
  assert.deepEqual(violations, [], `Prohibited SVG font references found:\n${violations.join('\n')}`);
});

test('WSD-H-08: guard proof — injected @import in public/branding/worship-deck-mark.svg is detected', () => {
  const target = path.join(root, 'public', 'branding', 'worship-deck-mark.svg');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(
      target,
      original.replace('</svg>', '<style>@import url("https://fonts.googleapis.com/css2?family=Inter");</style></svg>')
    );
    const violations = scanSvgExternalFontImports();
    assert.ok(
      violations.some((v) => v.includes('worship-deck-mark.svg') && v.includes('@import url')),
      'Injected @import in mark SVG must be detected'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
