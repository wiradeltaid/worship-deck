/**
 * The operator may choose a theme; the congregation may never see the choice.
 *
 * Story 17.1 makes the shipped `.dark` palette selectable. Its load-bearing
 * constraint is not the switch — it is that nothing an operator picks can reach
 * the projected output. That is true today by construction: the projected tree
 * paints in literal colours (`bg-black`, `bg-[#0B1220]`) or in inline styles
 * resolved out of the Artifact Registry, and never in a theme token. Nothing
 * enforced it, so a single `bg-card` added to `SlideView` during unrelated work
 * would restyle the deck the congregation sees, with a theme toggle as the
 * trigger and no test to catch it.
 *
 * **Scope, after code review round 2.** AC-4 is guaranteed on two axes and this
 * file is the net for both: *what* — the projected tree paints in literals or
 * registry-resolved inline styles; and *where* — the projected output, not the
 * operator's own preview of it (`SlidePreviewList` is hub chrome and follows the
 * theme deliberately). Story 17.7 extended this same net to the *shell behind*
 * a projected route — SPA fallbacks and `spa/projected.html` first paint.
 * `FULL_SCREEN` still covers the client hook defence; structural discovery from
 * `src/projected` covers the room-facing React clients.
 *
 * The projected surface is two routes, and each is a route shell plus a client
 * tree. Both halves are guarded, because the shell is reached at the same URL
 * whenever `buildSlidePlan` throws:
 *
 *   spa/src/pages/SlideshowPage.tsx -> SlideshowClient -> SlideView -> ArtifactSlide
 *   spa/src/pages/ProjectorPage.tsx -> ProjectorClient -> SlideView -> ArtifactSlide
 *
 * The closure test starts at every route special file in the projected group,
 * walks *out of* them transitively, and requires every module it reaches to be
 * guarded or token-free — no directory is exempt by name. The route group is
 * the structural upward boundary, so a new shell joins without a leaf list.
 *
 * **Every scan strips comments first**, with a scanner rather than a regex.
 * Four assertions here were satisfiable by a word in a comment before
 * 2026-07-31 — one of them by the very comment that explained the code it was
 * meant to guard. Prose about a token is not a token, and a test that a doc
 * comment can keep green is not a test.
 *
 * **Not everything here is a regex.** The shell claim and the theme cycle are
 * exercised as behaviour, against a document stub and by calling the function.
 * The restore path in particular is where a bug leaves the operator's whole app
 * shell pinned at literal black after they leave a projected route, and no
 * amount of source matching reaches it.
 *
 * The token list is parsed out of `globals.css` rather than hardcoded, so a
 * token added to the palette is covered here without anyone remembering to
 * come back. AC-4 of the story is the requirement; this is its regression net.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  discoverAppPages,
  discoverLocalModuleImports,
  discoverModuleGraph,
  discoverProjectedRoutes,
  PROJECTED_ROUTE_GROUP,
  projectedUrlForPage,
} from './helpers/projected-routes.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRaw = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const srcUrl = (...parts) => pathToFileURL(path.join(repoRoot, ...parts)).href;

/**
 * The two `.ts` subjects exercised as behaviour, imported **here** rather than
 * above the sections that use them.
 *
 * A dynamic import is a top-level `await`, and a top-level `await` suspends
 * module evaluation. Both of these used to sit mid-file, below the ~330 tests
 * already registered above them. While the module is suspended the runner starts
 * the tests it has, so every `const` declared *below* the await is still in its
 * temporal dead zone when those tests run. `jsxReturnBranches` is a hoisted
 * function declaration and stayed callable; `branchSurfaceRoot`, the arrow it
 * called, did not — so both AC-4 full-screen guards died with *"Cannot access
 * 'branchSurfaceRoot' before initialization"*.
 *
 * It is a race, not a version rule: it is lost whenever the import takes long
 * enough for the runner to get going first. CI (Node 22, resolving `.ts` through
 * the strip-types loader) lost it every time; Node 24 locally resolved the same
 * import fast enough to win, so the file was green on developer machines and red
 * on CI alone. Substituting a 50ms timer for the import reproduces the identical
 * ReferenceError on Node 24 too.
 *
 * The defect is not the scheduling; it is a test running against a half-evaluated
 * module at all. Hoisting both imports above the first `test()` — which is what
 * every other file in `tests/` already does — makes that unreachable rather than
 * merely fixed, and no future helper added below can reintroduce it.
 */
const { claimProjectedShell, resetProjectedShellForTest } = await import(
  srcUrl('src', 'lib', 'projected-shell.ts')
);
const { THEME_ORDER, nextTheme, asThemeChoice } = await import(
  srcUrl('src', 'lib', 'theme-cycle.ts')
);
const projectedRoutes = discoverProjectedRoutes(repoRoot);

// --- source hygiene ---------------------------------------------------------

/** Past the string literal opening at `at`, escapes honoured. */
function pastString(source, at) {
  const quote = source[at];
  let i = at + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  return i;
}

/**
 * Identifiers that end a *value*, after which `/` divides and `<` compares. Any
 * other identifier in the same position is a keyword, after which both are
 * delimiters — so the question is which of the two sets the word belongs to.
 */
const OPERAND_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case',
  'do', 'else', 'yield', 'await', 'throw',
]);

/**
 * Whether an expression may begin at `at` — the one lexical question behind
 * both a regex literal and a JSX element, since `/` and `<` are each an
 * operator after a value and a delimiter before one.
 *
 * Encoded once and shared, because both guards below had the same defect in
 * different clothes: `stripComments` read `/\//` as a line comment, and the
 * JSX-root walk would read `a < b` as an element. One rule answers both.
 */
function expressionPosition(source, at) {
  let i = at - 1;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  if (i < 0) return true;
  // A `<` immediately before is a tag delimiter, never an operator: `</` closes
  // an element and `<<` shifts. Neither begins an expression — and reading
  // `</div>`'s slash as a regex opener is what let a comment on the same line as
  // a closing tag survive `stripComments` verbatim, which is the one thing that
  // function exists to prevent.
  if (source[i] === '<') return false;
  // `)` and `]` close a value; `(`, `[`, `{`, `,`, `?`, `:`, `=`, `>` and every
  // other operator do not. A quote closes a string, which is a value.
  if (!/[\w$)\]"'`]/.test(source[i])) return true;
  if (!/[\w$]/.test(source[i])) return false;
  let start = i;
  while (start >= 0 && /[\w$]/.test(source[start])) start -= 1;
  return OPERAND_KEYWORDS.has(source.slice(start + 1, i + 1));
}

/**
 * Comments removed, strings and regex literals kept, so no assertion below can
 * be satisfied by prose and none can be broken by prose either.
 *
 * This is a scanner and not a pair of regexes, because both regexes were wrong
 * in opposite directions. `/\/\*[\s\S]*?\*\//g` deletes real code whenever a
 * `*&#47;` appears inside a string literal, and dropping only lines that *begin*
 * with `//` re-admitted the exact false positive the mechanism exists to remove:
 * a trailing `// use bg-card here instead` counted as a token reference. Walking
 * the source solves both at once — a `//` inside `xmlns="http://…"` is inside a
 * string, so it is passed through untouched, which is what the line-start rule
 * was a workaround for.
 *
 * **Regex literals are a third quoting form and are now scanned as one.** The
 * character scanner treated `'`, `"` and `` ` `` as string openers
 * unconditionally, which broke in both directions on real files in `src/`:
 *
 *   - a quote inside a regex opened a phantom string. `src/lib/parser.ts:130`
 *     (`/\s+"[^"]*"\s*$/`) swallowed 454 characters and 8,619 more, and
 *     `src/lib/lyrics.ts` did it at eight sites — after which comments in those
 *     files were not stripped at all. Both are `.ts` modules this file feeds
 *     through `themeReferences()` whenever a projected file imports them.
 *   - `value.split(/\//)` was outside a string at the backslash, so the `//`
 *     read as a line comment and **the rest of that line was deleted from the
 *     scan** — a live theme token on it would have passed the AC-4 guard by not
 *     being there. That is the dangerous direction, and it is the reason this is
 *     fixed rather than documented as a limit.
 *
 * Comment openers are still tested *first* in JS position: neither `/*` nor `//`
 * can begin a regex (`*` has nothing to repeat, and `//` is the empty regex,
 * spelled `/(?:)/`), so ordering them first is exact rather than a compromise —
 * and it keeps `foo(/*inline*&#47; x)`, where an expression may begin, a comment.
 *
 * **JSX children are a fourth quoting form and are now scanned as one.** That
 * ordering argument covers regex literals and says nothing about element text,
 * where the scanner fired the comment branch unconditionally:
 *
 *   - `<p>Docs: https://example.test/reset <span className="bg-card …">` — the
 *     `//` in the URL read as a line comment and **the rest of the line was
 *     deleted from the scan**, hiding a live `bg-card`, a `dark:` variant and a
 *     `border-2` from four AC-4 guards at once. One URL in room-facing copy.
 *   - `<p>ratio 3 /* 4</p>` is worse: `indexOf('*&#47;')` misses and the
 *     **remainder of the file** is discarded.
 *
 * `walkJsx` already models this (`inChildren`), and `stripComments` feeds
 * `walkJsx` — so the guard that knew the rule ran downstream of the one that did
 * not. Attribute position is deliberately *not* children: a comment inside
 * `className={cn('a', /* … *&#47; 'b')}` is a comment, and removing it is the
 * whole point, so an opening tag's interior is scanned rather than skipped whole.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  // Elements whose children are open, and the bracket depth each opening tag was
  // entered at. `tagStack` is a stack rather than a flag because an element can
  // appear inside another's props (`<Foo bar={<Child/>}>`), and a flag let the
  // inner tag's `>` close the outer one — after which children were never seen.
  const open = [];
  const tagStack = [];
  let nesting = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1] ?? '';
    const inAttributes =
      tagStack.length > 0 && nesting === tagStack[tagStack.length - 1];
    const inChildren =
      !inAttributes &&
      open.length > 0 &&
      nesting === open[open.length - 1].nesting;

    // Between `<Name` and its `>`: attribute values are strings, `{` opens a
    // container and the JS rules resume inside it.
    if (inAttributes) {
      if (c === '>') {
        // `<div />` self-closes; `<div>` opens children.
        if (!/\/\s*$/.test(out)) open.push({ nesting });
        tagStack.pop();
        out += c;
        i += 1;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        const end = pastString(source, i);
        out += source.slice(i, end);
        i = end;
        continue;
      }
      if (c === '{') nesting += 1;
      out += c;
      i += 1;
      continue;
    }

    // JSX structure, reachable from element children and from plain JS alike.
    if (c === '<' && next === '/') {
      const end = source.indexOf('>', i);
      const to = end === -1 ? source.length : end + 1;
      open.pop();
      out += source.slice(i, to);
      i = to;
      continue;
    }
    if (c === '<' && next === '>') {
      open.push({ nesting });
      out += '<>';
      i += 2;
      continue;
    }
    if (
      c === '<' &&
      /[A-Za-z]/.test(next) &&
      (inChildren || expressionPosition(out, out.length))
    ) {
      tagStack.push(nesting);
      out += c;
      i += 1;
      continue;
    }

    // Element text: an apostrophe is an apostrophe, and the `//` in a URL is
    // part of the copy the operator reads.
    if (inChildren) {
      if (c === '{') nesting += 1;
      out += c;
      i += 1;
      continue;
    }

    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }
    if (c === '/' && expressionPosition(out, out.length)) {
      const start = i;
      i += 1;
      let inClass = false;
      while (i < source.length) {
        const r = source[i];
        if (r === '\\') {
          i += 2;
          continue;
        }
        if (r === '\n') break;
        if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '/' && !inClass) {
          i += 1;
          break;
        }
        i += 1;
      }
      out += source.slice(start, i);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const end = pastString(source, i);
      out += source.slice(i, end);
      i = end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') nesting += 1;
    else if (c === ')' || c === ']' || c === '}') nesting -= 1;
    out += c;
    i += 1;
  }
  return out;
}

const read = (rel) => stripComments(readRaw(rel));

/** Parse a source fixture with the same TS/TSX grammar the application uses. */
function parseSource(source, file = 'fixture.tsx') {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

/**
 * The `{ … }` block opening at or after `from`, brace-balanced and string-aware.
 *
 * Two guards used to be anchored to source layout instead: the badge table was
 * sliced between `indexOf('const TONE_CLASS')` and `indexOf('const
 * BADGE_CLASS')`, so hoisting one above the other yielded an empty slice and
 * three opaque failures; the mount guard matched a literal two-space closing
 * brace, so re-indenting the file broke the test rather than the code.
 */
function balancedBlock(source, from) {
  const open = source.indexOf('{', from);
  assert.ok(open !== -1, 'expected a block to open');
  let depth = 0;
  let i = open;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === c) break;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
    i += 1;
  }
  assert.fail('unbalanced block');
}

/** Every file under `src/` with one of `extensions`, for checks that must not trust a file list. */
function allSourceFiles(extensions, dir = 'src') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...allSourceFiles(extensions, rel));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(rel);
  }
  return out;
}

const allTsxFiles = () => allSourceFiles(['.tsx']);
const allTsFiles = () => allSourceFiles(['.ts']);

// --- JSX, walked rather than pattern-matched ---------------------------------

/**
 * The whole opening tag beginning at `at`, brace- and string-aware.
 *
 * `/<Link\b[\s\S]*?>/g` was the previous form and it stopped at the first `>`,
 * so an `onClick={() => …}` prop truncated the slice before its `className` and
 * a correctly written link failed the focus-ring guard. A `>` inside a prop
 * expression is at brace depth, not tag depth, which is the distinction the
 * lazy regex could not make.
 */
function openingTag(source, at) {
  let i = at + 1;
  let depth = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      i = pastString(source, i);
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return source.slice(at, i + 1);
    i += 1;
  }
  return source.slice(at);
}

/**
 * Walk `source` as JSX from `at`, reporting each element's opening tag with the
 * depth it sits at and the stack above it, and stopping where `stop` says the
 * statement ends.
 *
 * One walk, because four guards need the same three facts and each had invented
 * its own narrower answer: which elements are at the top of a return, which tag
 * encloses a given child, and where a `return` statement ends.
 *
 * Two known limits, both loud rather than silent. A `<` inside a string in a
 * JSX expression container (`{'<div>'}`) reads as an element, and a `<`
 * comparison inside a container is excluded by `expressionPosition` but a
 * `foo<Bar>` type argument there is not. Either produces a spurious element and
 * therefore a failing assertion, never a skipped one.
 */
function walkJsx(source, at, stop) {
  const tags = [];
  const open = [];
  let nesting = 0;
  let i = at;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1] ?? '';
    // Inside element children a quote is an apostrophe and every `<` opens a
    // tag; inside a container or in plain JS the lexical rules apply again.
    const inChildren = open.length > 0 && nesting === open[open.length - 1].nesting;
    if (stop && stop(c, nesting, open.length)) break;
    if (!inChildren && (c === '"' || c === "'" || c === '`')) {
      i = pastString(source, i);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      nesting += 1;
      i += 1;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      nesting -= 1;
      i += 1;
      continue;
    }
    if (c === '<' && next === '/') {
      const end = source.indexOf('>', i);
      open.pop();
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (c === '<' && next === '>') {
      tags.push({ tag: '<>', depth: open.length, stack: [...open], index: i });
      open.push({ tag: '<>', nesting });
      i += 2;
      continue;
    }
    if (c === '<' && /[A-Za-z]/.test(next) && (inChildren || expressionPosition(source, i))) {
      const tag = openingTag(source, i);
      tags.push({ tag, depth: open.length, stack: [...open], index: i });
      if (!tag.endsWith('/>')) open.push({ tag, nesting });
      i += tag.length;
      continue;
    }
    i += 1;
  }
  return tags;
}

/**
 * Every JSX element in `file`, so a guard can ask about all of them instead of
 * about the ones a particular regex happened to spell.
 */
function jsxTags(source) {
  return walkJsx(source, 0, null);
}

/** The opening tag of the innermost element enclosing the first `needle`. */
function enclosingTag(source, needle) {
  const at = source.indexOf(needle);
  assert.notEqual(at, -1, `expected to find ${needle}`);
  const inside = jsxTags(source).filter((t) => t.index === at);
  assert.equal(inside.length, 1, `expected exactly one ${needle}`);
  const [{ stack }] = inside;
  assert.ok(stack.length > 0, `${needle} is not inside any element`);
  return stack[stack.length - 1].tag;
}

// --- the palette, read from its source of truth, parsed once ----------------

const GLOBALS_CSS = 'src/globals.css';

/**
 * Every `--color-*` name exposed by the `@theme inline` block, longest first so
 * `card-foreground` is reported rather than `card`.
 *
 * Parsed at module scope. `themeReferences()` used to call this on every
 * invocation, so one run read the same immutable file about nine times and
 * rebuilt three regexes and a 30-token alternation each time.
 */
const THEME_TOKENS = (() => {
  const names = [
    ...readRaw(GLOBALS_CSS).matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm),
  ].map((m) => m[1]);
  assert.ok(
    names.length > 20,
    `expected the @theme inline block to expose the palette; found ${names.length} --color-* names`
  );
  return names.sort((a, b) => b.length - a.length);
})();

const TOKEN_ALTERNATION = THEME_TOKENS.join('|');

/**
 * Utility prefixes that can carry a colour token. The directional and offset
 * forms are listed explicitly: `border-t-border`, `border-x-border` and
 * `ring-offset-background` are all themed colours, and a pattern of
 * `border-(?:token)` alone lets every one of them through. `inset-shadow` and
 * `text-shadow` are Tailwind 4 colour utilities in their own right and were
 * caught only incidentally, by the bare `shadow`. Longest first so the
 * alternation cannot settle for `border` when `border-t` is what is there.
 */
const UTILITY_PREFIXES = [
  'border-t', 'border-r', 'border-b', 'border-l', 'border-x', 'border-y',
  'border-s', 'border-e', 'ring-offset', 'inset-ring', 'inset-shadow',
  'text-shadow', 'divide-x', 'divide-y',
  'bg', 'text', 'border', 'ring', 'outline', 'divide', 'fill', 'stroke',
  'from', 'via', 'to', 'placeholder', 'caret', 'accent', 'decoration', 'shadow',
].sort((a, b) => b.length - a.length);

const PREFIX_ALTERNATION = UTILITY_PREFIXES.join('|');

/** `bg-card`, `text-muted-foreground`. */
const TOKEN_UTILITY = new RegExp(
  `(?<![-\\w])(?:${PREFIX_ALTERNATION})-(?:${TOKEN_ALTERNATION})\\b`,
  'g'
);

/**
 * Tailwind 4's colour-variable shorthand: `bg-(--card)`, `bg-(--card)/50`,
 * `text-(--foreground)`, `border-(--border)`, `shadow-(--ring)`.
 *
 * No colour token is spelled this way in `src/` today, so this is latent rather
 * than a live leak — but the `-(--var)` form is already idiomatic here for
 * non-colour variables (`ui/card.tsx` uses `--card-spacing`, `ui/popover.tsx`
 * `--transform-origin`), which makes it the plausible next spelling rather than
 * a hypothetical. Same class of hole this guard already had for `border-t-border`
 * and `ring-1`.
 */
const TOKEN_SHORTHAND = new RegExp(
  `(?<![-\\w])(?:${PREFIX_ALTERNATION})-\\(\\s*--(?:color-)?(?:${TOKEN_ALTERNATION})\\s*\\)`,
  'g'
);

/** A raw `var(--token)` in an inline style. */
const TOKEN_CSS_VAR = new RegExp(
  `var\\(\\s*--(?:color-)?(?:${TOKEN_ALTERNATION})\\s*[),]`,
  'g'
);

/**
 * The `dark:` variant, which resolves against whichever `.dark` ancestor
 * exists. The character class carries `-` because negative-value variants
 * (`dark:-mt-1`) are `dark:` rules too, and the doc above advertises `dark:` as
 * one of exactly three routes in.
 */
const DARK_VARIANT = /(?<![\/\w-])dark:(?=[^\s"'`]+)/g;

function darkVariantReferences(source) {
  return classValues(source).flatMap(({ value }) =>
    [...value.matchAll(DARK_VARIANT)].map((match) => match[0])
  );
}

function themeReferences(source) {
  return [
    ...source.matchAll(TOKEN_UTILITY),
    ...source.matchAll(TOKEN_SHORTHAND),
    ...source.matchAll(TOKEN_CSS_VAR),
  ].map((m) => m[0]).concat(darkVariantReferences(source));
}

// --- AC-4: the projected output cannot see the operator's theme -------------

const PROJECTED = projectedRoutes.specialFiles;
  // The route shells. Reached at the same projected URL whenever
  // `buildSlidePlan` throws, which a registry failure is enough to cause — so a
  // token-painted error card here lands on the room-facing screen and follows
  // the operator's theme while it is there.

test('Story 17.7: the projected route group owns both unchanged public URLs', () => {
  assert.deepEqual(projectedRoutes.urls, [
    '/services/:id/present/projector',
    '/services/:id/slideshow',
  ]);
  assert.equal(projectedRoutes.layouts.length, 1, 'one projected document owns both URLs');
  assert.equal(projectedRoutes.layouts[0], 'spa/projected.html');
  assert.equal(
    fs.existsSync(path.join(repoRoot, 'src/app/layout.tsx')),
    false,
    'the retired App Router root layout must not return'
  );
  const allPages = discoverAppPages(repoRoot);
  for (const url of projectedRoutes.urls) {
    const owners = allPages.filter((file) => {
      try {
        return projectedUrlForPage(file) === url;
      } catch {
        return false;
      }
    });
    assert.deepEqual(
      owners,
      projectedRoutes.pages.filter((file) => projectedUrlForPage(file) === url),
      `${url} must be owned only by its SPA projected page`
    );
  }
});

test('Story 17.7: every projected framework fallback is discovered structurally', () => {
  for (const name of ['ProjectedNotFound.tsx', 'ProjectedError.tsx']) {
    assert.ok(
      projectedRoutes.specialFiles.includes(`spa/src/projected/${name}`),
      `${name} must live inside the projected SPA fallbacks`
    );
  }
});

test('Story 17.7: projected page normalization removes route groups and nothing else', () => {
  assert.equal(
    projectedUrlForPage('spa/src/pages/ProjectorPage.tsx'),
    '/services/:id/present/projector'
  );
});

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) current = current.expression;
  return current;
}

function isFunctionNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function defaultReturnedRoot(source, file) {
  const { component, sourceFile } = defaultExportedFunction(source, file);
  if (!ts.isBlock(component.body)) return { root: unwrapExpression(component.body), sourceFile };
  const returned = [];
  function visit(node) {
    if (node !== component.body && isFunctionNode(node)) return;
    if (ts.isReturnStatement(node) && node.expression) {
      returned.push(unwrapExpression(node.expression));
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(component.body);
  assert.equal(returned.length, 1, `${file} must return exactly one top-level JSX root`);
  return { root: returned[0], sourceFile };
}

function jsxElementName(node) {
  const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
  return tag?.getText();
}

function findRenderedElement(root, name, file) {
  const found = [];
  function visit(node) {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && jsxElementName(node) === name) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
  assert.equal(found.length, 1, `${file} must render exactly one <${name}> in its returned tree`);
  return found[0];
}

function styleIdentifierFor(element, file) {
  const attributes = ts.isJsxElement(element)
    ? element.openingElement.attributes.properties
    : element.attributes.properties;
  const style = attributes.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === 'style'
  );
  assert.ok(style?.initializer && ts.isJsxExpression(style.initializer), `${file}'s rendered element needs a style expression`);
  assert.ok(ts.isIdentifier(style.initializer.expression), `${file}'s rendered style must name a literal object`);
  return style.initializer.expression.text;
}

function literalStyleObject(sourceFile, styleName, file) {
  let styleObject;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === styleName &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) styleObject = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(styleObject, `${file}'s ${styleName} must be a literal object`);
  assert.equal(
    styleObject.properties.some((property) => ts.isSpreadAssignment(property)),
    false,
    `${file}'s ${styleName} must not spread values that override literal shell claims`
  );
  return styleObject;
}

function styleLiteral(styleObject, property, expected, message) {
  const claims = styleObject.properties.filter(
    (entry) =>
      ts.isPropertyAssignment(entry) &&
      ((ts.isIdentifier(entry.name) && entry.name.text === property) ||
        (ts.isStringLiteral(entry.name) && entry.name.text === property))
  );
  assert.equal(claims.length, 1, `${message}.${property} must be stated exactly once`);
  const initializer = claims[0].initializer;
  const actual = ts.isStringLiteral(initializer)
    ? initializer.text
    : ts.isNumericLiteral(initializer)
      ? Number(initializer.text)
      : undefined;
  assert.equal(actual, expected, `${message}.${property} must be the literal ${expected}`);
}

function styleAttribute(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'));
  assert.ok(match, `spa/projected.html must render <${tag}>`);
  const style = /style\s*=\s*"([^"]*)"/i.exec(match[1] ?? '');
  assert.ok(style, `<${tag}> must state its shell on a style attribute`);
  return style[1];
}

function cssLiteral(style, cssName, expected, message) {
  const match = new RegExp(
    `(?:^|;)\\s*${cssName}\\s*:\\s*([^;]+)`,
    'i'
  ).exec(style.replace(/\s+/g, ' '));
  assert.ok(match, `${message} must set ${cssName}`);
  assert.equal(match[1].trim(), expected, `${message}.${cssName} must be the literal ${expected}`);
}

function projectedShellLiteral(element, property, expected) {
  const html = read('spa/projected.html');
  const cssName = {
    backgroundColor: 'background-color',
    overflow: 'overflow',
    scrollbarGutter: 'scrollbar-gutter',
  }[property];
  assert.ok(cssName, `unknown shell property ${property}`);
  cssLiteral(styleAttribute(html, element), cssName, expected, element);
}

for (const [element, property, expected] of [
  ['html', 'backgroundColor', '#000000'],
  ['html', 'overflow', 'hidden'],
  ['html', 'scrollbarGutter', 'auto'],
  ['body', 'backgroundColor', '#000000'],
  ['body', 'overflow', 'hidden'],
]) {
  test(`Story 17.7: projected root server-renders ${element}.${property} as a literal`, () => {
    projectedShellLiteral(element, property, expected);
  });
}

for (const forbidden of ['ThemeProvider', 'getUiLocale', 'suppressHydrationWarning']) {
  const claim = forbidden === 'ThemeProvider'
    ? 'projected root excludes operator providers: ThemeProvider'
    : `projected root excludes operator shell state ${forbidden}`;
  test(`Story 17.7: ${claim}`, () => {
    assert.doesNotMatch(read('spa/projected.html'), new RegExp(`\\b${forbidden}\\b`));
    const block = /if \(projected\) \{[\s\S]*?\n  \}/.exec(read('spa/src/App.tsx'));
    assert.ok(block, 'App.tsx must branch projected routes away from the operator shell');
    assert.doesNotMatch(block[0], new RegExp(`\\b${forbidden}\\b`));
  });
}

test('Story 17.7: projected not-found and error fallbacks are literal and generic', () => {
  for (const name of ['ProjectedNotFound.tsx', 'ProjectedError.tsx']) {
    const file = `spa/src/projected/${name}`;
    const source = read(file);
    const { root, sourceFile } = defaultReturnedRoot(source, file);
    const rendered = findRenderedElement(root, 'main', file);
    const styleName = styleIdentifierFor(rendered, file);
    const styleObject = literalStyleObject(sourceFile, styleName, file);
    for (const [property, expected] of [
      ['position', 'fixed'],
      ['inset', 0],
      ['overflowY', 'auto'],
      ['backgroundColor', '#000000'],
      ['color', '#FFFFFF'],
    ]) styleLiteral(styleObject, property, expected, `${file}:${styleName}`);

    let detailExpression = null;
    let forbiddenAttribute = null;
    function inspect(node) {
      if (ts.isJsxSpreadAttribute(node)) forbiddenAttribute = 'spread attribute';
      if (
        ts.isJsxAttribute(node) &&
        ['href', 'action', 'formAction', 'onClick', 'onSubmit'].includes(node.name.getText())
      ) forbiddenAttribute = node.name.getText();
      if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) {
        detailExpression = node.expression.getText(sourceFile);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(root);
    assert.equal(forbiddenAttribute, null, `${file} must expose no navigation affordance`);
    assert.equal(detailExpression, null, `${file} must render no runtime/server detail`);
    assert.doesNotMatch(
      stripComments(source),
      /\b(?:useRouter|redirect)\s*\(|\b(?:router|location|window\.location)\s*\.\s*(?:push|replace|assign)\s*\(/,
      `${file} must not navigate imperatively`
    );
  }
});

/**
 * A second way the theme reaches the projected tree, found while verifying AC-4
 * in the browser rather than by reading the source.
 *
 * `globals.css` applies `border-border` through a universal selector
 * (`@layer base { * { @apply border-border outline-ring/50 } }`), so EVERY node
 * in the projected tree already computes a theme-dependent `border-color` —
 * `#e5e5e5` light against `oklch(1 0 0 / 10%)` dark. It paints nothing while
 * Tailwind's preflight leaves `border-width: 0`, which was confirmed node by
 * node on `/services/[id]/slideshow`: 14 of 14 elements at `0px` on all four
 * sides, **with nothing focused**. That last clause matters and was missing:
 * the same universal rule sets `outline-color` from `--ring`, and the UA
 * supplies the width on `:focus-visible`, so a focused link on a projected
 * surface paints a ring in the operator's theme. The three projected focusables
 * now state `focus-visible:outline-white`, asserted below.
 *
 * So the token guard above is necessary but not sufficient. The class that
 * would turn that inert colour into a painted, theme-varying edge is a *width*,
 * which contains no token name and sails straight past a token scan. A projected
 * element that genuinely wants an edge has to state its own colour, the way
 * `ProjectorClient` states `bg-[#0B1220]`, or draw it from registry-resolved
 * inline style.
 *
 * The width vocabulary is larger than it looks and the first version of this
 * guard missed most of it — including `ring-1`, the exact hazard its own comment
 * named. Directional widths, arbitrary values, odd ring and outline widths,
 * divider widths, the arbitrary-property form (`[border-width:2px]`) and the
 * inline-style form (`style={{ borderWidth: 1 }}`) are all painted edges. A
 * colour-only utility (`border-white/25`) is deliberately NOT matched: it paints
 * nothing without a width, and stating a literal colour is the sanctioned way
 * out of this guard.
 *
 * `body { @apply text-foreground }` is the same shape of hazard for TEXT. Both
 * full-screen surfaces now state `text-white` on their own root, so it is closed
 * structurally rather than resting on `ArtifactSlide.tsx`'s literal `#FFFFFF`
 * fallback for registry text — which still holds, and still matters for any node
 * the wrapper does not reach.
 */
const EDGE_WIDTH = String.raw`(?:\d+|\[[^\]\s"'\`]+\])`;
const EDGE_SIDE = String.raw`(?:[trblxy]|s|e)`;
/**
 * Where a utility ends inside a class value.
 *
 * It used to be `(?=["'\s\`}]|$)`, which is the set of things that end a
 * *quoted* class string — and interpolated `className` is idiomatic in this
 * codebase, so the guard whose entire subject is width utilities let a painted
 * edge past whenever one was written that way. Run against the compiled pattern:
 * `` `… border-2${extra} …` ``, `` `ring-1${x}` ``, `` `border-[3px]${y}` `` and
 * `"border-2!"` were all missed, while the same strings with a space before the
 * `${` were caught. `$` (a template interpolation opening) and `!` (Tailwind's
 * important suffix) are delimiters too, so they are in the set.
 */
const EDGE_END = String.raw`(?=["'\s\`}$!]|$)`;
const EDGE_PATTERNS = [
  // `border`, `border-2`, `border-t`, `border-t-2`, `border-[3px]`, `divide-y-4`
  String.raw`(?<![-\w])(?:border|divide)(?:-${EDGE_SIDE})?(?:-${EDGE_WIDTH})?${EDGE_END}`,
  // `ring`, `ring-1`, `outline-1`, `ring-offset-2`
  String.raw`(?<![-\w])(?:ring|outline|ring-offset|outline-offset)(?:-${EDGE_WIDTH})?${EDGE_END}`,
  // An interpolated width — `border-${w}`, `border-t-${w}`, `ring-${n}`. The
  // expression could resolve to a colour instead, in which case this fails and
  // the answer is to state the literal the failure message asks for; a projected
  // file computing its own edge classes is worth stopping to look at either way.
  String.raw`(?<![-\w])(?:border|divide|ring|outline)(?:-${EDGE_SIDE})?-\$\{`,
  // `[border-width:2px]`, `[border-top-width:1px]`, `[outline-width:3px]`
  String.raw`\[(?:border|outline|ring)(?:-[a-z]+)*-width\s*:[^\]]*\]`,
  // `style={{ borderWidth: 1 }}`, `borderTopWidth`, `outlineWidth`
  String.raw`\b(?:border|outline)[A-Za-z]*Width\s*:`,
];
const EDGE_UTILITY = new RegExp(EDGE_PATTERNS.join('|'), 'g');

function typeOnlyRanges(source, file) {
  const ranges = [];
  const sourceFile = parseSource(source, file);
  const visit = (node) => {
    if (
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isTypeNode(node)
    ) {
      ranges.push([node.getStart(sourceFile), node.getEnd()]);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return ranges;
}

function edgeUtilities(source, file) {
  const erased = typeOnlyRanges(source, file);
  return [...source.matchAll(EDGE_UTILITY)]
    .filter((match) => !erased.some(([start, end]) => match.index >= start && match.index < end))
    .map((match) => match[0]);
}

for (const file of PROJECTED) {
  test(`AC-4: ${file} paints no theme-coloured edge`, () => {
    const found = edgeUtilities(read(file), file);
    assert.deepEqual(
      found,
      [],
      `${file} is projected output. A border/ring/outline width here inherits ` +
        `its colour from the universal \`border-border\` in globals.css, which ` +
        `differs between themes — so the edge would change with the operator's ` +
        `choice. Give it an explicit literal colour and widen this guard ` +
        `deliberately. Found: ${found.join(', ')}`
    );
  });
}

for (const file of PROJECTED) {
  test(`AC-4: ${file} carries no theme token`, () => {
    const found = themeReferences(read(file));
    assert.deepEqual(
      found,
      [],
      `${file} is projected output and must paint in literal colours or ` +
        `registry-resolved inline styles, never in a theme token. Found: ` +
        `${found.join(', ')}`
    );
  });
}

/**
 * Anything the UA will give a focus ring: the interactive elements, plus
 * anything made focusable by hand.
 *
 * Spelled as a rule because the previous form matched `<Link` and nothing else,
 * in a hardcoded pair of files — so a `<button type="button">Next</button>`
 * beside the Exit link rang from `--ring` on the room-facing screen with the
 * suite at 43/43.
 */
const FOCUSABLE_TAG = /^<(?:Link|a|button|input|select|textarea|summary|Button)\b/;
const isFocusable = (tag) => FOCUSABLE_TAG.test(tag) || /\btabIndex\s*=/.test(tag);

/**
 * A `focus-visible:outline-*` that states a colour.
 *
 * The assertion was `/focus-visible:outline-\w/` while its own failure message
 * demanded a *colour* — so `none`, `hidden` and `0` all satisfied it, and the
 * one regression it was blind to was the worst of the three: `outline-none` on
 * the Exit link leaves the projected screen with no visible focus indicator at
 * all (WCAG 2.4.7). Reproduced at `SlideshowClient.tsx:72` → 43/43 green.
 * `outline-offset-*` is a distance, not a colour, and is excluded too.
 *
 * Excluding those four was still a list of spellings rather than the criterion,
 * and two more walked past it at 47/47 green. There are exactly two ways to fail
 * here and the exclusions are grouped by which:
 *
 *   - **invisible** — `none`, `hidden`, a `0` width, and `transparent`, which is
 *     a colour in every sense the CSS parser cares about and removes the
 *     indicator exactly as `outline-none` does;
 *   - **inherited from the theme** — the CSS-wide keywords. `outline-inherit`
 *     takes the `outline-color` that `* { @apply outline-ring/50 }` gave every
 *     node, which *is* the leak this guard exists to stop: `--ring` is
 *     `oklch(0.708 0 0)` light against `oklch(0.556 0 0)` dark.
 *
 * `outline-current` is deliberately allowed: it resolves to the element's own
 * `color`, which on these surfaces is the literal `text-white` the root guard
 * pins, and a theme-token `color` cannot reach here because the token guard
 * rejects it.
 */
const CSS_NAMED_COLOURS = new Set(`
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
  magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen
`.trim().split(/\s+/));
const TAILWIND_COLOUR_HUES = new Set(
  'slate gray zinc neutral stone red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose'.split(' ')
);
const TAILWIND_COLOUR_SHADES = new Set(
  '50 100 200 300 400 500 600 700 800 900 950'.split(' ')
);
const COLOUR_FUNCTIONS = new Set(
  'rgb hsl hwb lab lch oklab oklch color'.split(' ')
);
const COLOUR_FUNCTION_WORDS = new Set(
  'none deg rad grad turn srgb srgb-linear display-p3 a98-rgb prophoto-rgb rec2020 xyz xyz-d50 xyz-d65'.split(' ')
);

// Unflagged by design: each class token is classified independently.
const LITERAL_OUTLINE_COLOUR = /^focus-visible:outline-(.+)$/;

function visibleAlpha(value, percentageScale = false) {
  const text = value.trim();
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(text)) {
    const alpha = Number.parseFloat(text);
    return alpha > 0 && alpha <= 100;
  }
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return false;
  const alpha = Number.parseFloat(text);
  return alpha > 0 && alpha <= (percentageScale ? 100 : 1);
}

function splitTailwindOpacity(value) {
  if (value.startsWith('[')) {
    const close = value.lastIndexOf(']');
    if (close !== -1 && value[close + 1] === '/') {
      return [value.slice(0, close + 1), value.slice(close + 2)];
    }
    return [value, null];
  }
  const slash = value.lastIndexOf('/');
  return slash === -1 ? [value, null] : [value.slice(0, slash), value.slice(slash + 1)];
}

function localColour(value) {
  const [baseWithHint, opacity] = splitTailwindOpacity(value);
  if (opacity !== null) {
    const arbitrary = /^\[(.*)\]$/.exec(opacity)?.[1];
    if (!visibleAlpha(arbitrary ?? opacity, arbitrary === undefined)) return null;
  }

  let base = baseWithHint;
  if (base.startsWith('[') && base.endsWith(']')) base = base.slice(1, -1);
  if (base.startsWith('color:')) base = base.slice('color:'.length);
  const lower = base.toLowerCase();
  if (lower === 'current' || lower === 'currentcolor') return { current: true };
  if (CSS_NAMED_COLOURS.has(lower)) return { current: false };

  const tailwind = /^([a-z]+)-(\d{2,3})$/.exec(lower);
  if (
    tailwind &&
    TAILWIND_COLOUR_HUES.has(tailwind[1]) &&
    TAILWIND_COLOUR_SHADES.has(tailwind[2])
  ) return { current: false };

  if (/^#[0-9a-f]+$/i.test(base)) {
    if (![3, 4, 6, 8].includes(base.length - 1)) return null;
    if (base.length === 5 && base.at(-1) === '0') return null;
    if (base.length === 9 && base.slice(-2) === '00') return null;
    return { current: false };
  }

  const fn = /^([a-z]+)\((.*)\)$/i.exec(base);
  if (!fn || !COLOUR_FUNCTIONS.has(fn[1].toLowerCase())) return null;
  const body = fn[2].replaceAll('_', ' ').trim();
  if (!body || /(?:var|env|attr)\s*\(|--/i.test(body)) return null;
  const words = body.match(/[a-z][a-z0-9-]*/gi) ?? [];
  if (words.some((word) => !COLOUR_FUNCTION_WORDS.has(word.toLowerCase()))) return null;

  const slash = body.lastIndexOf('/');
  if (slash !== -1 && !visibleAlpha(body.slice(slash + 1))) return null;
  if (slash === -1 && /^(?:rgb|hsl)$/i.test(fn[1])) {
    const legacy = body.split(',');
    if (legacy.length === 4 && !visibleAlpha(legacy[3])) return null;
  }
  return { current: false };
}

function sourceClassTokens(source) {
  return classNameValues(source).flatMap((value) =>
    value
      .split(/[\s"'`,]+/)
      .map((token) => token.replace(/^[({]+|[)}]+$/g, ''))
      .filter(Boolean)
  );
}

function hasVisibleOwnTextColour(tag) {
  for (const token of sourceClassTokens(tag)) {
    const value = token.startsWith('text-')
      ? token.slice('text-'.length)
      : token.startsWith('focus-visible:text-')
        ? token.slice('focus-visible:text-'.length)
        : null;
    if (value === null) continue;
    const colour = localColour(value);
    if (colour && !colour.current) return true;
  }
  return false;
}

function hasVisibleLocalOutlineColour(tag) {
  for (const token of sourceClassTokens(tag)) {
    const match = LITERAL_OUTLINE_COLOUR.exec(token);
    if (!match) continue;
    const colour = localColour(match[1]);
    if (colour && (!colour.current || hasVisibleOwnTextColour(tag))) return true;
  }
  return false;
}

test('AC-4: every projected focusable states a literal outline colour', () => {
  // `* { @apply outline-ring/50 }` gives every node a theme-dependent
  // `outline-color`, and the UA supplies the width on `:focus-visible` — so a
  // focused control on a projected surface rings in the operator's theme. The
  // edge guard above matches width utilities and structurally cannot see this.
  //
  // Swept over PROJECTED rather than a hand-kept pair. `ProjectorClient` and
  // `projector/page.tsx` were in PROJECTED and not in that pair, and the defence
  // was that `ProjectorClient` has no focusable at all — true, and unenforced,
  // which is verbatim the shape round 2 rejected for the `@/lib` exemption. It
  // is enforced now by the sweep: a focusable added there is checked because it
  // is a focusable, not because someone listed the file.
  //
  // And swept over the whole projected TREE, not the six-entry list. Widening
  // the tags and leaving the files a list was the same narrowing one axis over:
  // a focusable in a component a projected client imports was unchecked, and it
  // escaped the token guard too because a literal `text-white/70` is not a token.
  const offenders = [];
  let found = 0;
  for (const { file } of projectedTree()) {
    if (!file.endsWith('.tsx')) continue;
    for (const { tag } of jsxTags(read(file))) {
      if (!isFocusable(tag)) continue;
      found += 1;
      if (!hasVisibleLocalOutlineColour(tag)) offenders.push(`${file}: ${tag.trim()}`);
    }
  }
  assert.ok(found > 0, 'the projected surfaces carry focusables; this guard found none');
  assert.deepEqual(
    offenders,
    [],
    `a focusable on a projected surface must state its own outline COLOUR, or ` +
      `the focus ring paints from \`--ring\` — 0.708 light against 0.556 dark. ` +
      `State a literal (\`focus-visible:outline-white\`); \`outline-none\` is ` +
      `not an answer, it removes the indicator entirely. Do NOT add a width ` +
      `utility, which the edge guard will reject and should. Found: ` +
      `${offenders.join(' | ')}`
  );
});

/** The two room-facing fallbacks when a service cannot be shown. */
const ROUTE_SHELLS = [
  'spa/src/projected/ProjectedNotFound.tsx',
  'spa/src/projected/ProjectedError.tsx',
];

test('the room-facing failure branches can both be scrolled', () => {
  for (const file of ROUTE_SHELLS) {
    const source = read(file);
    assert.match(source, /position:\s*'fixed'/, `${file} must cover the viewport`);
    assert.match(source, /inset:\s*0/, `${file} must cover the viewport`);
    assert.match(
      source,
      /overflowY:\s*'auto'/,
      `${file} covers the viewport with a fixed surface, which cannot scroll ` +
        `unless overflowY is auto. Both room-facing fallbacks state the same ` +
        `recovery: this is one failure at two URLs.`
    );
  }
});

/**
 * Every module a projected file pulls in, however the specifier is written, with
 * `import type` / `export type` dropped because types erase and can contribute
 * no markup.
 *
 * `export … from` was invisible to this — a re-export is a module edge like any
 * other, and the spelling is already live in this codebase at
 * `src/lib/parsed-fields.ts:432`, so a barrel re-exporting a token-carrying
 * module joined the projected tree unwalked.
 */
function moduleImports(file) {
  return discoverLocalModuleImports(repoRoot, file);
}

/**
 * The projected tree: every module reachable from `PROJECTED`, the roots
 * included, each with the edge it was reached through.
 *
 * One walk, shared, because two guards had answered "what is projected?"
 * differently and the narrower one was silently narrower. The closure guard
 * walked the module graph transitively; the focus-ring guard iterated the
 * six-entry `PROJECTED` list, so a focusable in a component a projected client
 * imports was never checked — an `ExitBar.tsx` rendered inside the slideshow's
 * `fixed inset-0` root was 47/47 green while ringing from `--ring` in front of
 * the congregation. It escaped the closure guard too, correctly: `text-white/70`
 * is a literal, so nothing looked at it at all.
 *
 * The defence was that no `.tsx` is reachable from the projected tree today —
 * true (all 27 walked modules are `.ts`) and unenforced, which is verbatim the
 * shape round 2 rejected for the `@/lib` exemption.
 */
const projectedTree = (() => {
  let cached = null;
  return () => {
    if (cached) return cached;
    cached = discoverModuleGraph(repoRoot, PROJECTED);
    return cached;
  };
})();

test('Story 17.7: the projected closure follows route stylesheets and non-TS imports', () => {
  assert.ok(
    projectedTree().some(({ file }) => file === `${PROJECTED_ROUTE_GROUP}/projected.css`),
    'the projected layout imports projected.css; the closure must reach it'
  );
});

test('Story 17.7: no operator theme provider is reachable indirectly', () => {
  const files = projectedTree().map(({ file }) => file);
  assert.equal(
    files.includes('src/components/ThemeProvider.tsx'),
    false,
    'the projected graph must not import the operator ThemeProvider under any alias'
  );
  for (const file of files.filter((candidate) => /\.(?:[cm]?[jt]sx?)$/.test(candidate))) {
    assert.doesNotMatch(
      stripComments(read(file)),
      /(?:from\s*|import\s*)['"]next-themes['"]|require\(\s*['"]next-themes['"]\s*\)/,
      `${file} must not create a second operator theme boundary`
    );
  }
});

test('AC-4: reachable projected modules paint no theme-coloured edge', () => {
  const offenders = [];
  for (const { file, via } of projectedTree().filter(({ via }) => via !== null)) {
    const found = edgeUtilities(read(file), file);
    if (found.length > 0) offenders.push(`${via} (${file}) carries ${found.join(', ')}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `a module reachable from projected output carries an edge width that inherits ` +
      `the operator theme. Found: ${offenders.join(' | ')}`
  );
});

test('AC-4: focus outlines use a positive locally-resolved colour classifier', () => {
  for (const value of [
    'focus-visible:outline-[transparent]',
    'focus-visible:outline-[inherit]',
    'focus-visible:outline-[color:inherit]',
    'focus-visible:outline-[revert]',
    'focus-visible:outline-[unset]',
    'focus-visible:outline-[initial]',
    'focus-visible:outline-[--ring]',
    'focus-visible:outline-white/0',
    'focus-visible:outline-[#fff0]',
    'focus-visible:outline-[#ffffff00]',
    'focus-visible:outline-[#fffff]',
    'focus-visible:outline-[rgb(255_255_255/0)]',
    'focus-visible:outline-[rgb(var(--local))]',
  ]) assert.equal(hasVisibleLocalOutlineColour(`<a className="${value}">`), false, value);
  for (const value of [
    'focus-visible:outline-white',
    'focus-visible:outline-[#fff]', 'focus-visible:outline-[rgb(255_255_255)]',
    'focus-visible:outline-[color:#fff]', 'focus-visible:outline-[red]',
    'focus-visible:outline-[rebeccapurple]', 'focus-visible:outline-cyan-500',
  ]) assert.equal(hasVisibleLocalOutlineColour(`<a className="${value}">`), true, value);
  assert.equal(
    hasVisibleLocalOutlineColour('<a className="text-white focus-visible:outline-current">'),
    true,
    'current remains allowed when the focusable states its own visible colour'
  );
  assert.equal(
    hasVisibleLocalOutlineColour('<a className="text-transparent focus-visible:outline-current">'),
    false,
    'current cannot borrow an invisible colour'
  );
});

test('AC-4: dark is detected as a variant segment, wherever it is stacked', () => {
  for (const value of [
    'dark:!bg-zinc-900', 'dark:2xl:bg-zinc-900', 'dark:*:bg-zinc-900',
    'sm:dark:bg-zinc-900', 'sm:dark:hover:bg-zinc-900', 'dark:hover:!bg-zinc-900',
  ]) assert.notDeepEqual(themeReferences(`const classes = '${value}'`), []);
  assert.deepEqual(themeReferences("const classes = 'sm:hover:bg-zinc-900'"), []);
  assert.deepEqual(themeReferences('const palette = { dark: false }'), []);
  assert.deepEqual(themeReferences("const classes = 'group-hover/dark:bg-white'"), []);
  assert.deepEqual(themeReferences("const classes = 'peer-checked/dark:text-white'"), []);
});

test('AC-4: the edge sweep ignores erased types but keeps runtime paint', () => {
  assert.deepEqual(
    edgeUtilities('type Edge = { borderWidth: number; token: "border-2" }', 'fixture.ts'),
    []
  );
  assert.deepEqual(
    edgeUtilities('const edge = { borderWidth: 1 };', 'fixture.ts'),
    ['borderWidth:']
  );
});

test('AC-4: the projected tree stays closed, transitively and with no exempt directory', () => {
  // Two earlier versions of this were narrower than they read. The first walked
  // `@/components/…` imports only, so a relative `./Sibling`, an `@/app/…`
  // component and a `dynamic(() => import('./Lazy'))` each joined the tree
  // unguarded. The second filtered `@/lib/*` out wholesale, on the true but
  // unenforced ground that it holds "data, helpers and hooks — not markup" — in
  // a change set that had just made `@/lib` the home of projected-surface logic.
  // A class-name constant or a JSX helper put there reached the projected
  // surface unscanned. Nothing is exempt by directory now: a module is fine
  // because its own `themeReferences()` is empty, and that is checked.
  //
  // It walks DOWNWARD only. What renders ABOVE a projected route — the root
  // layout, a `not-found.tsx`, a `template.tsx` at the same URL — is Story
  // 17.7's contract, and is deliberately not asserted here.
  //
  // The third narrowing was the walk itself: it enqueued `.tsx` only, so the
  // directory exemption it had just removed came straight back as an extension
  // exemption over the same directory. A `.ts` module was scanned for tokens,
  // but nothing it imported was ever reached — 12 modules scanned against the 27
  // actually reachable, `src/lib/projected-shell.ts` among the missing.
  // Reproduced both ways at 43/43 green: a class-name constant one `.ts` hop
  // past `use-projected-shell.ts`, and a `.ts` barrel re-exporting a `.tsx` that
  // paints `bg-card`. Every module is walked now, whatever its extension.
  const walked = projectedTree().filter(({ via }) => via !== null);
  const offenders = [];
  for (const { file, via } of walked) {
    const found = themeReferences(read(file));
    if (found.length > 0) {
      offenders.push(`${via} (${file}) carries ${found.join(', ')}`);
    }
  }

  // A floor on the reach, so the walk cannot quietly stop early again. The
  // App Router page.tsx used to pull SQLite/plan modules into this graph
  // (27+). The SPA pages only import the room-facing clients, so the live
  // tree is smaller; a `.tsx`-only enqueue still stops around a handful of
  // files and misses `src/lib/projected-shell.ts`. Keep the floor above that.
  assert.ok(
    walked.length >= 10,
    `the closure walk reached only ${walked.length} modules; it used to stop at ` +
      `the first \`.ts\` hop and that is the shape of this regression. Reached: ` +
      `${walked.map(({ file }) => file).sort().join(', ')}`
  );

  assert.deepEqual(
    offenders,
    [],
    `a module reachable from the projected tree carries a theme token. Either ` +
      `it is markup and belongs in PROJECTED, or the token does not belong in ` +
      `it. Found: ${offenders.join(' | ')}`
  );
});

function staticPropertyName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteralLike(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression))
  ) return name.expression.text;
  return null;
}

function createElementStyleCalls(source, file = 'fixture.tsx') {
  const sourceFile = parseSource(source, file);
  const offenders = [];
  const visit = (node) => {
    const subject = ts.isCallExpression(node) ? node.arguments[0] : undefined;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'React' &&
      node.expression.name.text === 'createElement' &&
      subject &&
      ts.isIdentifier(subject) &&
      PROJECTED_COMPONENT_NAMES.has(subject.text)
    ) {
      const props = node.arguments[1];
      let unsafe = false;
      if (props && ts.isObjectLiteralExpression(props)) {
        unsafe = props.properties.some(
          (property) => ts.isSpreadAssignment(property) || staticPropertyName(property.name) === 'className'
        );
      } else if (
        props &&
        props.kind !== ts.SyntaxKind.NullKeyword &&
        !(ts.isIdentifier(props) && props.text === 'undefined')
      ) {
        // An opaque props expression cannot prove the closed shape this belt asserts.
        unsafe = true;
      }
      if (unsafe) offenders.push(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return offenders;
}

test('AC-4: no caller can style the projected wrapper from outside', () => {
  // `ArtifactSlide` used to splice a caller's `className` onto the wrapper the
  // congregation sees, and `SlideView` forwarded one straight through. Neither
  // accepts one now, so TypeScript rejects the call — this is the belt to that
  // braces, and it also covers the shapes `tsc` would not flag at a glance.
  //
  // Read through `openingTag`, not `/<(SlideView|ArtifactSlide)\b([^>]*)>/`.
  // That form stopped at the first `>`, so a `>` inside a prop expression cut
  // the slice before `className` ever appeared in it:
  // `<SlideView slide={i > 0 ? a : b} className="bg-card" />` was green. It is
  // the same truncation `openingTag` was written for one guard over — the fix
  // existed in this file and was not called here.
  const offenders = [];
  for (const file of allTsxFiles()) {
    for (const { tag } of jsxTags(read(file))) {
      if (!/^<(SlideView|ArtifactSlide)\b/.test(tag)) continue;
      if (/\bclassName\s*=|\{\s*\.\.\./.test(tag)) offenders.push(`${file}: ${tag.trim()}`);
    }
  }
  for (const file of [...allTsxFiles(), ...allTsFiles()]) {
    for (const call of createElementStyleCalls(read(file), file)) {
      offenders.push(`${file}: ${call}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a className passed here lands on the wrapper the congregation sees, so a ` +
      `theme token in it defeats AC-4 without touching any guarded file. A ` +
      `spread is flagged for the same reason: it can carry one invisibly. ` +
      `Found: ${offenders.join(' | ')}`
  );
});

test('AC-4: createElement checks exactly the projected props object', () => {
  for (const source of [
    'React.createElement(SlideView, { slide, className })',
    "React.createElement(SlideView, { slide, 'className': 'bg-card' })",
    "React.createElement(SlideView, { slide, ['className']: 'bg-card' })",
    'React.createElement(SlideView, { slide, ...rest })',
    'React.createElement(SlideView, props)',
  ]) assert.equal(createElementStyleCalls(source, 'fixture.ts').length, 1, source);

  assert.deepEqual(
    createElementStyleCalls(
      "React.createElement(SlideView, { slide }); const unrelated = { className: 'x' }",
      'fixture.tsx'
    ),
    []
  );
  assert.deepEqual(
    createElementStyleCalls(
      "React.createElement(SlideView, { slide, options: { className: 'metadata' } })",
      'fixture.ts'
    ),
    []
  );
});

/** The parameter list of the file's default-exported function, as source. */
function defaultExportedFunction(source, file = 'fixture.tsx') {
  const sourceFile = parseSource(source, file);
  const direct = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  );
  if (direct) return { component: direct, sourceFile };

  const assignment = sourceFile.statements.find(
    (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals
  );
  assert.ok(assignment, `${file} must keep a default-exported function component`);
  let expression = assignment.expression;
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    expression = expression.expression;
  }
  let component = expression;
  if (ts.isIdentifier(expression)) {
    const declaration = sourceFile.statements.find(
      (statement) =>
        (ts.isFunctionDeclaration(statement) && statement.name?.text === expression.text) ||
        (ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === expression.text
          ))
    );
    if (declaration && ts.isFunctionDeclaration(declaration)) component = declaration;
    else if (declaration && ts.isVariableStatement(declaration)) {
      component = declaration.declarationList.declarations.find(
        (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === expression.text
      )?.initializer;
    }
  }
  assert.ok(
    component &&
      (ts.isFunctionDeclaration(component) ||
        ts.isFunctionExpression(component) ||
        ts.isArrowFunction(component)),
    `${file}'s default export must resolve to a function component`
  );
  return { component, sourceFile };
}

function exportedProps(source, file = 'fixture.tsx') {
  const { component, sourceFile } = defaultExportedFunction(source, file);
  return `(${component.parameters.map((parameter) => parameter.getText(sourceFile)).join(', ')})`;
}

/** The type annotation on the props parameter, as source. */
function propsAnnotation(params) {
  const inner = params.slice(1, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if ('({['.includes(c)) depth += 1;
    else if (')}]'.includes(c)) depth -= 1;
    else if (c === ':' && depth === 0) return inner.slice(i + 1).trim();
  }
  return '';
}

/**
 * A local `type` / `interface` declaration's whole right-hand side.
 *
 * `balancedBlock` alone returns the first `{ … }` and nothing else, which is the
 * hole below. `<` and `>` are deliberately not counted as brackets: they are
 * balanced in `Foo<Bar>` and unbalanced in `() => void`, and a props type is far
 * more likely to contain the second.
 */
function typeDeclarationBody(source, at) {
  if (source.startsWith('interface', at)) {
    const block = balancedBlock(source, at);
    return source.slice(at + 'interface'.length, source.indexOf(block, at) + block.length);
  }
  let i = source.indexOf('=', at) + 1;
  const start = i;
  let depth = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      i = pastString(source, i);
      continue;
    }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ';' && depth === 0) break;
    i += 1;
  }
  return source.slice(start, i);
}

/**
 * `text` with every balanced `{ … }` removed, so only the composition around the
 * inline object literals is left — the `&` members and the `extends` bases.
 */
function withoutObjectLiterals(text) {
  let out = '';
  let i = 0;
  let depth = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = pastString(text, i);
      if (depth === 0) out += text.slice(i, end);
      i = end;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += c;
    i += 1;
  }
  return out;
}

/** Words that appear in a type composition and name no type. */
const TYPE_NOISE = new Set(['extends', 'type', 'interface', 'readonly', 'keyof', 'infer']);

function assertClosedPropsStructure(source, file) {
  const { component, sourceFile } = defaultExportedFunction(source, file);
  const parameter = component.parameters[0];
  assert.ok(parameter, `${file}'s exported component must declare its props`);

  if (
    ts.isObjectBindingPattern(parameter.name) &&
    parameter.name.elements.some((element) => element.dotDotDotToken)
  ) {
    assert.fail(
      `${file}'s exported props must not collect a rest object; it can forward ` +
        `a caller-supplied className onto the projected wrapper.`
    );
  }

  const declarations = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      declarations.set(statement.name.text, statement);
    }
  }
  const seen = new Set();
  const failOpenShape = () => assert.fail(
    `${file}'s exported props must be a closed object literal; an index signature ` +
      `can reintroduce className without naming it.`
  );
  const checkMembers = (members) => {
    if (members.some((member) => ts.isIndexSignatureDeclaration(member))) failOpenShape();
  };
  const checkType = (node) => {
    if (!node) return;
    if (ts.isTypeLiteralNode(node)) {
      checkMembers([...node.members]);
      return;
    }
    if (ts.isMappedTypeNode(node)) failOpenShape();
    if (ts.isIntersectionTypeNode(node) || ts.isUnionTypeNode(node)) {
      for (const member of node.types) checkType(member);
      return;
    }
    if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
      checkType(node.type);
      return;
    }
    if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName)) return;
    const name = node.typeName.text;
    if (seen.has(name)) return;
    seen.add(name);
    const declaration = declarations.get(name);
    if (!declaration) return; // The existing resolver below reports this loudly.
    if (ts.isTypeAliasDeclaration(declaration)) checkType(declaration.type);
    if (ts.isInterfaceDeclaration(declaration)) {
      checkMembers([...declaration.members]);
      for (const clause of declaration.heritageClauses ?? []) {
        for (const inherited of clause.types) {
          if (ts.isIdentifier(inherited.expression)) {
            checkType(ts.factory.createTypeReferenceNode(inherited.expression.text, undefined));
          }
        }
      }
    }
  };
  checkType(parameter.type);
}

/**
 * The props of the file's default-exported component, as source — the inline
 * parameter list plus the whole local declaration of a named props type, and of
 * every locally-declared type that one composes.
 *
 * Reading the literal parentheses alone was enough to defeat this: `Header.tsx:9`
 * already uses the `interface HeaderProps` + `function Header(…: HeaderProps)`
 * shape, so it is house style rather than a contrivance. The deleted parameter is
 * what makes a spread, a `React.createElement` call and a `.ts` call site fail to
 * compile — and that property disappears the moment props are re-declared, with
 * this guard the only thing standing there.
 *
 * **Following the name and then reading only its first `{ … }` moved the wall by
 * exactly one spelling.** `balancedBlock` returns the object literal and never
 * the other half of an intersection or an `extends` base, so
 * `type SlideViewProps = React.ComponentProps<'div'> & { slide: SlidePlanItem }`
 * with `{...rest}` on the wrapper was **47/47 green and `tsc --noEmit` clean**,
 * with `<SlideView slide={s} className="bg-card" />` compiling and landing
 * `bg-card` on the wrapper the congregation sees. `interface … extends` behaved
 * the same. That is house style here too — `React.ComponentProps<"div">` at
 * `ui/card.tsx`, `ui/dialog.tsx`, `ui/popover.tsx`, and `ButtonPrimitive.Props &
 * VariantProps<…>` at `ui/button.tsx:47`.
 *
 * So the rule is stated rather than the spelling: these props must be composed
 * only of inline object literals and types declared in this same file. Anything
 * else — an import, a namespaced type, a utility type — fails **loudly**, because
 * a guard that cannot read the shape it asserts about must say so instead of
 * passing. `React.ComponentProps<'div'>` is not a hypothetical member to reject:
 * it contains `className` by definition.
 */
function exportedPropsShape(source, file) {
  const params = exportedProps(source, file);
  assertClosedPropsStructure(source, file);
  const annotation = propsAnnotation(params);
  assert.notEqual(
    annotation,
    '',
    `${file}'s exported component must annotate its props, or this guard has ` +
      `nothing to read`
  );
  if (annotation.startsWith('{')) {
    return params;
  }

  const parts = [params];
  const seen = new Set();
  const resolve = (name, via) => {
    if (seen.has(name)) return;
    seen.add(name);
    const at = source.search(new RegExp(String.raw`\b(?:type|interface)\s+${name}\b`));
    assert.notEqual(
      at,
      -1,
      `${file}'s props ${via} \`${name}\`, which is not declared in this file. ` +
        `AC-4 rests on these props being readable here, and a type this guard ` +
        `cannot read is a type that can reintroduce \`className\` silently — ` +
        `\`React.ComponentProps<'div'>\` carries one by definition. Declare the ` +
        `shape locally rather than composing it from elsewhere.`
    );
    const body = typeDeclarationBody(source, at);
    parts.push(body);
    for (const m of withoutObjectLiterals(body).matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (m[0] === name || TYPE_NOISE.has(m[0])) continue;
      resolve(m[0], 'compose');
    }
  };

  resolve(annotation.replace(/[^\w$].*$/s, ''), 'are annotated as');
  const shape = parts.join('\n');
  return shape;
}

test('AC-4: projected props remain closed object literals', () => {
  const file = 'fixture.tsx';
  assert.throws(
    () => exportedPropsShape('export default function X({ slide }: { slide: string; [key: string]: unknown }) {}', file),
    /closed object literal/
  );
  assert.throws(
    () => exportedPropsShape('export default function X({ slide, ...rest }: { slide: string }) {}', file),
    /must not collect a rest object/
  );
  assert.throws(
    () => exportedPropsShape('export default function X({ slide = {}, ...rest }: { slide: object }) {}', file),
    /must not collect a rest object/
  );
  assert.throws(
    () => exportedPropsShape('export default function X({ slide }: { [K in string]?: unknown }) {}', file),
    /closed object literal/
  );
  assert.doesNotThrow(
    () => exportedPropsShape('export default function X({ slide }: { slide: string[]; pair: [string, number] }) {}', file)
  );
  assert.doesNotThrow(
    () => exportedPropsShape('export default function X({ options }: { options: { [key: string]: unknown } }) {}', file)
  );
  assert.doesNotThrow(
    () => exportedPropsShape('export default function X({ slide = { ...defaults } }: { slide: object }) {}', file)
  );
});

test('Story 17.7: sync and async default exports reach substantive guard checks', () => {
  for (const source of [
    'export default function X({ slide }: { slide: string }) { return <div className="fixed inset-0 text-white" />; }',
    'export default async function X({ slide }: { slide: string }) { return <div className="fixed inset-0 text-white" />; }',
    'export default ({ slide }: { slide: string }) => <div className="fixed inset-0 text-white" />;',
    'const X = async ({ slide }: { slide: string }) => <div className="fixed inset-0 text-white" />; export default X;',
    'function X({ slide }: { slide: string }) { return <div className="fixed inset-0 text-white" />; } export default X;',
  ]) {
    assert.doesNotThrow(() => exportedPropsShape(source, 'fixture.tsx'));
    assert.deepEqual(
      jsxReturnBranches(source).flat().map((root) => classNameValues(root)[0]),
      ['fixed inset-0 text-white']
    );
  }
});

const PROJECTED_COMPONENT_FILES = projectedTree()
  .map(({ file }) => file)
  .filter((file) => file.endsWith('.tsx'));
const PROJECTED_COMPONENT_NAMES = new Set(
  PROJECTED_COMPONENT_FILES.map((file) => path.posix.basename(file, '.tsx'))
);

test('AC-4: projected components cannot accept a className from outside', () => {
  // The invariant above as a type signature rather than a regex, which is what
  // makes a `{...props}` spread, a `React.createElement(ArtifactSlide, …)`, a
  // renamed default import and a `.ts` call site fail to compile instead of
  // slipping past a scan of `.tsx` files. Only the PROPS are checked — both
  // files legitimately set `className` on their own elements; what they must not
  // do is let a caller supply one.
  for (const file of PROJECTED_COMPONENT_FILES) {
    const { component } = defaultExportedFunction(read(file), file);
    if (component.parameters.length === 0) continue;
    assert.doesNotMatch(
      exportedPropsShape(read(file), file),
      /\bclassName\b/,
      `${file} must not accept a className. It lands on the wrapper the ` +
        `congregation sees, so styling a projected slide from the outside is ` +
        `not a thing to make possible, let alone convenient.`
    );
  }
});

// --- AC-4: the themed app shell under the full-screen surfaces --------------

function firstClientBoundaries(page) {
  const boundaries = [];
  const seen = new Set([page]);
  const queue = moduleImports(page).map(({ resolved }) => resolved);
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const posix = file.replaceAll('\\', '/');
    if (/\/(?:Slideshow|Projector)Client\.tsx$/.test(posix)) {
      boundaries.push(file);
      continue;
    }
    queue.push(...moduleImports(file).map(({ resolved }) => resolved));
  }
  return boundaries;
}

const FULL_SCREEN = [...new Set(projectedRoutes.pages.flatMap(firstClientBoundaries))];

test('Story 17.7: every projected page crosses exactly one structural client boundary', () => {
  for (const page of projectedRoutes.pages) {
    assert.equal(
      firstClientBoundaries(page).length,
      1,
      `${page} must reach one room-facing client before any deeper client subtree`
    );
  }
});

for (const file of FULL_SCREEN) {
  test(`AC-4: ${file} neutralises the themed html/body shell`, () => {
    assert.match(read(file), /\bfixed inset-0\b/, 'this is a full-screen surface');
    assert.match(
      read(file),
      /useProjectedShell\(\)/,
      `${file} covers the viewport with \`fixed inset-0\`, but \`body\` carries ` +
        `\`bg-background\` and \`html\` reserves a scrollbar gutter — so the ` +
        `theme paints a strip down the edge that this surface never covers. ` +
        `The projector neutralised that for itself and the slideshow did not, ` +
        `which is how AC-4 was falsified once already. Call ` +
        `\`useProjectedShell()\`.`
    );
  });
}

for (const file of FULL_SCREEN) {
  test(`AC-4: ${file} sets its own text colour on every full-screen surface`, () => {
    // Checked on the ROOT element, not anywhere in the file. Both of these
    // surfaces carry `text-white/70` and `hover:text-white` on inner chrome, so
    // a file-wide `/\btext-white\b/` was green with the root stripped bare —
    // negative-testing caught it, which is the same substring-satisfiable defect
    // this file was rewritten to remove.
    //
    // And then it read `jsxReturnBranches(…)[0]` — the first branch — which is
    // the exact defect `jsxReturnBranches` was rewritten to remove, reintroduced
    // at its call site. An early `return (<div className="fixed inset-0 bg-black
    // text-white">…</div>)` above the real return satisfied this while the real
    // root went back to inheriting `body { @apply text-foreground }`, which is
    // the whole hazard the `text-white` patch exists for. Every branch, every
    // root.
    const branches = jsxReturnBranches(read(file));
    assert.ok(branches.length > 0, `${file} renders no JSX branch`);
    for (const root of branches.flat()) {
      assert.ok(root !== undefined, `${file} renders a branch with no classed element`);
      const [value] = classNameValues(root);
      // Pinned to the element that covers the viewport, so the assertion cannot
      // be satisfied by an inner node that happens to state a colour.
      assert.match(
        value,
        /(?:^|\s)fixed inset-0(?:$|\s)/,
        `${file} is a full-screen surface, so its outermost classed element is ` +
          `the one that covers the viewport. Found: ${value}`
      );
      assert.match(
        value,
        /(?:^|\s)text-white(?:$|\s)/,
        `\`body { @apply text-foreground }\` reaches any projected node that ` +
          `sets no colour. Stating \`text-white\` on the full-screen root ` +
          `closes it here rather than relying on ArtifactSlide's literal ` +
          `fallback. Root className: ${value}`
      );
    }
  });
}

test('AC-4: the shell claim paints a literal, never a token', () => {
  const claim = read('src/lib/projected-shell.ts');
  assert.match(claim, /'scrollbarGutter',\s*'auto'/, 'the reserved gutter is the mechanism');
  assert.match(claim, /'backgroundColor',\s*'#000000'/, 'literal black, not `--background`');
  assert.deepEqual(
    themeReferences(claim),
    [],
    'the claim exists to take the theme off the projected shell; reading a ' +
      'theme token to do it would put it straight back'
  );
});

// --- AC-4: the shell claim as behaviour, not as source text -----------------

// `claimProjectedShell` / `resetProjectedShellForTest` are imported at the top
// of the file, not here: a top-level await below a registered test is what broke
// the AC-4 guards on CI. See the note above the imports.

/** The five properties, and nothing else, as a plain object. */
function documentStub(initial = {}) {
  return {
    documentElement: { style: { ...(initial.root ?? {}) } },
    body: { style: { ...(initial.body ?? {}) } },
  };
}

test('AC-4 behaviour: a claim blacks out the shell and a release hands it back', () => {
  resetProjectedShellForTest();
  const doc = documentStub({
    root: { overflow: 'visible', scrollbarGutter: 'stable', backgroundColor: 'rebeccapurple' },
    body: { overflow: 'auto', backgroundColor: 'white' },
  });

  const release = claimProjectedShell(doc);
  assert.equal(doc.documentElement.style.overflow, 'hidden');
  assert.equal(doc.body.style.overflow, 'hidden');
  assert.equal(doc.documentElement.style.scrollbarGutter, 'auto');
  assert.equal(doc.documentElement.style.backgroundColor, '#000000');
  assert.equal(doc.body.style.backgroundColor, '#000000');

  release();
  // The restore path is the one that matters and the one no regex reaches: a bug
  // here leaves the operator's whole app shell pinned at literal black after
  // they leave a projected route.
  assert.equal(doc.documentElement.style.overflow, 'visible');
  assert.equal(doc.body.style.overflow, 'auto');
  assert.equal(doc.documentElement.style.scrollbarGutter, 'stable');
  assert.equal(doc.documentElement.style.backgroundColor, 'rebeccapurple');
  assert.equal(doc.body.style.backgroundColor, 'white');
});

test('AC-4 behaviour: two concurrent claims do not strand the shell at black', () => {
  // Without reference counting the second claim snapshots the first claim's
  // `#000000`, and the first release then restores black permanently. Story 17.1
  // took the callers from one to two; 17.7 adds a third over the same URLs.
  resetProjectedShellForTest();
  const doc = documentStub({ root: { backgroundColor: 'white' }, body: { backgroundColor: 'white' } });

  const releaseFirst = claimProjectedShell(doc);
  const releaseSecond = claimProjectedShell(doc);

  releaseFirst();
  assert.equal(
    doc.body.style.backgroundColor,
    '#000000',
    'a surface is still on screen, so the shell must stay black'
  );

  releaseSecond();
  assert.equal(doc.body.style.backgroundColor, 'white', 'the last release restores');
  assert.equal(doc.documentElement.style.backgroundColor, 'white');
});

test('AC-4 behaviour: a release from before a reset cannot unblack a live shell', () => {
  // `resetProjectedShellForTest()` zeroed the counter and left already-issued
  // releases live, so a stale one decremented a claim it did not make. Driven
  // against the real module that took `claims` to -1, after which every later
  // claim skipped the whole `claims === 0` block and the shell kept
  // `background: white` and `scrollbar-gutter: stable` for the rest of the
  // process. Unreachable from app code, where each closure decrements once behind
  // its own `released` flag; the live exposure is the next test that claims
  // without releasing and silently wedges every test after it — in the module
  // AD-24 names as the room-facing surface's closure gate.
  //
  // Asserted at its sharpest point: the stale release lands while a DIFFERENT
  // document holds the claim, so without the generation token it does not merely
  // miscount, it restores the shell that is still on screen.
  resetProjectedShellForTest();
  const first = documentStub({ body: { backgroundColor: 'white' } });
  const staleRelease = claimProjectedShell(first);

  resetProjectedShellForTest();
  const second = documentStub({
    root: { backgroundColor: 'white' },
    body: { backgroundColor: 'white' },
  });
  const release = claimProjectedShell(second);

  staleRelease();
  assert.equal(
    second.body.style.backgroundColor,
    '#000000',
    'a surface is on screen and holds the claim; a release issued before the ' +
      'reset belongs to a shell that no longer exists and must do nothing'
  );

  release();
  assert.equal(second.body.style.backgroundColor, 'white', 'the real release still restores');
});

test('AC-4 behaviour: a reset hands the shell back before it forgets the claim', () => {
  // The other half of the same seam. The generation token stopped a stale
  // release from acting; nothing stopped the reset from DROPPING the live one.
  // `restore = null` with the document still black meant the next claim took the
  // `claims === 0` path and snapshotted `#000000` / `hidden` / `auto` as the
  // state to return to — so the final release restored black, and the module
  // header's own warning about a test that claims without releasing was still
  // describing a reachable state, now through a poisoned snapshot rather than a
  // negative counter.
  resetProjectedShellForTest();
  const doc = documentStub({
    root: { overflow: 'visible', scrollbarGutter: 'stable', backgroundColor: 'white' },
    body: { overflow: 'auto', backgroundColor: 'white' },
  });

  claimProjectedShell(doc); // deliberately not released — this is the hazard
  resetProjectedShellForTest();
  assert.equal(
    doc.body.style.backgroundColor,
    'white',
    'a reset must hand the shell back, or it leaks the black into the next test'
  );

  const release = claimProjectedShell(doc);
  release();
  assert.equal(doc.body.style.backgroundColor, 'white');
  assert.equal(doc.documentElement.style.backgroundColor, 'white');
  assert.equal(doc.documentElement.style.scrollbarGutter, 'stable');
  assert.equal(doc.documentElement.style.overflow, 'visible');
  assert.equal(doc.body.style.overflow, 'auto');
});

test('AC-4 behaviour: releasing twice is a no-op, not a double decrement', () => {
  resetProjectedShellForTest();
  const doc = documentStub({ body: { backgroundColor: 'white' } });

  const release = claimProjectedShell(doc);
  const other = claimProjectedShell(doc);
  release();
  release();
  assert.equal(
    doc.body.style.backgroundColor,
    '#000000',
    'a stale release must not restore while another surface holds the claim'
  );
  other();
  assert.equal(doc.body.style.backgroundColor, 'white');
});

// --- AC-3: the two deliberate opt-outs keep their own dark wrapper ----------

/**
 * `className` values as written, including the `{…}` expression forms, so a
 * `cn('dark', …)` or a template literal is read rather than missed.
 */
function classNameValues(source) {
  return [
    ...source.matchAll(
      /className=(?:"([^"]*)"|'([^']*)'|\{((?:[^{}]|\{[^{}]*\})*)\})/g
    ),
  ].map((m) => m[1] ?? m[2] ?? m[3]);
}

/** `dark` as a class token — not as a substring of `dark:` or `darkroom`. */
const carriesDark = (value) => /(?:^|[\s'"`])dark(?:[\s'"`]|$)/.test(value);

/**
 * The root elements of every JSX-returning branch of the exported surface: one
 * array of opening tags per branch, so a guard can assert about each root of
 * each branch instead of about one element of one branch.
 *
 * Two narrowings lived here, and both were the same shape — a rule stated
 * broadly and applied to whichever spelling the author had in front of them.
 *
 *   - It took `classNameValues(body)[0]`, the first `className` in source order,
 *     while its own failure message called that "the OUTERMOST classed element".
 *     Any early return carrying a className (loading, empty, error) silently
 *     became the checked element.
 *   - It then matched `/return\s*\(\s*(?=<)/`, so a **branch** was defined as a
 *     parenthesised return. A paren-less `return <div …>;` — the house style at
 *     `src/components/SlideView.tsx:19` — was not a branch at all, and a
 *     component mixing both styles was checked on half its branches and stayed
 *     green. That is the silent-skip the rewrite existed to close, one level up.
 *
 * A render branch is now any `return` whose expression contains JSX, however it
 * is written, and it reports the **outermost classed element** under each
 * top-level root — so `return cond ? <A/> : <B/>` yields two and both are
 * checked. An effect cleanup (`return () => …`) contains no element and is not a
 * branch, which no longer depends on how its parentheses fall.
 *
 * *Outermost classed*, not *root*, because a context provider carries no
 * `className` and paints nothing: `SlideGridDialog` returns `<Dialog>` whose
 * child `<DialogContent>` is the portalled surface that has to declare `dark`,
 * and its own comment says so. `undefined` is reported for a root with nothing
 * classed beneath it at all, which is a branch a caller should reject rather
 * than skip.
 *
 * **And "outermost classed" was still implemented as "first classed in source
 * order", which is a third spelling of the same defect.** Under an unclassed
 * provider root, first-in-pre-order is whichever CHILD comes first in the file,
 * not the one that paints. It failed both ways: a `<span className="dark
 * sr-only" />` placed before `<DialogContent>` satisfied the AC-3 guard with
 * `dark` stripped from the real surface (47/47 green), and any classed non-dark
 * sibling placed there — the `<DialogTitle className="sr-only">` shadcn's
 * accessibility guidance asks for — failed the guard on correct code.
 *
 * It descends the single-element chain instead: the surface root is the first
 * classed element on the way down, and a level with more than one element and no
 * class above it is **ambiguous and says so**, because at that point nothing in
 * the source distinguishes the container from its sibling.
 *
 * A declaration rather than a `const` arrow, to match its only caller. A hoisted
 * `jsxReturnBranches` calling a `const` was the asymmetry that let the CI failure
 * reach a ReferenceError instead of never being callable at all.
 */
function branchSurfaceRoot(subtree) {
  for (let depth = 0; ; depth += 1) {
    const here = subtree.filter((el) => el.depth === depth);
    if (here.length === 0) return undefined;
    assert.equal(
      here.length,
      1,
      `a render branch has ${here.length} elements at depth ${depth} with no ` +
        `className above them, so which one paints the surface is not something ` +
        `this guard can read. Taking the first in source order is what it used ` +
        `to do, and a classed sibling placed before the real surface satisfied ` +
        `it. Put the class on the element that contains the branch. Found: ` +
        `${here.map((el) => el.tag.trim()).join(' | ')}`
    );
    if (classNameValues(here[0].tag).length > 0) return here[0].tag;
  }
}

/**
 * The default-exported function's own body, so `jsxReturnBranches` reads the
 * component and not the rest of the file.
 *
 * `source.slice(indexOf('export default function'))` ran to end of file, so a
 * helper declared below the export contributed its returns as surface branches:
 * a two-line `function Caption() { return <span className="text-white/70">…; }`
 * appended to a `FULL_SCREEN` file failed with *"its outermost classed element
 * is the one that covers the viewport"*, which is false of a caption. Loud
 * rather than silent, and still wrong.
 *
 * One limit remains and is stated rather than implied: a `return` inside a
 * callback **within** the body — a `.map()` row, an inline component — is still
 * read as a branch. That direction also fails loudly, never silently, which is
 * this file's standing policy for a limit it has not closed.
 */
function exportedFunctionBody(source, file = 'fixture.tsx') {
  const { component, sourceFile } = defaultExportedFunction(source, file);
  assert.ok(component.body, `${file}'s default-exported function needs a body`);
  const body = component.body.getText(sourceFile);
  return ts.isBlock(component.body) ? body : `return ${body}`;
}

function jsxReturnBranches(source) {
  const body = exportedFunctionBody(source);
  const endOfStatement = (c, nesting, open) =>
    (c === ';' || c === '}') && nesting === 0 && open === 0;
  return [...body.matchAll(/\breturn\b/g)]
    .map((m) => {
      const subtrees = [];
      for (const el of walkJsx(body, m.index + 'return'.length, endOfStatement)) {
        if (el.depth === 0) subtrees.push([]);
        if (subtrees.length === 0) continue;
        subtrees[subtrees.length - 1].push(el);
      }
      return subtrees.map(branchSurfaceRoot);
    })
    .filter((roots) => roots.length > 0);
}

for (const file of [
  'src/operator/present/PresenterOperator.tsx',
  'src/operator/present/SlideGridDialog.tsx',
]) {
  test(`AC-3: ${file} pins its own dark surface on every branch it renders`, () => {
    const branches = jsxReturnBranches(read(file));
    assert.ok(branches.length > 0, `${file} renders no JSX branch`);

    for (const outermost of branches.flat().map((root) => classNameValues(root)[0])) {
      assert.ok(outermost !== undefined, `${file} has a render branch with no classed element`);
      assert.ok(
        carriesDark(outermost),
        `${file} renders dark regardless of the operator's chosen theme, and ` +
          `the root of each branch it renders is where that is declared. Story ` +
          `17.1 does not remove either wrapper; the presenter is used in a dim ` +
          `sanctuary and does not participate in the choice. Branch root ` +
          `className: ${outermost}`
      );
    }
  });
}

// --- AC-1, AC-2, AC-5: the choice is mounted, and mounted in one place ------

test('AC-1/AC-2: the operator shell mounts the theme provider', () => {
  const app = read('spa/src/App.tsx');

  assert.match(
    app,
    /<ThemeProvider>[\s\S]*\{routes\}[\s\S]*<\/ThemeProvider>/,
    'operator routes must render inside ThemeProvider, or useTheme() resolves to nothing'
  );
  assert.match(
    read('src/components/ThemeProvider.tsx'),
    /from 'next-themes'/,
    'next-themes writes the class onto <html>; the provider is the theme boundary'
  );
  assert.doesNotMatch(
    read('spa/src/main.tsx'),
    /ThemeProvider/,
    'main.tsx must not wrap the projected document in the operator theme provider'
  );
});

// Story 17.3 — browser tab/bookmark name the product, not create-next-app.
test('Story 17.3: root metadata names WorshipDeck, not create-next-app boilerplate', () => {
  for (const file of ['spa/index.html', 'spa/projected.html']) {
    const html = read(file);
    assert.doesNotMatch(
      html,
      /Create Next App/,
      `${file} must not carry the create-next-app boilerplate title`
    );
    assert.doesNotMatch(
      html,
      /Generated by create next app/,
      `${file} must not carry the create-next-app boilerplate description`
    );
    assert.match(
      html,
      /<title>WorshipDeck<\/title>/,
      `${file} title must be the product-owned name from design-system.md frontmatter`
    );
  }
});

test('AC-1/AC-2: the provider is a client component with system default', () => {
  const provider = read('src/components/ThemeProvider.tsx');

  assert.match(provider, /from 'next-themes'/, 'next-themes is the theme library');
  assert.match(provider, /attribute="class"/, 'the palette is keyed on `.dark`');
  assert.match(provider, /defaultTheme="system"/, 'AC-2: first visit follows the OS');
  assert.match(provider, /enableSystem/, 'AC-2: first visit follows the OS');
});

test('AC-1: the choice persists, because nothing switches persistence off', () => {
  // AC-1's "survives a reload and a new tab" is next-themes writing
  // `localStorage.theme` and syncing on the `storage` event; that was verified
  // in the browser and is recorded in the story's Debug Log. What a source test
  // can hold is that this app still uses the API which provides it — the clause
  // had no net of any kind before.
  const provider = read('src/components/ThemeProvider.tsx');
  assert.doesNotMatch(
    provider,
    /forcedTheme/,
    '`forcedTheme` pins the theme and makes the control inert — AC-1 requires ' +
      'the operator choice to be the thing that wins'
  );
  assert.doesNotMatch(
    provider,
    /storageKey\s*=\s*\{?(?:undefined|null|""|'')/,
    'clearing the storage key is how the choice stops surviving a reload'
  );
  assert.match(
    read('src/components/ThemeToggle.tsx'),
    /setTheme\(/,
    'the control must write through next-themes (which persists), not toggle ' +
      'the `.dark` class by hand'
  );
});

test('AC-1: the theme flip does not animate the whole shell', () => {
  // `header-chrome` puts `transition-all` on every nav pill, and the profile
  // button, logo tile, dropdown items and every `buttonVariants` control carry
  // it too. Without the flag a flip smears the shell through an intermediate
  // palette instead of repainting.
  assert.match(
    read('src/components/ThemeProvider.tsx'),
    /disableTransitionOnChange/,
    'next-themes ships this for exactly the transition-all shell this app has'
  );
});

test('AC-5: sonner reads the theme, and the provider sits above it', () => {
  // Mount is operator-shell only: `<Toaster />` lives inside ThemeProvider in
  // the SPA, and `toast(` is the combined inline+toast channel (17-9).
  assert.match(
    read('src/components/ui/sonner.tsx'),
    /useTheme\(\)/,
    'sonner already reads the theme; the provider is what gives it a value'
  );
  assert.doesNotMatch(
    read('src/components/ui/sonner.tsx'),
    /ThemeProvider/,
    'sonner must not mount its own provider — one provider, at the root'
  );
  const app = read('spa/src/App.tsx');
  assert.match(
    app,
    /<ThemeProvider>/,
    'the provider is above sonner because it is above operator chrome'
  );
  assert.match(
    app,
    /<Toaster \/>/,
    'Toaster mounts once on the operator shell, not per page'
  );
  const block = /if \(projected\) \{[\s\S]*?\n  \}/.exec(app);
  assert.ok(block, 'App.tsx must branch projected routes away from the operator shell');
  assert.doesNotMatch(block[0], /Toaster/, 'projected branch must not mount Toaster');
  assert.match(
    read('src/operator/admin/RetentionSettings.tsx') +
      read('src/components/admin/ArtifactEditor.tsx'),
    /toast\(/,
    'the confirmation channel has at least one toast( call site'
  );
});

// --- AC-1: the control is reachable, labelled, and adds no dependency -------

test('AC-1: the theme control lives in the shared header', () => {
  const header = read('src/components/Header.tsx');
  assert.match(
    header,
    /^import ThemeToggle from '\.\/ThemeToggle';$/m,
    'the control belongs in Epic 13.2 shared chrome'
  );
  assert.match(
    header,
    /<ThemeToggle\s*\/>/,
    'imported and not rendered is the same as absent — and a commented-out ' +
      'import satisfied the previous form of this assertion'
  );
});

test('AC-1: the control is a labelled button and introduces no new dependency', () => {
  const toggle = read('src/components/ThemeToggle.tsx');

  assert.match(toggle, /aria-label=|<span className="sr-only">/, 'the control must be labelled');
  assert.match(
    toggle,
    /useTheme\(\)/,
    'the control reads and writes the theme through next-themes'
  );

  // Both quote styles, and scoped packages. The previous character class
  // excluded `@`, so `import x from '@radix-ui/react-dropdown-menu'` — a
  // dropdown primitive, in the one file where one would plausibly be added —
  // was invisible to it, as was any double-quoted import.
  const external = [...toggle.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((s) => !s.startsWith('.') && !s.startsWith('@/'))
    .filter((s) => !['react', 'next-themes', 'lucide-react'].includes(s));
  assert.deepEqual(
    external,
    [],
    `no new theming dependency: unexpected imports ${external.join(', ')}`
  );
});

const HEADER_CHROME = 'src/components/header-chrome.ts';

test('AC-1: the control wears the shared header box rather than a copy of it', () => {
  // It used to restate the seven classes of `getLinkClass`'s inactive branch.
  // The test pinned two of them, so a restyle of the pills drifted the toggle
  // silently — the precise failure the control cannot have, since matching its
  // siblings is the point of the shape. Both now read the same constant.
  const toggle = read('src/components/ThemeToggle.tsx');
  const header = read('src/components/Header.tsx');
  const chrome = read(HEADER_CHROME);

  assert.match(toggle, /HEADER_CONTROL_BOX/, 'the toggle takes the shared box');
  assert.match(header, /header-chrome/, 'the pills take it too, or there is nothing shared');
  assert.match(chrome, /cursor-pointer/, 'the toggle was the only control in the row without one');
});

test('AC-1: no control in the header row restates the resting box', () => {
  // The previous guard asserted only that `Header.tsx` and `ThemeToggle.tsx`
  // *mention* `HEADER_CONTROL_BOX`/`header-chrome`, so the third copy — the
  // profile dropdown trigger at `Header.tsx:120`, on the same row — was
  // unguarded, and `header-chrome.ts`'s own doc generalised over all three while
  // one still hand-rolled it. Round-2 item P19(b)'s root cause was "a
  // hand-reproduced box drifts the moment someone restyles the nav pills"; two of
  // three copies were closed and the sentence covered the third.
  //
  // The subject is every element ON THAT ROW, reached by walking to the toggle's
  // parent — not a list of files and not a list of controls. A fourth control
  // added beside the profile button is covered because it is on the row.
  //
  // Deliberately NOT swept over all of `src/`: the same three classes are the
  // app's generic secondary-button surface, and
  // `AnnouncementsManager.tsx:275`'s *Replace All…* is one — a page action
  // button in a `active:scale-[0.98] duration-200` family, not header chrome, so
  // pointing it at a constant documented as "the shared header row" would be
  // wrong. Filed as its own concern rather than absorbed here.
  const header = read('src/components/Header.tsx');
  const row = enclosingTag(header, '<ThemeToggle');
  const offenders = [];
  for (const { tag, stack } of jsxTags(header)) {
    if (!stack.some((e) => e.tag === row)) continue;
    for (const value of classNameValues(tag)) {
      const states = (utility) => new RegExp(`(?<![-\\w:])${utility}(?![-\\w/])`).test(value);
      if (states('rounded-xl') && states('border-border') && states('bg-card/50')) {
        offenders.push(`${tag.slice(0, 40)}… : ${value.slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a control on the shared header row states the resting box from ` +
      `\`${HEADER_CHROME}\` by hand, so a restyle of the nav pills will drift ` +
      `past it. Import \`HEADER_CONTROL_BOX\` (box plus the muted tone) or ` +
      `\`HEADER_CONTROL_BOX_BASE\` (box only, for a control with its own tone). ` +
      `Found: ${offenders.join(' | ')}`
  );
});

test('AC-1: the theme control is not inside the navigation landmark', () => {
  // A settings control in `<nav>` is announced as navigation.
  const header = read('src/components/Header.tsx');
  const nav = header.slice(header.indexOf('<nav'), header.indexOf('</nav>'));
  assert.doesNotMatch(nav, /<ThemeToggle/, 'the toggle belongs beside the nav, not in it');
});

test('AC-1: the row carrying the controls can wrap', () => {
  // Asserted on the element that actually holds them, found by walking to the
  // toggle's parent. The previous form sliced `<nav>…</nav>` and matched
  // `flex-wrap` there — and both the outer row and the nav carry it, so it
  // passed on the wrong one. Deleting `flex-wrap` from the row stayed green
  // while the row stopped wrapping, which is the row the comment at
  // `Header.tsx:74-78` names: an admin already carries four pills plus the
  // profile button, and the toggle made it six controls.
  const header = read('src/components/Header.tsx');
  const row = enclosingTag(header, '<ThemeToggle');
  assert.match(
    row,
    /flex-wrap/,
    `the row holding the header controls must be able to wrap — an admin carries ` +
      `six of them. Found on the toggle's parent: ${row}`
  );
});

/** The pre-mount branch, as code. */
function mountGuardBranch() {
  const toggle = read('src/components/ThemeToggle.tsx');
  const at = toggle.search(/if \(!\s*mounted\s*\)\s*\{/);
  assert.ok(
    at !== -1,
    'guard the theme-dependent render behind a mounted flag. The previous form ' +
      'of this assertion matched the word `mounted` anywhere in the file, and ' +
      'the word sat in the comment explaining the guard — so it could not fail ' +
      'while that comment survived.'
  );
  return balancedBlock(toggle, at);
}

test('AC-1: the control renders nothing theme-dependent before mount', () => {
  // next-themes cannot know the resolved theme during SSR. A control that
  // renders its state anyway flips after hydration, which reads as a bug on
  // the one surface whose whole job is to report state.
  const toggle = read('src/components/ThemeToggle.tsx');
  assert.match(
    toggle,
    /useSyncExternalStore\(/,
    'the flag comes from a store with a server snapshot, not from setState in ' +
      'an effect (which React 19 rejects here)'
  );
  mountGuardBranch();
});

test('AC-1: the pre-mount placeholder is focusable, inert and claims no state', () => {
  const guard = mountGuardBranch();

  assert.match(
    guard,
    /focusableWhenDisabled/,
    'a natively `disabled` placeholder leaves the tab order until hydration — ' +
      'so focus order shifts, the opposite of what the guard is for — and ' +
      '`disabled:opacity-50` steps the box from 50% to 100% as it lands. Base ' +
      "UI's `focusableWhenDisabled` emits `aria-disabled` and keeps tabIndex 0."
  );
  assert.match(
    guard,
    /aria-disabled:pointer-events-none/,
    'the same missing native `disabled` means Tailwind\'s `disabled:` variant ' +
      'never fires, so `disabled:pointer-events-none` from buttonVariants does ' +
      'not apply and the placeholder keeps `hover:bg-card` — lighting up under ' +
      'the cursor while inert. Its own comment: it must not LOOK interactive.'
  );
  for (const stateIcon of ['SunIcon', 'MoonIcon', 'MonitorIcon']) {
    assert.doesNotMatch(
      guard,
      new RegExp(`<${stateIcon}\\b`),
      `the placeholder must not render a state icon. \`MonitorIcon\` IS the ` +
        `\`system\` icon, and next-themes seeds \`theme\` from localStorage ` +
        `inside \`useState\` — so on the hydration render the choice is already ` +
        `known while \`mounted\` is still the server's \`false\`. Every operator ` +
        `who had picked light or dark watched the control claim \`system\` and ` +
        `then correct itself: the guard caused the flip it exists to prevent.`
    );
  }
  assert.match(guard, /<[A-Z][A-Za-z]*Icon\b/, 'the placeholder still shows something');
});

test('AC-1: the control resolves to the same box as its sibling header controls', () => {
  const outlineVariant = read('src/components/ui/button.tsx');
  const toggle = read('src/components/ThemeToggle.tsx');

  // `outline` carries `dark:border-input dark:bg-input/30 dark:hover:bg-input/50`.
  // `tailwind-merge` does not treat a `dark:`-prefixed class as conflicting with
  // an unprefixed one, so an unprefixed call-site override does not displace
  // them, and `:is(.dark *)` out-specifies it. Header's nav pills carry no
  // `dark:` variants at all, so without an explicit dark half the toggle drifts
  // from its siblings in exactly the mode this story exists to enable —
  // `input/30` (#151515 over `--background`) against `card/50` (#111111).
  if (/dark:bg-input/.test(outlineVariant)) {
    assert.match(
      toggle,
      /dark:bg-card\/50/,
      'the outline variant still ships a dark box override, so the call site ' +
        'must still neutralise it'
    );
    assert.match(toggle, /dark:border-border/, 'same for the border');
  }
});

// --- AC-1: the cycle, as behaviour ------------------------------------------

// `THEME_ORDER` / `nextTheme` / `asThemeChoice` are imported at the top of the
// file, for the same reason. See the note above the imports.

test('AC-1 behaviour: the cycle visits all three states and wraps', () => {
  // The modulo is where an off-by-one lives, and it shipped with no coverage of
  // any kind — it was inside a `.tsx` component, reachable only by a regex over
  // that component's own text.
  assert.deepEqual([...THEME_ORDER], ['system', 'light', 'dark']);
  assert.equal(nextTheme('system'), 'light');
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'system', 'the cycle must return to system');

  const visited = new Set();
  let current = 'system';
  for (let i = 0; i < THEME_ORDER.length; i += 1) {
    visited.add(current);
    current = nextTheme(current);
  }
  assert.equal(visited.size, THEME_ORDER.length, 'every state is reachable by pressing');
  assert.equal(current, 'system', 'and the walk closes');
});

test('AC-1 behaviour: an unrecognised stored value reads as system', () => {
  // next-themes applies a hand-edited `localStorage.theme` as the class without
  // validating it. The control must not then claim a state that does not exist.
  assert.equal(asThemeChoice('blue'), 'system');
  assert.equal(asThemeChoice(undefined), 'system');
  assert.equal(asThemeChoice('dark'), 'dark');
});

// --- Story 17.2: light `muted-foreground` must clear WCAG AA on every host ---

const WCAG_AA_NORMAL_TEXT = 4.5;
/** `bg-primary/5` ambient glow — six operator routes, worst recorded light host. */
const AMBIENT_GLOW_ALPHA = 0.05;

/**
 * Achromatic `oklch(L 0 0)` → nearest 8-bit sRGB, via CSS Color 4 OKLab → linear
 * sRGB → transfer function. Matches the canvas byte comparison in design-system.md.
 */
function oklchAchromaticToSrgb8(L) {
  const cube = L ** 3;
  const linear = [cube, cube, cube];
  const toSrgb = (c) =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return linear.map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255));
}

function compositeOverSrgb8(fg, bg, alpha) {
  return fg.map((channel, i) =>
    Math.round(channel * alpha + bg[i] * (1 - alpha))
  );
}

function relativeLuminanceSrgb8([r, g, b]) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [channel(r), channel(g), channel(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatioSrgb8(fg, bg) {
  const l1 = relativeLuminanceSrgb8(fg);
  const l2 = relativeLuminanceSrgb8(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function tokenDeclarations(css, blockSelector) {
  const blocks = [
    ...css.matchAll(
      blockSelector === ':root'
        ? /:root\s*\{([^}]*)\}/g
        : /\.dark\s*\{([^}]*)\}/g
    ),
  ];
  assert.equal(
    blocks.length,
    1,
    `expected exactly one ${blockSelector} token block in globals.css`
  );
  return Object.fromEntries(
    [...blocks[0][1].matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [
      name,
      value.trim(),
    ])
  );
}

function parseAchromaticOklchBlock(css, blockSelector, varName) {
  const value = tokenDeclarations(css, blockSelector)[`--${varName}`];
  const match = value?.match(/^oklch\(([\d.]+)\s+0\s+0\)$/);
  assert.ok(
    match,
    `expected achromatic --${varName} in ${blockSelector} (oklch(L 0 0))`
  );
  return Number(match[1]);
}

function lightMutedForegroundHosts(css) {
  const background = oklchAchromaticToSrgb8(parseAchromaticOklchBlock(css, ':root', 'background'));
  const muted = oklchAchromaticToSrgb8(parseAchromaticOklchBlock(css, ':root', 'muted'));
  const primary = oklchAchromaticToSrgb8(parseAchromaticOklchBlock(css, ':root', 'primary'));
  const ambientGlow = compositeOverSrgb8(primary, background, AMBIENT_GLOW_ALPHA);
  const mutedForeground = oklchAchromaticToSrgb8(
    parseAchromaticOklchBlock(css, ':root', 'muted-foreground')
  );
  return {
    mutedForeground,
    surfaces: [
      ['background', background],
      ['muted', muted],
      ['ambient glow (bg-primary/5)', ambientGlow],
    ],
  };
}

test('Story 17.2: light muted-foreground clears WCAG AA on every recorded host surface', () => {
  const css = readRaw(GLOBALS_CSS);
  const { mutedForeground, surfaces } = lightMutedForegroundHosts(css);
  for (const [name, surface] of surfaces) {
    const ratio = contrastRatioSrgb8(mutedForeground, surface);
    assert.ok(
      ratio >= WCAG_AA_NORMAL_TEXT,
      `light --muted-foreground on ${name} must be >= ${WCAG_AA_NORMAL_TEXT}:1 ` +
        `(measured ${ratio.toFixed(4)}:1 from globals.css tokens via OKLab→sRGB)`
    );
  }
});

test('Story 17.2: dark muted-foreground token and its passing pairs are unchanged', () => {
  const css = readRaw(GLOBALS_CSS);
  const darkL = parseAchromaticOklchBlock(css, '.dark', 'muted-foreground');
  assert.equal(
    darkL,
    0.708,
    'Story 17.2 adjusts :root alone; .dark --muted-foreground must stay oklch(0.708 0 0)'
  );
  const darkFg = oklchAchromaticToSrgb8(darkL);
  const darkBg = oklchAchromaticToSrgb8(parseAchromaticOklchBlock(css, '.dark', 'background'));
  const darkMuted = oklchAchromaticToSrgb8(parseAchromaticOklchBlock(css, '.dark', 'muted'));
  const onBackground = contrastRatioSrgb8(darkFg, darkBg);
  const onMuted = contrastRatioSrgb8(darkFg, darkMuted);
  assert.ok(
    onBackground >= 7.66,
    `dark muted-foreground on background must stay >= 7.66:1 (measured ${onBackground.toFixed(2)}:1)`
  );
  assert.ok(
    onMuted >= 5.855,
    `dark muted-foreground on muted must stay >= 5.86:1 (measured ${onMuted.toFixed(2)}:1)`
  );
});

const ROOT_TOKENS_UNCHANGED_BY_17_2 = {
  '--font-geist-mono': '"Geist Mono", ui-monospace, monospace',
  '--font-geist-sans': '"Geist Sans", ui-sans-serif, system-ui, sans-serif',
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.145 0 0)',
  '--primary': 'oklch(0.205 0 0)',
  '--primary-foreground': 'oklch(0.985 0 0)',
  '--secondary': 'oklch(0.97 0 0)',
  '--secondary-foreground': 'oklch(0.205 0 0)',
  '--muted': 'oklch(0.97 0 0)',
  '--accent': 'oklch(0.97 0 0)',
  '--accent-foreground': 'oklch(0.205 0 0)',
  '--destructive': 'oklch(0.577 0.245 27.325)',
  '--border': 'oklch(0.922 0 0)',
  '--input': 'oklch(0.922 0 0)',
  '--ring': 'oklch(0.708 0 0)',
  '--chart-1': 'oklch(0.87 0 0)',
  '--chart-2': 'oklch(0.556 0 0)',
  '--chart-3': 'oklch(0.439 0 0)',
  '--chart-4': 'oklch(0.371 0 0)',
  '--chart-5': 'oklch(0.269 0 0)',
  '--radius': '0.625rem',
  '--sidebar': 'oklch(0.985 0 0)',
  '--sidebar-foreground': 'oklch(0.145 0 0)',
  '--sidebar-primary': 'oklch(0.205 0 0)',
  '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
  '--sidebar-accent': 'oklch(0.97 0 0)',
  '--sidebar-accent-foreground': 'oklch(0.205 0 0)',
  '--sidebar-border': 'oklch(0.922 0 0)',
  '--sidebar-ring': 'oklch(0.708 0 0)',
};

const DARK_TOKENS_UNCHANGED_BY_17_2 = {
  '--background': 'oklch(0.145 0 0)',
  '--foreground': 'oklch(0.985 0 0)',
  '--card': 'oklch(0.205 0 0)',
  '--card-foreground': 'oklch(0.985 0 0)',
  '--popover': 'oklch(0.205 0 0)',
  '--popover-foreground': 'oklch(0.985 0 0)',
  '--primary': 'oklch(0.922 0 0)',
  '--primary-foreground': 'oklch(0.205 0 0)',
  '--secondary': 'oklch(0.269 0 0)',
  '--secondary-foreground': 'oklch(0.985 0 0)',
  '--muted': 'oklch(0.269 0 0)',
  '--muted-foreground': 'oklch(0.708 0 0)',
  '--accent': 'oklch(0.269 0 0)',
  '--accent-foreground': 'oklch(0.985 0 0)',
  '--destructive': 'oklch(0.704 0.191 22.216)',
  '--border': 'oklch(1 0 0 / 10%)',
  '--input': 'oklch(1 0 0 / 15%)',
  '--ring': 'oklch(0.556 0 0)',
  '--chart-1': 'oklch(0.87 0 0)',
  '--chart-2': 'oklch(0.556 0 0)',
  '--chart-3': 'oklch(0.439 0 0)',
  '--chart-4': 'oklch(0.371 0 0)',
  '--chart-5': 'oklch(0.269 0 0)',
  '--sidebar': 'oklch(0.205 0 0)',
  '--sidebar-foreground': 'oklch(0.985 0 0)',
  '--sidebar-primary': 'oklch(0.488 0.243 264.376)',
  '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
  '--sidebar-accent': 'oklch(0.269 0 0)',
  '--sidebar-accent-foreground': 'oklch(0.985 0 0)',
  '--sidebar-border': 'oklch(1 0 0 / 10%)',
  '--sidebar-ring': 'oklch(0.556 0 0)',
};

test('Story 17.2: only the light muted-foreground token moves — other root and dark tokens stay put', () => {
  const css = readRaw(GLOBALS_CSS);
  const root = tokenDeclarations(css, ':root');
  const { '--muted-foreground': mutedForeground, ...unaffectedRoot } = root;
  assert.deepEqual(unaffectedRoot, ROOT_TOKENS_UNCHANGED_BY_17_2);
  assert.deepEqual(tokenDeclarations(css, '.dark'), DARK_TOKENS_UNCHANGED_BY_17_2);
  assert.notEqual(
    mutedForeground,
    'oklch(0.556 0 0)',
    'the pre-story oklch(0.556 0 0) value fails on muted and ambient glow and must not return'
  );
});

// --- AC-6: the measurements, and the shades that needed them ----------------

const DESIGN_MD = '.how/_platform/design-system.md';

test('AC-6: the four load-bearing dark pairs are recorded in DESIGN.md as measurements', () => {
  // The test that carried this label asserted only that `dark:text-{hue}-`
  // appeared in `TONE_CLASS` — badge shades DESIGN.md itself classifies as "not
  // a palette token pair". Nothing pinned the four pairs AC-6 names, and nothing
  // pinned the recording, which is the half of AC-6 that says "as a measurement,
  // not an estimate".
  // Scoped to the DARK table. Matching the whole document passed with the dark
  // figure deleted, because the light table carries the same four pair names —
  // negative-testing caught that, and AC-6 is specifically about the palette
  // that had never been measured on any pair.
  const whole = readRaw(DESIGN_MD);
  const from = whole.indexOf('The same four pairs in the dark palette');
  assert.notEqual(from, -1, 'DESIGN.md must carry the dark-palette measurement table');
  const nextHeading = whole.slice(from).search(/\n#{1,4} /);
  const design = whole.slice(from, nextHeading === -1 ? whole.length : from + nextHeading);

  const pairs = [
    ['foreground', 'background'],
    ['primary-foreground', 'primary'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'muted'],
  ];
  for (const [fg, bg] of pairs) {
    const row = new RegExp(
      `\`(?:--)?${fg}\`[^\\n]*\`(?:--)?${bg}\`[^\\n]*\\d+\\.\\d+\\s*:\\s*1`,
      'i'
    );
    assert.match(
      design,
      row,
      `AC-6 requires \`${fg}\` on \`${bg}\` measured and recorded in DESIGN.md ` +
        `with its ratio. A pair with no number beside it is the estimate AC-6 ` +
        `exists to replace.`
    );
  }
});

/**
 * Every string / template literal body in the source, as a candidate class list —
 * with a template's own text and each of its `${…}` expressions returned as
 * SEPARATE values.
 *
 * The split is the point, and it is what makes the sweep below per-site. A
 * className here is routinely a template with a ternary in it, and this used to
 * return the whole template as one value — so the pairing lookup found a `dark:`
 * half in one arm and counted it for the other. Live shape, at
 * `AnnouncementsManager.tsx:340-344`: give the false arm a bare
 * `text-emerald-800` and it rode on the true arm's `dark:text-emerald-200` at
 * 47/47 green. The source already writes each arm as its own literal; this reads
 * what is there instead of flattening it.
 */
function classValues(source) {
  const out = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'") {
      const end = pastString(source, i);
      out.push({ value: source.slice(i + 1, Math.max(i + 1, end - 1)), at: i });
      i = end;
      continue;
    }
    if (c === '`') {
      const end = pastString(source, i);
      const inner = source.slice(i + 1, Math.max(i + 1, end - 1));
      let text = '';
      let j = 0;
      while (j < inner.length) {
        if (inner[j] === '$' && inner[j + 1] === '{') {
          let depth = 0;
          let k = j + 1;
          while (k < inner.length) {
            const d = inner[k];
            if (d === '"' || d === "'" || d === '`') {
              k = pastString(inner, k);
              continue;
            }
            if (d === '{') depth += 1;
            else if (d === '}') {
              depth -= 1;
              if (depth === 0) break;
            }
            k += 1;
          }
          for (const nested of classValues(inner.slice(j + 2, k))) {
            out.push({ value: nested.value, at: i + 1 + j + 2 + nested.at });
          }
          j = k + 1;
          continue;
        }
        text += inner[j];
        j += 1;
      }
      out.push({ value: text, at: i });
      i = end;
      continue;
    }
    i += 1;
  }
  return out;
}

/** Tailwind's chromatic scales — the ones that read differently on white and near-black. */
const CHROMATIC_HUES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
/**
 * A chromatic text shade that is NOT itself a `dark:` half.
 *
 * The lookbehind was `(?<![-\w:])`, and the `:` in it was there to skip
 * `dark:text-emerald-400`. It skipped every other variant with it — `hover:`,
 * `group-hover:`, `focus:`, `peer-focus:` and every breakpoint — so a shade
 * written `hover:text-emerald-600` with no dark half was 47/47 green while a bare
 * `text-emerald-600` failed. The exclusion now names `dark:` rather than
 * standing for it, and tolerates it anywhere in a stacked variant chain
 * (`sm:dark:hover:text-…`).
 */
const DARK_VARIANT_CHAIN = String.raw`dark:(?:[a-z0-9-]+:)*`;
const CHROMATIC_TEXT = new RegExp(
  `(?<![-\\w])(?<!${DARK_VARIANT_CHAIN})text-(${CHROMATIC_HUES})-(\\d{2,3})`,
  'g'
);

/**
 * The sites where a chromatic text shade states only one half of the pair, with
 * the reason and the story key that owns it.
 *
 * This list is the exception, and it is pinned exactly: an unlisted offender
 * fails, and so does an entry that has been fixed and not removed. That polarity
 * is the point. The guard it replaces was a hardcoded 4-file × 3-hue table, so
 * the *rule* was carried by the table — a `text-emerald-600` with no dark half in
 * any file outside it was 43/43 green, a second unfixed badge in an already-fixed
 * file passed on the first one's dark half (the match was file-wide), and the
 * `text-{hue}-[5-9]00` precondition walked past `-200`/`-300`/`-400` shades
 * entirely. Round-2 item P1's subject was "the sweep stops four sites short of
 * its own criterion" and it was closed by widening the list from one file to
 * four; this is the criterion.
 */
const UNPAIRED_CHROMATIC_TEXT = [
  // Pinned dark, so it cannot express itself in `dark:` variants at all: the
  // Presenter renders dark under either theme (AC-3), which is why
  // `presenter-model.ts:48-54` keeps a second tone table instead of adding dark
  // halves to the first. Not a defect and not deferred — the opposite surface.
  'src/operator/present/PresenterOperator.tsx: text-amber-300 [:583, pinned dark, AC-3]',
  'src/operator/present/PresenterOperator.tsx: text-amber-300 [:627, pinned dark, AC-3]',
  'src/operator/present/PresenterOperator.tsx: text-amber-300 [:709, pinned dark, AC-3]',
  'src/operator/present/PresenterOperator.tsx: text-amber-300 [:829, pinned dark, AC-3]',
  // The lost-sync line (Story 17.5, AC-5/AC-7): reuses the same pinned-dark
  // amber treatment as the four sites above rather than adding a new hue, so
  // this is the fifth site sharing one already-filed exception, not a new one.
  'src/operator/present/PresenterOperator.tsx: text-amber-300 [:604, pinned dark, AC-3/Story 17.5 AC-5]',
  'src/operator/present/PresenterOperator.tsx: text-amber-300 [pinned dark, Story 5-2 AC-7]',
  'src/operator/present/presenter-model.ts: text-amber-200 [PRESENTER_TONE_CLASS, pinned dark, AC-3]',
  'src/operator/present/presenter-model.ts: text-emerald-200 [PRESENTER_TONE_CLASS, pinned dark, AC-3]',
  'src/operator/present/presenter-model.ts: text-indigo-200 [PRESENTER_TONE_CLASS, pinned dark, AC-3]',
  'src/operator/present/presenter-model.ts: text-sky-200 [PRESENTER_TONE_CLASS, pinned dark, AC-3]',
];

test('AC-6: every chromatic text shade states both halves, or is a filed exception', () => {
  // `-600` shades were chosen against white; `-200`/`-300` shades were chosen
  // against near-black. Either alone is a shade that reads on one theme, in a
  // hub that now has two. At `text-[9px]` the 4.5:1 small-text floor applies and
  // emerald measured 4.23:1 on the dark card, indigo 2.54:1.
  //
  // Swept over every `.tsx` AND `.ts` under `src/`, per SITE rather than per
  // file — the tone tables that carry these live in `.ts` modules and a file-wide
  // match let a second unfixed badge ride on the first one's dark half.
  //
  // "Per site" was per class VALUE and that is not the same thing: `classValues`
  // returned a whole template literal, so a ternary's two arms shared one lookup
  // and the arm with no dark half of its own passed on its sibling's. The split
  // lives in `classValues` now, where the arms already are.
  const offenders = [];
  for (const file of [...allTsxFiles(), ...allTsFiles()]) {
    for (const { value } of classValues(read(file))) {
      for (const m of value.matchAll(CHROMATIC_TEXT)) {
        if (new RegExp(`${DARK_VARIANT_CHAIN}text-${m[1]}-`).test(value)) continue;
        offenders.push(`${file}: ${m[0]}`);
      }
    }
  }
  // Compared as sorted multisets, so a second unpaired site in a file that
  // already has one filed is a failure rather than a silent pass.
  assert.deepEqual(
    offenders.sort(),
    UNPAIRED_CHROMATIC_TEXT.map((e) => e.replace(/ \[[^\]]*\]$/, '')).sort(),
    `a chromatic text shade states one half of the pair. State both in the same ` +
      `class value — \`PRESENTER_TONE_CLASS\` (\`present/presenter-model.ts\`) ` +
      `already holds shades proven on a dark card — or add the site to ` +
      `UNPAIRED_CHROMATIC_TEXT with the story key that owns it. An entry that ` +
      `has been fixed must be removed: this list is pinned in both directions ` +
      `so it cannot quietly become the rule.`
  );
});

test('AC-6: the hand-rolled red pair is the destructive token, so it says so', () => {
  // `--color-red-600` is `oklch(57.7% 0.245 27.325)` and `:root --destructive`
  // is `oklch(0.577 0.245 27.325)`; `--color-red-400` and `.dark --destructive`
  // match the same way. A hand-rolled pair reproduces the token and then drifts
  // from it the moment the identity is retuned.
  for (const file of [
    'src/components/LogoutButton.tsx',
    'src/operator/DeleteButton.tsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /text-red-600/,
      `${file} should name \`text-destructive\`, which is the same colour in ` +
        `both themes and cannot drift from the destructive identity`
    );
  }
});
