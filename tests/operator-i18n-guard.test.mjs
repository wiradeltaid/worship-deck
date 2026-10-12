/**
 * Guard test against i18n usage defects across the operator tree:
 * 1. `const t = useT()` instead of `const { t } = useT()` (useT returns LocaleApi { locale, t })
 * 2. `t('key', ...)` called with multiple arguments (t takes only key: I18nKey)
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SCAN_ROOTS = [
  path.join(ROOT, 'src', 'operator'),
  path.join(ROOT, 'src', 'components'),
  path.join(ROOT, 'spa', 'src', 'pages'),
];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function listTsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listTsxFiles(full, out);
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

export function scanI18nUsage(source, rel) {
  const findings = [];
  const clean = stripComments(source);
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Defect 1: const t = useT() (not destructured)
    if (/\bconst\s+t\s*=\s*useT\s*\(\s*\)/.test(line)) {
      findings.push({
        rel,
        lineNo,
        kind: 'undestructured-useT',
        line: line.trim(),
      });
    }

    // Defect 2: t('...', ...) called with 3 or more arguments (t takes key: I18nKey, params?: Record<string, string | number>)
    const tMatch = /\bt\(\s*['"][^'"]+['"]\s*,/.exec(line);
    if (tMatch) {
      const argsStart = tMatch.index + tMatch[0].length;
      let depthParen = 1;
      let depthBrace = 0;
      let depthBracket = 0;
      let inQuote = null;
      let topLevelCommas = 1;
      let j = argsStart;
      while (j < line.length) {
        const ch = line[j];
        if (inQuote) {
          if (ch === inQuote && line[j - 1] !== '\\') inQuote = null;
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
        j++;
      }
      if (topLevelCommas >= 2) {
        findings.push({
          rel,
          lineNo,
          kind: 'excessive-args-t-call',
          line: line.trim(),
        });
      }
    }
  }
  return findings;
}

function scanFile(absPath) {
  return scanI18nUsage(readFileSync(absPath, 'utf8'), relPosix(absPath));
}

function allFindings() {
  const files = SCAN_ROOTS.flatMap((dir) => listTsxFiles(dir));
  return files.flatMap(scanFile);
}

test('operator codebase correctly destructures useT and avoids multi-arg t() calls', () => {
  const findings = allFindings();
  assert.deepEqual(
    findings,
    [],
    findings.length
      ? `Found i18n usage defects:\n${findings
          .map((f) => `  ${f.rel}:${f.lineNo} [${f.kind}] ${f.line}`)
          .join('\n')}`
      : undefined
  );
});

test('guard proof: both undestructured useT and multi-arg t() are detected', () => {
  assert.deepEqual(
    scanI18nUsage('const t = useT();', 'probe.tsx'),
    [
      {
        rel: 'probe.tsx',
        lineNo: 1,
        kind: 'undestructured-useT',
        line: 'const t = useT();',
      },
    ]
  );

  assert.deepEqual(
    scanI18nUsage("t('admin.songSets.created', { title: 'abc' }, 'extra')", 'probe.tsx'),
    [
      {
        rel: 'probe.tsx',
        lineNo: 1,
        kind: 'excessive-args-t-call',
        line: "t('admin.songSets.created', { title: 'abc' }, 'extra')",
      },
    ]
  );
});

export function scanHarmonizedTerminology() {
  const violations = [];
  const catalogFiles = [
    'src/lib/i18n/catalogue-en.ts',
    'src/lib/i18n/catalogue-id.ts',
  ];

  const prohibitedTerms = [
    { pattern: /\bOpen projector\b/i, name: 'Open projector' },
    { pattern: /\bParser Profile\b/i, name: 'Parser Profile' },
    { pattern: /\bUraikan\b/, name: 'Uraikan' },
    { pattern: /\bproyektor\b/i, name: 'proyektor' },
  ];

  for (const rel of catalogFiles) {
    const full = path.join(ROOT, rel);
    const lines = readFileSync(full, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, name } of prohibitedTerms) {
        if (pattern.test(line)) {
          violations.push(`${rel}:${i + 1}: prohibited term "${name}": ${line.trim()}`);
        }
      }
    }
  }

  // Verify PresenterOperator.tsx has zero hardcoded "Open projector" in JSX
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const presenterLines = readFileSync(presenterPath, 'utf8').split('\n');
  for (let i = 0; i < presenterLines.length; i++) {
    const line = presenterLines[i];
    if (line.includes('Open projector') && !line.trim().startsWith('*') && !line.trim().startsWith('//')) {
      violations.push(`PresenterOperator.tsx:${i + 1}: hardcoded "Open projector": ${line.trim()}`);
    }
  }

  return violations;
}

test('WSD-H-12: zero prohibited terms (Open projector, Parser Profile, Uraikan, proyektor) in catalogues and presenter', () => {
  const violations = scanHarmonizedTerminology();
  assert.deepEqual(violations, [], `Prohibited terminology violations:\n${violations.join('\n')}`);
});

test('WSD-H-12: guard proof — injected prohibited term in catalogue-id.ts is detected', () => {
  const target = path.join(ROOT, 'src', 'lib', 'i18n', 'catalogue-id.ts');
  const original = readFileSync(target, 'utf8');
  try {
    writeFileSync(target, original.replace("'form.parse': 'Baca susunan acara'", "'form.parse': 'Uraikan'"));
    const violations = scanHarmonizedTerminology();
    assert.ok(
      violations.some((v) => v.includes('catalogue-id.ts') && v.includes('Uraikan')),
      'Injected Uraikan in catalogue-id.ts must be detected'
    );
  } finally {
    writeFileSync(target, original);
  }
});
