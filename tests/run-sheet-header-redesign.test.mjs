/**
 * SPEC-85-03: Run-Sheet Header Action Bar Redesign & Presenter Rundown Textarea Vertical Fill
 * Unit, structural, layout hierarchy, and defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const runSheetPagePath = path.join(rootDir, 'spa', 'src', 'pages', 'RunSheetPage.tsx');
const presenterOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanRunSheetHeaderRedesign(overrides = {}) {
  const findings = [];
  const runSheetSrc = overrides.runSheetSrc ?? fs.readFileSync(runSheetPagePath, 'utf8');
  const cleanSrc = stripComments(runSheetSrc);

  // 1. Run-Sheet header container with responsive 1024px inline layout
  if (!cleanSrc.includes('data-testid="run-sheet-header"')) {
    findings.push('RunSheetPage.tsx missing data-testid="run-sheet-header"');
  }
  if (!cleanSrc.includes('lg:flex-row lg:items-center lg:justify-between')) {
    findings.push('RunSheetPage.tsx missing lg:flex-row lg:items-center lg:justify-between for desktop inline alignment');
  }

  // 2. Structured Meta Cluster (Left)
  if (!cleanSrc.includes('data-testid="header-meta-cluster"')) {
    findings.push('RunSheetPage.tsx missing data-testid="header-meta-cluster"');
  }

  // 3. Structured Actions Wrapper
  if (!cleanSrc.includes('data-testid="header-actions-wrapper"')) {
    findings.push('RunSheetPage.tsx missing data-testid="header-actions-wrapper"');
  }

  // 4. Primary Controls Cluster (Present, Preview, Remote)
  if (!cleanSrc.includes('data-testid="header-primary-controls"')) {
    findings.push('RunSheetPage.tsx missing data-testid="header-primary-controls"');
  }

  // 5. Utility Controls Cluster (Sync Artifact, Download PPTX)
  if (!cleanSrc.includes('data-testid="header-utility-controls"')) {
    findings.push('RunSheetPage.tsx missing data-testid="header-utility-controls"');
  }

  return findings;
}

export function scanPresenterRundownFill(overrides = {}) {
  const findings = [];
  const presenterSrc = overrides.presenterSrc ?? fs.readFileSync(presenterOperatorPath, 'utf8');
  const cleanSrc = stripComments(presenterSrc);

  // 1. Presenter rundown list scroller
  if (!cleanSrc.includes('data-testid="presenter-rundown-list"')) {
    findings.push('PresenterOperator.tsx missing data-testid="presenter-rundown-list"');
  }

  // 2. Must carry flex-1 and h-full for vertical panel expansion
  const rundownMatch = cleanSrc.match(/<ul\b[^>]*data-testid="presenter-rundown-list"[^>]*className="([^"]*)"/);
  if (!rundownMatch) {
    findings.push('PresenterOperator.tsx missing className on presenter-rundown-list');
  } else {
    const classes = rundownMatch[1];
    if (!classes.includes('flex-1') || !classes.includes('h-full')) {
      findings.push('presenter-rundown-list missing flex-1 h-full for vertical fill');
    }
    // 3. Must NOT carry restrictive lg:max-h-[30rem] cap
    if (classes.includes('lg:max-h-[30rem]')) {
      findings.push('presenter-rundown-list still carries restrictive lg:max-h-[30rem] cap');
    }
    // 4. Must maintain mobile containment max-lg:max-h-[45vh]
    if (!classes.includes('max-lg:max-h-[45vh]')) {
      findings.push('presenter-rundown-list missing max-lg:max-h-[45vh] mobile containment');
    }
  }

  return findings;
}

test('SPEC-85-03: RunSheetPage header action bar structural scan verifies semantic clusters', () => {
  const findings = scanRunSheetHeaderRedesign();
  assert.deepEqual(findings, [], `Expected 0 header redesign findings, got: ${findings.join(', ')}`);
});

test('SPEC-85-03: Presenter rundown panel vertical fill scan verifies expansion without 30rem cap', () => {
  const findings = scanPresenterRundownFill();
  assert.deepEqual(findings, [], `Expected 0 rundown fill findings, got: ${findings.join(', ')}`);
});

test('SPEC-85-03: Defect injection proof — restoring lg:max-h-[30rem] triggers rundown fill guard finding', () => {
  const rawPresenter = fs.readFileSync(presenterOperatorPath, 'utf8');
  const defectiveSrc = rawPresenter.replace(
    'className="min-h-0 flex-1 h-full space-y-2 overflow-y-auto p-3 text-sm max-lg:max-h-[45vh]"',
    'className="min-h-0 flex-1 h-full space-y-2 overflow-y-auto p-3 text-sm max-lg:max-h-[45vh] lg:max-h-[30rem]"'
  );
  const findings = scanPresenterRundownFill({ presenterSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('still carries restrictive lg:max-h-[30rem] cap')),
    'Expected defect injection with lg:max-h-[30rem] to fail scan'
  );
});

test('SPEC-85-03: Defect injection proof — removing primary controls cluster triggers header guard finding', () => {
  const rawRunSheet = fs.readFileSync(runSheetPagePath, 'utf8');
  const defectiveSrc = rawRunSheet.replace('data-testid="header-primary-controls"', 'data-testid="unclustered-controls"');
  const findings = scanRunSheetHeaderRedesign({ runSheetSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing data-testid="header-primary-controls"')),
    'Expected defect injection without header-primary-controls to fail scan'
  );
});

test('SPEC-85-03: Defect injection proof — removing utility controls cluster triggers header guard finding', () => {
  const rawRunSheet = fs.readFileSync(runSheetPagePath, 'utf8');
  const defectiveSrc = rawRunSheet.replace('data-testid="header-utility-controls"', 'data-testid="unclustered-utility"');
  const findings = scanRunSheetHeaderRedesign({ runSheetSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing data-testid="header-utility-controls"')),
    'Expected defect injection without header-utility-controls to fail scan'
  );
});

test('SPEC-85-03: Defect injection proof — removing desktop inline alignment triggers header guard finding', () => {
  const rawRunSheet = fs.readFileSync(runSheetPagePath, 'utf8');
  const defectiveSrc = rawRunSheet.replace(
    'lg:flex-row lg:items-center lg:justify-between',
    'flex-col'
  );
  const findings = scanRunSheetHeaderRedesign({ runSheetSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing lg:flex-row lg:items-center lg:justify-between')),
    'Expected defect injection without desktop alignment to fail scan'
  );
});
