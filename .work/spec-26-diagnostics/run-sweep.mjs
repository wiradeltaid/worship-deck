/**
 * SPEC-26 diagnostic 7: sweep every shipped template through both renderers at
 * an identical 960x540 stage and list every element where they disagree.
 *
 * Divergence classes reported:
 *   FIT     - ArtifactSlide shrinks the text (fit < 1); Fabric never shrinks.
 *   CLIP    - ArtifactSlide clips content at the box; Fabric paints it anyway.
 *   OVERRUN - Fabric paints below/right of the authored box (Textbox ignores h).
 *   WRAP    - the two engines break the text into a different number of lines.
 *   GEOM    - box geometry differs by more than 1px at 960x540.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.map': 'application/json' };

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
  s.listen(8934, '127.0.0.1', () => r(s));
});

const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/default-registry.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--force-device-scale-factor=1'] });

const lines = [];
const p = (s) => { lines.push(s); console.log(s); };
let totals = { FIT: 0, CLIP: 0, OVERRUN: 0, WRAP: 0, GEOM: 0, templates: 0, elements: 0 };

for (const tpl of registry) {
  const layout = tpl.layouts?.default;
  if (!layout || !Array.isArray(layout.elements) || !layout.elements.length) continue;
  totals.templates++;

  const page = await browser.newPage({ viewport: { width: 1000, height: 1120 } });
  let pageErr = null;
  page.on('pageerror', (e) => { pageErr = e.message; });
  await page.addInitScript((l) => { window.__LAYOUT__ = l; }, layout);
  await page.goto('http://127.0.0.1:8934/parity-page.html', { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 20000 });
  } catch {
    p(`\n## ${tpl.id}: FAILED TO RENDER${pageErr ? ' — ' + pageErr : ''}`);
    await page.close();
    continue;
  }
  const d = await page.evaluate(() => ({ fabric: window.__FABRIC__, css: window.__CSS__, stage: window.__STAGE__ }));
  await page.close();

  const findings = [];
  for (const el of layout.elements) {
    const f = d.fabric[el.id], c = d.css[el.id];
    if (!f || !c) continue;
    totals.elements++;
    const SW = d.stage.width, SH = d.stage.height;
    const n = (v, dim) => (dim === 'x' ? (v / SW) * 960 : (v / SH) * 540);
    const authored = { l: (el.x / 100) * 960, t: (el.y / 100) * 540, w: (el.w / 100) * 960, h: (el.h / 100) * 540 };
    const cb = { l: n(c.box.left, 'x'), t: n(c.box.top, 'y'), w: n(c.box.width, 'x'), h: n(c.box.height, 'y') };

    if (Math.abs(cb.l - f.authoredLeft) > 1 || Math.abs(cb.t - f.authoredTop) > 1 || Math.abs(cb.w - f.width) > 1) {
      findings.push(`GEOM    ${el.id}: fabric(${f.authoredLeft.toFixed(1)},${f.authoredTop.toFixed(1)} w${f.width.toFixed(1)}) vs css(${cb.l.toFixed(1)},${cb.t.toFixed(1)} w${cb.w.toFixed(1)})`);
      totals.GEOM++;
    }
    if (el.type !== 'text' || !c.content) continue;

    const fit = parseFloat(c.content.fitScale || '1');
    if (fit < 1) {
      findings.push(`FIT     ${el.id}: ArtifactSlide shrinks to ${(fit * 100).toFixed(0)}% (${(f.fontSize * fit).toFixed(1)}px) — Fabric paints at ${f.fontSize}px. text="${String(el.content).slice(0, 40)}"`);
      totals.FIT++;
    }
    if (c.content.scrollHeight > Math.round(c.box.height) + 1) {
      findings.push(`CLIP    ${el.id}: content ${c.content.scrollHeight}px in a ${Math.round(c.box.height)}px box — clipped in ArtifactSlide, painted in full by Fabric`);
      totals.CLIP++;
    }
    const fabricBottom = f.authoredTop + (f.calcTextHeight ?? f.height);
    const overrun = fabricBottom - (authored.t + authored.h);
    if (overrun > 1) {
      findings.push(`OVERRUN ${el.id}: Fabric paints ${overrun.toFixed(1)}px below the authored box bottom (Textbox discards h=${authored.h.toFixed(1)}, uses ${(f.calcTextHeight ?? f.height).toFixed(1)})`);
      totals.OVERRUN++;
    }
    const cssLines = c.content.lineRects.length;
    const fabLines = (f.textLines || []).length;
    if (fabLines && cssLines && fabLines !== cssLines && fit === 1) {
      findings.push(`WRAP    ${el.id}: Fabric ${fabLines} line(s) ${JSON.stringify(f.textLines)} vs CSS ${cssLines} line(s)`);
      totals.WRAP++;
    }
  }

  if (findings.length) {
    p(`\n## ${tpl.id} (${tpl.label || ''})`);
    for (const fnd of findings) p('   ' + fnd);
  }
}

p(`\n\n=== SWEEP TOTALS over ${totals.templates} templates / ${totals.elements} elements ===`);
p(`GEOM (box geometry disagrees >1px) : ${totals.GEOM}`);
p(`WRAP (different line breaking)     : ${totals.WRAP}`);
p(`FIT  (presenter shrinks, canvas not): ${totals.FIT}`);
p(`CLIP (presenter clips, canvas not) : ${totals.CLIP}`);
p(`OVERRUN (canvas paints outside box): ${totals.OVERRUN}`);

fs.writeFileSync(path.join(__dirname, 'sweep-report.txt'), lines.join('\n'));
await browser.close();
server.close();
