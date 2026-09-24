/**
 * SPEC-73: README claims and documentation harmonization guard (WSD-H-13)
 *
 * Enforces:
 * 1. README.md, all 9 README.<locale>.md translations, and docs/*.md contain zero occurrences of:
 *    - WorshipDeckSetup (legacy unversioned installer)
 *    - portable.zip (non-existent portable ZIP bundle)
 *    - (Recommended) describing the Windows desktop installer (installer is experimental)
 *    - "38 ... templates" (clean install starts with clean registry; 38 are optional demo layouts)
 *    - "parser profile" (dynamic regex on predefined fields instead of retired parser profiles)
 *    - U+2014 (em-dash '—')
 *    - U+2013 (en-dash '–')
 * 2. All relative document links in README.md resolve to real files on disk.
 * 3. Real-file defect injection proofs for claims and character violations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const README_FILES = [
  'README.md',
  'README.de.md',
  'README.es.md',
  'README.fr.md',
  'README.id.md',
  'README.ja.md',
  'README.ko.md',
  'README.pt-BR.md',
  'README.ru.md',
  'README.zh-CN.md',
];

export const DOCS_FILES = [
  'docs/getting-started.md',
  'docs/configuration.md',
  'docs/features.md',
  'docs/overview.md',
  'docs/contributing.md',
  'docs/operator-privacy-template.md',
  'docs/threat-model.md',
];

export const ALL_TARGET_FILES = [...README_FILES, ...DOCS_FILES];

export const PROHIBITED_RULES = [
  {
    name: 'WorshipDeckSetup',
    pattern: /\bWorshipDeckSetup\b/,
    description: 'Legacy unversioned installer name',
  },
  {
    name: 'portable.zip',
    pattern: /portable\.zip/i,
    description: 'Non-existent portable zip distribution',
  },
  {
    name: 'installer-recommended',
    pattern: /(?:installer|desktop).*\(recommended\)|(?:\(recommended\).*desktop)/i,
    description: 'Windows desktop installer described as Recommended',
  },
  {
    name: '38-templates-claim',
    pattern: /38\s+(?:editable\s+)?(?:slide\s+)?(?:default\s+)?(?:integrated\s+)?templates?/i,
    description: 'Claim of 38 pre-seeded templates (must be optional sample layouts)',
  },
  {
    name: 'parser-profile',
    pattern: /parser\s+profile/i,
    description: 'Retired parser profile terminology',
  },
  {
    name: 'em-dash',
    pattern: /—/,
    description: 'Em-dash character (U+2014)',
  },
  {
    name: 'en-dash',
    pattern: /–/,
    description: 'En-dash character (U+2013)',
  },
];

export function scanReadmeClaims(fileList = ALL_TARGET_FILES, repoRoot = root) {
  const violations = [];

  for (const rel of fileList) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) {
      violations.push(`${rel}: file does not exist`);
      continue;
    }

    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;

      for (const rule of PROHIBITED_RULES) {
        if (rule.pattern.test(line)) {
          violations.push(
            `${rel}:${lineNo} [${rule.name}] (${rule.description}): ${line.trim()}`
          );
        }
      }
    }
  }

  return violations;
}

test('WSD-H-13: all 10 README*.md files and docs/*.md contain zero prohibited legacy claims or em/en dashes', () => {
  const violations = scanReadmeClaims(ALL_TARGET_FILES, root);
  assert.deepEqual(
    violations,
    [],
    `Found prohibited claims or characters in documentation:\n${violations.join('\n')}`
  );
});

test('WSD-H-13: all relative document links in README.md resolve to existing files on disk', () => {
  const readmePath = path.join(root, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf8');
  const relativeLinks = [...content.matchAll(/\[.*?\]\((?!http)(.*?)\)/g)].map((m) => m[1]);

  const missing = [];
  for (const rel of relativeLinks) {
    // Strip optional anchors
    const cleanRel = rel.split('#')[0];
    if (!cleanRel) continue;
    const targetPath = path.join(root, cleanRel);
    if (!fs.existsSync(targetPath)) {
      missing.push(`README.md link to ${rel} resolves to missing path ${targetPath}`);
    }
  }

  assert.deepEqual(missing, [], `Broken relative links in README.md:\n${missing.join('\n')}`);
});

test('WSD-H-13: guard proof — injected WorshipDeckSetup in README.md is detected', () => {
  const target = path.join(root, 'README.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\nDownload WorshipDeckSetup.exe\n');
    const violations = scanReadmeClaims(['README.md'], root);
    assert.ok(
      violations.some((v) => v.includes('[WorshipDeckSetup]')),
      `Injected WorshipDeckSetup must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-13: guard proof — injected portable.zip in docs/getting-started.md is detected', () => {
  const target = path.join(root, 'docs', 'getting-started.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\nDownload worship-deck-portable.zip\n');
    const violations = scanReadmeClaims(['docs/getting-started.md'], root);
    assert.ok(
      violations.some((v) => v.includes('[portable.zip]')),
      `Injected portable.zip must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-13: guard proof — injected em-dash in README.id.md is detected', () => {
  const target = path.join(root, 'README.id.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\nInjected — em dash\n');
    const violations = scanReadmeClaims(['README.id.md'], root);
    assert.ok(
      violations.some((v) => v.includes('[em-dash]')),
      `Injected em-dash must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-13: guard proof — injected parser profile in docs/features.md is detected', () => {
  const target = path.join(root, 'docs', 'features.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\nConfigure a parser profile here\n');
    const violations = scanReadmeClaims(['docs/features.md'], root);
    assert.ok(
      violations.some((v) => v.includes('[parser-profile]')),
      `Injected parser profile must be detected, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
