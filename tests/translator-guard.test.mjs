/**
 * Guard test against invalid excessive translator calls across src/ and spa/src/.
 *
 * SPEC-112 ratified `LocaleApi.t(key: I18nKey, params?: Record<string, string | number>)`.
 * Any call with more than two arguments (e.g. `t(key, params, extra)`) is invalid.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCAN_ROOTS = [path.join(ROOT, 'src'), path.join(ROOT, 'spa', 'src')];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function listTsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listTsFiles(full, out);
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      out.push(full);
    }
  }
  return out;
}

function relPosix(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join('/');
}

export function scanTranslatorCalls(source, rel) {
  const findings = [];
  const clean = stripComments(source);
  const startRegex = /\bt\(\s*(['"][^'"]+['"])\s*,/g;
  let match;

  while ((match = startRegex.exec(clean)) !== null) {
    const startIdx = match.index;
    const argsStart = match.index + match[0].length;
    let depthParen = 1;
    let depthBrace = 0;
    let depthBracket = 0;
    let inQuote = null;
    let topLevelCommas = 1;

    let i = argsStart;
    while (i < clean.length) {
      const ch = clean[i];
      if (inQuote) {
        if (ch === inQuote && clean[i - 1] !== '\\') inQuote = null;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inQuote = ch;
      } else if (ch === '(') {
        depthParen++;
      } else if (ch === ')') {
        depthParen--;
        if (depthParen === 0) break;
      } else if (ch === '{') {
        depthBrace++;
      } else if (ch === '}') {
        depthBrace--;
      } else if (ch === '[') {
        depthBracket++;
      } else if (ch === ']') {
        depthBracket--;
      } else if (ch === ',' && depthParen === 1 && depthBrace === 0 && depthBracket === 0) {
        topLevelCommas++;
      }
      i++;
    }

    if (topLevelCommas >= 2) {
      const lineNo = clean.slice(0, startIdx).split('\n').length;
      const lineStart = clean.lastIndexOf('\n', startIdx) + 1;
      let lineEnd = clean.indexOf('\n', startIdx);
      if (lineEnd === -1) lineEnd = clean.length;
      findings.push({
        rel,
        lineNo,
        line: clean.slice(lineStart, lineEnd).trim(),
      });
    }
  }
  return findings;
}

function scanFile(absPath) {
  return scanTranslatorCalls(readFileSync(absPath, 'utf8'), relPosix(absPath));
}

function allFindings() {
  const files = SCAN_ROOTS.flatMap((dir) => listTsFiles(dir));
  return files.flatMap(scanFile);
}

test('src/ and spa/src/ contain no excessive (>2) translator calls t(key, params, ...)', () => {
  const findings = allFindings();
  assert.deepEqual(
    findings,
    [],
    findings.length
      ? `Found excessive translator calls:\n${findings
          .map((f) => `  ${f.rel}:${f.lineNo} ${f.line}`)
          .join('\n')}`
      : undefined
  );
});

test('guard proof: excessive (>2) args in t() call is detected', () => {
  assert.deepEqual(
    scanTranslatorCalls("return t('form.preview.role.verse', { n: 1 }, 'extra');", 'src/lib/artifacts/preview-model.ts'),
    [
      {
        rel: 'src/lib/artifacts/preview-model.ts',
        lineNo: 1,
        line: "return t('form.preview.role.verse', { n: 1 }, 'extra');",
      },
    ]
  );
});

test('guard proof: wrapped multi-line t() call with excessive args is detected', () => {
  const wrappedCall = `const x = t('form.preview.role.verse',\n  { n: 1 },\n  'extra');`;
  assert.deepEqual(
    scanTranslatorCalls(wrappedCall, 'src/example.ts'),
    [
      {
        rel: 'src/example.ts',
        lineNo: 1,
        line: "const x = t('form.preview.role.verse',",
      },
    ]
  );
});
