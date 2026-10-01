/**
 * SPEC-96-02: PPTX Dual-Hash Image Embedding and Slide Plan Parity Tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Setup temporary uploads directory before importing modules
const tmpUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-dual-hash-test-'));
process.env.UPLOADS_DIR = tmpUploadsDir;

const valid32Hash = '34645da1a600f8824686c0ae7104bc1d';
const valid64Hash = '758572555dd73f59b7059cf8e1d841eff62ff3b505831410d6b17e7cfc4fc8a2';

// 1x1 valid transparent PNG bytes
const samplePngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Seed local upload files on disk
fs.writeFileSync(path.join(tmpUploadsDir, `${valid32Hash}.png`), samplePngBytes);
fs.writeFileSync(path.join(tmpUploadsDir, `${valid64Hash}.png`), samplePngBytes);

const pptxDrawModulePath = path.join(rootDir, 'src', 'lib', 'pptx-draw.ts');
const slidePlanModulePath = path.join(rootDir, 'src', 'lib', 'slide-plan.ts');
const jszipPath = path.join(rootDir, 'node_modules', 'jszip', 'lib', 'index.js');

const { generatePptxFromPlan } = await import(pathToFileURL(pptxDrawModulePath).href);
const { isSafeImageUrl } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'images.ts')).href);
const { default: JSZip } = await import(pathToFileURL(jszipPath).href);

test('SPEC-96-02: isSafeImageUrl accepts 64-hex SHA-256 and 32-hex upload references', () => {
  assert.equal(isSafeImageUrl(`/api/uploads/${valid32Hash}.png`), true);
  assert.equal(isSafeImageUrl(`/api/uploads/${valid64Hash}.png`), true);
});

test('SPEC-96-02: parseImagesPayload preserves 64-hex SHA-256 URLs across all photo slots', async () => {
  const { parseImagesPayload } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'images.ts')).href);
  const payload = {
    sermonGraphicUrl: `/api/uploads/${valid64Hash}.jpg`,
    familyPhotoUrl: `/api/uploads/${valid64Hash}.png`,
    youthPhotoUrl: `/api/uploads/${valid32Hash}.jpeg`,
    announcementInserts: [`/api/uploads/${valid64Hash}.webp`],
  };
  const parsed = parseImagesPayload(payload);
  assert.equal(parsed.sermonGraphicUrl, `/api/uploads/${valid64Hash}.jpg`);
  assert.equal(parsed.familyPhotoUrl, `/api/uploads/${valid64Hash}.png`);
  assert.equal(parsed.youthPhotoUrl, `/api/uploads/${valid32Hash}.jpeg`);
  assert.equal(parsed.announcementInserts[0], `/api/uploads/${valid64Hash}.webp`);
});

test('SPEC-96-02: computePlanContext preserves 64-hex SHA-256 upload URLs across all photo slots without nullification', async () => {
  const { computePlanContext } = await import(pathToFileURL(slidePlanModulePath).href);

  const media = {
    sermonGraphicUrl: `/api/uploads/${valid64Hash}.jpg`,
    familyPhotoUrl: `/api/uploads/${valid64Hash}.png`,
    youthPhotoUrl: `/api/uploads/${valid32Hash}.webp`,
    announcementInserts: [`/api/uploads/${valid64Hash}.webp`, '', '', ''],
  };

  const parsed = {
    date: '2026-10-04',
    items: [],
  };

  const ctx = computePlanContext('2026-10-04', parsed, media);
  assert.equal(ctx.sermonGraphic, `/api/uploads/${valid64Hash}.jpg`);
  assert.equal(ctx.familyPhoto, `/api/uploads/${valid64Hash}.png`);
  assert.equal(ctx.youthPhoto, `/api/uploads/${valid32Hash}.webp`);
  assert.equal(ctx.announcementInserts[0], `/api/uploads/${valid64Hash}.webp`);
});

test('SPEC-96-02: PPTX worker embeds both 32-hex and 64-hex local uploads into presentation media', async () => {
  const mockPlan = [
    {
      id: 'slide-32',
      fade: false,
      hidden: false,
      artifact: {
        runtimeVersion: 1,
        instanceId: 'inst-32',
        templateId: 'tmpl-32',
        label: 'Slide 32-hex Legacy',
        layout: {
          backgroundColor: '#000000',
          backgroundImage: '',
          elements: [
            {
              id: 'img-1',
              type: 'image',
              x: 10,
              y: 10,
              w: 80,
              h: 80,
              zIndex: 1,
              imageUrl: `/api/uploads/${valid32Hash}.png`,
              style: {},
            },
          ],
        },
      },
    },
    {
      id: 'slide-64',
      fade: false,
      hidden: false,
      artifact: {
        runtimeVersion: 1,
        instanceId: 'inst-64',
        templateId: 'tmpl-64',
        label: 'Slide 64-hex SHA-256',
        layout: {
          backgroundColor: '#000000',
          backgroundImage: '',
          elements: [
            {
              id: 'img-2',
              type: 'image',
              x: 10,
              y: 10,
              w: 80,
              h: 80,
              zIndex: 1,
              imageUrl: `/api/uploads/${valid64Hash}.png`,
              style: {},
            },
          ],
        },
      },
    },
    {
      id: 'slide-missing',
      fade: false,
      hidden: false,
      artifact: {
        runtimeVersion: 1,
        instanceId: 'inst-missing',
        templateId: 'tmpl-missing',
        label: 'Slide Missing File Fallback',
        layout: {
          backgroundColor: '#000000',
          backgroundImage: '',
          elements: [
            {
              id: 'img-3',
              type: 'image',
              x: 10,
              y: 10,
              w: 80,
              h: 80,
              zIndex: 1,
              imageUrl: `/api/uploads/${valid64Hash}_missing.png`,
              style: {},
            },
          ],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-10-04', mockPlan, 'none');
  assert.ok(buffer && buffer.length > 0, 'PPTX buffer must be generated');

  const zip = await JSZip.loadAsync(buffer);
  const fileNames = Object.keys(zip.files).filter((k) => !zip.files[k].dir);

  // Assert media parts exist in ppt/media/
  const mediaFiles = fileNames.filter((k) => k.startsWith('ppt/media/'));
  assert.ok(mediaFiles.length >= 1, 'Archive must contain embedded media part in ppt/media/');

  // Inspect slide XML content
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('text');
  const slide2Xml = await zip.file('ppt/slides/slide2.xml').async('text');
  const slide3Xml = await zip.file('ppt/slides/slide3.xml').async('text');

  // Slide 1 (32-hex) must NOT have fallback "Image unavailable"
  assert.equal(
    slide1Xml.includes('Image unavailable'),
    false,
    'Slide 1 (32-hex) must embed image without fallback box'
  );

  // Slide 2 (64-hex SHA-256) must NOT have fallback "Image unavailable"
  assert.equal(
    slide2Xml.includes('Image unavailable'),
    false,
    'Slide 2 (64-hex) must embed image without fallback box'
  );

  // Slide 3 (missing file) must render fallback "Image unavailable"
  assert.equal(
    slide3Xml.includes('Image unavailable'),
    true,
    'Slide 3 (missing) must render fallback text box'
  );
});

test('SPEC-96-02: Defect Injection — Missing or rejected 64-hex image falls back gracefully', async () => {
  const mockPlan = [
    {
      id: 'slide-defect',
      fade: false,
      hidden: false,
      artifact: {
        runtimeVersion: 1,
        instanceId: 'inst-defect',
        templateId: 'tmpl-defect',
        label: 'Defect Check',
        layout: {
          backgroundColor: '#000000',
          backgroundImage: '',
          elements: [
            {
              id: 'img-defect',
              type: 'image',
              x: 10,
              y: 10,
              w: 80,
              h: 80,
              zIndex: 1,
              imageUrl: `/api/uploads/nonexistent64hashnonexistent64hashnonexistent64hashnonexistent64ha.png`,
              style: {},
            },
          ],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-10-04', mockPlan, 'none');
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('text');

  assert.equal(
    slideXml.includes('Image unavailable'),
    true,
    'Defect proof: unresolvable image renders fallback box cleanly without crashing deck generation'
  );
});
