/**
 * Structural guard for package.json scripts and test registrations.
 *
 * Catches:
 * 1. Duplicate JSON keys in package.json (which standard JSON.parse silently overwrites).
 * 2. Nonexistent test file paths referenced in package.json scripts.
 * 3. Proves defect injection: asserts the scanners fail when duplicate keys or missing test files are introduced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(root, 'package.json');

/**
 * Scan raw JSON text for duplicate keys at any object depth.
 * Returns array of { key: string, line: number, depth: number }.
 */
export function scanDuplicateJsonKeys(jsonText) {
  const duplicates = [];
  const stack = [];
  let i = 0;
  let line = 1;
  let inString = false;
  let escape = false;
  let currentString = '';
  let lastString = null;
  let stringStartLine = 1;

  while (i < jsonText.length) {
    const ch = jsonText[i];
    if (ch === '\n') {
      line++;
    }

    if (inString) {
      if (escape) {
        currentString += ch;
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
        lastString = currentString;
      } else {
        currentString += ch;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      escape = false;
      currentString = '';
      stringStartLine = line;
    } else if (ch === '{') {
      stack.push(new Set());
    } else if (ch === '}') {
      stack.pop();
      lastString = null;
    } else if (ch === ':') {
      if (lastString !== null && stack.length > 0) {
        const currentObj = stack[stack.length - 1];
        if (currentObj.has(lastString)) {
          duplicates.push({ key: lastString, line: stringStartLine, depth: stack.length });
        } else {
          currentObj.add(lastString);
        }
      }
      lastString = null;
    } else if (ch === ',' || ch === '[') {
      lastString = null;
    }
    i++;
  }
  return duplicates;
}

/**
 * Scan package.json scripts for test file paths that do not exist on disk.
 * Returns array of { scriptName: string, testPath: string }.
 */
export function scanMissingTestPaths(packageJsonText, projectRoot) {
  const missing = [];
  const pkg = JSON.parse(packageJsonText);
  if (!pkg.scripts || typeof pkg.scripts !== 'object') return missing;

  for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
    if (typeof scriptCmd !== 'string') continue;
    const matches = scriptCmd.matchAll(/tests\/[a-zA-Z0-9_\-\.]+\.(?:mjs|js|ts)/g);
    for (const m of matches) {
      const testRel = m[0];
      const absPath = path.join(projectRoot, testRel);
      if (!fs.existsSync(absPath)) {
        missing.push({ scriptName, testPath: testRel });
      }
    }
  }
  return missing;
}

test('package.json has zero duplicate JSON keys', () => {
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const duplicates = scanDuplicateJsonKeys(content);
  assert.deepEqual(
    duplicates,
    [],
    `package.json must not have duplicate keys: ${JSON.stringify(duplicates)}`
  );
});

test('package.json scripts reference only existing test files', () => {
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const missing = scanMissingTestPaths(content, root);
  assert.deepEqual(
    missing,
    [],
    `package.json scripts must not reference nonexistent test paths: ${JSON.stringify(missing)}`
  );
});

test('guard proof: scanDuplicateJsonKeys detects duplicate keys', () => {
  const withDup = '{\n  "scripts": {\n    "test": "node test",\n    "test": "node test2"\n  }\n}';
  const dups = scanDuplicateJsonKeys(withDup);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].key, 'test');
  assert.equal(dups[0].line, 4);

  const nestedDup = '{\n  "a": 1,\n  "sub": {\n    "k": 10,\n    "k": 20\n  }\n}';
  const nestedDups = scanDuplicateJsonKeys(nestedDup);
  assert.equal(nestedDups.length, 1);
  assert.equal(nestedDups[0].key, 'k');
});

test('guard proof: scanMissingTestPaths detects nonexistent test references', () => {
  const fakePkg = JSON.stringify({
    scripts: {
      'smoke:fake': 'node --test tests/nonexistent-fixture-xyz-123.test.mjs',
    },
  });
  const missing = scanMissingTestPaths(fakePkg, root);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].scriptName, 'smoke:fake');
  assert.equal(missing[0].testPath, 'tests/nonexistent-fixture-xyz-123.test.mjs');
});
