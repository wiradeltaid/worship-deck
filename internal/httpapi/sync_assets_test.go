package httpapi

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

func TestSyncAssets_EndToEnd(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Ensure temp uploads directory
	tmpUploads, err := os.MkdirTemp("", "wpw-sync-assets-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpUploads)
	t.Setenv("UPLOADS_DIR", tmpUploads)

	sampleData := []byte("Worship Presenter Web Asset Sync Content 2026")
	hasher := sha256.New()
	hasher.Write(sampleData)
	sampleHash := hex.EncodeToString(hasher.Sum(nil))

	// 1. Check asset initially: must be reported missing
	checkPayload := fmt.Sprintf(`{"hashes":["%s", "0000000000000000000000000000000000000000000000000000000000000000"]}`, sampleHash)
	checkRes := songSetRequest(t, ts, "POST", "/api/sync/assets/check", checkPayload, cookie)
	if checkRes.StatusCode != http.StatusOK {
		t.Fatalf("check assets = %d", checkRes.StatusCode)
	}
	var checkBody struct {
		Missing []string `json:"missing"`
	}
	_ = json.NewDecoder(checkRes.Body).Decode(&checkBody)
	checkRes.Body.Close()

	if len(checkBody.Missing) != 2 {
		t.Fatalf("expected 2 missing assets, got %d (%v)", len(checkBody.Missing), checkBody.Missing)
	}

	// 2a. Upload asset without X-Content-SHA256 header -> 400 Bad Request
	reqNoHeader, _ := http.NewRequest("POST", ts.URL+"/api/sync/assets/upload?filename=flyer.png", bytes.NewReader(sampleData))
	reqNoHeader.AddCookie(cookie)
	noHeaderRes, err := ts.Client().Do(reqNoHeader)
	if err != nil {
		t.Fatal(err)
	}
	if noHeaderRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for missing X-Content-SHA256, got %d", noHeaderRes.StatusCode)
	}
	noHeaderRes.Body.Close()

	// 2b. Upload asset with mismatched hash -> 400 Bad Request
	reqBad, _ := http.NewRequest("POST", ts.URL+"/api/sync/assets/upload?filename=flyer.png", bytes.NewReader(sampleData))
	reqBad.AddCookie(cookie)
	reqBad.Header.Set("X-Content-SHA256", "1111111111111111111111111111111111111111111111111111111111111111")
	badRes, err := ts.Client().Do(reqBad)
	if err != nil {
		t.Fatal(err)
	}
	if badRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for hash mismatch, got %d", badRes.StatusCode)
	}
	badRes.Body.Close()

	// 3. Upload asset with correct hash -> 200 OK
	reqGood, _ := http.NewRequest("POST", ts.URL+"/api/sync/assets/upload?filename=flyer.png", bytes.NewReader(sampleData))
	reqGood.AddCookie(cookie)
	reqGood.Header.Set("X-Content-SHA256", sampleHash)
	goodRes, err := ts.Client().Do(reqGood)
	if err != nil {
		t.Fatal(err)
	}
	if goodRes.StatusCode != http.StatusOK {
		t.Fatalf("upload asset = %d", goodRes.StatusCode)
	}
	var uploadBody struct {
		OK           bool   `json:"ok"`
		SHA256       string `json:"sha256"`
		URL          string `json:"url"`
		Filename     string `json:"filename"`
		Deduplicated bool   `json:"deduplicated"`
	}
	_ = json.NewDecoder(goodRes.Body).Decode(&uploadBody)
	goodRes.Body.Close()

	if !uploadBody.OK || uploadBody.SHA256 != sampleHash || uploadBody.Deduplicated {
		t.Fatalf("unexpected upload response: %+v", uploadBody)
	}

	// 3b. Upload same asset again -> deduplication short-circuit returns deduplicated: true
	reqDup, _ := http.NewRequest("POST", ts.URL+"/api/sync/assets/upload?filename=flyer.png", bytes.NewReader(sampleData))
	reqDup.AddCookie(cookie)
	reqDup.Header.Set("X-Content-SHA256", sampleHash)
	dupRes, err := ts.Client().Do(reqDup)
	if err != nil {
		t.Fatal(err)
	}
	if dupRes.StatusCode != http.StatusOK {
		t.Fatalf("duplicate upload = %d", dupRes.StatusCode)
	}
	var dupBody struct {
		OK           bool `json:"ok"`
		Deduplicated bool `json:"deduplicated"`
	}
	_ = json.NewDecoder(dupRes.Body).Decode(&dupBody)
	dupRes.Body.Close()
	if !dupBody.OK || !dupBody.Deduplicated {
		t.Fatalf("expected duplicate upload short-circuit with deduplicated=true, got %+v", dupBody)
	}

	// Verify file is saved in uploads dir
	expectedPath := filepath.Join(tmpUploads, sampleHash+".png")
	if _, err := os.Stat(expectedPath); err != nil {
		t.Fatalf("expected uploaded file at %s: %v", expectedPath, err)
	}

	// 4. Check asset again: sampleHash must NO LONGER be missing
	checkRes2 := songSetRequest(t, ts, "POST", "/api/sync/assets/check", checkPayload, cookie)
	if checkRes2.StatusCode != http.StatusOK {
		t.Fatalf("check assets 2 = %d", checkRes2.StatusCode)
	}
	var checkBody2 struct {
		Missing []string `json:"missing"`
	}
	_ = json.NewDecoder(checkRes2.Body).Decode(&checkBody2)
	checkRes2.Body.Close()

	if len(checkBody2.Missing) != 1 || checkBody2.Missing[0] != "0000000000000000000000000000000000000000000000000000000000000000" {
		t.Fatalf("expected only non-existent hash missing, got %v", checkBody2.Missing)
	}

	// 5. Download asset by SHA256 -> 200 OK with correct content and header
	dlRes := songSetRequest(t, ts, "GET", "/api/sync/assets/"+sampleHash, "", cookie)
	if dlRes.StatusCode != http.StatusOK {
		t.Fatalf("download asset = %d", dlRes.StatusCode)
	}
	if dlRes.Header.Get("X-Content-SHA256") != sampleHash {
		t.Fatalf("expected X-Content-SHA256=%s, got %s", sampleHash, dlRes.Header.Get("X-Content-SHA256"))
	}
	dlBytes, _ := io.ReadAll(dlRes.Body)
	dlRes.Body.Close()
	if !bytes.Equal(dlBytes, sampleData) {
		t.Fatalf("downloaded data mismatch: got %q, want %q", dlBytes, sampleData)
	}

	// 6. Download non-existent asset -> 404
	dl404Res := songSetRequest(t, ts, "GET", "/api/sync/assets/0000000000000000000000000000000000000000000000000000000000000000", "", cookie)
	if dl404Res.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for missing asset, got %d", dl404Res.StatusCode)
	}
	dl404Res.Body.Close()
}
