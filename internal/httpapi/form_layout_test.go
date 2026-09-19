package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

func TestFormLayoutAPI_FullCoverage(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. GET /api/worship-form-layout unauthorized -> 401
	res := songSetRequest(t, ts, "GET", "/api/worship-form-layout", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth GET /api/worship-form-layout = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 2. GET /api/worship-form-layout as authenticated session -> 200
	res = songSetRequest(t, ts, "GET", "/api/worship-form-layout", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("auth GET /api/worship-form-layout = %d, want 200", res.StatusCode)
	}
	var layoutResp struct {
		Layout struct {
			ID string `json:"id"`
		} `json:"layout"`
		Groupings []struct {
			ID    string `json:"id"`
			Label string `json:"label"`
			Slots []struct {
				ID         string `json:"id"`
				WidgetKind string `json:"widget_kind"`
				RefKey     string `json:"ref_key"`
			} `json:"slots"`
		} `json:"groupings"`
		PredefinedFields []struct {
			ID           string `json:"id"`
			VariableName string `json:"variable_name"`
			FieldType    string `json:"field_type"`
		} `json:"predefined_fields"`
	}
	if err := json.NewDecoder(res.Body).Decode(&layoutResp); err != nil {
		t.Fatalf("decode layout: %v", err)
	}
	res.Body.Close()

	if layoutResp.Layout.ID != "default-layout" {
		t.Fatalf("expected layout id default-layout, got %s", layoutResp.Layout.ID)
	}
	if len(layoutResp.Groupings) != 7 {
		t.Fatalf("expected 7 groupings, got %d", len(layoutResp.Groupings))
	}
	if len(layoutResp.PredefinedFields) != 13 {
		t.Fatalf("expected 13 predefined fields, got %d", len(layoutResp.PredefinedFields))
	}

	// 3. POST /api/admin/form-groupings (Create new grouping)
	newGroupPayload := `{"label":"Mission Spotlight","description":"Weekly mission spotlight feature"}`
	res = songSetRequest(t, ts, "POST", "/api/admin/form-groupings", newGroupPayload, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create grouping = %d, want 200/201", res.StatusCode)
	}
	var createdGroup struct {
		ID        string `json:"id"`
		Label     string `json:"label"`
		SortOrder int    `json:"sort_order"`
	}
	_ = json.NewDecoder(res.Body).Decode(&createdGroup)
	res.Body.Close()

	if createdGroup.ID == "" || createdGroup.Label != "Mission Spotlight" {
		t.Fatalf("unexpected created group: %+v", createdGroup)
	}

	// 4. PUT /api/admin/form-groupings/reorder
	reorderPayload := fmt.Sprintf(`[{"id":"%s","sort_order":1},{"id":"grouping-song-set","sort_order":2}]`, createdGroup.ID)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", reorderPayload, cookie)
	if res.StatusCode != http.StatusOK {
		var errBody map[string]any
		_ = json.NewDecoder(res.Body).Decode(&errBody)
		t.Fatalf("reorder groupings = %d, want 200, body=%v", res.StatusCode, errBody)
	}
	res.Body.Close()

	// 5. POST /api/admin/predefined-fields (Create custom field)
	customFieldPayload := `{"variable_name":"mission_speaker","shown_text":"Mission Speaker","field_type":"text","input_length":100,"extraction_regex":"(?i)^Mission\\s*[:\\-]\\s*(?<value>.*)$"}`
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields", customFieldPayload, cookie)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		t.Fatalf("create custom field = %d, want 200", res.StatusCode)
	}
	var createdField struct {
		ID           string `json:"id"`
		VariableName string `json:"variable_name"`
	}
	_ = json.NewDecoder(res.Body).Decode(&createdField)
	res.Body.Close()

	if createdField.VariableName != "mission_speaker" {
		t.Fatalf("unexpected created field: %+v", createdField)
	}

	// 6. POST /api/admin/predefined-fields validation errors:
	// a. Reserved key rejection
	reservedPayload := `{"variable_name":"hymnNumber","shown_text":"Hymn","field_type":"text"}`
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields", reservedPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("reserved variable_name status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// b. Invalid variable_name format
	invalidNamePayload := `{"variable_name":"Invalid-Name","shown_text":"Test","field_type":"text"}`
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields", invalidNamePayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid variable_name format status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// c. Image field with regex rejection
	imageRegexPayload := `{"variable_name":"custom_image","shown_text":"Image","field_type":"image","extraction_regex":"(?i)some_regex"}`
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields", imageRegexPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("image with regex status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// d. Invalid regex compilation error
	badRegexPayload := `{"variable_name":"bad_regex_field","shown_text":"Bad","field_type":"text","extraction_regex":"(?i)[unclosed_bracket"}`
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields", badRegexPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid regex pattern status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// e. Test variable_name immutability on edit
	editPayload := fmt.Sprintf(`{"id":"%s","variable_name":"attempted_rename","shown_text":"Updated Mission Speaker","field_type":"text"}`, createdField.ID)
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields", editPayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("edit predefined field = %d, want 200", res.StatusCode)
	}
	var editedField struct {
		VariableName string `json:"variable_name"`
		ShownText    string `json:"shown_text"`
	}
	_ = json.NewDecoder(res.Body).Decode(&editedField)
	res.Body.Close()
	if editedField.VariableName != "mission_speaker" {
		t.Fatalf("expected immutable variable_name 'mission_speaker', got %q", editedField.VariableName)
	}
	if editedField.ShownText != "Updated Mission Speaker" {
		t.Fatalf("expected updated shown_text, got %q", editedField.ShownText)
	}

	// 7. POST /api/admin/form-grouping-slots validation:
	// a. Invalid announcement_slot ref_key ("5", "0", "invalid") -> 400
	badAnnSlotPayload := fmt.Sprintf(`{"grouping_id":"%s","widget_kind":"announcement_slot","ref_key":"5"}`, createdGroup.ID)
	res = songSetRequest(t, ts, "POST", "/api/admin/form-grouping-slots", badAnnSlotPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("announcement_slot ref_key 5 status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// b. Nonexistent predefined_field ref_key -> 400
	badFieldSlotPayload := fmt.Sprintf(`{"grouping_id":"%s","widget_kind":"predefined_field","ref_key":"nonexistent_var"}`, createdGroup.ID)
	res = songSetRequest(t, ts, "POST", "/api/admin/form-grouping-slots", badFieldSlotPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("nonexistent predefined_field ref_key status = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 7c. POST /api/admin/form-grouping-slots (Add slot to new grouping)
	addSlotPayload := fmt.Sprintf(`{"grouping_id":"%s","widget_kind":"predefined_field","ref_key":"mission_speaker"}`, createdGroup.ID)
	res = songSetRequest(t, ts, "POST", "/api/admin/form-grouping-slots", addSlotPayload, cookie)
	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusOK {
		t.Fatalf("add slot status = %d, want 201/200", res.StatusCode)
	}
	var createdSlot struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&createdSlot)
	res.Body.Close()

	// Test Cardinality Conflict: Adding duplicate slot with same widget_kind and ref_key in layout -> 409 Conflict
	dupSlotPayload := fmt.Sprintf(`{"grouping_id":"grouping-song-set","widget_kind":"predefined_field","ref_key":"mission_speaker"}`,)
	res = songSetRequest(t, ts, "POST", "/api/admin/form-grouping-slots", dupSlotPayload, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("duplicate slot across layout = %d, want 409 Conflict", res.StatusCode)
	}
	res.Body.Close()

	// 8. PUT /api/admin/form-grouping-slots/reorder
	reorderSlotPayload := fmt.Sprintf(`{"slots":[{"id":"%s","sort_order":1}]}`, createdSlot.ID)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-grouping-slots/reorder", reorderSlotPayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("reorder slot = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 9. DELETE /api/admin/form-grouping-slots/{id}
	res = songSetRequest(t, ts, "DELETE", "/api/admin/form-grouping-slots/"+createdSlot.ID, "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete slot = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 10. DELETE /api/admin/form-groupings/{id}
	res = songSetRequest(t, ts, "DELETE", "/api/admin/form-groupings/"+createdGroup.ID, "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete grouping = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 11. DELETE /api/admin/predefined-fields/{id} (Soft-delete)
	res = songSetRequest(t, ts, "DELETE", "/api/admin/predefined-fields/"+createdField.ID, "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("soft-delete predefined field = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 12. POST /api/admin/predefined-fields/seed-defaults
	res = songSetRequest(t, ts, "POST", "/api/admin/predefined-fields/seed-defaults", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("seed defaults = %d, want 200", res.StatusCode)
	}
	var seedReport db.SeedReport
	_ = json.NewDecoder(res.Body).Decode(&seedReport)
	res.Body.Close()
	if seedReport.Skipped != 13 {
		t.Fatalf("expected 13 skipped default fields, got %+v", seedReport)
	}

	// 13. PUT /api/admin/song-set-entries/{variableName}/extraction-regex
	// First create the song set entry
	res = songSetRequest(t, ts, "POST", "/api/admin/song-set-entries", `{"variableName":"ds_opening_song","title":"Opening Song","position":1}`, cookie)
	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusOK {
		t.Fatalf("create song set entry = %d, want 201/200", res.StatusCode)
	}
	res.Body.Close()

	songRegexPayload := `{"extraction_regex":"(?i)(?:Lagu\\s+Buka|Opening\\s+Song)\\s*[:\\-]\\s*#?\\s*(?<number>\\d+)"}`
	res = songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/ds_opening_song/extraction-regex", songRegexPayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update song set regex = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Invalid regex on song set entry -> 400
	badSongRegexPayload := `{"extraction_regex":"(?i)(?<lookahead>abc)(?=def)"}`
	res = songSetRequest(t, ts, "PUT", "/api/admin/song-set-entries/ds_opening_song/extraction-regex", badSongRegexPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("lookahead regex on song set = %d, want 400", res.StatusCode)
	}
	res.Body.Close()
}
