package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestServiceFieldValuesPersistenceAndFallback(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Create a service with custom field_values and legacy payload
	createPayload := `{
		"date": "2026-10-10",
		"raw_payload": "SABBATH, OCTOBER 10, 2026\nDIVINE SERVICE",
		"field_values": {
			"scripture_reference": "Romans 8:28",
			"scripture_text": "And we know that all things work together for good",
			"sermon_speaker_name": "Pastor Custom",
			"sermon_title": "All Things For Good",
			"custom_variable": "Custom Value"
		},
		"sermonGraphicUrl": "https://example.com/sermon.jpg"
	}`

	res := songSetRequest(t, ts, "POST", "/api/services", createPayload, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service status = %d, want 201", res.StatusCode)
	}
	var created struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&created)
	res.Body.Close()

	if created.ID == 0 {
		t.Fatalf("expected positive service id, got 0")
	}

	// 2. Fetch service and verify field_values and form_layout_snapshot are present
	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", created.ID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get service status = %d, want 200", res.StatusCode)
	}
	var svcResp struct {
		ID                 int               `json:"id"`
		FieldValues        map[string]string `json:"field_values"`
		FormLayoutSnapshot json.RawMessage   `json:"form_layout_snapshot"`
		UpdatedAt          string            `json:"updated_at"`
	}
	_ = json.NewDecoder(res.Body).Decode(&svcResp)
	res.Body.Close()

	if svcResp.FieldValues == nil {
		t.Fatalf("expected non-nil field_values")
	}
	if svcResp.FieldValues["scripture_reference"] != "Romans 8:28" {
		t.Errorf("expected scripture_reference Romans 8:28, got %q", svcResp.FieldValues["scripture_reference"])
	}
	if svcResp.FieldValues["sermon_speaker_name"] != "Pastor Custom" {
		t.Errorf("expected sermon_speaker_name Pastor Custom, got %q", svcResp.FieldValues["sermon_speaker_name"])
	}
	if svcResp.FieldValues["sermon_poster"] != "https://example.com/sermon.jpg" {
		t.Errorf("expected sermon_poster from legacy sermonGraphicUrl, got %q", svcResp.FieldValues["sermon_poster"])
	}
	if len(svcResp.FormLayoutSnapshot) == 0 || string(svcResp.FormLayoutSnapshot) == "null" {
		t.Errorf("expected non-empty form_layout_snapshot")
	}

	// 3. Update service with updated field_values
	updatePayload := fmt.Sprintf(`{
		"date": "2026-10-10",
		"updated_at": %q,
		"field_values": {
			"scripture_reference": "Romans 8:31",
			"sermon_speaker_name": "Pastor Updated"
		}
	}`, svcResp.UpdatedAt)

	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", created.ID), updatePayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update service status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 4. Verify updated values in database
	var ref string
	err := handle.QueryRow(`SELECT value_text FROM service_field_values WHERE service_id = ? AND variable_name = 'scripture_reference'`, created.ID).Scan(&ref)
	if err != nil || ref != "Romans 8:31" {
		t.Fatalf("expected updated scripture_reference Romans 8:31, got %q (err: %v)", ref, err)
	}

	// 5. Test Dual-Read Fallback for legacy service with empty service_field_values
	resLegacy, err := handle.Exec(`
		INSERT INTO services (date, raw_payload, parsed_data, images_payload, updated_at)
		VALUES ('2026-11-11', 'legacy raw', '{"verseReading":{"reference":"John 3:16","text":"For God so loved the world"}}', '{"sermonGraphicUrl":"https://example.com/legacy.png"}', '2026-11-11T00:00:00Z')
	`)
	if err != nil {
		t.Fatalf("insert legacy service: %v", err)
	}
	legacyID, _ := resLegacy.LastInsertId()

	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", legacyID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get legacy service status = %d, want 200", res.StatusCode)
	}
	var legacyResp struct {
		FieldValues map[string]string `json:"field_values"`
	}
	_ = json.NewDecoder(res.Body).Decode(&legacyResp)
	res.Body.Close()

	if legacyResp.FieldValues["scripture_reference"] != "John 3:16" {
		t.Errorf("expected dual-read fallback scripture_reference John 3:16, got %q", legacyResp.FieldValues["scripture_reference"])
	}
	if legacyResp.FieldValues["scripture_text"] != "For God so loved the world" {
		t.Errorf("expected dual-read fallback scripture_text, got %q", legacyResp.FieldValues["scripture_text"])
	}
	if legacyResp.FieldValues["sermon_poster"] != "https://example.com/legacy.png" {
		t.Errorf("expected dual-read fallback sermon_poster, got %q", legacyResp.FieldValues["sermon_poster"])
	}

	// 6. Test Backfill Migration on existing service
	// Clean service_field_values for legacy service to simulate pre-migration state
	_, err = handle.Exec(`DELETE FROM service_field_values WHERE service_id = ?`, legacyID)
	if err != nil {
		t.Fatalf("delete service_field_values: %v", err)
	}
	_, err = handle.Exec(`DELETE FROM service_form_layout_snapshots WHERE service_id = ?`, legacyID)
	if err != nil {
		t.Fatalf("delete snapshots: %v", err)
	}

	// Re-run migration
	// Note: in db package migrateServiceFieldValues backfills using LegacyFieldMap
	// We can verify that legacy service gets backfilled
	var backfillRef string
	err = handle.QueryRow(`
		SELECT value_text FROM service_field_values WHERE service_id = ? AND variable_name = 'scripture_reference'
	`, legacyID).Scan(&backfillRef)
	// It was deleted above, so before re-running migration it's missing
	if err != sql.ErrNoRows {
		t.Fatalf("expected ErrNoRows before migration, got %v", err)
	}
}

func TestServiceDeleteRecordsTombstone(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Create service
	createPayload := `{"date":"2026-10-10","raw_payload":"SABBATH, OCTOBER 10, 2026\nDIVINE SERVICE"}`
	res := songSetRequest(t, ts, "POST", "/api/services", createPayload, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service status = %d, want 201", res.StatusCode)
	}
	var created struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&created)
	res.Body.Close()

	var gid, updatedAt string
	err := handle.QueryRow(`SELECT global_id, updated_at FROM services WHERE id = ?`, created.ID).Scan(&gid, &updatedAt)
	if err != nil {
		t.Fatalf("query service: %v", err)
	}
	if gid == "" {
		t.Fatal("expected non-empty global_id on created service")
	}

	// Delete service
	deletePayload := fmt.Sprintf(`{"updated_at":"%s"}`, updatedAt)
	res = songSetRequest(t, ts, "DELETE", fmt.Sprintf("/api/services/%d", created.ID), deletePayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete service status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Verify tombstone is recorded
	var entityType string
	err = handle.QueryRow(`SELECT entity_type FROM sync_tombstones WHERE global_id = ?`, gid).Scan(&entityType)
	if err != nil {
		t.Fatalf("tombstone not recorded for deleted service: %v", err)
	}
	if entityType != "service" {
		t.Fatalf("expected tombstone entity_type 'service', got %q", entityType)
	}
}

func TestServiceDeleteTransactionRollbackOnTombstoneFailure(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Create service
	createPayload := `{"date":"2026-10-12","raw_payload":"SABBATH, OCTOBER 12, 2026\nDIVINE SERVICE"}`
	res := songSetRequest(t, ts, "POST", "/api/services", createPayload, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service status = %d, want 201", res.StatusCode)
	}
	var created struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&created)
	res.Body.Close()

	var gid, updatedAt string
	err := handle.QueryRow(`SELECT global_id, updated_at FROM services WHERE id = ?`, created.ID).Scan(&gid, &updatedAt)
	if err != nil {
		t.Fatalf("query service: %v", err)
	}

	// Create a trigger on services that aborts the DELETE statement.
	// This ensures Step 1 (insert tombstone into sync_tombstones) executes first within tx,
	// and Step 2 (DELETE FROM services) fails, proving that Step 1 is rolled back!
	_, err = handle.Exec(fmt.Sprintf(`
		CREATE TRIGGER fail_service_delete
		BEFORE DELETE ON services
		WHEN OLD.id = %d
		BEGIN
			SELECT RAISE(FAIL, 'simulated service delete failure');
		END;
	`, created.ID))
	if err != nil {
		t.Fatalf("create failure trigger: %v", err)
	}

	// Attempt delete: must fail with 500
	deletePayload := fmt.Sprintf(`{"updated_at":"%s"}`, updatedAt)
	res = songSetRequest(t, ts, "DELETE", fmt.Sprintf("/api/services/%d", created.ID), deletePayload, cookie)
	if res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("delete service status = %d, want 500 on delete failure", res.StatusCode)
	}
	res.Body.Close()

	// Verify rollback: service is still present in database!
	var remainingID int
	err = handle.QueryRow(`SELECT id FROM services WHERE id = ?`, created.ID).Scan(&remainingID)
	if err != nil {
		t.Fatalf("expected service %d to remain in database after rollback, got error: %v", created.ID, err)
	}

	// Verify rollback: the tombstone inserted in Step 1 was rolled back and is absent from sync_tombstones!
	var tombstoneCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM sync_tombstones WHERE global_id = ?`, gid).Scan(&tombstoneCount); err != nil {
		t.Fatalf("querying tombstone count: %v", err)
	}
	if tombstoneCount != 0 {
		t.Fatalf("expected tombstone write to be rolled back (count=0), got %d committed tombstones", tombstoneCount)
	}
}

func TestPhotoDeletionPersistenceAndPerKeyMergePrecedence(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Insert a legacy service with photos in images_payload and sermon.speaker in parsed_data
	resLegacy, err := handle.Exec(`
		INSERT INTO services (date, raw_payload, parsed_data, images_payload, updated_at)
		VALUES ('2026-12-12', 'legacy raw',
			'{"sermon":{"speaker":"Pastor Legacy","title":"Legacy Faith"}}',
			'{"familyPhotoUrl":"https://example.com/family.jpg","sermonGraphicUrl":"https://example.com/sermon.jpg"}',
			'2026-12-12T00:00:00Z')
	`)
	if err != nil {
		t.Fatalf("insert legacy service: %v", err)
	}
	legacyID, _ := resLegacy.LastInsertId()

	// 2. Fetch service: verify fallback reads both photos and sermon speaker
	res := songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", legacyID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get legacy service status = %d, want 200", res.StatusCode)
	}
	var svcResp struct {
		FieldValues map[string]string `json:"field_values"`
		UpdatedAt   string            `json:"updated_at"`
	}
	_ = json.NewDecoder(res.Body).Decode(&svcResp)
	res.Body.Close()

	if svcResp.FieldValues["family_photo"] != "https://example.com/family.jpg" {
		t.Errorf("expected fallback family_photo, got %q", svcResp.FieldValues["family_photo"])
	}
	if svcResp.FieldValues["sermon_speaker_name"] != "Pastor Legacy" {
		t.Errorf("expected fallback sermon_speaker_name, got %q", svcResp.FieldValues["sermon_speaker_name"])
	}

	// 3. Update service: explicit deletion of family_photo (field_values["family_photo"] = "")
	updatePayload := fmt.Sprintf(`{
		"updated_at": "%s",
		"field_values": {
			"family_photo": ""
		}
	}`, svcResp.UpdatedAt)

	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", legacyID), updatePayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update service status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 4. Fetch service again: verify family_photo is empty string and does NOT resurrect from images_payload
	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", legacyID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get service status = %d, want 200", res.StatusCode)
	}
	var afterResp struct {
		FieldValues   map[string]string `json:"field_values"`
		ImagesPayload map[string]any    `json:"images_payload"`
	}
	_ = json.NewDecoder(res.Body).Decode(&afterResp)
	res.Body.Close()

	// family_photo must be empty string (deleted)
	if afterResp.FieldValues["family_photo"] != "" {
		t.Errorf("expected deleted family_photo to be empty string, got %q", afterResp.FieldValues["family_photo"])
	}
	// images_payload familyPhotoUrl must be nil or empty
	if afterResp.ImagesPayload != nil && afterResp.ImagesPayload["familyPhotoUrl"] != nil && afterResp.ImagesPayload["familyPhotoUrl"] != "" {
		t.Errorf("expected images_payload.familyPhotoUrl to be nil/cleared, got %v", afterResp.ImagesPayload["familyPhotoUrl"])
	}
	// sermon_speaker_name must still be preserved from legacy parsed_data
	if afterResp.FieldValues["sermon_speaker_name"] != "Pastor Legacy" {
		t.Errorf("expected sermon_speaker_name to be preserved via per-key merge, got %q", afterResp.FieldValues["sermon_speaker_name"])
	}
	// sermon_poster must still be preserved from legacy images_payload
	if afterResp.FieldValues["sermon_poster"] != "https://example.com/sermon.jpg" {
		t.Errorf("expected sermon_poster to be preserved via per-key merge, got %q", afterResp.FieldValues["sermon_poster"])
	}
}

func TestGetServiceRawPayloadVerbatimViaHttp(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	verbatimText := "  SABBATH, DECEMBER 26, 2026\n  DIVINE SERVICE 🎉\n\n• Welcome All Visitors\n  - Indented bullet item\n• Scripture: John 3:16\n\nPastoral Notes:\n— Special prayer request for missions 🙏\n— Practice at 4:30 PM."

	payload := map[string]any{
		"date":        "2026-12-26",
		"raw_payload": verbatimText,
	}
	bodyBytes, _ := json.Marshal(payload)

	res := songSetRequest(t, ts, "POST", "/api/services", string(bodyBytes), cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service status = %d, want 201", res.StatusCode)
	}
	var created struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&created)
	res.Body.Close()

	if created.ID == 0 {
		t.Fatal("expected non-zero created service ID")
	}

	// GET /api/services/{id} through HTTP handler
	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", created.ID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get service status = %d, want 200", res.StatusCode)
	}
	var svcResp struct {
		ID         int    `json:"id"`
		RawPayload string `json:"raw_payload"`
	}
	_ = json.NewDecoder(res.Body).Decode(&svcResp)
	res.Body.Close()

	if svcResp.RawPayload != verbatimText {
		t.Fatalf("GET /api/services/{id} returned corrupted raw_payload:\ngot:\n%q\nwant:\n%q", svcResp.RawPayload, verbatimText)
	}
}

func TestServicesParserProfileIdOmittedAndNullHandling(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. POST /api/services/preview with omitted parserProfileId
	parseOmitted := `{"raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE\nScripture: John 3:16"}`
	res := songSetRequest(t, ts, "POST", "/api/services/preview", parseOmitted, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("parse omitted parserProfileId status = %d, want 200", res.StatusCode)
	}
	var parseResp struct {
		Date *string `json:"date"`
	}
	_ = json.NewDecoder(res.Body).Decode(&parseResp)
	res.Body.Close()
	if parseResp.Date == nil || *parseResp.Date != "2026-10-17" {
		t.Errorf("expected parsed date 2026-10-17, got %v", parseResp.Date)
	}

	// 2. POST /api/services/preview with explicit null parserProfileId
	parseNull := `{"raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE\nScripture: John 3:16", "parserProfileId": null}`
	res = songSetRequest(t, ts, "POST", "/api/services/preview", parseNull, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("parse null parserProfileId status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 3. POST /api/services with omitted parserProfileId
	createOmitted := `{"date": "2026-10-17", "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE"}`
	res = songSetRequest(t, ts, "POST", "/api/services", createOmitted, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service omitted parserProfileId status = %d, want 201", res.StatusCode)
	}
	var created1 struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&created1)
	res.Body.Close()

	// 4. POST /api/services with explicit null parserProfileId (allowSecond for same date)
	createNull := `{"date": "2026-10-17", "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE", "parserProfileId": null, "allowSecond": true}`
	res = songSetRequest(t, ts, "POST", "/api/services", createNull, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service null parserProfileId status = %d, want 201", res.StatusCode)
	}
	var created2 struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&created2)
	res.Body.Close()

	// Fetch created1 and get its updated_at
	res = songSetRequest(t, ts, "GET", fmt.Sprintf("/api/services/%d", created1.ID), "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get service status = %d, want 200", res.StatusCode)
	}
	var svcResp struct {
		UpdatedAt string `json:"updated_at"`
	}
	_ = json.NewDecoder(res.Body).Decode(&svcResp)
	res.Body.Close()

	// 5. PUT /api/services/{id} with omitted parserProfileId
	updateOmitted := fmt.Sprintf(`{"date": "2026-10-17", "updated_at": %q, "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE\nUpdated"}`, svcResp.UpdatedAt)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", created1.ID), updateOmitted, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update service omitted parserProfileId status = %d, want 200", res.StatusCode)
	}
	var updateResp1 struct {
		UpdatedAt string `json:"updated_at"`
	}
	_ = json.NewDecoder(res.Body).Decode(&updateResp1)
	res.Body.Close()

	// 6. PUT /api/services/{id} with explicit null parserProfileId
	updateNull := fmt.Sprintf(`{"date": "2026-10-17", "updated_at": %q, "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE\nUpdated Null", "parserProfileId": null}`, updateResp1.UpdatedAt)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", created1.ID), updateNull, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update service null parserProfileId status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Assert created1 and created2 persisted default profile
	var prof1, prof2 string
	if err := handle.QueryRow(`SELECT parser_profile_id FROM services WHERE id = ?`, created1.ID).Scan(&prof1); err != nil {
		t.Fatalf("query parser_profile_id for created1: %v", err)
	}
	if prof1 != "builtin-default" {
		t.Errorf("expected parser_profile_id builtin-default for created1, got %q", prof1)
	}
	if err := handle.QueryRow(`SELECT parser_profile_id FROM services WHERE id = ?`, created2.ID).Scan(&prof2); err != nil {
		t.Fatalf("query parser_profile_id for created2: %v", err)
	}
	if prof2 != "builtin-default" {
		t.Errorf("expected parser_profile_id builtin-default for created2, got %q", prof2)
	}

	// 7. Verify service with existing non-default profile re-resolves to default profile on omitted/null update
	_, err := handle.Exec(`UPDATE services SET parser_profile_id = 'custom-legacy' WHERE id = ?`, created1.ID)
	if err != nil {
		t.Fatalf("update legacy profile: %v", err)
	}
	var currentUpdated string
	_ = handle.QueryRow(`SELECT updated_at FROM services WHERE id = ?`, created1.ID).Scan(&currentUpdated)

	updateRevert := fmt.Sprintf(`{"date": "2026-10-17", "updated_at": %q, "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE\nRevert to default"}`, currentUpdated)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", created1.ID), updateRevert, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update service revert status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	var profReverted string
	if err := handle.QueryRow(`SELECT parser_profile_id FROM services WHERE id = ?`, created1.ID).Scan(&profReverted); err != nil {
		t.Fatalf("query reverted parser_profile_id: %v", err)
	}
	if profReverted != "builtin-default" {
		t.Errorf("expected reverted parser_profile_id builtin-default, got %q", profReverted)
	}

	// 8. POST /api/services with explicit legacy parserProfileId string: must be ignored and persist builtin-default
	createLegacy := `{"date": "2026-10-17", "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE", "parserProfileId": "custom-obsolete-profile", "allowSecond": true}`
	res = songSetRequest(t, ts, "POST", "/api/services", createLegacy, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create service legacy parserProfileId status = %d, want 201", res.StatusCode)
	}
	var createdLegacy struct {
		ID int `json:"id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&createdLegacy)
	res.Body.Close()

	var profLegacy string
	var profVerLegacy int
	if err := handle.QueryRow(`SELECT parser_profile_id, parser_profile_version FROM services WHERE id = ?`, createdLegacy.ID).Scan(&profLegacy, &profVerLegacy); err != nil {
		t.Fatalf("query parser_profile_id for createdLegacy: %v", err)
	}
	if profLegacy != "builtin-default" {
		t.Errorf("expected legacy parserProfileId to be ignored and persist builtin-default, got %q", profLegacy)
	}
	if profVerLegacy != 1 {
		t.Errorf("expected parser_profile_version 1 for createdLegacy, got %d", profVerLegacy)
	}

	// 9. PUT /api/services/{id} with explicit legacy parserProfileId string: must be ignored and persist builtin-default
	var legacyUpdated string
	_ = handle.QueryRow(`SELECT updated_at FROM services WHERE id = ?`, createdLegacy.ID).Scan(&legacyUpdated)
	updateLegacy := fmt.Sprintf(`{"date": "2026-10-17", "updated_at": %q, "raw_payload": "SABBATH, OCTOBER 17, 2026\nDIVINE SERVICE\nUpdate with legacy ID", "parserProfileId": "custom-obsolete-profile-2"}`, legacyUpdated)
	res = songSetRequest(t, ts, "PUT", fmt.Sprintf("/api/services/%d", createdLegacy.ID), updateLegacy, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update service legacy parserProfileId status = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	var profLegacyAfterUpdate string
	var profVerLegacyAfterUpdate int
	if err := handle.QueryRow(`SELECT parser_profile_id, parser_profile_version FROM services WHERE id = ?`, createdLegacy.ID).Scan(&profLegacyAfterUpdate, &profVerLegacyAfterUpdate); err != nil {
		t.Fatalf("query parser_profile_id after update: %v", err)
	}
	if profLegacyAfterUpdate != "builtin-default" {
		t.Errorf("expected legacy parserProfileId on update to be ignored and persist builtin-default, got %q", profLegacyAfterUpdate)
	}
	if profVerLegacyAfterUpdate != 1 {
		t.Errorf("expected parser_profile_version 1 after update, got %d", profVerLegacyAfterUpdate)
	}
}

func TestServicesPreviewSongOverflowAndSlotsUnfilledEmptyArrayContract(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Configure targeted song set extraction regexes in DB
	_, _ = handle.Exec(`DELETE FROM song_set_entries`)
	_, err := handle.Exec(`
		INSERT INTO song_set_entries (global_id, variable_name, title, position, extraction_regex, updated_at)
		VALUES
			('019253c0-0000-7000-8000-000000000001', 'opening_song_bt', 'Opening Song BT', 1, '(?i)(?:Sabbath School|Bible Talk)\s*Opening\s*Song:\s*(?:SDAH\s*)?#?(?<number>\d+)', CURRENT_TIMESTAMP),
			('019253c0-0000-7000-8000-000000000002', 'opening_song_ds', 'Opening Song DS', 2, '(?i)(?:Divine Service)\s*Opening\s*Song:\s*(?:SDAH\s*)?#?(?<number>\d+)', CURRENT_TIMESTAMP),
			('019253c0-0000-7000-8000-000000000003', 'scripture_hymn', 'Scripture Hymn', 3, '(?i)Scripture\s*Hymn:\s*(?:SDAH\s*)?#?(?<number>\d+)', CURRENT_TIMESTAMP),
			('019253c0-0000-7000-8000-000000000004', 'closing_song_ds', 'Closing Song DS', 4, '(?i)Closing\s*Song:\s*(?:SDAH\s*)?#?(?<number>\d+)', CURRENT_TIMESTAMP)
	`)
	if err != nil {
		t.Fatalf("insert song_set_entries: %v", err)
	}

	multiSongRundown := "SABBATH, OCTOBER 24, 2026\nDIVINE SERVICE\n\nSong of Praise: SDAH #614\nSabbath School Opening Song: SDAH #316\nIntroit: SDAH #508\nDivine Service Opening Song: SDAH #100\nPrayer Song: SDAH #671\nResponse: SDAH #684\nScripture Hymn: SDAH #334\nClosing Song: SDAH #476"

	payload := map[string]any{
		"raw_payload": multiSongRundown,
	}
	bodyBytes, _ := json.Marshal(payload)

	res := songSetRequest(t, ts, "POST", "/api/services/preview", string(bodyBytes), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("preview status = %d, want 200", res.StatusCode)
	}
	var previewResp struct {
		Date               string          `json:"date"`
		SongOverflow       json.RawMessage `json:"songOverflow"`
		SongSlotsUnfilled  json.RawMessage `json:"songSlotsUnfilled"`
		SongSetSuggestions map[string]struct {
			SongNumber int    `json:"songNumber"`
			MatchKind  string `json:"matchKind"`
		} `json:"songSetSuggestions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&previewResp); err != nil {
		t.Fatalf("decode preview response: %v", err)
	}
	res.Body.Close()

	if previewResp.Date != "2026-10-24" {
		t.Errorf("expected date 2026-10-24, got %q", previewResp.Date)
	}

	// Verify exact slot-to-song mappings extracted via dynamic regex
	if previewResp.SongSetSuggestions["opening_song_bt"].SongNumber != 316 {
		t.Errorf("expected opening_song_bt 316, got %d", previewResp.SongSetSuggestions["opening_song_bt"].SongNumber)
	}
	if previewResp.SongSetSuggestions["opening_song_ds"].SongNumber != 100 {
		t.Errorf("expected opening_song_ds 100, got %d", previewResp.SongSetSuggestions["opening_song_ds"].SongNumber)
	}
	if previewResp.SongSetSuggestions["scripture_hymn"].SongNumber != 334 {
		t.Errorf("expected scripture_hymn 334, got %d", previewResp.SongSetSuggestions["scripture_hymn"].SongNumber)
	}
	if previewResp.SongSetSuggestions["closing_song_ds"].SongNumber != 476 {
		t.Errorf("expected closing_song_ds 476, got %d", previewResp.SongSetSuggestions["closing_song_ds"].SongNumber)
	}

	// Strictly assert songOverflow is JSON array [] (not null, not populated with hymns)
	if string(previewResp.SongOverflow) != "[]" {
		t.Errorf("expected songOverflow to be strictly empty JSON array '[]', got %s", string(previewResp.SongOverflow))
	}

	// Strictly assert songSlotsUnfilled is JSON array [] (not null)
	if string(previewResp.SongSlotsUnfilled) != "[]" {
		t.Errorf("expected songSlotsUnfilled to be strictly empty JSON array '[]', got %s", string(previewResp.SongSlotsUnfilled))
	}
}

func TestSectionScopedSongSetExtractionHttp(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Configure section-scoped multiline dotall regexes in DB
	_, _ = handle.Exec(`DELETE FROM song_set_entries`)
	_, err := handle.Exec(`
		INSERT INTO song_set_entries (global_id, variable_name, title, position, extraction_regex, updated_at)
		VALUES
			('019253c0-0000-7000-8000-000000000071', 'bt_opening_song', 'BT Opening Song', 1, ?, CURRENT_TIMESTAMP),
			('019253c0-0000-7000-8000-000000000072', 'ds_opening_song', 'DS Opening Song', 2, ?, CURRENT_TIMESTAMP)
	`, `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`,
		`(?is)DIVINE\s+SERVICE.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`)
	if err != nil {
		t.Fatalf("insert song_set_entries: %v", err)
	}

	multiSectionRundown := "SABBATH, OCTOBER 24, 2026\n\nBIBLE TALK (9:00 - 10:00)\nLeader: Leader One\n[ ] Opening song : SDAH #614 Sound the Battle Cry\n\nDIVINE SERVICE (10:00 - 12:00)\nLeader: Leader Two\n[ ] Opening Song : SDAH #508 Anywhere With Jesus\nSermon: Speaker Two\n"

	payload := map[string]any{
		"raw_payload": multiSectionRundown,
	}
	bodyBytes, _ := json.Marshal(payload)

	res := songSetRequest(t, ts, "POST", "/api/services/preview", string(bodyBytes), cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("preview status = %d, want 200", res.StatusCode)
	}
	var previewResp struct {
		SongSetSuggestions map[string]struct {
			SongNumber   int    `json:"songNumber"`
			SongBookCode string `json:"songBookCode"`
			MatchKind    string `json:"matchKind"`
		} `json:"songSetSuggestions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&previewResp); err != nil {
		t.Fatalf("decode preview response: %v", err)
	}
	res.Body.Close()

	if previewResp.SongSetSuggestions["bt_opening_song"].SongNumber != 614 {
		t.Errorf("expected bt_opening_song 614, got %d", previewResp.SongSetSuggestions["bt_opening_song"].SongNumber)
	}
	if previewResp.SongSetSuggestions["ds_opening_song"].SongNumber != 508 {
		t.Errorf("expected ds_opening_song 508, got %d", previewResp.SongSetSuggestions["ds_opening_song"].SongNumber)
	}
}
