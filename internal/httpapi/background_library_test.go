package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"
)

func jsonDecode(r io.Reader, v any) error {
	return json.NewDecoder(r).Decode(v)
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

	// 1. POST flyer image via /api/admin/media-library
	res := songSetRequest(t, ts, "POST", "/api/admin/media-library", `{"url":"/assets/welcome-bg.png","category":"flyer"}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("POST flyer = %d, want 201", res.StatusCode)
	}
	var flyerResp map[string]any
	_ = jsonDecode(res.Body, &flyerResp)
	res.Body.Close()
	if flyerResp["category"] != "flyer" {
		t.Fatalf("flyer category = %v, want flyer", flyerResp["category"])
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

	// 3. Filter category=flyer
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
	if fImages[0].(map[string]any)["category"] != "flyer" {
		t.Fatalf("expected flyer category, got %v", fImages[0])
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
