package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/desktop"
)

func TestFohSync_UnpairedReturnsBadRequest(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)
	tempDataDir := t.TempDir()
	srv.DataDir = tempDataDir
	srv.IsDesktop = true

	handler := srv.Handler()

	req := httptest.NewRequest("POST", "/api/desktop/sync/pull-cloud", strings.NewReader(`{}`))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when unpaired, got %d: %s", w.Code, w.Body.String())
	}
}

func TestFohSync_PullSuccessAndMediaStreaming(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)
	tempDataDir := t.TempDir()
	srv.DataDir = tempDataDir
	srv.IsDesktop = true

	uploadsPath := filepath.Join(tempDataDir, "uploads")
	_ = os.MkdirAll(uploadsPath, 0755)
	t.Setenv("UPLOADS_DIR", uploadsPath)

	handler := srv.Handler()

	// 1. Create a dummy media asset on mock cloud
	testImageContent := []byte("fake-png-image-content-for-worship-deck-sync-test")
	hasher := sha256.New()
	hasher.Write(testImageContent)
	imageHash := hex.EncodeToString(hasher.Sum(nil))
	imageFilename := fmt.Sprintf("%s.png", imageHash)

	validSecret := "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"
	validToken := "foh_tenant123." + validSecret

	// 2. Mock Cloud Instance
	mockCloud := httptest.NewServer(http.HandlerFunc(func(cw http.ResponseWriter, cr *http.Request) {
		authHeader := cr.Header.Get("Authorization")
		if authHeader != "Bearer "+validToken {
			cw.WriteHeader(http.StatusUnauthorized)
			return
		}

		switch {
		case cr.URL.Path == "/api/sync/pull":
			cw.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(cw).Encode(map[string]any{
				"server_timestamp": time.Now().UTC().Format(time.RFC3339Nano),
				"cursor":           "rev-100",
				"changes": map[string]any{
					"services": []map[string]any{
						{
							"global_id":   "svc-cloud-01",
							"date":        "2026-10-18",
							"raw_payload": "Cloud Liturgy 2026-10-18",
							"images_payload": []map[string]string{
								{"url": "/api/uploads/" + imageFilename},
							},
							"created_at": time.Now().UTC().Format(time.RFC3339Nano),
							"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
						},
					},
					"hymns": []map[string]any{
						{
							"global_id": "hymn-cloud-01",
							"book_code": "KJ",
							"number":    100,
							"title":     "Berdiam di Hadirat Tuhan",
							"lyrics":    "Berdiam tenang di hadirat-Nya...",
						},
					},
					"background_library_images": []map[string]any{
						{
							"global_id":  "bg-cloud-01",
							"url":        "/api/uploads/" + imageFilename,
							"name":       "Sunday Background",
							"is_default": true,
							"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
						},
					},
				},
				"tombstones": []any{},
			})
		case cr.URL.Path == "/api/sync/assets/"+imageHash:
			cw.Header().Set("Content-Type", "image/png")
			cw.Header().Set("X-Content-SHA256", imageHash)
			_, _ = cw.Write(testImageContent)
		default:
			cw.WriteHeader(http.StatusNotFound)
		}
	}))
	defer mockCloud.Close()

	// 3. Save pairing config
	cfg := &desktop.PairingConfig{
		Version:    1,
		CloudURL:   mockCloud.URL,
		TenantID:   "tenant123",
		ChurchName: "Gereja Contoh Sintetis",
		Token:      validToken,
		PairedAt:   time.Now().UTC(),
	}
	if err := desktop.SavePairingConfig(tempDataDir, cfg); err != nil {
		t.Fatalf("failed to save pairing: %v", err)
	}

	// 4. Trigger Sync Pull: POST /api/desktop/sync/pull-cloud
	req := httptest.NewRequest("POST", "/api/desktop/sync/pull-cloud", strings.NewReader(`{}`))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for pull sync, got %d: %s", w.Code, w.Body.String())
	}

	var syncResp struct {
		OK               bool   `json:"ok"`
		ServicesCount    int    `json:"services_count"`
		HymnsCount       int    `json:"hymns_count"`
		AssetsDownloaded int    `json:"assets_downloaded"`
		BytesTransferred int64  `json:"bytes_transferred"`
		DurationMs       int64  `json:"duration_ms"`
		LastSyncedAt     string `json:"last_synced_at"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &syncResp); err != nil {
		t.Fatalf("failed to parse sync response: %v", err)
	}

	if !syncResp.OK || syncResp.ServicesCount != 1 || syncResp.HymnsCount != 1 {
		t.Errorf("unexpected sync counts: %+v", syncResp)
	}
	if syncResp.AssetsDownloaded != 1 {
		t.Errorf("expected 1 asset downloaded, got %d", syncResp.AssetsDownloaded)
	}

	// 5. Verify local database mutation applied
	var serviceDate string
	err := srv.DB.QueryRow(`SELECT date FROM services WHERE global_id = ?`, "svc-cloud-01").Scan(&serviceDate)
	if err != nil {
		t.Errorf("service was not inserted into database: %v", err)
	}
	if serviceDate != "2026-10-18" {
		t.Errorf("expected service date '2026-10-18', got %q", serviceDate)
	}

	// 6. Verify asset downloaded and matches checksum on disk
	expectedAssetFile := filepath.Join(uploadsPath, imageFilename)
	data, err := os.ReadFile(expectedAssetFile)
	if err != nil {
		t.Fatalf("expected downloaded asset at %s, got error: %v", expectedAssetFile, err)
	}
	if string(data) != string(testImageContent) {
		t.Errorf("asset content corrupted or mismatched")
	}

	// 7. Verify temporary files are cleaned up
	files, _ := filepath.Glob(filepath.Join(uploadsPath, ".tmp_*"))
	if len(files) > 0 {
		t.Errorf("expected no temp files left in uploads dir, found: %v", files)
	}
}

func TestFohSync_CorruptedAssetRejectedAndCleanedUp(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)
	tempDataDir := t.TempDir()
	srv.DataDir = tempDataDir
	srv.IsDesktop = true

	uploadsPath := filepath.Join(tempDataDir, "uploads")
	_ = os.MkdirAll(uploadsPath, 0755)
	t.Setenv("UPLOADS_DIR", uploadsPath)

	handler := srv.Handler()

	corruptHash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	corruptFilename := corruptHash + ".png"

	validSecret := "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"
	validToken := "foh_tenant123." + validSecret

	mockCloud := httptest.NewServer(http.HandlerFunc(func(cw http.ResponseWriter, cr *http.Request) {
		switch {
		case cr.URL.Path == "/api/sync/pull":
			cw.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(cw).Encode(map[string]any{
				"server_timestamp": time.Now().UTC().Format(time.RFC3339Nano),
				"cursor":           "rev-200",
				"changes": map[string]any{
					"services": []map[string]any{
						{
							"global_id":   "svc-corrupt-01",
							"date":        "2026-10-19",
							"raw_payload": "Corrupt test",
							"images_payload": []map[string]string{
								{"url": "/api/uploads/" + corruptFilename},
							},
						},
					},
				},
				"tombstones": []any{},
			})
		case cr.URL.Path == "/api/sync/assets/"+corruptHash:
			// Intentionally return content that DOES NOT match corruptHash
			cw.Header().Set("Content-Type", "image/png")
			_, _ = cw.Write([]byte("this-content-does-not-match-corruptHash"))
		default:
			cw.WriteHeader(http.StatusNotFound)
		}
	}))
	defer mockCloud.Close()

	cfg := &desktop.PairingConfig{
		Version:  1,
		CloudURL: mockCloud.URL,
		TenantID: "tenant123",
		Token:    validToken,
		PairedAt: time.Now().UTC(),
	}
	_ = desktop.SavePairingConfig(tempDataDir, cfg)

	req := httptest.NewRequest("POST", "/api/desktop/sync/pull-cloud", strings.NewReader(`{}`))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Should fail due to checksum mismatch
	if w.Code == http.StatusOK {
		t.Fatalf("expected error response when asset checksum fails, got 200 OK")
	}

	// Verify corrupt file is NOT present in uploads/
	if _, err := os.Stat(filepath.Join(uploadsPath, corruptFilename)); !os.IsNotExist(err) {
		t.Errorf("corrupt asset should not exist in uploads dir")
	}

	// Verify temp file is cleaned up
	files, _ := filepath.Glob(filepath.Join(uploadsPath, ".tmp_*"))
	if len(files) > 0 {
		t.Errorf("expected no temp files left after corrupt asset failure, found: %v", files)
	}

	// Verify database transaction rolled back (service not inserted)
	var count int
	_ = srv.DB.QueryRow(`SELECT count(*) FROM services WHERE global_id = ?`, "svc-corrupt-01").Scan(&count)
	if count != 0 {
		t.Errorf("service should not be committed if asset verification failed")
	}
}
