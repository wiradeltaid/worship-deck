package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wiradeltaid/worship-deck/internal/auth"
	"github.com/wiradeltaid/worship-deck/internal/httpapi"
)

func TestStartupAuthSecretRefusal(t *testing.T) {
	prohibited := []string{
		"change-me",
		"change-me-production",
		"your-secret-here",
		"your-secret-here-123",
		"secret",
		"password",
	}

	for _, p := range prohibited {
		t.Run("AUTH_SECRET_"+p, func(t *testing.T) {
			t.Setenv("AUTH_SECRET", p)
			t.Setenv("JWT_SECRET", "")
			err := auth.ValidateStartupSecrets()
			if err == nil {
				t.Fatalf("expected startup refusal for AUTH_SECRET=%q, got nil", p)
			}
			if !strings.Contains(err.Error(), "insecure secret placeholder") {
				t.Fatalf("unexpected refusal error: %v", err)
			}
		})

		t.Run("JWT_SECRET_"+p, func(t *testing.T) {
			t.Setenv("AUTH_SECRET", "valid-auth-secret-123456789012345")
			t.Setenv("JWT_SECRET", p)
			err := auth.ValidateStartupSecrets()
			if err == nil {
				t.Fatalf("expected startup refusal for JWT_SECRET=%q, got nil", p)
			}
			if !strings.Contains(err.Error(), "insecure secret placeholder") {
				t.Fatalf("unexpected refusal error: %v", err)
			}
		})
	}
}

func TestDesktopModeAutomaticAuthSecret(t *testing.T) {
	auth.ResetDesktopSecretForTest()
	tempDir := t.TempDir()
	t.Setenv("AUTH_SECRET", "")

	// 1. First execution initializes secret file
	sec1, err := auth.InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret failed: %v", err)
	}
	if len(sec1) < 32 {
		t.Fatalf("expected at least 32 characters, got %d", len(sec1))
	}

	secretFile := filepath.Join(tempDir, "auth-secret.dat")
	if _, err := os.Stat(secretFile); err != nil {
		t.Fatalf("expected auth-secret.dat to exist: %v", err)
	}

	// Sign a session to verify token generation works
	token, err := auth.Sign(1, "admin", 1)
	if err != nil {
		t.Fatalf("auth.Sign with auto-generated desktop secret failed: %v", err)
	}
	session := auth.Verify(token)
	if session == nil || session.UID != 1 || session.Role != "admin" {
		t.Fatalf("auth.Verify failed for desktop token: %+v", session)
	}

	// 2. Restart execution reuses the same secret
	auth.ResetDesktopSecretForTest()
	sec2, err := auth.InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret restart failed: %v", err)
	}
	if sec2 != sec1 {
		t.Fatalf("expected secret to be reused across restarts, got %q != %q", sec2, sec1)
	}
	// Verify previous token is still valid after restart!
	sessionAfterRestart := auth.Verify(token)
	if sessionAfterRestart == nil || sessionAfterRestart.UID != 1 {
		t.Fatalf("session invalidated after restart! Got: %+v", sessionAfterRestart)
	}
}

func TestServerModeUnsetAuthSecretReturns503(t *testing.T) {
	auth.ResetDesktopSecretForTest()
	t.Setenv("AUTH_SECRET", "")

	srv := &httpapi.Server{}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"admin","password":"ValidPassword123!"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable when AUTH_SECRET unset in server mode, got %d (body: %s)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Auth not configured") {
		t.Fatalf("expected 'Auth not configured' response, got: %s", w.Body.String())
	}
}
