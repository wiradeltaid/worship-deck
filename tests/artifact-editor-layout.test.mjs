/**
 * SPEC-12-05 / BUG-11: Main Spine layout height and viewport fit guard.
 *
 * Verifies:
 * 1. Main Spine editor container enforces a minimum height floor (min-h-[...]).
 * 2. Canvas shell container defines a viewport-bounded max-height (max-h-[calc(100vh-...)] and min-h-[...])
 *    so canvas fits within the screen and scales via fitCanvasToShell instead of blowing out page height.
 * 3. Deck Sequence list container restricts max-height to viewport and enables internal scroll (overflow-y-auto).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('SPEC-12-05: Main Spine editor layout height and viewport constraints', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Minimum height floor on outer editor container
  assert.ok(
    code.includes('min-h-[560px]') || code.includes('min-h-[580px]') || code.includes('min-h-[600px]'),
    'Outer editor container must declare a minimum height floor (e.g. min-h-[580px])'
  );

  // 2. Canvas shell container has max-height bound to viewport so fitCanvasToShell bounds the canvas
  assert.match(
    code,
    /ref=\{canvasShellRef\}[\s\S]*?max-h-\[calc\(100vh-\d+px\)\]/,
    'canvasShellRef container must bound max-height to viewport (max-h-[calc(100vh-...px)])'
  );
  assert.match(
    code,
    /ref=\{canvasShellRef\}[\s\S]*?min-h-\[\d+px\]/,
    'canvasShellRef container must specify a min-height floor'
  );

  // 3. Deck sequence list container internal scroll
  assert.match(
    code,
    /max-h-\[calc\(100vh-\d+px\)\][\s\S]*?overflow-y-auto/,
    'Deck sequence list must be constrained to viewport with internal overflow-y-auto'
  );
});

test('SPEC-13-04 / SPEC-14-02 / SPEC-15-02 / SPEC-16-01: Deck Sequence card flex containment and desktop bottom alignment with canvas (BUG-11)', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // Bounded structural assertion: <aside> contains lg:flex lg:flex-col, and its Deck Sequence child container carries flex-1 with lg:max-h-[calc(100vh-270px)]
  const asideStart = code.indexOf('<aside className=');
  assert.ok(asideStart !== -1, 'Must find <aside');
  const asideEnd = code.indexOf('</aside>', asideStart);
  assert.ok(asideEnd !== -1, 'Must find matching </aside>');
  const asideBlock = code.slice(asideStart, asideEnd);

  assert.ok(
    asideBlock.includes('lg:flex lg:flex-col'),
    'Left aside must carry lg:flex lg:flex-col to span full height on desktop'
  );
  assert.ok(
    asideBlock.includes('lg:h-0 lg:min-h-full'),
    'Left aside must carry lg:h-0 lg:min-h-full to prevent unconstrained row height expansion'
  );
  assert.ok(
    asideBlock.includes('flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-full'),
    'Deck Sequence card inside aside must carry flex-1 with lg:max-h-full to stretch and align with canvas bottom'
  );
  assert.ok(
    !asideBlock.includes('lg:max-h-none'),
    'Deck Sequence card must NOT carry lg:max-h-none, which causes indefinite expansion and page scrolling on desktop'
  );

  // Deck sequence header must be shrink-0 co-located with layout classes
  assert.ok(
    code.includes('justify-between shrink-0'),
    'Deck sequence header div must carry shrink-0 alongside its layout classes'
  );

  // Deck sequence ul must have flex-1 min-h-0 overflow-y-auto
  assert.ok(
    code.includes('overflow-y-auto pr-1 flex-1 min-h-0'),
    'Deck sequence ul must have flex-1 min-h-0 overflow-y-auto to scroll within bounded card'
  );
});

test('SPEC-13-05: Song Set tab banner height fixed and overflow-hidden (BUG-14)', () => {
  const panelPath = path.join(root, 'src', 'components', 'admin', 'SongSetEntriesPanel.tsx');
  const code = fs.readFileSync(panelPath, 'utf8');

  // Banner must have fixed height and overflow-hidden so text wrapping never shifts canvas
  assert.ok(
    code.includes('min-h-[42px] h-[42px] overflow-hidden'),
    'SongSetEntriesPanel banner must enforce exact height h-[42px] with overflow-hidden'
  );

  // Banner text must have flex-1 min-w-0 truncate to prevent line wrapping and allow shrinking
  assert.ok(
    code.includes('className="flex-1 min-w-0 truncate mr-2"'),
    'Banner descriptive text must carry flex-1 min-w-0 truncate classes'
  );

  // Role badge must have shrink-0
  assert.ok(
    code.includes('rounded border border-blue-500/30 shrink-0'),
    'Role badge must carry shrink-0 so it is never compressed'
  );
});

test('SPEC-13-07: Title area Rename height stability across canvas-bearing editor headers and Song Set trio drops Rename (BUG-16, BUG-23)', () => {
  const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const annSetsPath = path.join(root, 'src', 'components', 'admin', 'AnnouncementSetsPanel.tsx');
  const songSetsPath = path.join(root, 'src', 'components', 'admin', 'SongSetEntriesPanel.tsx');
  const adaptersPath = path.join(root, 'src', 'lib', 'registry', 'canvas-adapters.ts');

  const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');
  const annSetsCode = fs.readFileSync(annSetsPath, 'utf8');
  const songSetsCode = fs.readFileSync(songSetsPath, 'utf8');
  const adaptersCode = fs.readFileSync(adaptersPath, 'utf8');

  // Surface 1: Main Spine slide title card in ArtifactEditor enforces min-h-[58px]
  assert.ok(
    editorCode.includes('px-4 py-3 flex items-center justify-between shadow-sm min-h-[58px]'),
    'Surface 1: Main Spine slide header card must enforce min-h-[58px] height stability'
  );
  // Main Spine rename Input must be h-8 (32px), matching py-3 (24px) + border (2px) = 58px total
  assert.ok(
    editorCode.includes('className="text-base font-semibold max-w-sm h-8"'),
    'Surface 1: Main Spine rename input must be explicitly h-8 so height stays 58px in rename state'
  );

  // Surface 2: Announcement Set Active Set row in AnnouncementSetsPanel enforces min-h-[58px] (from SPEC-12-08)
  assert.ok(
    annSetsCode.includes('<div className="min-h-[58px]">'),
    'Surface 2: Announcement Set Active Set row must enforce min-h-[58px] height stability'
  );

  // Surface 3: Song Set rename in SongSetEntriesPanel (SPEC-14-06 / SPEC-15-04 / BUG-24, BUG-29)
  // Rename inputs render inside the top card edit mode with fixed h-8 constraint, removing the redundant canvas header card
  assert.ok(
    !songSetsCode.includes('min-h-[58px]'),
    'Surface 3: Redundant Rename Header Card above canvas trio must be removed'
  );
  assert.ok(
    songSetsCode.includes('className="text-xs font-semibold h-8 w-full"') &&
    songSetsCode.includes('className="text-xs font-mono h-8 flex-1 min-w-0"'),
    'Surface 3: Song Set top card rename inputs must use h-8 height constraint'
  );

  // BUG-23: Song Set trio drops Rename control
  // 1. ArtifactEditor accepts allowRename prop defaulting to true and guards Rename button & input branch
  assert.ok(
    editorCode.includes('allowRename = true'),
    'ArtifactEditor must declare allowRename defaulting to true'
  );
  assert.ok(
    editorCode.includes('{allowRename && isRenaming ? ('),
    'ArtifactEditor must guard rename input branch with allowRename'
  );

  // Structural slice assertion: from {allowRename ? ( to the first subsequent ) : null}
  const allowRenameStart = editorCode.indexOf('{allowRename ? (');
  assert.ok(allowRenameStart !== -1, 'Must find {allowRename ? (');
  const allowRenameEnd = editorCode.indexOf(') : null}', allowRenameStart);
  assert.ok(allowRenameEnd !== -1, 'Must find matching ) : null}');
  const allowRenameBlock = editorCode.slice(allowRenameStart, allowRenameEnd);

  assert.ok(
    allowRenameBlock.includes("{t('admin.artifacts.rename')}"),
    'Rename button must be contained strictly inside the allowRename block'
  );
  assert.ok(
    allowRenameBlock.includes('<div className="h-4 w-px bg-border mx-1" />'),
    'Divider must be contained strictly inside the allowRename block so it is omitted when allowRename is false'
  );

  // Negative assertion: outside allowRenameBlock (between allowRenameEnd and Canvas: group), no duplicate divider must exist
  const canvasGroupIndex = editorCode.indexOf('Canvas:', allowRenameEnd);
  assert.ok(canvasGroupIndex !== -1, 'Must find Canvas: group');
  const betweenBlock = editorCode.slice(allowRenameEnd, canvasGroupIndex);
  assert.ok(
    !betweenBlock.includes('<div className="h-4 w-px bg-border mx-1" />'),
    'No duplicate divider must exist outside the allowRename block'
  );

  // 2. SongSetEntriesPanel passes allowRename={false} to ArtifactEditor
  assert.ok(
    songSetsCode.includes('allowRename={false}'),
    'SongSetEntriesPanel must pass allowRename={false} to trio ArtifactEditor'
  );

  // 3. createSongSetTrioAdapter provides static labels 'Title Slide', 'Verse Layout', 'Refrain Layout'
  assert.ok(
    adaptersCode.includes("{ id: 'title', label: 'Title Slide' }") &&
    adaptersCode.includes("{ id: 'verse', label: 'Verse Layout' }") &&
    adaptersCode.includes("{ id: 'reff', label: 'Refrain Layout' }"),
    'createSongSetTrioAdapter must provide static labels Title Slide, Verse Layout, Refrain Layout'
  );

  // 4. SongSetEntriesPanel tab button correctly reads '3. Refrain Layout'
  assert.ok(
    songSetsCode.includes('3. Refrain Layout'),
    'SongSetEntriesPanel tab button must read "3. Refrain Layout"'
  );
});

test('SPEC-14-07 / SPEC-17-02: Toolbar properties bar height stability on selection', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // Element properties toolbar must be locked to a fixed 88px height (h-[88px] min-h-[88px] max-h-[88px])
  assert.ok(
    code.includes('h-[88px] min-h-[88px] max-h-[88px]'),
    'Element Properties toolbar must lock height to 88px with flex-col to prevent downward canvas shifts'
  );

  // Absence guard: single-row 44px container must be absent
  assert.ok(
    !code.includes('h-11 min-h-[44px] max-h-[44px]'),
    'Element Properties toolbar must NOT use single-row 44px height'
  );
});

test('SPEC-17-02: guard proof: h-11 presence fails toolbar absence-guard', () => {
  const defectiveCode = '<div className="h-11 min-h-[44px] max-h-[44px]"></div>';
  assert.throws(() => {
    assert.ok(
      !defectiveCode.includes('h-11 min-h-[44px] max-h-[44px]'),
      'Toolbar must NOT carry h-11 min-h-[44px] max-h-[44px]'
    );
  }, /Toolbar must NOT carry h-11 min-h-\[44px\] max-h-\[44px\]/);
});

test('SPEC-16-01: guard proof: lg:max-h-none presence fails unconstrained desktop absence-guard', () => {
  const defectiveCode = '<aside><div className="flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none"></div></aside>';
  assert.throws(() => {
    assert.ok(
      !defectiveCode.includes('lg:max-h-none'),
      'Deck Sequence card must NOT carry lg:max-h-none'
    );
  }, /Deck Sequence card must NOT carry lg:max-h-none/);
});

test('SPEC-18-02: Searchable font picker with high-contrast category headers', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. High-contrast category header styling
  assert.ok(
    code.includes('bg-muted/90') &&
      code.includes('border-primary') &&
      code.includes('text-foreground font-bold'),
    'Font category headers must have high-contrast background and border-primary styling'
  );

  // 2. Search input for fonts
  assert.ok(
    code.includes("placeholder={t('admin.artifacts.searchFonts')}") ||
      code.includes('admin.artifacts.searchFonts'),
    'Font dropdown must provide search input with admin.artifacts.searchFonts placeholder'
  );

  // 3. Dynamic font filtering by search query
  assert.ok(
    code.includes('fontSearchQuery') &&
      code.includes('f.label.toLowerCase().includes(query)'),
    'Font list must filter dynamically by label matching query'
  );

  // 4. Stop propagation on search input keydown to prevent select premature close/navigation
  assert.ok(
    code.includes('e.stopPropagation()'),
    'Search input must stop keydown propagation'
  );

  // 4b. SPEC-20-01: Font combobox PopoverContent must anchor neatly under the trigger (side="bottom", align="start")
  assert.ok(
    code.includes('side="bottom"') &&
      code.includes('align="start"'),
    'Font dropdown PopoverContent must configure side="bottom" and align="start"'
  );

  // 5. Properties toolbar locked to 88px
  assert.ok(
    code.includes('h-[88px] min-h-[88px] max-h-[88px]'),
    'Properties toolbar must remain locked to 88px'
  );
});

test('Option A Layer Stacking: Visual Layer isolates internal zIndex and Interaction Layer enforces top zIndex', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // Visual layer must enforce zIndex: 1 and isolation: 'isolate' to prevent slide internal z-indices from leaking
  assert.match(
    code,
    /Visual Layer[\s\S]*?zIndex:\s*1,[\s\S]*?isolation:\s*['"]isolate['"]/,
    'Visual Layer wrapper must enforce zIndex: 1 and isolation: isolate'
  );

  // Interaction layer must enforce zIndex: 10 to stay strictly above Visual Layer
  assert.match(
    code,
    /Interaction Layer[\s\S]*?zIndex:\s*10/,
    'Interaction Layer wrapper must enforce zIndex: 10'
  );
});



