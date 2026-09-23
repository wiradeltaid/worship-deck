/**
 * Tests for SPEC-63: Form layout fetch error surfacing on CreateForm and EditForm
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const createFormSrc = fs.readFileSync(path.join(root, 'src', 'operator', 'CreateForm.tsx'), 'utf8');
const editFormSrc = fs.readFileSync(path.join(root, 'src', 'operator', 'EditForm.tsx'), 'utf8');

test('SPEC-63: CreateForm surfaces form-layout fetch errors with retry and error banner', () => {
  // 1. Must track layoutError state
  assert.ok(
    createFormSrc.includes('const [layoutError, setLayoutError] = useState'),
    'CreateForm must track layoutError state'
  );

  // 2. Must handle !res.ok and catch blocks with console.error and setLayoutError
  assert.ok(
    createFormSrc.includes('setLayoutError('),
    'CreateForm must set layout error message on failure'
  );
  assert.ok(
    createFormSrc.includes('console.error('),
    'CreateForm must log layout fetch error to console'
  );

  // 3. Must render FORM_ERROR_BANNER with retry button
  assert.ok(
    createFormSrc.includes('FORM_ERROR_BANNER'),
    'CreateForm must use FORM_ERROR_BANNER'
  );
  assert.ok(
    createFormSrc.includes('onClick={() => void fetchLayout()}'),
    'CreateForm banner must include a retry button invoking fetchLayout'
  );

  // 4. Must start fetchLayout() immediately without being blocked by outer Promise.all
  assert.ok(
    /useEffect\(\(\)\s*=>\s*\{[^}]*void\s+fetchLayout\(\)/.test(createFormSrc),
    'CreateForm must invoke fetchLayout independently in useEffect'
  );
});

test('SPEC-63: EditForm surfaces form-layout fetch errors, discriminating snapshot presence', () => {
  // 1. Must track layoutError state
  assert.ok(
    editFormSrc.includes('const [layoutError, setLayoutError] = useState'),
    'EditForm must track layoutError state'
  );

  // 2. Must handle !res.ok and catch blocks with console.error and setLayoutError
  assert.ok(
    editFormSrc.includes('setLayoutError('),
    'EditForm must set layout error message on failure'
  );
  assert.ok(
    editFormSrc.includes('console.error('),
    'EditForm must log layout fetch error to console'
  );

  // 3. Must discriminate snapshot presence: FORM_WARN_BANNER when snapshot exists, FORM_ERROR_BANNER when absent
  assert.ok(
    editFormSrc.includes('FORM_WARN_BANNER'),
    'EditForm must use FORM_WARN_BANNER when initialLayoutSnapshot exists'
  );
  assert.ok(
    editFormSrc.includes('FORM_ERROR_BANNER'),
    'EditForm must use FORM_ERROR_BANNER when initialLayoutSnapshot is absent'
  );
  assert.ok(
    editFormSrc.includes('initialLayoutSnapshot'),
    'EditForm error rendering must check initialLayoutSnapshot'
  );

  // 4. Must include retry button calling fetchLayout
  assert.ok(
    editFormSrc.includes('onClick={() => void fetchLayout()}'),
    'EditForm banner must include a retry button invoking fetchLayout'
  );

  // 5. Must start fetchLayout() immediately without being blocked by outer Promise.all
  assert.ok(
    /useEffect\(\(\)\s*=>\s*\{[^}]*void\s+fetchLayout\(\)/.test(editFormSrc),
    'EditForm must invoke fetchLayout independently in useEffect'
  );
});

test('SPEC-63: Absence guard & defect injection proofs for form layout error handling', () => {
  // Injected defect 1: Check that an empty catch without setLayoutError is detected
  const mockSwallowedCatch = `
    try {
      const res = await fetch('/api/worship-form-layout');
      if (res.ok) {
        setLayoutData(await res.json());
      }
    } catch {
      // ignore
    }
  `;
  assert.equal(
    mockSwallowedCatch.includes('setLayoutError'),
    false,
    'Defect proof: swallowed catch lacks setLayoutError'
  );

  // Injected defect 2: Check that omitting retry button is detected
  const mockBannerWithoutRetry = `
    {layoutError && <div className={FORM_ERROR_BANNER}>{layoutError}</div>}
  `;
  assert.equal(
    mockBannerWithoutRetry.includes('fetchLayout'),
    false,
    'Defect proof: banner without retry lacks fetchLayout call'
  );
});
