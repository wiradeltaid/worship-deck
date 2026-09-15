package httpapi

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestFontRoutesAndSecurity(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)

	// Insert test font into font_faces
	fontID := "abcd1234abcd1234abcd1234abcd1234"
	fontFilename := fontID + ".ttf"
	fontsDir := filepath.Join(uploadsDir(), "fonts")
	if err := os.MkdirAll(fontsDir, 0o755); err != nil {
		t.Fatalf("failed to create fonts dir: %v", err)
	}

	testFontBytes := []byte{0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x10, 0x00, 0x03, 0x00, 0x00}
	if err := os.WriteFile(filepath.Join(fontsDir, fontFilename), testFontBytes, 0o644); err != nil {
		t.Fatalf("failed to write test font: %v", err)
	}

	_, err := srv.DB.Exec(`
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash)
		VALUES (?, 'Montserrat', 'Montserrat Light', '300', 'normal', 'ttf', ?, 'hash1234')
	`, fontID, fontFilename)
	if err != nil {
		t.Fatalf("failed to insert test font into DB: %v", err)
	}

	// 1. Test listFonts
	req := httptest.NewRequest("GET", "/api/fonts", nil)
	req = withSession(req, adminSess)
	rec := httptest.NewRecorder()
	srv.listFonts(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("listFonts returned status %d, want 200", rec.Code)
	}
	var fontList []FontFaceResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &fontList); err != nil {
		t.Fatalf("failed to parse fonts json: %v", err)
	}
	if len(fontList) != 1 {
		t.Fatalf("expected 1 font, got %d", len(fontList))
	}
	if fontList[0].Family != "Montserrat" || fontList[0].Weight != "300" {
		t.Errorf("unexpected font data: %+v", fontList[0])
	}
	if fontList[0].URL != "/api/fonts/"+fontID {
		t.Errorf("expected URL /api/fonts/%s, got %s", fontID, fontList[0].URL)
	}

	// 2. Test getFont (download with headers)
	reqGet := httptest.NewRequest("GET", "/api/fonts/"+fontID, nil)
	reqGet.SetPathValue("id", fontID)
	reqGet = withSession(reqGet, adminSess)
	recGet := httptest.NewRecorder()
	srv.getFont(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("getFont returned status %d, want 200", recGet.Code)
	}
	if ct := recGet.Header().Get("Content-Type"); ct != "font/ttf" {
		t.Errorf("expected Content-Type font/ttf, got %s", ct)
	}
	if nosniff := recGet.Header().Get("X-Content-Type-Options"); nosniff != "nosniff" {
		t.Errorf("expected X-Content-Type-Options nosniff, got %s", nosniff)
	}
	if cache := recGet.Header().Get("Cache-Control"); cache != "public, max-age=31536000, immutable" {
		t.Errorf("expected immutable cache header, got %s", cache)
	}
	if recGet.Body.Len() != len(testFontBytes) {
		t.Errorf("downloaded font length = %d, want %d", recGet.Body.Len(), len(testFontBytes))
	}

	// 3. Traversal / invalid ID rejection
	reqBad := httptest.NewRequest("GET", "/api/fonts/invalid..id", nil)
	reqBad.SetPathValue("id", "invalid..id")
	reqBad = withSession(reqBad, adminSess)
	recBad := httptest.NewRecorder()
	srv.getFont(recBad, reqBad)
	if recBad.Code != http.StatusBadRequest {
		t.Errorf("expected traversal rejection 400, got %d", recBad.Code)
	}

	// 4. Nonexistent font -> 404
	req404 := httptest.NewRequest("GET", "/api/fonts/00000000000000000000000000000000", nil)
	req404.SetPathValue("id", "00000000000000000000000000000000")
	req404 = withSession(req404, adminSess)
	rec404 := httptest.NewRecorder()
	srv.getFont(rec404, req404)
	if rec404.Code != http.StatusNotFound {
		t.Errorf("expected 404 for nonexistent font, got %d", rec404.Code)
	}
}

func makeTestPptxWithFont(t *testing.T, fontBytes []byte) []byte {
	t.Helper()
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	files := map[string]string{
		"[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
		"ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:embeddedFontLst>
    <p:embeddedFont>
      <p:font typeface="RollbackFont"/>
      <p:regular r:id="rIdFont"/>
    </p:embeddedFont>
  </p:embeddedFontLst>
</p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rIdFont" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/rollback.ttf"/>
</Relationships>`,
		"ppt/slides/slide1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TitleText"/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="5000000" cy="2000000"/></a:xfrm></p:spPr>
        <p:txBody><p:p><a:r><a:rPr sz="3200"><a:latin typeface="RollbackFont"/></a:rPr><a:t>Rollback Text</a:t></a:r></p:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
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

	w, err := zw.Create("ppt/fonts/rollback.ttf")
	if err != nil {
		t.Fatalf("failed to create font entry: %v", err)
	}
	if _, err := w.Write(fontBytes); err != nil {
		t.Fatalf("failed to write font bytes: %v", err)
	}

	if err := zw.Close(); err != nil {
		t.Fatalf("failed to close zip: %v", err)
	}
	return buf.Bytes()
}

func TestImportPptxFontPromotionRollback(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)

	validTTF := []byte{
		0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x10, 0x00, 0x03, 0x00, 0x00,
		'h', 'e', 'a', 'd', 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1C, 0x00, 0x00, 0x00, 0x04,
		0x01, 0x02, 0x03, 0x04,
	}

	pptxBytes := makeTestPptxWithFont(t, validTTF)

	// Intercept testHookWriteFile to fail specifically when writing into fonts directory
	testHookWriteFile = func(dst string, data []byte, perm os.FileMode) error {
		if filepath.Base(filepath.Dir(dst)) == "fonts" {
			_ = os.WriteFile(dst, []byte("corrupted font partial"), perm)
			return errors.New("simulated disk write failure for font")
		}
		return os.WriteFile(dst, data, perm)
	}
	defer func() { testHookWriteFile = os.WriteFile }()

	req, _ := makeMultipartRequest(t, "rollback_deck.pptx", pptxBytes)
	req = withSession(req, adminSess)
	rec := httptest.NewRecorder()
	srv.importPptx(rec, req)

	// Must fail with 500
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 on font promotion failure, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify database transaction rolled back: 0 font_faces, 0 artifact_templates
	var fontCount, tmplCount int
	if err := srv.DB.QueryRow("SELECT COUNT(*) FROM font_faces").Scan(&fontCount); err != nil {
		t.Fatalf("failed to query font_faces: %v", err)
	}
	if fontCount != 0 {
		t.Errorf("expected 0 font_faces after rollback, got %d", fontCount)
	}

	if err := srv.DB.QueryRow("SELECT COUNT(*) FROM artifact_templates").Scan(&tmplCount); err != nil {
		t.Fatalf("failed to query artifact_templates: %v", err)
	}
	if tmplCount != 0 {
		t.Errorf("expected 0 artifact_templates after rollback, got %d", tmplCount)
	}

	// Verify destination fonts directory has 0 promoted files
	destFontsDir := filepath.Join(uploadsDir(), "fonts")
	entries, _ := os.ReadDir(destFontsDir)
	if len(entries) != 0 {
		t.Errorf("expected 0 files in fonts directory after rollback, found %d", len(entries))
	}
}
