/**
 * SPEC-86-01: Run-Sheet Header 50:50 Layout & Tiered Action Clusters
 * Unit, structural, layout hierarchy, fail-closed containment, and real-file defect injection test suite.
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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanRunSheetHeaderTieredLayout(runSheetPath = runSheetPagePath) {
  const findings = [];
  const runSheetSrc = fs.readFileSync(runSheetPath, 'utf8');
  const cleanSrc = stripComments(runSheetSrc);

  // 1. Header must divide into a 2-column grid layout on desktop viewports (50:50 structure)
  if (!cleanSrc.includes('data-testid="run-sheet-header"')) {
    findings.push('RunSheetPage.tsx missing data-testid="run-sheet-header"');
  }
  const headerMatch = cleanSrc.match(/<header\b[^>]*data-testid="run-sheet-header"[^>]*className="([^"]*)"/);
  if (!headerMatch) {
    findings.push('RunSheetPage.tsx missing className on run-sheet-header');
  } else {
    const classes = headerMatch[1];
    if (!classes.includes('grid') || !classes.includes('lg:grid-cols-2')) {
      findings.push('run-sheet-header missing grid and lg:grid-cols-2 for 50:50 two-column layout');
    }
  }

  // 2. Title container enforces line-break prevention (truncate / whitespace-nowrap independently) & native title attribute
  const titleMatch = cleanSrc.match(/<h1\b[^>]*className="([^"]*)"[^>]*title=\{([^}]+)\}[^>]*>/);
  if (!titleMatch) {
    findings.push('Service title missing required h1 element with className and native title attribute');
  } else {
    const classes = titleMatch[1];
    const titleAttr = titleMatch[2];
    if (!classes.includes('truncate')) {
      findings.push('Service title missing truncate for line-break prevention');
    }
    if (!classes.includes('whitespace-nowrap')) {
      findings.push('Service title missing whitespace-nowrap for line-break prevention');
    }
    if (!titleAttr.includes('svc.date') || !titleAttr.includes('svc.id')) {
      findings.push('Service title attribute does not preserve full dynamic title (svc.date || svc.id)');
    }
  }

  // 3. Right column separates OfflineReadinessBadge into Row 1, Primary into Row 2, Utility into Row 3
  const offlineRowIndex = cleanSrc.indexOf('data-testid="header-offline-row"');
  const primaryControlsIndex = cleanSrc.indexOf('data-testid="header-primary-controls"');
  const utilityControlsIndex = cleanSrc.indexOf('data-testid="header-utility-controls"');

  if (offlineRowIndex === -1) {
    findings.push('RunSheetPage.tsx missing data-testid="header-offline-row" for Row 1 status visibility');
  }
  if (primaryControlsIndex === -1) {
    findings.push('RunSheetPage.tsx missing data-testid="header-primary-controls" for Row 2 primary actions');
  }
  if (utilityControlsIndex === -1) {
    findings.push('RunSheetPage.tsx missing data-testid="header-utility-controls" for Row 3 utility actions');
  }

  // Verify sequential vertical hierarchy: Row 1 (Offline) < Row 2 (Primary) < Row 3 (Utility)
  if (offlineRowIndex !== -1 && primaryControlsIndex !== -1 && utilityControlsIndex !== -1) {
    if (!(offlineRowIndex < primaryControlsIndex && primaryControlsIndex < utilityControlsIndex)) {
      findings.push('Header action clusters do not follow ordered vertical hierarchy (Row 1 Offline < Row 2 Primary < Row 3 Utility)');
    }
  }

  // Fail-closed containment: OfflineReadinessBadge must be within header-offline-row
  const offlineRowMatch = cleanSrc.match(/<div\b[^>]*data-testid="header-offline-row"[\s\S]*?<\/div>/);
  if (!offlineRowMatch) {
    findings.push('data-testid="header-offline-row" container element not found for containment check');
  } else if (!offlineRowMatch[0].includes('<OfflineReadinessBadge')) {
    findings.push('OfflineReadinessBadge must be contained inside data-testid="header-offline-row"');
  }

  // Fail-closed containment: Primary actions must be within header-primary-controls
  const primaryMatch = cleanSrc.match(/<div\b[^>]*data-testid="header-primary-controls"[\s\S]*?<\/div>/);
  if (!primaryMatch) {
    findings.push('data-testid="header-primary-controls" container element not found for containment check');
  } else if (
    !primaryMatch[0].includes("t('edit.actions.present')") ||
    !primaryMatch[0].includes("t('edit.actions.preview')") ||
    !primaryMatch[0].includes("t('edit.actions.remote')")
  ) {
    findings.push('Present, Preview, and Remote links must be contained inside data-testid="header-primary-controls"');
  }

  // Fail-closed containment: Utility actions must be within header-utility-controls
  const utilityMatch = cleanSrc.match(/<div\b[^>]*data-testid="header-utility-controls"[\s\S]*?<\/div>\s*<\/div>\s*<\/header>/);
  if (!utilityMatch) {
    findings.push('data-testid="header-utility-controls" container element not found for containment check');
  } else if (
    !utilityMatch[0].includes('SyncArtifactButton') ||
    !utilityMatch[0].includes("t('edit.actions.downloadPptx')")
  ) {
    findings.push('SyncArtifactButton and Download PPTX controls must be contained inside data-testid="header-utility-controls"');
  }

  // Verify vertical tiered hierarchy in right column actions wrapper
  const actionsWrapperMatch = cleanSrc.match(/<div\b[^>]*data-testid="header-actions-wrapper"[^>]*className="([^"]*)"/);
  if (!actionsWrapperMatch) {
    findings.push('RunSheetPage.tsx missing header-actions-wrapper');
  } else {
    const classes = actionsWrapperMatch[1];
    if (!classes.includes('flex-col')) {
      findings.push('header-actions-wrapper missing flex-col for tiered row stacking');
    }
  }

  return findings;
}

test('SPEC-86-01: RunSheetPage header 50:50 grid layout, containment, and line-break prevention', () => {
  const findings = scanRunSheetHeaderTieredLayout();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-86-01: Real-file defect injection — unconstrained flex layout fails 50:50 grid guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    const defective = original.replace(
      'className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4 border-b border-border/80 pb-4 items-start"',
      'className="mb-8 flex flex-col gap-4 border-b border-border/80 pb-4"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('missing grid and lg:grid-cols-2')),
      'Expected real-file defect injection without grid 50:50 to fail guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — missing truncate alone fails title guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    const defective = original.replace('truncate ', '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('Service title missing truncate')),
      'Expected real-file defect injection without truncate alone to fail guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — missing whitespace-nowrap alone fails title guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    const defective = original.replace(' whitespace-nowrap', '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('Service title missing whitespace-nowrap')),
      'Expected real-file defect injection without whitespace-nowrap alone to fail guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — missing native title attribute fails accessibility guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    const defective = original.replace(/title=\{`Run-Sheet: \$\{svc\.date \|\| svc\.id\}`\}/, '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('missing required h1 element with className and native title attribute')),
      'Expected real-file defect injection without title attribute to fail guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — moving OfflineReadinessBadge outside offline row fails containment guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    // Defect: Empty header-offline-row and displace badge to meta cluster
    const defective = original
      .replace(
        '<OfflineReadinessBadge serviceId={svc.id} serviceData={svc} />',
        '{/* displaced badge */}'
      )
      .replace(
        '<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>',
        '<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>\n          <OfflineReadinessBadge serviceId={svc.id} serviceData={svc} />'
      );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('OfflineReadinessBadge must be contained inside data-testid="header-offline-row"')),
      'Expected defect injection moving badge outside offline row to fail containment guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — displacing primary action links outside primary controls fails containment guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    // Defect: Remove Present link from header-primary-controls and displace it outside into header-meta-cluster
    const presentLinkRegex = /<Link\s+href=\{`\/services\/\$\{svc\.id\}\/present`\}[\s\S]*?<\/Link>/;
    const match = original.match(presentLinkRegex);
    assert.ok(match, 'must match present link in original source');
    const presentLinkBlock = match[0];

    const defective = original
      .replace(presentLinkBlock, '{/* displaced present link */}')
      .replace(
        '<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>',
        `<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>\n          ${presentLinkBlock}`
      );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('Present, Preview, and Remote links must be contained inside data-testid="header-primary-controls"')),
      'Expected defect injection displacing primary links to fail containment guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — displacing utility controls outside utility controls fails containment guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    // Defect: Remove Download PPTX split-button from header-utility-controls and displace it outside into header-meta-cluster
    const pptxSplitButtonRegex = /<div className="inline-flex rounded-md shadow-xs">[\s\S]*?<\/DropdownMenu>\s*<\/div>/;
    const match = original.match(pptxSplitButtonRegex);
    assert.ok(match, 'must match pptx split button block in original source');
    const splitButtonBlock = match[0];

    const defective = original
      .replace(splitButtonBlock, '{/* displaced download pptx */}')
      .replace(
        '<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>',
        `<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>\n          ${splitButtonBlock}`
      );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('SyncArtifactButton and Download PPTX controls must be contained inside data-testid="header-utility-controls"')),
      'Expected defect injection displacing utility controls to fail containment guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — collapsing actions into single unconstrained flex-wrap row fails tiered cluster guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    // Defect: Replace the structured tiered wrapper and all 3 rows with an unconstrained single flex-wrap bar
    const tieredBlockRegex = /<div data-testid="header-actions-wrapper"[\s\S]*?<\/header>/;
    const collapsedDefectiveBlock = `<div data-testid="header-actions-wrapper" className="flex flex-wrap items-center gap-2">
          <OfflineReadinessBadge serviceId={svc.id} serviceData={svc} />
          <Link href={\`/services/\${svc.id}/present\`}>{t('edit.actions.present')}</Link>
          <Link href={\`/services/\${svc.id}/slideshow\`}>{t('edit.actions.preview')}</Link>
          <Link href={\`/services/\${svc.id}/remote\`}>{t('edit.actions.remote')}</Link>
        </div>
      </header>`;
    const defective = original.replace(tieredBlockRegex, collapsedDefectiveBlock);
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('missing data-testid="header-offline-row"') || f.includes('missing flex-col')),
      'Expected real-file defect injection collapsing into single flex-wrap bar to fail guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-01: Real-file defect injection — inverted tier order fails sequential hierarchy guard', () => {
  const original = fs.readFileSync(runSheetPagePath, 'utf8');
  try {
    // Defect: Invert tier order (put Utility before Offline)
    const defective = original.replace(
      'data-testid="header-offline-row"',
      'data-testid="header-temp-row"'
    ).replace(
      'data-testid="header-utility-controls"',
      'data-testid="header-offline-row"'
    ).replace(
      'data-testid="header-temp-row"',
      'data-testid="header-utility-controls"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(runSheetPagePath, defective);

    const findings = scanRunSheetHeaderTieredLayout();
    assert.ok(
      findings.some((f) => f.includes('do not follow ordered vertical hierarchy')),
      'Expected inverted tier order to fail sequential hierarchy guard'
    );
  } finally {
    fs.writeFileSync(runSheetPagePath, original);
    assert.equal(fs.readFileSync(runSheetPagePath, 'utf8'), original, 'file must be restored identically');
  }
});
