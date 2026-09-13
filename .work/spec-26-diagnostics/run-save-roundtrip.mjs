/**
 * SPEC-26 diagnostic 8: does opening a template in the Canvas editor and
 * pressing Save — with no edit at all — change the stored geometry?
 * Targets `sermon`, whose e1 Fabric Textbox self-widens to fit the
 * `{sermon_title}` placeholder token.
 */
import {
  startBrowserEnvironment, stopBrowserEnvironment, loginViaUi,
  loginAndGetCookie, fetchRaw,
  DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS,
} from '../../tests/helpers/browser-harness.mjs';

const env = await startBrowserEnvironment({ dbName: 'spec26-save.db' });
try {
  const cookie = await loginAndGetCookie(env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);

  const readTpl = async () => {
    const res = await fetchRaw(`${env.baseUrl}/api/admin/artifacts/sermon`, { headers: { Cookie: cookie } });
    if (res.status !== 200) return { status: res.status, body: res.body.slice(0, 300) };
    const t = JSON.parse(res.body);
    const els = (t.layouts?.default?.elements) || (t.template?.layouts?.default?.elements);
    return els ? els.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h })) : { raw: res.body.slice(0, 400) };
  };

  const before = await readTpl();
  console.log('BEFORE save:', JSON.stringify(before));

  const page = await env.browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await loginViaUi(page, env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
  await page.goto(`${env.baseUrl}/admin/artifacts`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas.lower-canvas', { timeout: 30000 });

  const sermon = page.getByText('Sermon', { exact: true }).first();
  await sermon.click();
  await page.waitForTimeout(3000);

  const saveBtn = page.locator('button', { hasText: /^Save$/ }).first();
  await saveBtn.click();
  await page.waitForTimeout(3000);

  const after = await readTpl();
  console.log('AFTER  save:', JSON.stringify(after));

  if (Array.isArray(before) && Array.isArray(after)) {
    let drift = false;
    for (let i = 0; i < before.length; i++) {
      const b = before[i], a = after.find((x) => x.id === b.id);
      if (!a) { console.log(`  element ${b.id} DISAPPEARED`); drift = true; continue; }
      for (const k of ['x', 'y', 'w', 'h']) {
        if (Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 0.001) {
          console.log(`  *** ${b.id}.${k}: ${b[k]} -> ${a[k]}  (${(((a[k] - b[k]) / b[k]) * 100).toFixed(1)}%)`);
          drift = true;
        }
      }
    }
    console.log(drift ? '\n>>> SAVE-WITHOUT-EDIT MUTATES STORED GEOMETRY' : '\n>>> save without edit is a no-op (good)');
  }
  await page.close();
} finally {
  await stopBrowserEnvironment(env);
}
