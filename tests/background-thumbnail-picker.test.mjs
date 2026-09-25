/**
 * SPEC-76 Ticket 01 — Song Set Background Thumbnail Dropdowns
 *
 * Verifies:
 * 1. PresenterOperator.tsx renders thumbnail images for background options and selected trigger.
 * 2. DynamicFormBody.tsx renders thumbnail images for background options and selected trigger.
 * 3. Complete absence of raw hash string parsing (`.split('/').pop()`) in user-facing background selectors across all operator forms.
 * 4. Distinct sentinel values are preserved: '' for form background, null for presenter live override.
 * 5. Clean non-opaque label formatting ("Image <id>" with optional "(Default)").
 * 6. Defect injection proofs confirming guards catch regressions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PRESENTER_OPERATOR_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'present',
  'PresenterOperator.tsx'
);

const DYNAMIC_FORM_BODY_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'DynamicFormBody.tsx'
);

const CREATE_FORM_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'CreateForm.tsx'
);

const EDIT_FORM_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'EditForm.tsx'
);

const REMOTE_OPERATOR_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'present',
  'RemoteOperator.tsx'
);

function verifyPresenterBackgroundSelector(source) {
  // Absence guard: no raw hash parsing via .split('/').pop() in background option rendering
  const rawHashRegex = /bg\.url\.split\(['"]\/['"]\)\.pop\(\)/;
  if (rawHashRegex.test(source)) {
    throw new Error('Defect detected: PresenterOperator.tsx still leaks raw hash filename via .split("/").pop()');
  }

  // Presence guard: SelectItem renders thumbnail image tag
  const imgTagRegex = /<img\s+[^>]*src=\{bg\.url\}[^>]*className=["'][^"']*h-6\s+w-9[^"']*object-cover[^"']*["']/;
  if (!imgTagRegex.test(source)) {
    throw new Error('Defect detected: PresenterOperator.tsx background SelectItem does not render thumbnail <img src={bg.url} ...>');
  }

  // Presence guard: clean label Image {bg.id}
  const labelRegex = /Image\s*\{bg\.id\}/;
  if (!labelRegex.test(source)) {
    throw new Error('Defect detected: PresenterOperator.tsx does not format background label as Image {bg.id}');
  }

  // Presence guard: SelectTrigger renders selected thumbnail image
  const triggerImgRegex = /<img\s+[^>]*src=\{selectedLiveBg\.url\}[^>]*className=["'][^"']*h-4\s+w-6[^"']*object-cover[^"']*["']/;
  if (!triggerImgRegex.test(source)) {
    throw new Error('Defect detected: PresenterOperator.tsx SelectTrigger does not render selected thumbnail preview');
  }

  // Sentinel guard: verifies default maps to null live override
  const sentinelRegex = /value\s*===\s*['"]default['"]\s*\?\s*null\s*:\s*value/;
  if (!sentinelRegex.test(source)) {
    throw new Error('Defect detected: PresenterOperator.tsx does not preserve null sentinel for deck default');
  }

  return true;
}

function verifyDynamicFormBackgroundSelector(source) {
  // Absence guard: no raw hash parsing via .split('/').pop() in background option rendering
  const rawHashRegex = /img\.url\.split\(['"]\/['"]\)\.pop\(\)/;
  if (rawHashRegex.test(source)) {
    throw new Error('Defect detected: DynamicFormBody.tsx still leaks raw hash filename via .split("/").pop()');
  }

  // Presence guard: SelectItem renders thumbnail image tag
  const imgTagRegex = /<img\s+[^>]*src=\{img\.url\}[^>]*className=["'][^"']*h-6\s+w-9[^"']*object-cover[^"']*["']/;
  if (!imgTagRegex.test(source)) {
    throw new Error('Defect detected: DynamicFormBody.tsx background SelectItem does not render thumbnail <img src={img.url} ...>');
  }

  // Presence guard: clean label Image {img.id}
  const labelRegex = /Image\s*\{img\.id\}/;
  if (!labelRegex.test(source)) {
    throw new Error('Defect detected: DynamicFormBody.tsx does not format background label as Image {img.id}');
  }

  // Presence guard: SelectTrigger renders selected thumbnail image
  const triggerImgRegex = /<img\s+[^>]*src=\{selectedFormBg\.url\}[^>]*className=["'][^"']*h-4\s+w-6[^"']*object-cover[^"']*["']/;
  if (!triggerImgRegex.test(source)) {
    throw new Error('Defect detected: DynamicFormBody.tsx SelectTrigger does not render selected thumbnail preview');
  }

  // Sentinel guard: verifies default maps to '' in service form
  const sentinelRegex = /!val\s*\|\|\s*val\s*===\s*['"]default['"]\s*\?\s*['"]['"]\s*:\s*val/;
  if (!sentinelRegex.test(source)) {
    throw new Error('Defect detected: DynamicFormBody.tsx does not preserve empty string sentinel for form default');
  }

  return true;
}

test('PresenterOperator — background selector renders thumbnails in options and trigger with clean labels and null sentinel', () => {
  const source = readFileSync(PRESENTER_OPERATOR_PATH, 'utf-8');
  assert.equal(verifyPresenterBackgroundSelector(source), true);
});

test('DynamicFormBody — background selector renders thumbnails in options and trigger with clean labels and empty string sentinel', () => {
  const source = readFileSync(DYNAMIC_FORM_BODY_PATH, 'utf-8');
  assert.equal(verifyDynamicFormBackgroundSelector(source), true);
});

test('All operator surfaces — absence of raw hash string parsing in background selectors', () => {
  const files = [
    { name: 'CreateForm.tsx', path: CREATE_FORM_PATH },
    { name: 'EditForm.tsx', path: EDIT_FORM_PATH },
    { name: 'RemoteOperator.tsx', path: REMOTE_OPERATOR_PATH },
    { name: 'PresenterOperator.tsx', path: PRESENTER_OPERATOR_PATH },
    { name: 'DynamicFormBody.tsx', path: DYNAMIC_FORM_BODY_PATH },
  ];

  for (const { name, path: filePath } of files) {
    const content = readFileSync(filePath, 'utf-8');
    assert.equal(
      content.includes(".split('/').pop()"),
      false,
      `Defect detected: ${name} still contains raw hash filename leak via .split('/').pop()`
    );
  }
});

test('PresenterOperator & DynamicFormBody — defect injection proof', () => {
  const mockPresenterValid = `
    const selectedLiveBg = backgroundLibrary.find(b => b.url === liveBackground);
    <Select value={liveBackground || 'default'} onValueChange={(val) => setBg(val === 'default' ? null : val)}>
      <SelectTrigger>
        {selectedLiveBg ? (
          <img src={selectedLiveBg.url} className="h-4 w-6 object-cover" />
        ) : (
          <SelectValue placeholder="Deck default" />
        )}
      </SelectTrigger>
      <SelectContent>
        {backgroundLibrary.map(bg => (
          <SelectItem key={bg.id} value={bg.url}>
            <div className="flex items-center gap-2">
              <img src={bg.url} alt="" className="h-6 w-9 shrink-0 rounded border border-border object-cover bg-muted" />
              <span>Image {bg.id}{bg.isDefault ? ' (Default)' : ''}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  `;

  // Defect 1: Leaking raw hash string in presenter
  const defect1 = mockPresenterValid + `\n{bg.url.split('/').pop()}`;
  assert.throws(
    () => verifyPresenterBackgroundSelector(defect1),
    /raw hash filename/
  );

  // Defect 2: Missing thumbnail img in presenter SelectItem
  const defect2 = mockPresenterValid.replace(/<img[^>]*h-6 w-9[^>]*\/>/, '');
  assert.throws(
    () => verifyPresenterBackgroundSelector(defect2),
    /does not render thumbnail <img/
  );

  // Defect 3: Missing thumbnail img in presenter SelectTrigger
  const defect3 = mockPresenterValid.replace(/<img[^>]*selectedLiveBg\.url[^>]*\/>/, '');
  assert.throws(
    () => verifyPresenterBackgroundSelector(defect3),
    /SelectTrigger does not render selected thumbnail/
  );

  // Defect 4: Missing clean label format
  const defect4 = mockPresenterValid.replace(/Image\s*\{bg\.id\}/, 'File {bg.id}');
  assert.throws(
    () => verifyPresenterBackgroundSelector(defect4),
    /does not format background label/
  );

  // Defect 5: Incorrect sentinel (e.g. mapping to empty string instead of null in presenter)
  const defect5 = mockPresenterValid.replace("val === 'default' ? null : val", "val === 'default' ? '' : val");
  assert.throws(
    () => verifyPresenterBackgroundSelector(defect5),
    /does not preserve null sentinel/
  );

  const mockFormValid = `
    const selectedFormBg = backgroundLibrary.find(b => b.url === values.background);
    <Select value={values.background || 'default'} onValueChange={(val) => onChange('background', !val || val === 'default' ? '' : val)}>
      <SelectTrigger>
        {selectedFormBg ? (
          <img src={selectedFormBg.url} className="h-4 w-6 object-cover" />
        ) : (
          <SelectValue placeholder="Default Background" />
        )}
      </SelectTrigger>
      <SelectContent>
        {backgroundLibrary.map(img => (
          <SelectItem key={img.id} value={img.url}>
            <div className="flex items-center gap-2">
              <img src={img.url} alt="" className="h-6 w-9 shrink-0 rounded border border-border object-cover bg-muted" />
              <span>Image {img.id}{img.isDefault ? ' (Default)' : ''}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  `;

  // Defect 6: Leaking raw hash string in form
  const defect6 = mockFormValid + `\n{img.url.split('/').pop()}`;
  assert.throws(
    () => verifyDynamicFormBackgroundSelector(defect6),
    /raw hash filename/
  );

  // Defect 7: Missing thumbnail img in form SelectItem
  const defect7 = mockFormValid.replace(/<img[^>]*h-6 w-9[^>]*\/>/, '');
  assert.throws(
    () => verifyDynamicFormBackgroundSelector(defect7),
    /does not render thumbnail <img/
  );

  // Defect 8: Missing thumbnail img in form SelectTrigger
  const defect8 = mockFormValid.replace(/<img[^>]*selectedFormBg\.url[^>]*\/>/, '');
  assert.throws(
    () => verifyDynamicFormBackgroundSelector(defect8),
    /SelectTrigger does not render selected thumbnail/
  );

  // Defect 9: Incorrect form sentinel
  const defect9 = mockFormValid.replace("!val || val === 'default' ? '' : val", "val === 'default' ? null : val");
  assert.throws(
    () => verifyDynamicFormBackgroundSelector(defect9),
    /does not preserve empty string sentinel/
  );
});
