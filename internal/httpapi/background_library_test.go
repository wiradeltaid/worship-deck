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
