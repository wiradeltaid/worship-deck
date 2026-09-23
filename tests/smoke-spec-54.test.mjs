/**
 * SPEC-54: Layout SSOT & Rundown Regex Sandbox Integration, Photo Deletion Persistence, and Canvas Element Rotation Parity
 * Smoke Test & Executable Absence Guard Suite
 *
 * Verifies:
 * - SPEC-54-01: Form Layout SSOT, Dynamic Hydration on Service Edit, and Seeder Song Set Cleanup
 *   - Retirement of in-place layout customization and toolbar from DynamicFormBody.tsx
 *   - Dynamic layout hydration in EditForm.tsx with "Preserved Historical Fields" zero-data-loss guarantee
 *   - Seeder cleanup in internal/db/form_layout.go & src/lib/db/index.ts removing obsolete hardcoded song set slots
 * - Defect Injection Proofs:
 *   - Executable physical mutation tests proving guards catch regressions
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanSpec54_01Features(dynamicFormSource, editFormSource, dbFormLayoutGoSource, dbIndexTsSource) {
  const findings = [];

  // SPEC-54-01: Absence of in-place customization in DynamicFormBody.tsx
  if (dynamicFormSource.includes('Kelola Layout Visual')) {
    findings.push('DynamicFormBody.tsx must NOT contain "Kelola Layout Visual" button or label');
  }
  if (dynamicFormSource.includes('Seed Default Predefined Fields')) {
    findings.push('DynamicFormBody.tsx must NOT contain "Seed Default Predefined Fields"');
  }
  if (dynamicFormSource.includes('Tambah Kartu Form Baru')) {
    findings.push('DynamicFormBody.tsx must NOT contain "Tambah Kartu Form Baru"');
  }
  if (dynamicFormSource.includes('handleSeedDefaults')) {
    findings.push('DynamicFormBody.tsx must NOT contain "handleSeedDefaults"');
  }
  if (dynamicFormSource.includes('isCustomizing')) {
    findings.push('DynamicFormBody.tsx must NOT contain "isCustomizing" state or controls');
  }

  // SPEC-54-01: EditForm.tsx dynamic layout hydration & historical preservation
  if (editFormSource.includes('prev.groupings.length > 0')) {
    findings.push('EditForm.tsx fetchLayout must NOT freeze groupings to initial snapshot with prev.groupings.length > 0');
  }
  if (!editFormSource.includes('buildHistoricalGrouping') && !editFormSource.includes('Preserved Historical Fields')) {
    findings.push('EditForm.tsx must preserve unassigned saved field values under "Preserved Historical Fields"');
  }

  // SPEC-54-01: Seeder cleanup in form_layout.go & src/lib/db/index.ts
  const goDefaultGroupingsMatch = dbFormLayoutGoSource.match(/defaultGroupings\s*:=\s*\[\]groupingDef\{[\s\S]*?\n\t\}/);
  if (goDefaultGroupingsMatch && goDefaultGroupingsMatch[0].includes('ds_opening_song')) {
    findings.push('internal/db/form_layout.go defaultGroupings must NOT contain obsolete "ds_opening_song" slot');
  }
  if (goDefaultGroupingsMatch && goDefaultGroupingsMatch[0].includes('ds_closing_song')) {
    findings.push('internal/db/form_layout.go defaultGroupings must NOT contain obsolete "ds_closing_song" slot');
  }

  const tsGroupingsMatch = dbIndexTsSource.match(/const groupings = \[[\s\S]*?\n\s*\];/);
  if (tsGroupingsMatch && tsGroupingsMatch[0].includes('ds_opening_song')) {
    findings.push('src/lib/db/index.ts default groupings must NOT contain obsolete "ds_opening_song" slot');
  }

  return findings;
}

test('SPEC-54-01: Form Layout SSOT & Dynamic Hydration source guards', () => {
  const dynamicFormPath = path.join(root, 'src', 'operator', 'DynamicFormBody.tsx');
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const dbFormLayoutGoPath = path.join(root, 'internal', 'db', 'form_layout.go');
  const dbIndexTsPath = path.join(root, 'src', 'lib', 'db', 'index.ts');

  const dynamicFormSource = fs.readFileSync(dynamicFormPath, 'utf8');
  const editFormSource = fs.readFileSync(editFormPath, 'utf8');
  const dbFormLayoutGoSource = fs.readFileSync(dbFormLayoutGoPath, 'utf8');
  const dbIndexTsSource = fs.readFileSync(dbIndexTsPath, 'utf8');

  const findings = scanSpec54_01Features(dynamicFormSource, editFormSource, dbFormLayoutGoSource, dbIndexTsSource);
  assert.deepEqual(findings, [], `SPEC-54-01 findings detected:\n${findings.join('\n')}`);
});

test('SPEC-54-01-Absence-Guard: Real-File Defect Injection Proofs', () => {
  const dynamicFormPath = path.join(root, 'src', 'operator', 'DynamicFormBody.tsx');
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const dbFormLayoutGoPath = path.join(root, 'internal', 'db', 'form_layout.go');
  const dbIndexTsPath = path.join(root, 'src', 'lib', 'db', 'index.ts');

  const baseDynamicForm = fs.readFileSync(dynamicFormPath, 'utf8');
  const baseEditForm = fs.readFileSync(editFormPath, 'utf8');
  const baseDbGo = fs.readFileSync(dbFormLayoutGoPath, 'utf8');
  const baseDbTs = fs.readFileSync(dbIndexTsPath, 'utf8');

  // 1. Inject "Kelola Layout Visual"
  const injectedKelola = scanSpec54_01Features(
    baseDynamicForm + '\nconst x = "Kelola Layout Visual";',
    baseEditForm,
    baseDbGo.replace(/ds_opening_song/g, '').replace(/ds_closing_song/g, ''),
    baseDbTs.replace(/ds_opening_song/g, '')
  );
  assert.ok(
    injectedKelola.some((f) => f.includes('Kelola Layout Visual')),
    'Absence guard must detect injected "Kelola Layout Visual"'
  );

  // 2. Inject "Seed Default Predefined Fields"
  const injectedSeed = scanSpec54_01Features(
    baseDynamicForm + '\nconst x = "Seed Default Predefined Fields";',
    baseEditForm,
    baseDbGo.replace(/ds_opening_song/g, '').replace(/ds_closing_song/g, ''),
    baseDbTs.replace(/ds_opening_song/g, '')
  );
  assert.ok(
    injectedSeed.some((f) => f.includes('Seed Default Predefined Fields')),
    'Absence guard must detect injected "Seed Default Predefined Fields"'
  );

  // 3. Inject "Tambah Kartu Form Baru"
  const injectedTambah = scanSpec54_01Features(
    baseDynamicForm + '\nconst x = "Tambah Kartu Form Baru";',
    baseEditForm,
    baseDbGo.replace(/ds_opening_song/g, '').replace(/ds_closing_song/g, ''),
    baseDbTs.replace(/ds_opening_song/g, '')
  );
  assert.ok(
    injectedTambah.some((f) => f.includes('Tambah Kartu Form Baru')),
    'Absence guard must detect injected "Tambah Kartu Form Baru"'
  );

  // 4. Inject "handleSeedDefaults"
  const injectedHandler = scanSpec54_01Features(
    baseDynamicForm + '\nfunction handleSeedDefaults() {}',
    baseEditForm,
    baseDbGo.replace(/ds_opening_song/g, '').replace(/ds_closing_song/g, ''),
    baseDbTs.replace(/ds_opening_song/g, '')
  );
  assert.ok(
    injectedHandler.some((f) => f.includes('handleSeedDefaults')),
    'Absence guard must detect injected "handleSeedDefaults"'
  );

  // 5. Inject "isCustomizing"
  const injectedCustomizing = scanSpec54_01Features(
    baseDynamicForm + '\nconst isCustomizing = true;',
    baseEditForm,
    baseDbGo,
    baseDbTs
  );
  assert.ok(
    injectedCustomizing.some((f) => f.includes('isCustomizing')),
    'Absence guard must detect injected "isCustomizing"'
  );

  // 6. Inject obsolete slot into defaultGroupings
  const injectedGoObsolete = scanSpec54_01Features(
    baseDynamicForm,
    baseEditForm,
    baseDbGo.replace('defaultGroupings := []groupingDef{', 'defaultGroupings := []groupingDef{\n\t\t// ds_opening_song\n'),
    baseDbTs
  );
  assert.ok(
    injectedGoObsolete.some((f) => f.includes('ds_opening_song')),
    'Seeder guard must detect injected obsolete song set slot in form_layout.go'
  );
});

test('SPEC-54-01: buildHistoricalGrouping preserves unassigned saved field values', async () => {
  const { buildHistoricalGrouping } = await import('../src/lib/form-layout.ts');

  const mockLayout = {
    layout: { id: 'default-layout', title: 'Default', description: '', is_active: 1, version: 1 },
    groupings: [
      {
        id: 'g1',
        layout_id: 'default-layout',
        label: 'Sermon',
        description: '',
        sort_order: 1,
        slots: [
          { id: 's1', layout_id: 'default-layout', grouping_id: 'g1', sort_order: 1, widget_kind: 'predefined_field', ref_key: 'sermon_title' },
        ],
      },
    ],
    predefined_fields: [
      { id: 'f1', variable_name: 'sermon_title', shown_text: 'Sermon Title', field_type: 'text' },
    ],
  };

  // Case 1: all saved fields are mapped
  const allMapped = buildHistoricalGrouping(mockLayout, { sermon_title: 'Grace Abounds' });
  assert.strictEqual(allMapped, null, 'Expected null when all fields are mapped');

  // Case 2: an unmapped field exists with saved value
  const unmapped = buildHistoricalGrouping(mockLayout, {
    sermon_title: 'Grace Abounds',
    mission_spotlight_speaker: 'Elder David',
    empty_field: '',
  });

  assert.ok(unmapped, 'Expected historical grouping when unmapped fields exist');
  assert.strictEqual(unmapped.id, 'grouping-preserved-historical');
  assert.strictEqual(unmapped.label, 'Preserved Historical Fields');
  assert.strictEqual(unmapped.slots.length, 1);
  assert.strictEqual(unmapped.slots[0].ref_key, 'mission_spotlight_speaker');
  assert.strictEqual(unmapped.slots[0].widget_kind, 'predefined_field');

  // Case 3: null layout returns null
  assert.strictEqual(buildHistoricalGrouping(null, { x: '1' }), null);
});

export function scanSpec54_02Features(editFormSource, servicesGoSource) {
  const findings = [];

  if (editFormSource.includes('!base.family_photo')) {
    findings.push('EditForm.tsx must NOT use "!base.family_photo" check; use "base.family_photo === undefined"');
  }
  if (editFormSource.includes('!base.youth_photo')) {
    findings.push('EditForm.tsx must NOT use "!base.youth_photo" check; use "base.youth_photo === undefined"');
  }
  if (editFormSource.includes('!base.sermon_poster')) {
    findings.push('EditForm.tsx must NOT use "!base.sermon_poster" check; use "base.sermon_poster === undefined"');
  }
  if (!editFormSource.includes('base.family_photo === undefined')) {
    findings.push('EditForm.tsx must use "base.family_photo === undefined"');
  }

  // services.go per-key merge precedence
  if (servicesGoSource.includes('if len(fields) > 0 {\n\t\treturn fields\n\t}') || servicesGoSource.includes('if len(fields) > 0 {\r\n\t\treturn fields\r\n\t}')) {
    findings.push('services.go storedFieldValues must NOT do bulk len(fields)>0 return without per-key evaluation');
  }
  if (!servicesGoSource.includes('hasStoredKey')) {
    findings.push('services.go storedFieldValues must implement per-key presence tracking via hasStoredKey');
  }

  return findings;
}

test('SPEC-54-02: Photo Deletion Persistence & Per-Key Merge Precedence guards', () => {
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const servicesGoPath = path.join(root, 'internal', 'httpapi', 'services.go');

  const editFormSource = fs.readFileSync(editFormPath, 'utf8');
  const servicesGoSource = fs.readFileSync(servicesGoPath, 'utf8');

  const findings = scanSpec54_02Features(editFormSource, servicesGoSource);
  assert.deepEqual(findings, [], `SPEC-54-02 findings detected:\n${findings.join('\n')}`);
});

export function scanSpec54_03Features(registryAdminSource, formLayoutAdminSource) {
  const findings = [];

  // RegistryAdmin.tsx navigation consolidation
  if (registryAdminSource.includes("{ id: 'parsing',") || registryAdminSource.includes('{ id: "parsing",')) {
    findings.push('RegistryAdmin.tsx must retire the redundant top-level "parsing" tab');
  }
  if (registryAdminSource.includes("activeTab === 'parsing'")) {
    findings.push('RegistryAdmin.tsx must not render standalone parsing tab view');
  }

  // SPEC-68: FormLayoutAdminPanel.tsx parser profile menu retirement absence guard
  if (formLayoutAdminSource.includes("activeTab === 'profiles'")) {
    findings.push('FormLayoutAdminPanel.tsx must NOT contain "activeTab === \'profiles\'"');
  }
  if (formLayoutAdminSource.includes('<ParserProfilesPanel')) {
    findings.push('FormLayoutAdminPanel.tsx must NOT contain "<ParserProfilesPanel"');
  }

  // FormLayoutAdminPanel.tsx live rundown test area & production parity
  if (!formLayoutAdminSource.includes('extractPredefinedFields') && !formLayoutAdminSource.includes('parseRundownWithProfile')) {
    findings.push('FormLayoutAdminPanel.tsx must execute production-parity parsing via extractPredefinedFields or parseRundownWithProfile');
  }
  if (!formLayoutAdminSource.includes('rundown-test-area') && !formLayoutAdminSource.includes('Rundown Test Area')) {
    findings.push('FormLayoutAdminPanel.tsx must provide an integrated Rundown Test Area');
  }

  // Optimistic UI: no jarring full-page loading flashes on grouping/slot moves
  if (formLayoutAdminSource.includes('handleMoveGrouping = async') && formLayoutAdminSource.includes('setLoading(true)')) {
    // Check if handleMoveGrouping itself calls setLoading(true)
    const moveFn = formLayoutAdminSource.match(/const handleMoveGrouping = async[\s\S]*?\n  \};/);
    if (moveFn && moveFn[0].includes('setLoading(true)')) {
      findings.push('handleMoveGrouping must NOT call setLoading(true); use optimistic in-place state');
    }
  }

  return findings;
}

test('SPEC-54-03: Card Grouping Regex Integration, Live Rundown Test Area & Optimistic AJAX guards', () => {
  const registryAdminPath = path.join(root, 'src', 'components', 'admin', 'RegistryAdmin.tsx');
  const formLayoutAdminPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');

  const registryAdminSource = fs.readFileSync(registryAdminPath, 'utf8');
  const formLayoutAdminSource = fs.readFileSync(formLayoutAdminPath, 'utf8');

  const findings = scanSpec54_03Features(registryAdminSource, formLayoutAdminSource);
  assert.deepEqual(findings, [], `SPEC-54-03 findings detected:\n${findings.join('\n')}`);
});

export function scanSpec54_04Features(canvasUtilsSource, artifactEditorSource) {
  const findings = [];

  // canvas-utils.ts center-origin geometry
  if (!canvasUtilsSource.includes("originX: 'center'") || !canvasUtilsSource.includes("originY: 'center'")) {
    findings.push("canvas-utils.ts must configure Fabric objects with originX: 'center' and originY: 'center'");
  }

  // ArtifactEditor.tsx real-time object:rotating synchronization
  if (!artifactEditorSource.includes("canvas.on('object:rotating'")) {
    findings.push("ArtifactEditor.tsx must register 'object:rotating' event listener for real-time rotation sync");
  }

  return findings;
}

test('SPEC-54-04: Canvas Rotation Center-Origin Alignment & Real-Time Sync guards', () => {
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');
  const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');

  const canvasUtilsSource = fs.readFileSync(canvasUtilsPath, 'utf8');
  const artifactEditorSource = fs.readFileSync(artifactEditorPath, 'utf8');

  const findings = scanSpec54_04Features(canvasUtilsSource, artifactEditorSource);
  assert.deepEqual(findings, [], `SPEC-54-04 findings detected:\n${findings.join('\n')}`);
});

test('SPEC-54-04: Numerical Geometry Invariants across Cardinal Rotation Angles (0°, 90°, 180°, 270°)', async () => {
  const { CANVAS_WIDTH, CANVAS_HEIGHT, pctToPx, pxToPct, elementToFabricObject, serializeCanvas } = await import('../src/lib/registry/canvas-utils.ts');

  const angles = [0, 90, 180, 270];

  for (const angle of angles) {
    const element = {
      id: `el-test-rot-${angle}`,
      type: 'text',
      x: 15.5,
      y: 22.0,
      w: 40.0,
      h: 12.0,
      rotation: angle,
      content: 'Rotated Prayer Request',
      zIndex: 1,
    };

    // 1. Ingestion: elementToFabricObject constructs object centered at (x + w/2, y + h/2)
    const mockFabric = {};
    const fabricObj = elementToFabricObject(mockFabric, element, true, { transparentProxy: true });

    assert.strictEqual(fabricObj.originX, 'center', `Expected originX: 'center' at ${angle}°`);
    assert.strictEqual(fabricObj.originY, 'center', `Expected originY: 'center' at ${angle}°`);

    const expectedCenterX = pctToPx(element.x + element.w / 2, CANVAS_WIDTH);
    const expectedCenterY = pctToPx(element.y + element.h / 2, CANVAS_HEIGHT);

    assert.ok(
      Math.abs(fabricObj.left - expectedCenterX) < 0.01,
      `Fabric left (${fabricObj.left}) must match visual center X (${expectedCenterX}) at ${angle}°`
    );
    assert.ok(
      Math.abs(fabricObj.top - expectedCenterY) < 0.01,
      `Fabric top (${fabricObj.top}) must match visual center Y (${expectedCenterY}) at ${angle}°`
    );
    assert.strictEqual(fabricObj.angle, angle, `Fabric angle must match element rotation at ${angle}°`);

    // 2. Serialization: serializeCanvas roundtrips center back to exact top-left
    const mockCanvas = {
      getObjects: () => [
        {
          ...fabricObj,
          left: fabricObj.left,
          top: fabricObj.top,
          angle: fabricObj.angle,
          width: pctToPx(element.w, CANVAS_WIDTH),
          height: pctToPx(element.h, CANVAS_HEIGHT),
          scaleX: 1,
          scaleY: 1,
          data: { ...fabricObj.data },
        },
      ],
    };

    const layout = {
      version: 1,
      elements: [element],
    };

    const serialized = serializeCanvas(mockCanvas, layout, new Map());
    assert.strictEqual(serialized.length, 1);
    const resultEl = serialized[0];

    assert.ok(
      Math.abs(resultEl.x - element.x) < 0.01,
      `Serialized x (${resultEl.x}) must roundtrip to authored x (${element.x}) at ${angle}°`
    );
    assert.ok(
      Math.abs(resultEl.y - element.y) < 0.01,
      `Serialized y (${resultEl.y}) must roundtrip to authored y (${element.y}) at ${angle}°`
    );
    assert.strictEqual(resultEl.rotation, angle, `Serialized rotation must equal ${angle}°`);
  }
});

test('SPEC-68-01-Absence-Guard: Parser profile menu removal defect injection proofs', () => {
  const registryAdminPath = path.join(root, 'src', 'components', 'admin', 'RegistryAdmin.tsx');
  const formLayoutAdminPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');

  const registryAdminSource = fs.readFileSync(registryAdminPath, 'utf8');
  const formLayoutAdminSource = fs.readFileSync(formLayoutAdminPath, 'utf8');

  // Verify baseline is green
  const baselineFindings = scanSpec54_03Features(registryAdminSource, formLayoutAdminSource);
  assert.deepEqual(baselineFindings, [], 'Baseline must have zero findings');

  // Defect 1: inject activeTab === 'profiles'
  const defectProfilesTab = scanSpec54_03Features(
    registryAdminSource,
    formLayoutAdminSource + "\nconst test = activeTab === 'profiles';"
  );
  assert.ok(
    defectProfilesTab.some((f) => f.includes('activeTab === \'profiles\'')),
    'Absence guard must detect injected activeTab === "profiles"'
  );

  // Defect 2: inject <ParserProfilesPanel
  const defectProfilesComponent = scanSpec54_03Features(
    registryAdminSource,
    formLayoutAdminSource + '\nconst test = <ParserProfilesPanel />;'
  );
  assert.ok(
    defectProfilesComponent.some((f) => f.includes('<ParserProfilesPanel')),
    'Absence guard must detect injected <ParserProfilesPanel'
  );
});

export function scanSpec69_01Features(createFormSource, editFormSource) {
  const findings = [];

  // CreateForm.tsx parser profile retirement
  if (createFormSource.includes('selectedProfileId')) {
    findings.push('CreateForm.tsx must NOT contain "selectedProfileId"');
  }
  if (createFormSource.includes("form.parser.profile") || createFormSource.includes("'form.parser.profile'")) {
    findings.push('CreateForm.tsx must NOT contain "form.parser.profile"');
  }
  if (createFormSource.includes("parserProfiles") || createFormSource.includes("setParserProfiles")) {
    findings.push('CreateForm.tsx must NOT maintain parserProfiles state');
  }

  // EditForm.tsx parser profile retirement
  if (editFormSource.includes('selectedProfileId')) {
    findings.push('EditForm.tsx must NOT contain "selectedProfileId"');
  }
  if (editFormSource.includes("form.parser.profile") || editFormSource.includes("'form.parser.profile'")) {
    findings.push('EditForm.tsx must NOT contain "form.parser.profile"');
  }
  if (editFormSource.includes("parserProfiles") || editFormSource.includes("setParserProfiles")) {
    findings.push('EditForm.tsx must NOT maintain parserProfiles state');
  }

  return findings;
}

test('SPEC-69-01: Service form parser profile dropdown retirement absence guard', () => {
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');

  const createFormSource = fs.readFileSync(createFormPath, 'utf8');
  const editFormSource = fs.readFileSync(editFormPath, 'utf8');

  const findings = scanSpec69_01Features(createFormSource, editFormSource);
  assert.deepEqual(findings, [], `SPEC-69-01 findings detected:\n${findings.join('\n')}`);
});

test('SPEC-69-01-Absence-Guard: Service form parser profile retirement defect injection proofs', () => {
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');

  const baseCreateForm = fs.readFileSync(createFormPath, 'utf8');
  const baseEditForm = fs.readFileSync(editFormPath, 'utf8');

  // 1. Baseline: production CreateForm and EditForm must be completely clean
  const baseline = scanSpec69_01Features(baseCreateForm, baseEditForm);
  assert.deepEqual(baseline, [], 'Production CreateForm and EditForm baseline must be clean');

  // 2. Defect Injections on CreateForm
  const defectCreateProfileId = scanSpec69_01Features(
    baseCreateForm + "\nconst [selectedProfileId, setSelectedProfileId] = useState('');",
    baseEditForm
  );
  assert.ok(
    defectCreateProfileId.some((f) => f.includes('CreateForm.tsx must NOT contain "selectedProfileId"')),
    'Must detect selectedProfileId injected into real CreateForm'
  );

  const defectCreateI18n = scanSpec69_01Features(
    baseCreateForm + "\nconst label = t('form.parser.profile');",
    baseEditForm
  );
  assert.ok(
    defectCreateI18n.some((f) => f.includes('CreateForm.tsx must NOT contain "form.parser.profile"')),
    'Must detect form.parser.profile injected into real CreateForm'
  );

  const defectCreateState = scanSpec69_01Features(
    baseCreateForm + "\nconst [parserProfiles, setParserProfiles] = useState([]);",
    baseEditForm
  );
  assert.ok(
    defectCreateState.some((f) => f.includes('CreateForm.tsx must NOT maintain parserProfiles state')),
    'Must detect parserProfiles state injected into real CreateForm'
  );

  // 3. Defect Injections on EditForm
  const defectEditProfileId = scanSpec69_01Features(
    baseCreateForm,
    baseEditForm + "\nconst [selectedProfileId, setSelectedProfileId] = useState('');"
  );
  assert.ok(
    defectEditProfileId.some((f) => f.includes('EditForm.tsx must NOT contain "selectedProfileId"')),
    'Must detect selectedProfileId injected into real EditForm'
  );

  const defectEditI18n = scanSpec69_01Features(
    baseCreateForm,
    baseEditForm + "\nconst label = t('form.parser.profile');"
  );
  assert.ok(
    defectEditI18n.some((f) => f.includes('EditForm.tsx must NOT contain "form.parser.profile"')),
    'Must detect form.parser.profile injected into real EditForm'
  );

  const defectEditState = scanSpec69_01Features(
    baseCreateForm,
    baseEditForm + "\nconst [parserProfiles, setParserProfiles] = useState([]);"
  );
  assert.ok(
    defectEditState.some((f) => f.includes('EditForm.tsx must NOT maintain parserProfiles state')),
    'Must detect parserProfiles state injected into real EditForm'
  );

  // 4. Physical Real-File Mutation & Restoration Proof (CreateForm)
  try {
    fs.writeFileSync(createFormPath, baseCreateForm + "\nconst [selectedProfileId] = useState('');\n", 'utf8');
    const mutatedFindings = scanSpec69_01Features(fs.readFileSync(createFormPath, 'utf8'), baseEditForm);
    assert.ok(
      mutatedFindings.some((f) => f.includes('CreateForm.tsx must NOT contain "selectedProfileId"')),
      'Physical file mutation on CreateForm.tsx must trigger absence guard failure'
    );
  } finally {
    fs.writeFileSync(createFormPath, baseCreateForm, 'utf8');
  }

  // 5. Physical Real-File Mutation & Restoration Proof (EditForm)
  try {
    fs.writeFileSync(editFormPath, baseEditForm + "\nconst [selectedProfileId] = useState('');\n", 'utf8');
    const mutatedFindings = scanSpec69_01Features(baseCreateForm, fs.readFileSync(editFormPath, 'utf8'));
    assert.ok(
      mutatedFindings.some((f) => f.includes('EditForm.tsx must NOT contain "selectedProfileId"')),
      'Physical file mutation on EditForm.tsx must trigger absence guard failure'
    );
  } finally {
    fs.writeFileSync(editFormPath, baseEditForm, 'utf8');
  }

  // 6. Confirm clean restoration
  const restored = scanSpec69_01Features(
    fs.readFileSync(createFormPath, 'utf8'),
    fs.readFileSync(editFormPath, 'utf8')
  );
  assert.deepEqual(restored, [], 'Real files must be cleanly restored to green');
});







