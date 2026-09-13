/**
 * SPEC-26 diagnostic: measure the Fabric (960x540 canvas) renderer and the
 * ArtifactSlide CSS renderer on the SAME layout, at the SAME stage size, and
 * print every geometry disagreement. Read-only; writes screenshots + JSON to
 * this folder.
 *
 * Run: node .work/spec-26-diagnostics/run-parity.mjs [templateKey]
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const MIME = {
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.map': 'application/json', '.css': 'text/css',
};

function serve(port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const candidates = url.startsWith('/node_modules/')
      ? [path.join(repoRoot, url)]
      : url.startsWith('/assets/')
        ? [path.join(repoRoot, 'public', url)]
        : [path.join(__dirname, url)];
    for (const file of candidates) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404); res.end('not found: ' + url);
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

const templateKey = process.argv[2] || 'welcome';
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/default-registry.json'), 'utf8'));
const template = registry.find((t) => t.key === templateKey || t.id === templateKey);
if (!template) throw new Error('template not found: ' + templateKey);
const layout = template.layouts.default;

const PORT = 8931;
const server = await serve(PORT);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1120 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.addInitScript((l) => { window.__LAYOUT__ = l; }, layout);
await page.goto(`http://127.0.0.1:${PORT}/parity-page.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 20000 });

const data = await page.evaluate(() => ({
  fabric: window.__FABRIC__, css: window.__CSS__,
  stage: window.__STAGE__, bgNative: window.__BG_NATIVE__,
}));

await page.locator('#fabricPane').screenshot({ path: path.join(__dirname, `${templateKey}-fabric.png`) });
await page.locator('#cssPane').screenshot({ path: path.join(__dirname, `${templateKey}-css.png`) });

const STAGE_W = data.stage.width, STAGE_H = data.stage.height;
const lines = [];
const p = (s) => { lines.push(s); console.log(s); };

p(`\n=== SPEC-26 renderer parity: template "${templateKey}" ===`);
p(`CSS stage: ${STAGE_W} x ${STAGE_H}   Fabric canvas: 960 x 540`);
if (data.bgNative) {
  const ar = data.bgNative.width / data.bgNative.height;
  p(`background image native ${data.bgNative.width}x${data.bgNative.height} (AR ${ar.toFixed(5)}; 16:9 = 1.77778)`);
  const coverScale = Math.max(960 / data.bgNative.width, 540 / data.bgNative.height);
  const cropX = (data.bgNative.width * coverScale - 960) / 2;
  const cropY = (data.bgNative.height * coverScale - 540) / 2;
  p(`  Fabric stretch (scaleX/scaleY independent) -> whole image visible, non-uniform`);
  p(`  CSS background-size:cover -> crops ${cropX.toFixed(2)}px per side horizontally, ${cropY.toFixed(2)}px per side vertically (in 960x540 space)`);
}

for (const el of layout.elements) {
  const f = data.fabric[el.id], c = data.css[el.id];
  if (!f || !c) continue;
  p(`\n--- element ${el.id} (${el.type}) authored x=${el.x} y=${el.y} w=${el.w} h=${el.h} fontSize=${el.style?.fontSize ?? '-'} ---`);
  const authoredPx = {
    left: (el.x / 100) * 960, top: (el.y / 100) * 540,
    width: (el.w / 100) * 960, height: (el.h / 100) * 540,
  };
  p(`authored box in 960x540 px : left=${authoredPx.left.toFixed(2)} top=${authoredPx.top.toFixed(2)} w=${authoredPx.width.toFixed(2)} h=${authoredPx.height.toFixed(2)}`);
  p(`FABRIC object              : left=${f.authoredLeft.toFixed(2)} top=${f.authoredTop.toFixed(2)} w=${f.width.toFixed(2)} h=${f.height.toFixed(2)}  (bounding ${f.boundingRect.width.toFixed(2)}x${f.boundingRect.height.toFixed(2)} @ ${f.boundingRect.left.toFixed(2)},${f.boundingRect.top.toFixed(2)})`);
  const cb = c.box;
  const cbIn960 = {
    left: (cb.left / STAGE_W) * 960, top: (cb.top / STAGE_H) * 540,
    width: (cb.width / STAGE_W) * 960, height: (cb.height / STAGE_H) * 540,
  };
  p(`CSS box (normalised to 960): left=${cbIn960.left.toFixed(2)} top=${cbIn960.top.toFixed(2)} w=${cbIn960.width.toFixed(2)} h=${cbIn960.height.toFixed(2)}`);
  if (el.type === 'text') {
    p(`FABRIC text   : lines=${JSON.stringify(f.textLines)} lineWidths=${JSON.stringify((f.lineWidths || []).map((n) => +n.toFixed(2)))} calcTextHeight=${f.calcTextHeight?.toFixed(2)} fontSize=${f.fontSize}`);
    p(`FABRIC height honoured? authored h=${authoredPx.height.toFixed(2)} -> object h=${f.height.toFixed(2)}  ${Math.abs(f.height - authoredPx.height) < 0.5 ? 'YES' : 'NO (Textbox recomputed from text)'}`);
    const ci = c.content;
    const cLines = ci.lineRects.map((r) => ({
      left: +((r.left / STAGE_W) * 960).toFixed(2), top: +((r.top / STAGE_H) * 540).toFixed(2),
      w: +((r.width / STAGE_W) * 960).toFixed(2), h: +((r.height / STAGE_H) * 540).toFixed(2),
    }));
    p(`CSS text      : fitScale=${ci.fitScale} computedFontSize=${ci.computedFontSize} (=${((parseFloat(ci.computedFontSize) / STAGE_H) * 540).toFixed(2)}px in 960x540 space)`);
    p(`CSS lineRects (normalised): ${JSON.stringify(cLines)}`);
    p(`CSS content scrollH=${ci.scrollHeight} boxClientH=${Math.round(cb.height)}  ${ci.scrollHeight > Math.round(cb.height) + 1 ? '*** CONTENT CLIPPED BY overflow:hidden ***' : 'fits'}`);
    const fabricPaintBottom = f.authoredTop + (f.calcTextHeight ?? f.height);
    p(`paint bottom  : FABRIC ${fabricPaintBottom.toFixed(2)}px   CSS box bottom ${(cbIn960.top + cbIn960.height).toFixed(2)}px  delta ${(fabricPaintBottom - (cbIn960.top + cbIn960.height)).toFixed(2)}px`);
    const fontDelta = ((parseFloat(ci.computedFontSize) / STAGE_H) * 540) - f.fontSize;
    p(`font size     : FABRIC ${f.fontSize}  CSS ${(((parseFloat(ci.computedFontSize) / STAGE_H) * 540)).toFixed(2)}  delta ${fontDelta.toFixed(2)}px ${Math.abs(fontDelta) > 0.5 ? '*** DIVERGES ***' : ''}`);
  }
}

fs.writeFileSync(path.join(__dirname, `${templateKey}-measurements.json`), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(__dirname, `${templateKey}-report.txt`), lines.join('\n'));

await browser.close();
server.close();
