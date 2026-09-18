package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
	"github.com/wiradeltaid/worship-presenter-web/internal/plan"
)

func newAnnTestServer(t *testing.T) (*httptest.Server, *dbHandleAndRoot) {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	root := wd
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(root, "data", "default-registry.json")); err == nil {
			break
		}
		root = filepath.Dir(root)
	}
	t.Setenv("WPW_USE_SHIPPED_REGISTRY", "1")
	t.Setenv("AUTH_SECRET", "this-is-a-valid-auth-secret-for-testing")
	t.Setenv("AUTH_BOOTSTRAP_USER", "admin")
	t.Setenv("AUTH_BOOTSTRAP_PASSWORD", "test-password-123")

	handle, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { handle.Close() })
	if err := db.Bootstrap(handle, root); err != nil {
		t.Fatal(err)
	}
	s := &Server{DB: handle, Root: root}
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)
	return ts, &dbHandleAndRoot{Server: s, Root: root}
}

type dbHandleAndRoot struct {
	Server *Server
	Root   string
}

func annLogin(t *testing.T, ts *httptest.Server) *http.Cookie {
	t.Helper()
	res := annRequest(t, ts, "POST", "/api/auth/login", `{"username":"admin","password":"test-password-123"}`, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("login failed: %d %s", res.StatusCode, b)
	}
	for _, c := range res.Cookies() {
		if c.Name == "wpw_session" || strings.Contains(c.Name, "session") {
			return c
		}
	}
	t.Fatal("no session cookie returned")
	return nil
}

func annRequest(t *testing.T, ts *httptest.Server, method, path, body string, cookie *http.Cookie) *http.Response {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, ts.URL+path, reader)
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func annJSON(t *testing.T, res *http.Response) map[string]any {
	t.Helper()
	defer res.Body.Close()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("invalid json (%s): %v", string(b), err)
	}
	return out
}

func TestAnnouncementSetsCRUD(t *testing.T) {
	ts, _ := newAnnTestServer(t)
	cookie := annLogin(t, ts)

	// 1. List sets initially empty
	res := annRequest(t, ts, "GET", "/api/admin/announcement-sets", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("list sets: %d", res.StatusCode)
	}
	listObj := annJSON(t, res)
	sets := listObj["sets"].([]any)
	if len(sets) != 0 {
		t.Fatalf("expected 0 sets initially, got %d", len(sets))
	}

	// 2. Create a set
	res = annRequest(t, ts, "POST", "/api/admin/announcement-sets", `{"label":"Announcement 1"}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create set: %d", res.StatusCode)
	}
	set1 := annJSON(t, res)
	setID := int(set1["id"].(float64))
	setUpdatedAt := set1["updatedAt"].(string)
	if setID == 0 || set1["label"] != "Announcement 1" {
		t.Fatalf("invalid created set: %+v", set1)
	}

	// 3. Patch set label
	patchBody := fmt.Sprintf(`{"label":"Main Announcements","updatedAt":%q}`, setUpdatedAt)
	res = annRequest(t, ts, "PATCH", fmt.Sprintf("/api/admin/announcement-sets/%d", setID), patchBody, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("patch set: %d", res.StatusCode)
	}
	patchedSet := annJSON(t, res)
	if patchedSet["label"] != "Main Announcements" {
		t.Fatalf("patched label want 'Main Announcements', got %q", patchedSet["label"])
	}
	setUpdatedAt = patchedSet["updatedAt"].(string)

	// 4. Create slide in set
	res = annRequest(t, ts, "POST", fmt.Sprintf("/api/admin/announcement-sets/%d/slides", setID), `{"label":"Slide 1"}`, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create slide: %d", res.StatusCode)
	}
	slide1 := annJSON(t, res)
	slideID := int(slide1["id"].(float64))
	slideUpdatedAt := slide1["updatedAt"].(string)

	// 5. Get slide
	res = annRequest(t, ts, "GET", fmt.Sprintf("/api/admin/announcement-sets/%d/slides/%d", setID, slideID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get slide: %d", res.StatusCode)
	}

	// 6. Put slide layout
	putBody := fmt.Sprintf(`{
		"updatedAt": %q,
		"layouts": {
			"default": {
				"aspectRatio": "16:9",
				"backgroundColor": "#112233",
				"elements": []
			}
		}
	}`, slideUpdatedAt)
	res = annRequest(t, ts, "PUT", fmt.Sprintf("/api/admin/announcement-sets/%d/slides/%d", setID, slideID), putBody, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("put slide: %d", res.StatusCode)
	}

	// 7. Add marker to spine referencing set1
	markerBody := fmt.Sprintf(`{"label":"Announcement Block","baseType":"ann-set-marker","annSetId":%d}`, setID)
	res = annRequest(t, ts, "POST", "/api/admin/artifacts", markerBody, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create marker: %d", res.StatusCode)
	}
	markerObj := annJSON(t, res)
	markerID := markerObj["id"].(string)

	// 8. Delete set1 should be REFUSED (409) because live marker references it
	delBody := fmt.Sprintf(`{"updatedAt":%q}`, setUpdatedAt)
	res = annRequest(t, ts, "DELETE", fmt.Sprintf("/api/admin/announcement-sets/%d", setID), delBody, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 when deleting referenced set, got %d", res.StatusCode)
	}

	// 9. Delete marker from spine
	delMarkerBody := fmt.Sprintf(`{"updatedAt":%q}`, markerObj["updatedAt"].(string))
	res = annRequest(t, ts, "DELETE", fmt.Sprintf("/api/admin/artifacts/%s", markerID), delMarkerBody, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete marker: %d", res.StatusCode)
	}

	// 10. Delete set1 now succeeds
	res = annRequest(t, ts, "DELETE", fmt.Sprintf("/api/admin/announcement-sets/%d", setID), delBody, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete set: %d", res.StatusCode)
	}
}

func TestAnnouncementSetSlideSplicingInPlan(t *testing.T) {
	ts, env := newAnnTestServer(t)
	cookie := annLogin(t, ts)

	// 1. Create set
	res := annRequest(t, ts, "POST", "/api/admin/announcement-sets", `{"label":"Test Set"}`, cookie)
	set := annJSON(t, res)
	setID := int(set["id"].(float64))

	// 2. Add two slides
	res = annRequest(t, ts, "POST", fmt.Sprintf("/api/admin/announcement-sets/%d/slides", setID), `{"label":"First Ann"}`, cookie)
	s1 := annJSON(t, res)
	s1ID := int(s1["id"].(float64))

	res = annRequest(t, ts, "POST", fmt.Sprintf("/api/admin/announcement-sets/%d/slides", setID), `{"label":"Second Ann"}`, cookie)
	s2 := annJSON(t, res)
	s2ID := int(s2["id"].(float64))

	// 3. Add marker to spine
	markerBody := fmt.Sprintf(`{"label":"Announcements Marker","baseType":"ann-set-marker","annSetId":%d}`, setID)
	res = annRequest(t, ts, "POST", "/api/admin/artifacts", markerBody, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create marker: %d", res.StatusCode)
	}

	// 4. Load snapshot & build slide plan
	snap, err := plan.LoadSnapshot(env.Server.DB, 0)
	if err != nil {
		t.Fatalf("LoadSnapshot: %v", err)
	}

	items, err := plan.BuildSlidePlan("2026-08-22", plan.ParsedRundown{}, plan.Media{}, snap)
	if err != nil {
		t.Fatalf("BuildSlidePlan: %v", err)
	}

	// Verify the two announcement slides appear in the plan (SPEC-41 unique child instance IDs)
	foundS1, foundS2 := false, false
	for _, it := range items {
		if strings.HasSuffix(it.Artifact.InstanceID, fmt.Sprintf("ann-slide-%d", s1ID)) {
			foundS1 = true
		}
		if strings.HasSuffix(it.Artifact.InstanceID, fmt.Sprintf("ann-slide-%d", s2ID)) {
			foundS2 = true
		}
	}
	if !foundS1 || !foundS2 {
		t.Fatalf("expected announcement slides in plan: foundS1=%v, foundS2=%v", foundS1, foundS2)
	}
}
