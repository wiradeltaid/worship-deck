package httpapi

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/wiradigitalid/worship-presenter-web/internal/auth"
	"github.com/wiradigitalid/worship-presenter-web/internal/db"
	"github.com/wiradigitalid/worship-presenter-web/internal/pptximport"
)

// Helper to create synthetic 16:9 PPTX payload
func makeSynthetic16x9PPTX(t *testing.T) []byte {
	t.Helper()
	buf := new(bytes.Buffer)
	zw := multipart.NewWriter(buf)
	_ = zw // used below

	// We can use the generator from pptximport package
	return pptximport.MakeSyntheticTestDeck(12192000, 6858000, "Synthetic Welcome Slide")
}

func setupTestServer(t *testing.T) (*Server, *auth.Session, *auth.Session) {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	t.Setenv("UPLOADS_DIR", filepath.Join(tempDir, "uploads"))

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	srv := &Server{
		DB: database,
	}

	adminSess := &auth.Session{
		UID:  1,
		Role: "admin",
		SID:  "admin-sess-123",
		TV:   1,
		Exp:  time.Now().Add(1 * time.Hour).Unix(),
	}

	operatorSess := &auth.Session{
		UID:  2,
		Role: "operator",
		SID:  "op-sess-123",
		TV:   1,
		Exp:  time.Now().Add(1 * time.Hour).Unix(),
	}

	return srv, adminSess, operatorSess
}

func makeMultipartRequest(t *testing.T, filename string, content []byte) (*http.Request, string) {
	t.Helper()
	body := new(bytes.Buffer)
	mw := multipart.NewWriter(body)

	part, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(content)); err != nil {
		t.Fatalf("failed to copy content: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/admin/artifacts/import-pptx", body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return req, mw.FormDataContentType()
}

func TestImportPptxAuthorization(t *testing.T) {
	srv, adminSess, operatorSess := setupTestServer(t)

	pptxBytes := makeSynthetic16x9PPTX(t)

	// 1. Unauthenticated -> 403 (or 401 via gate)
	req1, _ := makeMultipartRequest(t, "deck.pptx", pptxBytes)
	rec1 := httptest.NewRecorder()
	srv.importPptx(rec1, req1)
	if rec1.Code != http.StatusForbidden {
		t.Errorf("expected 403 for unauthenticated, got %d", rec1.Code)
	}

	// 2. Operator session -> 403
	req2, _ := makeMultipartRequest(t, "deck.pptx", pptxBytes)
	req2 = withSession(req2, operatorSess)
	rec2 := httptest.NewRecorder()
	srv.importPptx(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Errorf("expected 403 for operator, got %d", rec2.Code)
	}

	// 3. Admin session with invalid file ext -> 400
	req3, _ := makeMultipartRequest(t, "deck.txt", []byte("plain text"))
	req3 = withSession(req3, adminSess)
	rec3 := httptest.NewRecorder()
	srv.importPptx(rec3, req3)
	if rec3.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for .txt file, got %d", rec3.Code)
	}

	// 4. Admin session with valid 16:9 PPTX -> 201
	req4, _ := makeMultipartRequest(t, "deck.pptx", pptxBytes)
	req4 = withSession(req4, adminSess)
	rec4 := httptest.NewRecorder()
	srv.importPptx(rec4, req4)
	if rec4.Code != http.StatusCreated {
		t.Fatalf("expected 201 for valid PPTX, got %d: %s", rec4.Code, rec4.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(rec4.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode json response: %v", err)
	}

	if count, ok := res["importedCount"].(float64); !ok || count != 1 {
		t.Errorf("expected importedCount 1, got %v", res["importedCount"])
	}

	// Verify database row
	var baseType, label string
	err := srv.DB.QueryRow("SELECT base_type, label FROM artifact_templates WHERE label = 'Imported Slide 1'").Scan(&baseType, &label)
	if err != nil {
		t.Fatalf("failed to find imported template in database: %v", err)
	}
	if baseType != "general" {
		t.Errorf("expected base_type 'general', got '%s'", baseType)
	}
}

func TestImportPptxAtomicRollback(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)

	// Multi-slide deck: slide 1 has an image, slide 2 has broken XML.
	// This proves that even though slide 1 had image assets, the failure
	// of slide 2 rolls back everything: 0 database rows and 0 upload files!
	twoSlideDeck := pptximport.MakeTwoSlideDeckWithImageAndBrokenSlide(12192000, 6858000)

	req, _ := makeMultipartRequest(t, "deck.pptx", twoSlideDeck)
	req = withSession(req, adminSess)
	rec := httptest.NewRecorder()
	srv.importPptx(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for deck with broken slide 2, got %d", rec.Code)
	}

	// 1. Verify database has ZERO template rows committed
	var count int
	if err := srv.DB.QueryRow("SELECT COUNT(*) FROM artifact_templates").Scan(&count); err != nil {
		t.Fatalf("failed to query database: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 templates in database, got %d", count)
	}

	// 2. Verify uploads directory has ZERO promoted files
	entries, err := os.ReadDir(uploadsDir())
	if err != nil && !os.IsNotExist(err) {
		t.Fatalf("failed to read uploads directory: %v", err)
	}
	if len(entries) > 0 {
		t.Errorf("expected 0 files in uploads directory after rollback, found %d files", len(entries))
	}
}

func TestImportPptxAtomicRollbackOnPromotionFailure(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)

	// Valid 16:9 PPTX deck with 2 slides and 2 distinct images
	pptxBytes := pptximport.MakeTwoSlideDeckWithTwoImages(12192000, 6858000)

	// Inject fault on 2nd image write:
	// Image 0 (slide 1) will be written to uploadsDir() successfully.
	// On Image 1 (slide 2), simulate a partial write failure that creates a partial file on dst
	// and returns an error!
	// Invariant: os.Remove(dst) removes the partial file, and rollbackPromotedFiles() cleans up
	// Image 0, leaving exactly 0 files in uploadsDir()!
	writeCount := 0
	testHookWriteFile = func(dst string, data []byte, perm os.FileMode) error {
		writeCount++
		if writeCount == 2 {
			// Write partial/corrupted bytes to destination before failing
			_ = os.WriteFile(dst, []byte("partial corrupted data"), perm)
			return errors.New("simulated disk I/O failure during image 2 write")
		}
		return os.WriteFile(dst, data, perm)
	}
	defer func() { testHookWriteFile = os.WriteFile }()

	req, _ := makeMultipartRequest(t, "deck.pptx", pptxBytes)
	req = withSession(req, adminSess)
	rec := httptest.NewRecorder()
	srv.importPptx(rec, req)

	// Must fail with internal server error 500
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when promotion fails on image 2, got %d: %s", rec.Code, rec.Body.String())
	}

	// 1. Verify database transaction was rolled back: 0 templates inserted
	var count int
	if err := srv.DB.QueryRow("SELECT COUNT(*) FROM artifact_templates").Scan(&count); err != nil {
		t.Fatalf("failed to query database: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 templates committed after promotion failure, got %d", count)
	}

	// 2. Verify uploads directory has ZERO files left:
	// Partial file on image 2 was removed by os.Remove(dst), and image 1 was removed by rollbackPromotedFiles()!
	entries, err := os.ReadDir(uploadsDir())
	if err != nil && !os.IsNotExist(err) {
		t.Fatalf("failed to read uploads directory: %v", err)
	}
	if len(entries) > 0 {
		t.Errorf("expected 0 files in uploads directory after rollback, found %d promoted files left behind", len(entries))
	}
}

func makeSyntheticCustomFontPPTX(t *testing.T, customFont1, customFont2 string) []byte {
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
</p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`,
		"ppt/slides/slide1.xml": fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="AcquiredShape"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="5000000" cy="1000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <p:p><a:r><a:rPr sz="3200"><a:latin typeface="%s"/></a:rPr><a:t>Acquired Text</a:t></a:r></p:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="UnacquiredShape"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="3000000"/><a:ext cx="5000000" cy="1000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <p:p><a:r><a:rPr sz="3200"><a:latin typeface="%s"/></a:rPr><a:t>Unacquired Text</a:t></a:r></p:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`, customFont1, customFont2),
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
	if err := zw.Close(); err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}
	return buf.Bytes()
}

func TestImportPptx_ReconcilesExistingCustomFontsInSQLite(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)

	// Pre-seed SQLite font_faces with a custom font from a prior import session
	_, err := srv.DB.Exec(`
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash, is_restricted)
		VALUES ('font-seed-1', 'Montserrat Custom', 'Montserrat Custom Semibold', '600', 'normal', 'woff2', 'fonts/seed.woff2', 'hash123', 0)
	`)
	if err != nil {
		t.Fatalf("failed to seed font_faces: %v", err)
	}

	// Slide uses source_typeface "Montserrat Custom Semibold" which matches font_faces.source_typeface
	// Second text run uses "CompletelyMissingFontXYZ" which is absent from font_faces
	pptxBytes := makeSyntheticCustomFontPPTX(t, "Montserrat Custom Semibold", "CompletelyMissingFontXYZ")
	req, _ := makeMultipartRequest(t, "deck.pptx", pptxBytes)
	req = withSession(req, adminSess)
	rec := httptest.NewRecorder()
	srv.importPptx(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		FirstTemplate struct {
			Layouts struct {
				Default struct {
					Elements []struct {
						Style map[string]any `json:"style"`
					} `json:"elements"`
				} `json:"default"`
			} `json:"layouts"`
		} `json:"firstTemplate"`
		Templates []struct {
			ID    string `json:"id"`
			Label string `json:"label"`
		} `json:"templates"`
		Warnings []string `json:"warnings"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(resp.Templates) != 1 {
		t.Fatalf("expected 1 template, got %d", len(resp.Templates))
	}

	elements := resp.FirstTemplate.Layouts.Default.Elements
	if len(elements) != 2 {
		t.Fatalf("expected 2 elements, got %d", len(elements))
	}

	// 1. First element ("Montserrat Custom Semibold") matches pre-seeded font_faces
	// Invariant: fontStatus must be reconciled to "uploaded", NOT "unresolved"
	status1, _ := elements[0].Style["fontStatus"].(string)
	if status1 != "uploaded" {
		t.Errorf("expected pre-seeded font to have fontStatus 'uploaded', got %q", status1)
	}

	// 2. Second element ("CompletelyMissingFontXYZ") was never seeded
	// Invariant: fontStatus must remain "unresolved"
	status2, _ := elements[1].Style["fontStatus"].(string)
	if status2 != "unresolved" {
		t.Errorf("expected missing font to have fontStatus 'unresolved', got %q", status2)
	}

	// 3. Invariant: Aggregate warnings must not complain about Montserrat Custom Semibold
	for _, w := range resp.Warnings {
		if strings.Contains(w, "Montserrat Custom") {
			t.Errorf("unexpected warning for pre-seeded font: %s", w)
		}
	}

	// 4. Invariant: Aggregate warnings MUST complain about CompletelyMissingFontXYZ
	foundMissingWarn := false
	for _, w := range resp.Warnings {
		if strings.Contains(w, "CompletelyMissingFontXYZ") {
			foundMissingWarn = true
			break
		}
	}
	if !foundMissingWarn {
		t.Errorf("expected unacquired warning for CompletelyMissingFontXYZ in response warnings")
	}
}
