/**
 * Story 20.2: three slide kinds — vocabulary, kindOf, and schema invariants.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const srcUrl = (...parts) =>
  pathToFileURL(path.join(root, 'src', ...parts)).href;

const { ARTIFACT_BASE_TYPES, kindOf, isCanvasAuthorable } = await import(
  srcUrl('lib', 'registry', 'types.ts')
);
const { loadSeedTemplates } = await import(srcUrl('lib', 'registry', 'seed.ts'));

const RETIRED_TEMPLATE_BASE_TYPES = [
  'text-placeholder',
  'image-placeholder',
  'mix-placeholder',
  'fullscreen-image',
];

const ENTRY_KEY_ARRAY_NAMES = ['ARTIFACT_ENTRY_KEYS', 'ARTIFACT_BASE_TYPES'];

/** Brace-balanced body of the first `switch (baseType) { … }` block. */
function extractSwitchBaseTypeBody(text) {
  const marker = 'switch (baseType)';
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const braceStart = text.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(braceStart + 1, i);
    }
  }
  return null;
}

function scanTextForRetiredBaseTypes(text, relPath, hits) {
  for (const retired of RETIRED_TEMPLATE_BASE_TYPES) {
    const assignRe = new RegExp(
      `(?:baseType|base_type)\\s*[:=]\\s*['"]${retired}['"]`,
      'g'
    );
    const jsonRe = new RegExp(
      `['"](?:baseType|base_type)['"]\\s*:\\s*['"]${retired}['"]`,
      'g'
    );
    let match;
    while ((match = assignRe.exec(text)) !== null) {
      hits.push(`${relPath}:${match[0]}`);
    }
    while ((match = jsonRe.exec(text)) !== null) {
      hits.push(`${relPath}:${match[0]}`);
    }
  }

  for (const arrayName of ENTRY_KEY_ARRAY_NAMES) {
    const arrayRe = new RegExp(
      `${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`,
      'g'
    );
    let arrayMatch;
    while ((arrayMatch = arrayRe.exec(text)) !== null) {
      for (const retired of RETIRED_TEMPLATE_BASE_TYPES) {
        if (new RegExp(`['"]${retired}['"]`).test(arrayMatch[1])) {
          hits.push(`${relPath}:${arrayName} contains '${retired}'`);
        }
      }
    }
  }

  const switchBody = extractSwitchBaseTypeBody(text);
  if (switchBody) {
    for (const retired of RETIRED_TEMPLATE_BASE_TYPES) {
      if (new RegExp(`case\\s+['"]${retired}['"]\\s*:`).test(switchBody)) {
        hits.push(`${relPath}:case '${retired}': in switch(baseType)`);
      }
    }
  }
}

function scanForRetiredTemplateBaseTypes(dir, hits = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'local' && path.basename(dir) === 'data') continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanForRetiredTemplateBaseTypes(full, hits);
      continue;
    }
    if (!/\.(ts|tsx|json|mjs)$/.test(name)) continue;
    if (name === 'artifact-kinds.test.mjs' || name === 'registry-three-kind-reset.test.mjs') continue;
    const text = fs.readFileSync(full, 'utf8');
    scanTextForRetiredBaseTypes(text, path.relative(root, full), hits);
  }
  return hits;
}

test('ARTIFACT_BASE_TYPES is exactly general, song-set, announcement', () => {
  assert.deepEqual([...ARTIFACT_BASE_TYPES], ['general', 'song-set', 'announcement']);
});

test('retired template base types occur nowhere in src, data, or tests', () => {
  const hits = [
    ...scanForRetiredTemplateBaseTypes(path.join(root, 'src')),
    ...scanForRetiredTemplateBaseTypes(path.join(root, 'data')),
    ...scanForRetiredTemplateBaseTypes(path.join(root, 'tests')),
  ];
  assert.deepEqual(
    hits,
    [],
    `retired template base type string still present: ${hits.join(', ')}`
  );
});

test('kindOf maps entry keys to the three kinds', () => {
  assert.equal(kindOf('general'), 'general');
  assert.equal(kindOf('song-set'), 'song-set');
  assert.equal(kindOf('announcement'), 'announcement');
  assert.equal(kindOf('songset-bt-open'), 'song-set');
  assert.throws(() => kindOf('text-placeholder'), /Unknown artifact entry key/);
});

test('isCanvasAuthorable is true only for general', () => {
  assert.equal(isCanvasAuthorable('general'), true);
  assert.equal(isCanvasAuthorable('song-set'), false);
  assert.equal(isCanvasAuthorable('announcement'), false);
});

test('the shipped seed uses only the three kinds in the expected counts', () => {
  const templates = loadSeedTemplates();
  const counts = Object.fromEntries(
    ARTIFACT_BASE_TYPES.map((k) => [k, 0])
  );
  for (const t of templates) {
    counts[t.baseType] += 1;
  }
  assert.equal(templates.length, 38);
  assert.equal(counts.general, 32);
  // After DEC-004 3->4 the shipped seed's five `song-set` rows become
  // `song-set-entry`. The seed JSON itself is the pre-migration shape; the
  // migration rewrites them on first boot. Counts above describe the shipped
  // (pre-migration) seed.
  assert.equal(counts['song-set'], 5);
  assert.equal(counts.announcement, 1);
});

test('artifact_templates DDL carries the DEC-004 columns on top of Story 20.1', () => {
  const schemaPath = fs.existsSync(path.join(root, 'internal', 'db', 'schema.sql'))
    ? path.join(root, 'internal', 'db', 'schema.sql')
    : path.join(root, 'src', 'lib', 'db', 'index.ts');
  const ddl = fs.readFileSync(schemaPath, 'utf8');
  const match = ddl.match(
    /CREATE TABLE IF NOT EXISTS artifact_templates \(([\s\S]*?)\);/
  );
  assert.ok(match, 'artifact_templates DDL block must be present');
  const body = match[1];
  const columns = [...body.matchAll(/^\s+(\w+)\s+/gm)].map((m) => m[1]);
  assert.deepEqual(columns, [
    'id',
    'label',
    'base_type',
    'payload',
    'updated_at',
    'seed_hash',
    'position',
    'variable_name',
    'ann_set_id',
  ]);
});
