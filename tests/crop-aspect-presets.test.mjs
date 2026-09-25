/**
 * SPEC-80: Image Crop Aspect Ratio Presets and Original/Custom Aspect Handling (WSD-W1)
 *
 * Verifies:
 * 1. Preset ratio definitions: 16:9, 4:3, 1:1, 3:4, 2:3, 9:16, A4.
 * 2. Original aspect ratio derived from natural image dimensions (naturalWidth / naturalHeight) with finite guard.
 * 3. Custom ratio validation (strict positive finite numbers, rejecting partial non-numeric) and clamping between 0.1 and 10.0.
 * 4. Legacy defaultAspect null/undefined mapped to 'original' preset.
 * 5. Cropper aspect prop is guaranteed finite positive number (never undefined or null).
 * 6. Pan and zoom on-screen interaction hint text is present.
 * 7. Real-file defect injection proofs for aspect fallback absence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const cropImageUrl = pathToFileURL(
  path.join(root, 'src', 'lib', 'images', 'crop-image.ts')
).href;

const {
  ASPECT_RATIO_PRESETS,
  PRESET_NUMERICAL_ASPECTS,
  resolveDefaultPreset,
  resolveCustomAspect,
  calculateEffectiveAspect,
} = await import(cropImageUrl);

test('SPEC-80: all required aspect ratio presets are defined with correct values', () => {
  const presetIds = ASPECT_RATIO_PRESETS.map((p) => p.id);
  const expected = ['original', '16:9', '4:3', '1:1', '3:4', '2:3', '9:16', 'a4', 'custom'];
  assert.deepEqual(presetIds, expected, 'preset IDs must match exact specification');

  assert.equal(PRESET_NUMERICAL_ASPECTS['16:9'], 16 / 9);
  assert.equal(PRESET_NUMERICAL_ASPECTS['4:3'], 4 / 3);
  assert.equal(PRESET_NUMERICAL_ASPECTS['1:1'], 1);
  assert.equal(PRESET_NUMERICAL_ASPECTS['3:4'], 3 / 4);
  assert.equal(PRESET_NUMERICAL_ASPECTS['2:3'], 2 / 3);
  assert.equal(PRESET_NUMERICAL_ASPECTS['9:16'], 9 / 16);
  assert.equal(PRESET_NUMERICAL_ASPECTS['a4'], 210 / 297);
});

test('SPEC-80: original aspect ratio computes from naturalWidth and naturalHeight with finite safety guards', () => {
  // Landscape photo
  const res1 = calculateEffectiveAspect('original', { naturalWidth: 4000, naturalHeight: 2000 }, '16', '9');
  assert.equal(res1.isValid, true);
  assert.equal(res1.aspect, 2);

  // Portrait phone photo
  const res2 = calculateEffectiveAspect('original', { naturalWidth: 1080, naturalHeight: 1920 }, '16', '9');
  assert.equal(res2.isValid, true);
  assert.equal(res2.aspect, 1080 / 1920);

  // Square graphic
  const res3 = calculateEffectiveAspect('original', { naturalWidth: 1200, naturalHeight: 1200 }, '16', '9');
  assert.equal(res3.isValid, true);
  assert.equal(res3.aspect, 1);

  // Fallback when media not yet loaded: must return 1
  const resNull = calculateEffectiveAspect('original', null, '16', '9');
  assert.equal(resNull.isValid, true);
  assert.equal(resNull.aspect, 1, 'pre-load fallback must be 1 per SPEC-80');

  // Extreme / malformed dimensions safety guard (must return safe finite fallback 1)
  const resZero = calculateEffectiveAspect('original', { naturalWidth: 1000, naturalHeight: 0 }, '16', '9');
  assert.equal(resZero.aspect, 1, 'zero height must fall back to 1');
  assert.ok(Number.isFinite(resZero.aspect));

  const resInfinity = calculateEffectiveAspect('original', { naturalWidth: Infinity, naturalHeight: 1000 }, '16', '9');
  assert.equal(resInfinity.aspect, 1, 'infinite width must fall back to 1');
  assert.ok(Number.isFinite(resInfinity.aspect));

  const resNegative = calculateEffectiveAspect('original', { naturalWidth: -1000, naturalHeight: 500 }, '16', '9');
  assert.equal(resNegative.aspect, 1, 'negative dimensions must fall back to 1');
  assert.ok(Number.isFinite(resNegative.aspect));
});

test('SPEC-80: custom ratio validates strict positive finite numbers and clamps between 0.1 and 10.0', () => {
  // Valid standard custom
  const valid1 = resolveCustomAspect('21', '9');
  assert.equal(valid1.isValid, true);
  assert.equal(valid1.aspect, 21 / 9);

  // Clamping extreme wide ratio
  const extremeWide = resolveCustomAspect('100', '1');
  assert.equal(extremeWide.isValid, true);
  assert.equal(extremeWide.aspect, 10.0, 'must clamp to 10.0 max');

  // Clamping extreme tall ratio
  const extremeTall = resolveCustomAspect('1', '100');
  assert.equal(extremeTall.isValid, true);
  assert.equal(extremeTall.aspect, 0.1, 'must clamp to 0.1 min');

  // Negative and zero rejection
  assert.equal(resolveCustomAspect('0', '10').isValid, false);
  assert.equal(resolveCustomAspect('10', '0').isValid, false);
  assert.equal(resolveCustomAspect('-5', '10').isValid, false);
  assert.equal(resolveCustomAspect('10', '-5').isValid, false);

  // Partial non-numeric strings must be rejected (not parsed partially like parseFloat)
  assert.equal(resolveCustomAspect('2foo', '10').isValid, false, 'partial string "2foo" must be rejected');
  assert.equal(resolveCustomAspect('10', '2bar').isValid, false, 'partial string "2bar" must be rejected');
  assert.equal(resolveCustomAspect('abc', '10').isValid, false);
  assert.equal(resolveCustomAspect('10', 'xyz').isValid, false);
  assert.equal(resolveCustomAspect('', '').isValid, false);
});

test('SPEC-80: legacy defaultAspect null or undefined maps to original preset', () => {
  assert.equal(resolveDefaultPreset(null), 'original');
  assert.equal(resolveDefaultPreset(undefined), 'original');
  assert.equal(resolveDefaultPreset('original'), 'original');

  assert.equal(resolveDefaultPreset(16 / 9), '16:9');
  assert.equal(resolveDefaultPreset(1), '1:1');
  assert.equal(resolveDefaultPreset(4 / 3), '4:3');
});

test('SPEC-80: source presence and absence guards in ImageCropDialog.tsx', () => {
  const dialogPath = path.join(root, 'src', 'components', 'media', 'ImageCropDialog.tsx');
  const content = fs.readFileSync(dialogPath, 'utf8');

  // Must NOT pass undefined to aspect in any form
  assert.doesNotMatch(
    content,
    /aspect=\{[^}]*undefined[^}]*\}/,
    'must not pass undefined to aspect prop'
  );

  // Must render on-screen pan/zoom interaction hint
  assert.ok(
    content.includes('Geser gambar untuk mengatur posisi, gunakan slider zoom untuk memperbesar/memperkecil'),
    'must render pan/zoom guidance hint'
  );

  // Must contain onMediaLoaded handler for natural dimensions
  assert.ok(
    content.includes('onMediaLoaded={onMediaLoadedHandler}'),
    'Cropper must capture natural dimensions via onMediaLoaded'
  );
});

test('SPEC-80: guard proof — injected aspect undefined defect is detected', () => {
  const dialogPath = path.join(root, 'src', 'components', 'media', 'ImageCropDialog.tsx');
  const original = fs.readFileSync(dialogPath, 'utf8');
  try {
    const mutated = original.replace(
      'aspect={effectiveAspect}',
      'aspect={selectedAspect ?? undefined}'
    );
    assert.notEqual(mutated, original);
    fs.writeFileSync(dialogPath, mutated);

    const check = fs.readFileSync(dialogPath, 'utf8');
    const hasDefect = /aspect=\{[^}]*undefined[^}]*\}/.test(check);
    assert.equal(hasDefect, true, 'injected defect must be detectable by broadened guard assertion');
  } finally {
    fs.writeFileSync(dialogPath, original);
    const restored = fs.readFileSync(dialogPath, 'utf8');
    assert.equal(restored, original, 'source must be restored identically');
  }
});
