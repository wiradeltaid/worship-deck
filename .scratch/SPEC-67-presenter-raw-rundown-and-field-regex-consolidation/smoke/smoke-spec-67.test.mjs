/**
 * Smoke test for SPEC-67:
 * - FR-15: Presenter displays raw rundown text directly in Run-Sheet sidebar without dropped lines.
 * - FR-36: Service form intake consolidates onto Dynamic Predefined Field Regex suggestions without silent overwrites.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..', '..');

const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const { formatPresenterRunSheet } = await import(
  srcUrl('operator', 'present', 'presenter-model.ts')
);
const { extractPredefinedFields } = await import(
  srcUrl('lib', 'parser-rules.ts')
);

test('Smoke Test SPEC-67 (FR-15): Presenter raw rundown display faithfully renders bulletin text', () => {
  const bulletin = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE ✨
  1. Call to Worship: Sis. Maria
  2. Opening Song: SDAH #100
Special Announcement:
- Fellowship lunch follows service! 🎉`;

  const runSheet = formatPresenterRunSheet(bulletin, 'No rundown text provided');
  assert.equal(runSheet.isEmpty, false);
  assert.equal(runSheet.text, bulletin, 'Rundown text in presenter sidebar must match verbatim');
});

test('Smoke Test SPEC-67 (FR-36): Dynamic Predefined Field regex extracts custom fields for form suggestions', () => {
  const bulletin = `DIVINE SERVICE
Special Duty:
Deacon on Duty: Bro. Timothy
Offertory: Annual Harvest Thanksgiving`;

  const fields = [
    {
      variable_name: 'deacon_on_duty',
      extraction_regex: 'Deacon on Duty:\\s*(?<value>[^\\n]+)',
    },
    {
      variable_name: 'offertory_name',
      extraction_regex: 'Offertory:\\s*(?<value>[^\\n]+)',
    },
  ];

  const suggestions = extractPredefinedFields(bulletin, fields);
  assert.equal(suggestions.deacon_on_duty, 'Bro. Timothy');
  assert.equal(suggestions.offertory_name, 'Annual Harvest Thanksgiving');
});
