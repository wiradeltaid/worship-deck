package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

// newSongSetTestServer boots a real server over a scratch SQLite database
// seeded through db.Bootstrap with the shipped registry and song-set layout
// seeds, plus one admin account for the AD-5 gate.
func newSongSetTestServer(t *testing.T) (*httptest.Server, *sql.DB, string) {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
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
	ts := httptest.NewServer((&Server{DB: handle, Root: root}).Handler())
	t.Cleanup(ts.Close)
	return ts, handle, root
}

func songSetLogin(t *testing.T, ts *httptest.Server) *http.Cookie {
	t.Helper()
	res := songSetRequest(t, ts, "POST", "/api/auth/login", `{"username":"admin","password":"test-password-123"}`, nil)
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

func songSetRequest(t *testing.T, ts *httptest.Server, method, path, body string, cookie *http.Cookie) *http.Response {
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

func songSetJSON(t *testing.T, res *http.Response) map[string]any {
	t.Helper()
	defer res.Body.Close()
	var out map[string]any
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		t.Fatalf("response is not a JSON object: %v", err)
	}
	return out
}

func TestSongSetLayoutSeedsInstalled(t *testing.T) {
	ts, handle, root := newSongSetTestServer(t)
	_ = ts
	rows, err := handle.Query(`SELECT role, seed_hash FROM song_set_layouts ORDER BY role`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	seen := map[string]bool{}
	for rows.Next() {
		var role, hash string
		if err := rows.Scan(&role, &hash); err != nil {
			t.Fatal(err)
		}
		if hash == "" {
			t.Fatalf("role %s was seeded without a seed_hash", role)
		}
		seen[role] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	for _, role := range []string{"title", "verse", "reff"} {
		if !seen[role] {
			t.Errorf("song_set_layouts missing role %s after bootstrap", role)
		}
	}
	seeds, err := db.LoadSongSetLayoutSeeds(root)
	if err != nil {
		t.Fatal(err)
	}
	var payload string
	if err := handle.QueryRow(`SELECT payload FROM song_set_layouts WHERE role = 'verse'`).Scan(&payload); err != nil {
		t.Fatal(err)
	}
	if payload != string(seeds["verse"]) {
		t.Error("seeded verse payload does not match the shipped seed bytes")
	}
}

func TestSongSetEntryLifecycle(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)

	res := songSetRequest(t, ts, "GET", "/api/admin/song-set-entries", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated list = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	cookie := songSetLogin(t, ts)

	res = songSetRequest(t, ts, "GET", "/api/admin/song-set-entries", "", cookie)
	body := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("list entries = %d, want 200", res.StatusCode)
	}
	entries, _ := body["entries"].([]any)
	if len(entries) < 4 {
		t.Fatalf("expected the four seed entries, got %d", len(entries))
	}

	// Create.
	res = songSetRequest(t, ts, "POST", "/api/admin/song-set-entries",
		`{"variableName":"special_anthem","title":"Anthem of Praise"}`, cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create entry = %d (%v), want 201", res.StatusCode, body)
	}
	created, _ := body["updatedAt"].(string)
	if created == "" {
		t.Fatal("create response missing updatedAt")
	}

	// Duplicate and invalid names.
	res = songSetRequest(t, ts, "POST", "/api/admin/song-set-entries",
		`{"variableName":"special_anthem","title":"Again"}`, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Errorf("duplicate create = %d, want 409", res.StatusCode)
	}
	res.Body.Close()
	res = songSetRequest(t, ts, "POST", "/api/admin/song-set-entries",
		`{"variableName":"Bad Name!","title":"X"}`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid variableName = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// PATCH: stale, unknown, invalid variableName, empty variableName, conflict on existing variableName.
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/special_anthem",
		fmt.Sprintf(`{"title":"Renamed","updatedAt":%q,"variableName":"Invalid Name!"}`, created), cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid variableName patch = %d, want 400", res.StatusCode)
	}
	res.Body.Close()
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/special_anthem",
		fmt.Sprintf(`{"title":"Renamed","updatedAt":%q,"variableName":""}`, created), cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("empty variableName patch = %d, want 400", res.StatusCode)
	}
	res.Body.Close()
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/special_anthem",
		`{"title":"Renamed","updatedAt":"2000-01-01T00:00:00Z"}`, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Errorf("stale patch = %d, want 409", res.StatusCode)
	}
	res.Body.Close()
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/missing_entry",
		fmt.Sprintf(`{"title":"X","updatedAt":%q}`, created), cookie)
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("unknown entry patch = %d, want 404", res.StatusCode)
	}
	res.Body.Close()

	// Conflict: rename to an already-existing variable_name (e.g. opening_song_bt)
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/special_anthem",
		fmt.Sprintf(`{"title":"Anthem Conflict","variableName":"opening_song_bt","updatedAt":%q}`, created), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusConflict || body["error"] != "Song set entry already exists" {
		t.Errorf("duplicate variableName patch = %d (%v), want 409 Song set entry already exists", res.StatusCode, body)
	}

	// 1. Title-only rename (variableName omitted)
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/special_anthem",
		fmt.Sprintf(`{"title":"Anthem Title Only","updatedAt":%q}`, created), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("title-only patch = %d (%v), want 200", res.StatusCode, body)
	}
	if body["variableName"] != "special_anthem" || body["title"] != "Anthem Title Only" {
		t.Errorf("title-only patch unexpected body: %v", body)
	}
	afterTitlePatch, _ := body["updatedAt"].(string)

	// 2. Multi-service test for renaming into a freed variable_name with inert rows:
	// Service 1 has active row for special_anthem (42) and inert row for inert_anthem (99).
	// Service 2 has ONLY an inert row for inert_anthem (77).
	var serviceID1, serviceID2 int64
	err := handle.QueryRow(`INSERT INTO services (date, raw_payload) VALUES ('2026-09-20', '{}') RETURNING id`).Scan(&serviceID1)
	if err != nil {
		t.Fatal(err)
	}
	err = handle.QueryRow(`INSERT INTO services (date, raw_payload) VALUES ('2026-09-27', '{}') RETURNING id`).Scan(&serviceID2)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handle.Exec(`INSERT INTO song_set_inputs (service_id, variable_name, song_number) VALUES (?, 'special_anthem', 42)`, serviceID1)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handle.Exec(`INSERT INTO song_set_inputs (service_id, variable_name, song_number) VALUES (?, 'inert_anthem', 99)`, serviceID1)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handle.Exec(`INSERT INTO song_set_inputs (service_id, variable_name, song_number) VALUES (?, 'inert_anthem', 77)`, serviceID2)
	if err != nil {
		t.Fatal(err)
	}

	// Rename special_anthem -> inert_anthem:
	// - Purges inert rows across all services (99 on s1, 77 on s2)
	// - Migrates active row (42 on s1) to inert_anthem
	res = songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/special_anthem",
		fmt.Sprintf(`{"title":"Anthem Renamed","variableName":"inert_anthem","updatedAt":%q}`, afterTitlePatch), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("rename into inert variableName = %d (%v), want 200", res.StatusCode, body)
	}
	if body["variableName"] != "inert_anthem" {
		t.Errorf("rename patch variableName = %v, want inert_anthem", body["variableName"])
	}
	renamed, _ := body["updatedAt"].(string)

	// Verify service 1: active row migrated to inert_anthem (song_number 42, not 99)
	var s1SongNum int
	err = handle.QueryRow(`SELECT song_number FROM song_set_inputs WHERE service_id = ? AND variable_name = 'inert_anthem'`, serviceID1).Scan(&s1SongNum)
	if err != nil || s1SongNum != 42 {
		t.Errorf("service 1 inert_anthem row: num=%d err=%v, want 42", s1SongNum, err)
	}

	// Verify service 2: inert row was purged, not adopted (count is 0)
	var s2Count int
	err = handle.QueryRow(`SELECT COUNT(*) FROM song_set_inputs WHERE service_id = ? AND variable_name = 'inert_anthem'`, serviceID2).Scan(&s2Count)
	if err != nil || s2Count != 0 {
		t.Errorf("service 2 inert_anthem row count=%d err=%v, want 0 (purged)", s2Count, err)
	}

	// Verify old variable_name special_anthem is completely gone
	var oldCount int
	err = handle.QueryRow(`SELECT COUNT(*) FROM song_set_inputs WHERE variable_name = 'special_anthem'`).Scan(&oldCount)
	if err != nil || oldCount != 0 {
		t.Errorf("old song_set_inputs row still exists: count=%d err=%v", oldCount, err)
	}

	// DELETE: missing token, stale token, then success on renamed variableName.
	res = songSetRequest(t, ts, "DELETE", "/api/admin/song-set-entries/inert_anthem", `{}`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("delete without updatedAt = %d, want 400", res.StatusCode)
	}
	res.Body.Close()
	res = songSetRequest(t, ts, "DELETE", "/api/admin/song-set-entries/inert_anthem",
		fmt.Sprintf(`{"updatedAt":%q}`, renamed), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete = %d (%v), want 200", res.StatusCode, body)
	}
	res = songSetRequest(t, ts, "GET", "/api/admin/song-set-entries", "", cookie)
	body = songSetJSON(t, res)
	for _, raw := range body["entries"].([]any) {
		if e := raw.(map[string]any); e["variableName"] == "inert_anthem" || e["variableName"] == "special_anthem" {
			t.Error("deleted entry still listed")
		}
	}
}

func TestSongSetLayoutTrioEndpoints(t *testing.T) {
	ts, _, root := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	res := songSetRequest(t, ts, "GET", "/api/admin/song-set-layouts/bogus", "", cookie)
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("unknown role = %d, want 404", res.StatusCode)
	}
	res.Body.Close()

	res = songSetRequest(t, ts, "GET", "/api/admin/song-set-layouts/verse", "", cookie)
	body := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get verse layout = %d, want 200", res.StatusCode)
	}
	layout, _ := body["layout"].(map[string]any)
	if layout == nil || layout["elements"] == nil {
		t.Fatal("verse layout response missing elements")
	}
	current, _ := body["updatedAt"].(string)

	// AD-33 blank-canvas rule: no background image, no image element.
	res = songSetRequest(t, ts, "PUT", "/api/admin/song-set-layouts/verse",
		fmt.Sprintf(`{"updatedAt":%q,"layout":{"aspectRatio":"16:9","backgroundColor":"#101010","backgroundImage":"/assets/x.png","elements":[]}}`, current), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusBadRequest || !strings.Contains(fmt.Sprint(body["error"]), "must not set a background image") {
		t.Errorf("verse backgroundImage PUT = %d %v, want 400 naming background image", res.StatusCode, body)
	}
	res = songSetRequest(t, ts, "PUT", "/api/admin/song-set-layouts/verse",
		fmt.Sprintf(`{"updatedAt":%q,"layout":{"aspectRatio":"16:9","backgroundColor":"#101010","elements":[{"id":"pic","type":"image","x":0,"y":0,"w":1,"h":1,"zIndex":0}]}}`, current), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusBadRequest || !strings.Contains(fmt.Sprint(body["error"]), "elements[0]") {
		t.Errorf("verse image element PUT = %d %v, want 400 naming elements[0]", res.StatusCode, body)
	}

	// Valid save, stale conflict, then reset restores shipped bytes.
	validVerse := `{"aspectRatio":"16:9","backgroundColor":"#202020","elements":[{"id":"v","type":"text","required":true,"x":10,"y":10,"w":100,"h":20,"zIndex":1,"placeholderKey":"verse_number"}]}`
	res = songSetRequest(t, ts, "PUT", "/api/admin/song-set-layouts/verse",
		fmt.Sprintf(`{"updatedAt":%q,"layout":%s}`, current, validVerse), cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("valid verse PUT = %d (%v), want 200", res.StatusCode, body)
	}
	saved, _ := body["updatedAt"].(string)
	if saved == "" || saved == current {
		t.Fatal("valid verse PUT did not advance updatedAt")
	}
	res = songSetRequest(t, ts, "PUT", "/api/admin/song-set-layouts/verse",
		fmt.Sprintf(`{"updatedAt":%q,"layout":%s}`, current, validVerse), cookie)
	if res.StatusCode != http.StatusConflict {
		t.Errorf("stale verse PUT = %d, want 409", res.StatusCode)
	}
	res.Body.Close()

	res = songSetRequest(t, ts, "POST", "/api/admin/song-set-layouts/verse/reset", "", cookie)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("reset verse = %d (%v), want 200", res.StatusCode, body)
	}
	seeds, err := db.LoadSongSetLayoutSeeds(root)
	if err != nil {
		t.Fatal(err)
	}
	stored := songSetJSON(t, songSetRequest(t, ts, "GET", "/api/admin/song-set-layouts/verse", "", cookie))
	raw, _ := json.Marshal(stored["layout"])
	if string(raw) != string(seeds["verse"]) {
		t.Error("reset did not restore the shipped verse payload")
	}
}

func TestPreviewResponseCarriesRoleLabel(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	rawRundown := `SABBATH, AUGUST 22, 2026
DIVINE SERVICE
Opening Song: SDAH #159
Closing Song: SDAH #200`

	res := songSetRequest(t, ts, "POST", "/api/services/preview", fmt.Sprintf(`{"raw_payload":%q}`, rawRundown), cookie)
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("preview status = %d, body = %s", res.StatusCode, b)
	}
	body := songSetJSON(t, res)
	entries, ok := body["previewEntries"].([]any)
	if !ok || len(entries) == 0 {
		t.Fatalf("previewEntries missing or empty: %v", body["previewEntries"])
	}

	var songSet1Labels []string
	var songSet2Labels []string
	for _, raw := range entries {
		entry, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		groupID, _ := entry["groupId"].(string)
		role, _ := entry["role"].(string)
		rl, _ := entry["roleLabel"].(string)

		if role == "title" && rl != "" {
			t.Errorf("title child should not have roleLabel: %v", entry)
		}

		if groupID == "ds-opening" && role == "lyric" {
			songSet1Labels = append(songSet1Labels, rl)
		} else if groupID == "ds-closing" && role == "lyric" {
			songSet2Labels = append(songSet2Labels, rl)
		}
	}

	// SDAH #159: 3 stanzas with chorus -> 1/3, Chorus, 2/3, Chorus, 3/3, Chorus
	want1 := []string{"1/3", "Chorus", "2/3", "Chorus", "3/3", "Chorus"}
	if fmt.Sprint(songSet1Labels) != fmt.Sprint(want1) {
		t.Errorf("ds-opening lyric roleLabels = %v, want %v", songSet1Labels, want1)
	}

	// SDAH #200: 4 stanzas with chorus -> 1/4, Chorus, 2/4, Chorus, 3/4, Chorus, 4/4, Chorus
	want2 := []string{"1/4", "Chorus", "2/4", "Chorus", "3/4", "Chorus", "4/4", "Chorus"}
	if fmt.Sprint(songSet2Labels) != fmt.Sprint(want2) {
		t.Errorf("ds-closing lyric roleLabels = %v, want %v", songSet2Labels, want2)
	}
}

func TestSongSetMasterDataDeckSequenceDecoupling(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Initially, opening_song_bt exists in song_set_entries AND in artifact_templates
	var entryCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_set_entries WHERE variable_name = 'opening_song_bt'`).Scan(&entryCount); err != nil || entryCount == 0 {
		t.Fatalf("expected opening_song_bt in song_set_entries, got count=%d, err=%v", entryCount, err)
	}

	// Find the slide in artifact_templates
	var slideID, updatedAt string
	err := handle.QueryRow(`SELECT id, updated_at FROM artifact_templates WHERE base_type = 'song-set-entry' AND variable_name = 'opening_song_bt' LIMIT 1`).Scan(&slideID, &updatedAt)
	if err != nil {
		t.Fatalf("expected slide in artifact_templates for opening_song_bt: %v", err)
	}

	// 2. Delete the slide from the Deck Sequence (artifact_templates) via DELETE /api/admin/artifacts/{id}
	delRes := songSetRequest(t, ts, "DELETE", "/api/admin/artifacts/"+slideID, fmt.Sprintf(`{"updatedAt":%q}`, updatedAt), cookie)
	if delRes.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(delRes.Body)
		t.Fatalf("delete slide from deck sequence failed: status=%d, body=%s", delRes.StatusCode, b)
	}
	delRes.Body.Close()

	// 3. Confirm the slide is gone from artifact_templates
	var countInDeck int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM artifact_templates WHERE id = ?`, slideID).Scan(&countInDeck)
	if countInDeck != 0 {
		t.Errorf("slide should be deleted from artifact_templates, but count=%d", countInDeck)
	}

	// 4. Confirm opening_song_bt is STILL intact in master data (song_set_entries)
	listRes := songSetRequest(t, ts, "GET", "/api/admin/song-set-entries", "", cookie)
	if listRes.StatusCode != http.StatusOK {
		t.Fatalf("list master entries failed: %d", listRes.StatusCode)
	}
	body := songSetJSON(t, listRes)
	entries, _ := body["entries"].([]any)
	foundMaster := false
	for _, raw := range entries {
		e, _ := raw.(map[string]any)
		if e["variableName"] == "opening_song_bt" {
			foundMaster = true
			break
		}
	}
	if !foundMaster {
		t.Errorf("master entry opening_song_bt disappeared after slide was deleted from deck sequence!")
	}

	// 5. Re-add the slide to the Deck Sequence via POST /api/admin/artifacts
	addRes := songSetRequest(t, ts, "POST", "/api/admin/artifacts", `{"baseType":"song-set-entry","variableName":"opening_song_bt"}`, cookie)
	if addRes.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(addRes.Body)
		t.Fatalf("re-adding song-set-entry to deck sequence failed: status=%d, body=%s", addRes.StatusCode, b)
	}
	addBody := songSetJSON(t, addRes)
	newSlideID, _ := addBody["id"].(string)
	if newSlideID == "" {
		t.Fatalf("re-added slide has empty id: %v", addBody)
	}

	// 6. Verify the slide is back in artifact_templates
	_ = handle.QueryRow(`SELECT COUNT(*) FROM artifact_templates WHERE id = ? AND variable_name = 'opening_song_bt'`, newSlideID).Scan(&countInDeck)
	if countInDeck != 1 {
		t.Errorf("re-added slide not found in artifact_templates: count=%d", countInDeck)
	}
}

