/**
 * SPEC-86-05: Emergency Canvas Inspector Shape Guard & Image Cropping Parity
 * Unit, structural branching hierarchy, fail-closed containment, and real-file defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const presenterOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const emergencyCanvasLibPath = path.join(rootDir, 'src', 'lib', 'emergency-canvas.ts');

const {
  updateElementImage,
  updateElementGeometry,
  updateElementStyle,
  fileToDataUrl,
} = await import(pathToFileURL(emergencyCanvasLibPath).href);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanEmergencyCanvasInspector(presenterPath = presenterOperatorPath) {
  const findings = [];
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const cleanSrc = stripComments(presenterSrc);

  // 1. Must declare type-specific inspector panels
  if (!cleanSrc.includes('data-testid="inspector-text-panel"')) {
    findings.push('PresenterOperator.tsx missing data-testid="inspector-text-panel" for text element inspection');
  }
  if (!cleanSrc.includes('data-testid="inspector-shape-panel"')) {
    findings.push('PresenterOperator.tsx missing data-testid="inspector-shape-panel" for shape element inspection');
  }
  if (!cleanSrc.includes('data-testid="inspector-line-panel"')) {
    findings.push('PresenterOperator.tsx missing data-testid="inspector-line-panel" for line element inspection');
  }
  if (!cleanSrc.includes('data-testid="inspector-image-panel"')) {
    findings.push('PresenterOperator.tsx missing data-testid="inspector-image-panel" for image element inspection');
  }

  // 2. Shape panel containment & exclusivity
  const shapeMatch = cleanSrc.match(/<div\b[^>]*data-testid="inspector-shape-panel"[\s\S]*?<\/div>\s*\)\}/);
  if (!shapeMatch) {
    findings.push('inspector-shape-panel container not found for containment scan');
  } else {
    const shapeSnippet = shapeMatch[0];
    if (!shapeSnippet.includes('data-testid="emergency-shape-fill"')) {
      findings.push('inspector-shape-panel must contain emergency-shape-fill');
    }
    if (!shapeSnippet.includes('data-testid="emergency-shape-opacity"')) {
      findings.push('inspector-shape-panel must contain emergency-shape-opacity');
    }
    if (!shapeSnippet.includes('data-testid="emergency-shape-stroke-color"')) {
      findings.push('inspector-shape-panel must contain emergency-shape-stroke-color');
    }
    if (!shapeSnippet.includes('data-testid="emergency-shape-stroke-width"')) {
      findings.push('inspector-shape-panel must contain emergency-shape-stroke-width');
    }
    if (
      shapeSnippet.includes('data-testid="emergency-image-url"') ||
      shapeSnippet.includes('data-testid="emergency-image-upload-button"') ||
      shapeSnippet.includes('data-testid="emergency-image-fit"')
    ) {
      findings.push('inspector-shape-panel must NOT contain image controls (image URL, upload button, fit dropdown)');
    }
  }

  // 3. Line panel containment & exclusivity
  const lineMatch = cleanSrc.match(/<div\b[^>]*data-testid="inspector-line-panel"[\s\S]*?<\/div>\s*\)\}/);
  if (!lineMatch) {
    findings.push('inspector-line-panel container not found for containment scan');
  } else {
    const lineSnippet = lineMatch[0];
    if (!lineSnippet.includes('data-testid="emergency-line-color"')) {
      findings.push('inspector-line-panel must contain emergency-line-color');
    }
    if (!lineSnippet.includes('data-testid="emergency-line-width"')) {
      findings.push('inspector-line-panel must contain emergency-line-width');
    }
    if (!lineSnippet.includes('data-testid="emergency-line-opacity"')) {
      findings.push('inspector-line-panel must contain emergency-line-opacity');
    }
    if (
      lineSnippet.includes('data-testid="emergency-image-url"') ||
      lineSnippet.includes('data-testid="emergency-image-upload-button"') ||
      lineSnippet.includes('data-testid="emergency-image-fit"')
    ) {
      findings.push('inspector-line-panel must NOT contain image controls');
    }
  }

  // 4. Image panel containment & exclusivity
  const imageMatch = cleanSrc.match(/<div\b[^>]*data-testid="inspector-image-panel"[\s\S]*?<\/div>\s*\)\}/);
  if (!imageMatch) {
    findings.push('inspector-image-panel container not found for containment scan');
  } else {
    const imageSnippet = imageMatch[0];
    if (!imageSnippet.includes('data-testid="emergency-image-upload-button"')) {
      findings.push('inspector-image-panel must contain emergency-image-upload-button');
    }
    if (!imageSnippet.includes('data-testid="emergency-image-url"')) {
      findings.push('inspector-image-panel must contain emergency-image-url');
    }
    if (!imageSnippet.includes('data-testid="emergency-image-fit"')) {
      findings.push('inspector-image-panel must contain emergency-image-fit');
    }
    if (!imageSnippet.includes('data-testid="emergency-image-file-input"')) {
      findings.push('inspector-image-panel must contain emergency-image-file-input');
    }
    if (
      imageSnippet.includes('data-testid="emergency-edit-textarea"') ||
      imageSnippet.includes('data-testid="emergency-font-family"') ||
      imageSnippet.includes('data-testid="emergency-font-size"')
    ) {
      findings.push('inspector-image-panel must NOT contain text typography controls');
    }
  }

  // 5. ImageCropDialog integration in EmergencyCanvasDesignerModal
  if (!cleanSrc.includes('<ImageCropDialog') || !cleanSrc.includes('handleCropComplete')) {
    findings.push('EmergencyCanvasDesignerModal missing ImageCropDialog integration with handleCropComplete');
  }

  // 6. Apply button must guard against race by checking isUploadingImage
  const applyButtonMatch = cleanSrc.match(/<Button\b[^>]*data-testid="emergency-apply-button"[^>]*>/);
  if (!applyButtonMatch) {
    findings.push('EmergencyCanvasDesignerModal missing data-testid="emergency-apply-button"');
  } else if (!applyButtonMatch[0].includes('isUploadingImage')) {
    findings.push('emergency-apply-button must be disabled during image upload (isUploadingImage)');
  }

  return findings;
}

test('SPEC-86-05: EmergencyCanvasDesignerModal element inspector branching and image cropping integration', () => {
  const findings = scanEmergencyCanvasInspector();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-86-05: updateElementImage updates imageUrl on artifact element without creating imageRef', () => {
  const mockArtifact = {
    runtimeVersion: 1,
    instanceId: 'inst-1',
    templateId: 'tpl-1',
    label: 'Slide',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      elements: [
        {
          id: 'el-img-1',
          type: 'image',
          x: 10,
          y: 10,
          w: 40,
          h: 40,
          zIndex: 1,
          imageUrl: '/assets/original.jpg',
          style: { objectFit: 'contain' },
        },
      ],
    },
  };

  const updated = updateElementImage(mockArtifact, 'el-img-1', '/api/uploads/cropped-12345.png', 'cover');
  const targetEl = updated.layout.elements.find((el) => el.id === 'el-img-1');
  assert.equal(targetEl.imageUrl, '/api/uploads/cropped-12345.png');
  assert.equal(targetEl.style.objectFit, 'cover');
  assert.equal(targetEl.imageRef, undefined, 'Runtime ResolvedElement must NOT carry imageRef');
});

test('SPEC-86-05: updateElementImage enforces type safety: rejects mutating non-image elements', () => {
  const mockArtifact = {
    runtimeVersion: 1,
    instanceId: 'inst-1',
    templateId: 'tpl-1',
    label: 'Slide',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      elements: [
        {
          id: 'el-shape-1',
          type: 'shape',
          x: 10,
          y: 10,
          w: 40,
          h: 40,
          zIndex: 1,
          style: { fillColor: '#FFFFFF' },
        },
        {
          id: 'el-text-1',
          type: 'text',
          x: 10,
          y: 60,
          w: 80,
          h: 20,
          zIndex: 2,
          text: 'Title text',
          style: { fontColor: '#FFFFFF' },
        },
      ],
    },
  };

  // Attempt to mutate shape element with imageUrl
  const updatedShape = updateElementImage(mockArtifact, 'el-shape-1', '/api/uploads/injected.png', 'cover');
  const shapeEl = updatedShape.layout.elements.find((el) => el.id === 'el-shape-1');
  assert.equal(shapeEl.imageUrl, undefined, 'updateElementImage must reject assigning imageUrl to shape elements');

  // Attempt to mutate text element with imageUrl
  const updatedText = updateElementImage(mockArtifact, 'el-text-1', '/api/uploads/injected.png', 'cover');
  const textEl = updatedText.layout.elements.find((el) => el.id === 'el-text-1');
  assert.equal(textEl.imageUrl, undefined, 'updateElementImage must reject assigning imageUrl to text elements');
});

test('SPEC-86-05: fileToDataUrl converts Blob/File into durable base64 Data URL for offline resilience', async () => {
  const sampleBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
  const blob = new Blob([sampleBytes], { type: 'image/png' });

  const dataUrl = await fileToDataUrl(blob);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'fileToDataUrl must produce durable base64 data URL');
  assert.ok(!dataUrl.startsWith('blob:'), 'must NOT produce session-scoped ephemeral blob URL');
});

test('SPEC-86-05: updateElementGeometry updates rotation and clamps finite values', () => {
  const mockArtifact = {
    runtimeVersion: 1,
    instanceId: 'inst-1',
    templateId: 'tpl-1',
    label: 'Slide',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      elements: [
        {
          id: 'el-shape-1',
          type: 'shape',
          x: 20,
          y: 20,
          w: 30,
          h: 30,
          zIndex: 1,
          style: { fillColor: '#FF0000' },
        },
      ],
    },
  };

  const updated = updateElementGeometry(mockArtifact, 'el-shape-1', { rotation: 45 });
  const targetEl = updated.layout.elements.find((el) => el.id === 'el-shape-1');
  assert.equal(targetEl.rotation, 45, 'Rotation angle must update cleanly');

  // Modular wrapping for negative rotation: -90 degrees -> 270 degrees
  const wrapped = updateElementGeometry(mockArtifact, 'el-shape-1', { rotation: -90 });
  const wrappedEl = wrapped.layout.elements.find((el) => el.id === 'el-shape-1');
  assert.equal(wrappedEl.rotation, 270, 'Negative rotation must wrap into [0, 360)');
});

test('SPEC-86-05: Real-file defect injection — injecting image controls into shape panel fails guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="inspector-shape-panel">',
      'data-testid="inspector-shape-panel">\n                    <input data-testid="emergency-image-url" />'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanEmergencyCanvasInspector();
    assert.ok(
      findings.some((f) => f.includes('inspector-shape-panel must NOT contain image controls')),
      'Expected injecting image controls into shape panel to fail guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-05: Real-file defect injection — removing upload button from image panel fails guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="emergency-image-upload-button"',
      'data-testid="unlabeled-upload-button"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanEmergencyCanvasInspector();
    assert.ok(
      findings.some((f) => f.includes('inspector-image-panel must contain emergency-image-upload-button')),
      'Expected removing upload button from image panel to fail guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-05: Real-file defect injection — injecting image controls into line panel fails guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="inspector-line-panel">',
      'data-testid="inspector-line-panel">\n                    <input data-testid="emergency-image-url" />'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanEmergencyCanvasInspector();
    assert.ok(
      findings.some((f) => f.includes('inspector-line-panel must NOT contain image controls')),
      'Expected injecting image controls into line panel to fail guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-05: Real-file defect injection — stripping ImageCropDialog fails integration guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace('<ImageCropDialog', '<DisabledCropDialog');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanEmergencyCanvasInspector();
    assert.ok(
      findings.some((f) => f.includes('missing ImageCropDialog integration')),
      'Expected stripping ImageCropDialog to fail integration guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-05: Real-file defect injection — removing isUploadingImage from Apply button disabled check fails race guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace(
      'disabled={isApplying || isUploadingImage}',
      'disabled={isApplying}'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);

    const findings = scanEmergencyCanvasInspector();
    assert.ok(
      findings.some((f) => f.includes('emergency-apply-button must be disabled during image upload')),
      'Expected removing isUploadingImage check to fail race guard'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored identically');
  }
});
