package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMediaPlaylistRESTAndStreaming(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	uploadsDir := t.TempDir()
	t.Setenv("UPLOADS_DIR", uploadsDir)

	validSHA := strings.Repeat("e", 64)
	filename := validSHA + ".mp4"
	fullPath := filepath.Join(uploadsDir, filename)

	testMediaContent := []byte("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
	if err := os.WriteFile(fullPath, testMediaContent, 0o644); err != nil {
		t.Fatalf("writing test media file: %v", err)
	}

	// 1. Initially empty playlist
	res := songSetRequest(t, ts, "GET", "/api/media/playlist", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/media/playlist expected 200, got %d", res.StatusCode)
	}
	var items []MediaPlaylistItem
	if err := json.NewDecoder(res.Body).Decode(&items); err != nil {
		t.Fatalf("decoding empty playlist: %v", err)
	}
	res.Body.Close()
	if len(items) != 0 {
		t.Fatalf("expected 0 playlist items initially, got %d", len(items))
	}

	// 2. POST /api/media/playlist (Invalid payload validation)
	invalidPayload := `{"name":"","type":"invalid","storage_key":"","size_bytes":-1,"sha256":"bad"}`
	res = songSetRequest(t, ts, "POST", "/api/media/playlist", invalidPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid payload, got %d", res.StatusCode)
	}
	res.Body.Close()

	// 3. POST /api/media/playlist (Valid item 1)
	validPayload1 := fmt.Sprintf(`{
		"id": "item-1",
		"name": "Opening Video",
		"type": "video",
		"storage_key": "%s",
		"size_bytes": %d,
		"duration_ms": 62000,
		"sha256": "%s",
		"order_key": 1.0
	}`, filename, len(testMediaContent), validSHA)
	res = songSetRequest(t, ts, "POST", "/api/media/playlist", validPayload1, cookie)
	if res.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("POST /api/media/playlist item 1 expected 201, got %d: %s", res.StatusCode, b)
	}
	var created1 MediaPlaylistItem
	_ = json.NewDecoder(res.Body).Decode(&created1)
	res.Body.Close()
	if created1.ID != "item-1" || created1.ContentURL != "/api/media/item-1/content" {
		t.Fatalf("unexpected created item fields: %+v", created1)
	}

	// 4. POST /api/media/playlist (Valid item 2)
	validPayload2 := fmt.Sprintf(`{
		"id": "item-2",
		"name": "Background Music",
		"type": "audio",
		"storage_key": "%s",
		"size_bytes": %d,
		"duration_ms": 180000,
		"sha256": "%s",
		"order_key": 2.0
	}`, filename, len(testMediaContent), validSHA)
	res = songSetRequest(t, ts, "POST", "/api/media/playlist", validPayload2, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST /api/media/playlist item 2 expected 201, got %d", res.StatusCode)
	}
	res.Body.Close()

	// 5. GET /api/media/playlist returns 2 ordered items
	res = songSetRequest(t, ts, "GET", "/api/media/playlist", "", cookie)
	_ = json.NewDecoder(res.Body).Decode(&items)
	res.Body.Close()
	if len(items) != 2 || items[0].ID != "item-1" || items[1].ID != "item-2" {
		t.Fatalf("expected 2 ordered items, got: %+v", items)
	}

	// 6. PATCH /api/media/playlist/reorder
	reorderPayload := `{"items":[{"id":"item-1","order_key":20.0},{"id":"item-2","order_key":10.0}]}`
	res = songSetRequest(t, ts, "PATCH", "/api/media/playlist/reorder", reorderPayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("PATCH reorder expected 200, got %d", res.StatusCode)
	}
	res.Body.Close()

	// Verify new order
	res = songSetRequest(t, ts, "GET", "/api/media/playlist", "", cookie)
	_ = json.NewDecoder(res.Body).Decode(&items)
	res.Body.Close()
	if len(items) != 2 || items[0].ID != "item-2" || items[1].ID != "item-1" {
		t.Fatalf("expected reordered items (item-2 first), got: %+v", items)
	}

	// 7. GET /api/media/{id}/content — Full content (200 OK)
	res = songSetRequest(t, ts, "GET", "/api/media/item-1/content", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET content expected 200, got %d", res.StatusCode)
	}
	if res.Header.Get("Accept-Ranges") != "bytes" {
		t.Errorf("expected Accept-Ranges: bytes header, got %q", res.Header.Get("Accept-Ranges"))
	}
	bodyBytes, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if string(bodyBytes) != string(testMediaContent) {
		t.Fatalf("content mismatch: got %q, want %q", bodyBytes, testMediaContent)
	}

	// 8. GET /api/media/{id}/content — Range: bytes=0-9 (206 Partial Content)
	reqRange, err := http.NewRequest("GET", ts.URL+"/api/media/item-1/content", nil)
	if err != nil {
		t.Fatal(err)
	}
	reqRange.AddCookie(cookie)
	reqRange.Header.Set("Range", "bytes=0-9")
	resRange, err := http.DefaultClient.Do(reqRange)
	if err != nil {
		t.Fatal(err)
	}
	if resRange.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected 206 Partial Content, got %d", resRange.StatusCode)
	}
	expectedContentRange := fmt.Sprintf("bytes 0-9/%d", len(testMediaContent))
	if resRange.Header.Get("Content-Range") != expectedContentRange {
		t.Errorf("expected Content-Range: %s, got %s", expectedContentRange, resRange.Header.Get("Content-Range"))
	}
	rangeBody, _ := io.ReadAll(resRange.Body)
	resRange.Body.Close()
	if string(rangeBody) != "0123456789" {
		t.Fatalf("range body mismatch: got %q, want '0123456789'", rangeBody)
	}

	// 9. GET /api/media/{id}/content — Out of bounds range (416 Range Not Satisfiable)
	reqOOB, _ := http.NewRequest("GET", ts.URL+"/api/media/item-1/content", nil)
	reqOOB.AddCookie(cookie)
	reqOOB.Header.Set("Range", "bytes=9999-10000")
	resOOB, err := http.DefaultClient.Do(reqOOB)
	if err != nil {
		t.Fatal(err)
	}
	resOOB.Body.Close()
	if resOOB.StatusCode != http.StatusRequestedRangeNotSatisfiable {
		t.Fatalf("expected 416 Range Not Satisfiable, got %d", resOOB.StatusCode)
	}

	// 10. POST /api/media/assets/{storageKey}/purge with refcount > 0 returns 409 Conflict
	res = songSetRequest(t, ts, "POST", "/api/media/assets/"+filename+"/purge", "", cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when purging referenced asset, got %d", res.StatusCode)
	}
	res.Body.Close()
	if _, err := os.Stat(fullPath); err != nil {
		t.Fatalf("referenced file must not be deleted on 409 conflict: %v", err)
	}

	// 11. DELETE /api/media/playlist/item-1 (Standard unlink without purge)
	res = songSetRequest(t, ts, "DELETE", "/api/media/playlist/item-1", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("DELETE item-1 expected 200, got %d", res.StatusCode)
	}
	var delResult map[string]any
	_ = json.NewDecoder(res.Body).Decode(&delResult)
	res.Body.Close()
	if delResult["deleted"] != true || delResult["purged"] != false {
		t.Fatalf("expected deleted: true, purged: false, got: %+v", delResult)
	}
	if _, err := os.Stat(fullPath); err != nil {
		t.Fatalf("file must still exist after unlinking item-1: %v", err)
	}

	// 12. DELETE /api/media/playlist/item-2?purge=true (Unlinks last reference and purges physical file)
	res = songSetRequest(t, ts, "DELETE", "/api/media/playlist/item-2?purge=true", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("DELETE item-2 with purge expected 200, got %d", res.StatusCode)
	}
	_ = json.NewDecoder(res.Body).Decode(&delResult)
	res.Body.Close()
	if delResult["deleted"] != true || delResult["purged"] != true {
		t.Fatalf("expected deleted: true, purged: true, got: %+v", delResult)
	}
	if _, err := os.Stat(fullPath); !os.IsNotExist(err) {
		t.Fatalf("expected file to be deleted from disk on purge: err=%v", err)
	}
}
