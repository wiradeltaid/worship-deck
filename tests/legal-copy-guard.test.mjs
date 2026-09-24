/**
 * SPEC-73: Legal copy synchronization and absence guard (WSD-H-14)
 *
 * Enforces:
 * 1. PRIVACY.md, PRIVACY.id.md, SECURITY.md, and SECURITY.id.md contain the English copy stamp on line 2.
 * 2. Zero occurrences of "Worship Presenter", "<TANGGAL GO-LIVE>", "<GO-LIVE DATE>", U+2014, or U+2013
 *    across all four legal files and docs/threat-model.md.
 * 3. All internal relative document links in the four legal files and threat model resolve to existing files.
 * 4. Real-file defect injection proofs for stamps, placeholders, legacy names, and dashes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const LEGAL_FILES = [
  { file: 'PRIVACY.md', source: 'privacy.en.md' },
  { file: 'PRIVACY.id.md', source: 'privacy.id.md' },
  { file: 'SECURITY.md', source: 'security.en.md' },
  { file: 'SECURITY.id.md', source: 'security.id.md' },
];

export const ALL_VERIFIED_FILES = [
  ...LEGAL_FILES.map((l) => l.file),
  'docs/threat-model.md',
];

export function checkCopyStamps(repoRoot = root) {
  const violations = [];
  for (const { file, source } of LEGAL_FILES) {
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) {
      violations.push(`${file} does not exist`);
      continue;
    }
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    const line2 = lines[1] || '';
    const expectedPrefix = `<!-- Copied from the Wira Delta Indonesia legal source (worship-deck/${source})`;
    if (!line2.startsWith(expectedPrefix)) {
      violations.push(`${file}: line 2 missing required copy stamp starting with "${expectedPrefix}", got: "${line2}"`);
    }
  }
  return violations;
}

export function scanLegalDefects(files = ALL_VERIFIED_FILES, repoRoot = root) {
  const violations = [];
  const prohibited = [
    { pattern: /Worship Presenter/i, name: 'Worship Presenter' },
    { pattern: /<TANGGAL GO-LIVE>/, name: '<TANGGAL GO-LIVE>' },
    { pattern: /<GO-LIVE DATE>/, name: '<GO-LIVE DATE>' },
    { pattern: /—/, name: 'em-dash (U+2014)' },
    { pattern: /–/, name: 'en-dash (U+2013)' },
  ];

  for (const rel of files) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) {
      violations.push(`${rel} does not exist`);
      continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, name } of prohibited) {
        if (pattern.test(line)) {
          violations.push(`${rel}:${i + 1} contains prohibited pattern "${name}": ${line.trim()}`);
        }
      }
    }
  }
  return violations;
}

export function checkRelativeLinks(files = ALL_VERIFIED_FILES, repoRoot = root) {
  const violations = [];
  for (const rel of files) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const docDir = path.dirname(full);
    const links = [...content.matchAll(/\[.*?\]\((?!http|mailto)(.*?)\)/g)].map((m) => m[1]);

    for (const link of links) {
      const cleanLink = link.split('#')[0];
      if (!cleanLink) continue;
      const targetPath = path.resolve(docDir, cleanLink);
      if (!fs.existsSync(targetPath)) {
        violations.push(`${rel}: link "${link}" resolves to non-existent path ${targetPath}`);
      }
    }
  }
  return violations;
}

test('WSD-H-14: all four legal files contain the English copy stamp on line 2', () => {
  const violations = checkCopyStamps(root);
  assert.deepEqual(violations, [], `Copy stamp violations:\n${violations.join('\n')}`);
});

test('WSD-H-14: zero legacy names, date placeholders, or em/en dashes across legal files and threat model', () => {
  const violations = scanLegalDefects(ALL_VERIFIED_FILES, root);
  assert.deepEqual(violations, [], `Legal copy defects:\n${violations.join('\n')}`);
});

test('WSD-H-14: all internal relative document links resolve to existing files', () => {
  const violations = checkRelativeLinks(ALL_VERIFIED_FILES, root);
  assert.deepEqual(violations, [], `Broken relative links in legal files:\n${violations.join('\n')}`);
});

test('WSD-H-14: guard proof — injected missing copy stamp in PRIVACY.md is detected', () => {
  const target = path.join(root, 'PRIVACY.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace(/<!-- Copied from.*?-->\n\n/s, '');
    fs.writeFileSync(target, mutated);
    const violations = checkCopyStamps(root);
    assert.ok(
      violations.some((v) => v.includes('PRIVACY.md') && v.includes('missing required copy stamp')),
      `Injected missing copy stamp in PRIVACY.md must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-14: guard proof — injected <GO-LIVE DATE> in SECURITY.md is detected', () => {
  const target = path.join(root, 'SECURITY.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace('September 24, 2026', '<GO-LIVE DATE>');
    fs.writeFileSync(target, mutated);
    const violations = scanLegalDefects(['SECURITY.md'], root);
    assert.ok(
      violations.some((v) => v.includes('<GO-LIVE DATE>')),
      `Injected <GO-LIVE DATE> must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-14: guard proof — injected Worship Presenter in SECURITY.id.md is detected', () => {
  const target = path.join(root, 'SECURITY.id.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace('WorshipDeck', 'Worship Presenter Web');
    fs.writeFileSync(target, mutated);
    const violations = scanLegalDefects(['SECURITY.id.md'], root);
    assert.ok(
      violations.some((v) => v.includes('Worship Presenter')),
      `Injected Worship Presenter must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-14: guard proof — injected em-dash in docs/threat-model.md is detected', () => {
  const target = path.join(root, 'docs', 'threat-model.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original + '\nInjected — em dash in threat model\n';
    fs.writeFileSync(target, mutated);
    const violations = scanLegalDefects(['docs/threat-model.md'], root);
    assert.ok(
      violations.some((v) => v.includes('em-dash')),
      `Injected em-dash in threat model must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
