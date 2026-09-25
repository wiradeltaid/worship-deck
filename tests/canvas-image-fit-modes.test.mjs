/**
 * SPEC-76 Ticket 02 — Canvas Image and Placeholder Fit Modes
 *
 * Verifies:
 * 1. resolveObjectFit in render-model.ts accurately returns 'contain', 'cover', and 'fill'.
 * 2. pptx-draw.ts handles contain, cover, and fill sizing for images.
 * 3. ArtifactEditor.tsx declares imageFit state supporting 'contain' | 'cover' | 'fill'.
 * 4. ArtifactEditor.tsx renders buttons for all 3 fit modes (Fit, Cover, Stretch).
 * 5. ArtifactEditor.tsx includes image-placeholder elements in image detection.
 * 6. ArtifactEditor.tsx resizing handlers do not coerce objectFit to 'fill'.
 * 7. Defect injection proofs confirming guards catch regressions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const renderModelUrl = pathToFileURL(
  path.join(ROOT, 'src', 'lib', 'artifacts', 'render-model.ts')
).href;

const ARTIFACT_EDITOR_PATH = path.join(
  ROOT,
  'src',
  'components',
  'admin',
  'ArtifactEditor.tsx'
);

const PPTX_DRAW_PATH = path.join(
  ROOT,
  'src',
  'lib',
  'pptx-draw.ts'
);

test('resolveObjectFit — accurately resolves contain, cover, and fill', async () => {
  const { resolveObjectFit } = await import(renderModelUrl);
  assert.equal(resolveObjectFit({ objectFit: 'contain' }), 'contain');
  assert.equal(resolveObjectFit({ objectFit: 'cover' }), 'cover');
  assert.equal(resolveObjectFit({ objectFit: 'fill' }), 'fill');
  // Default fallback when unspecified
  assert.equal(resolveObjectFit({}), 'contain');
  assert.equal(resolveObjectFit(undefined), 'contain');
});

test('pptx-draw — verifies image sizing mapping for contain, cover, and fill', () => {
  const pptxDrawSource = readFileSync(PPTX_DRAW_PATH, 'utf-8');
  // Assert pptx-draw calls resolveObjectFit and passes sizing: { type: objectFit, ... }
  assert.match(pptxDrawSource, /const\s+objectFit\s*=\s*resolveObjectFit\(element\.style\)/);
  assert.match(pptxDrawSource, /objectFit\s*===\s*['"]fill['"]\s*\?\s*\{\}\s*:\s*\{\s*sizing:\s*\{\s*type:\s*objectFit/);
});

function verifyArtifactEditorFitModes(source) {
  // 1. imageFit state must declare 'contain' | 'cover' | 'fill'
  if (!source.includes("useState<'contain' | 'cover' | 'fill'>")) {
    throw new Error("Defect detected: ArtifactEditor.tsx imageFit state does not declare 'contain' | 'cover' | 'fill'");
  }

  // 2. Toolbar must render buttons for Fit (contain), Cover (cover), and Stretch (fill)
  const hasFitButton = /handleToggleImageFit\(['"]contain['"]\)/.test(source);
  const hasCoverButton = /handleToggleImageFit\(['"]cover['"]\)/.test(source);
  const hasStretchButton = /handleToggleImageFit\(['"]fill['"]\)/.test(source);

  if (!hasFitButton || !hasCoverButton || !hasStretchButton) {
    throw new Error(
      `Defect detected: ArtifactEditor.tsx toolbar missing fit mode button (fit: ${hasFitButton}, cover: ${hasCoverButton}, stretch: ${hasStretchButton})`
    );
  }

  // 3. Image selection must recognize image-placeholder
  const recognizesPlaceholder =
    source.includes("placeholderKey") || source.includes("image-placeholder");
  if (!recognizesPlaceholder) {
    throw new Error(
      "Defect detected: ArtifactEditor.tsx does not recognize image-placeholder elements in image selection"
    );
  }

  // 4. Absence of resize coercion: onObjectScaling/onObjectResizing must NOT force objectFit = 'fill'
  const scalingCoercionRegex = /if\s*\(isImage\s*&&\s*\(isHoriz\s*\|\|\s*isVert\)\)\s*\{\s*\(member as any\)\.data\.objectFit\s*=\s*['"]fill['"]/;
  if (scalingCoercionRegex.test(source)) {
    throw new Error(
      "Defect detected: ArtifactEditor.tsx onObjectScaling still forcibly coerces objectFit to 'fill'"
    );
  }

  const resizingCoercionRegex = /if\s*\(isImage\)\s*\{\s*targetData\.objectFit\s*=\s*['"]fill['"]/;
  if (resizingCoercionRegex.test(source)) {
    throw new Error(
      "Defect detected: ArtifactEditor.tsx onObjectResizing still forcibly coerces objectFit to 'fill'"
    );
  }

  return true;
}

test('ArtifactEditor — declarations, toolbar 3-way toggle, placeholder detection, and no resize coercion', () => {
  const source = readFileSync(ARTIFACT_EDITOR_PATH, 'utf-8');
  assert.equal(verifyArtifactEditorFitModes(source), true);
});

test('ArtifactEditor fit modes — defect injection proof', () => {
  const mockValid = `
    const [imageFit, setImageFit] = useState<'contain' | 'cover' | 'fill'>('contain');
    const images = active.filter(obj => obj.data?.isImage || obj.data?.placeholderKey || obj.type === 'image-placeholder');
    handleToggleImageFit('contain');
    handleToggleImageFit('cover');
    handleToggleImageFit('fill');
    // Clean resize without coercion
    const w = target.width;
  `;

  // Defect 1: Missing cover state
  const defect1 = mockValid.replace("useState<'contain' | 'cover' | 'fill'>", "useState<'contain' | 'fill'>");
  assert.throws(() => verifyArtifactEditorFitModes(defect1), /imageFit state does not declare/);

  // Defect 2: Missing Cover button
  const defect2 = mockValid.replace("handleToggleImageFit('cover');", "");
  assert.throws(() => verifyArtifactEditorFitModes(defect2), /missing fit mode button/);

  // Defect 3: Missing placeholder recognition
  const defect3 = mockValid.replace("|| obj.data?.placeholderKey || obj.type === 'image-placeholder'", "");
  assert.throws(() => verifyArtifactEditorFitModes(defect3), /does not recognize image-placeholder/);

  // Defect 4: Scaling coercion present
  const defect4 = mockValid + `\nif (isImage && (isHoriz || isVert)) { (member as any).data.objectFit = 'fill'; }`;
  assert.throws(() => verifyArtifactEditorFitModes(defect4), /onObjectScaling still forcibly coerces/);

  // Defect 5: Resizing coercion present
  const defect5 = mockValid + `\nif (isImage) { targetData.objectFit = 'fill'; }`;
  assert.throws(() => verifyArtifactEditorFitModes(defect5), /onObjectResizing still forcibly coerces/);
});
