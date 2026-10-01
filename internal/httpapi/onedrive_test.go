package httpapi

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/auth"
	"github.com/wiradeltaid/worship-deck/internal/db"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}

func TestOneDriveSettings_Unauthenticated(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	req := httptest.NewRequest("GET", "/api/settings/onedrive", nil)
	w := httptest.NewRecorder()

	server.handleGetOneDriveSettings(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d", w.Code)
	}
}

func TestOneDriveSettings_RedactionAndUserIsolation(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	// Create two users
	_, err := database.Exec(`
		INSERT INTO accounts (id, username, password_hash, role) VALUES
		(1, 'user1', 'hash1', 'operator'),
		(2, 'user2', 'hash2', 'operator')
	`)
	if err != nil {
		t.Fatalf("failed to insert test accounts: %v", err)
	}

	// Insert secret tokens for User 1
	_, err = database.Exec(`
		INSERT INTO onedrive_configs (
			user_id, client_id, tenant_id, access_token, refresh_token, token_expiry,
			account_email, account_name, target_folder_id, target_folder_path, sync_mode
		) VALUES (
			1, 'client-123', 'common', 'super-secret-access-token', 'super-secret-refresh-token', 9999999999,
			'user1@example.com', 'User One', 'folder-abc', '/Worship/2026', 'always'
		)
	`)
	if err != nil {
		t.Fatalf("failed to insert config for user 1: %v", err)
	}

	// Test User 1 GET /api/settings/onedrive
	req1 := httptest.NewRequest("GET", "/api/settings/onedrive", nil)
	req1 = withSession(req1, &auth.Session{UID: 1, Role: "operator", TV: 1})
	w1 := httptest.NewRecorder()

	server.handleGetOneDriveSettings(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for user 1, got %d: %s", w1.Code, w1.Body.String())
	}

	respBody1 := w1.Body.String()
	// ABSENCE GUARD: Tokens must NEVER appear in serialized response
	if strings.Contains(respBody1, "super-secret-access-token") {
		t.Fatalf("ABSENCE GUARD FAILURE: access_token leaked in response: %s", respBody1)
	}
	if strings.Contains(respBody1, "super-secret-refresh-token") {
		t.Fatalf("ABSENCE GUARD FAILURE: refresh_token leaked in response: %s", respBody1)
	}

	var pub1 OneDrivePublicConfig
	if err := json.Unmarshal(w1.Body.Bytes(), &pub1); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}
	if !pub1.Connected {
		t.Errorf("expected connected=true for user 1")
	}
	if pub1.AccountEmail != "user1@example.com" {
		t.Errorf("expected email 'user1@example.com', got %q", pub1.AccountEmail)
	}
	if pub1.SyncMode != "always" {
		t.Errorf("expected sync_mode 'always', got %q", pub1.SyncMode)
	}
	if pub1.TargetFolderID != "folder-abc" {
		t.Errorf("expected folder-abc, got %q", pub1.TargetFolderID)
	}

	// Test User 2 GET /api/settings/onedrive (User Isolation)
	req2 := httptest.NewRequest("GET", "/api/settings/onedrive", nil)
	req2 = withSession(req2, &auth.Session{UID: 2, Role: "operator", TV: 1})
	w2 := httptest.NewRecorder()

	server.handleGetOneDriveSettings(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for user 2, got %d", w2.Code)
	}

	var pub2 OneDrivePublicConfig
	if err := json.Unmarshal(w2.Body.Bytes(), &pub2); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}
	if pub2.Connected {
		t.Errorf("USER ISOLATION FAILURE: User 2 must NOT be connected")
	}
	if pub2.AccountEmail != "" {
		t.Errorf("USER ISOLATION FAILURE: User 2 received email %q", pub2.AccountEmail)
	}
	if pub2.TargetFolderID != "" {
		t.Errorf("USER ISOLATION FAILURE: User 2 received folder %q", pub2.TargetFolderID)
	}
}

func TestOneDriveSettings_PostAndDisconnect(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	_, err := database.Exec(`
		INSERT INTO accounts (id, username, password_hash, role) VALUES (1, 'user1', 'hash1', 'operator')
	`)
	if err != nil {
		t.Fatalf("failed to insert account: %v", err)
	}

	// Update settings via POST
	payload := map[string]any{
		"sync_mode":          "always",
		"target_folder_id":   "folder-xyz",
		"target_folder_path": "/Sunday/Slides",
	}
	rawPayload, _ := json.Marshal(payload)

	reqPost := httptest.NewRequest("POST", "/api/settings/onedrive", bytes.NewReader(rawPayload))
	reqPost = withSession(reqPost, &auth.Session{UID: 1, Role: "operator", TV: 1})
	reqPost.Header.Set("Content-Type", "application/json")
	wPost := httptest.NewRecorder()

	server.handlePostOneDriveSettings(wPost, reqPost)
	if wPost.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", wPost.Code, wPost.Body.String())
	}

	var pubPost OneDrivePublicConfig
	json.Unmarshal(wPost.Body.Bytes(), &pubPost)
	if pubPost.SyncMode != "always" || pubPost.TargetFolderID != "folder-xyz" || pubPost.TargetFolderPath != "/Sunday/Slides" {
		t.Fatalf("unexpected settings: %+v", pubPost)
	}

	// Disconnect via DELETE
	reqDel := httptest.NewRequest("DELETE", "/api/settings/onedrive", nil)
	reqDel = withSession(reqDel, &auth.Session{UID: 1, Role: "operator", TV: 1})
	wDel := httptest.NewRecorder()

	server.handleDeleteOneDriveSettings(wDel, reqDel)
	if wDel.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", wDel.Code)
	}

	// Verify disconnected
	reqCheck := httptest.NewRequest("GET", "/api/settings/onedrive", nil)
	reqCheck = withSession(reqCheck, &auth.Session{UID: 1, Role: "operator", TV: 1})
	wCheck := httptest.NewRecorder()
	server.handleGetOneDriveSettings(wCheck, reqCheck)

	var pubCheck OneDrivePublicConfig
	json.Unmarshal(wCheck.Body.Bytes(), &pubCheck)
	if pubCheck.Connected {
		t.Errorf("expected disconnected after DELETE")
	}
}

func TestOneDriveSettings_PKCELifecycle(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	req := httptest.NewRequest("GET", "/api/settings/onedrive/auth-url", nil)
	req = withSession(req, &auth.Session{UID: 1, Role: "operator", TV: 1})
	w := httptest.NewRecorder()

	server.handleGetOneDriveAuthURL(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		AuthURL string `json:"auth_url"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}

	u, err := url.Parse(resp.AuthURL)
	if err != nil {
		t.Fatalf("invalid auth_url: %v", err)
	}

	q := u.Query()
	if q.Get("response_type") != "code" {
		t.Errorf("missing response_type=code")
	}
	if q.Get("code_challenge_method") != "S256" {
		t.Errorf("missing code_challenge_method=S256")
	}
	state := q.Get("state")
	if state == "" {
		t.Fatalf("missing state query parameter")
	}

	// Verify state is stored in pkceStore
	pkceMu.Lock()
	session, exists := pkceStore[state]
	pkceMu.Unlock()
	if !exists {
		t.Fatalf("state %q was not found in pkceStore", state)
	}
	if session.UserID != 1 {
		t.Errorf("expected UserID 1, got %d", session.UserID)
	}
	if session.CodeVerifier == "" {
		t.Errorf("expected non-empty CodeVerifier")
	}
}

func TestOneDriveFolders_MockGraph(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	// Mock Microsoft Graph server
	mockGraph := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer test-valid-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"value": [
				{
					"id": "f-1",
					"name": "Sunday Slides",
					"lastModifiedDateTime": "2026-10-01T10:00:00Z",
					"folder": { "childCount": 4 },
					"parentReference": { "id": "root" }
				},
				{
					"id": "f-2",
					"name": "Youth Service",
					"lastModifiedDateTime": "2026-09-28T12:00:00Z",
					"folder": { "childCount": 1 },
					"parentReference": { "id": "root" }
				}
			]
		}`))
	}))
	defer mockGraph.Close()

	origGraphURL := os.Getenv("ONEDRIVE_GRAPH_URL")
	os.Setenv("ONEDRIVE_GRAPH_URL", mockGraph.URL)
	defer os.Setenv("ONEDRIVE_GRAPH_URL", origGraphURL)

	// Insert account and token
	database.Exec(`INSERT INTO accounts (id, username, password_hash, role) VALUES (1, 'user1', 'h', 'operator')`)
	database.Exec(`
		INSERT INTO onedrive_configs (user_id, access_token, refresh_token, token_expiry)
		VALUES (1, 'test-valid-token', 'refresh-token', ?)
	`, time.Now().Unix()+3600)

	req := httptest.NewRequest("GET", "/api/settings/onedrive/folders", nil)
	req = withSession(req, &auth.Session{UID: 1, Role: "operator", TV: 1})
	w := httptest.NewRecorder()

	server.handleGetOneDriveFolders(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var items []OneDriveFolderItem
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].Name != "Sunday Slides" || items[0].ChildCount != 4 {
		t.Errorf("unexpected item: %+v", items[0])
	}
}

func TestOneDriveUpload_SimpleUpload(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	// Create test service
	_, err := database.Exec(`
		INSERT INTO services (id, date, raw_payload) VALUES (10, '2026-10-04', 'test-payload')
	`)
	if err != nil {
		t.Fatalf("failed to insert service: %v", err)
	}

	mockGraph := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" && strings.Contains(r.URL.Path, "content") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{
				"name": "Sunday-Deck.pptx",
				"webUrl": "https://onedrive.live.com/view/Sunday-Deck.pptx"
			}`))
			return
		}
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer mockGraph.Close()

	origGraphURL := os.Getenv("ONEDRIVE_GRAPH_URL")
	os.Setenv("ONEDRIVE_GRAPH_URL", mockGraph.URL)
	defer os.Setenv("ONEDRIVE_GRAPH_URL", origGraphURL)

	database.Exec(`INSERT INTO accounts (id, username, password_hash, role) VALUES (1, 'user1', 'h', 'operator')`)
	database.Exec(`
		INSERT INTO onedrive_configs (user_id, access_token, refresh_token, token_expiry, target_folder_id)
		VALUES (1, 'test-token', 'refresh-token', ?, 'target-folder-123')
	`, time.Now().Unix()+3600)

	// Prepare multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "Sunday-Deck.pptx")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	part.Write([]byte("fake pptx presentation bytes"))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/services/10/onedrive-upload", body)
	req.SetPathValue("id", "10")
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = withSession(req, &auth.Session{UID: 1, Role: "operator", TV: 1})
	w := httptest.NewRecorder()

	server.handlePostOneDriveUpload(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Success  bool   `json:"success"`
		WebURL   string `json:"web_url"`
		Filename string `json:"filename"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json unmarshal: %v", err)
	}
	if !resp.Success || resp.Filename != "Sunday-Deck.pptx" || !strings.Contains(resp.WebURL, "onedrive.live.com") {
		t.Errorf("unexpected upload response: %+v", resp)
	}
}

func TestOneDriveUpload_ChunkFailureDoesNotReportSuccess(t *testing.T) {
	database := setupTestDB(t)
	server := &Server{DB: database}

	_, _ = database.Exec(`INSERT INTO services (id, date, raw_payload) VALUES (20, '2026-10-04', 'payload')`)
	_, _ = database.Exec(`INSERT INTO accounts (id, username, password_hash, role) VALUES (1, 'u', 'p', 'operator')`)
	_, _ = database.Exec(`
		INSERT INTO onedrive_configs (user_id, access_token, refresh_token, token_expiry, target_folder_id)
		VALUES (1, 'test-token', 'refresh-token', ?, 'folder-1')
	`, time.Now().Unix()+3600)

	// Mock Graph that creates upload session, but rejects chunk upload with 500
	mockGraph := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "createUploadSession") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"uploadUrl": "http://` + r.Host + `/upload-chunks"}`))
			return
		}
		if strings.Contains(r.URL.Path, "upload-chunks") {
			// DEFECT INJECTION: Graph rejects chunk with 502
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte(`{"error": {"message": "Storage error"}}`))
			return
		}
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer mockGraph.Close()

	origGraphURL := os.Getenv("ONEDRIVE_GRAPH_URL")
	os.Setenv("ONEDRIVE_GRAPH_URL", mockGraph.URL)
	defer os.Setenv("ONEDRIVE_GRAPH_URL", origGraphURL)

	// Create payload >= 4MiB to trigger upload session
	largeBytes := make([]byte, 4*1024*1024+100)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "Large-Deck.pptx")
	part.Write(largeBytes)
	writer.Close()

	req := httptest.NewRequest("POST", "/api/services/20/onedrive-upload", body)
	req.SetPathValue("id", "20")
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = withSession(req, &auth.Session{UID: 1, Role: "operator", TV: 1})
	w := httptest.NewRecorder()

	server.handlePostOneDriveUpload(w, req)
	if w.Code == http.StatusOK {
		t.Fatalf("EXPECTED FAILURE: chunk failure must NOT report HTTP 200 success! Response: %s", w.Body.String())
	}
	if w.Code != http.StatusBadGateway {
		t.Errorf("expected 502 Bad Gateway on chunk failure, got %d", w.Code)
	}
}
