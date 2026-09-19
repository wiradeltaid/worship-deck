/**
 * Unsaved canvas work is not lost silently (Story 17.4).
 *
 * `AD-13` gives Fabric ownership of the canvas and lets React read it only on
 * Save. The consequence for the operator is that every unsaved move, insert,
 * delete and style edit is invisible to the application — and there were four
 * ways out of the editor that discarded it without a word. This file is the
 * regression net for the three that this story closes (the fourth, logout, is
 * deferred-work.md operator-UI wiring and deliberately out of scope).
 *
 * **Two kinds of assertion, and the split is forced by the runtime.** The
 * transition rules and the `beforeunload` handler are a plain `.ts` module with
 * no React and no Fabric in it, so `node:test` calls them directly — the
 * `theme-cycle.ts`/`nextTheme` precedent `project-context.md` names. Fabric
 * mutation events, a real `beforeunload`, and a real `<Link>` click cannot be
 * exercised here: this repo has no `jsdom` and no `@testing-library`, and adding
 * a second test runner is forbidden. Those wiring points are asserted over the
 * TypeScript AST instead.
 *
 * **AST nodes, not text.** `tests/theme-chrome.test.mjs` had to grow a
 * comment-stripping scanner because four of its assertions were satisfiable by a
 * word in a comment. Matching parsed nodes sidesteps that class entirely: a
 * comment is not a `CallExpression`, so no assertion below can be kept green by
 * prose, and none can be broken by prose either. Where an assertion does read
 * text it reads `node.getText()` of a specific node, never the file.
 *
 * **AC-1's hardest clause is the negative one.** `AD-24` names this story by
 * number as the live instance of "unsaved editor state stays in memory": an
 * `ArtifactLayout` parked in `localStorage` would pass every word of the tier
 * test while escaping the entire registry write contract. So the guards below
 * assert the *absence* of a storage write and a closed set of `fetch` targets,
 * not just the presence of the flag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRaw = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const srcUrl = (...parts) => pathToFileURL(path.join(repoRoot, ...parts)).href;

/**
 * The subject, imported above the first `test()` on purpose.
 *
 * A dynamic import is a top-level `await` and suspends module evaluation; the
 * runner starts the tests it already has while it waits, so anything declared
 * below the await is still in its temporal dead zone when they run.
 * `tests/theme-chrome.test.mjs` lost that race on CI and won it locally for a
 * while, which is the worst version of the bug. Hoisting makes it unreachable.
 */
const guard = await import(srcUrl('src', 'lib', 'canvas-dirty-guard.ts'));

// --- the AST, parsed once per file ------------------------------------------

const sources = new Map();

/** Parse with the same grammar the application compiles with. */
function ast(rel) {
  if (!sources.has(rel)) {
    sources.set(
      rel,
      ts.createSourceFile(
        rel,
        readRaw(rel),
        ts.ScriptTarget.Latest,
        true,
        rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      )
    );
  }
  return sources.get(rel);
}

/** Every node under `root` matching `predicate`, in source order. */
function nodes(root, predicate) {
  const out = [];
  const visit = (node) => {
    if (predicate(node)) out.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return out;
}

/** Calls written exactly as `name(...)` — `canvas.on`, `nextDirtyState`, … */
function callsNamed(root, name) {
  return nodes(
    root,
    (node) => ts.isCallExpression(node) && node.expression.getText() === name
  );
}

/** The literal text of argument `index`, or `undefined` when it is not a literal. */
function stringArg(call, index) {
  const arg = call.arguments[index];
  if (!arg) return undefined;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return arg.text;
  }
  return undefined;
}

/**
 * The one declaration of `name` — `const`, `function` or `type` alike, so a
 * handler can be scoped without the assertion caring how it was spelled.
 */
function declarationOf(root, name) {
  const found = nodes(
    root,
    (node) =>
      (ts.isVariableDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isTypeAliasDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
  );
  assert.equal(found.length, 1, `expected exactly one declaration of \`${name}\``);
  return found[0];
}

/** Identifiers spelled `name`, wherever they appear under `root`. */
function identifiers(root, name) {
  return nodes(root, (node) => ts.isIdentifier(node) && node.text === name);
}

/** Opening / self-closing JSX tags named `tag`. */
function jsxTags(root, tag) {
  return nodes(
    root,
    (node) =>
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === tag
  );
}

/** Module specifiers this file imports from. */
function importSpecifiers(root) {
  return nodes(root, ts.isImportDeclaration).map((node) =>
    node.moduleSpecifier.getText().slice(1, -1)
  );
}

/** Named bindings imported from `moduleSpecifier`. */
function importedNames(root, moduleSpecifier) {
  const out = [];
  for (const decl of nodes(root, ts.isImportDeclaration)) {
    if (decl.moduleSpecifier.getText().slice(1, -1) !== moduleSpecifier) continue;
    const bindings = decl.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) out.push(element.name.text);
    }
    if (decl.importClause?.name) out.push(decl.importClause.name.text);
  }
  return out;
}

// --- AC-1/AC-2: the transition rules, called rather than matched ------------

test('AC-1: a canvas mutation is the only event that sets the flag', () => {
  assert.equal(guard.nextDirtyState(false, 'mutated'), true);
  assert.equal(guard.nextDirtyState(true, 'mutated'), true, 'already dirty stays dirty');
});

test('AC-1: save, reset and a fresh mount are the only events that clear it', () => {
  for (const event of ['saved', 'reset', 'template-changed']) {
    assert.equal(
      guard.nextDirtyState(true, event),
      false,
      `\`${event}\` must clear the flag`
    );
    assert.equal(guard.nextDirtyState(false, event), false);
  }
});

test('AC-1: an event the table does not know leaves the flag alone', () => {
  // Clearing is the one direction that loses work, so an unrecognised event —
  // a kind added later and wired at one call site only — must not take that
  // direction by default. Same posture as `asThemeChoice`: coerce, do not trust.
  assert.equal(guard.nextDirtyState(true, 'something-new'), true);
  assert.equal(guard.nextDirtyState(false, 'something-new'), false);
  assert.equal(guard.nextDirtyState(true, undefined), true);
});

test('AC-2: the beforeunload handler does both halves of the native prompt', () => {
  let prevented = 0;
  const event = {
    preventDefault: () => {
      prevented += 1;
    },
    returnValue: 'untouched',
  };

  guard.beforeUnloadGuard(event);

  assert.equal(prevented, 1, 'modern browsers honour preventDefault()');
  assert.equal(
    event.returnValue,
    '',
    'Safari and older Chrome only honour the legacy returnValue assignment; ' +
      'the string itself is never shown — the browser substitutes its own wording'
  );
});

// --- AC-2/AC-3/AC-4: one rule for all three confirm-gated exits -------------

test('AC-3/AC-4: a clean canvas is never prompted', () => {
  let asked = 0;
  const proceed = guard.mayDiscard(false, 'ignored', () => {
    asked += 1;
    return false;
  });

  assert.equal(proceed, true, 'nothing to lose, so the exit proceeds');
  assert.equal(asked, 0, 'an operator who has touched nothing must see no dialog');
});

test('AC-3/AC-4: a dirty canvas asks, and the answer is the answer', () => {
  const seen = [];
  const ask = (answer) => (message) => {
    seen.push(message);
    return answer;
  };

  assert.equal(guard.mayDiscard(true, 'leave?', ask(true)), true, 'confirmed proceeds');
  assert.equal(guard.mayDiscard(true, 'leave?', ask(false)), false, 'declined stays put');
  assert.deepEqual(seen, ['leave?', 'leave?'], 'the message reaches confirm verbatim');
});

test('AC-1/AC-3/AC-4: the operator-facing copy exists and names the risk', () => {
  assert.match(guard.UNSAVED_INDICATOR_LABEL, /unsaved/i);
  for (const copy of [
    guard.DISCARD_ON_SWITCH_CONFIRMATION,
    guard.DISCARD_ON_LEAVE_CONFIRMATION,
  ]) {
    assert.match(copy, /unsaved/i, 'the dialog must say what is at stake');
    assert.match(copy, /discard/i);
  }
  assert.notEqual(
    guard.DISCARD_ON_SWITCH_CONFIRMATION,
    guard.DISCARD_ON_LEAVE_CONFIRMATION,
    'switching template and leaving the page are different outcomes and say so'
  );
});

test('the three Fabric mutation events are named once, in the module', () => {
  assert.deepEqual(
    [...guard.CANVAS_MUTATION_EVENTS],
    ['object:added', 'object:removed', 'object:modified'],
    'the editor must not keep its own copy of this list'
  );
});

test('AC-5: the guard module stays framework-agnostic so node:test can call it', () => {
  const moduleSource = ast('src/lib/canvas-dirty-guard.ts');
  assert.deepEqual(
    importSpecifiers(moduleSource),
    [],
    'a react/fabric/next import here would put this logic back out of reach of ' +
      'the test runner, which is the whole reason it lives in `src/lib`'
  );
});

// --- AC-1: the flag is in memory, and provably nowhere else -----------------

const IN_MEMORY_ONLY = [
  'src/lib/canvas-dirty-guard.ts',
  'src/components/admin/ArtifactEditor.tsx',
  'src/components/navigation-blocker.tsx',
];

test('AC-1: no part of the guard reaches browser storage (AD-24)', () => {
  for (const rel of IN_MEMORY_ONLY) {
    for (const store of ['localStorage', 'sessionStorage']) {
      assert.equal(
        identifiers(ast(rel), store).length,
        0,
        `${rel} must not persist editor state — AD-24 names this story as the ` +
          'live instance of "unsaved editor state stays in memory"'
      );
    }
  }
});

test('AC-1: the dirty flag adds no network call of its own', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const targets = callsNamed(editor, 'fetch').map((call) =>
    call.arguments[0].getText()
  );

  for (const target of targets) {
    assert.match(
      target,
      /^[`']\/api\/admin\/artifacts/,
      'the editor talks to the registry API and to nothing else'
    );
  }
});

// --- AC-1: the flag is wired to every path that can dirty the canvas --------

test('AC-1: the editor drives its flag through the shared transition table', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const imported = importedNames(editor, '@/lib/canvas-dirty-guard');

  for (const name of [
    'nextDirtyState',
    'mayDiscard',
    'beforeUnloadGuard',
    'CANVAS_MUTATION_EVENTS',
    'UNSAVED_INDICATOR_LABEL',
    'DISCARD_ON_SWITCH_CONFIRMATION',
  ]) {
    assert.ok(
      imported.includes(name),
      `ArtifactEditor must consume \`${name}\` rather than restate the rule`
    );
  }
});

test('AC-1: every clearing event is actually raised somewhere in the editor', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const raised = new Set(
    callsNamed(editor, 'nextDirtyState')
      .map((call) => stringArg(call, 1))
      .filter(Boolean)
  );

  assert.deepEqual(
    [...raised].sort(),
    ['mutated', 'reset', 'saved', 'template-changed'],
    'all four transitions must have a live call site, or the table is decorative'
  );
});

test('AC-1: each clearing event is raised on exactly one success path', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');

  for (const [handler, event] of [
    ['handleSave', 'saved'],
    ['handleReset', 'reset'],
    // Every canvas remount arrives through `loadTemplate` — first load, template
    // switch, and the reload behind a 409 — so the fresh-mount clear lives there
    // and not in the mount effect. A load that *fails* never reaches it, which
    // is correct: the previous canvas stays mounted with its unsaved work.
    ['loadTemplate', 'template-changed'],
  ]) {
    const raised = callsNamed(declarationOf(editor, handler), 'nextDirtyState').map(
      (call) => stringArg(call, 1)
    );
    assert.deepEqual(
      raised,
      [event],
      `${handler} must clear the flag exactly once, on its success path`
    );
  }
});

test('AC-1: the explicit-edit handlers set the flag themselves', () => {
  // Fabric fires `object:added`/`object:removed` for the insert and delete
  // paths, but `obj.set(...)` in `applyTextStyle` and `handleTextContentChange`
  // raises no canvas event at all — relying on the listeners alone would leave
  // a colour, size or wording change silently clean.
  const editor = ast('src/components/admin/ArtifactEditor.tsx');

  for (const handler of [
    'insertElement',
    'insertPlaceholder',
    'handleDeleteSelected',
    'handleDuplicateSelected',
    'applyTextStyle',
    'handleTextContentChange',
  ]) {
    assert.ok(
      identifiers(declarationOf(editor, handler), 'markDirty').length > 0,
      `${handler} mutates the canvas outside a Fabric event and must mark dirty`
    );
  }
});

// --- AC-1: the registration-order hazard, which is the expensive one --------

test('AC-1: mutation listeners attach after the seed paint loop, never during it', () => {
  // `mountCanvas` paints the template by calling `canvas.add()` in a loop, and
  // `canvas.add()` fires `object:added`. A listener wired above that loop would
  // register the template's own shipped elements as an edit, and the guard would
  // then fire — beforeunload, the switch confirm, the Link confirm — on a canvas
  // the operator never touched. Position is the whole defence.
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const paintLoop = nodes(
    editor,
    (node) => ts.isForOfStatement(node) && node.expression.getText() === 'painted'
  );
  assert.equal(paintLoop.length, 1, 'expected the single seed paint loop');

  const registrations = callsNamed(editor, 'canvas.on').filter((call) => {
    const first = call.arguments[0];
    return first && !ts.isStringLiteral(first);
  });
  assert.ok(
    registrations.length > 0,
    'the mutation listeners are registered from CANVAS_MUTATION_EVENTS, so the ' +
      'event argument is an identifier rather than a literal'
  );
  for (const call of registrations) {
    assert.ok(
      call.getStart() > paintLoop[0].end,
      'a mutation listener registered before the paint loop marks a freshly ' +
        'mounted template dirty'
    );
  }
});

test('AC-1: every mutation listener is torn down with the selection listeners', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const off = callsNamed(editor, 'canvas.off');

  assert.ok(
    off.some((call) => {
      const first = call.arguments[0];
      return first && !ts.isStringLiteral(first);
    }),
    'the mutation listeners must be removed the same way they were added, in ' +
      'the existing teardown closure — a second ad hoc cleanup path is how the ' +
      'two drift and one stops running'
  );
});

// --- AC-2: the browser-level exit ------------------------------------------

test('AC-2: beforeunload is registered and unregistered in one effect', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');

  const effects = callsNamed(editor, 'useEffect').filter((call) =>
    callsNamed(call, 'window.addEventListener').some(
      (add) => stringArg(add, 0) === 'beforeunload'
    )
  );
  assert.equal(effects.length, 1, 'exactly one effect owns the browser-exit guard');

  const cleanups = nodes(effects[0], ts.isReturnStatement).filter((ret) =>
    callsNamed(ret, 'window.removeEventListener').some(
      (remove) => stringArg(remove, 0) === 'beforeunload'
    )
  );
  assert.ok(
    cleanups.length > 0,
    'the listener must be removed from the effect cleanup, or it outlives the ' +
      'editor and blocks a clean exit from every later page'
  );
});

test('AC-2: the guard is registered only while an editable canvas is dirty', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const effect = callsNamed(editor, 'useEffect').find((call) =>
    callsNamed(call, 'window.addEventListener').some(
      (add) => stringArg(add, 0) === 'beforeunload'
    )
  );

  const body = effect.arguments[0].getText();
  assert.match(
    body,
    /if\s*\(!isDirty\s*\|\|\s*!isEditable\)\s*return;/,
    'a read-only template, or an untouched editable one, must arm nothing'
  );

  const deps = effect.arguments[1].getText();
  assert.match(deps, /isDirty/, 'the effect re-runs when the flag flips');
  assert.match(deps, /isEditable/);
});

// --- AC-1: nothing can dirty the canvas while a request is in flight --------

test('AC-1: the canvas stops accepting input while busy (code review 2026-08-04)', () => {
  // `handleSave` serializes the canvas once and then awaits. A drag landing in
  // that gap sets the flag but is not in the payload, and the success path
  // remounts from the server copy and discards it — after which clearing the
  // flag reports clean over work that is gone. The toolbar buttons already
  // disable on `busy`; the canvas has to do the same or the guard lies in the
  // one window it most needs to be honest.
  const editor = ast('src/components/admin/ArtifactEditor.tsx');

  const effect = callsNamed(editor, 'useEffect').find(
    (call) =>
      call.arguments[1] &&
      call.arguments[1].getText().replace(/\s/g, '') === '[busy]'
  );
  assert.ok(effect, 'expected an effect keyed on `busy` alone');

  // Assignments read off the AST, not matched in the effect's source text.
  // The first form of this guard used `assert.match` over `getText()`, which
  // made these the only three assertions in the file a comment could satisfy —
  // `// canvas.selection = !busy` would have passed all of them. That is the
  // exact defect this file's header claims is unreachable here, so it is read
  // as `a = b` nodes instead. Raised by the PR's automated reviewer.
  const assignments = nodes(
    effect,
    (node) =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ).map((node) => `${node.left.getText()} = ${node.right.getText()}`);

  for (const [target, why] of [
    ['canvas.selection', 'a marquee drag would still start a transform'],
    ['object.selectable', 'an object could still be picked up'],
    ['object.evented', 'an object could still receive the drag'],
  ]) {
    assert.ok(
      assignments.includes(`${target} = !busy`),
      `\`${target}\` must follow \`busy\` — otherwise ${why}`
    );
  }
  assert.ok(
    callsNamed(effect, 'canvas.discardActiveObject').length > 0,
    'the live selection must go too: it is what keeps `applyTextStyle` and the ' +
      'text field able to mutate the canvas from outside the pointer'
  );
});

// --- AC-3: the in-editor template switch ------------------------------------

test('AC-3: switching template while dirty asks before it discards', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const setters = callsNamed(editor, 'setSelectedId');
  assert.ok(
    setters.length >= 5,
    'guarded list switch on click plus its keyboard mirror, create select, ' +
      'plus successful and remote-delete selection clears'
  );

  const switchSetters = setters.filter((setter) => setter.arguments[0]?.getText() === 'item.id');
  const createSetter = setters.find((setter) => setter.arguments[0]?.getText() === 'data.id');
  const deleteClearers = setters.filter((setter) => setter.arguments[0]?.getText() === 'null');
  assert.equal(
    switchSetters.length,
    2,
    'the sidebar row selects the clicked template, on pointer and on keyboard'
  );
  assert.ok(createSetter, 'create selects the new template');
  assert.equal(deleteClearers.length, 2, 'both deletion outcomes clear a gone selection');

  // The nearest arrow function around each setter is its row handler; the
  // confirmation has to live in the same handler or it can be bypassed. The
  // keyboard mirror must carry the same guard as the click or a11y input
  // would be the hole in the guard.
  for (const [label, switchSetter] of switchSetters.entries()) {
    let handler = switchSetter.parent;
    while (handler && !ts.isArrowFunction(handler)) handler = handler.parent;
    assert.ok(handler, `the ${label} setter is expected inside a row handler`);

    assert.ok(
      identifiers(handler, 'mayDiscard').length > 0,
      're-entering mountCanvas resets the added-element map and disposes the canvas — ' +
        'every unsaved edit goes with it'
    );
    assert.ok(
      identifiers(handler, 'DISCARD_ON_SWITCH_CONFIRMATION').length > 0,
      'it must use the switch wording, not the leave-the-page wording'
    );
    assert.match(
      handler.getText(),
      /item\.id === selectedId/,
      'AC-3 guards the actual switch: re-activating the active row must not prompt'
    );
  }

  let createHandler = createSetter.parent;
  while (createHandler && !ts.isArrowFunction(createHandler)) {
    createHandler = createHandler.parent;
  }
  assert.ok(createHandler, 'create selects after the POST succeeds');
  assert.ok(
    identifiers(createHandler, 'mayDiscard').length > 0,
    'adding a template mounts a new canvas and must confirm before discarding unsaved work'
  );
  assert.ok(
    identifiers(createHandler, 'DISCARD_ON_SWITCH_CONFIRMATION').length > 0,
    'create uses the same switch wording as a list row click'
  );

  const deleteHandlers = deleteClearers.map((clearer) => {
    let handler = clearer.parent;
    while (handler && !ts.isArrowFunction(handler)) handler = handler.parent;
    return handler;
  });
  assert.ok(
    deleteHandlers.some(
      (deleteHandler) =>
        deleteHandler &&
        identifiers(deleteHandler, 'window').length > 0 &&
        identifiers(deleteHandler, 'isDirty').length > 0
    ),
    'deleting an open dirty canvas must explicitly confirm that its work is discarded'
  );
  assert.ok(
    deleteHandlers.some(
      (deleteHandler) => deleteHandler && /if \(!summary\)/.test(deleteHandler.getText())
    ),
    'a 404 reconciliation must clear a selected template that no longer exists'
  );
});

// --- AC-1: the state is seen, not only enforced -----------------------------

test('AC-1: the indicator renders only for a dirty, editable canvas', () => {
  const editor = ast('src/components/admin/ArtifactEditor.tsx');
  const rendered = nodes(
    editor,
    (node) =>
      ts.isConditionalExpression(node) &&
      identifiers(node.whenTrue, 'UNSAVED_INDICATOR_LABEL').length > 0
  );
  assert.equal(rendered.length, 1, 'the indicator is rendered from one branch');

  const condition = rendered[0].condition.getText();
  assert.match(condition, /isDirty/, 'AC-1: visible when there is unsaved work');
  assert.match(
    condition,
    /isEditable/,
    'a read-only template can never be dirty, and must never claim to be'
  );
  assert.ok(
    nodes(rendered[0].whenTrue, (node) => ts.isJsxElement(node)).length > 0,
    'the label has to reach the surface as an element, not sit in a variable'
  );
});

// --- AC-4: leaving the route, scoped to this page ---------------------------

test('AC-4: the blocker is a React context with a working default', () => {
  const blocker = ast('src/components/navigation-blocker.tsx');

  const created = callsNamed(blocker, 'createContext');
  assert.equal(created.length, 1, 'one context, created once');
  const fallback = created[0].arguments[0].getText();
  assert.match(
    fallback,
    /isBlocked:\s*false/,
    'Header renders on every gated page and most have no provider — an ' +
      '`undefined` default with a throwing hook would break all of them'
  );
  assert.match(fallback, /setIsBlocked:\s*\(\)\s*=>\s*\{\s*\}/, 'a no-op, not a throw');

  for (const name of [
    'NavigationBlockerProvider',
    'useNavigationBlocker',
    'CustomLink',
  ]) {
    assert.ok(
      identifiers(blocker, name).length > 0,
      `the module must export \`${name}\``
    );
  }
});

test('AC-4: CustomLink blocks through the framework hook, and cannot be overridden', () => {
  const blocker = ast('src/components/navigation-blocker.tsx');
  const link = jsxTags(declarationOf(blocker, 'CustomLink'), 'Link');
  assert.equal(link.length, 1, 'CustomLink wraps exactly one Link');

  const props = link[0].attributes.properties;
  const names = props.map((prop) =>
    ts.isJsxAttribute(prop) ? prop.name.getText() : '{...spread}'
  );
  assert.ok(names.includes('onNavigate'), 'Link ships onNavigate for exactly this');

  // The documented snippet writes `onNavigate` before the spread, which lets a
  // caller pass their own and silently switch the guard off. The spread goes
  // first here, and `onNavigate` is removed from the public props type so the
  // attempt is a compile error rather than a quiet hole.
  assert.ok(
    names.indexOf('{...spread}') < names.indexOf('onNavigate'),
    'the guard must be declared after the spread so no prop can replace it'
  );
  assert.match(
    declarationOf(blocker, 'CustomLinkProps').getText(),
    /Omit<[\s\S]+,\s*'onNavigate'>/,
    'passing onNavigate must not typecheck'
  );

  const handler = props.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText() === 'onNavigate'
  );
  assert.ok(identifiers(handler, 'mayDiscard').length > 0, 'same rule as the other exits');
  assert.ok(
    callsNamed(handler, 'event.preventDefault').length > 0,
    'declining must cancel the navigation'
  );
});

test('AC-4: every Header link routes through the guard', () => {
  const header = ast('src/components/Header.tsx');

  assert.equal(
    jsxTags(header, 'Link').length,
    0,
    'a bare Link is an unguarded way off the editor'
  );
  assert.equal(
    jsxTags(header, 'CustomLink').length,
    5,
    'logo, Dashboard, Workspace, Artifacts, Settings'
  );
  assert.ok(
    !importSpecifiers(header).includes('@/components/Link'),
    'Header reaches Link only through CustomLink now'
  );
  assert.ok(
    importedNames(header, './navigation-blocker').includes('CustomLink'),
    'the wrapper is shared chrome, beside the other Header parts'
  );
});

test('AC-4: the provider mounts at the operator layout, never on the root', () => {
  // Header (the reader) and ArtifactEditor (the writer, via the page that
  // renders into <Outlet/>) share one NavigationBlockerProvider instance. The
  // provider sits at the narrowest layout covering both — the operator shell
  // — and not on App.tsx. The page that mounts ArtifactEditor is no longer
  // required to render its own copy: the provider is one level up, and the
  // Outlet renders the writer inside it.
  const shell = ast('spa/src/pages/OperatorShell.tsx');
  const provider = nodes(
    shell,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText() === 'NavigationBlockerProvider'
  );
  assert.equal(provider.length, 1, 'one provider, on the operator shell');

  const header = jsxTags(shell, 'Header');
  assert.equal(header.length, 1, 'expected one <Header />');
  assert.ok(
    header[0].getStart() > provider[0].getStart() && header[0].end < provider[0].end,
    '<Header /> must render inside the provider — the reader has to share ' +
      'the writer\'s context instance'
  );

  const outlet = jsxTags(shell, 'Outlet');
  assert.equal(outlet.length, 1, 'expected one <Outlet />');
  assert.ok(
    outlet[0].getStart() > provider[0].getStart() && outlet[0].end < provider[0].end,
    '<Outlet /> must render inside the provider — the writer renders ' +
      'through it, into the same context'
  );

  const page = ast('spa/src/pages/AdminArtifactsPage.tsx');
  assert.equal(
    identifiers(page, 'NavigationBlockerProvider').length,
    0,
    'the page does not own its own provider; it inherits from the shell'
  );

  const app = ast('spa/src/App.tsx');
  assert.equal(
    identifiers(app, 'NavigationBlockerProvider').length,
    0,
    'AD-24: a provider mounts at the narrowest layout covering its consumers, ' +
      'and both of this one\'s consumers live under OperatorShell'
  );
});

test('AC-4: logout is left alone, deliberately', () => {
  // `LogoutButton` navigates with `router.replace()` inside a click handler, so
  // `onNavigate` never runs for it. Guarding it needs a second mechanism and
  // belongs to deferred-work.md (logout from a dirty canvas), which owns mid-edit interruption.
  const logout = ast('src/components/LogoutButton.tsx');
  assert.equal(identifiers(logout, 'useNavigationBlocker').length, 0);
  assert.equal(identifiers(logout, 'mayDiscard').length, 0);
});

// --- AC-5: the file that holds all of this actually runs --------------------

test('AC-5: this suite is registered in package.json', () => {
  // An unregistered test file never runs — not locally, not in CI — and nothing
  // else in the repository detects the omission. `project-context.md` calls it
  // the single highest-cost mistake available here, so the file checks itself.
  const pkg = JSON.parse(readRaw('package.json'));
  assert.match(pkg.scripts.test, /\btests\/canvas-dirty-guard\.test\.mjs\b/);
});
