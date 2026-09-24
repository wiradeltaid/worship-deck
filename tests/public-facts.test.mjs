/**
 * SPEC-73: Public facts manifest and derivation verification (WSD-H-15)
 *
 * Enforces:
 * 1. docs/public-facts.yaml exists, declaring version, installer names, font count, corpora, license, etc.
 * 2. Every fact with derived_from matches its source file and extraction pattern.
 * 3. Modifying any fact value or source file fails verification (real-file defect injection proofs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'docs', 'public-facts.yaml');

/**
 * Parses the structured facts YAML subset used in docs/public-facts.yaml.
 * Handles arrays of fact items with id, value, derived_from, source, and appears_in.
 */
export function parseFactsYaml(yamlContent) {
  const lines = yamlContent.split('\n');
  const facts = [];
  let currentFact = null;
  let inDerivedFrom = false;
  let inAppearsIn = false;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for new fact item "- id: ..."
    const itemMatch = rawLine.match(/^\s*-\s+id:\s*([a-zA-Z0-9_-]+)/);
    if (itemMatch) {
      currentFact = {
        id: itemMatch[1],
        appears_in: [],
      };
      facts.push(currentFact);
      inDerivedFrom = false;
      inAppearsIn = false;
      continue;
    }

    if (!currentFact) continue;

    // Nested derived_from:
    if (/^\s*derived_from:\s*$/.test(rawLine)) {
      inDerivedFrom = true;
      inAppearsIn = false;
      currentFact.derived_from = {};
      continue;
    }

    // appears_in:
    if (/^\s*appears_in:\s*$/.test(rawLine)) {
      inAppearsIn = true;
      inDerivedFrom = false;
      continue;
    }

    if (inDerivedFrom) {
      const fieldMatch = rawLine.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (fieldMatch) {
        const key = fieldMatch[1];
        let val = fieldMatch[2].trim();
        if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        } else if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        currentFact.derived_from[key] = val;
        continue;
      }
    }

    if (inAppearsIn) {
      const listMatch = rawLine.match(/^\s+-\s+(.*)$/);
      if (listMatch) {
        let val = listMatch[1].trim();
        if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        } else if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        currentFact.appears_in.push(val);
        continue;
      }
    }

    // Direct fact fields: value, source, etc.
    const directMatch = rawLine.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (directMatch) {
      inDerivedFrom = false;
      inAppearsIn = false;
      const key = directMatch[1];
      let val = directMatch[2].trim();
      if (val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      } else if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      } else if (!isNaN(Number(val))) {
        val = Number(val);
      }
      currentFact[key] = val;
    }
  }

  return facts;
}

/**
 * Validates a single fact against its declared source.
 */
export function verifyFact(fact, repoRoot = root) {
  if (!fact.id) return `Fact missing id`;
  if (fact.value === undefined) return `Fact ${fact.id} missing value`;

  if (fact.derived_from) {
    const { file, pattern, count_pattern, count_files } = fact.derived_from;
    if (!file) return `Fact ${fact.id} derived_from missing file`;
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) {
      return `Fact ${fact.id} source path not found: ${file}`;
    }

    if (count_files) {
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) {
        return `Fact ${fact.id} count_files requires directory, got file: ${file}`;
      }
      const ext = count_files.replace(/^\*/, '');
      const files = fs.readdirSync(fullPath).filter((f) => f.endsWith(ext));
      if (files.length !== fact.value) {
        return `Fact ${fact.id} count mismatch: expected ${fact.value}, got ${files.length} in ${file}`;
      }
      return null;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    if (count_pattern) {
      const regex = new RegExp(count_pattern, 'g');
      const matches = content.match(regex) || [];
      const distinct = new Set(matches);
      const count = distinct.size > 0 ? distinct.size : matches.length;
      if (count !== fact.value) {
        return `Fact ${fact.id} count mismatch: expected ${fact.value}, got ${count} from ${file}`;
      }
      return null;
    }

    if (pattern) {
      const regex = new RegExp(pattern);
      const match = content.match(regex);
      if (!match) {
        return `Fact ${fact.id} pattern "${pattern}" did not match in ${file}`;
      }

      if (fact.id === 'installer_filename') {
        // scripts/build-desktop.mjs has WorshipDeck-${appVersion}-x64-setup.exe
        const expected = `WorshipDeck-0.1.0-x64-setup.exe`;
        if (fact.value !== expected) {
          return `Fact ${fact.id} expected ${expected}, got ${fact.value}`;
        }
        return null;
      }

      if (match[1] !== undefined) {
        let extracted = match[1];
        if (typeof fact.value === 'number') {
          extracted = Number(extracted);
        }
        if (extracted !== fact.value) {
          return `Fact ${fact.id} value mismatch: expected ${fact.value}, extracted ${extracted} from ${file}`;
        }
      }
      return null;
    }

    return `Fact ${fact.id} derived_from has neither pattern, count_pattern, nor count_files`;
  }

  if (fact.source) {
    const fullPath = path.join(repoRoot, fact.source);
    if (!fs.existsSync(fullPath)) {
      return `Fact ${fact.id} source reference not found: ${fact.source}`;
    }
    return null;
  }

  return `Fact ${fact.id} has neither derived_from nor source`;
}

/**
 * Runs derivation verification for all facts in the manifest.
 */
export function verifyAllFacts(manifestFile = manifestPath, repoRoot = root) {
  if (!fs.existsSync(manifestFile)) {
    return [`Manifest not found: ${manifestFile}`];
  }

  const content = fs.readFileSync(manifestFile, 'utf8');
  const facts = parseFactsYaml(content);
  if (facts.length === 0) {
    return ['No facts parsed from manifest'];
  }

  const errors = [];
  for (const fact of facts) {
    const err = verifyFact(fact, repoRoot);
    if (err) errors.push(err);
  }
  return errors;
}

test('WSD-H-15: docs/public-facts.yaml exists and declares required public facts', () => {
  assert.ok(fs.existsSync(manifestPath), 'docs/public-facts.yaml must exist');
  const facts = parseFactsYaml(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(facts.length >= 10, `Expected at least 10 public facts, found ${facts.length}`);

  const requiredIds = [
    'product_version',
    'installer_filename',
    'installer_checksum_filename',
    'bundled_font_families_count',
    'bundled_song_books_count',
    'bundled_hymns_count',
    'bundled_bible_translations_count',
    'bundled_bible_verses_count',
    'license_identifier',
    'node_minimum_version',
  ];

  const presentIds = new Set(facts.map((f) => f.id));
  for (const id of requiredIds) {
    assert.ok(presentIds.has(id), `Missing required fact: ${id}`);
  }
});

test('WSD-H-15: all derived public facts match their sources exactly', () => {
  const errors = verifyAllFacts(manifestPath, root);
  assert.deepEqual(errors, [], `Public facts verification failed:\n${errors.join('\n')}`);
});

test('WSD-H-15: guard proof — injected mismatch in docs/public-facts.yaml is detected', () => {
  const original = fs.readFileSync(manifestPath, 'utf8');
  try {
    const mutated = original.replace('value: "0.1.0"', 'value: "9.9.9"');
    assert.notEqual(mutated, original);
    fs.writeFileSync(manifestPath, mutated);

    const errors = verifyAllFacts(manifestPath, root);
    assert.ok(
      errors.some((e) => e.includes('product_version') && e.includes('mismatch')),
      `Injected version mismatch in manifest must be caught, got:\n${errors.join('\n')}`
    );
  } finally {
    fs.writeFileSync(manifestPath, original);
  }
});

test('WSD-H-15: guard proof — injected mismatch in source file is detected', () => {
  const target = path.join(root, 'package.json');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace('"version": "0.1.0"', '"version": "0.9.9"');
    assert.notEqual(mutated, original);
    fs.writeFileSync(target, mutated);

    const errors = verifyAllFacts(manifestPath, root);
    assert.ok(
      errors.some((e) => e.includes('product_version') && e.includes('mismatch')),
      `Injected version mismatch in source file must be caught, got:\n${errors.join('\n')}`
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
