/**
 * Automated Browser Acceptance Tests for FR-9: Live Slide Preview.
 *
 * Requirements from manual-acceptance-checklist.md:
 * - Confirm the Live Slide Preview shows a row per slide with a badge and a title.
 * - Confirm the badge reads `general`, `song-set-N`, or `ann-set-N` — and for a song-set child,
 *   its lyric role (`title`/`judul`, `verse 1`/`bait 1`, `reff`, etc.).
 * - Confirm children of a song-set display their lyric role, NOT the repeated song title.
 * - Fail looks like: a badge repeating the title; a badge showing an internal word like `song-lyric`;
 *   a literal `bait {n}` or `{n}`.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startBrowserEnvironment,
  stopBrowserEnvironment,
  loginViaUi,
  loginAndGetCookie,
  createServiceViaApi,
  createOperatorAccount,
  DEFAULT_ADMIN_USER,
  DEFAULT_ADMIN_PASS,
} from './helpers/browser-harness.mjs';

describe('FR-9: Live Slide Preview acceptance tests', () => {
  let env;
  let serviceId;
  let adminCookie;
  const operatorUser = 'operator_fr09';
  const operatorPass = 'op-pass-123';

  before(async () => {
    env = await startBrowserEnvironment({ dbName: 'test-fr09.db' });
    adminCookie = await loginAndGetCookie(env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);

    await createOperatorAccount(env.baseUrl, adminCookie, operatorUser, operatorPass);

    // Create a rich service with general items, song sets, and announcement set
    const rawRundown = `SABBATH, AUGUST 22, 2026
DIVINE SERVICE
Opening Prayer: Elder Name
Opening Song: SDAH #159
Scripture Reading: John 3:16
Pastoral Prayer: Pastor Name
Sermon: Speaker Name "The Blessed Hope"
Closing Song: SDAH #200
Benediction: Pastor Name

ANNOUNCEMENTS
1. Prayer Meeting on Wednesday 7 PM
2. Youth Fellowship on Sabbath 3 PM`;

    const svc = await createServiceViaApi(env.baseUrl, adminCookie, rawRundown);
    serviceId = svc.id;
  });

  after(async () => {
    await stopBrowserEnvironment(env);
  });

  test('live slide preview displays correct badges, group hierarchy, and lyric roles without repetitions', async () => {
    const { browser, baseUrl } = env;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginViaUi(page, baseUrl, operatorUser, operatorPass);

    // Open Service Run-Sheet / Edit view
    await page.goto(`${baseUrl}/services/${serviceId}`, { waitUntil: 'networkidle' });

    // Wait for the debounced preview calculation to complete and render slide #1
    const firstSlideIndex = page.locator('span:has-text("#1")');
    await firstSlideIndex.first().waitFor({ state: 'visible', timeout: 15000 });

    // Extract all badges rendered in the preview list
    const badgeElements = page.locator('.max-h-\\[600px\\] span.uppercase, .max-h-\\[calc\\(100vh-14rem\\)\\] span.uppercase');
    const badgeCount = await badgeElements.count();
    assert.ok(badgeCount > 0, 'Expected uppercase preview badges');

    const badges = [];
    for (let i = 0; i < badgeCount; i++) {
      const text = (await badgeElements.nth(i).textContent())?.trim();
      if (text) badges.push(text);
    }

    console.log('--- EXTRACTED PREVIEW BADGES:', badges);

    // 1. Invariant: Closed badge vocabulary
    // Allowed badges: general, song-set-N, ann-set-N, announcement, title/judul, verse N/bait N, reff, chorus, lyric
    const allowedBadgePattern = /^(general|song-set(-\d+)?|ann-set(-\d+)?|announcement|title|judul|verse\s*\d+|bait\s*\d+|reff|chorus|lyric)$/i;
    for (const badge of badges) {
      assert.match(
        badge,
        allowedBadgePattern,
        `Badge "${badge}" violates closed badge vocabulary specification (FR-9)`
      );

      // Invariant: MUST NOT show internal words like song-lyric or unresolved templates like {n}
      assert.doesNotMatch(badge, /song-lyric/i, `Badge "${badge}" leaked internal word "song-lyric"`);
      assert.doesNotMatch(badge, /\{n\}/i, `Badge "${badge}" contains un-interpolated template "{n}"`);
      assert.doesNotMatch(badge, /\{current\}/i, `Badge "${badge}" contains un-interpolated template "{current}"`);
    }

    // Every hymn in this fixture (SDAH 159, SDAH 200) has labeled verses and refrains, so no badge
    // in this fixture may be "lyric" (a "lyric" badge here means the role label was lost between the plan and preview).
    for (const badge of badges) {
      assert.notEqual(
        badge.toLowerCase(),
        'lyric',
        `Badge "${badge}" is fallback "lyric" — role label was lost between plan and preview for labeled hymn fixture`
      );
    }

    // 2. Invariant: At least one song-set group or song-set badge present
    const hasSongSetBadge = badges.some((b) => /song[- ]set/i.test(b));
    const hasLyricRoleBadge = badges.some((b) => /title|judul|verse|bait|reff|chorus|lyric/i.test(b));
    assert.ok(
      hasSongSetBadge || hasLyricRoleBadge,
      'Expected song-set or lyric role badges in the preview list'
    );

    // 3. Invariant: General slide badge present for standalone items
    const hasGeneralBadge = badges.some((b) => /general/i.test(b));
    assert.ok(hasGeneralBadge, 'Expected "general" badge for non-set slides');

    // 4. Invariant: Song set children must display distinct lyric stanzas / roles rather than repeating song title
    const songRows = page.locator('.border-l-2');
    const songGroupCount = await songRows.count();
    if (songGroupCount > 0) {
      const firstGroupChildren = songRows.first().locator('span.font-bold.text-xs');
      const childCount = await firstGroupChildren.count();
      if (childCount > 1) {
        const titles = [];
        for (let i = 0; i < childCount; i++) {
          titles.push((await firstGroupChildren.nth(i).textContent())?.trim());
        }
        console.log('--- SONG SET CHILD TITLES:', titles);
        // All titles should not be identical
        const uniqueTitles = new Set(titles.filter(Boolean));
        assert.ok(
          uniqueTitles.size > 1,
          'Song set children must display distinct lyric lines/roles, not identical repeated song title'
        );
      }
    }

    await context.close();
  });
});