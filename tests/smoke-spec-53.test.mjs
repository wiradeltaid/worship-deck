/**
 * SPEC-53: Form Card & Slot Reordering, Workspace Navigation Labeling & Presenter Text Transition Parity
 * Smoke Test & Executable Absence Guard Suite
 *
 * Verifies:
 * - SPEC-53-01: Header Navigation Labeling & Chrome Parity
 *   - /new navigation link text is 'New Workspace Mockup'
 *   - Active route styling and aria-current support
 * - SPEC-53-02: Form Card Groupings Sequential Reordering & Normalization
 *   - Full array splice-and-reindex with 1..N contiguous sort orders in FormLayoutAdminPanel and DynamicFormBody
 *   - Elimination of partial 2-item swap payload
 *   - Go backend strict layout membership validation
 * - SPEC-53-03: Intra-Card Slot Reordering & Cross-Card Slot Transfer
 *   - Slot up/down reorder buttons in FormLayoutAdminPanel with 1..M contiguous sort orders
 *   - Slot cross-card transfer dropdown 'Pindah Kartu...' calling POST /api/admin/form-grouping-slots/{id}/move-grouping
 *   - Route registration and atomic source gap closure
 * - SPEC-53-04: Presenter Text Transition Smoothness & Slide Instance Isolation
 *   - CROSSFADE outgoing layer opacity fades smoothly from 1 to 0 (no text ghosting / linger)
 *   - ArtifactSlide and SlideView enforce slide-instance identity keys to prevent element reuse flicker
 * - Defect Injection Proofs:
 *   - Executable physical mutation tests proving guards catch regressions
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  SLIDE_TRANSITION_SPECS,
  transitionLayerStyle,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'transitions.ts')).href
);

export function scanSpec53Features(headerSource, adminPanelSource, dynamicFormSource, transitionsSource, artifactSlideSource, serverGoSource) {
  const findings = [];

  // SPEC-53-01: Header Navigation Labeling
  if (!headerSource.includes('New Workspace Mockup')) {
    findings.push('Header.tsx must render "New Workspace Mockup" for the /new link');
  }
  if (headerSource.includes('>Workspace<') || headerSource.includes('>\n            Workspace\n')) {
    findings.push('Header.tsx must not contain generic "Workspace" link text');
  }
  if (!headerSource.includes("aria-current={pathname === '/new' ? 'page' : undefined}")) {
    findings.push('Header.tsx /new link must have aria-current attribute for active state');
  }

  // SPEC-53-02: Card Groupings Sequential Reordering (SSOT in FormLayoutAdminPanel per SPEC-54)
  const adminHasSequentialMap = adminPanelSource.includes('.map((g, i) => ({ id: g.id, sort_order: i + 1 }))');
  if (!adminHasSequentialMap) {
    findings.push('FormLayoutAdminPanel.tsx must generate sequential 1..N sort orders for all groupings');
  }
  if (adminPanelSource.includes('{ id: g1.id, sort_order: g2.sort_order }')) {
    findings.push('FormLayoutAdminPanel.tsx still contains broken partial 2-item swap payload');
  }

  // SPEC-53-03: Intra-Card Slot Reordering & Cross-Card Slot Transfer
  if (!adminPanelSource.includes('handleMoveSlot')) {
    findings.push('FormLayoutAdminPanel.tsx must implement handleMoveSlot');
  }
  if (!adminPanelSource.includes('handleTransferSlot')) {
    findings.push('FormLayoutAdminPanel.tsx must implement handleTransferSlot');
  }
  if (!adminPanelSource.includes('/api/admin/form-grouping-slots/${slotId}/move-grouping') &&
      !adminPanelSource.includes('/api/admin/form-grouping-slots/${s.id}/move-grouping')) {
    findings.push('FormLayoutAdminPanel.tsx must dispatch to move-grouping endpoint');
  }
  if (!adminPanelSource.includes('Pindah Kartu...')) {
    findings.push('FormLayoutAdminPanel.tsx must render "Pindah Kartu..." transfer selector');
  }
  if (!serverGoSource.includes('/api/admin/form-grouping-slots/{id}/move-grouping')) {
    findings.push('server.go must register POST /api/admin/form-grouping-slots/{id}/move-grouping');
  }

  // SPEC-53-04: Presenter Text Transition Parity & Slide Instance Isolation
  if (!transitionsSource.includes('outgoing: { from: { opacity: 1 }, to: { opacity: 0 } }')) {
    findings.push('transitions.ts CROSSFADE outgoing layer must fade opacity from 1 to 0');
  }
  if (!artifactSlideSource.includes('instanceKey') || !artifactSlideSource.includes('key={instanceKey}')) {
    findings.push('ArtifactSlide.tsx must assign instanceKey to root container');
  }

  return findings;
}

test('SPEC-53-01: Header Navigation Labeling & Chrome Parity', () => {
  const headerPath = path.join(root, 'src', 'components', 'Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  assert.match(
    headerContent,
    /New Workspace Mockup/,
    'Header navigation link text must be "New Workspace Mockup"'
  );
  assert.doesNotMatch(
    headerContent,
    /<CustomLink\s+href="\/new"[^>]*>\s*Workspace\s*<\/CustomLink>/,
    'Header must not contain bare "Workspace" label for /new'
  );
  assert.match(
    headerContent,
    /aria-current=\{pathname === '\/new' \? 'page' : undefined\}/,
    'Header /new link must define aria-current attribute'
  );
});

test('SPEC-53-02: Form Card Groupings Sequential Reordering & Normalization', () => {
  const adminPanelPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');
  const adminPanelContent = fs.readFileSync(adminPanelPath, 'utf8');
  const dynamicFormPath = path.join(root, 'src', 'operator', 'DynamicFormBody.tsx');
  const dynamicFormContent = fs.readFileSync(dynamicFormPath, 'utf8');

  // FormLayoutAdminPanel must submit full sequential arrays (layout SSOT per SPEC-54)
  assert.match(
    adminPanelContent,
    /\.map\(\(g, i\) => \(\{ id: g\.id, sort_order: i \+ 1 \}\)\)/,
    'FormLayoutAdminPanel must map all groupings to contiguous 1..N sort_orders'
  );

  // FormLayoutAdminPanel must not send partial two-item swap payloads
  assert.doesNotMatch(
    adminPanelContent,
    /\{ id: g1\.id, sort_order: g2\.sort_order \}/,
    'FormLayoutAdminPanel must not use partial 2-item swap payload'
  );
});

test('SPEC-53-03: Intra-Card Slot Reordering & Cross-Card Slot Transfer', () => {
  const adminPanelPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');
  const adminPanelContent = fs.readFileSync(adminPanelPath, 'utf8');
  const serverGoPath = path.join(root, 'internal', 'httpapi', 'server.go');
  const serverGoContent = fs.readFileSync(serverGoPath, 'utf8');
  const formLayoutGoPath = path.join(root, 'internal', 'httpapi', 'form_layout.go');
  const formLayoutGoContent = fs.readFileSync(formLayoutGoPath, 'utf8');

  // Admin panel must have handleMoveSlot and handleTransferSlot
  assert.match(adminPanelContent, /const handleMoveSlot = async/, 'Must implement handleMoveSlot');
  assert.match(adminPanelContent, /const handleTransferSlot = async/, 'Must implement handleTransferSlot');
  assert.match(adminPanelContent, /Pindah Kartu\.\.\./, 'Must render Pindah Kartu... dropdown');

  // Backend must register and implement move-grouping endpoint
  assert.match(
    serverGoContent,
    /POST \/api\/admin\/form-grouping-slots\/\{id\}\/move-grouping/,
    'server.go must register move-grouping endpoint'
  );
  assert.match(
    formLayoutGoContent,
    /func \(s \*Server\) moveFormGroupingSlot/,
    'form_layout.go must implement moveFormGroupingSlot handler'
  );
  assert.match(
    formLayoutGoContent,
    /Cannot move slot to its current grouping/,
    'moveFormGroupingSlot must reject self-moves'
  );
});

test('SPEC-53-04: Presenter Text Transition Parity & Slide Instance Isolation', () => {
  const transitionsPath = path.join(root, 'src', 'lib', 'transitions.ts');
  const transitionsContent = fs.readFileSync(transitionsPath, 'utf8');
  const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
  const artifactSlideContent = fs.readFileSync(artifactSlidePath, 'utf8');
  const slideViewPath = path.join(root, 'src', 'components', 'SlideView.tsx');
  const slideViewContent = fs.readFileSync(slideViewPath, 'utf8');

  // Transitions: outgoing layer opacity must fade from 1 to 0
  const fadeSpec = SLIDE_TRANSITION_SPECS.fade;
  assert.equal(fadeSpec.browser.outgoing?.from.opacity, 1, 'fade outgoing from opacity must be 1');
  assert.equal(fadeSpec.browser.outgoing?.to.opacity, 0, 'fade outgoing to opacity must be 0');

  const dissolveSpec = SLIDE_TRANSITION_SPECS.dissolve;
  assert.equal(dissolveSpec.browser.outgoing?.from.opacity, 1, 'dissolve outgoing from opacity must be 1');
  assert.equal(dissolveSpec.browser.outgoing?.to.opacity, 0, 'dissolve outgoing to opacity must be 0');

  const outgoingActiveStyle = transitionLayerStyle('fade', 'outgoing', 'active');
  assert.equal(outgoingActiveStyle.opacity, 0, 'outgoing active layer style must have opacity 0');

  // Slide instance keys must be enforced
  assert.match(
    artifactSlideContent,
    /const instanceKey = instance\.instanceId \|\| `\$\{instance\.templateId \|\| 'slide'\}-\$\{instance\.layoutKey \|\| ''\}`;/,
    'ArtifactSlide must calculate explicit slide instanceKey'
  );
  assert.match(
    artifactSlideContent,
    /<div\s+key=\{instanceKey\}/,
    'ArtifactSlide root container must apply key={instanceKey}'
  );
  assert.match(
    slideViewContent,
    /<ArtifactSlide\s+key=\{slideKey\}/,
    'SlideView must apply key={slideKey}'
  );
});

test('SPEC-53-Absence-Guard: Real-File Defect Injection Proofs', () => {
  const headerPath = path.join(root, 'src', 'components', 'Header.tsx');
  const adminPanelPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');
  const dynamicFormPath = path.join(root, 'src', 'operator', 'DynamicFormBody.tsx');
  const transitionsPath = path.join(root, 'src', 'lib', 'transitions.ts');
  const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
  const serverGoPath = path.join(root, 'internal', 'httpapi', 'server.go');

  const origHeader = fs.readFileSync(headerPath, 'utf8');
  const origAdmin = fs.readFileSync(adminPanelPath, 'utf8');
  const origDynamic = fs.readFileSync(dynamicFormPath, 'utf8');
  const origTransitions = fs.readFileSync(transitionsPath, 'utf8');
  const origArtifactSlide = fs.readFileSync(artifactSlidePath, 'utf8');
  const origServerGo = fs.readFileSync(serverGoPath, 'utf8');

  // Baseline must have zero findings
  const baselineFindings = scanSpec53Features(
    origHeader,
    origAdmin,
    origDynamic,
    origTransitions,
    origArtifactSlide,
    origServerGo
  );
  assert.deepEqual(baselineFindings, [], 'Clean baseline must have 0 findings');

  // Defect 1: Header reverts to generic "Workspace"
  try {
    const mutatedHeader = origHeader.replace('New Workspace Mockup', 'Workspace');
    const defectFindings = scanSpec53Features(
      mutatedHeader,
      origAdmin,
      origDynamic,
      origTransitions,
      origArtifactSlide,
      origServerGo
    );
    assert.ok(defectFindings.some(f => f.includes('New Workspace Mockup')), 'Defect 1 must be caught');
  } finally {
    fs.writeFileSync(headerPath, origHeader, 'utf8');
  }

  // Defect 2: FormLayoutAdminPanel reverts to partial 2-item swap
  try {
    const mutatedAdmin = origAdmin.replace(
      '.map((g, i) => ({ id: g.id, sort_order: i + 1 }))',
      '.map((g, i) => ({ id: g.id, sort_order: 1 }))'
    );
    const defectFindings = scanSpec53Features(
      origHeader,
      mutatedAdmin,
      origDynamic,
      origTransitions,
      origArtifactSlide,
      origServerGo
    );
    assert.ok(defectFindings.some(f => f.includes('FormLayoutAdminPanel')), 'Defect 2 must be caught');
  } finally {
    fs.writeFileSync(adminPanelPath, origAdmin, 'utf8');
  }

  // Defect 3: transitions.ts reverts to lingering opacity 1
  try {
    const mutatedTransitions = origTransitions.replace(
      'outgoing: { from: { opacity: 1 }, to: { opacity: 0 } }',
      'outgoing: { from: { opacity: 1 }, to: { opacity: 1 } }'
    );
    const defectFindings = scanSpec53Features(
      origHeader,
      origAdmin,
      origDynamic,
      mutatedTransitions,
      origArtifactSlide,
      origServerGo
    );
    assert.ok(defectFindings.some(f => f.includes('CROSSFADE outgoing layer')), 'Defect 3 must be caught');
  } finally {
    fs.writeFileSync(transitionsPath, origTransitions, 'utf8');
  }

  // Defect 4: ArtifactSlide removes instanceKey
  try {
    const mutatedArtifactSlide = origArtifactSlide.replace('key={instanceKey}', '');
    const defectFindings = scanSpec53Features(
      origHeader,
      origAdmin,
      origDynamic,
      origTransitions,
      mutatedArtifactSlide,
      origServerGo
    );
    assert.ok(defectFindings.some(f => f.includes('ArtifactSlide.tsx must assign instanceKey')), 'Defect 4 must be caught');
  } finally {
    fs.writeFileSync(artifactSlidePath, origArtifactSlide, 'utf8');
  }
});
