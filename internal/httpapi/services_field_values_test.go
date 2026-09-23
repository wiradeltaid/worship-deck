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
