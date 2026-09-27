/**
 * SPEC-90-02: Operator UI Legal About Modal & Profile Menu Integration Test Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export function verifyAboutModalLegalCopy(content) {
  // Publisher name must not contain "PT" prefix
  if (/\bPT\s+Wira\s+Delta\s+Indonesia\b/i.test(content)) {
    throw new Error('Publisher name must not contain "PT" prefix per legal guidelines');
  }

  const mandatoryTokens = [
    'Copyright (c) 2026 Wira Delta Indonesia',
    'Free software under the MIT License. Source: LICENSE',
    'This installation is operated by the local church administration, not by the publisher. What is stored, and who answers for it: PRIVACY.md',
    'Hymn texts are not covered by the MIT license and are not ours to license. See ATTRIBUTIONS.md',
    'https://wiradelta.id/worship-deck',
    'support@wiradelta.com',
    'zero telemetry and zero background outbound calls',
  ];

  for (const token of mandatoryTokens) {
    if (!content.includes(token)) {
      throw new Error(`Missing mandatory legal About Modal copy token: "${token}"`);
    }
  }
}

test('SPEC-90-02: AboutModal.tsx contains all mandatory legal disclaimers and publisher identity', () => {
  const modalPath = path.join(repoRoot, 'src', 'components', 'AboutModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'AboutModal.tsx must exist');
  const content = fs.readFileSync(modalPath, 'utf8');

  verifyAboutModalLegalCopy(content);
  assert.ok(content.includes('__APP_VERSION__'), 'AboutModal must bind to __APP_VERSION__ to ensure zero version drift');
  assert.ok(content.includes('worship-deck-icon-square.svg'), 'AboutModal must display the square icon brand mark');
});

test('SPEC-90-02 guard proof: verifyAboutModalLegalCopy detects omitted legal disclaimers', () => {
  const modalPath = path.join(repoRoot, 'src', 'components', 'AboutModal.tsx');
  const validContent = fs.readFileSync(modalPath, 'utf8');

  // Defect 1: Missing Church Operator Disclaimer
  const missingChurch = validContent.replace(
    'This installation is operated by the local church administration, not by the publisher. What is stored, and who answers for it: PRIVACY.md',
    ''
  );
  assert.throws(
    () => verifyAboutModalLegalCopy(missingChurch),
    /Missing mandatory legal About Modal copy token: "This installation is operated by the local church administration/
  );

  // Defect 2: Missing Hymn Text Exclusion
  const missingHymn = validContent.replace(
    'Hymn texts are not covered by the MIT license and are not ours to license. See ATTRIBUTIONS.md',
    ''
  );
  assert.throws(
    () => verifyAboutModalLegalCopy(missingHymn),
    /Missing mandatory legal About Modal copy token: "Hymn texts are not covered by the MIT license/
  );

  // Defect 3: PT prefix in publisher
  const ptPublisher = validContent.replace(
    'Copyright (c) 2026 Wira Delta Indonesia',
    'Copyright (c) 2026 PT Wira Delta Indonesia'
  );
  assert.throws(
    () => verifyAboutModalLegalCopy(ptPublisher),
    /Publisher name must not contain "PT" prefix/
  );
});

test('SPEC-90-02: Header.tsx integrates AboutModal and menu trigger', () => {
  const headerPath = path.join(repoRoot, 'src', 'components', 'Header.tsx');
  const content = fs.readFileSync(headerPath, 'utf8');

  assert.ok(content.includes('AboutModal'), 'Header.tsx must import AboutModal');
  assert.ok(content.includes('aboutOpen'), 'Header.tsx must track aboutOpen dialog state');
  assert.ok(content.includes('data-testid="about-modal-trigger"'), 'Header.tsx must expose trigger item');
  assert.ok(content.includes("<AboutModal open={aboutOpen}"), 'Header.tsx must render AboutModal');
});

test('SPEC-90-02: vite.config.ts exposes __APP_VERSION__ from package.json', () => {
  const viteConfigPath = path.join(repoRoot, 'spa', 'vite.config.ts');
  const content = fs.readFileSync(viteConfigPath, 'utf8');

  assert.ok(content.includes('__APP_VERSION__'), 'spa/vite.config.ts must define __APP_VERSION__');
});
