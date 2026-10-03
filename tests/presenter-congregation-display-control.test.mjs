import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('SPEC-99-02: Bilingual translations exist for all display target keys', async () => {
  const enMod = await import(new URL('../src/lib/i18n/catalogue-en.ts', import.meta.url).href);
  const idMod = await import(new URL('../src/lib/i18n/catalogue-id.ts', import.meta.url).href);

  const en = enMod.CATALOGUE_EN || enMod.default || enMod;
  const id = idMod.CATALOGUE_ID || idMod.default || idMod;

  const requiredKeys = [
    'presenter.displayTarget.openExternal',
    'presenter.displayTarget.openWindow',
    'presenter.displayTarget.active',
    'presenter.displayTarget.reopen',
    'presenter.displayTarget.targetHeader',
    'presenter.displayTarget.externalRecommended',
    'presenter.displayTarget.laptopWarning',
    'presenter.displayTarget.windowSafe',
    'presenter.displayTarget.detectDisplays',
    'presenter.displayTarget.relocateConfirm',
    'presenter.displayTarget.remember',
    'presenter.displayTarget.focus',
    'presenter.displayTarget.close',
    'presenter.displayTarget.primaryDisplay',
  ];

  for (const k of requiredKeys) {
    assert.ok(en[k], `Missing EN key: ${k}`);
    assert.ok(id[k], `Missing ID key: ${k}`);
    // Guard against prohibited terms
    assert.equal(
      /\bproyektor\b/i.test(id[k]),
      false,
      `Prohibited term "proyektor" in ID key ${k}: "${id[k]}"`
    );
    assert.equal(
      /open projector/i.test(en[k]),
      false,
      `Prohibited term "open projector" in EN key ${k}: "${en[k]}"`
    );
  }
});

test('SPEC-99-02: PresenterDisplayControl source guards for split-button and accessible primitives', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  assert.ok(fs.existsSync(compPath), 'PresenterDisplayControl.tsx must exist');

  const src = fs.readFileSync(compPath, 'utf8');

  // Must import Button from ui/button
  assert.ok(
    src.includes("from '@/components/ui/button'"),
    'Must import Button from @/components/ui/button'
  );

  // Must import DropdownMenu primitives
  assert.ok(
    src.includes("from '@/components/ui/dropdown-menu'"),
    'Must import DropdownMenu from @/components/ui/dropdown-menu'
  );

  // Must contain testids for primary button and dropdown trigger
  assert.ok(
    src.includes('data-testid="presenter-display-control-primary"'),
    'Must render presenter-display-control-primary'
  );
  assert.ok(
    src.includes('data-testid="presenter-display-control-trigger"'),
    'Must render presenter-display-control-trigger'
  );
  assert.ok(
    src.includes('data-testid="presenter-action-detect"'),
    'Must render presenter-action-detect'
  );
  assert.ok(
    src.includes('data-testid="presenter-target-remember-checkbox"'),
    'Must render presenter-target-remember-checkbox'
  );

  // Must not contain raw <button or <select
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal(
    /<button\b/.test(noComments),
    false,
    'Must not use raw HTML <button> (use Button primitive)'
  );
  assert.equal(
    /<select\b/.test(noComments),
    false,
    'Must not use raw HTML <select>'
  );

  // Must use relocateConfirm and laptopWarning keys
  assert.ok(
    src.includes('relocateConfirm'),
    'Must use presenter.displayTarget.relocateConfirm translation'
  );
  assert.ok(
    src.includes('laptopWarning'),
    'Must use presenter.displayTarget.laptopWarning translation'
  );
});

test('SPEC-99-02: PresenterOperator imports and renders PresenterDisplayControl in header row 1', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');

  assert.ok(
    src.includes("import PresenterDisplayControl from '@/operator/present/PresenterDisplayControl'") ||
      src.includes("import PresenterDisplayControl from './PresenterDisplayControl'") ||
      src.includes('import PresenterDisplayControl from "./PresenterDisplayControl"'),
    'PresenterOperator must import PresenterDisplayControl'
  );

  assert.ok(
    src.includes('<PresenterDisplayControl'),
    'PresenterOperator must render PresenterDisplayControl'
  );

  // Must not have old hardcoded Open congregation screen Button
  assert.equal(
    src.includes("t('presenter.openCongregationScreen')"),
    false,
    'Old monolithic openCongregationScreen button must be replaced by PresenterDisplayControl'
  );
});

test('SPEC-99-02 Defect Injection Proof: verifyDisplayControlPresence detects omitted component', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');
  const brokenSource = src.replace('<PresenterDisplayControl', '');

  assert.equal(
    brokenSource.includes('<PresenterDisplayControl'),
    false,
    'INJECTED DEFECT: Omitted PresenterDisplayControl fails guard'
  );
});
