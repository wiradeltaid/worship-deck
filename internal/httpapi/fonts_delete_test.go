package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDeleteFont_Success(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)
	fontsDir := filepath.Join(uploadsDir, "fonts")
	if err := os.MkdirAll(fontsDir, 0o755); err != nil {
		t.Fatalf("mkdir fonts: %v", err)
	}

	fontID := "1122334455667788"
	fileName := "1122334455667788.ttf"
	filePath := filepath.Join(fontsDir, fileName)
	if err := os.WriteFile(filePath, []byte("dummy-font-data"), 0o644); err != nil {
		t.Fatalf("write font file: %v", err)
	}

	// Insert into font_faces
	_, err := db.Exec(`
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash)
		VALUES (?, 'CustomDisplay', 'CustomDisplay-Regular', 'normal', 'normal', 'ttf', ?, '1122334455667788')
	`, fontID, "/api/uploads/fonts/"+fileName)
	if err != nil {
		t.Fatalf("insert font_faces: %v", err)
	}

	// DELETE /api/admin/fonts/{id}
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/admin/fonts/%s", ts.URL, fontID), nil)
	req.AddCookie(cookie)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete font: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete font status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Assert row is gone
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM font_faces WHERE id = ?`, fontID).Scan(&count)
	if count != 0 {
		t.Errorf("expected font_faces row to be deleted, found count = %d", count)
	}

	// Assert file on disk is unlinked
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Errorf("expected font file to be unlinked from disk, but it still exists")
	}
}

func TestDeleteFont_NotFound(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/admin/fonts/9988776655443322", ts.URL), nil)
	req.AddCookie(cookie)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete font: %v", err)
	}
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("delete non-existent font status = %d, want 404", res.StatusCode)
	}
	res.Body.Close()
}

func TestDeleteFont_ForbiddenForNonAdmin(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)

	// 1. No cookie (unauthenticated) -> 401
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/admin/fonts/1122334455667788", ts.URL), nil)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete font: %v", err)
	}
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthenticated delete font status = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 2. Operator role (non-admin) -> 403 Forbidden
	srv, _, opSess := setupTestServer(t)
	req2 := httptest.NewRequest("DELETE", "/api/admin/fonts/1122334455667788", nil)
	req2.SetPathValue("id", "1122334455667788")
	req2 = withSession(req2, opSess)
	rec := httptest.NewRecorder()
	srv.deleteFont(rec, req2)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("operator delete font code = %d, want 403", rec.Code)
	}
}

func TestDeleteFont_ConflictWhenReferencedByLiveTemplate(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)
	fontsDir := filepath.Join(uploadsDir, "fonts")
	_ = os.MkdirAll(fontsDir, 0o755)

	fontID := "a1a2a3a4b1b2b3b4"
	fileName := "a1a2a3a4b1b2b3b4.ttf"
	filePath := filepath.Join(fontsDir, fileName)
	_ = os.WriteFile(filePath, []byte("font-bytes"), 0o644)

	_, err := db.Exec(`
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash)
		VALUES (?, 'ActiveDisplay', 'ActiveDisplay-Bold', 'bold', 'normal', 'ttf', ?, 'activehash123')
	`, fontID, "/api/uploads/fonts/"+fileName)
	if err != nil {
		t.Fatalf("insert font_faces: %v", err)
	}

	// Insert live artifact_template referencing ActiveDisplay in payload
	tplPayload := `{"schemaVersion":1,"id":"live-tpl-font","label":"Live Template","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#000000","elements":[{"id":"el-1","type":"text","style":{"fontFamily":"ActiveDisplay"}}]}}}`
	_, err = db.Exec(`
		INSERT INTO artifact_templates (id, label, base_type, payload, updated_at)
		VALUES ('live-tpl-font', 'Live Template', 'general', ?, '2026-09-01T00:00:00Z')
	`, tplPayload)
	if err != nil {
		t.Fatalf("insert live template: %v", err)
	}

	// DELETE should be refused with 409 Conflict
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/admin/fonts/%s", ts.URL, fontID), nil)
	req.AddCookie(cookie)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete font: %v", err)
	}
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("delete referenced font status = %d, want 409", res.StatusCode)
	}
	var conflictResp map[string]any
	_ = json.NewDecoder(res.Body).Decode(&conflictResp)
	res.Body.Close()

	if conflictResp["family"] != "ActiveDisplay" {
		t.Errorf("conflict family = %v, want ActiveDisplay", conflictResp["family"])
	}

	// Font row and file must survive
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM font_faces WHERE id = ?`, fontID).Scan(&count)
	if count != 1 {
		t.Errorf("font_faces row was deleted despite conflict! count = %d", count)
	}
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Errorf("font file was unlinked despite conflict!")
	}
}

func TestDeleteFont_SucceedsWhenReferencedOnlyByHistoricalSnapshot(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)
	fontsDir := filepath.Join(uploadsDir, "fonts")
	_ = os.MkdirAll(fontsDir, 0o755)

	fontID := "c1c2c3c4d1d2d3d4"
	fileName := "c1c2c3c4d1d2d3d4.ttf"
	filePath := filepath.Join(fontsDir, fileName)
	_ = os.WriteFile(filePath, []byte("hist-font-bytes"), 0o644)

	_, err := db.Exec(`
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash)
		VALUES (?, 'HistoricalDisplay', 'HistoricalDisplay-Regular', 'normal', 'normal', 'ttf', ?, 'histhash123')
	`, fontID, "/api/uploads/fonts/"+fileName)
	if err != nil {
		t.Fatalf("insert font_faces: %v", err)
	}

	// Insert historical snapshot in service_registry_snapshots (not in live artifact_templates)
	_, _ = db.Exec(`INSERT INTO services (id, date, raw_payload) VALUES (999, '2026-08-01', 'Old Service')`)
	snapPayload := `{"schemaVersion":1,"id":"snap-tpl-1","label":"Old Service Template","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#000000","elements":[{"id":"el-1","type":"text","style":{"fontFamily":"HistoricalDisplay"}}]}}}`
	_, err = db.Exec(`
		INSERT INTO service_registry_snapshots (service_id, template_id, position, label, base_type, payload, updated_at)
		VALUES (999, 'snap-tpl-1', 0, 'Old Service Template', 'general', ?, '2026-08-01T00:00:00Z')
	`, snapPayload)
	if err != nil {
		t.Fatalf("insert snapshot: %v", err)
	}

	// Deleting font referenced ONLY in historical snapshot must succeed (200)
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/admin/fonts/%s", ts.URL, fontID), nil)
	req.AddCookie(cookie)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete font: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete historical-only referenced font status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Row deleted and file unlinked
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM font_faces WHERE id = ?`, fontID).Scan(&count)
	if count != 0 {
		t.Errorf("font_faces row not deleted, count = %d", count)
	}
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Errorf("font file was not unlinked!")
	}
}

func TestDeleteFont_MissingFileOnDiskDoesNotFailDelete(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	fontID := "e1e2e3e4f1f2f3f4"
	_, err := db.Exec(`
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash)
		VALUES (?, 'MissingOnDisk', 'MissingOnDisk-Regular', 'normal', 'normal', 'ttf', 'missingdisk.ttf', 'misshash123')
	`, fontID)
	if err != nil {
		t.Fatalf("insert font_faces: %v", err)
	}

	// Delete should succeed even if file is missing from disk
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/admin/fonts/%s", ts.URL, fontID), nil)
	req.AddCookie(cookie)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete font: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete font with missing file status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM font_faces WHERE id = ?`, fontID).Scan(&count)
	if count != 0 {
		t.Errorf("expected font_faces row to be deleted, got count = %d", count)
	}
}
