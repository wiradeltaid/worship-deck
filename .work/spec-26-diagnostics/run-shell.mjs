/**
 * SPEC-26 diagnostic 2: does the Canvas Editor's own stage clip?
 * Ports ArtifactEditor.fitCanvasToShell verbatim and measures the painted
 * slide against the real <canvas> element it is painted into, at several
 * viewport widths.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.map': 'application/json' };

const server = await new Promise((r) => {
  const s = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url.startsWith('/node_modules/') ? path.join(repoRoot, url)
      : url.startsWith('/assets/') ? path.join(repoRoot, 'public', url)
      : path.join(__dirname, url);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } else { res.writeHead(404); res.end('404 ' + url); }
  });
  s.listen(8932, '127.0.0.1', () => r(s));
});

const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/default-registry.json'), 'utf8'));
const layout = registry.find((t) => (t.id || t.key) === (process.argv[2] || 'welcome')).layouts.default;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--force-device-scale-factor=1'] });
const out = [];
const p = (s) => { out.push(s); console.log(s); };

p('=== SPEC-26: Canvas Editor stage (fitCanvasToShell) at real viewport sizes ===');
p('"clipped" = painted slide pixels that fall outside the <canvas> element and are therefore never drawn.\n');

for (const vp of [
  { width: 1366, height: 768, label: 'laptop 1366x768' },
  { width: 1600, height: 900, label: 'laptop 1600x900' },
  { width: 1920, height: 1080, label: 'desktop 1920x1080' },
  { width: 2560, height: 1440, label: 'QHD 2560x1440' },
  { width: 3840, height: 2160, label: '4K 3840x2160' },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.addInitScript((l) => { window.__LAYOUT__ = l; }, layout);
  await page.goto('http://127.0.0.1:8932/shell-page.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 20000 });
  const m = await page.evaluate(() => window.__fit());
  p(`${vp.label}`);
  p(`  shell ${m.shell.w.toFixed(0)}x${m.shell.h.toFixed(0)}  zoom scale ${m.scale.toFixed(4)}`);
  p(`  painted slide  ${m.paintedSlide.w.toFixed(1)} x ${m.paintedSlide.h.toFixed(1)} css px`);
  p(`  <canvas> css   ${m.lowerCanvasCssPx.w.toFixed(1)} x ${m.lowerCanvasCssPx.h.toFixed(1)}   (attr ${m.lowerCanvasAttr.w}x${m.lowerCanvasAttr.h}, style ${m.lowerCanvasStyle.w}/${m.lowerCanvasStyle.h})`);
  p(`  wrapper css    ${m.wrapperCss.w.toFixed(1)} x ${m.wrapperCss.h.toFixed(1)}`);
  p(`  CLIPPED right ${m.clippedRightPx.toFixed(1)}px, bottom ${m.clippedBottomPx.toFixed(1)}px` +
    (m.clippedRightPx > 1 || m.clippedBottomPx > 1
      ? `  *** ${((1 - (m.lowerCanvasCssPx.w / m.paintedSlide.w)) * 100).toFixed(1)}% of slide width / ${((1 - (m.lowerCanvasCssPx.h / m.paintedSlide.h)) * 100).toFixed(1)}% of height NEVER DRAWN ***`
      : '  (none)'));
  p(`  canvas overflows wrapper: right ${m.canvasOverflowsWrapperRight.toFixed(1)}px, bottom ${m.canvasOverflowsWrapperBottom.toFixed(1)}px\n`);
  await page.locator('#shell').screenshot({ path: path.join(__dirname, `shell-${vp.width}x${vp.height}.png`) });
  await page.close();
}

fs.writeFileSync(path.join(__dirname, 'shell-report.txt'), out.join('\n'));
await browser.close();
server.close();
