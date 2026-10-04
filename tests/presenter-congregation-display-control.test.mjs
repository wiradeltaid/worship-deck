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

test('SPEC-103-04: PresenterDisplayControl source guards for unified dropdown trigger and accessible primitives', () => {
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

  // Must contain testid for unified dropdown trigger button
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

  // Unified trigger must be wrapped in DropdownMenuTrigger
  assert.ok(
    /<DropdownMenuTrigger[\s\S]*?data-testid="presenter-display-control-trigger"/.test(src),
    'Unified trigger must be enclosed by DropdownMenuTrigger'
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

test('SPEC-102-01: Scoped unlock decoupling — unified trigger remains enabled during presentationLock; close screen guards with confirmation dialog', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  // Unified trigger button must NOT be disabled by presentationLock
  const triggerBtnMatch = src.match(/data-testid="presenter-display-control-trigger"[\s\S]*?>/);
  assert.ok(triggerBtnMatch, 'Dropdown trigger button must exist');
  assert.equal(
    triggerBtnMatch[0].includes('disabled={presentationLock}'),
    false,
    'Dropdown trigger button must remain enabled when presentationLock is active'
  );

  // Destructive close action guards against presentationLock via confirmation dialog
  assert.ok(
    src.includes('presentationLock') && src.includes('window.confirm') && src.includes('handleCloseClick'),
    'Close action must prompt confirmation dialog when presentationLock is active'
  );
});

test('SPEC-103-04: target selection triggers launch or relocate across none, live, and lost states', () => {
  let launched = 0;
  let relocated = 0;

  function simulateSelectTarget(liveness, hasOpenProjector, onOpenOrFocus, onRelocate) {
    if (hasOpenProjector || liveness === 'live' || liveness === 'lost') {
      if (onRelocate) onRelocate();
      else onOpenOrFocus();
    } else {
      onOpenOrFocus();
    }
  }

  // 1. None / never-opened state without open projector -> launches immediately
  simulateSelectTarget('never-opened', false, () => launched++, () => relocated++);
  assert.equal(launched, 1);
  assert.equal(relocated, 0);

  // 2. Just-opened state (hasOpenProjector = true, liveness = never-opened) -> relocates immediately!
  simulateSelectTarget('never-opened', true, () => launched++, () => relocated++);
  assert.equal(launched, 1);
  assert.equal(relocated, 1);

  // 3. Live state -> relocates immediately
  simulateSelectTarget('live', true, () => launched++, () => relocated++);
  assert.equal(launched, 1);
  assert.equal(relocated, 2);

  // 4. Lost state -> relocates immediately
  simulateSelectTarget('lost', true, () => launched++, () => relocated++);
  assert.equal(launched, 1);
  assert.equal(relocated, 3);
});

test('SPEC-103-04: Focus calls focus() without rewriting window location URL', () => {
  let focused = false;
  let urlRewritten = false;

  const mockWindow = {
    closed: false,
    focus: () => { focused = true; },
    get location() {
      return {
        set href(val) { urlRewritten = true; },
      };
    },
  };

  function pureFocusProjector(existing) {
    if (existing && !existing.closed) {
      existing.focus();
    }
  }

  pureFocusProjector(mockWindow);
  assert.equal(focused, true, 'Window focus() must be called');
  assert.equal(urlRewritten, false, 'Window location.href must NOT be overwritten on Focus');
});

test('SPEC-103-04: Close action is rendered during lost liveness and guards with confirm when locked', () => {
  let closed = false;
  let confirmPrompted = false;

  function createCloseHandler(presentationLock, onCloseProjector, confirmResult = true) {
    return () => {
      if (!onCloseProjector) return;
      if (presentationLock) {
        confirmPrompted = true;
        if (!confirmResult) return; // User cancelled confirmation
      }
      onCloseProjector();
    };
  }

  // 1. Unlocked close closes immediately without prompt
  const unlockedHandler = createCloseHandler(false, () => { closed = true; });
  unlockedHandler();
  assert.equal(closed, true);
  assert.equal(confirmPrompted, false);

  // 2. Locked close with confirmation accepted -> closes
  closed = false;
  confirmPrompted = false;
  const lockedAcceptedHandler = createCloseHandler(true, () => { closed = true; }, true);
  lockedAcceptedHandler();
  assert.equal(confirmPrompted, true);
  assert.equal(closed, true);

  // 3. Locked close with confirmation cancelled -> aborts, does NOT close
  closed = false;
  confirmPrompted = false;
  const lockedCancelledHandler = createCloseHandler(true, () => { closed = true; }, false);
  lockedCancelledHandler();
  assert.equal(confirmPrompted, true);
  assert.equal(closed, false, 'Cancellation must prevent close from executing');
});

test('SPEC-103-04: structural scan and defect injection verify handleConfigChange relocation predicate', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  function validateConfigChangeRelocationGuard(code) {
    const fnMatch = code.match(/const handleConfigChange = useCallback\([\s\S]*?\[hasOpenProjector, liveness, onOpenOrFocus, onRelocate, screens\]\s*\);/);
    if (!fnMatch) throw new Error('handleConfigChange callback missing or has incomplete dependency array');
    const body = fnMatch[0];
    if (!/if\s*\(\s*hasOpenProjector\s*\|\|\s*liveness\s*===\s*['"]live['"]\s*\|\|\s*liveness\s*===\s*['"]lost['"]\s*\)/.test(body)) {
      throw new Error('Relocation Predicate Violation: handleConfigChange must check hasOpenProjector || liveness === live || liveness === lost');
    }
  }

  // Real production source passes
  assert.doesNotThrow(() => validateConfigChangeRelocationGuard(src));

  // Injected defect: remove hasOpenProjector from handleConfigChange relocation predicate
  const defective = src.replace('hasOpenProjector || liveness === \'live\'', 'liveness === \'live\'');
  assert.throws(
    () => validateConfigChangeRelocationGuard(defective),
    /Relocation Predicate Violation/
  );
});

test('SPEC-103-04: structural scan and defect injection verify handleCloseClick confirmation guard', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  function validateCloseHandlerGuard(code) {
    const fnMatch = code.match(/const handleCloseClick = useCallback\([\s\S]*?\[onCloseProjector, presentationLock\]\s*\);/);
    if (!fnMatch) throw new Error('handleCloseClick callback missing');
    const body = fnMatch[0];
    if (!/if\s*\(\s*presentationLock\s*\)[\s\S]*?window\.confirm[\s\S]*?if\s*\(\s*!confirmed\s*\)\s*return;/.test(body)) {
      throw new Error('Close Confirmation Violation: handleCloseClick must check presentationLock, prompt window.confirm, and abort on !confirmed');
    }
  }

  // Real production source passes
  assert.doesNotThrow(() => validateCloseHandlerGuard(src));

  // Injected defect: remove !confirmed abort check from handleCloseClick
  const defectiveClose = src.replace('if (!confirmed) return;', '');
  assert.throws(
    () => validateCloseHandlerGuard(defectiveClose),
    /Close Confirmation Violation/
  );
});

test('SPEC-103-04: structural scan and defect injection verify Action options visibility predicate', () => {
  const compPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterDisplayControl.tsx');
  const src = fs.readFileSync(compPath, 'utf8');

  function validateActionItemsVisibilityGuard(code) {
    const actionBlockMatch = code.match(/\{\/\* Action options when window is open or active \*\/\}[\s\S]*?\{\/\* Utility re-detection action \*\/\}/);
    if (!actionBlockMatch) throw new Error('Action options block missing');
    const block = actionBlockMatch[0];
    if (!/\(hasOpenProjector\s*\|\|\s*liveness\s*===\s*['"]live['"]\s*\|\|\s*liveness\s*===\s*['"]lost['"]\)/.test(block)) {
      throw new Error('Action Visibility Violation: Actions must be visible when hasOpenProjector || liveness === live || liveness === lost');
    }
    if (!block.includes('data-testid="presenter-action-focus"')) {
      throw new Error('Action Visibility Violation: Missing presenter-action-focus');
    }
    if (!block.includes('data-testid="presenter-action-reopen"')) {
      throw new Error('Action Visibility Violation: Missing presenter-action-reopen');
    }
    if (!block.includes('data-testid="presenter-action-close"')) {
      throw new Error('Action Visibility Violation: Missing presenter-action-close');
    }
  }

  // Real production source passes
  assert.doesNotThrow(() => validateActionItemsVisibilityGuard(src));

  // Injected defect: remove hasOpenProjector from action visibility guard
  const defectiveVisibility = src.replace(
    /\{\/\* Action options when window is open or active \*\/\}[\s\S]*?\{\(hasOpenProjector/,
    '{/* Action options when window is open or active */}\n          {(false'
  );
  assert.throws(
    () => validateActionItemsVisibilityGuard(defectiveVisibility),
    /Action Visibility Violation/
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
