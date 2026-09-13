/**
 * SPEC-27-04: Real Microsoft PowerPoint Conformance Test Suite
 *
 * Drives Microsoft PowerPoint via Windows COM automation (when available)
 * to open exported .pptx decks, render slides at 1920x1080, verify
 * bounding box geometry and line wrapping parity, and confirm embedded TrueType fonts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'pptx-draw.ts')).href
);

const { toPptxGeometry, PPTX_SLIDE_WIDTH_IN, PPTX_SLIDE_HEIGHT_IN } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

test('P-27-01: Exported PPTX archive OOXML conformance & embedded font structure', async () => {
  const planItem = {
    artifact: {
      runtimeVersion: 1,
      instanceId: 'conf-inst-1',
      templateId: 'conf-tmpl-1',
      label: 'Conformance Test Slide',
      baseType: 'general',
      layoutKey: 'default',
      layout: {
        aspectRatio: '16:9',
        backgroundColor: '#0F172A',
        elements: [
          {
            id: 'conf-title',
            type: 'text',
            x: 10,
            y: 15,
            w: 80,
            h: 30,
            zIndex: 0,
            text: 'Bandung International Community\nWorship Service Presentation',
            style: {
              fontSize: 40,
              fontFamily: 'Poppins',
              fontColor: '#F8FAFC',
              fontWeight: 'bold',
              lineHeight: 1.2,
            },
          },
        ],
      },
    },
  };

  const buffer = await generatePptxFromPlan('2026-09-13', [planItem], 'none');
  const zip = await JSZip.loadAsync(buffer);

  // 1. Verify slide1.xml line spacing multiple
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');
  assert.ok(slide1Xml, 'ppt/slides/slide1.xml must exist');
  assert.ok(
    slide1Xml.includes('<a:spcPct val="100000"/>'),
    'slide1.xml must emit normalized <a:spcPct val="100000"/>'
  );

  // 2. Verify font file existence (filter files ending with .fntdata, not directories)
  const fontFiles = Object.keys(zip.files).filter((k) => k.endsWith('.fntdata'));
  assert.ok(fontFiles.length > 0, 'Must embed at least one font file under ppt/fonts/');
  const fontData = await zip.file(fontFiles[0])?.async('nodebuffer');
  assert.ok(fontData && fontData.length > 50000, 'Font data must be non-empty TrueType file');

  // 3. Verify presentation.xml embedded font list
  const presXml = await zip.file('ppt/presentation.xml')?.async('string');
  assert.ok(
    presXml?.includes('<p:embeddedFontLst>'),
    'presentation.xml must declare <p:embeddedFontLst>'
  );
  assert.ok(
    presXml?.includes('<p:font typeface="Poppins"/>'),
    'presentation.xml must register typeface="Poppins"'
  );

  // 4. Verify Content_Types.xml
  const ctXml = await zip.file('[Content_Types].xml')?.async('string');
  assert.ok(
    ctXml?.includes('Extension="fntdata"'),
    '[Content_Types].xml must declare Extension="fntdata"'
  );
});

test('P-27-02: Real Microsoft PowerPoint Desktop COM Rendering & Geometry Comparison (Windows Host)', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Microsoft PowerPoint COM automation is only available on Windows host');
    return;
  }

  // Check if PowerPoint.Application COM object is registered
  let comAvailable = false;
  try {
    const checkScript = `
      try {
        $p = New-Object -ComObject PowerPoint.Application
        $p.Quit()
        Write-Output "AVAILABLE"
      } catch {
        Write-Output "UNAVAILABLE"
      }
    `;
    const res = execFileSync('powershell', ['-NoProfile', '-Command', checkScript], {
      encoding: 'utf8',
      timeout: 10000,
    });
    comAvailable = res.includes('AVAILABLE');
  } catch {
    comAvailable = false;
  }

  if (!comAvailable) {
    t.skip('Microsoft PowerPoint application is not installed on this host');
    return;
  }

  // Create temporary directory in user workspace for PowerPoint test files
  const workDir = path.join(root, '.work', 'test-pptx-com');
  fs.mkdirSync(workDir, { recursive: true });

  const tempPptx = path.join(workDir, `conformance-${Date.now()}.pptx`);
  const tempPng = path.join(workDir, `conformance-${Date.now()}.png`);

  try {
    const textElement = {
      id: 'head',
      type: 'text',
      x: 10,
      y: 15,
      w: 80,
      h: 30,
      zIndex: 0,
      text: 'PowerPoint Conformance\nVisual Parity Verification',
      style: {
        fontSize: 36,
        fontFamily: 'Poppins',
        fontColor: '#FFFFFF',
        fontWeight: 'bold',
        lineHeight: 1.2,
      },
    };

    const planItem = {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'com-1',
        templateId: 'com-t1',
        label: 'PowerPoint COM Test',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#0F172A',
          elements: [textElement],
        },
      },
    };

    const buf = await generatePptxFromPlan('2026-09-13', [planItem], 'none');
    fs.writeFileSync(tempPptx, buf);
    assert.ok(fs.existsSync(tempPptx), 'Generated PPTX must exist on disk');

    // Run PowerPoint COM export and extract shape bounding box from PowerPoint layout engine
    const psScript = `
      $ppt = New-Object -ComObject PowerPoint.Application
      $pres = $ppt.Presentations.Open(${JSON.stringify(tempPptx)}, $true, $false, $false)
      $slide = $pres.Slides.Item(1)
      $shape = $slide.Shapes.Item(1)

      $geom = [PSCustomObject]@{
        left = [math]::Round($shape.Left, 2)
        top = [math]::Round($shape.Top, 2)
        width = [math]::Round($shape.Width, 2)
        height = [math]::Round($shape.Height, 2)
        text = $shape.TextFrame.TextRange.Text.Trim()
        lineCount = $shape.TextFrame.TextRange.Lines().Count
      }

      $slide.Export(${JSON.stringify(tempPng)}, "PNG", 1920, 1080)
      $pres.Close()
      $ppt.Quit()

      $geom | ConvertTo-Json -Compress
    `;

    const geomJson = execFileSync('powershell', ['-NoProfile', '-Command', psScript], {
      timeout: 30000,
      encoding: 'utf8',
    });

    const pptGeom = JSON.parse(geomJson.trim());

    // 1. Verify PPTX Geometry against authored points (1 inch = 72 points)
    const expectedPt = {
      left: (textElement.x / 100) * PPTX_SLIDE_WIDTH_IN * 72,
      top: (textElement.y / 100) * PPTX_SLIDE_HEIGHT_IN * 72,
      width: (textElement.w / 100) * PPTX_SLIDE_WIDTH_IN * 72,
      height: (textElement.h / 100) * PPTX_SLIDE_HEIGHT_IN * 72,
    };

    assert.ok(
      Math.abs(pptGeom.left - expectedPt.left) < 1.0,
      `PowerPoint Shape Left (${pptGeom.left}) must match expected (${expectedPt.left})`
    );
    assert.ok(
      Math.abs(pptGeom.top - expectedPt.top) < 1.0,
      `PowerPoint Shape Top (${pptGeom.top}) must match expected (${expectedPt.top})`
    );
    assert.ok(
      Math.abs(pptGeom.width - expectedPt.width) < 1.0,
      `PowerPoint Shape Width (${pptGeom.width}) must match expected (${expectedPt.width})`
    );
    assert.ok(
      Math.abs(pptGeom.height - expectedPt.height) < 1.0,
      `PowerPoint Shape Height (${pptGeom.height}) must match expected (${expectedPt.height})`
    );

    // 2. Verify text content and line count
    assert.equal(pptGeom.lineCount, 2, 'PowerPoint text frame must contain exactly 2 lines');
    assert.ok(pptGeom.text.includes('PowerPoint Conformance'), 'PowerPoint text matches');

    // 3. Verify exported PNG image dimensions (1920x1080)
    assert.ok(fs.existsSync(tempPng), 'Exported slide 1 PNG must exist');
    const pngBuf = fs.readFileSync(tempPng);
    assert.ok(pngBuf.length > 10000, 'Exported PNG must be non-empty image (>10KB)');
    const pngW = pngBuf.readUInt32BE(16);
    const pngH = pngBuf.readUInt32BE(20);
    assert.equal(pngW, 1920, 'Exported PNG width must be 1920px');
    assert.equal(pngH, 1080, 'Exported PNG height must be 1080px');
  } finally {
    try {
      if (fs.existsSync(tempPptx)) fs.unlinkSync(tempPptx);
      if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng);
    } catch {}
  }
});
