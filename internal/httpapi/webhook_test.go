package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type failOnReadBody struct {
	readCalled bool
}

func (f *failOnReadBody) Read(p []byte) (n int, err error) {
	f.readCalled = true
	return 0, io.EOF
}

func (f *failOnReadBody) Close() error {
	return nil
}

func TestWebhook_DisabledInCodeUnconditional503AndBodyUnread(t *testing.T) {
	srv := &Server{}

	bodyReader := &failOnReadBody{}
	req := httptest.NewRequest(http.MethodPost, "/api/webhook", bodyReader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Secret", "test-webhook-secret-value")
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	// 1. Assert status code 503 Service Unavailable
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable, got %d (body: %s)", w.Code, w.Body.String())
	}

	// 2. Assert exact message in JSON error body
	var errResp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("failed to parse JSON error response: %v (raw: %s)", err, w.Body.String())
	}
	expectedMsg := "Webhook intake is disabled in this release"
	if errResp["error"] != expectedMsg {
		t.Fatalf("expected error %q, got %q", expectedMsg, errResp["error"])
	}

	// 3. Assert request body was NOT read (proven by failOnReadBody)
	if bodyReader.readCalled {
		t.Fatalf("CRITICAL SECURITY DEFECT: request body was read when webhook intake is disabled")
	}
}
