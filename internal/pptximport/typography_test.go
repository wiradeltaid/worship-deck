package pptximport

import (
	"bytes"
	"strings"
	"testing"
)

func TestTypographyNormalizationExactPrecedence(t *testing.T) {
	cases := []struct {
		inputFace    string
		explicitB    string
		explicitI    string
		expectFamily string
		expectWeight string
		expectStyle  string
		expectPptx   string
	}{
		{"Montserrat Light", "", "", "Montserrat", "300", "normal", "Montserrat Light"},
		{"Montserrat Black", "", "", "Montserrat", "900", "normal", "Montserrat Black"},
		{"Montserrat Bold", "", "", "Montserrat", "700", "normal", "Montserrat Bold"},
		{"Montserrat SemiBold Italic", "", "", "Montserrat", "600", "italic", "Montserrat SemiBold Italic"},
		{"Montserrat-Bold", "", "", "Montserrat", "700", "normal", "Montserrat-Bold"},
		{"MontserratBold", "", "", "Montserrat", "700", "normal", "MontserratBold"},
		{"Comic Sans", "", "", "Comic Sans", "normal", "normal", "Comic Sans"},
		{"Bold", "", "", "Bold", "700", "normal", "Bold"},
		{"Montserrat Light", "1", "", "Montserrat", "700", "normal", "Montserrat Light"},
		{"Montserrat Bold", "0", "", "Montserrat", "normal", "normal", "Montserrat Bold"},
		{"Montserrat Regular", "", "1", "Montserrat", "normal", "italic", "Montserrat Regular"},
		{"Montserrat Thin Oblique", "", "", "Montserrat", "100", "oblique", "Montserrat Thin Oblique"},
		{"Inter Extra Bold", "", "", "Inter", "800", "normal", "Inter Extra Bold"},
	}

	for _, c := range cases {
		family, weight, style, pptxFace := NormalizeTypeface(c.inputFace, c.explicitB, c.explicitI)
		if family != c.expectFamily {
			t.Errorf("[%s] family = %q, want %q", c.inputFace, family, c.expectFamily)
		}
		if weight != c.expectWeight {
			t.Errorf("[%s] weight = %q, want %q", c.inputFace, weight, c.expectWeight)
		}
		if style != c.expectStyle {
			t.Errorf("[%s] style = %q, want %q", c.inputFace, style, c.expectStyle)
		}
		if pptxFace != c.expectPptx {
			t.Errorf("[%s] pptxTypeface = %q, want %q", c.inputFace, pptxFace, c.expectPptx)
		}
	}
}

func TestCharacterSpacingExtraction(t *testing.T) {
	// spc = 150 -> 2.0px (legacy 0.75), 1.5px (modern 1.0)
	// spc = -75 -> -1.0px (legacy 0.75), -0.75px (modern 1.0)
	// spc = 0 -> 0.0px
	val150 := 150
	valNeg75 := -75
	val0 := 0

	r1 := XMLRunProperties{Spc: &val150}
	r2 := XMLRunProperties{Spc: &valNeg75}
	r3 := XMLRunProperties{Spc: &val0}
	r4 := XMLRunProperties{Spc: nil}

	// Legacy 405 pt scale (0.75)
	if got := DrawingMLSpcToPx(*r1.Spc, 0.75); got != 2.0 {
		t.Errorf("spc=150 (scale 0.75): got %f, want 2.0", got)
	}
	if got := DrawingMLSpcToPx(*r2.Spc, 0.75); got != -1.0 {
		t.Errorf("spc=-75 (scale 0.75): got %f, want -1.0", got)
	}
	if got := DrawingMLSpcToPx(*r3.Spc, 0.75); got != 0.0 {
		t.Errorf("spc=0 (scale 0.75): got %f, want 0.0", got)
	}

	// Modern 540 pt scale (1.0)
	if got := DrawingMLSpcToPx(*r1.Spc, 1.0); got != 1.5 {
		t.Errorf("spc=150 (scale 1.0): got %f, want 1.5", got)
	}
	if got := DrawingMLSpcToPx(*r2.Spc, 1.0); got != -0.75 {
		t.Errorf("spc=-75 (scale 1.0): got %f, want -0.75", got)
	}

	// Defensive fallback with <= 0 scale
	if got := DrawingMLSpcToPx(*r1.Spc, 0); got != 1.5 {
		t.Errorf("spc=150 (scale 0 fallback): got %f, want 1.5", got)
	}

	if r4.Spc != nil {
		t.Errorf("r4.Spc should be nil")
	}
}

func TestMixedRunTypographyWarning(t *testing.T) {
	txBody := &XMLTextBody{
		Paragraphs: []XMLParagraph{
			{
				Runs: []XMLRun{
					{
						T: "First Run",
						RPr: &XMLRunProperties{
							Sz:    3200,
							Latin: &XMLLatinFont{Typeface: "Montserrat Light"},
						},
					},
					{
						T: "Second Run",
						RPr: &XMLRunProperties{
							Sz:    4800, // Materially different size (> 50 hundredths)
							Latin: &XMLLatinFont{Typeface: "Montserrat Black"},
						},
					},
				},
			},
		},
	}

	style, warnings := extractTextStyleWithWarnings(txBody, "el-test-1", 1.0)
	if style["fontFamily"] != "Montserrat" {
		t.Errorf("expected family Montserrat, got %v", style["fontFamily"])
	}
	if style["fontWeight"] != "300" {
		t.Errorf("expected first run weight 300, got %v", style["fontWeight"])
	}
	if len(warnings) == 0 {
		t.Fatalf("expected mixed run typography warning, got none")
	}
	if !strings.Contains(warnings[0], "mixed run typography") {
		t.Errorf("expected warning to mention mixed run typography, got: %s", warnings[0])
	}
}

func TestEmbeddedFontExtractionAndDeobfuscation(t *testing.T) {
	// Build minimal structurally valid TTF font (32 bytes)
	validTTF := []byte{
		0x00, 0x01, 0x00, 0x00, // sfntVersion (TrueType)
		0x00, 0x01, // numTables = 1
		0x00, 0x10, // searchRange
		0x00, 0x03, // entrySelector
		0x00, 0x00, // rangeShift
		'h', 'e', 'a', 'd', // tag: head
		0x00, 0x00, 0x00, 0x00, // checksum
		0x00, 0x00, 0x00, 0x1C, // offset = 28
		0x00, 0x00, 0x00, 0x04, // length = 4
		0x01, 0x02, 0x03, 0x04, // table data at offset 28
	}

	guid := "{ba878077-ec52-475b-bb4c-d9c9e88d752e}"
	key, ok := ParseObfuscationKey(guid)
	if !ok {
		t.Fatalf("failed to parse obfuscation key from GUID")
	}

	obfuscatedTTF := make([]byte, len(validTTF))
	copy(obfuscatedTTF, validTTF)
	for i := 0; i < len(obfuscatedTTF); i++ {
		obfuscatedTTF[i] ^= key[i%16]
	}

	// De-obfuscate and validate
	deobfuscated, format, err := ValidateAndDeobfuscateFont(obfuscatedTTF, guid+".fntdata")
	if err != nil {
		t.Fatalf("ValidateAndDeobfuscateFont failed: %v", err)
	}
	if format != "ttf" {
		t.Errorf("expected format ttf, got %s", format)
	}
	if !bytes.Equal(deobfuscated, validTTF) {
		t.Errorf("de-obfuscated bytes do not match original valid TTF")
	}

	validTTFBold := make([]byte, len(validTTF))
	copy(validTTFBold, validTTF)
	validTTFBold[31] = 0x99

	// Synthetic PPTX with embedded font in presentation.xml
	pptx := createTestPptx(t, 12192000, 6858000, map[string]string{
		"ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:embeddedFontLst>
    <p:embeddedFont>
      <p:font typeface="CustomChurchFont"/>
      <p:regular r:id="rIdFontReg"/>
      <p:bold r:id="rIdFontBold"/>
    </p:embeddedFont>
  </p:embeddedFontLst>
</p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rIdFontReg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/` + guid + `.fntdata"/>
  <Relationship Id="rIdFontBold" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/bold.ttf"/>
</Relationships>`,
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree></p:spTree></p:cSld>
</p:sld>`,
	}, map[string][]byte{
		"ppt/fonts/" + guid + ".fntdata": obfuscatedTTF,
		"ppt/fonts/bold.ttf":              validTTFBold,
	})

	res, err := ParsePresentation(bytes.NewReader(pptx), int64(len(pptx)))
	if err != nil {
		t.Fatalf("ParsePresentation failed with embedded fonts: %v", err)
	}

	if len(res.Fonts) != 2 {
		t.Fatalf("expected 2 extracted fonts, got %d", len(res.Fonts))
	}
	if res.Fonts[0].Family != "CustomChurchFont" {
		t.Errorf("expected font[0] family CustomChurchFont, got %s", res.Fonts[0].Family)
	}
	if res.Fonts[0].Format != "ttf" {
		t.Errorf("expected font[0] format ttf, got %s", res.Fonts[0].Format)
	}
}
