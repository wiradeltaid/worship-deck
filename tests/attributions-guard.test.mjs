/**
 * SPEC-73: ATTRIBUTIONS scope refinement absence guard (WSD-H-11)
 *
 * Enforces:
 * 1. ATTRIBUTIONS.md does not contain the overbroad phrase "monetised in any form"
 *    or "monetized in any form".
 * 2. Modified sections do not contain em-dashes (—) or en-dashes (–).
 * 3. Real-file defect injection proofs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanAttributionsScope() {
  const violations = [];
  const target = path.join(root, 'ATTRIBUTIONS.md');
  const content = fs.readFileSync(target, 'utf8');

  if (/monetised\s+in\s+any\s+form/i.test(content) || /monetized\s+in\s+any\s+form/i.test(content)) {
    violations.push('ATTRIBUTIONS.md contains overbroad non-monetisation phrase "monetised in any form"');
  }

  // Check the SDAH section (lines 20-35) for em/en dashes
  const lines = content.split('\n');
  for (let i = 22; i <= 32 && i < lines.length; i++) {
    if (lines[i].includes('—') || lines[i].includes('–')) {
      violations.push(`ATTRIBUTIONS.md:${i + 1}: modified line contains em/en dash: ${lines[i]}`);
    }
  }

  return violations;
}

test('WSD-H-11: ATTRIBUTIONS.md has refined scope without overbroad non-monetisation claim', () => {
  const violations = scanAttributionsScope();
  assert.deepEqual(violations, [], `Attributions scope violations found:\n${violations.join('\n')}`);
});

test('WSD-H-11: guard proof — injected broad monetisation phrase is detected', () => {
  const target = path.join(root, 'ATTRIBUTIONS.md');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(
      target,
      original.replace(
        'WorshipDeck does not sell or license the software or its bundled',
        'Nothing in this project is sold, licensed for a fee, or monetised in any form.'
      )
    );
    const violations = scanAttributionsScope();
    assert.ok(
      violations.some((v) => v.includes('overbroad non-monetisation phrase')),
      'Injected broad monetisation phrase must be detected'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
