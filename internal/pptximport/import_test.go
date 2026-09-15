package pptximport

import (
	"archive/zip"
	"bytes"
	"fmt"
	"math"
	"strings"
	"testing"
)

// Helper to create synthetic valid 16:9 PPTX bytes in memory
func createTestPptx(t *testing.T, sldSzCX, sldSzCY int64, files map[string]string, binaries map[string][]byte) []byte {
	t.Helper()
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Minimal [Content_Types].xml
	if _, ok := files["[Content_Types].xml"]; !ok {
		files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`
	}

	// Minimal presentation.xml
	if _, ok := files["ppt/presentation.xml"]; !ok {
		files["ppt/presentation.xml"] = fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="%d" cy="%d"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`, sldSzCX, sldSzCY)
	}

	// Minimal presentation.xml.rels
	if _, ok := files["ppt/_rels/presentation.xml.rels"]; !ok {
		files["ppt/_rels/presentation.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`
	}

	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("failed to create zip entry %s: %v", name, err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatalf("failed to write zip entry %s: %v", name, err)
		}
	}

	for name, data := range binaries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("failed to create zip binary %s: %v", name, err)
		}
		if _, err := w.Write(data); err != nil {
			t.Fatalf("failed to write zip binary %s: %v", name, err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}

	return buf.Bytes()
}

// 1x1 synthetic PNG
var syntheticPNG = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
	0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
	0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
}

func TestDrawingMLSzToPxParity(t *testing.T) {
	// Legacy formula with pxToPt = 0.75: (sz / 100) / 0.75
	testCasesLegacy := []struct {
		sz       int
		expected float64
	}{
		{4000, 53.3333},
		{2400, 32.0},
		{1800, 24.0},
		{1200, 16.0},
		{3600, 48.0},
	}

	for _, tc := range testCasesLegacy {
		got := DrawingMLSzToPx(tc.sz, 0.75)
		if math.Abs(got-tc.expected) > 0.001 {
			t.Errorf("DrawingMLSzToPx(%d, 0.75) = %v, want %v", tc.sz, got, tc.expected)
		}
	}

	// Modern formula with pxToPt = 1.0: (sz / 100) / 1.0 (1:1 numeric parity)
	testCasesModern := []struct {
		sz       int
		expected float64
	}{
		{4000, 40.0},
		{2400, 24.0},
		{1800, 18.0},
		{1200, 12.0},
		{3600, 36.0},
	}

	for _, tc := range testCasesModern {
		got := DrawingMLSzToPx(tc.sz, 1.0)
		if math.Abs(got-tc.expected) > 0.001 {
			t.Errorf("DrawingMLSzToPx(%d, 1.0) = %v, want %v", tc.sz, got, tc.expected)
		}
	}

	// Defensive fallback for <= 0 scale
	if got := DrawingMLSzToPx(1200, 0); got != 12.0 {
		t.Errorf("DrawingMLSzToPx(1200, 0 fallback) = %v, want 12.0", got)
	}
}

func TestDynamicSlideDimensionsAndTypographyScaling(t *testing.T) {
	// Slide XML with a text run having sz="1200" (12pt) and spc="150" (1.5pt tracking)
	slideXmlWithText := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:grpSpPr/></p:nvGrpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="5000000" cy="2000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr sz="1200" spc="150"/>
              <a:t>Widescreen Parity Test</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`

	// 1. Modern 16:9: 12192000 x 6858000 EMU (540 pt height -> pxToPt = 1.0)
	modernPptx := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": slideXmlWithText,
	}, nil)

	resModern, err := ParsePresentation(bytes.NewReader(modernPptx), int64(len(modernPptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed for modern 16:9: %v", err)
	}
	if len(resModern.Slides) != 1 || len(resModern.Slides[0].Elements) != 1 {
		t.Fatalf("expected 1 element in modern slide, got %v", resModern.Slides[0].Elements)
	}
	elModern := resModern.Slides[0].Elements[0]
	if elModern.Style["fontSize"] != 12.0 {
		t.Errorf("modern 16:9 font size: got %v, want 12.0", elModern.Style["fontSize"])
	}
	if elModern.Style["letterSpacing"] != 1.5 {
		t.Errorf("modern 16:9 letter spacing: got %v, want 1.5", elModern.Style["letterSpacing"])
	}

	// 2. Legacy 16:9: 9144000 x 5143500 EMU (405 pt height -> pxToPt = 0.75)
	legacyPptx := createTestPptx(t, 9144000, 5143500, map[string]string{
		"ppt/slides/slide1.xml": slideXmlWithText,
	}, nil)

	resLegacy, err := ParsePresentation(bytes.NewReader(legacyPptx), int64(len(legacyPptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed for legacy 16:9: %v", err)
	}
	if len(resLegacy.Slides) != 1 || len(resLegacy.Slides[0].Elements) != 1 {
		t.Fatalf("expected 1 element in legacy slide, got %v", resLegacy.Slides[0].Elements)
	}
	elLegacy := resLegacy.Slides[0].Elements[0]
	if elLegacy.Style["fontSize"] != 16.0 {
		t.Errorf("legacy 16:9 font size: got %v, want 16.0", elLegacy.Style["fontSize"])
	}
	if elLegacy.Style["letterSpacing"] != 2.0 {
		t.Errorf("legacy 16:9 letter spacing: got %v, want 2.0", elLegacy.Style["letterSpacing"])
	}

	// 3. Dynamic non-standard 16:9: 24384000 x 13716000 EMU (1080 pt height -> pxToPt = 2.0)
	doublePptx := createTestPptx(t, 24384000, 13716000, map[string]string{
		"ppt/slides/slide1.xml": slideXmlWithText,
	}, nil)

	resDouble, err := ParsePresentation(bytes.NewReader(doublePptx), int64(len(doublePptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed for 1080pt 16:9: %v", err)
	}
	elDouble := resDouble.Slides[0].Elements[0]
	if elDouble.Style["fontSize"] != 6.0 {
		t.Errorf("1080pt 16:9 font size: got %v, want 6.0", elDouble.Style["fontSize"])
	}
	if elDouble.Style["letterSpacing"] != 0.75 {
		t.Errorf("1080pt 16:9 letter spacing: got %v, want 0.75", elDouble.Style["letterSpacing"])
	}

	// 4. Zero or missing dimensions must be rejected
	zeroCY := createTestPptx(t, 12192000, 0, map[string]string{
		"ppt/slides/slide1.xml": slideXmlWithText,
	}, nil)
	_, err = ParsePresentation(bytes.NewReader(zeroCY), int64(len(zeroCY)))
	if err == nil || !strings.Contains(err.Error(), "invalid slide dimensions") {
		t.Errorf("expected invalid slide dimensions error for cy=0, got %v", err)
	}
}

func TestAspectRatios(t *testing.T) {
	// Standard 16:9: 12192000 x 6858000
	valid16x9 := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree></p:spTree></p:cSld>
</p:sld>`,
	}, nil)

	res, err := ParsePresentation(bytes.NewReader(valid16x9), int64(len(valid16x9)))
	if err != nil {
		t.Fatalf("ParsePresentation failed for valid 16:9: %v", err)
	}
	if len(res.Slides) != 1 {
		t.Fatalf("expected 1 slide, got %d", len(res.Slides))
	}

	// 4:3 ratio: 9144000 x 6858000
	invalid4x3 := createTestPptx(t, 9144000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree></p:spTree></p:cSld>
</p:sld>`,
	}, nil)

	_, err = ParsePresentation(bytes.NewReader(invalid4x3), int64(len(invalid4x3)))
	if err == nil || !strings.Contains(err.Error(), "aspect ratio") {
		t.Fatalf("expected aspect ratio error for 4:3, got %v", err)
	}
}

func TestNativeSlideBackground(t *testing.T) {
	// Solid fill slide background
	pptxSolid := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="1A2B3C"/></a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree></p:spTree>
  </p:cSld>
</p:sld>`,
	}, nil)

	res, err := ParsePresentation(bytes.NewReader(pptxSolid), int64(len(pptxSolid)))
	if err != nil {
		t.Fatalf("ParsePresentation failed: %v", err)
	}
	if res.Slides[0].BackgroundColor != "#1A2B3C" {
		t.Errorf("expected background color #1A2B3C, got %s", res.Slides[0].BackgroundColor)
	}

	// Native blipFill slide background image
	pptxImage := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:blipFill><a:blip r:embed="rId2"/></a:blipFill>
      </p:bgPr>
    </p:bg>
    <p:spTree></p:spTree>
  </p:cSld>
</p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bg.png"/>
</Relationships>`,
	}, map[string][]byte{
		"ppt/media/bg.png": syntheticPNG,
	})

	resImg, err := ParsePresentation(bytes.NewReader(pptxImage), int64(len(pptxImage)))
	if err != nil {
		t.Fatalf("ParsePresentation failed: %v", err)
	}
	if resImg.Slides[0].BackgroundImage == nil {
		t.Fatalf("expected background image, got nil")
	}
	if resImg.Slides[0].BackgroundImage.Ext != ".png" {
		t.Errorf("expected .png ext, got %s", resImg.Slides[0].BackgroundImage.Ext)
	}
}

func TestBottomCoveringShapeBackgroundDetection(t *testing.T) {
	// 100% full-covering pic shape at bottom of stack
	pptx := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="1" name="FullBleedBackground"/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="12192000" cy="6858000"/>
          </a:xfrm>
        </p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TitleText"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="5000000" cy="2000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <p:p><a:r><a:rPr sz="3200" b="1"/><a:t>Worship Title</a:t></a:r></p:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bg.png"/>
</Relationships>`,
	}, map[string][]byte{
		"ppt/media/bg.png": syntheticPNG,
	})

	res, err := ParsePresentation(bytes.NewReader(pptx), int64(len(pptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed: %v", err)
	}

	slide := res.Slides[0]
	// Must be detected as background image
	if slide.BackgroundImage == nil {
		t.Fatalf("expected slide.BackgroundImage to be detected, got nil")
	}

	// The background shape MUST be omitted from elements
	if len(slide.Elements) != 1 {
		t.Fatalf("expected exactly 1 element (the text), got %d elements", len(slide.Elements))
	}
	if slide.Elements[0].Type != "text" {
		t.Errorf("expected element[0] to be text, got %s", slide.Elements[0].Type)
	}
	if *slide.Elements[0].Content != "Worship Title" {
		t.Errorf("expected content 'Worship Title', got '%s'", *slide.Elements[0].Content)
	}
}

func TestInsetPhotoRemainsForegroundElement(t *testing.T) {
	// Small inset photo (e.g. 50% width, 50% height, centered)
	pptx := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="1" name="InsetPhoto"/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="3000000" y="2000000"/>
            <a:ext cx="4000000" cy="3000000"/>
          </a:xfrm>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/photo.png"/>
</Relationships>`,
	}, map[string][]byte{
		"ppt/media/photo.png": syntheticPNG,
	})

	res, err := ParsePresentation(bytes.NewReader(pptx), int64(len(pptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed: %v", err)
	}

	slide := res.Slides[0]
	// Inset photo must NOT be detected as background
	if slide.BackgroundImage != nil {
		t.Errorf("expected slide.BackgroundImage to be nil for inset photo, got %v", slide.BackgroundImage)
	}
	// It MUST remain as a foreground element
	if len(slide.Elements) != 1 {
		t.Fatalf("expected 1 foreground element, got %d", len(slide.Elements))
	}
	if slide.Elements[0].Type != "image" {
		t.Errorf("expected element[0] to be image, got %s", slide.Elements[0].Type)
	}
}

func TestSecurityHardeningLimits(t *testing.T) {
	// Test Zip slip path rejection
	badZip := createTestPptx(t, 12192000, 6858000, map[string]string{
		"../evil.xml": "malicious content",
	}, nil)

	_, err := ParsePresentation(bytes.NewReader(badZip), int64(len(badZip)))
	if err == nil || !strings.Contains(err.Error(), "unsafe path") {
		t.Fatalf("expected unsafe path error, got %v", err)
	}

	// Test External relationship rejection
	badRelZip := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="http://evil.com/leak.jpg" TargetMode="External"/>
</Relationships>`,
	}, nil)

	_, err = ParsePresentation(bytes.NewReader(badRelZip), int64(len(badRelZip)))
	if err == nil || !strings.Contains(err.Error(), "external relationship") {
		t.Fatalf("expected external relationship error, got %v", err)
	}
}

func TestBuildTemplatePayloadValidation(t *testing.T) {
	slide := &ParsedSlide{
		SlideNumber:     1,
		Name:            "Slide 1",
		BackgroundColor: "#123456",
		Elements: []ParsedElement{
			{
				ID:      "el-text-1",
				Type:    "text",
				X:       10.0,
				Y:       15.0,
				W:       80.0,
				H:       40.0,
				ZIndex:  0,
				Content: stringPtr("Test Slide Heading"),
				Style: map[string]any{
					"fontFamily": "Inter",
					"fontSize":   32.0,
					"fontColor":  "#FFFFFF",
					"fontWeight": "bold",
					"textAlign":  "center",
					"lineHeight": 1.2,
				},
			},
		},
	}

	raw, err := BuildTemplatePayload("custom-test-1", "Test Slide", slide, nil, "")
	if err != nil {
		t.Fatalf("BuildTemplatePayload failed: %v", err)
	}
	if len(raw) == 0 {
		t.Fatalf("empty payload returned")
	}
}

func stringPtr(s string) *string {
	return &s
}

// Absence Guard 1: Proves that a classified native p:bg background never reaches elements
func TestAbsenceGuardNativeBackgroundNeverInElements(t *testing.T) {
	pptx := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:blipFill><a:blip r:embed="rId2"/></a:blipFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TitleText"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="5000000" cy="2000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <p:p><a:r><a:rPr sz="3200" b="1"/><a:t>Worship Title</a:t></a:r></p:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bg.png"/>
</Relationships>`,
	}, map[string][]byte{
		"ppt/media/bg.png": syntheticPNG,
	})

	res, err := ParsePresentation(bytes.NewReader(pptx), int64(len(pptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed: %v", err)
	}

	slide := res.Slides[0]
	if slide.BackgroundImage == nil {
		t.Fatalf("expected native background image, got nil")
	}

	// Invariant: Background image must NEVER appear in Elements
	for _, el := range slide.Elements {
		if el.Image != nil && el.Image.PartPath == slide.BackgroundImage.PartPath {
			t.Fatalf("ABSENCE GUARD FAILED: native background image duplicated into elements")
		}
	}
}

// Absence Guard 2: Proves that a classified bottom covering shape is omitted from elements
func TestAbsenceGuardBottomCoveringShapeOmittedFromElements(t *testing.T) {
	pptx := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="1" name="FullBleedCoveringBackground"/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="12192000" cy="6858000"/>
          </a:xfrm>
        </p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TitleText"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="5000000" cy="2000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <p:p><a:r><a:rPr sz="3200" b="1"/><a:t>Worship Title</a:t></a:r></p:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
		"ppt/slides/_rels/slide1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bg.png"/>
</Relationships>`,
	}, map[string][]byte{
		"ppt/media/bg.png": syntheticPNG,
	})

	res, err := ParsePresentation(bytes.NewReader(pptx), int64(len(pptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed: %v", err)
	}

	slide := res.Slides[0]
	if slide.BackgroundImage == nil {
		t.Fatalf("expected covering shape to be detected as BackgroundImage, got nil")
	}

	// Invariant: Exactly 1 element (the text shape) and 0 covering image shapes
	if len(slide.Elements) != 1 {
		t.Fatalf("ABSENCE GUARD FAILED: expected 1 element, got %d", len(slide.Elements))
	}
	if slide.Elements[0].Type != "text" {
		t.Fatalf("ABSENCE GUARD FAILED: expected text element, got %s", slide.Elements[0].Type)
	}
}

func TestResolveSafeTargetTraversal(t *testing.T) {
	// 1. Normal slide target -> pass
	t1, err := ResolveSafeTarget("ppt", "slides/slide1.xml", "ppt/slides/")
	if err != nil || t1 != "ppt/slides/slide1.xml" {
		t.Errorf("expected ppt/slides/slide1.xml, got %s, err: %v", t1, err)
	}

	// 2. Relative target with valid dot-dot -> pass
	t2, err := ResolveSafeTarget("ppt/slides", "../media/image1.png", "ppt/media/")
	if err != nil || t2 != "ppt/media/image1.png" {
		t.Errorf("expected ppt/media/image1.png, got %s, err: %v", t2, err)
	}

	// 3. Traversal escaping base -> fail
	_, err = ResolveSafeTarget("ppt/slides", "../../[Content_Types].xml", "ppt/media/")
	if err == nil {
		t.Errorf("expected error for traversal escape ../../[Content_Types].xml")
	}

	// 4. Target outside expected prefix -> fail
	_, err = ResolveSafeTarget("ppt/slides", "../slideLayouts/layout1.xml", "ppt/media/")
	if err == nil {
		t.Errorf("expected error when prefix ppt/media/ is expected but target is layout")
	}

	// 5. Windows drive letter or colon -> fail
	_, err = ResolveSafeTarget("ppt/slides", "C:/Windows/win.ini", "ppt/media/")
	if err == nil {
		t.Errorf("expected error for drive letter C:")
	}
}
