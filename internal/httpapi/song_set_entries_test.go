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

	"github.com/wiradeltaid/worship-deck/internal/db"
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

	var anthemGid string
	if err := handle.QueryRow(`SELECT global_id FROM song_set_entries WHERE variable_name = 'special_anthem'`).Scan(&anthemGid); err != nil || !db.IsValidUUIDv7(anthemGid) {
		t.Fatalf("expected valid UUIDv7 global_id for song set entry special_anthem, got %q (err: %v)", anthemGid, err)
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

	// 1. Snapshot complete master record (variable_name, title, position, updated_at) before deletion
	var snapVn, snapTitle, snapUpdated string
	var snapPos int
	err := handle.QueryRow(`SELECT variable_name, title, position, updated_at FROM song_set_entries WHERE variable_name = 'opening_song_bt'`).Scan(&snapVn, &snapTitle, &snapPos, &snapUpdated)
	if err != nil {
		t.Fatalf("expected opening_song_bt in song_set_entries: %v", err)
	}

	// Find the slide in artifact_templates
	var slideID, updatedAt string
	err = handle.QueryRow(`SELECT id, updated_at FROM artifact_templates WHERE base_type = 'song-set-entry' AND variable_name = 'opening_song_bt' LIMIT 1`).Scan(&slideID, &updatedAt)
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

	// 4. Exact master data invariance: assert all 4 master record fields are strictly identical (zero mutation)
	var postVn, postTitle, postUpdated string
	var postPos int
	err = handle.QueryRow(`SELECT variable_name, title, position, updated_at FROM song_set_entries WHERE variable_name = 'opening_song_bt'`).Scan(&postVn, &postTitle, &postPos, &postUpdated)
	if err != nil {
		t.Fatalf("master record opening_song_bt disappeared after slide deletion: %v", err)
	}
	if postVn != snapVn || postTitle != snapTitle || postPos != snapPos || postUpdated != snapUpdated {
		t.Fatalf("master record was mutated on deck sequence slide deletion: got (%s, %s, %d, %s), want (%s, %s, %d, %s)",
			postVn, postTitle, postPos, postUpdated, snapVn, snapTitle, snapPos, snapUpdated)
	}

	// 5. Multi-instance resilience: insert two deck instances for the same song set
	res1 := songSetRequest(t, ts, "POST", "/api/admin/artifacts", `{"baseType":"song-set-entry","variableName":"opening_song_bt"}`, cookie)
	if res1.StatusCode != http.StatusCreated {
		t.Fatalf("insert instance 1 failed: %d", res1.StatusCode)
	}
	body1 := songSetJSON(t, res1)
	inst1ID := body1["id"].(string)
	inst1Updated := body1["updatedAt"].(string)

	res2 := songSetRequest(t, ts, "POST", "/api/admin/artifacts", `{"baseType":"song-set-entry","variableName":"opening_song_bt"}`, cookie)
	if res2.StatusCode != http.StatusCreated {
		t.Fatalf("insert instance 2 failed: %d", res2.StatusCode)
	}
	body2 := songSetJSON(t, res2)
	inst2ID := body2["id"].(string)

	if inst1ID == inst2ID {
		t.Fatalf("multiple insertions must produce distinct IDs: got %s", inst1ID)
	}

	// Delete instance 1
	delInst1 := songSetRequest(t, ts, "DELETE", "/api/admin/artifacts/"+inst1ID, fmt.Sprintf(`{"updatedAt":%q}`, inst1Updated), cookie)
	if delInst1.StatusCode != http.StatusOK {
		t.Fatalf("delete instance 1 failed: %d", delInst1.StatusCode)
	}
	delInst1.Body.Close()

	// Verify instance 1 is gone, but instance 2 STILL survives in artifact_templates
	var c1, c2 int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM artifact_templates WHERE id = ?`, inst1ID).Scan(&c1)
	_ = handle.QueryRow(`SELECT COUNT(*) FROM artifact_templates WHERE id = ?`, inst2ID).Scan(&c2)
	if c1 != 0 {
		t.Errorf("instance 1 still exists in deck sequence")
	}
	if c2 != 1 {
		t.Errorf("instance 2 was erroneously deleted when instance 1 was removed")
	}

	// Master data remains untouched
	err = handle.QueryRow(`SELECT variable_name FROM song_set_entries WHERE variable_name = 'opening_song_bt'`).Scan(&postVn)
	if err != nil {
		t.Fatalf("master record missing after multi-instance deletion: %v", err)
	}
}

func TestSongSetEntryExtractionRegexEndpoints(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. GET /api/admin/song-set-entries: check extraction_regex key presence on entries
	res := songSetRequest(t, ts, "GET", "/api/admin/song-set-entries", "", cookie)
	body := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/admin/song-set-entries status = %d, want 200", res.StatusCode)
	}
	entries, ok := body["entries"].([]any)
	if !ok || len(entries) == 0 {
		t.Fatalf("entries missing or empty: %v", body["entries"])
	}
	first := entries[0].(map[string]any)
	if _, exists := first["extraction_regex"]; !exists {
		t.Errorf("expected extraction_regex property in admin songSetEntry response: %v", first)
	}

	// 2. GET /api/song-set-entries (operator): check extraction_regex key presence
	resOp := songSetRequest(t, ts, "GET", "/api/song-set-entries", "", cookie)
	bodyOp := songSetJSON(t, resOp)
	if resOp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/song-set-entries status = %d, want 200", resOp.StatusCode)
	}
	entriesOp, ok := bodyOp["entries"].([]any)
	if !ok || len(entriesOp) == 0 {
		t.Fatalf("operator entries missing or empty: %v", bodyOp["entries"])
	}
	firstOp := entriesOp[0].(map[string]any)
	if _, exists := firstOp["extraction_regex"]; !exists {
		t.Errorf("expected extraction_regex property in operator songSetEntry response: %v", firstOp)
	}

	// 3. POST /api/admin/song-set-entries: create with valid regex
	validPattern := `(?i)^Opening Hymn\s*[:\-]\s*(?<number>\d+)`
	createRes := songSetRequest(t, ts, "POST", "/api/admin/song-set-entries",
		fmt.Sprintf(`{"variableName":"praise_opener","title":"Praise Opener","extraction_regex":%q}`, validPattern), cookie)
	createBody := songSetJSON(t, createRes)
	if createRes.StatusCode != http.StatusCreated {
		t.Fatalf("POST with extraction_regex status = %d (%v), want 201", createRes.StatusCode, createBody)
	}
	if createBody["extraction_regex"] != validPattern {
		t.Errorf("created extraction_regex = %v, want %q", createBody["extraction_regex"], validPattern)
	}

	// 4. POST /api/admin/song-set-entries: create with invalid regex -> 400
	badPattern := `(?i)^Opening Hymn\s*[:\-]\s*(?<unclosed(`
	badCreateRes := songSetRequest(t, ts, "POST", "/api/admin/song-set-entries",
		fmt.Sprintf(`{"variableName":"praise_bad","title":"Praise Bad","extraction_regex":%q}`, badPattern), cookie)
	if badCreateRes.StatusCode != http.StatusBadRequest {
		t.Errorf("POST with bad regex status = %d, want 400", badCreateRes.StatusCode)
	}
	badCreateRes.Body.Close()

	// 5. PUT /api/admin/song-set-entries/{variableName}/extraction-regex: update with valid pattern
	newPattern := `(?i)^Praise\s*1\s*[:\-]\s*(?:#\s*)?(?<number>\d+)`
	putRes := songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/praise_opener/extraction-regex",
		fmt.Sprintf(`{"extraction_regex":%q}`, newPattern), cookie)
	putBody := songSetJSON(t, putRes)
	if putRes.StatusCode != http.StatusOK {
		t.Fatalf("PUT extraction-regex status = %d (%v), want 200", putRes.StatusCode, putBody)
	}
	if putBody["extraction_regex"] != newPattern {
		t.Errorf("updated extraction_regex = %v, want %q", putBody["extraction_regex"], newPattern)
	}

	// 6. PUT with malformed pattern -> 400
	badPutRes := songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/praise_opener/extraction-regex",
		`{"extraction_regex":"(?i)^Praise\\s*[:\\-]\\s*(?<unclosed("}`, cookie)
	if badPutRes.StatusCode != http.StatusBadRequest {
		t.Errorf("PUT with malformed regex status = %d, want 400", badPutRes.StatusCode)
	}
	badPutRes.Body.Close()

	// 7. Verify GET /api/admin/song-set-entries returns the updated non-null extraction_regex
	resVerify := songSetRequest(t, ts, "GET", "/api/admin/song-set-entries", "", cookie)
	bodyVerify := songSetJSON(t, resVerify)
	foundOpener := false
	for _, raw := range bodyVerify["entries"].([]any) {
		e := raw.(map[string]any)
		if e["variableName"] == "praise_opener" {
			foundOpener = true
			if e["extraction_regex"] != newPattern {
				t.Errorf("praise_opener extraction_regex = %v, want %q", e["extraction_regex"], newPattern)
			}
		}
	}
	if !foundOpener {
		t.Errorf("praise_opener entry was not found in admin list")
	}

	// 8. Atomic PATCH of title, variableName, AND extraction_regex
	atomicPatchRes := songSetRequest(t, ts, "PATCH", "/api/admin/song-set-entries/praise_opener",
		fmt.Sprintf(`{"title":"Praise Opening Renamed","variableName":"praise_first","extraction_regex":%q,"updatedAt":%q}`,
			`(?i)^Opening\s*Praise\s*[:\-]\s*(?<number>\d+)`, putBody["updatedAt"]), cookie)
	atomicPatchBody := songSetJSON(t, atomicPatchRes)
	if atomicPatchRes.StatusCode != http.StatusOK {
		t.Fatalf("atomic PATCH status = %d (%v), want 200", atomicPatchRes.StatusCode, atomicPatchBody)
	}
	if atomicPatchBody["variableName"] != "praise_first" || atomicPatchBody["title"] != "Praise Opening Renamed" {
		t.Errorf("atomic PATCH unexpected body: %v", atomicPatchBody)
	}
	if atomicPatchBody["extraction_regex"] != `(?i)^Opening\s*Praise\s*[:\-]\s*(?<number>\d+)` {
		t.Errorf("atomic PATCH extraction_regex = %v", atomicPatchBody["extraction_regex"])
	}

	// 9. PUT clearing extraction_regex (empty string -> null)
	clearPutRes := songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/praise_first/extraction-regex",
		`{"extraction_regex":""}`, cookie)
	clearPutBody := songSetJSON(t, clearPutRes)
	if clearPutRes.StatusCode != http.StatusOK {
		t.Fatalf("PUT clear regex status = %d (%v), want 200", clearPutRes.StatusCode, clearPutBody)
	}
	if clearPutBody["extraction_regex"] != nil {
		t.Errorf("expected null extraction_regex after clear, got %v", clearPutBody["extraction_regex"])
	}

	// 10. PUT with camelCase extractionRegex
	camelPutRes := songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/praise_first/extraction-regex",
		`{"extractionRegex":"(?i)^Praise\\s*#?(?<number>\\d+)"}`, cookie)
	camelPutBody := songSetJSON(t, camelPutRes)
	if camelPutRes.StatusCode != http.StatusOK {
		t.Fatalf("PUT camelCase regex status = %d (%v), want 200", camelPutRes.StatusCode, camelPutBody)
	}
	if camelPutBody["extraction_regex"] != `(?i)^Praise\s*#?(?<number>\d+)` {
		t.Errorf("expected camelCase regex persisted: %v", camelPutBody["extraction_regex"])
	}

	// 11. Unauthenticated request to extraction-regex endpoint -> 401
	unauthRes := songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/praise_first/extraction-regex", `{"extraction_regex":""}`, nil)
	if unauthRes.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated PUT status = %d, want 401", unauthRes.StatusCode)
	}
	unauthRes.Body.Close()

	// 12. Non-existent entry -> 404
	notFoundRes := songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/non_existent_slot/extraction-regex", `{"extraction_regex":""}`, cookie)
	if notFoundRes.StatusCode != http.StatusNotFound {
		t.Errorf("not-found PUT status = %d, want 404", notFoundRes.StatusCode)
	}
	notFoundRes.Body.Close()
}

