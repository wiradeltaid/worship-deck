package httpapi

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"

	"github.com/wiradeltaid/worship-deck/internal/auth"
	"github.com/wiradeltaid/worship-deck/internal/db"
)

func newTestSetupDB(t *testing.T) (*sql.DB, string) {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test-setup.db")
	handle, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	t.Cleanup(func() { _ = handle.Close() })

	// Ensure accounts table is empty for first-admin setup tests
	if _, err := handle.Exec(`DELETE FROM accounts; DELETE FROM revoked_sessions;`); err != nil {
		t.Fatalf("clearing accounts failed: %v", err)
	}
	return handle, tempDir
}

func TestSetupEndpoints_SecurityAccessControl(t *testing.T) {
	handle, tempDir := newTestSetupDB(t)
	auth.ResetDesktopSecretForTest()
	_, _ = auth.InitDesktopAuthSecret(tempDir)

	// Server mode (IsDesktop: false)
	serverModeSrv := &Server{DB: handle, IsDesktop: false}
	t.Run("server_mode_get_status_rejected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/setup/status", nil)
		req.RemoteAddr = "127.0.0.1:54321"
		w := httptest.NewRecorder()
		serverModeSrv.Handler().ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden in server mode, got %d", w.Code)
		}
	})

	t.Run("server_mode_post_admin_rejected", func(t *testing.T) {
		body := `{"username":"admin","password":"StrongPassword123!"}`
		req := httptest.NewRequest(http.MethodPost, "/api/setup/admin", bytes.NewBufferString(body))
		req.RemoteAddr = "127.0.0.1:54321"
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		serverModeSrv.Handler().ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden in server mode, got %d", w.Code)
		}
	})

	// Desktop mode with remote non-loopback IP
	desktopSrv := &Server{DB: handle, IsDesktop: true}
	t.Run("remote_ip_get_status_rejected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/setup/status", nil)
		req.RemoteAddr = "192.168.1.100:54321"
		w := httptest.NewRecorder()
		desktopSrv.Handler().ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for remote IP, got %d", w.Code)
		}
	})

	t.Run("remote_ip_post_admin_rejected", func(t *testing.T) {
		body := `{"username":"admin","password":"StrongPassword123!"}`
		req := httptest.NewRequest(http.MethodPost, "/api/setup/admin", bytes.NewBufferString(body))
		req.RemoteAddr = "10.0.0.5:54321"
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		desktopSrv.Handler().ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for remote IP, got %d", w.Code)
		}
	})
}

func TestSetupEndpoints_LifecycleAndConcurrency(t *testing.T) {
	handle, tempDir := newTestSetupDB(t)
	auth.ResetDesktopSecretForTest()
	_, _ = auth.InitDesktopAuthSecret(tempDir)
	srv := &Server{DB: handle, IsDesktop: true}

	// 1. Initial status reports setupRequired = true
	req := httptest.NewRequest(http.MethodGet, "/api/setup/status", nil)
	req.RemoteAddr = "127.0.0.1:50000"
	w := httptest.NewRecorder()
	srv.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	var statusResp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &statusResp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if statusResp["setupRequired"] != true {
		t.Fatalf("expected setupRequired true, got %v", statusResp["setupRequired"])
	}

	// 2. Happy-path admin creation
	body := `{"username":"superadmin","password":"InitialAdminPassword123!"}`
	reqPost := httptest.NewRequest(http.MethodPost, "/api/setup/admin", bytes.NewBufferString(body))
	reqPost.RemoteAddr = "127.0.0.1:50000"
	reqPost.Header.Set("Content-Type", "application/json")
	wPost := httptest.NewRecorder()
	srv.Handler().ServeHTTP(wPost, reqPost)

	if wPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for initial admin setup, got %d (body: %s)", wPost.Code, wPost.Body.String())
	}
	var postResp map[string]any
	if err := json.Unmarshal(wPost.Body.Bytes(), &postResp); err != nil {
		t.Fatalf("unmarshal post resp failed: %v", err)
	}
	if postResp["ok"] != true || postResp["role"] != "admin" || postResp["username"] != "superadmin" {
		t.Fatalf("unexpected post resp: %+v", postResp)
	}

	// Verify session cookie was set
	cookies := wPost.Result().Cookies()
	var authCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == auth.CookieName {
			authCookie = c
			break
		}
	}
	if authCookie == nil || authCookie.Value == "" {
		t.Fatal("expected auth_session cookie to be returned upon setup")
	}
	sess := auth.Verify(authCookie.Value)
	if sess == nil || sess.Role != "admin" {
		t.Fatalf("expected valid admin session token, got %+v", sess)
	}

	// 3. Status now reports setupRequired = false
	wStatus2 := httptest.NewRecorder()
	reqStatus2 := httptest.NewRequest(http.MethodGet, "/api/setup/status", nil)
	reqStatus2.RemoteAddr = "127.0.0.1:50000"
	srv.Handler().ServeHTTP(wStatus2, reqStatus2)
	if wStatus2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", wStatus2.Code)
	}
	var statusResp2 map[string]any
	_ = json.Unmarshal(wStatus2.Body.Bytes(), &statusResp2)
	if statusResp2["setupRequired"] != false {
		t.Fatalf("expected setupRequired false after setup, got %v", statusResp2["setupRequired"])
	}

	// 4. Second setup attempt is rejected with 403 Forbidden
	wPost2 := httptest.NewRecorder()
	reqPost2 := httptest.NewRequest(http.MethodPost, "/api/setup/admin", bytes.NewBufferString(`{"username":"admin2","password":"AnotherPassword123!"}`))
	reqPost2.RemoteAddr = "127.0.0.1:50000"
	reqPost2.Header.Set("Content-Type", "application/json")
	srv.Handler().ServeHTTP(wPost2, reqPost2)
	if wPost2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden on second setup attempt, got %d (body: %s)", wPost2.Code, wPost2.Body.String())
	}
}

func TestSetupEndpoints_Concurrency(t *testing.T) {
	handle, tempDir := newTestSetupDB(t)
	auth.ResetDesktopSecretForTest()
	_, _ = auth.InitDesktopAuthSecret(tempDir)
	srv := &Server{DB: handle, IsDesktop: true}

	const callers = 10
	var wg sync.WaitGroup
	codes := make([]int, callers)

	for i := 0; i < callers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			body := `{"username":"concurrent_admin","password":"StrongConcurrentPassword123!"}`
			req := httptest.NewRequest(http.MethodPost, "/api/setup/admin", bytes.NewBufferString(body))
			req.RemoteAddr = "127.0.0.1:50000"
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			srv.Handler().ServeHTTP(w, req)
			codes[idx] = w.Code
		}(i)
	}
	wg.Wait()

	successCount := 0
	forbiddenCount := 0
	for _, code := range codes {
		if code == http.StatusOK {
			successCount++
		} else if code == http.StatusForbidden {
			forbiddenCount++
		}
	}

	if successCount != 1 {
		t.Fatalf("expected exactly 1 successful setup, got %d (codes: %v)", successCount, codes)
	}
	if forbiddenCount != callers-1 {
		t.Fatalf("expected remaining %d requests to be 403 Forbidden, got %d", callers-1, forbiddenCount)
	}

	// Verify only 1 account exists in db
	count, err := auth.CountAccounts(handle)
	if err != nil {
		t.Fatalf("CountAccounts failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 account in database, found %d", count)
	}
}
