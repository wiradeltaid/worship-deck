package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"
	"time"
)

func jsonDecode(r io.Reader, v any) error {
	return json.NewDecoder(r).Decode(v)
}

func createImagePart(w *multipart.Writer, fieldname, filename, contentType string) (io.Writer, error) {
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldname, filename))
	h.Set("Content-Type", contentType)
	return w.CreatePart(h)
}

func TestBackgroundLibrary_AdminCRUDAndOperatorList(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Unauthenticated GET /api/admin/background-library -> 401
	res := songSetRequest(t, ts, "GET", "/api/admin/background-library", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth admin GET = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 2. Unauthenticated GET /api/background-library -> 401
	res = songSetRequest(t, ts, "GET", "/api/background-library", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth operator GET = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 3. Initial list is empty
	res = songSetRequest(t, ts, "GET", "/api/admin/background-library", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("admin GET = %d, want 200", res.StatusCode)
	}
	var listBody map[string]any
	_ = jsonDecode(res.Body, &listBody)
	res.Body.Close()
	images, ok := listBody["images"].([]any)
	if !ok || len(images) != 0 {
		t.Fatalf("initial images = %v, want empty array", listBody)
	}

	// 4. POST non-image -> 400
	res = songSetRequest(t, ts, "POST", "/api/admin/background-library", `{"url":"not-an-image"}`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST invalid url = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 5. POST valid bundled image -> 201
	res = songSetRequest(t, ts, "POST", "/api/admin/background-library", `{"url":"/assets/welcome-bg.png","isDefault":true}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST valid image = %d, want 201", res.StatusCode)
	}
	var created1 map[string]any
	_ = jsonDecode(res.Body, &created1)
	res.Body.Close()
	id1 := int(created1["id"].(float64))
	if !created1["isDefault"].(bool) {
		t.Fatalf("created image isDefault = false, want true")
	}
	_ = created1["updatedAt"].(string)

	// 6. POST second valid image (not default) -> 201
	res = songSetRequest(t, ts, "POST", "/api/admin/background-library", `{"url":"/assets/closing-prayer-bg.png"}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST second image = %d, want 201", res.StatusCode)
	}
	var created2 map[string]any
	_ = jsonDecode(res.Body, &created2)
	res.Body.Close()
	id2 := int(created2["id"].(float64))
	updatedAt2 := created2["updatedAt"].(string)

	// 7. List images via operator route -> 200
	res = songSetRequest(t, ts, "GET", "/api/background-library", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("operator GET = %d, want 200", res.StatusCode)
	}
	var opList map[string]any
	_ = jsonDecode(res.Body, &opList)
	res.Body.Close()
	opImages := opList["images"].([]any)
	if len(opImages) != 2 {
		t.Fatalf("operator images count = %d, want 2", len(opImages))
	}

	// 8. PATCH image 2 to be default (should unset image 1 default) -> 200
	time.Sleep(5 * time.Millisecond)
	res = songSetRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/background-library/%d", id2), fmt.Sprintf(`{"updatedAt":%q,"isDefault":true}`, updatedAt2), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("PATCH image 2 default = %d, want 200", res.StatusCode)
	}
	var patchBody map[string]any
	_ = jsonDecode(res.Body, &patchBody)
	res.Body.Close()
	if !patchBody["isDefault"].(bool) {
		t.Fatalf("patchBody isDefault = false, want true")
	}

	// Verify image 1 is no longer default in DB
	var img1Def int
	_ = handle.QueryRow(`SELECT is_default FROM background_library_images WHERE id = ?`, id1).Scan(&img1Def)
	if img1Def != 0 {
		t.Fatalf("image 1 is_default = %d, want 0", img1Def)
	}

	// 9. PATCH with stale updatedAt -> 409
	res = songSetRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/background-library/%d", id2), fmt.Sprintf(`{"updatedAt":%q,"isDefault":false}`, updatedAt2), cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("PATCH with stale updatedAt = %d, want 409", res.StatusCode)
	}
	res.Body.Close()

	// 10. DELETE image 1 with stale updatedAt -> 409
	res = songSetRequest(t, ts, "DELETE", fmt.Sprintf("/api/admin/background-library/%d", id1), `{"updatedAt":"stale-time"}`, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("DELETE with stale updatedAt = %d, want 409", res.StatusCode)
	}
	res.Body.Close()

	// Since image 1's default was unset when image 2 became default, read image 1's current updatedAt
	var freshUpdatedAt1 string
	_ = handle.QueryRow(`SELECT updated_at FROM background_library_images WHERE id = ?`, id1).Scan(&freshUpdatedAt1)

	// 11. DELETE image 1 with correct updatedAt -> 200
	res = songSetRequest(t, ts, "DELETE", fmt.Sprintf("/api/admin/background-library/%d", id1), fmt.Sprintf(`{"updatedAt":%q}`, freshUpdatedAt1), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("DELETE image 1 = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Verify image 1 gone
	var count int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM background_library_images WHERE id = ?`, id1).Scan(&count)
	if count != 0 {
		t.Fatalf("image 1 count = %d, want 0", count)
	}
}

func TestMediaLibrary_CategoryFilteringAndUnifiedEndpoints(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. POST flyer image via /api/admin/media-library (normalized to announcement, SPEC-40)
	res := songSetRequest(t, ts, "POST", "/api/admin/media-library", `{"url":"/assets/welcome-bg.png","category":"flyer"}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST flyer = %d, want 201", res.StatusCode)
	}
	var flyerResp map[string]any
	_ = jsonDecode(res.Body, &flyerResp)
	res.Body.Close()
	if flyerResp["category"] != "announcement" {
		t.Fatalf("flyer category = %v, want announcement (normalized)", flyerResp["category"])
	}

	// 2. POST background image via /api/admin/background-library
	res = songSetRequest(t, ts, "POST", "/api/admin/background-library", `{"url":"/assets/closing-prayer-bg.png","category":"background"}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST background = %d, want 201", res.StatusCode)
	}
	var bgResp map[string]any
	_ = jsonDecode(res.Body, &bgResp)
	res.Body.Close()
	if bgResp["category"] != "background" {
		t.Fatalf("bg category = %v, want background", bgResp["category"])
	}

	// 3. Filter category=flyer (normalizes to announcement query)
	res = songSetRequest(t, ts, "GET", "/api/admin/media-library?category=flyer", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET category=flyer = %d, want 200", res.StatusCode)
	}
	var flyerList map[string]any
	_ = jsonDecode(res.Body, &flyerList)
	res.Body.Close()
	fImages := flyerList["images"].([]any)
	if len(fImages) != 1 {
		t.Fatalf("flyer images count = %d, want 1", len(fImages))
	}
	if fImages[0].(map[string]any)["category"] != "announcement" {
		t.Fatalf("expected announcement category, got %v", fImages[0])
	}

	// 3b. Filter category=announcement explicitly
	res = songSetRequest(t, ts, "GET", "/api/admin/media-library?category=announcement", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET category=announcement = %d, want 200", res.StatusCode)
	}
	var annList map[string]any
	_ = jsonDecode(res.Body, &annList)
	res.Body.Close()
	aImages := annList["images"].([]any)
	if len(aImages) != 1 || aImages[0].(map[string]any)["category"] != "announcement" {
		t.Fatalf("expected announcement category, got %v", aImages)
	}

	// 4. Filter category=background
	res = songSetRequest(t, ts, "GET", "/api/admin/media-library?category=background", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET category=background = %d, want 200", res.StatusCode)
	}
	var bgList map[string]any
	_ = jsonDecode(res.Body, &bgList)
	res.Body.Close()
	bImages := bgList["images"].([]any)
	if len(bImages) != 1 {
		t.Fatalf("bg images count = %d, want 1", len(bImages))
	}
	if bImages[0].(map[string]any)["category"] != "background" {
		t.Fatalf("expected background category, got %v", bImages[0])
	}

	// 5. Query category=all returns both
	res = songSetRequest(t, ts, "GET", "/api/admin/media-library?category=all", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET category=all = %d, want 200", res.StatusCode)
	}
	var allList map[string]any
	_ = jsonDecode(res.Body, &allList)
	res.Body.Close()
	allImages := allList["images"].([]any)
	if len(allImages) != 2 {
		t.Fatalf("all images count = %d, want 2", len(allImages))
	}

	// 6. Operator route /api/media-library
	res = songSetRequest(t, ts, "GET", "/api/media-library?category=flyer", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("operator GET /api/media-library = %d, want 200", res.StatusCode)
	}
	var opFlyers map[string]any
	_ = jsonDecode(res.Body, &opFlyers)
	res.Body.Close()
	if len(opFlyers["images"].([]any)) != 1 {
		t.Fatalf("operator flyer count = %d, want 1", len(opFlyers["images"].([]any)))
	}

	// 7. Category-only PATCH must NOT promote asset to default or clear existing defaults
	bgID := int(bgResp["id"].(float64))
	bgUpdatedAt := bgResp["updatedAt"].(string)
	flyerID := int(flyerResp["id"].(float64))
	flyerUpdatedAt := flyerResp["updatedAt"].(string)

	// Make background default explicitly
	res = songSetRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/media-library/%d", bgID), fmt.Sprintf(`{"updatedAt":%q,"isDefault":true}`, bgUpdatedAt), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("make bg default = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Now PATCH flyer category only (no isDefault supplied)
	res = songSetRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/media-library/%d", flyerID), fmt.Sprintf(`{"updatedAt":%q,"category":"general"}`, flyerUpdatedAt), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("PATCH flyer category only = %d, want 200", res.StatusCode)
	}
	var patchFlyerResp map[string]any
	_ = jsonDecode(res.Body, &patchFlyerResp)
	res.Body.Close()

	if patchFlyerResp["category"] != "general" {
		t.Fatalf("expected category general, got %v", patchFlyerResp["category"])
	}
	if patchFlyerResp["isDefault"] == true {
		t.Fatalf("category-only PATCH must NOT set isDefault to true")
	}

	// Verify background is STILL default
	res = songSetRequest(t, ts, "GET", "/api/admin/media-library?category=background", "", cookie)
	var verifyBgList map[string]any
	_ = jsonDecode(res.Body, &verifyBgList)
	res.Body.Close()
	vbImages := verifyBgList["images"].([]any)
	if len(vbImages) != 1 || vbImages[0].(map[string]any)["isDefault"] != true {
		t.Fatalf("background should still be default, got %v", vbImages)
	}
}

func TestMediaLibrary_InPlaceReplacementAndCustomName(t *testing.T) {
	t.Setenv("UPLOADS_DIR", t.TempDir())
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Upload initial file to /api/uploads
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := createImagePart(mw, "file", "initial-graphic.png", "image/png")
	if err != nil {
		t.Fatalf("createImagePart error: %v", err)
	}
	initialBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
	if _, err := fw.Write(initialBytes); err != nil {
		t.Fatalf("fw.Write error: %v", err)
	}
	mw.Close()

	req, _ := http.NewRequest("POST", ts.URL+"/api/upload", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.AddCookie(cookie)
	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("POST /api/upload error: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("POST /api/upload status = %d, want 200, body: %s", res.StatusCode, string(b))
	}
	var uploadResp map[string]any
	_ = jsonDecode(res.Body, &uploadResp)
	res.Body.Close()
	uploadURL := uploadResp["url"].(string)

	// Verify initial upload can be fetched with no-cache header
	reqGet, _ := http.NewRequest("GET", ts.URL+uploadURL, nil)
	reqGet.AddCookie(cookie)
	res, err = client.Do(reqGet)
	if err != nil {
		t.Fatalf("GET initial upload error: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET initial upload status = %d, want 200", res.StatusCode)
	}
	cc := res.Header.Get("Cache-Control")
	if cc != "no-cache, must-revalidate" {
		t.Errorf("Cache-Control = %q, want 'no-cache, must-revalidate'", cc)
	}
	gotBytes, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if !bytes.Equal(gotBytes, initialBytes) {
		t.Fatalf("gotBytes != initialBytes")
	}

	// 2. Register media in gallery with custom name
	res = songSetRequest(t, ts, "POST", "/api/admin/media-library", fmt.Sprintf(`{"url":%q,"name":"Easter Banner","category":"announcement"}`, uploadURL), cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST /api/admin/media-library status = %d, want 201", res.StatusCode)
	}
	var created map[string]any
	_ = jsonDecode(res.Body, &created)
	res.Body.Close()
	assetID := int(created["id"].(float64))
	assetURL := created["url"].(string)
	assetName := created["name"].(string)
	updatedAt := created["updatedAt"].(string)

	if assetName != "Easter Banner" {
		t.Fatalf("assetName = %q, want 'Easter Banner'", assetName)
	}
	if assetURL != uploadURL {
		t.Fatalf("assetURL = %q, want %q", assetURL, uploadURL)
	}

	// 3. Rename media asset via PATCH
	res = songSetRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/media-library/%d", assetID), fmt.Sprintf(`{"name":"Easter 2026 Poster","updatedAt":%q}`, updatedAt), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("PATCH media name = %d, want 200", res.StatusCode)
	}
	var patchResp map[string]any
	_ = jsonDecode(res.Body, &patchResp)
	res.Body.Close()
	if patchResp["name"] != "Easter 2026 Poster" {
		t.Fatalf("patched name = %v, want 'Easter 2026 Poster'", patchResp["name"])
	}
	updatedAt2 := patchResp["updatedAt"].(string)

	// 4. In-place replace attempt with STALE updatedAt -> 409 Conflict
	var replaceBody bytes.Buffer
	rwStale := multipart.NewWriter(&replaceBody)
	rfwStale, _ := rwStale.CreateFormFile("file", "replacement.png")
	rfwStale.Write([]byte("fake-replacement-bytes"))
	rwStale.WriteField("updatedAt", updatedAt) // Stale timestamp!
	rwStale.Close()

	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, assetID), &replaceBody)
	req.Header.Set("Content-Type", rwStale.FormDataContentType())
	req.AddCookie(cookie)
	res, err = client.Do(req)
	if err != nil {
		t.Fatalf("replace request error: %v", err)
	}
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("replace with stale timestamp = %d, want 409", res.StatusCode)
	}
	res.Body.Close()

	// 5. In-place replace with FRESH updatedAt -> 200 OK
	replacementBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x02\x00\x00\x00\x02\x08\x06\x00\x00\x00v\x22\xde\x88\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x03\x00\x08\xfc\x02\xfe\xa7\x9a\xa0\xa0\x00\x00\x00\x00IEND\xaeB`\x82")
	var replaceFresh bytes.Buffer
	rwFresh := multipart.NewWriter(&replaceFresh)
	rfwFresh, _ := createImagePart(rwFresh, "file", "fresh.png", "image/png")
	rfwFresh.Write(replacementBytes)
	rwFresh.WriteField("updatedAt", updatedAt2)
	rwFresh.Close()

	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, assetID), &replaceFresh)
	req.Header.Set("Content-Type", rwFresh.FormDataContentType())
	req.AddCookie(cookie)
	res, err = client.Do(req)
	if err != nil {
		t.Fatalf("replace fresh request error: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("replace fresh status = %d, want 200", res.StatusCode)
	}
	var replaceResp map[string]any
	_ = jsonDecode(res.Body, &replaceResp)
	res.Body.Close()

	// Invariant: ID and URL path must be strictly identical!
	if int(replaceResp["id"].(float64)) != assetID {
		t.Fatalf("replaced ID = %v, want %d", replaceResp["id"], assetID)
	}
	if replaceResp["url"] != assetURL {
		t.Fatalf("replaced URL = %q, want strictly identical URL %q", replaceResp["url"], assetURL)
	}

	// 6. Fetching the URL returns the replacement bytes directly
	reqGetReplaced, _ := http.NewRequest("GET", ts.URL+assetURL, nil)
	reqGetReplaced.AddCookie(cookie)
	res, err = client.Do(reqGetReplaced)
	if err != nil {
		t.Fatalf("GET replaced URL error: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET replaced URL status = %d, want 200", res.StatusCode)
	}
	newFetchedBytes, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if !bytes.Equal(newFetchedBytes, replacementBytes) {
		t.Fatalf("newFetchedBytes does not match replacementBytes!")
	}

	// 7. Attempt replace on non-upload image (bundled asset) -> 400 Bad Request
	resNonUpload := songSetRequest(t, ts, "POST", "/api/admin/media-library", `{"url":"/assets/welcome-bg.png"}`, cookie)
	var nonUploadCreated map[string]any
	_ = jsonDecode(resNonUpload.Body, &nonUploadCreated)
	resNonUpload.Body.Close()
	nonUploadID := int(nonUploadCreated["id"].(float64))
	nonUploadUpdated := nonUploadCreated["updatedAt"].(string)

	var replaceNonUpBody bytes.Buffer
	rwNonUp := multipart.NewWriter(&replaceNonUpBody)
	rfwNonUp, _ := createImagePart(rwNonUp, "file", "fresh.png", "image/png")
	rfwNonUp.Write(replacementBytes)
	rwNonUp.WriteField("updatedAt", nonUploadUpdated)
	rwNonUp.Close()

	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, nonUploadID), &replaceNonUpBody)
	req.Header.Set("Content-Type", rwNonUp.FormDataContentType())
	req.AddCookie(cookie)
	res, err = client.Do(req)
	if err != nil {
		t.Fatalf("replace non-upload error: %v", err)
	}
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("replace non-upload status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 8. Rejection of external URLs and path-traversal / malformed upload filenames
	nowTime := time.Now().UTC().Format(time.RFC3339)
	resExt, _ := handle.Exec(`INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
		"https://example.com/photo.png", "External Pic", "general", nowTime, nowTime)
	extID, _ := resExt.LastInsertId()

	var replaceExtBody bytes.Buffer
	rwExt := multipart.NewWriter(&replaceExtBody)
	rfwExt, _ := createImagePart(rwExt, "file", "fresh.png", "image/png")
	rfwExt.Write(replacementBytes)
	rwExt.WriteField("updatedAt", nowTime)
	rwExt.Close()

	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, extID), &replaceExtBody)
	req.Header.Set("Content-Type", rwExt.FormDataContentType())
	req.AddCookie(cookie)
	res, err = client.Do(req)
	if err != nil {
		t.Fatalf("replace external error: %v", err)
	}
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("replace external URL status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// Path traversal attempt in stored URL
	resTrav, _ := handle.Exec(`INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
		"/api/uploads/../../escape.png", "Traversal Attempt", "general", nowTime, nowTime)
	travID, _ := resTrav.LastInsertId()

	var replaceTravBody bytes.Buffer
	rwTrav := multipart.NewWriter(&replaceTravBody)
	rfwTrav, _ := createImagePart(rwTrav, "file", "fresh.png", "image/png")
	rfwTrav.Write(replacementBytes)
	rwTrav.WriteField("updatedAt", nowTime)
	rwTrav.Close()

	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, travID), &replaceTravBody)
	req.Header.Set("Content-Type", rwTrav.FormDataContentType())
	req.AddCookie(cookie)
	res, err = client.Do(req)
	if err != nil {
		t.Fatalf("replace traversal error: %v", err)
	}
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("replace traversal status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 9. Legacy stored category='flyer' row verification
	legacyTime := time.Now().UTC().Format(time.RFC3339)
	resLegacy, _ := handle.Exec(`INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at) VALUES (?, ?, 'flyer', 0, ?, ?)`,
		"/assets/legacy-flyer.png", "Legacy Event Flyer", legacyTime, legacyTime)
	legacyID, _ := resLegacy.LastInsertId()

	// Querying ?category=announcement selects the legacy flyer row and normalizes response to 'announcement'
	res = songSetRequest(t, ts, "GET", "/api/admin/media-library?category=announcement", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET category=announcement = %d, want 200", res.StatusCode)
	}
	var legList map[string]any
	_ = jsonDecode(res.Body, &legList)
	res.Body.Close()
	foundLegacy := false
	for _, raw := range legList["images"].([]any) {
		m := raw.(map[string]any)
		if int(m["id"].(float64)) == int(legacyID) {
			foundLegacy = true
			if m["category"] != "announcement" {
				t.Fatalf("legacy item category in response = %v, want announcement", m["category"])
			}
		}
	}
	if !foundLegacy {
		t.Fatalf("legacy flyer item not found in announcement query")
	}

	// PATCH legacy flyer row with name only -> normalizes stored category to announcement
	res = songSetRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/media-library/%d", legacyID), fmt.Sprintf(`{"name":"Updated Legacy Name","updatedAt":%q}`, legacyTime), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("PATCH legacy item = %d, want 200", res.StatusCode)
	}
	var patchLegResp map[string]any
	_ = jsonDecode(res.Body, &patchLegResp)
	res.Body.Close()
	if patchLegResp["category"] != "announcement" {
		t.Fatalf("patched legacy category = %v, want announcement", patchLegResp["category"])
	}

	var storedCategory string
	_ = handle.QueryRow(`SELECT category FROM background_library_images WHERE id = ?`, legacyID).Scan(&storedCategory)
	if storedCategory != "announcement" {
		t.Fatalf("storedCategory after PATCH = %q, want announcement", storedCategory)
	}

	// 10. Concurrency race protection: second contender with same token gets 409 and does NOT overwrite file
	var freshWinnerAt string
	_ = handle.QueryRow(`SELECT updated_at FROM background_library_images WHERE id = ?`, assetID).Scan(&freshWinnerAt)

	// Contender 1 wins
	winnerBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x03\x00\x00\x00\x03\x08\x06\x00\x00\x00\xe6e\x3cQ\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x03\x00\x08\xfc\x02\xfe\xa7\x9a\xa0\xa0\x00\x00\x00\x00IEND\xaeB`\x82")
	var rw1Body bytes.Buffer
	rw1 := multipart.NewWriter(&rw1Body)
	rfw1, _ := createImagePart(rw1, "file", "winner.png", "image/png")
	rfw1.Write(winnerBytes)
	rw1.WriteField("updatedAt", freshWinnerAt)
	rw1.Close()

	req1, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, assetID), &rw1Body)
	req1.Header.Set("Content-Type", rw1.FormDataContentType())
	req1.AddCookie(cookie)
	res1, err := client.Do(req1)
	if err != nil || res1.StatusCode != http.StatusOK {
		t.Fatalf("contender 1 status = %d, want 200 (err: %v)", res1.StatusCode, err)
	}
	res1.Body.Close()

	// Contender 2 (stale token = freshWinnerAt before contender 1 changed it) -> 409 Conflict
	loserBytes := []byte("malicious-or-loser-bytes-that-must-not-land-on-disk")
	var rw2Body bytes.Buffer
	rw2 := multipart.NewWriter(&rw2Body)
	rfw2, _ := createImagePart(rw2, "file", "loser.png", "image/png")
	rfw2.Write(loserBytes)
	rw2.WriteField("updatedAt", freshWinnerAt) // same token, now stale!
	rw2.Close()

	req2, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/admin/media-library/%d/replace", ts.URL, assetID), &rw2Body)
	req2.Header.Set("Content-Type", rw2.FormDataContentType())
	req2.AddCookie(cookie)
	res2, err := client.Do(req2)
	if err != nil {
		t.Fatalf("contender 2 error: %v", err)
	}
	if res2.StatusCode != http.StatusConflict {
		t.Fatalf("contender 2 status = %d, want 409", res2.StatusCode)
	}
	res2.Body.Close()

	// Assert the disk file STILL contains winnerBytes, NOT loserBytes!
	reqCheck, _ := http.NewRequest("GET", ts.URL+assetURL, nil)
	reqCheck.AddCookie(cookie)
	resCheck, _ := client.Do(reqCheck)
	diskBytes, _ := io.ReadAll(resCheck.Body)
	resCheck.Body.Close()

	if !bytes.Equal(diskBytes, winnerBytes) {
		t.Fatalf("file on disk was corrupted by losing contender!")
	}
	_ = handle
}
