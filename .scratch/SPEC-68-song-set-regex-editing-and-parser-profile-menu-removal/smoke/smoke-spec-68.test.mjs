/**
 * Smoke test for SPEC-68:
 * - FR-36: Obsolete Advanced Parser Profile menu and component removed from FormLayoutAdminPanel (proven by absence guard).
 * - FR-32, FR-36: Dynamic Song Set Entry extraction regex extracts song candidates into form suggestions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..', '..');

const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const { extractSongSetEntries } = await import(
  srcUrl('lib', 'parser-rules.ts')
);

test('Smoke Test SPEC-68 (FR-36): Obsolete Advanced Parser Profiles menu is retired from FormLayoutAdminPanel', () => {
  const panelPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');
  const panelSource = fs.readFileSync(panelPath, 'utf8');

  // Verify absence of obsolete tab identifier, button, and component
  assert.ok(
    !panelSource.includes("activeTab === 'profiles'"),
    'FormLayoutAdminPanel must NOT contain activeTab === "profiles"'
  );
  assert.ok(
    !panelSource.includes('<ParserProfilesPanel'),
    'FormLayoutAdminPanel must NOT render <ParserProfilesPanel'
  );
  assert.ok(
    !panelSource.includes("Sliders"),
    'FormLayoutAdminPanel must NOT import or use Sliders icon'
  );
});

test('Smoke Test SPEC-68 (FR-32, FR-36): Configured Song Set Entry regex extracts songs from church bulletin', () => {
  const bulletin = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE

1. Opening Hymn: SDAH #100 "Great Is Thy Faithfulness"
2. Praise & Worship:
   - Praise Song 1: #245
   - Praise Song 2: #159
3. Sermon: "Walking in Faith"
4. Closing Song: SDAH #334 "More About Jesus"`;

  const songSetEntries = [
    {
      variableName: 'opening_song_bt',
      extractionRegex: '(?i)Opening Hymn\\s*[:\\-]\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
    {
      variableName: 'praise_song_1',
      extractionRegex: '(?i)Praise Song 1\\s*[:\\-]\\s*#?(?<number>\\d+)',
    },
    {
      variableName: 'praise_song_2',
      extractionRegex: '(?i)Praise Song 2\\s*[:\\-]\\s*#?(?<number>\\d+)',
    },
    {
      variableName: 'closing_song_ds',
      extractionRegex: '(?i)Closing Song\\s*[:\\-]\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
  ];

  const suggestions = extractSongSetEntries(bulletin, songSetEntries);

  assert.equal(suggestions.opening_song_bt?.songNumber, 100);
  assert.equal(suggestions.opening_song_bt?.songBookCode, 'SDAH');

  assert.equal(suggestions.praise_song_1?.songNumber, 245);
  assert.equal(suggestions.praise_song_2?.songNumber, 159);

  assert.equal(suggestions.closing_song_ds?.songNumber, 334);
  assert.equal(suggestions.closing_song_ds?.songBookCode, 'SDAH');
});
