package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/desktop"
)

func TestDesktopPairing_Lifecycle(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)
	tempDataDir := t.TempDir()
	srv.DataDir = tempDataDir
	srv.IsDesktop = true

	handler := srv.Handler()

	// 1. Initial GET: Should report paired: false
	req := httptest.NewRequest("GET", "/api/desktop/pairing", nil)
	req = withSession(req, adminSess)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	if cc := w.Header().Get("Cache-Control"); !strings.Contains(cc, "no-store") {
		t.Errorf("expected Cache-Control: no-store, got %q", cc)
	}

	var getResp struct {
		Paired bool `json:"paired"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &getResp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if getResp.Paired {
		t.Errorf("expected initial state to be paired=false")
	}

	// 2. Mock Cloud Instance for Handshake
	validSecret := "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8" // 43 chars
	validToken := "foh_tenant123." + validSecret

	mockCloud := httptest.NewServer(http.HandlerFunc(func(cw http.ResponseWriter, cr *http.Request) {
		if cr.URL.Path == "/api/sync/status" {
			authHeader := cr.Header.Get("Authorization")
			if authHeader != "Bearer "+validToken {
				cw.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(cw).Encode(map[string]string{"error": "unauthorized"})
				return
			}
			cw.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(cw).Encode(map[string]any{
				"ok":          true,
				"tenant_id":   "tenant123",
				"church_name": "Gereja Contoh Sintetis",
				"device_id":   "dev_mock",
				"rev":         42,
			})
			return
		}
		cw.WriteHeader(http.StatusNotFound)
	}))
	defer mockCloud.Close()

	// 3. Test Connection (POST /api/desktop/pairing/test) with Invalid Token
	invalidPayload := `{"cloud_url":"` + mockCloud.URL + `","token":"invalid_token"}`
	req = httptest.NewRequest("POST", "/api/desktop/pairing/test", strings.NewReader(invalidPayload))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid token format, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Test Connection with Valid Token
	validPayload := `{"cloud_url":"` + mockCloud.URL + `","token":"` + validToken + `"}`
	req = httptest.NewRequest("POST", "/api/desktop/pairing/test", strings.NewReader(validPayload))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid test, got %d: %s", w.Code, w.Body.String())
	}
	var testResp struct {
		OK         bool   `json:"ok"`
		ChurchName string `json:"church_name"`
		TenantID   string `json:"tenant_id"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &testResp); err != nil {
		t.Fatalf("failed to decode test connection response: %v", err)
	}
	if !testResp.OK || testResp.ChurchName != "Gereja Contoh Sintetis" {
		t.Errorf("unexpected test connection response: %+v", testResp)
	}

	// Verify not yet saved
	cfg, _ := desktop.LoadPairingConfig(tempDataDir)
	if cfg != nil {
		t.Errorf("test connection endpoint should not persist pairing config")
	}

	// 5. Connect / Save Pairing (POST /api/desktop/pairing)
	req = httptest.NewRequest("POST", "/api/desktop/pairing", strings.NewReader(validPayload))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for pairing, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Verify GET /api/desktop/pairing shows paired state and masked token
	req = httptest.NewRequest("GET", "/api/desktop/pairing", nil)
	req = withSession(req, adminSess)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var pairedGetResp struct {
		Paired      bool      `json:"paired"`
		CloudURL    string    `json:"cloud_url"`
		TenantID    string    `json:"tenant_id"`
		ChurchName  string    `json:"church_name"`
		TokenMasked string    `json:"token_masked"`
		PairedAt    time.Time `json:"paired_at"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &pairedGetResp); err != nil {
		t.Fatalf("failed to decode paired GET: %v", err)
	}
	if !pairedGetResp.Paired {
		t.Errorf("expected paired=true")
	}
	if pairedGetResp.ChurchName != "Gereja Contoh Sintetis" {
		t.Errorf("expected ChurchName 'Gereja Contoh Sintetis', got %q", pairedGetResp.ChurchName)
	}
	if !strings.HasPrefix(pairedGetResp.TokenMasked, "foh_tenant123.") || !strings.HasSuffix(pairedGetResp.TokenMasked, "********") {
		t.Errorf("expected masked token, got %q", pairedGetResp.TokenMasked)
	}

	// 7. Unpair (DELETE /api/desktop/pairing)
	req = httptest.NewRequest("DELETE", "/api/desktop/pairing", nil)
	req = withSession(req, adminSess)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for delete, got %d: %s", w.Code, w.Body.String())
	}

	// 8. Verify GET shows paired=false again
	req = httptest.NewRequest("GET", "/api/desktop/pairing", nil)
	req = withSession(req, adminSess)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	var finalGetResp struct {
		Paired bool `json:"paired"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &finalGetResp)
	if finalGetResp.Paired {
		t.Errorf("expected paired=false after delete")
	}
}

func TestDesktopPairing_NetworkErrorReturns502(t *testing.T) {
	srv, adminSess, _ := setupTestServer(t)
	srv.DataDir = t.TempDir()
	srv.IsDesktop = true

	handler := srv.Handler()

	validSecret := "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"
	validToken := "foh_tenant123." + validSecret

	// Point to unreachable port on loopback
	payload := `{"cloud_url":"http://127.0.0.1:54321","token":"` + validToken + `"}`
	req := httptest.NewRequest("POST", "/api/desktop/pairing/test", strings.NewReader(payload))
	req = withSession(req, adminSess)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Invariant: Network reachability failures return 502 Bad Gateway
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 Bad Gateway for network error, got %d: %s", w.Code, w.Body.String())
	}
}

