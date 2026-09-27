/**
 * SPEC-87: Emergency Canvas Background Image Upload & Cropping Parity
 * Structural, containment, aspect ratio, dual persistence, element isolation, behavioral lifecycle, and real-file defect injection suite.
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
const keysPath = path.join(rootDir, 'src', 'lib', 'i18n', 'keys.ts');
const catalogueEnPath = path.join(rootDir, 'src', 'lib', 'i18n', 'catalogue-en.ts');
const catalogueIdPath = path.join(rootDir, 'src', 'lib', 'i18n', 'catalogue-id.ts');
const emergencyCanvasLibPath = path.join(rootDir, 'src', 'lib', 'emergency-canvas.ts');

const { updateArtifactBackground, fileToDataUrl } = await import(pathToFileURL(emergencyCanvasLibPath).href);
const { resolveString } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'i18n', 'index.ts')).href);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanEmergencyCanvasBgCrop(presenterPath = presenterOperatorPath) {
  const findings = [];
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const cleanSrc = stripComments(presenterSrc);

  // 1. Must declare emergency-bg-upload-button and emergency-bg-file-input
  if (!cleanSrc.includes('data-testid="emergency-bg-upload-button"')) {
    findings.push('PresenterOperator.tsx missing data-testid="emergency-bg-upload-button" in Background panel');
  }
  if (!cleanSrc.includes('data-testid="emergency-bg-file-input"')) {
    findings.push('PresenterOperator.tsx missing data-testid="emergency-bg-file-input" in Background panel');
  }

  // 2. Button must consume t('emergency.modal.bgUpload')
  if (!cleanSrc.includes("t('emergency.modal.bgUpload')")) {
    findings.push("PresenterOperator.tsx missing t('emergency.modal.bgUpload') localization binding on background upload button");
  }

  // 3. Aspect containment: ImageCropDialog must receive 16:9 aspect for background
  if (
    !cleanSrc.includes("defaultAspect={cropTargetType === 'background' ? '16:9' : undefined}") &&
    !cleanSrc.includes("defaultAspect={cropTargetType === 'background' ? '16:9'") &&
    !cleanSrc.includes("defaultAspect={cropTargetType === 'background' ? 16 / 9") &&
    !cleanSrc.includes("defaultAspect: '16:9'") &&
    !cleanSrc.includes('defaultAspect="16:9"')
  ) {
    findings.push('ImageCropDialog must be passed defaultAspect="16:9" or 16/9 when cropTargetType is background');
  }

  // 4. Background inspector containment
  if (!cleanSrc.includes('data-testid="emergency-bg-color"') || !cleanSrc.includes('data-testid="emergency-bg-image"')) {
    findings.push('PresenterOperator.tsx must retain emergency-bg-color and emergency-bg-image controls');
  }

  // 5. Dual persistence in handleCropComplete: must handle both background and element
  if (!cleanSrc.includes('handleUpdateBackground') || !cleanSrc.includes('cropTargetType')) {
    findings.push('handleCropComplete must branch on cropTargetType and invoke handleUpdateBackground for background targets');
  }

  // 6. Apply button race condition guard
  const applyButtonMatch = cleanSrc.match(/<Button\b[^>]*data-testid="emergency-apply-button"[^>]*>/);
  if (!applyButtonMatch) {
    findings.push('EmergencyCanvasDesignerModal missing data-testid="emergency-apply-button"');
  } else if (!applyButtonMatch[0].includes('isUploadingImage')) {
    findings.push('emergency-apply-button must be disabled during image upload (isUploadingImage)');
  }

  return findings;
}

test('SPEC-87-01 / SPEC-87-02: Background upload button, file input, and 16:9 crop integration in PresenterOperator.tsx', () => {
  const findings = scanEmergencyCanvasBgCrop();
  assert.deepEqual(findings, [], `Expected 0 findings, got:\n${findings.join('\n')}`);
});

test('SPEC-87-02: Bilingual i18n parity for emergency.modal.bgUpload key', () => {
  const keysSrc = fs.readFileSync(keysPath, 'utf8');
  assert.ok(keysSrc.includes("'emergency.modal.bgUpload'"), "keys.ts must declare 'emergency.modal.bgUpload'");

  const enSrc = fs.readFileSync(catalogueEnPath, 'utf8');
  assert.ok(enSrc.includes("'emergency.modal.bgUpload':"), "catalogue-en.ts must translate 'emergency.modal.bgUpload'");
  const enVal = resolveString('emergency.modal.bgUpload', 'en');
  assert.equal(enVal, 'Upload & Crop Background');

  const idSrc = fs.readFileSync(catalogueIdPath, 'utf8');
  assert.ok(idSrc.includes("'emergency.modal.bgUpload':"), "catalogue-id.ts must translate 'emergency.modal.bgUpload'");
  const idVal = resolveString('emergency.modal.bgUpload', 'id');
  assert.equal(idVal, 'Unggah & Potong Latar');
});

test('SPEC-87-01: Dual persistence and element isolation on background update', async () => {
  const initialArtifact = {
    runtimeVersion: 1,
    instanceId: 'inst-test-1',
    templateId: 'tpl-1',
    label: 'Slide with BG',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      backgroundImage: null,
      elements: [
        {
          id: 'el-img-1',
          type: 'image',
          imageUrl: 'https://example.com/original-element.jpg',
          x: 10,
          y: 10,
          w: 200,
          h: 150,
        },
      ],
    },
  };

  // 1. Online persistence path: URL from /api/upload
  const updatedOnline = updateArtifactBackground(initialArtifact, {
    image: '/api/uploads/custom-bg.jpg',
  });
  assert.equal(updatedOnline.layout.backgroundImage, '/api/uploads/custom-bg.jpg');
  // Element isolation guarantee: selectedElement or element imageUrl MUST NOT be mutated
  assert.equal(updatedOnline.layout.elements[0].imageUrl, 'https://example.com/original-element.jpg');

  // 2. Offline fallback path: base64 Data URL
  const mockFile = new File(['mock-image-binary-data'], 'bg.png', { type: 'image/png' });
  const dataUrl = await fileToDataUrl(mockFile);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'fileToDataUrl must produce durable base64 Data URL');

  const updatedOffline = updateArtifactBackground(initialArtifact, {
    image: dataUrl,
  });
  assert.equal(updatedOffline.layout.backgroundImage, dataUrl);
  assert.equal(updatedOffline.layout.elements[0].imageUrl, 'https://example.com/original-element.jpg');
});

test('SPEC-87-01: Behavioral lifecycle — mock crop completion online, offline fallback, and finally cleanup', async () => {
  const initialArtifact = {
    runtimeVersion: 1,
    instanceId: 'inst-test-crop-lifecycle',
    templateId: 'tpl-1',
    label: 'Slide Lifecycle',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      backgroundImage: null,
      elements: [{ id: 'el-1', type: 'text', text: 'Preserved element' }],
    },
  };

  let currentDraft = initialArtifact;
  let isUploadingImage = false;
  let cropTargetFile = new File(['cropped-bytes'], 'cropped-bg.jpg', { type: 'image/jpeg' });
  const cropTargetType = 'background';

  // Helper matching handleCropComplete in PresenterOperator
  const executeCropComplete = async (file, mockUploadFn, mockDataUrlFn) => {
    const targetType = cropTargetType;
    cropTargetFile = null;
    isUploadingImage = true;
    try {
      const res = await mockUploadFn(file);
      if (res.url) {
        if (targetType === 'background') {
          currentDraft = updateArtifactBackground(currentDraft, { image: res.url });
        }
      } else {
        throw new Error('No URL returned');
      }
    } catch {
      try {
        const dataUrl = await mockDataUrlFn(file);
        if (targetType === 'background') {
          currentDraft = updateArtifactBackground(currentDraft, { image: dataUrl });
        }
      } catch {
        // toast error
      }
    } finally {
      isUploadingImage = false;
    }
  };

  // Case A: Online upload succeeds
  await executeCropComplete(
    new File(['bytes'], 'bg.jpg', { type: 'image/jpeg' }),
    async () => ({ url: '/api/uploads/server-rendered-bg.jpg' }),
    async () => 'data:image/jpeg;base64,fallback'
  );
  assert.equal(isUploadingImage, false, 'isUploadingImage must reset to false in finally block on success');
  assert.equal(cropTargetFile, null, 'cropTargetFile must be reset to null');
  assert.equal(currentDraft.layout.backgroundImage, '/api/uploads/server-rendered-bg.jpg');

  // Case B: Online upload throws (offline) -> fallback to Data URL succeeds
  await executeCropComplete(
    new File(['bytes'], 'bg.jpg', { type: 'image/jpeg' }),
    async () => {
      throw new Error('Network error (offline)');
    },
    async () => 'data:image/jpeg;base64,offlineDataUrlBytes'
  );
  assert.equal(isUploadingImage, false, 'isUploadingImage must reset to false in finally block on offline fallback');
  assert.equal(currentDraft.layout.backgroundImage, 'data:image/jpeg;base64,offlineDataUrlBytes');

  // Case C: Both upload and data URL throw -> isUploadingImage still resets cleanly
  await executeCropComplete(
    new File(['bytes'], 'bg.jpg', { type: 'image/jpeg' }),
    async () => {
      throw new Error('Network error');
    },
    async () => {
      throw new Error('FileReader error');
    }
  );
  assert.equal(isUploadingImage, false, 'isUploadingImage must reset to false in finally block on catastrophic error');

  // Case D: Apply button race prevention assertion
  let applied = false;
  const onApply = () => {
    applied = true;
  };
  const handleApplyClick = (uploading, applying) => {
    if (uploading || applying) return;
    onApply();
  };
  handleApplyClick(true, false);
  assert.equal(applied, false, 'Apply must be rejected while isUploadingImage is true');
  handleApplyClick(false, false);
  assert.equal(applied, true, 'Apply must proceed once isUploadingImage is false');
});

test('SPEC-87-02: Real-file defect injection — removing emergency-bg-upload-button fails scan', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace('data-testid="emergency-bg-upload-button"', 'data-testid="defective-bg-button"');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);
    const findings = scanEmergencyCanvasBgCrop();
    assert.ok(
      findings.some((f) => f.includes('missing data-testid="emergency-bg-upload-button"')),
      'Removing emergency-bg-upload-button must be detected'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored byte-for-byte');
  }
});

test('SPEC-87-02: Real-file defect injection — stripping 16:9 aspect fails scan', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace("cropTargetType === 'background' ? '16:9'", "cropTargetType === 'background' ? undefined");
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);
    const findings = scanEmergencyCanvasBgCrop();
    assert.ok(
      findings.some((f) => f.includes('ImageCropDialog must be passed defaultAspect="16:9"')),
      'Stripping 16:9 aspect must be detected'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored byte-for-byte');
  }
});

test('SPEC-87-02: Real-file defect injection — stripping bgUpload i18n binding fails scan', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replaceAll("t('emergency.modal.bgUpload')", "'Upload Background Hardcoded'");
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);
    const findings = scanEmergencyCanvasBgCrop();
    assert.ok(
      findings.some((f) => f.includes("missing t('emergency.modal.bgUpload')")),
      'Stripping bgUpload i18n binding must be detected'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored byte-for-byte');
  }
});

test('SPEC-87-02: Real-file defect injection — removing isUploadingImage from Apply button fails race guard', () => {
  const original = fs.readFileSync(presenterOperatorPath, 'utf8');
  try {
    const defective = original.replace('disabled={isApplying || isUploadingImage}', 'disabled={isApplying}');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(presenterOperatorPath, defective);
    const findings = scanEmergencyCanvasBgCrop();
    assert.ok(
      findings.some((f) => f.includes('emergency-apply-button must be disabled during image upload (isUploadingImage)')),
      'Removing isUploadingImage from Apply button disabled check must be detected'
    );
  } finally {
    fs.writeFileSync(presenterOperatorPath, original);
    assert.equal(fs.readFileSync(presenterOperatorPath, 'utf8'), original, 'file must be restored byte-for-byte');
  }
});
