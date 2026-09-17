package httpapi

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// loginAsOperator creates a second account with the operator role through the
// admin API and returns its session cookie, so the authorization matrix is
// exercised against a real non-admin session.
func loginAsOperator(t *testing.T, ts *httptest.Server, admin *http.Cookie) *http.Cookie {
	t.Helper()
	res := songSetRequest(t, ts, "POST", "/api/admin/accounts",
		`{"username":"operator1","password":"operator-pass-123","role":"operator"}`, admin)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create operator account failed: %d", res.StatusCode)
	}
	res.Body.Close()
	res = songSetRequest(t, ts, "POST", "/api/auth/login",
		`{"username":"operator1","password":"operator-pass-123"}`, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("operator login failed: %d", res.StatusCode)
	}
	for _, c := range res.Cookies() {
		if c.Name == "wpw_session" || strings.Contains(c.Name, "session") {
			return c
		}
	}
	t.Fatal("no session cookie returned for operator")
	return nil
}

type songSetInputRow struct {
	Number  sql.NullInt64
	Book    sql.NullString
	Backgnd sql.NullString
	Lyric   sql.NullString
}

func songSetInputRows(t *testing.T, handle *sql.DB, serviceID int64) map[string]songSetInputRow {
	t.Helper()
	rows, err := handle.Query(
		`SELECT variable_name, song_number, song_book_code, background_id, lyric_override
		   FROM song_set_inputs WHERE service_id = ?`, serviceID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := map[string]songSetInputRow{}
	for rows.Next() {
		var name string
		var r songSetInputRow
		if err := rows.Scan(&name, &r.Number, &r.Book, &r.Backgnd, &r.Lyric); err != nil {
			t.Fatal(err)
		}
		out[name] = r
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

// freshUpdatedAt reads the Service's current concurrency token (CAP-5).
func freshUpdatedAt(t *testing.T, ts *httptest.Server, cookie *http.Cookie, id int64) string {
	t.Helper()
	res := songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", id), "", cookie)
	body := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get service failed: %d", res.StatusCode)
	}
	token, _ := body["updated_at"].(string)
	if token == "" {
		t.Fatal("service response carries no updated_at token")
	}
	return token
}

func TestSongSetEntriesOperatorEndpoint(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)

	// Unauthenticated: the AD-5 session gate must refuse.
	res := songSetRequest(t, ts, "GET", "/api/song-set-entries", "", nil)
	songSetJSON(t, res)
	if res.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated GET = %d, want 401", res.StatusCode)
	}

	admin := songSetLogin(t, ts)
	res = songSetRequest(t, ts, "GET", "/api/song-set-entries", "", admin)
	body := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Errorf("admin GET = %d, want 200", res.StatusCode)
	}
	entries, _ := body["entries"].([]any)
	if len(entries) == 0 {
		t.Fatal("admin GET returned no entries; shipped registry seeds four")
	}

	// Operator: same endpoint, same 200 — this is the FR-32 form feed.
	op := loginAsOperator(t, ts, admin)
	res = songSetRequest(t, ts, "GET", "/api/song-set-entries", "", op)
	body = songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Errorf("operator GET = %d, want 200", res.StatusCode)
	}
	first, _ := entries[0].(map[string]any)
	if first["variableName"] == "" || first["title"] == "" {
		t.Errorf("entry shape wrong: %v", first)
	}
}

func TestSongSetInputsUpsertLifecycle(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	admin := songSetLogin(t, ts)

	// Create: two entries, one resolvable (159) and one not (9999).
	res := songSetRequest(t, ts, "POST", "/api/services", `{
		"raw_payload": "SABBATH, JULY 25, 2026\nDIVINE SERVICE\nSermon: Pastor Adam",
		"fields": {
			"songSets": {
				"opening_song_bt": {"songNumber": 159},
				"closing_song_bt": {"songNumber": 9999}
			}
		}
	}`, admin)
	createBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create failed: %d %v", res.StatusCode, createBody)
	}
	id := int64(createBody["id"].(float64))

	failed, _ := createBody["failedHymnNumbers"].([]any)
	if len(failed) != 1 || failed[0].(float64) != 9999 {
		t.Errorf("failedHymnNumbers = %v, want [9999]", failed)
	}

	rows := songSetInputRows(t, handle, id)
	if len(rows) != 2 {
		t.Fatalf("expected 2 song_set_inputs rows, got %d", len(rows))
	}
	if got := rows["opening_song_bt"].Number; !got.Valid || got.Int64 != 159 {
		t.Errorf("opening_song_bt number = %v, want 159", got)
	}
	if got := rows["closing_song_bt"].Number; !got.Valid || got.Int64 != 9999 {
		t.Errorf("closing_song_bt number = %v, want 9999", got)
	}

	// Update: change one number, clear the other, add book/background/lyric.
	token := freshUpdatedAt(t, ts, admin, id)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", id), fmt.Sprintf(`{
		"updated_at": %q,
		"fields": {
			"songSets": {
				"opening_song_bt": {"songNumber": 88, "songBookCode": "SDAH", "background": "bg-1", "lyricText": "Custom verse"},
				"closing_song_bt": {"songNumber": null}
			}
		}
	}`, token), admin)
	updateBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update failed: %d %v", res.StatusCode, updateBody)
	}

	rows = songSetInputRows(t, handle, id)
	r := rows["opening_song_bt"]
	if !r.Number.Valid || r.Number.Int64 != 88 || !r.Book.Valid || r.Book.String != "SDAH" ||
		!r.Backgnd.Valid || r.Backgnd.String != "bg-1" || !r.Lyric.Valid || r.Lyric.String != "Custom verse" {
		t.Errorf("opening_song_bt = %+v, want 88/SDAH/bg-1/Custom verse", r)
	}
	if rows["closing_song_bt"].Number.Valid {
		t.Errorf("closing_song_bt should be NULL after clearing, got %v", rows["closing_song_bt"].Number)
	}

	// GET hydrate: the stored inputs come back keyed by variable_name.
	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", id), "", admin)
	getBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get failed: %d", res.StatusCode)
	}
	sets, _ := getBody["songSets"].(map[string]any)
	if sets == nil {
		t.Fatal("GET /api/services/{id} response carries no songSets object")
	}
	opening, _ := sets["opening_song_bt"].(map[string]any)
	if opening == nil || opening["songNumber"].(float64) != 88 || opening["songBookCode"] != "SDAH" {
		t.Errorf("hydrated opening_song_bt = %v, want 88/SDAH", opening)
	}
	closing, _ := sets["closing_song_bt"].(map[string]any)
	if closing == nil || closing["songNumber"] != nil {
		t.Errorf("hydrated closing_song_bt = %v, want null songNumber", closing)
	}

	// An update without a songSets section leaves stored rows untouched.
	token = freshUpdatedAt(t, ts, admin, id)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", id), fmt.Sprintf(`{
		"updated_at": %q,
		"fields": {"sermonSpeaker": "Pr. Noah"}
	}`, token), admin)
	songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("field-only update failed: %d", res.StatusCode)
	}
	rows = songSetInputRows(t, handle, id)
	if !rows["opening_song_bt"].Number.Valid || rows["opening_song_bt"].Number.Int64 != 88 {
		t.Errorf("field-only update clobbered song_set_inputs: %+v", rows["opening_song_bt"])
	}

	// Junk keys that cannot be variable_names are skipped, not stored.
	token = freshUpdatedAt(t, ts, admin, id)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", id), fmt.Sprintf(`{
		"updated_at": %q,
		"fields": {"songSets": {"Not A Name": {"songNumber": 1}}}
	}`, token), admin)
	songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("junk-key update failed: %d", res.StatusCode)
	}
	rows = songSetInputRows(t, handle, id)
	if _, ok := rows["Not A Name"]; ok {
		t.Error("a key failing the variable_name pattern was persisted")
	}
	if len(rows) != 2 {
		t.Errorf("row count changed after junk-key update: %d", len(rows))
	}
}

func TestServices_StrayAnnouncementsIgnoredOnCreateAndUpdate(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	admin := songSetLogin(t, ts)

	// Clean out any existing announcement_items
	if _, err := handle.Exec(`DELETE FROM announcement_items`); err != nil {
		t.Fatalf("delete announcement_items: %v", err)
	}

	// 1. Create with announcements field - must succeed and not write to announcement_items
	res := songSetRequest(t, ts, "POST", "/api/services", `{
		"raw_payload": "SABBATH, JULY 25, 2026\nDIVINE SERVICE\nSermon: Pastor Adam",
		"announcements": [
			{"image_url": "https://example.com/flyer1.png", "is_recurring": false}
		]
	}`, admin)
	createBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create with announcements failed: %d %v", res.StatusCode, createBody)
	}
	id := int64(createBody["id"].(float64))

	var count int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM announcement_items`).Scan(&count); err != nil {
		t.Fatalf("query announcement_items: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 announcement_items after create, got %d", count)
	}

	// 2. Update with announcements field - must succeed (200, not 400/500) and not write to announcement_items
	token := freshUpdatedAt(t, ts, admin, id)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", id), fmt.Sprintf(`{
		"updated_at": %q,
		"raw_payload": "SABBATH, JULY 25, 2026\nDIVINE SERVICE\nSermon: Pastor Noah",
		"announcements": [
			{"image_url": "https://example.com/flyer2.png", "is_recurring": false}
		]
	}`, token), admin)
	updateBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update with announcements failed: %d %v", res.StatusCode, updateBody)
	}

	if err := handle.QueryRow(`SELECT COUNT(*) FROM announcement_items`).Scan(&count); err != nil {
		t.Fatalf("query announcement_items: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 announcement_items after update, got %d", count)
	}
}

func TestCustomSongSetInPreviewAndServicePlan(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	admin := songSetLogin(t, ts)

	// 1. Create a custom song-set entry via admin API
	res := songSetRequest(t, ts, "POST", "/api/admin/song-set-entries", `{
		"title": "Bible Talk Opening Song",
		"variableName": "bible_talk_opening"
	}`, admin)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create custom song set entry failed: %d", res.StatusCode)
	}
	res.Body.Close()

	// 2. Test live preview with custom song-set entry populated in fields.songSets
	res = songSetRequest(t, ts, "POST", "/api/services/preview", `{
		"raw_payload": "SABBATH, JULY 25, 2026\nDIVINE SERVICE\nSermon: Pastor Adam",
		"fields": {
			"songSets": {
				"bible_talk_opening": {"songNumber": 100, "songBookCode": "SDAH"}
			}
		}
	}`, admin)
	previewBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("preview failed: %d %v", res.StatusCode, previewBody)
	}
	planItems, _ := previewBody["plan"].([]any)
	hasCustomSongSlide := false
	for i, it := range planItems {
		itm, _ := it.(map[string]any)
		art, _ := itm["artifact"].(map[string]any)
		if grp, ok := art["group"].(map[string]any); ok {
			if id, ok := grp["id"].(string); ok && (strings.Contains(id, "bible_talk_opening") || strings.Contains(id, "bible-talk-opening")) {
				hasCustomSongSlide = true
				break
			}
		}
		if tid, ok := art["templateId"].(string); ok && (strings.Contains(tid, "bible_talk_opening") || strings.Contains(tid, "bible-talk-opening")) {
			hasCustomSongSlide = true
			break
		}
		_ = i
	}
	if !hasCustomSongSlide {
		t.Errorf("preview plan does not contain slides for custom song-set bible_talk_opening")
	}

	// 3. Create service with custom song set
	res = songSetRequest(t, ts, "POST", "/api/services", `{
		"raw_payload": "SABBATH, JULY 25, 2026\nDIVINE SERVICE\nSermon: Pastor Adam",
		"fields": {
			"songSets": {
				"bible_talk_opening": {"songNumber": 100, "songBookCode": "SDAH"}
			}
		}
	}`, admin)
	createBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create failed: %d %v", res.StatusCode, createBody)
	}
	serviceID := int64(createBody["id"].(float64))

	// 4. Freeze service registry snapshot (Sync Artifact)
	token := freshUpdatedAt(t, ts, admin, serviceID)
	res = songSetRequest(t, ts, "POST", fmt.Sprintf("/api/services/%d/sync-artifact", serviceID), fmt.Sprintf(`{"updated_at":%q}`, token), admin)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("sync-artifact failed: %d", res.StatusCode)
	}
	res.Body.Close()

	// 5. Get service plan: must contain slides for custom song set even from frozen snapshot
	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", serviceID), "", admin)
	svcBody := songSetJSON(t, res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get service failed: %d", res.StatusCode)
	}
	svcPlan, _ := svcBody["plan"].([]any)
	hasCustomSongInService := false
	for i, it := range svcPlan {
		itm, _ := it.(map[string]any)
		art, _ := itm["artifact"].(map[string]any)
		t.Logf("service item %d: templateId=%v, label=%v, group=%v", i, art["templateId"], art["label"], art["group"])
		if grp, ok := art["group"].(map[string]any); ok {
			if id, ok := grp["id"].(string); ok && (strings.Contains(id, "bible_talk_opening") || strings.Contains(id, "bible-talk-opening")) {
				hasCustomSongInService = true
				break
			}
		}
	}
	if !hasCustomSongInService {
		t.Errorf("saved service plan does not contain slides for custom song-set bible_talk_opening")
	}
}
