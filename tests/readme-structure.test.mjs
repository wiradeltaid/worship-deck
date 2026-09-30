/**
 * SPEC-73: README structure and condensation guard (WSD-H-17)
 *
 * Enforces across all 10 README files (README.md and 9 README.<locale>.md translations):
 * 1. Line count is strictly under 100 lines (WDI Preset 1), normalizing terminal newlines.
 * 2. Section order: Installation MUST precede Features (readme-guideline.md §3).
 * 3. Both ## Installation and ## Features sections exist.
 * 4. Direct release links: v0.1.0 installer URL, SHA256SUMS URL, and all-releases index URL.
 * 5. SmartScreen guidance present near download links.
 * 6. Migration documents linked in README.md (customization.md, corpora.md, deployment.md, history.md).
 * 7. Real-file defect injection proofs for line-count, reversed section order, and missing release URLs.
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

export const CANONICAL_INSTALLER_URL = 'https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe';
export const CANONICAL_CHECKSUM_URL = 'https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS';
export const CANONICAL_RELEASES_URL = 'https://github.com/wiradeltaid/worship-deck/releases';

export const MIGRATION_DOCS = [
  'docs/customization.md',
  'docs/corpora.md',
  'docs/deployment.md',
  'docs/history.md',
];

export function auditReadmeStructure(readmeList = README_FILES, repoRoot = root) {
  const violations = [];

  for (const rel of readmeList) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) {
      violations.push(`${rel}: file does not exist`);
      continue;
    }

    const content = fs.readFileSync(full, 'utf8');
    // Normalize terminal newline to count physical lines accurately
    const normalized = content.replace(/\r\n/g, '\n').replace(/\n$/, '');
    const lines = normalized.split('\n');

    // 1. Line count check: strictly under 100 lines
    if (lines.length >= 100) {
      violations.push(`${rel}: line count ${lines.length} exceeds max limit of 99 lines (must be < 100 lines)`);
    }

    // 2. Section sequence check: Installation preceding Features
    let installIndex = -1;
    let featuresIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^##\s+(?:Installation|Pemasangan|Panduan\s+Instalasi|Instalasi|Instalación|Guide\s+d'Installation|Instalação|Установка|安装(?:指南)?|インストール(?:手順)?|설치(?:\s+안내)?)(?:\s|$)/i.test(line)) {
        if (installIndex === -1) installIndex = i;
      }
      if (/^##\s+(?:Features|Fitur(?:\s+Utama)?|Hauptfunktionen|Funktionen|Características(?:\s+Principales)?|Fonctionnalités(?:\s+Principales)?|Recursos(?:\s+Principais)?|Основные\s+возможности|Возможности|核心特性|功能|主な機能|機能|주요\s+기능|기능)(?:\s|$)/i.test(line)) {
        if (featuresIndex === -1) featuresIndex = i;
      }
    }

    if (installIndex === -1) {
      violations.push(`${rel}: missing Installation section heading`);
    }
    if (featuresIndex === -1) {
      violations.push(`${rel}: missing Features section heading`);
    }
    if (installIndex !== -1 && featuresIndex !== -1 && installIndex > featuresIndex) {
      violations.push(`${rel}: Installation (line ${installIndex + 1}) appears AFTER Features (line ${featuresIndex + 1}); Installation MUST precede Features`);
    }

    // 3. Release links: installer URL, checksum URL, and releases index URL
    if (!content.includes(CANONICAL_INSTALLER_URL)) {
      violations.push(`${rel}: missing direct v0.1.0 installer download link`);
    }
    if (!content.includes(CANONICAL_CHECKSUM_URL)) {
      violations.push(`${rel}: missing direct v0.1.0 SHA256SUMS checksum link`);
    }
    if (!content.includes(CANONICAL_RELEASES_URL)) {
      violations.push(`${rel}: missing GitHub releases index link`);
    }

    // 4. SmartScreen guidance near download links
    if (!/SmartScreen/i.test(content)) {
      violations.push(`${rel}: missing SmartScreen guidance near download links`);
    }

    // 5. In README.md: verify links to all 4 migration documents
    if (rel === 'README.md') {
      for (const doc of MIGRATION_DOCS) {
        if (!content.includes(doc)) {
          violations.push(`README.md: missing link to migrated document ${doc}`);
        }
        if (!fs.existsSync(path.join(repoRoot, doc))) {
          violations.push(`README.md: migrated target file ${doc} does not exist on disk`);
        }
      }
    }
  }

  return violations;
}

test('WSD-H-17: all 10 README files stay under 100 lines, place Installation before Features, and provide complete release links', () => {
  const violations = auditReadmeStructure(README_FILES, root);
  assert.deepEqual(
    violations,
    [],
    `README structure violations detected:\n${violations.join('\n')}`
  );
});

test('WSD-H-17: guard proof - over-length README is detected', () => {
  const target = path.join(root, 'README.md');
  const original = fs.readFileSync(target, 'utf8');

  try {
    const inflated = original + '\n' + Array.from({ length: 150 }, (_, i) => `<!-- extra line ${i} -->`).join('\n');
    fs.writeFileSync(target, inflated, 'utf8');

    const violations = auditReadmeStructure(['README.md'], root);
    assert.ok(
      violations.some((v) => v.includes('exceeds max limit')),
      `Expected max line violation on inflated README, got: ${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original, 'utf8');
  }
});

test('WSD-H-17: guard proof - reversed section order (Features before Installation) is detected', () => {
  const target = path.join(root, 'README.md');
  const original = fs.readFileSync(target, 'utf8');

  try {
    const reversed = `# WorshipDeck\n\n## Features\n\n- Feature 1\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n${CANONICAL_INSTALLER_URL}\n${CANONICAL_CHECKSUM_URL}\n${CANONICAL_RELEASES_URL}\nSmartScreen\ndocs/customization.md docs/corpora.md docs/deployment.md docs/history.md\n`;
    fs.writeFileSync(target, reversed, 'utf8');

    const violations = auditReadmeStructure(['README.md'], root);
    assert.ok(
      violations.some((v) => v.includes('Installation MUST precede Features')),
      `Expected section ordering violation on reversed README, got: ${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original, 'utf8');
  }
});

test('WSD-H-17: guard proof - missing release URL or SmartScreen guidance is detected', () => {
  const target = path.join(root, 'README.md');
  const original = fs.readFileSync(target, 'utf8');

  try {
    const stripped = original.replaceAll(CANONICAL_CHECKSUM_URL, 'https://example.invalid/checksums');
    fs.writeFileSync(target, stripped, 'utf8');

    const violations = auditReadmeStructure(['README.md'], root);
    assert.ok(
      violations.some((v) => v.includes('missing direct v0.1.0 SHA256SUMS checksum link')),
      `Expected checksum URL violation, got: ${violations.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original, 'utf8');
  }
});
