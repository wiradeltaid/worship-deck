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

	// 4. PUT /api/admin/form-groupings/reorder (Full normalized sequential membership)
	res = songSetRequest(t, ts, "GET", "/api/worship-form-layout", "", cookie)
	var curLayout struct {
		Groupings []struct {
			ID string `json:"id"`
		} `json:"groupings"`
	}
	_ = json.NewDecoder(res.Body).Decode(&curLayout)
	res.Body.Close()

	var reorderItems []map[string]any
	reorderItems = append(reorderItems, map[string]any{"id": createdGroup.ID, "sort_order": 1})
	order := 2
	for _, g := range curLayout.Groupings {
		if g.ID != createdGroup.ID {
			reorderItems = append(reorderItems, map[string]any{"id": g.ID, "sort_order": order})
			order++
		}
	}
	reorderBytes, _ := json.Marshal(reorderItems)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", string(reorderBytes), cookie)
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

func TestFormLayout_SPEC53_ReorderAndTransfer(t *testing.T) {
	ts, db, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Fetch current layout
	res := songSetRequest(t, ts, "GET", "/api/worship-form-layout", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/worship-form-layout = %d, want 200", res.StatusCode)
	}
	var layoutResp struct {
		Groupings []struct {
			ID        string `json:"id"`
			SortOrder int    `json:"sort_order"`
			Slots     []struct {
				ID        string `json:"id"`
				SortOrder int    `json:"sort_order"`
			} `json:"slots"`
		} `json:"groupings"`
	}
	_ = json.NewDecoder(res.Body).Decode(&layoutResp)
	res.Body.Close()

	if len(layoutResp.Groupings) < 2 {
		t.Fatalf("need at least 2 groupings for testing, got %d", len(layoutResp.Groupings))
	}

	// A. Negative tests for grouping reorder
	// 1. Empty payload -> 400
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", `[]`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("empty grouping reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 2. Partial payload (only 1 element when there are multiple) -> 400
	partialPayload := fmt.Sprintf(`[{"id":"%s","sort_order":1}]`, layoutResp.Groupings[0].ID)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", partialPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("partial grouping reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 3. Duplicate ID in payload -> 400
	dupIDPayload := fmt.Sprintf(`[{"id":"%s","sort_order":1},{"id":"%s","sort_order":2}]`, layoutResp.Groupings[0].ID, layoutResp.Groupings[0].ID)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", dupIDPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("duplicate ID grouping reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 4. Duplicate sort_order in payload -> 400
	dupOrderPayload := fmt.Sprintf(`[{"id":"%s","sort_order":1},{"id":"%s","sort_order":1}]`, layoutResp.Groupings[0].ID, layoutResp.Groupings[1].ID)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", dupOrderPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("duplicate order grouping reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 5. Non-positive sort_order -> 400
	nonPosPayload := fmt.Sprintf(`[{"id":"%s","sort_order":0},{"id":"%s","sort_order":1}]`, layoutResp.Groupings[0].ID, layoutResp.Groupings[1].ID)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", nonPosPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("non-positive order grouping reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 6. Unknown grouping ID -> 400
	unknownIDPayload := `[{"id":"non-existent-grouping","sort_order":1}]`
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", unknownIDPayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("unknown grouping ID reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// B. Positive full membership reordering
	// Reverse the entire order of groupings
	totalGroups := len(layoutResp.Groupings)
	var reversedGroups []map[string]any
	for i, g := range layoutResp.Groupings {
		reversedGroups = append(reversedGroups, map[string]any{
			"id":         g.ID,
			"sort_order": totalGroups - i,
		})
	}
	revBytes, _ := json.Marshal(reversedGroups)
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-groupings/reorder", string(revBytes), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("valid reverse grouping reorder = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Verify database has exact contiguous 1..N order
	rows, err := db.Query(`SELECT id, sort_order FROM form_groupings WHERE layout_id = 'default-layout' ORDER BY sort_order ASC`)
	if err != nil {
		t.Fatalf("query groupings: %v", err)
	}
	orderIdx := 1
	for rows.Next() {
		var gid string
		var so int
		if err := rows.Scan(&gid, &so); err != nil {
			t.Fatalf("scan grouping: %v", err)
		}
		if so != orderIdx {
			t.Fatalf("expected grouping sort_order %d, got %d for %s", orderIdx, so, gid)
		}
		orderIdx++
	}
	rows.Close()

	// C. Slot Reordering and Cross-Card Move
	// Find a grouping with at least 2 slots
	var groupWithSlots string
	var slot1 string
	for _, g := range layoutResp.Groupings {
		if len(g.Slots) >= 2 {
			groupWithSlots = g.ID
			slot1 = g.Slots[0].ID
			break
		}
	}
	if groupWithSlots == "" {
		t.Fatalf("need a grouping with >= 2 slots for slot tests")
	}

	// Slot reorder negative: partial payload -> 400
	res = songSetRequest(t, ts, "PUT", "/api/admin/form-grouping-slots/reorder", fmt.Sprintf(`{"grouping_id":"%s","slots":[{"id":"%s","sort_order":1}]}`, groupWithSlots, slot1), cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("partial slot reorder = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// Cross-card slot transfer:
	// Move slot1 to another grouping
	targetGroupID := ""
	for _, g := range layoutResp.Groupings {
		if g.ID != groupWithSlots {
			targetGroupID = g.ID
			break
		}
	}

	// 1. Move to self -> 400
	selfMovePayload := fmt.Sprintf(`{"target_grouping_id":"%s"}`, groupWithSlots)
	res = songSetRequest(t, ts, "POST", fmt.Sprintf("/api/admin/form-grouping-slots/%s/move-grouping", slot1), selfMovePayload, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("self move slot = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 2. Move non-existent slot -> 404
	res = songSetRequest(t, ts, "POST", "/api/admin/form-grouping-slots/non-existent-slot/move-grouping", fmt.Sprintf(`{"target_grouping_id":"%s"}`, targetGroupID), cookie)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("move non-existent slot = %d, want 404", res.StatusCode)
	}
	res.Body.Close()

	// 3. Valid move slot1 -> targetGroupID
	validMovePayload := fmt.Sprintf(`{"target_grouping_id":"%s"}`, targetGroupID)
	res = songSetRequest(t, ts, "POST", fmt.Sprintf("/api/admin/form-grouping-slots/%s/move-grouping", slot1), validMovePayload, cookie)
	if res.StatusCode != http.StatusOK {
		var errBody map[string]any
		_ = json.NewDecoder(res.Body).Decode(&errBody)
		t.Fatalf("valid move slot = %d, want 200, body=%v", res.StatusCode, errBody)
	}
	res.Body.Close()

	// Verify slot1 is now in targetGroupID
	var newGroupID string
	var newOrder int
	err = db.QueryRow(`SELECT grouping_id, sort_order FROM form_group_slots WHERE id = ?`, slot1).Scan(&newGroupID, &newOrder)
	if err != nil {
		t.Fatalf("query moved slot: %v", err)
	}
	if newGroupID != targetGroupID {
		t.Fatalf("moved slot grouping_id = %s, want %s", newGroupID, targetGroupID)
	}
	if newOrder <= 0 {
		t.Fatalf("moved slot sort_order must be > 0, got %d", newOrder)
	}

	// Verify remaining slots in source grouping are contiguous 1..(M-1)
	rows, err = db.Query(`SELECT id, sort_order FROM form_group_slots WHERE grouping_id = ? ORDER BY sort_order ASC`, groupWithSlots)
	if err != nil {
		t.Fatalf("query remaining source slots: %v", err)
	}
	sourceIdx := 1
	for rows.Next() {
		var sid string
		var so int
		if err := rows.Scan(&sid, &so); err != nil {
			t.Fatalf("scan remaining slot: %v", err)
		}
		if so != sourceIdx {
			t.Fatalf("expected remaining slot sort_order %d, got %d for %s", sourceIdx, so, sid)
		}
		sourceIdx++
	}
	rows.Close()
}
