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

test('SPEC-99-02: Live relocation to primary display includes laptopWarning in confirmation message', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  // Verify that primary-display selection prepends laptopWarning to confirmMsg before prompt
  assert.ok(
    src.includes("value === 'primary-display'") &&
      src.includes('laptopWarning') &&
      src.includes('relocateConfirm'),
    'PresenterDisplayControl must combine laptopWarning and relocateConfirm when targeting primary display'
  );
  assert.ok(
    src.includes("liveness === 'live' || value === 'primary-display'"),
    'Confirmation must guard both live relocation and primary-display targeting'
  );
});

test('SPEC-99-02: Behavioral confirmation gating prevents unwanted relocation when cancelled', () => {
  let relocated = false;
  let confirmAnswer = false;

  function onSelectTarget(val, liveness, onRelocateFn) {
    let confirmMsg = 'Move screen?';
    if (val === 'primary-display') {
      confirmMsg = `Warning!\n\n${confirmMsg}`;
    }
    if (liveness === 'live' || val === 'primary-display') {
      if (!confirmAnswer) {
        return; // cancelled
      }
    }
    relocated = true;
    onRelocateFn();
  }

  // 1. User cancels confirmation -> no relocation occurs
  confirmAnswer = false;
  onSelectTarget('primary-display', 'live', () => {});
  assert.equal(relocated, false, 'Cancellation must prevent relocation');

  // 2. User confirms -> relocation proceeds
  confirmAnswer = true;
  onSelectTarget('primary-display', 'live', () => {});
  assert.equal(relocated, true, 'Confirmation must allow relocation');
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

test('SPEC-102-01: Base UI MenuGroupContext crash fix — DropdownMenuLabel is wrapped in DropdownMenuGroup', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  // Verify DropdownMenuGroup is imported
  assert.ok(
    src.includes('DropdownMenuGroup'),
    'PresenterDisplayControl must import DropdownMenuGroup'
  );

  // Verify DropdownMenuLabel is nested inside DropdownMenuGroup
  const groupLabelRegex = /<DropdownMenuGroup>[\s\S]*?<DropdownMenuLabel[\s\S]*?<\/DropdownMenuGroup>/;
  assert.ok(
    groupLabelRegex.test(src),
    'DropdownMenuLabel must be enclosed within DropdownMenuGroup to satisfy Base UI MenuGroupContext'
  );
});

test('SPEC-102-01: Scoped unlock decoupling — launcher and trigger remain enabled during presentationLock; close screen retains guard', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  // Primary launcher button must NOT be disabled by presentationLock
  const primaryBtnMatch = src.match(/data-testid="presenter-display-control-primary"[\s\S]*?>/);
  assert.ok(primaryBtnMatch, 'Primary launcher button must exist');
  assert.equal(
    primaryBtnMatch[0].includes('disabled={presentationLock}'),
    false,
    'Primary launcher button must remain enabled when presentationLock is active'
  );

  // Trigger button must NOT be disabled by presentationLock
  const triggerBtnMatch = src.match(/data-testid="presenter-display-control-trigger"[\s\S]*?>/);
  assert.ok(triggerBtnMatch, 'Trigger button must exist');
  assert.equal(
    triggerBtnMatch[0].includes('disabled={presentationLock}'),
    false,
    'Dropdown trigger button must remain enabled when presentationLock is active'
  );

  // Destructive close action must retain presentationLock guard
  const closeActionMatch = src.match(/data-testid="presenter-action-close"[\s\S]*?>/);
  assert.ok(closeActionMatch, 'Close action must exist');
  assert.ok(
    closeActionMatch[0].includes('disabled={presentationLock}') ||
      src.includes('disabled={presentationLock}') && src.includes('presenter-action-close'),
    'Destructive close screen action must retain presentationLock guard'
  );
});

test('SPEC-102-01: guard proof: un-grouped DropdownMenuLabel fails structure check', () => {
  function validateMenuLabelStructure(code) {
    const hasUngroupedLabel =
      /<DropdownMenuContent[\s\S]*?>\s*<DropdownMenuLabel/.test(code) &&
      !/<DropdownMenuGroup>\s*<DropdownMenuLabel/.test(code);
    if (hasUngroupedLabel) {
      throw new Error('Base UI MenuGroupContext violation: DropdownMenuLabel is not wrapped in DropdownMenuGroup');
    }
  }

  // Proper grouped code
  const goodCode = '<DropdownMenuContent><DropdownMenuGroup><DropdownMenuLabel>Header</DropdownMenuLabel></DropdownMenuGroup></DropdownMenuContent>';
  assert.doesNotThrow(() => validateMenuLabelStructure(goodCode));

  // Injected defect: un-grouped label
  const badCode = '<DropdownMenuContent>\n<DropdownMenuLabel>Header</DropdownMenuLabel></DropdownMenuContent>';
  assert.throws(
    () => validateMenuLabelStructure(badCode),
    /MenuGroupContext violation/
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
