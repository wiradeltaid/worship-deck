/**
 * SPEC-73: CHANGELOG 0.1.0 clean extraction and absence guard (WSD-H-10)
 *
 * Enforces:
 * 1. release.yml extraction logic extracts section ## [0.1.0] cleanly without errors.
 * 2. Section [0.1.0] contains zero internal IDs (DEC-, SPEC-, FR-, ODR-).
 * 3. Section [0.1.0] contains zero em-dashes (U+2014) or en-dashes (U+2013).
 * 4. Section [0.1.0] contains none of the prohibited terms: template, parser profile, webhook, projector, updater.
 * 5. Preamble does not reference in-app updaters.
 * 6. Real-file defect injection proofs for internal IDs, prohibited terms, and dashes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const changelogPath = path.join(root, 'CHANGELOG.md');

/**
 * Extracts a release section replicating the exact logic of .github/workflows/release.yml lines 37-59.
 */
export function extractChangelogSection(content, version = '0.1.0') {
  const lines = content.split(/\r?\n/);
  let start = -1;
  const versionRegex = new RegExp(`^##\\s+\\[${version.replace(/\./g, '\\.')}\\]`);

  for (let i = 0; i < lines.length; i++) {
    if (versionRegex.test(lines[i])) {
      start = i;
      break;
    }
  }

  if (start < 0) {
    throw new Error(`CHANGELOG.md has no '## [${version}]' section.`);
  }

  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    body.push(lines[i]);
  }

  const text = body.join('\n').trim();
  if (!text) {
    throw new Error(`CHANGELOG.md section '## [${version}]' is empty.`);
  }
  return text;
}

export function scanChangelogDefects(content = fs.readFileSync(changelogPath, 'utf8')) {
  const violations = [];
  const section = extractChangelogSection(content, '0.1.0');

  const prohibitedRules = [
    { name: 'internal-id-dec', pattern: /\bDEC-\d+\b/i, desc: 'Internal decision identifier (DEC-)' },
    { name: 'internal-id-spec', pattern: /\bSPEC-\d+\b/i, desc: 'Internal spec identifier (SPEC-)' },
    { name: 'internal-id-fr', pattern: /\bFR-\d+\b/i, desc: 'Internal requirement identifier (FR-)' },
    { name: 'internal-id-odr', pattern: /\bODR-\d+\b/i, desc: 'Internal requirement identifier (ODR-)' },
    { name: 'template', pattern: /\btemplates?\b/i, desc: 'Prohibited term "template" (must be layout)' },
    { name: 'parser-profile', pattern: /\bparser\s+profiles?\b/i, desc: 'Prohibited term "parser profile"' },
    { name: 'webhook', pattern: /\bwebhooks?\b/i, desc: 'Prohibited term "webhook" (disabled in 0.1.0)' },
    { name: 'projector', pattern: /\bprojectors?\b/i, desc: 'Prohibited term "projector" (must be congregation screen)' },
    { name: 'updater', pattern: /\bupdaters?\b/i, desc: 'Prohibited term "updater"' },
    { name: 'em-dash', pattern: /—/, desc: 'Em-dash character (U+2014)' },
    { name: 'en-dash', pattern: /–/, desc: 'En-dash character (U+2013)' },
  ];

  const lines = section.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of prohibitedRules) {
      if (rule.pattern.test(line)) {
        violations.push(`Section [0.1.0] line ${i + 1} [${rule.name}]: ${line.trim()} (${rule.desc})`);
      }
    }
  }

  // Check preamble for in-app updater
  const preamble = content.split('## [0.1.0]')[0] || '';
  if (/in-app\s+updater/i.test(preamble) || /\bupdater\b/i.test(preamble)) {
    violations.push(`Preamble contains prohibited reference to in-app updater`);
  }

  return violations;
}

test('WSD-H-10: release.yml extraction logic cleanly extracts [0.1.0] section', () => {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const section = extractChangelogSection(content, '0.1.0');
  assert.ok(section.length > 200, `Extracted section too short (${section.length} chars)`);
  assert.ok(section.includes('### Added'), 'Section missing ### Added');
  assert.ok(section.includes('### Boundaries and Limitations'), 'Section missing Boundaries and Limitations');
});

test('WSD-H-10: [0.1.0] section contains zero internal IDs, prohibited terms, or em/en dashes', () => {
  const violations = scanChangelogDefects();
  assert.deepEqual(violations, [], `Changelog defects found:\n${violations.join('\n')}`);
});

test('WSD-H-10: guard proof — injected DEC-004 in CHANGELOG.md is detected', () => {
  const original = fs.readFileSync(changelogPath, 'utf8');
  try {
    const mutated = original.replace('### Added', '### Added\n- Injected internal DEC-004 defect');
    fs.writeFileSync(changelogPath, mutated);
    const violations = scanChangelogDefects(mutated);
    assert.ok(
      violations.some((v) => v.includes('[internal-id-dec]')),
      `Injected DEC-004 must be caught, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(changelogPath, original);
  }
});

test('WSD-H-10: guard proof — injected template in CHANGELOG.md is detected', () => {
  const original = fs.readFileSync(changelogPath, 'utf8');
  try {
    const mutated = original.replace('### Added', '### Added\n- Injected template defect');
    fs.writeFileSync(changelogPath, mutated);
    const violations = scanChangelogDefects(mutated);
    assert.ok(
      violations.some((v) => v.includes('[template]')),
      `Injected template must be caught, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(changelogPath, original);
  }
});

test('WSD-H-10: guard proof — injected em-dash in CHANGELOG.md is detected', () => {
  const original = fs.readFileSync(changelogPath, 'utf8');
  try {
    const mutated = original.replace('### Added', '### Added\n- Injected — em-dash defect');
    fs.writeFileSync(changelogPath, mutated);
    const violations = scanChangelogDefects(mutated);
    assert.ok(
      violations.some((v) => v.includes('[em-dash]')),
      `Injected em-dash must be caught, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(changelogPath, original);
  }
});

test('WSD-H-10: guard proof — injected webhook in CHANGELOG.md is detected', () => {
  const original = fs.readFileSync(changelogPath, 'utf8');
  try {
    const mutated = original.replace('### Added', '### Added\n- Injected webhook endpoint defect');
    fs.writeFileSync(changelogPath, mutated);
    const violations = scanChangelogDefects(mutated);
    assert.ok(
      violations.some((v) => v.includes('[webhook]')),
      `Injected webhook must be caught, got:\n${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(changelogPath, original);
  }
});
