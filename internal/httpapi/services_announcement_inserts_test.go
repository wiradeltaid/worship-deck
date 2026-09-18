package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"testing"
)

func TestAnnouncementInsertsPersistence(t *testing.T) {
	ts, _ := newAnnTestServer(t)
	cookie := annLogin(t, ts)

	// 1. Create a service with 4 announcement posters
	createBody := `{
		"raw_payload": "SABBATH, OCTOBER 10, 2026\nDIVINE SERVICE\nOpening Song: SDAH #100\nSermon: Pastor Adam\nClosing Prayer: Elder John",
		"announcementInserts": [
			"http://images.example.invalid/poster-1.jpg",
			"http://images.example.invalid/poster-2.jpg",
			"",
			"http://images.example.invalid/poster-4.jpg"
		]
	}`
	res := annRequest(t, ts, "POST", "/api/services", createBody, cookie)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("create service failed (%d): %s", res.StatusCode, b)
	}

	var created struct {
		ID        int    `json:"id"`
		UpdatedAt string `json:"updated_at"`
	}
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created service: %v", err)
	}
	if created.ID == 0 {
		t.Fatalf("expected non-zero service ID, got %d", created.ID)
	}

	// 2. GET the service and verify images_payload.announcementInserts
	getRes := annRequest(t, ts, "GET", "/api/services/"+strconv.Itoa(created.ID), "", cookie)
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(getRes.Body)
		t.Fatalf("get service failed (%d): %s", getRes.StatusCode, b)
	}

	var fetched struct {
		ID            int            `json:"id"`
		UpdatedAt     string         `json:"updated_at"`
		ImagesPayload map[string]any `json:"images_payload"`
	}
	if err := json.NewDecoder(getRes.Body).Decode(&fetched); err != nil {
		t.Fatalf("failed to decode fetched service: %v", err)
	}

	insertsRaw, ok := fetched.ImagesPayload["announcementInserts"].([]any)
	if !ok {
		t.Fatalf("expected announcementInserts in images_payload, got: %#v", fetched.ImagesPayload)
	}
	if len(insertsRaw) != 4 {
		t.Fatalf("expected 4 announcementInserts, got %d", len(insertsRaw))
	}
	if insertsRaw[0] != "http://images.example.invalid/poster-1.jpg" ||
		insertsRaw[1] != "http://images.example.invalid/poster-2.jpg" ||
		insertsRaw[2] != "" ||
		insertsRaw[3] != "http://images.example.invalid/poster-4.jpg" {
		t.Fatalf("announcementInserts mismatch: %#v", insertsRaw)
	}

	// 3. PUT update service with modified slot 3 and verify retention
	updateBody := `{
		"updated_at": "` + fetched.UpdatedAt + `",
		"raw_payload": "SABBATH, OCTOBER 10, 2026\nDIVINE SERVICE\nOpening Song: SDAH #100\nSermon: Pastor Adam\nClosing Prayer: Elder John",
		"announcementInserts": [
			"http://images.example.invalid/poster-1.jpg",
			"http://images.example.invalid/poster-2.jpg",
			"http://images.example.invalid/poster-3-updated.jpg",
			"http://images.example.invalid/poster-4.jpg"
		]
	}`
	putRes := annRequest(t, ts, "PUT", "/api/services/"+strconv.Itoa(created.ID), updateBody, cookie)
	defer putRes.Body.Close()
	if putRes.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(putRes.Body)
		t.Fatalf("update service failed (%d): %s", putRes.StatusCode, b)
	}

	// 4. Verify updated service has all 4 slots correctly preserved
	getRes2 := annRequest(t, ts, "GET", "/api/services/"+strconv.Itoa(created.ID), "", cookie)
	defer getRes2.Body.Close()
	var fetched2 struct {
		ImagesPayload map[string]any `json:"images_payload"`
	}
	if err := json.NewDecoder(getRes2.Body).Decode(&fetched2); err != nil {
		t.Fatalf("failed to decode fetched service: %v", err)
	}
	insertsRaw2, ok := fetched2.ImagesPayload["announcementInserts"].([]any)
	if !ok || len(insertsRaw2) != 4 {
		t.Fatalf("expected 4 announcementInserts in updated service, got %#v", fetched2.ImagesPayload["announcementInserts"])
	}
	if insertsRaw2[0] != "http://images.example.invalid/poster-1.jpg" ||
		insertsRaw2[1] != "http://images.example.invalid/poster-2.jpg" ||
		insertsRaw2[2] != "http://images.example.invalid/poster-3-updated.jpg" ||
		insertsRaw2[3] != "http://images.example.invalid/poster-4.jpg" {
		t.Fatalf("updated announcementInserts mismatch: %#v", insertsRaw2)
	}
}
