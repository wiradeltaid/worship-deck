package httpapi

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestDeleteService_UnlinksOrphanedUploads(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	fileA := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"
	fileB := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg"
	pathA := filepath.Join(uploadsDir, fileA)
	pathB := filepath.Join(uploadsDir, fileB)

	if err := os.WriteFile(pathA, []byte("fake-image-a"), 0o644); err != nil {
		t.Fatalf("write fileA: %v", err)
	}
	if err := os.WriteFile(pathB, []byte("fake-image-b"), 0o644); err != nil {
		t.Fatalf("write fileB: %v", err)
	}

	// Create service with fileA in images
	createPayload := fmt.Sprintf(`{
		"date": "2026-10-04",
		"raw_payload": "SABBATH, OCTOBER 4, 2026\nDIVINE SERVICE",
		"images": ["/api/uploads/%s"]
	}`, fileA)
	res := songSetRequest(t, ts, "POST", "/api/services", createPayload, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create service = %d, want 200/201", res.StatusCode)
	}
	res.Body.Close()

	var serviceID int
	var updatedAt string
	err := db.QueryRow(`SELECT id, COALESCE(updated_at, created_at) FROM services WHERE date = '2026-10-04'`).Scan(&serviceID, &updatedAt)
	if err != nil {
		t.Fatalf("query service: %v", err)
	}

	// Add fileB into service_field_values
	_, err = db.Exec(`
		INSERT INTO service_field_values (service_id, variable_name, value_text)
		VALUES (?, 'sermon_poster', ?)
	`, serviceID, "/api/uploads/"+fileB)
	if err != nil {
		t.Fatalf("insert field value: %v", err)
	}

	// Delete service
	deleteURL := fmt.Sprintf("/api/services/%d?updated_at=%s", serviceID, url.QueryEscape(updatedAt))
	req, _ := http.NewRequest("DELETE", ts.URL+deleteURL, nil)
	req.AddCookie(cookie)
	delRes, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete service: %v", err)
	}
	if delRes.StatusCode != http.StatusOK {
		t.Fatalf("delete service = %d, want 200", delRes.StatusCode)
	}
	delRes.Body.Close()

	// Assert both fileA and fileB are unlinked from disk
	if _, err := os.Stat(pathA); !os.IsNotExist(err) {
		t.Errorf("fileA should have been unlinked from disk, but still exists")
	}
	if _, err := os.Stat(pathB); !os.IsNotExist(err) {
		t.Errorf("fileB should have been unlinked from disk, but still exists")
	}
}

func TestDeleteService_PreservesFilesReferencedByOtherServices(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	fileShared := "cccccccccccccccccccccccccccccccc.jpg"
	pathShared := filepath.Join(uploadsDir, fileShared)
	if err := os.WriteFile(pathShared, []byte("shared-image"), 0o644); err != nil {
		t.Fatalf("write fileShared: %v", err)
	}

	// Create service 1 referencing fileShared
	create1 := fmt.Sprintf(`{"date": "2026-10-11", "raw_payload": "SABBATH, OCTOBER 11, 2026\nDIVINE SERVICE", "images_payload": ["/api/uploads/%s"]}`, fileShared)
	res := songSetRequest(t, ts, "POST", "/api/services", create1, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create service 1 = %d", res.StatusCode)
	}
	res.Body.Close()

	// Create service 2 referencing fileShared
	create2 := fmt.Sprintf(`{"date": "2026-10-18", "raw_payload": "SABBATH, OCTOBER 18, 2026\nDIVINE SERVICE", "images_payload": ["/api/uploads/%s"]}`, fileShared)
	res = songSetRequest(t, ts, "POST", "/api/services", create2, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create service 2 = %d", res.StatusCode)
	}
	res.Body.Close()

	var id1 int
	var updated1 string
	_ = db.QueryRow(`SELECT id, COALESCE(updated_at, created_at) FROM services WHERE date = '2026-10-11'`).Scan(&id1, &updated1)

	// Delete service 1
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/services/%d?updated_at=%s", ts.URL, id1, url.QueryEscape(updated1)), nil)
	req.AddCookie(cookie)
	delRes, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete service 1: %v", err)
	}
	if delRes.StatusCode != http.StatusOK {
		t.Fatalf("delete service 1 = %d", delRes.StatusCode)
	}
	delRes.Body.Close()

	// fileShared must still exist because service 2 references it
	if _, err := os.Stat(pathShared); os.IsNotExist(err) {
		t.Errorf("fileShared was deleted, but it is still referenced by service 2")
	}
}

func TestDeleteService_PreservesFilesReferencedByAnnouncementItems(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	fileAnn := "dddddddddddddddddddddddddddddddd.jpg"
	pathAnn := filepath.Join(uploadsDir, fileAnn)
	if err := os.WriteFile(pathAnn, []byte("announcement-flyer"), 0o644); err != nil {
		t.Fatalf("write fileAnn: %v", err)
	}

	// Create service 1
	create := `{"date": "2026-10-25", "raw_payload": "SABBATH, OCTOBER 25, 2026\nDIVINE SERVICE"}`
	res := songSetRequest(t, ts, "POST", "/api/services", create, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create service = %d", res.StatusCode)
	}
	res.Body.Close()

	var sID int
	var updated string
	_ = db.QueryRow(`SELECT id, COALESCE(updated_at, created_at) FROM services WHERE date = '2026-10-25'`).Scan(&sID, &updated)

	// Insert announcement item referencing fileAnn with service_id = sID
	_, err := db.Exec(`
		INSERT INTO announcement_items (image_url, service_id, sort_order)
		VALUES (?, ?, 1)
	`, "/api/uploads/"+fileAnn, sID)
	if err != nil {
		t.Fatalf("insert announcement item: %v", err)
	}

	// Delete service
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/services/%d?updated_at=%s", ts.URL, sID, url.QueryEscape(updated)), nil)
	req.AddCookie(cookie)
	delRes, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete service: %v", err)
	}
	if delRes.StatusCode != http.StatusOK {
		t.Fatalf("delete service = %d", delRes.StatusCode)
	}
	delRes.Body.Close()

	// fileAnn must still exist because announcement_items owns it
	if _, err := os.Stat(pathAnn); os.IsNotExist(err) {
		t.Errorf("fileAnn was deleted, but it is an announcement flyer that must remain untouched")
	}

	// And announcement_items row still survives (service_id is not cascaded)
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM announcement_items WHERE image_url = ?`, "/api/uploads/"+fileAnn).Scan(&count)
	if count != 1 {
		t.Errorf("announcement_items row count = %d, want 1", count)
	}
}

func TestDeleteService_PreservesFilesReferencedByArtifactTemplatesOrBackgrounds(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	fileBg := "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.jpg"
	pathBg := filepath.Join(uploadsDir, fileBg)
	if err := os.WriteFile(pathBg, []byte("bg-image"), 0o644); err != nil {
		t.Fatalf("write fileBg: %v", err)
	}

	// Service 1 references fileBg
	create := fmt.Sprintf(`{"date": "2026-11-01", "raw_payload": "SABBATH, NOVEMBER 1, 2026\nDIVINE SERVICE", "images_payload": ["/api/uploads/%s"]}`, fileBg)
	res := songSetRequest(t, ts, "POST", "/api/services", create, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create service = %d", res.StatusCode)
	}
	res.Body.Close()

	var sID int
	var updated string
	_ = db.QueryRow(`SELECT id, COALESCE(updated_at, created_at) FROM services WHERE date = '2026-11-01'`).Scan(&sID, &updated)

	// Add fileBg to background_library_images
	_, err := db.Exec(`
		INSERT INTO background_library_images (url, name, category)
		VALUES (?, 'Custom BG', 'background')
	`, "/api/uploads/"+fileBg)
	if err != nil {
		t.Fatalf("insert background library image: %v", err)
	}

	// Delete service
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/services/%d?updated_at=%s", ts.URL, sID, url.QueryEscape(updated)), nil)
	req.AddCookie(cookie)
	delRes, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete service: %v", err)
	}
	if delRes.StatusCode != http.StatusOK {
		t.Fatalf("delete service = %d", delRes.StatusCode)
	}
	delRes.Body.Close()

	// fileBg must still exist
	if _, err := os.Stat(pathBg); os.IsNotExist(err) {
		t.Errorf("fileBg was deleted, but it is referenced by background_library_images")
	}
}

func TestDeleteService_MissingFileOnDiskDoesNotFailDelete(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	fileMissing := "ffffffffffffffffffffffffffffffff.jpg"
	// Do NOT create the file on disk

	create := fmt.Sprintf(`{"date": "2026-11-08", "raw_payload": "SABBATH, NOVEMBER 8, 2026\nDIVINE SERVICE", "images_payload": ["/api/uploads/%s"]}`, fileMissing)
	res := songSetRequest(t, ts, "POST", "/api/services", create, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create service = %d", res.StatusCode)
	}
	res.Body.Close()

	var sID int
	var updated string
	_ = db.QueryRow(`SELECT id, COALESCE(updated_at, created_at) FROM services WHERE date = '2026-11-08'`).Scan(&sID, &updated)

	// Delete service should succeed even if file is missing
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/api/services/%d?updated_at=%s", ts.URL, sID, url.QueryEscape(updated)), nil)
	req.AddCookie(cookie)
	delRes, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("delete service: %v", err)
	}
	if delRes.StatusCode != http.StatusOK {
		t.Fatalf("delete service = %d, want 200", delRes.StatusCode)
	}
	delRes.Body.Close()

	// Service row is gone
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM services WHERE id = ?`, sID).Scan(&count)
	if count != 0 {
		t.Errorf("service count = %d, want 0", count)
	}
}
