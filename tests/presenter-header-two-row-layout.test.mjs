/**
 * SPEC-86-04: Presenter Transport Active Slide Hide Toggle & Two-Row Header Layout
 * Unit, structural layout hierarchy, fail-closed containment, and real-file defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const presenterOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanPresenterHeaderLayout(presenterPath = presenterOperatorPath) {
  const findings = [];
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const cleanSrc = stripComments(presenterSrc);

  // 1. Top-right header actions container must declare data-testid="presenter-header-actions" with flex-col
  const actionsMatch = cleanSrc.match(/<div\b[^>]*data-testid="presenter-header-actions"[^>]*className="([^"]*)"/);
  if (!actionsMatch) {
    findings.push('PresenterOperator.tsx missing data-testid="presenter-header-actions"');
  } else if (!actionsMatch[1].includes('flex-col')) {
    findings.push('presenter-header-actions container missing flex-col for two-row vertical stacking');
  }

  // 2. Row 1: Display & Audience Controls (All slides, Open congregation screen, Remote code)
  const row1Index = cleanSrc.indexOf('data-testid="presenter-header-row-1"');
  if (row1Index === -1) {
    findings.push('PresenterOperator.tsx missing data-testid="presenter-header-row-1"');
  }

  // 3. Row 2: Session Safety & Workflow Controls (Offline badge, Lock, Emergency Edit, Run-Sheet)
  const row2Index = cleanSrc.indexOf('data-testid="presenter-header-row-2"');
  if (row2Index === -1) {
    findings.push('PresenterOperator.tsx missing data-testid="presenter-header-row-2"');
  }

  // Sequential order: Row 1 must precede Row 2
  if (row1Index !== -1 && row2Index !== -1 && row1Index >= row2Index) {
    findings.push('presenter-header-row-1 must precede presenter-header-row-2 in layout');
  }

  // Containment & Exclusivity for Row 1
  if (row1Index !== -1 && row2Index !== -1 && row1Index < row2Index) {
    const row1Snippet = cleanSrc.slice(row1Index, row2Index);
    if (!row1Snippet.includes('All slides')) {
      findings.push('presenter-header-row-1 must contain "All slides" button');
    }
    if (!row1Snippet.includes("t('presenter.openCongregationScreen')")) {
      findings.push('presenter-header-row-1 must contain openCongregationScreen button');
    }
    if (!row1Snippet.includes('setRemoteDialogOpen')) {
      findings.push('presenter-header-row-1 must contain remote code dialog trigger');
    }
    if (
      row1Snippet.includes('data-testid="presentation-lock-toggle"') ||
      row1Snippet.includes('data-testid="emergency-edit-button"') ||
      row1Snippet.includes('Run-Sheet')
    ) {
      findings.push('presenter-header-row-1 must NOT contain safety or workflow controls (must be in row 2)');
    }
  }

  // Containment for Row 2
  if (row2Index !== -1) {
    const headerEndIndex = cleanSrc.indexOf('</header>', row2Index);
    const row2Snippet = cleanSrc.slice(row2Index, headerEndIndex !== -1 ? headerEndIndex : row2Index + 2500);
    if (!row2Snippet.includes('OfflineReadinessBadge')) {
      findings.push('presenter-header-row-2 must contain OfflineReadinessBadge');
    }
    if (!row2Snippet.includes('data-testid="presentation-lock-toggle"')) {
      findings.push('presenter-header-row-2 must contain data-testid="presentation-lock-toggle"');
    }
    if (!row2Snippet.includes('data-testid="emergency-edit-button"')) {
      findings.push('presenter-header-row-2 must contain data-testid="emergency-edit-button"');
    }
    if (!row2Snippet.includes('Run-Sheet')) {
      findings.push('presenter-header-row-2 must contain Run-Sheet navigation button');
    }
  }

  // 4. Redundant toggle-current-slide-visibility must be removed from header
  if (cleanSrc.includes('data-testid="toggle-current-slide-visibility"')) {
    findings.push('Redundant data-testid="toggle-current-slide-visibility" must be removed from presenter header');
  }

  // 5. Filmstrip hover visibility button must be removed to avoid filmstrip clutter
  if (cleanSrc.includes('data-testid="filmstrip-visibility-toggle"')) {
    findings.push('Cluttering data-testid="filmstrip-visibility-toggle" must be removed from FilmstripFrame');
  }

  // 6. Transport controls bar under Current Slide must contain transport-slide-visibility-toggle
  if (!cleanSrc.includes('data-testid="transport-slide-visibility-toggle"')) {
    findings.push('PresenterOperator.tsx missing data-testid="transport-slide-visibility-toggle" in Current Slide transport bar');
  }

  return findings;
}

test('SPEC-86-04: Presenter header two-row layout and transport bar visibility toggle', () => {
  const findings = scanPresenterHeaderLayout();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-86-04: Real-file defect injection — single unconstrained flex row in header fails two-row guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const headerActionsRegex = /<div data-testid="presenter-header-actions"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
    const match = original.match(headerActionsRegex);
    assert.ok(match, 'must match header actions in original');

    const collapsedDefective = `<div data-testid="presenter-header-actions" className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setGridOpen(true)}>All slides</Button>
            <Button onClick={openProjector}>Screen</Button>
          </div>`;
    const defective = original.replace(headerActionsRegex, collapsedDefective);
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanPresenterHeaderLayout();
    assert.ok(
      findings.some((f) => f.includes('missing data-testid="presenter-header-row-1"') || f.includes('missing flex-col')),
      'Expected single unconstrained flex row to fail two-row guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-04: Real-file defect injection — removing transport-slide-visibility-toggle fails guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="transport-slide-visibility-toggle"',
      'data-testid="unlabeled-toggle"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanPresenterHeaderLayout();
    assert.ok(
      findings.some((f) => f.includes('missing data-testid="transport-slide-visibility-toggle"')),
      'Expected missing transport visibility toggle to fail guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-04: Real-file defect injection — restoring filmstrip-visibility-toggle fails uncluttered filmstrip guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const badgeRegex = /<span\s+data-testid="filmstrip-hidden-badge"/;
    assert.ok(badgeRegex.test(original), 'must match filmstrip-hidden-badge in original');

    const defective = original.replace(
      badgeRegex,
      '<Button data-testid="filmstrip-visibility-toggle">Toggle</Button>\n          <span data-testid="filmstrip-hidden-badge"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanPresenterHeaderLayout();
    assert.ok(
      findings.some((f) => f.includes('data-testid="filmstrip-visibility-toggle" must be removed')),
      'Expected restoring filmstrip toggle to fail uncluttered filmstrip guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-04: Real-file defect injection — inverting header row order fails sequential hierarchy guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="presenter-header-row-1"',
      'data-testid="presenter-temp-row"'
    ).replace(
      'data-testid="presenter-header-row-2"',
      'data-testid="presenter-header-row-1"'
    ).replace(
      'data-testid="presenter-temp-row"',
      'data-testid="presenter-header-row-2"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanPresenterHeaderLayout();
    assert.ok(
      findings.some((f) => f.includes('presenter-header-row-1 must precede presenter-header-row-2')),
      'Expected inverting header row order to fail sequential hierarchy guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-04: Real-file defect injection — displacing emergency-edit-button into Row 1 fails exclusivity guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="presenter-header-row-1" className="flex flex-wrap items-center justify-end gap-2">',
      'data-testid="presenter-header-row-1" className="flex flex-wrap items-center justify-end gap-2">\n            <Button data-testid="emergency-edit-button">Edit</Button>'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanPresenterHeaderLayout();
    assert.ok(
      findings.some((f) => f.includes('presenter-header-row-1 must NOT contain safety or workflow controls')),
      'Expected displacing emergency edit button into row 1 to fail exclusivity guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});
