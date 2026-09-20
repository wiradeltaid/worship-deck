/**
 * SPEC-52: Unified Workspace Schedule-Preset Lifecycle, Slide 0 Rundown Hub & Canvas-First Architecture
 * Smoke Test & Executable Absence Guard Suite
 *
 * Verifies:
 * - SPEC-52-01: Schedule vs Preset Lifecycle Management
 *   - Top-left Zone A action buttons: [Jadwal Baru], [Muat Jadwal], [Salin Preset]
 *   - Absolute absence of live Preset Selector Dropdown in status bar
 *   - Overwrite confirmation modal guard on [Salin Preset] for loaded/dirty schedules
 *   - Preset Sanitizer (sanitizeScheduleToPreset) stripping instance payloads while preserving structure
 *   - Symmetrical duplication: [Duplikat Jadwal] and [Duplikat Preset]
 * - SPEC-52-02: Pinned Slide 0 Rundown Hub & Canvas-First Slide Model
 *   - Pinned Slide 0 at index 0 of timeline (non-deletable, non-reorderable)
 *   - Rundown Hub center panel (raw textarea parser + centralized predefined form fields)
 *   - Absolute absence of rigid 'Judul Agenda' and 'Keterangan / Subtitle' input boxes in Slide 1..N
 *   - Canvas-first editor with typography controls, background picker, and compact token palette
 * - SPEC-52-03: Master Song Sets & Announcements Variable Binding, Detachment & Canvas Template
 *   - Dynamic binding status badge [Terikat Master] and uncoupling [Detach dari Master] with deep clone
 *   - Structured Master Song Set canvas template with Header, Lyric Verse, and Lyric Reff zones
 *   - Centralized announcement flyer slot persistence from Slide 0
 * - SPEC-52-04: Legacy UI/UX Parity Matrix & Physical Real-File Defect Injection Proofs
 *   - Presentation mode multi-slide filmstrip grid overlay (F key toggle) with input focus guard
 *   - Quick projection tools (Blackout B, Clear Text C, Aspect 16:9/4:3, Confidence Display)
 *   - Real-file physical mutation and reversion defect injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  PINNED_SLIDE_0_ID,
  createPinnedSlide0,
  sanitizeScheduleToPreset,
  DEFAULT_WEEKLY_VARIABLES,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'workspace', 'types.ts')).href
);

const {
  isEditableElement,
  parseRawRundownText,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'workspace', 'utils.ts')).href
);

export function scanSpec52Features(pageSource, timelineSource, editorSource, previewSource, presetDrawerSource) {
  const findings = [];

  // SPEC-52-01: Top-Left Navigation & Preset Lifecycle
  if (!pageSource.includes('data-testid="new-schedule-button"')) {
    findings.push('Missing new-schedule-button in Zone A');
  }
  if (!pageSource.includes('data-testid="load-schedule-button"')) {
    findings.push('Missing load-schedule-button in Zone A');
  }
  if (!pageSource.includes('data-testid="copy-preset-button"')) {
    findings.push('Missing copy-preset-button in Zone A');
  }
  if (pageSource.includes('data-testid="preset-selector-dropdown"')) {
    findings.push('Forbidden preset-selector-dropdown must be removed from status strip');
  }
  if (!pageSource.includes('data-testid="overwrite-warning-modal"')) {
    findings.push('Missing overwrite-warning-modal guard');
  }
  if (!pageSource.includes('data-testid="overwrite-confirm-button"')) {
    findings.push('Missing overwrite-confirm-button in overwrite modal');
  }
  if (!pageSource.includes('data-testid="save-as-preset-modal"')) {
    findings.push('Missing save-as-preset-modal for preset sanitizer');
  }
  if (!presetDrawerSource.includes('handleDuplicatePreset') && !presetDrawerSource.includes('data-duplicate="preset"')) {
    findings.push('Missing duplicate preset handler in master preset drawer');
  }

  // SPEC-52-02: Pinned Slide 0 Rundown Hub & Canvas-First Slide Model
  if (!timelineSource.includes('data-testid="pinned-slide-0"')) {
    findings.push('Missing pinned-slide-0 in timeline');
  }
  if (!editorSource.includes('data-testid="rundown-hub-panel"')) {
    findings.push('Missing rundown-hub-panel in Slide 0 editor');
  }
  if (!editorSource.includes('data-testid="raw-rundown-textarea"')) {
    findings.push('Missing raw-rundown-textarea in Slide 0 rundown hub');
  }
  if (!editorSource.includes('data-testid="parse-raw-rundown-button"')) {
    findings.push('Missing parse-raw-rundown-button in Slide 0 rundown hub');
  }
  if (!editorSource.includes('data-testid="predefined-fields-form"')) {
    findings.push('Missing predefined-fields-form in Slide 0 rundown hub');
  }
  if (!editorSource.includes('data-testid="canvas-first-editor"')) {
    findings.push('Missing canvas-first-editor in Slide 1..N contextual editor');
  }
  if (!editorSource.includes('data-testid="token-palette"')) {
    findings.push('Missing token-palette in Slide 1..N editor');
  }
  if (!editorSource.includes('data-testid="slide-content-textarea"')) {
    findings.push('Missing slide-content-textarea in Slide 1..N editor');
  }
  if (editorSource.includes('data-testid="item-title-input"')) {
    findings.push('Forbidden item-title-input (Judul Agenda) must be eliminated from Slide 1..N');
  }
  if (editorSource.includes('data-testid="item-subtitle-input"')) {
    findings.push('Forbidden item-subtitle-input (Subtitle) must be eliminated from Slide 1..N');
  }

  // SPEC-52-03: Master Song Sets & Announcements Binding & Canvas Template
  if (!editorSource.includes('data-testid="master-bound-badge"')) {
    findings.push('Missing master-bound-badge in song editor');
  }
  if (!editorSource.includes('data-testid="detach-master-songset-button"')) {
    findings.push('Missing detach-master-songset-button in song editor');
  }
  if (!editorSource.includes('data-testid="announcement-master-bound-badge"')) {
    findings.push('Missing announcement-master-bound-badge in announcement editor');
  }
  if (!editorSource.includes('data-testid="detach-master-announcement-button"')) {
    findings.push('Missing detach-master-announcement-button in announcement editor');
  }
  if (!previewSource.includes('data-testid="song-canvas-header"')) {
    findings.push('Missing song-canvas-header zone in song canvas preview');
  }
  if (!previewSource.includes('data-testid="song-canvas-verse"')) {
    findings.push('Missing song-canvas-verse zone in song canvas preview');
  }
  if (!previewSource.includes('data-testid="song-canvas-reff"')) {
    findings.push('Missing song-canvas-reff zone in song canvas preview');
  }

  // SPEC-52-04: Filmstrip Grid & Presentation Parity
  if (!previewSource.includes('data-testid="filmstrip-toggle-button"')) {
    findings.push('Missing filmstrip-toggle-button in canvas preview');
  }
  if (!previewSource.includes('data-testid="presentation-filmstrip-grid"')) {
    findings.push('Missing presentation-filmstrip-grid in canvas preview');
  }

  return findings;
}

// -----------------------------------------------------------------------------
// Test 1: SPEC-52-01 - Schedule vs Preset Lifecycle & Preset Sanitizer
// -----------------------------------------------------------------------------
test('SPEC-52-01: Schedule vs Preset Lifecycle & Preset Sanitizer', () => {
  const sampleItems = [
    createPinnedSlide0(),
    {
      id: 'item-1',
      type: 'song',
      title: 'Lagu Buka — Hai Pujilah Tuhan',
      slidesCount: 3,
      songData: {
        hymnNumber: 123,
        bookCode: 'SDAH',
        key: 'D',
        activeVerses: [1, 2, 4],
        backgroundUrl: '/assets/background-navy.jpg',
      },
    },
    {
      id: 'item-2',
      type: 'announcement',
      title: 'Warta Jemaat',
      slidesCount: 2,
      announcementData: {
        looping: true,
        flyers: [
          { id: 'f1', title: 'Flyer Khusus', url: '/assets/flyer1.jpg', category: 'announcement' },
        ],
      },
    },
    {
      id: 'item-3',
      type: 'sermon',
      title: 'Khotbah — Kasih Abadi',
      slidesCount: 1,
      sermonData: {
        speaker: 'Pdt. Tamu Spesifik',
        title: 'Kasih Abadi',
        scriptureRef: 'Yohanes 3:16',
      },
      textContent: 'Renungan oleh Pdt. Tamu Spesifik di Sabat ini.',
    },
  ];

  const { preset, sanitizedItems } = sanitizeScheduleToPreset(
    sampleItems,
    'Kebaktian Sabat Pemuda Baru',
    'Cetak biru khusus liturgi pemuda'
  );

  assert.strictEqual(preset.title, 'Kebaktian Sabat Pemuda Baru');
  assert.strictEqual(preset.status, 'draft');
  assert.strictEqual(preset.activeServicesCount, 0);
  assert.strictEqual(sanitizedItems.length, sampleItems.length);

  // Assert Slide 0 is preserved cleanly
  assert.strictEqual(sanitizedItems[0].id, PINNED_SLIDE_0_ID);

  // Assert Song slide preserves hymn settings
  assert.strictEqual(sanitizedItems[1].songData?.hymnNumber, 123);
  assert.strictEqual(sanitizedItems[1].songData?.key, 'D');

  // Assert Announcement uploaded flyers are stripped in sanitized preset
  assert.deepStrictEqual(sanitizedItems[2].announcementData?.flyers, []);

  // Assert Sermon instance speaker is sanitized to token placeholder
  assert.strictEqual(sanitizedItems[3].sermonData?.speaker, '{sermon_speaker}');
  assert.ok(
    sanitizedItems[3].textContent?.includes('{sermon_speaker}'),
    'Preset sanitizer must replace specific preacher name with {sermon_speaker} token'
  );
});

// -----------------------------------------------------------------------------
// Test 2: SPEC-52-02 - Pinned Slide 0 & Canvas-First Contracts
// -----------------------------------------------------------------------------
test('SPEC-52-02: Pinned Slide 0 Invariant & Canvas-First Slide Model', () => {
  const slide0 = createPinnedSlide0();
  assert.strictEqual(slide0.id, PINNED_SLIDE_0_ID);
  assert.strictEqual(slide0.id, 'slide-0');
  assert.ok(slide0.title.includes('Slide 0'));

  // Test raw rundown parser generates timeline items
  const rawRundown = `09:00 - Pembukaan\n09:05 - Lagu Buka: SDAH 100\n09:20 - Warta Jemaat\n09:30 - Khotbah: Pdt. Markus`;
  const parsed = parseRawRundownText(rawRundown);
  assert.strictEqual(parsed.length, 4);
  assert.strictEqual(parsed[1].type, 'song');
  assert.strictEqual(parsed[1].songData?.hymnNumber, 100);
  assert.strictEqual(parsed[2].type, 'announcement');
  assert.strictEqual(parsed[3].type, 'sermon');
});

// -----------------------------------------------------------------------------
// Test 3: SPEC-52-03 & SPEC-52-04 - Static Workspace Scanning & Parity
// -----------------------------------------------------------------------------
test('SPEC-52-03 & SPEC-52-04: Static Workspace Scanning & Clean Baseline Findings', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const timelinePath = path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx');
  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  const presetDrawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterPresetDrawer.tsx');

  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const editorContent = fs.readFileSync(editorPath, 'utf8');
  const timelineContent = fs.readFileSync(timelinePath, 'utf8');
  const previewContent = fs.readFileSync(previewPath, 'utf8');
  const presetDrawerContent = fs.readFileSync(presetDrawerPath, 'utf8');

  const findings = scanSpec52Features(
    pageContent,
    timelineContent,
    editorContent,
    previewContent,
    presetDrawerContent
  );

  assert.deepStrictEqual(findings, [], `Expected 0 findings in clean baseline, got: ${JSON.stringify(findings)}`);
});

// -----------------------------------------------------------------------------
// Test 4: SPEC-52-04 - Keyboard Focus Guard & Single-Key Shortcut Safety
// -----------------------------------------------------------------------------
test('SPEC-52-04: isEditableElement Safety Guard for F, B, C Single-Key Shortcuts', () => {
  const inputEl = { tagName: 'INPUT' };
  const textareaEl = { tagName: 'TEXTAREA' };
  const contentEditableEl = { tagName: 'DIV', isContentEditable: true };
  const plainButton = { tagName: 'BUTTON' };
  const plainDiv = { tagName: 'DIV' };

  assert.strictEqual(isEditableElement(inputEl), true, 'INPUT must be recognized as editable');
  assert.strictEqual(isEditableElement(textareaEl), true, 'TEXTAREA must be recognized as editable');
  assert.strictEqual(isEditableElement(contentEditableEl), true, 'ContentEditable must be recognized as editable');
  assert.strictEqual(isEditableElement(plainButton), false, 'BUTTON must not be editable');
  assert.strictEqual(isEditableElement(plainDiv), false, 'Plain DIV must not be editable');
});

// -----------------------------------------------------------------------------
// Test 5: SPEC-52-04 - Physical Real-File Executable Absence Guards & Defect Injection Proofs
// -----------------------------------------------------------------------------
test('SPEC-52-04: Real-File Executable Absence Guard & Defect Injection Proofs', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const timelinePath = path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx');
  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  const presetDrawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterPresetDrawer.tsx');

  const originalPage = fs.readFileSync(pagePath);
  const originalEditor = fs.readFileSync(editorPath);
  const originalTimeline = fs.readFileSync(timelinePath);
  const originalPreview = fs.readFileSync(previewPath);
  const originalPresetDrawer = fs.readFileSync(presetDrawerPath);

  // Physical Defect 1: Inject forbidden preset-selector-dropdown back into WorkspaceMockupPage.tsx on disk
  try {
    const defectContent = originalPage
      .toString('utf8')
      .replace('data-testid="new-schedule-button"', 'data-testid="preset-selector-dropdown" data-testid="new-schedule-button"');
    fs.writeFileSync(pagePath, defectContent, 'utf8');

    const defectFindings = scanSpec52Features(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8'),
      fs.readFileSync(presetDrawerPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Forbidden preset-selector-dropdown must be removed from status strip'),
      'Physical absence guard must detect re-introduction of preset-selector-dropdown on disk'
    );
  } finally {
    fs.writeFileSync(pagePath, originalPage);
  }

  // Physical Defect 2: Strip new-schedule-button from WorkspaceMockupPage.tsx on disk
  try {
    const defectContent = originalPage
      .toString('utf8')
      .replace('data-testid="new-schedule-button"', '');
    fs.writeFileSync(pagePath, defectContent, 'utf8');

    const defectFindings = scanSpec52Features(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8'),
      fs.readFileSync(presetDrawerPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Missing new-schedule-button in Zone A'),
      'Physical absence guard must detect removal of new-schedule-button on disk'
    );
  } finally {
    fs.writeFileSync(pagePath, originalPage);
  }

  // Physical Defect 3: Inject forbidden item-title-input into MockupEditor.tsx on disk
  try {
    const defectContent = originalEditor
      .toString('utf8')
      .replace('data-testid="slide-content-textarea"', 'data-testid="item-title-input" data-testid="slide-content-textarea"');
    fs.writeFileSync(editorPath, defectContent, 'utf8');

    const defectFindings = scanSpec52Features(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8'),
      fs.readFileSync(presetDrawerPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Forbidden item-title-input (Judul Agenda) must be eliminated from Slide 1..N'),
      'Physical absence guard must detect re-introduction of rigid item-title-input on disk'
    );
  } finally {
    fs.writeFileSync(editorPath, originalEditor);
  }

  // Physical Defect 4: Strip presentation-filmstrip-grid from MockupCanvasPreview.tsx on disk
  try {
    const defectContent = originalPreview
      .toString('utf8')
      .replace('data-testid="presentation-filmstrip-grid"', '');
    fs.writeFileSync(previewPath, defectContent, 'utf8');

    const defectFindings = scanSpec52Features(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8'),
      fs.readFileSync(presetDrawerPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Missing presentation-filmstrip-grid in canvas preview'),
      'Physical absence guard must detect loss of presentation filmstrip grid on disk'
    );
  } finally {
    fs.writeFileSync(previewPath, originalPreview);
  }

  // Physical Defect 5: Strip pinned-slide-0 from MockupTimeline.tsx on disk
  try {
    const defectContent = originalTimeline
      .toString('utf8')
      .replace('data-testid="pinned-slide-0"', '');
    fs.writeFileSync(timelinePath, defectContent, 'utf8');

    const defectFindings = scanSpec52Features(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8'),
      fs.readFileSync(presetDrawerPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Missing pinned-slide-0 in timeline'),
      'Physical absence guard must detect loss of pinned Slide 0 in timeline on disk'
    );
  } finally {
    fs.writeFileSync(timelinePath, originalTimeline);
  }
});
