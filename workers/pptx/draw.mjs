/**
 * On-demand PPTX drawer (AD-30 / LC-13).
 *
 * Reads `{ serviceDate, transition, plan }` JSON from stdin and writes a PPTX
 * buffer to stdout. MUST NOT open SQLite or import the slide planner.
 */
import { generatePptxFromPlan } from '../../src/lib/pptx-draw.ts';

const SLIDE_TRANSITIONS = new Set(['none', 'cut', 'fade', 'dissolve', 'push']);

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

const raw = await readStdin();
let body;
try {
  body = JSON.parse(raw.toString('utf8') || '{}');
} catch {
  console.error('[pptx-worker] stdin is not JSON');
  process.exit(1);
}

const serviceDate =
  typeof body.serviceDate === 'string' && body.serviceDate.trim()
    ? body.serviceDate.trim()
    : 'service';
const transition = SLIDE_TRANSITIONS.has(body.transition)
  ? body.transition
  : 'fade';
const plan = Array.isArray(body.plan) ? body.plan : null;
if (!plan) {
  console.error('[pptx-worker] plan must be an array');
  process.exit(1);
}

const fonts = Array.isArray(body.fonts) ? body.fonts : undefined;

try {
  const buffer = await generatePptxFromPlan(serviceDate, plan, transition, fonts);
  process.stdout.write(buffer);
} catch (error) {
  console.error('[pptx-worker] draw failed:', error);
  process.exit(1);
}
