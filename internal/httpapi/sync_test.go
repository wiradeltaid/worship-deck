package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

func TestSync_Unauthenticated(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)

	// 1. GET /api/sync/status unauthenticated -> 401
	res := songSetRequest(t, ts, "GET", "/api/sync/status", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth GET /api/sync/status = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 2. POST /api/sync/push unauthenticated -> 401
	res = songSetRequest(t, ts, "POST", "/api/sync/push", `{"mutation_id":"m1"}`, nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth POST /api/sync/push = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 3. GET /api/sync/pull unauthenticated -> 401
	res = songSetRequest(t, ts, "GET", "/api/sync/pull", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth GET /api/sync/pull = %d, want 401", res.StatusCode)
	}
	res.Body.Close()
}

func TestSync_PushPullIdempotencyAndTombstones(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	serviceGid := db.NewUUIDv7()
	hymnGid := db.NewUUIDv7()
	songSetGid := db.NewUUIDv7()
	annGid := db.NewUUIDv7()
	mutationID := db.NewUUIDv7()

	nowStr := time.Now().UTC().Format(time.RFC3339Nano)

	// 1. Push batch with service, hymn, song set entry, and announcement item
	pushPayload := fmt.Sprintf(`{
		"client_device_id": "laptop-desktop-01",
		"mutation_id": "%s",
		"base_rev": 1,
		"mutations": {
			"services": [
				{
					"global_id": "%s",
					"date": "2026-10-24",
					"raw_payload": "SABBATH, OCTOBER 24, 2026\nDIVINE SERVICE",
					"created_at": "%s",
					"updated_at": "%s"
				}
			],
			"hymns": [
				{
					"global_id": "%s",
					"book_code": "SDAH",
					"number": 990,
					"title": "Sync Anthem",
					"lyrics": "Lyrics for sync test"
				}
			],
			"song_set_entries": [
				{
					"global_id": "%s",
					"variable_name": "closing_hymn_sync",
					"title": "Closing Hymn Sync",
					"position": 5,
					"updated_at": "%s"
				}
			],
			"announcement_items": [
				{
					"global_id": "%s",
					"image_url": "https://example.com/sync-flyer.jpg",
					"sort_order": 1
				}
			]
		},
		"tombstones": []
	}`, mutationID, serviceGid, nowStr, nowStr, hymnGid, songSetGid, nowStr, annGid)

	res := songSetRequest(t, ts, "POST", "/api/sync/push", pushPayload, cookie)
	if res.StatusCode != http.StatusOK {
		var errBody map[string]any
		_ = json.NewDecoder(res.Body).Decode(&errBody)
		t.Fatalf("POST /api/sync/push = %d, want 200, body=%v", res.StatusCode, errBody)
	}
	var pushResp struct {
		OK           bool   `json:"ok"`
		AppliedCount int    `json:"applied_count"`
		MutationID   string `json:"mutation_id"`
	}
	_ = json.NewDecoder(res.Body).Decode(&pushResp)
	res.Body.Close()

	if !pushResp.OK || pushResp.AppliedCount != 4 {
		t.Fatalf("unexpected push response: %+v", pushResp)
	}

	// 2. Test Idempotency: re-sending identical mutation_id succeeds with already_applied: true
	res = songSetRequest(t, ts, "POST", "/api/sync/push", pushPayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("re-send push status = %d, want 200", res.StatusCode)
	}
	var idempResp struct {
		OK             bool `json:"ok"`
		AlreadyApplied bool `json:"already_applied"`
	}
	_ = json.NewDecoder(res.Body).Decode(&idempResp)
	res.Body.Close()

	if !idempResp.OK || !idempResp.AlreadyApplied {
		t.Fatalf("expected already_applied = true, got %+v", idempResp)
	}

	// 3. Test GET /api/sync/status reports device_id and last_synced_at
	res = songSetRequest(t, ts, "GET", "/api/sync/status", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/sync/status = %d, want 200", res.StatusCode)
	}
	var statusResp struct {
		DeviceID     string `json:"device_id"`
		LastSyncedAt string `json:"last_synced_at"`
	}
	_ = json.NewDecoder(res.Body).Decode(&statusResp)
	res.Body.Close()
	if statusResp.DeviceID != "laptop-desktop-01" || statusResp.LastSyncedAt == "" {
		t.Fatalf("unexpected sync status: %+v", statusResp)
	}

	// 4. Pull changes and verify entities present (including announcement_items)
	res = songSetRequest(t, ts, "GET", "/api/sync/pull", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/sync/pull = %d, want 200", res.StatusCode)
	}
	var pullResp struct {
		Changes struct {
			Services []struct {
				GlobalID string `json:"global_id"`
				Date     string `json:"date"`
			} `json:"services"`
			Hymns []struct {
				GlobalID string `json:"global_id"`
				Number   int    `json:"number"`
			} `json:"hymns"`
			AnnouncementItems []struct {
				GlobalID string `json:"global_id"`
				ImageURL string `json:"image_url"`
			} `json:"announcement_items"`
		} `json:"changes"`
		Tombstones []struct {
			GlobalID string `json:"global_id"`
		} `json:"tombstones"`
	}
	_ = json.NewDecoder(res.Body).Decode(&pullResp)
	res.Body.Close()

	foundSvc := false
	for _, s := range pullResp.Changes.Services {
		if s.GlobalID == serviceGid {
			foundSvc = true
			break
		}
	}
	if !foundSvc {
		t.Fatalf("service %s not returned in sync pull", serviceGid)
	}

	foundAnn := false
	for _, a := range pullResp.Changes.AnnouncementItems {
		if a.GlobalID == annGid {
			foundAnn = true
			break
		}
	}
	if !foundAnn {
		t.Fatalf("announcement item %s not returned in sync pull", annGid)
	}

	// 5. Push tombstone deletion
	deleteMutationID := db.NewUUIDv7()
	tombstonePayload := fmt.Sprintf(`{
		"client_device_id": "laptop-desktop-01",
		"mutation_id": "%s",
		"base_rev": 2,
		"mutations": {},
		"tombstones": [
			{
				"global_id": "%s",
				"entity_type": "service",
				"deleted_at": "%s"
			}
		]
	}`, deleteMutationID, serviceGid, nowStr)

	res = songSetRequest(t, ts, "POST", "/api/sync/push", tombstonePayload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("push tombstone = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Verify service is deleted from DB
	var remainingID int
	err := handle.QueryRow(`SELECT id FROM services WHERE global_id = ?`, serviceGid).Scan(&remainingID)
	if err == nil {
		t.Fatalf("expected service %s to be deleted by tombstone sync", serviceGid)
	}
}

func TestSync_ConcurrentSameMutationID(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	mutationID := db.NewUUIDv7()
	serviceGid := db.NewUUIDv7()
	nowStr := time.Now().UTC().Format(time.RFC3339Nano)

	pushPayload := fmt.Sprintf(`{
		"client_device_id": "concurrent-client",
		"mutation_id": "%s",
		"mutations": {
			"services": [
				{
					"global_id": "%s",
					"date": "2026-10-31",
					"raw_payload": "SABBATH CONCURRENT",
					"updated_at": "%s"
				}
			]
		}
	}`, mutationID, serviceGid, nowStr)

	type responseInfo struct {
		StatusCode     int
		OK             bool
		AlreadyApplied bool
		AppliedCount   int
	}

	const concurrency = 5
	var wg sync.WaitGroup
	results := make([]responseInfo, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			res := songSetRequest(t, ts, "POST", "/api/sync/push", pushPayload, cookie)
			var body struct {
				OK             bool `json:"ok"`
				AlreadyApplied bool `json:"already_applied"`
				AppliedCount   int  `json:"applied_count"`
			}
			_ = json.NewDecoder(res.Body).Decode(&body)
			results[idx] = responseInfo{
				StatusCode:     res.StatusCode,
				OK:             body.OK,
				AlreadyApplied: body.AlreadyApplied,
				AppliedCount:   body.AppliedCount,
			}
			res.Body.Close()
		}(i)
	}
	wg.Wait()

	appliedCountTotal := 0
	alreadyAppliedCount := 0

	for idx, r := range results {
		if r.StatusCode != http.StatusOK {
			t.Fatalf("concurrent request %d failed with status %d", idx, r.StatusCode)
		}
		if !r.OK {
			t.Fatalf("concurrent request %d returned ok=false", idx)
		}
		if r.AlreadyApplied {
			alreadyAppliedCount++
		} else {
			appliedCountTotal++
		}
	}

	// Invariant: Exactly 1 request applies the mutation, exactly 4 are idempotent replays!
	if appliedCountTotal != 1 {
		t.Fatalf("expected exactly 1 applied request, got %d", appliedCountTotal)
	}
	if alreadyAppliedCount != concurrency-1 {
		t.Fatalf("expected exactly %d already_applied replays, got %d", concurrency-1, alreadyAppliedCount)
	}

	// Verify persistence: exactly 1 service record exists
	var svcCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM services WHERE global_id = ?`, serviceGid).Scan(&svcCount); err != nil || svcCount != 1 {
		t.Fatalf("expected exactly 1 service record persisted, got %d (err: %v)", svcCount, err)
	}

	// Verify persistence: exactly 1 mutation marker exists in sync_state
	var mutCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM sync_state WHERE key = ?`, fmt.Sprintf("mutation:concurrent-client:%s", mutationID)).Scan(&mutCount); err != nil || mutCount != 1 {
		t.Fatalf("expected exactly 1 mutation marker in sync_state, got %d (err: %v)", mutCount, err)
	}
}

func TestSync_PresenterLivenessGuard(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Simulate active presenter session
	SetActivePresenterForTest(true)
	defer SetActivePresenterForTest(false)

	payload := `{"client_device_id":"client1","mutation_id":"m-guard-1","mutations":{}}`
	res := songSetRequest(t, ts, "POST", "/api/sync/push", payload, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when presenter is active, got %d", res.StatusCode)
	}
	var errBody map[string]any
	_ = json.NewDecoder(res.Body).Decode(&errBody)
	res.Body.Close()

	if errBody["error"] != "presenter_active" {
		t.Fatalf("expected error 'presenter_active', got %v", errBody)
	}

	// Release presenter active simulation
	SetActivePresenterForTest(false)
	res = songSetRequest(t, ts, "POST", "/api/sync/push", payload, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 after presenter finished, got %d", res.StatusCode)
	}
	res.Body.Close()
}

func TestSync_OptimisticServiceConflict(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	serviceGid := db.NewUUIDv7()

	// Create service directly on server with current timestamp
	serverUpdated := "2026-10-15T12:00:00.000Z"
	_, err := handle.Exec(`
		INSERT INTO services (global_id, date, raw_payload, created_at, updated_at)
		VALUES (?, '2026-10-15', 'Rundown Server', ?, ?)
	`, serviceGid, serverUpdated, serverUpdated)
	if err != nil {
		t.Fatal(err)
	}

	// Incoming push has an older timestamp (11:00 vs 12:00)
	olderIncomingUpdated := "2026-10-15T11:00:00.000Z"
	pushPayload := fmt.Sprintf(`{
		"client_device_id": "client-offline",
		"mutation_id": "%s",
		"mutations": {
			"services": [
				{
					"global_id": "%s",
					"date": "2026-10-15",
					"raw_payload": "Rundown Stale",
					"updated_at": "%s"
				}
			]
		}
	}`, db.NewUUIDv7(), serviceGid, olderIncomingUpdated)

	res := songSetRequest(t, ts, "POST", "/api/sync/push", pushPayload, cookie)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict on stale service edit, got %d", res.StatusCode)
	}
	var conflictBody map[string]any
	_ = json.NewDecoder(res.Body).Decode(&conflictBody)
	res.Body.Close()

	if conflictBody["error"] != "service_conflict" {
		t.Fatalf("expected error 'service_conflict', got %v", conflictBody)
	}
}

func TestSync_TombstoneFailureRollback(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	serviceGid := db.NewUUIDv7()

	// Create service
	_, err := handle.Exec(`INSERT INTO services (global_id, date, raw_payload) VALUES (?, '2026-10-20', 'Rundown')`, serviceGid)
	if err != nil {
		t.Fatal(err)
	}

	// Install failure trigger on services DELETE to trigger error during tombstone delete processing
	_, err = handle.Exec(`
		CREATE TRIGGER fail_sync_svc_delete
		BEFORE DELETE ON services
		WHEN OLD.global_id = '` + serviceGid + `'
		BEGIN
			SELECT RAISE(FAIL, 'simulated sync delete failure');
		END;
	`)
	if err != nil {
		t.Fatal(err)
	}

	mutationID := db.NewUUIDv7()
	pushPayload := fmt.Sprintf(`{
		"client_device_id": "failing-client",
		"mutation_id": "%s",
		"mutations": {},
		"tombstones": [
			{
				"global_id": "%s",
				"entity_type": "service",
				"deleted_at": "2026-10-20T12:00:00Z"
			}
		]
	}`, mutationID, serviceGid)

	res := songSetRequest(t, ts, "POST", "/api/sync/push", pushPayload, cookie)
	if res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500 when tombstone delete fails, got %d", res.StatusCode)
	}
	res.Body.Close()

	// Verify rollback: service is still present
	var count int
	err = handle.QueryRow(`SELECT COUNT(*) FROM services WHERE global_id = ?`, serviceGid).Scan(&count)
	if err != nil || count != 1 {
		t.Fatalf("expected service to remain after rollback, got count=%d (err: %v)", count, err)
	}

	// Verify rollback: no tombstone committed
	var tombstoneCount int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM sync_tombstones WHERE global_id = ?`, serviceGid).Scan(&tombstoneCount)
	if tombstoneCount != 0 {
		t.Fatalf("expected 0 tombstones after rollback, got %d", tombstoneCount)
	}

	// Verify rollback: mutation_id is not recorded in sync_state
	var mutationRecorded int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM sync_state WHERE key = ?`, fmt.Sprintf("mutation:failing-client:%s", mutationID)).Scan(&mutationRecorded)
	if mutationRecorded != 0 {
		t.Fatalf("expected mutation_id not to be committed in sync_state after rollback, got %d", mutationRecorded)
	}
}

func TestSync_AnnouncementServiceAssociationByGlobalID(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	serviceGid := db.NewUUIDv7()

	// Insert service with specific integer ID
	res, err := handle.Exec(`
		INSERT INTO services (global_id, date, raw_payload, created_at, updated_at)
		VALUES (?, '2026-10-25', 'Service R', '2026-10-25T00:00:00Z', '2026-10-25T00:00:00Z')
	`, serviceGid)
	if err != nil {
		t.Fatal(err)
	}
	localServiceID, _ := res.LastInsertId()

	annGid1 := db.NewUUIDv7()
	annGidStandalone := db.NewUUIDv7()
	mutationID1 := db.NewUUIDv7()

	// 1. Ann 1 associates via service_global_id (client has different integer service_id 999)
	// 2. Ann Standalone has no service_global_id (standalone announcement with NULL service_id)
	pushPayload1 := fmt.Sprintf(`{
		"client_device_id": "test-device",
		"mutation_id": "%s",
		"mutations": {
			"announcement_items": [
				{
					"global_id": "%s",
					"image_url": "https://example.com/flyer1.jpg",
					"service_global_id": "%s",
					"service_id": 999,
					"sort_order": 1
				},
				{
					"global_id": "%s",
					"image_url": "https://example.com/flyer-standalone.jpg",
					"sort_order": 2
				}
			]
		}
	}`, mutationID1, annGid1, serviceGid, annGidStandalone)

	pRes := songSetRequest(t, ts, "POST", "/api/sync/push", pushPayload1, cookie)
	if pRes.StatusCode != http.StatusOK {
		var errBody map[string]any
		_ = json.NewDecoder(pRes.Body).Decode(&errBody)
		t.Fatalf("push announcements = %d, body=%v", pRes.StatusCode, errBody)
	}
	pRes.Body.Close()

	// Verify Ann 1 resolved service_id to localServiceID!
	var resolvedSid1 sql.NullInt64
	err = handle.QueryRow(`SELECT service_id FROM announcement_items WHERE global_id = ?`, annGid1).Scan(&resolvedSid1)
	if err != nil || !resolvedSid1.Valid || resolvedSid1.Int64 != localServiceID {
		t.Fatalf("expected resolved service_id=%d, got %v (err: %v)", localServiceID, resolvedSid1, err)
	}

	// Verify Ann Standalone has NULL service_id
	var resolvedSidStandalone sql.NullInt64
	err = handle.QueryRow(`SELECT service_id FROM announcement_items WHERE global_id = ?`, annGidStandalone).Scan(&resolvedSidStandalone)
	if err != nil || resolvedSidStandalone.Valid {
		t.Fatalf("expected NULL service_id for standalone announcement, got %v (err: %v)", resolvedSidStandalone, err)
	}

	// 3. Unknown service_global_id MUST NOT be silently converted to NULL — it must be rejected with 409 Conflict
	annGidUnknown := db.NewUUIDv7()
	mutationID2 := db.NewUUIDv7()
	pushPayloadUnknown := fmt.Sprintf(`{
		"client_device_id": "test-device",
		"mutation_id": "%s",
		"mutations": {
			"announcement_items": [
				{
					"global_id": "%s",
					"image_url": "https://example.com/flyer-unknown.jpg",
					"service_global_id": "nonexistent-service-gid",
					"sort_order": 3
				}
			]
		}
	}`, mutationID2, annGidUnknown)

	pRes2 := songSetRequest(t, ts, "POST", "/api/sync/push", pushPayloadUnknown, cookie)
	if pRes2.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for unknown service_global_id, got %d", pRes2.StatusCode)
	}
	var errBody map[string]any
	_ = json.NewDecoder(pRes2.Body).Decode(&errBody)
	pRes2.Body.Close()
	if errBody["error"] != "unresolved_service_reference" {
		t.Fatalf("expected error='unresolved_service_reference', got %v", errBody)
	}

	// Pull and verify service_global_id is returned
	pullRes := songSetRequest(t, ts, "GET", "/api/sync/pull", "", cookie)
	if pullRes.StatusCode != http.StatusOK {
		t.Fatalf("pull = %d", pullRes.StatusCode)
	}
	var pullBody struct {
		Changes struct {
			AnnouncementItems []struct {
				GlobalID        string  `json:"global_id"`
				ServiceGlobalID *string `json:"service_global_id"`
			} `json:"announcement_items"`
		} `json:"changes"`
	}
	_ = json.NewDecoder(pullRes.Body).Decode(&pullBody)
	pullRes.Body.Close()

	foundPull := false
	for _, item := range pullBody.Changes.AnnouncementItems {
		if item.GlobalID == annGid1 {
			foundPull = true
			if item.ServiceGlobalID == nil || *item.ServiceGlobalID != serviceGid {
				t.Fatalf("expected pulled service_global_id=%s, got %v", serviceGid, item.ServiceGlobalID)
			}
		}
	}
	if !foundPull {
		t.Fatalf("announcement %s not found in pull", annGid1)
	}
}
