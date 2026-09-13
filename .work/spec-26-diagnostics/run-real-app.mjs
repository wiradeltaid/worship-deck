/**
 * SPEC-26 diagnostic 3: the REAL app, not a reconstruction.
 * Boots the Go API + built SPA via the repo's own browser harness, logs in as
 * admin, opens /admin/artifacts, and measures the live Fabric stage against the
 * <canvas> it paints into, at several viewport sizes.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  startBrowserEnvironment,
  stopBrowserEnvironment,
  loginViaUi,
  DEFAULT_ADMIN_USER,
  DEFAULT_ADMIN_PASS,
} from '../../tests/helpers/browser-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = await startBrowserEnvironment({ dbName: 'spec26.db' });
try {
  for (const vp of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]) {
    const page = await env.browser.newPage({ viewport: vp });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await loginViaUi(page, env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
    await page.goto(`${env.baseUrl}/admin/artifacts`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas.lower-canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const m = await page.evaluate(() => {
      const lower = document.querySelector('canvas.lower-canvas');
      if (!lower) return { error: 'no lower-canvas' };
      const wrapper = lower.closest('.canvas-container');
      const shell = wrapper ? wrapper.parentElement : null;
      const lr = lower.getBoundingClientRect();
      const wr = wrapper ? wrapper.getBoundingClientRect() : null;
      const sr = shell ? shell.getBoundingClientRect() : null;
      return {
        shellClient: shell ? { w: shell.clientWidth, h: shell.clientHeight } : null,
        shellRect: sr ? { w: sr.width, h: sr.height } : null,
        wrapperRect: wr ? { w: wr.width, h: wr.height } : null,
        lowerRect: { w: lr.width, h: lr.height },
        lowerAttr: { w: lower.width, h: lower.height },
        lowerStyle: { w: lower.style.width, h: lower.style.height },
      };
    });

    if (m.error) { console.log(vp.width + 'x' + vp.height, m.error); await page.close(); continue; }
    const scale = Math.min(m.shellClient.w / 960, m.shellClient.h / 540);
    const paintedW = 960 * scale, paintedH = 540 * scale;
    const clipW = Math.max(0, paintedW - m.lowerRect.w);
    const clipH = Math.max(0, paintedH - m.lowerRect.h);
    console.log(`\n### REAL APP /admin/artifacts @ ${vp.width}x${vp.height}`);
    console.log(`  shell client ${m.shellClient.w}x${m.shellClient.h}   derived zoom ${scale.toFixed(4)}`);
    console.log(`  wrapper (.canvas-container) ${m.wrapperRect.w.toFixed(1)}x${m.wrapperRect.h.toFixed(1)}`);
    console.log(`  <canvas> css ${m.lowerRect.w.toFixed(1)}x${m.lowerRect.h.toFixed(1)}  attr ${m.lowerAttr.w}x${m.lowerAttr.h}  style ${m.lowerStyle.w}/${m.lowerStyle.h}`);
    console.log(`  painted slide would be ${paintedW.toFixed(1)}x${paintedH.toFixed(1)}`);
    console.log(`  >>> CLIPPED right ${clipW.toFixed(1)}px / bottom ${clipH.toFixed(1)}px` +
      (clipW > 1 ? `  *** ${((clipW / paintedW) * 100).toFixed(1)}% of the slide is never drawn ***` : '  (none)'));

    await page.screenshot({ path: path.join(__dirname, `real-admin-${vp.width}x${vp.height}.png`) });
    await page.close();
  }
} finally {
  await stopBrowserEnvironment(env);
}
