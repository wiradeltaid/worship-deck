/**
 * SPEC-26 diagnostic 4 — the A/B the owner asked for.
 * Real app, real routes: screenshot the live Fabric stage in /admin/artifacts
 * and the live ArtifactSlide stage in /services/:id/slideshow for the SAME
 * template, rescale both to 960x540, and pixel-diff them.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  startBrowserEnvironment, stopBrowserEnvironment, loginViaUi,
  loginAndGetCookie, createServiceViaApi,
  DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS,
} from '../../tests/helpers/browser-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RUNDOWN = `SABBATH, AUGUST 22, 2026
DIVINE SERVICE
Opening Prayer: Elder Name
Opening Song: SDAH #159
Scripture Reading: John 3:16
Sermon: Speaker Name "The Blessed Hope"
Benediction: Pastor Name`;

const env = await startBrowserEnvironment({ dbName: 'spec26-ab.db' });
try {
  const cookie = await loginAndGetCookie(env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
  const svc = await createServiceViaApi(env.baseUrl, cookie, RUNDOWN);
  console.log('service id', svc.id);

  // ---------- A: Canvas Editor ----------
  const admin = await env.browser.newPage({ viewport: { width: 1600, height: 1000 } });
  admin.on('pageerror', (e) => console.log('[admin pageerror]', e.message));
  await loginViaUi(admin, env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
  await admin.goto(`${env.baseUrl}/admin/artifacts`, { waitUntil: 'domcontentloaded' });
  await admin.waitForSelector('canvas.lower-canvas', { timeout: 30000 });
  await admin.waitForTimeout(1500);

  const selected = await admin.evaluate(() => {
    const active = document.querySelector('[aria-current="true"], [data-active="true"]');
    return {
      title: document.title,
      activeText: active ? active.textContent.trim().slice(0, 60) : null,
      buttons: Array.prototype.slice.call(document.querySelectorAll('button'))
        .map((b) => b.textContent.trim()).filter(Boolean).slice(0, 40),
    };
  });
  console.log('editor list sample:', JSON.stringify(selected.buttons.slice(0, 15)));

  // pick the Welcome template explicitly
  const welcomeBtn = admin.locator('button', { hasText: /^Welcome$/i }).first();
  if (await welcomeBtn.count()) {
    await welcomeBtn.click();
    await admin.waitForTimeout(2500);
  } else {
    console.log('!! no exact "Welcome" button found; using whatever is selected');
  }

  const editorGeom = await admin.evaluate(() => {
    const lower = document.querySelector('canvas.lower-canvas');
    const wrapper = lower.closest('.canvas-container');
    const wr = wrapper.getBoundingClientRect();
    return { x: wr.x, y: wr.y, w: wr.width, h: wr.height };
  });
  console.log('editor stage rect', JSON.stringify(editorGeom));
  await admin.screenshot({
    path: path.join(__dirname, 'ab-editor.png'),
    clip: { x: editorGeom.x, y: editorGeom.y, width: editorGeom.w, height: editorGeom.h },
  });
  await admin.screenshot({ path: path.join(__dirname, 'ab-editor-full.png') });

  // ---------- B: Slideshow (ArtifactSlide) ----------
  const show = await env.browser.newPage({ viewport: { width: 1600, height: 900 } });
  show.on('pageerror', (e) => console.log('[slideshow pageerror]', e.message));
  await loginViaUi(show, env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
  await show.goto(`${env.baseUrl}/services/${svc.id}/slideshow`, { waitUntil: 'domcontentloaded' });
  await show.waitForTimeout(4000);

  const stageGeom = await show.evaluate(() => {
    const cands = Array.prototype.slice.call(document.querySelectorAll('div'))
      .filter((d) => d.style && d.style.aspectRatio && d.style.aspectRatio.replace(/\s/g, '') === '16/9');
    if (!cands.length) return { error: 'no 16/9 stage found', html: document.body.innerHTML.slice(0, 800) };
    const r = cands[0].getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, count: cands.length };
  });
  console.log('slideshow stage rect', JSON.stringify(stageGeom));
  if (!stageGeom.error) {
    await show.screenshot({
      path: path.join(__dirname, 'ab-slideshow.png'),
      clip: { x: stageGeom.x, y: stageGeom.y, width: stageGeom.w, height: stageGeom.h },
    });
  }
  await show.screenshot({ path: path.join(__dirname, 'ab-slideshow-full.png') });
} finally {
  await stopBrowserEnvironment(env);
}
