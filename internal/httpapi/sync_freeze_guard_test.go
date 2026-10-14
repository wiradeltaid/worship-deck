package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFohSync_FreezeGuardRejection(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)
	tempDataDir := t.TempDir()
	srv.DataDir = tempDataDir
	srv.IsDesktop = true

	handler := srv.Handler()

	// 1. Simulate active presenter session
	SetActivePresenterForTest(true)
	defer SetActivePresenterForTest(false)

	// 2. Attempt POST /api/desktop/sync/pull-cloud while presentation is active
	req := httptest.NewRequest("POST", "/api/desktop/sync/pull-cloud", strings.NewReader(`{}`))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Invariant K-FREEZE-01: Must refuse with 409 Conflict and presenter_active code
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when presenter is active, got %d: %s", w.Code, w.Body.String())
	}

	var errResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("failed to parse error response: %v", err)
	}

	if errResp.Error.Code != "presenter_active" {
		t.Errorf("expected error code 'presenter_active', got %q", errResp.Error.Code)
	}
	if !strings.Contains(errResp.Error.Message, "Sinkronisasi ditahan") && !strings.Contains(errResp.Error.Message, "presenter") {
		t.Errorf("unexpected error message: %q", errResp.Error.Message)
	}

	// 3. Deactivate presenter session -> verify sync lock can be acquired
	SetActivePresenterForTest(false)
	release, ok := globalRemoteHub.TryAcquireSyncLock()
	if !ok {
		t.Fatalf("expected sync lock to be available after presenter deactivation")
	}
	release()
}
