/**
 * SPEC-26 diagnostic 5: normalise the two real-route stage screenshots to
 * 960x540 and pixel-diff them. Reports overall difference plus where it lives.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.png': 'image/png', '.mjs': 'text/javascript' };

const server = await new Promise((r) => {
  const s = http.createServer((req, res) => {
    const file = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } else { res.writeHead(404); res.end('404'); }
  });
  s.listen(8933, '127.0.0.1', () => r(s));
});

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1700 } });
await page.goto('http://127.0.0.1:8933/diff.html', { waitUntil: 'load' });
const out = await page.evaluate(async () => {
  const W = 960, H = 540;
  const load = (src) => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  const draw = async (src) => {
    const img = await load(src);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, W, H);
    return { data: x.getImageData(0, 0, W, H).data, natural: { w: img.naturalWidth, h: img.naturalHeight } };
  };
  const a = await draw('/ab-editor.png');
  const b = await draw('/ab-slideshow.png');

  const diff = document.createElement('canvas'); diff.width = W; diff.height = H;
  const dx = diff.getContext('2d');
  const dimg = dx.createImageData(W, H);
  let sum = 0, over16 = 0, over48 = 0;
  const colProfile = new Float64Array(W), rowProfile = new Float64Array(H);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    const d = (Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2])) / 3;
    sum += d;
    if (d > 16) over16++;
    if (d > 48) over48++;
    const px = i % W, py = (i / W) | 0;
    colProfile[px] += d; rowProfile[py] += d;
    const v = Math.min(255, d * 4);
    dimg.data[o] = v; dimg.data[o + 1] = 0; dimg.data[o + 2] = 255 - v; dimg.data[o + 3] = 255;
  }
  dx.putImageData(dimg, 0, 0);
  const top = (arr, n) => Array.from(arr).map((v, i) => [i, v / (arr === colProfile ? H : W)])
    .sort((p, q) => q[1] - p[1]).slice(0, n).map(([i, v]) => `${i}:${v.toFixed(1)}`);
  return {
    naturalA: a.natural, naturalB: b.natural,
    meanDiff: sum / (W * H),
    pctPixelsOver16: (over16 / (W * H)) * 100,
    pctPixelsOver48: (over48 / (W * H)) * 100,
    worstColumns: top(colProfile, 12),
    worstRows: top(rowProfile, 12),
    diffPng: diff.toDataURL('image/png'),
  };
});

console.log('editor png natural  ', JSON.stringify(out.naturalA));
console.log('slideshow png natural', JSON.stringify(out.naturalB));
console.log('mean channel diff (0-255):', out.meanDiff.toFixed(2));
console.log('pixels differing >16 :', out.pctPixelsOver16.toFixed(2) + '%');
console.log('pixels differing >48 :', out.pctPixelsOver48.toFixed(2) + '%');
console.log('worst columns (x:avg):', out.worstColumns.join('  '));
console.log('worst rows    (y:avg):', out.worstRows.join('  '));
fs.writeFileSync(path.join(__dirname, 'ab-diff.png'), Buffer.from(out.diffPng.split(',')[1], 'base64'));

await browser.close();
server.close();
