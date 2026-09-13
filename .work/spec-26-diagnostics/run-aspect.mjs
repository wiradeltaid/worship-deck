/**
 * SPEC-26 diagnostic 6: the owner's actual checklist.
 * Real /slideshow, /present/projector and /present routes at ultra-wide,
 * square and portrait viewports. Measures the 16:9 stage, the letterbox bars,
 * and whether any element box escapes the stage.
 */
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

const VIEWPORTS = [
  { label: 'exact 16:9      1600x900', width: 1600, height: 900 },
  { label: 'ultra-wide 21:9 2560x1080', width: 2560, height: 1080 },
  { label: 'very wide       1920x600', width: 1920, height: 600 },
  { label: 'square          1000x1000', width: 1000, height: 1000 },
  { label: 'portrait        1080x1920', width: 1080, height: 1920 },
];

const env = await startBrowserEnvironment({ dbName: 'spec26-aspect.db' });
try {
  const cookie = await loginAndGetCookie(env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
  const svc = await createServiceViaApi(env.baseUrl, cookie, RUNDOWN);

  for (const route of [
    { name: 'slideshow', url: (id) => `/services/${id}/slideshow` },
    { name: 'projector', url: (id) => `/services/${id}/present/projector` },
  ]) {
    console.log(`\n================ ROUTE ${route.name} ================`);
    for (const vp of VIEWPORTS) {
      const page = await env.browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
      await loginViaUi(page, env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
      await page.goto(`${env.baseUrl}${route.url(svc.id)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3500);

      const m = await page.evaluate(() => {
        const stages = Array.prototype.slice.call(document.querySelectorAll('div'))
          .filter((d) => d.style && d.style.aspectRatio && d.style.aspectRatio.replace(/\s/g, '') === '16/9');
        if (!stages.length) return { error: 'no 16/9 stage element found' };
        // the largest one is the projected stage
        stages.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
        const stage = stages[0];
        const sr = stage.getBoundingClientRect();
        const inner = stage.firstElementChild;
        const ir = inner ? inner.getBoundingClientRect() : null;
        const boxes = inner ? Array.prototype.slice.call(inner.children).map((el) => {
          const r = el.getBoundingClientRect();
          const content = el.firstElementChild;
          return {
            text: (el.textContent || '').slice(0, 34),
            left: r.left - ir.left, top: r.top - ir.top, w: r.width, h: r.height,
            scrollH: content ? content.scrollHeight : null,
            clientH: el.clientHeight,
            fitScale: content ? content.style.getPropertyValue('--artifact-fit-scale') : null,
            fontPx: content ? getComputedStyle(content).fontSize : null,
          };
        }) : [];
        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          stage: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
          inner: ir ? { w: ir.width, h: ir.height } : null,
          boxes,
        };
      });

      if (m.error) { console.log(`  ${vp.label}: ${m.error}`); await page.close(); continue; }
      const ratio = m.stage.w / m.stage.h;
      const pillar = (m.viewport.w - m.stage.w) / 2;
      const letter = (m.viewport.h - m.stage.h) / 2;
      const bad = Math.abs(ratio - 16 / 9) > 0.01;
      console.log(`  ${vp.label}`);
      console.log(`     stage ${m.stage.w.toFixed(1)}x${m.stage.h.toFixed(1)} ratio ${ratio.toFixed(4)} ${bad ? '*** NOT 16:9 ***' : 'ok'}`);
      console.log(`     bars: left/right ${pillar.toFixed(1)}px, top/bottom ${letter.toFixed(1)}px` +
        (m.stage.w > m.viewport.w + 0.5 || m.stage.h > m.viewport.h + 0.5 ? '   *** STAGE OVERFLOWS VIEWPORT ***' : ''));
      for (const b of m.boxes) {
        const escapes = b.left < -0.5 || b.top < -0.5 ||
          b.left + b.w > m.inner.w + 0.5 || b.top + b.h > m.inner.h + 0.5;
        const clipped = b.scrollH !== null && b.scrollH > b.clientH + 1;
        const normFont = b.fontPx ? (parseFloat(b.fontPx) / m.stage.h) * 540 : null;
        console.log(`       "${b.text}" box(${b.left.toFixed(1)},${b.top.toFixed(1)} ${b.w.toFixed(1)}x${b.h.toFixed(1)}) fit=${b.fitScale} font=${normFont ? normFont.toFixed(2) + 'px@540' : '-'}` +
          (escapes ? '  *** ESCAPES STAGE ***' : '') + (clipped ? `  *** TEXT CLIPPED (scrollH ${b.scrollH} > ${b.clientH}) ***` : ''));
      }
      await page.screenshot({ path: path.join(__dirname, `aspect-${route.name}-${vp.width}x${vp.height}.png`) });
      await page.close();
    }
  }
} finally {
  await stopBrowserEnvironment(env);
}
