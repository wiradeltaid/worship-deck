/**
 * SPEC-86-03: Slide Thumbnail List Hover-Only Visibility State
 * Unit, structural styling hierarchy, fail-closed containment, and real-file defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const slidePreviewListPath = path.join(rootDir, 'src', 'components', 'SlidePreviewList.tsx');

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanSlidePreviewHoverVisibility(previewPath = slidePreviewListPath) {
  const findings = [];
  const previewSrc = fs.readFileSync(previewPath, 'utf8');
  const cleanSrc = stripComments(previewSrc);

  // 1. Slide preview row container must carry data-testid="slide-preview-row" and 'group'
  if (!cleanSrc.includes('data-testid="slide-preview-row"')) {
    findings.push('SlidePreviewList.tsx missing data-testid="slide-preview-row"');
  }
  const rowMatch = cleanSrc.match(/<div\b[^>]*data-testid="slide-preview-row"[^>]*className=\{`([^`]+)`\}/);
  if (!rowMatch) {
    findings.push('data-testid="slide-preview-row" missing dynamic className template');
  } else {
    const classes = rowMatch[1];
    if (!classes.includes('group')) {
      findings.push('slide-preview-row missing "group" class for hover-group target');
    }
  }

  // 2. Visibility toggle button must carry opacity-0, group-hover:opacity-100, and focus-visible:opacity-100
  if (!cleanSrc.includes('data-testid="slide-visibility-toggle"')) {
    findings.push('SlidePreviewList.tsx missing data-testid="slide-visibility-toggle"');
  }
  const buttonMatch = cleanSrc.match(/<Button\b[^>]*data-testid="slide-visibility-toggle"[\s\S]*?className="([^"]*)"/);
  if (!buttonMatch) {
    findings.push('slide-visibility-toggle missing className for hover-state control');
  } else {
    const classes = buttonMatch[1];
    if (!classes.includes('opacity-0')) {
      findings.push('slide-visibility-toggle missing "opacity-0" for default hidden opacity');
    }
    if (!classes.includes('group-hover:opacity-100')) {
      findings.push('slide-visibility-toggle missing "group-hover:opacity-100" for hover reveal');
    }
    if (!classes.includes('focus-visible:opacity-100')) {
      findings.push('slide-visibility-toggle missing "focus-visible:opacity-100" for keyboard accessibility');
    }
    if (!classes.includes('transition-opacity')) {
      findings.push('slide-visibility-toggle missing "transition-opacity" for smooth visual reveal');
    }
  }

  // 3. Hidden badge must remain persistently visible without opacity-0 or group-hover restriction
  if (!cleanSrc.includes('data-testid="slide-hidden-badge"')) {
    findings.push('SlidePreviewList.tsx missing data-testid="slide-hidden-badge"');
  }
  const badgeMatch = cleanSrc.match(/<span\b[^>]*data-testid="slide-hidden-badge"[^>]*className="([^"]*)"/);
  if (!badgeMatch) {
    findings.push('slide-hidden-badge missing className');
  } else {
    const badgeClasses = badgeMatch[1];
    if (badgeClasses.includes('opacity-0') || badgeClasses.includes('group-hover')) {
      findings.push('slide-hidden-badge must NOT carry opacity-0 or group-hover (must remain persistently visible on hidden slides)');
    }
  }

  return findings;
}

test('SPEC-86-03: SlidePreviewList hover-only toggle visibility and persistent hidden badge', () => {
  const findings = scanSlidePreviewHoverVisibility();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-86-03: Real-file defect injection — removing group from row container fails hover guard', () => {
  const original = fs.readFileSync(slidePreviewListPath, 'utf8');
  try {
    const defective = original.replace('group relative ', '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(slidePreviewListPath, defective);

    const findings = scanSlidePreviewHoverVisibility();
    assert.ok(
      findings.some((f) => f.includes('missing "group" class')),
      'Expected removing group class to fail hover guard'
    );
  } finally {
    fs.writeFileSync(slidePreviewListPath, original);
    assert.equal(fs.readFileSync(slidePreviewListPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-03: Real-file defect injection — removing opacity-0 from toggle button fails default hidden guard', () => {
  const original = fs.readFileSync(slidePreviewListPath, 'utf8');
  try {
    const defective = original.replace('opacity-0 ', '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(slidePreviewListPath, defective);

    const findings = scanSlidePreviewHoverVisibility();
    assert.ok(
      findings.some((f) => f.includes('missing "opacity-0"')),
      'Expected removing opacity-0 to fail default hidden guard'
    );
  } finally {
    fs.writeFileSync(slidePreviewListPath, original);
    assert.equal(fs.readFileSync(slidePreviewListPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-03: Real-file defect injection — removing group-hover:opacity-100 fails hover reveal guard', () => {
  const original = fs.readFileSync(slidePreviewListPath, 'utf8');
  try {
    const defective = original.replace('group-hover:opacity-100 ', '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(slidePreviewListPath, defective);

    const findings = scanSlidePreviewHoverVisibility();
    assert.ok(
      findings.some((f) => f.includes('missing "group-hover:opacity-100"')),
      'Expected removing group-hover:opacity-100 to fail hover reveal guard'
    );
  } finally {
    fs.writeFileSync(slidePreviewListPath, original);
    assert.equal(fs.readFileSync(slidePreviewListPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-03: Real-file defect injection — removing focus-visible:opacity-100 fails keyboard accessibility guard', () => {
  const original = fs.readFileSync(slidePreviewListPath, 'utf8');
  try {
    const defective = original.replace('focus-visible:opacity-100', '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(slidePreviewListPath, defective);

    const findings = scanSlidePreviewHoverVisibility();
    assert.ok(
      findings.some((f) => f.includes('missing "focus-visible:opacity-100"')),
      'Expected removing focus-visible:opacity-100 to fail keyboard accessibility guard'
    );
  } finally {
    fs.writeFileSync(slidePreviewListPath, original);
    assert.equal(fs.readFileSync(slidePreviewListPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-03: Real-file defect injection — contaminating slide-hidden-badge with opacity-0 fails persistent visibility guard', () => {
  const original = fs.readFileSync(slidePreviewListPath, 'utf8');
  try {
    const badgeRegex = /data-testid="slide-hidden-badge"\s+className="/;
    assert.ok(badgeRegex.test(original), 'must match slide-hidden-badge in original');
    const defective = original.replace(
      badgeRegex,
      'data-testid="slide-hidden-badge"\n              className="opacity-0 group-hover:opacity-100 '
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(slidePreviewListPath, defective);

    const findings = scanSlidePreviewHoverVisibility();
    assert.ok(
      findings.some((f) => f.includes('slide-hidden-badge must NOT carry opacity-0')),
      'Expected contaminating badge with opacity-0 to fail persistent visibility guard'
    );
  } finally {
    fs.writeFileSync(slidePreviewListPath, original);
    assert.equal(fs.readFileSync(slidePreviewListPath, 'utf8'), original, 'file must be restored identically');
  }
});
