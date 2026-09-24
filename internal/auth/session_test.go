package auth

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
)

func TestValidateSecret_ProhibitedPlaceholders(t *testing.T) {
	prohibited := []string{
		"change-me",
		"change-me-to-a-long-random-string",
		"Change-Me-12345",
		"your-secret-here",
		"your-secret-here-production",
		"Your-Secret-Here",
		"secret",
		"secret-key-12345",
		"password",
		"password12345",
	}

	for _, p := range prohibited {
		t.Run("prohibited_"+p, func(t *testing.T) {
			err := ValidateSecret(p)
			if err == nil {
				t.Fatalf("expected error for prohibited secret %q, got nil", p)
			}
			if !strings.Contains(err.Error(), "insecure secret placeholder") {
				t.Fatalf("unexpected error message: %v", err)
			}
		})
	}

	// Valid secrets must pass
	validSecrets := []string{
		"7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
		"worshipdeck-production-secret-994821a8b7c6",
		"k4j8x92mN-aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
	}
	for _, v := range validSecrets {
		t.Run("valid_"+v[:10], func(t *testing.T) {
			if err := ValidateSecret(v); err != nil {
				t.Fatalf("expected valid secret %q to pass, got: %v", v, err)
			}
		})
	}
}

func TestValidateStartupSecrets_EnvVars(t *testing.T) {
	t.Run("AUTH_SECRET placeholder rejected", func(t *testing.T) {
		t.Setenv("AUTH_SECRET", "change-me-production-fake")
		t.Setenv("JWT_SECRET", "")
		err := ValidateStartupSecrets()
		if err == nil || !strings.Contains(err.Error(), "AUTH_SECRET invalid") {
			t.Fatalf("expected AUTH_SECRET error, got: %v", err)
		}
	})

	t.Run("JWT_SECRET placeholder rejected", func(t *testing.T) {
		t.Setenv("AUTH_SECRET", "valid-auth-secret-123456789012345")
		t.Setenv("JWT_SECRET", "your-secret-here-123456")
		err := ValidateStartupSecrets()
		if err == nil || !strings.Contains(err.Error(), "JWT_SECRET invalid") {
			t.Fatalf("expected JWT_SECRET error, got: %v", err)
		}
	})

	t.Run("Both valid passes", func(t *testing.T) {
		t.Setenv("AUTH_SECRET", "valid-auth-secret-123456789012345")
		t.Setenv("JWT_SECRET", "valid-jwt-secret-1234567890123456")
		if err := ValidateStartupSecrets(); err != nil {
			t.Fatalf("expected valid secrets to pass, got: %v", err)
		}
	})
}

func TestInitDesktopAuthSecret_Lifecycle(t *testing.T) {
	ResetDesktopSecretForTest()
	tempDir := t.TempDir()

	// 1. Generation on first run
	t.Setenv("AUTH_SECRET", "")
	sec1, err := InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret first run failed: %v", err)
	}
	if len(sec1) < 32 {
		t.Fatalf("expected at least 32 characters, got %d", len(sec1))
	}

	secretFile := filepath.Join(tempDir, AuthSecretFilename)
	st, err := os.Stat(secretFile)
	if err != nil {
		t.Fatalf("expected secret file to exist: %v", err)
	}
	// Verify file is not empty
	if st.Size() == 0 {
		t.Fatal("secret file is empty")
	}

	// Verify secret() resolves sec1 in desktop mode
	activeSec, ok := SecretOK()
	if !ok || activeSec != sec1 {
		t.Fatalf("expected active secret to match %q, got %q (ok=%v)", sec1, activeSec, ok)
	}

	// 2. Reuse across restarts
	ResetDesktopSecretForTest()
	sec2, err := InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret second run failed: %v", err)
	}
	if sec2 != sec1 {
		t.Fatalf("expected persistent secret reuse, got %q != %q", sec2, sec1)
	}

	// 3. Env var precedence
	explicitEnvSecret := "explicit-env-secret-value-abcdef123456"
	t.Setenv("AUTH_SECRET", explicitEnvSecret)
	ResetDesktopSecretForTest()
	sec3, err := InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret with env var failed: %v", err)
	}
	if sec3 != explicitEnvSecret {
		t.Fatalf("expected env var precedence, got %q want %q", sec3, explicitEnvSecret)
	}
}

func TestInitDesktopAuthSecret_MalformedRefusal(t *testing.T) {
	ResetDesktopSecretForTest()
	tempDir := t.TempDir()
	secretFile := filepath.Join(tempDir, AuthSecretFilename)

	// Write empty/too short secret
	if err := os.WriteFile(secretFile, []byte("short-secret"), 0600); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	t.Setenv("AUTH_SECRET", "")
	_, err := InitDesktopAuthSecret(tempDir)
	if err == nil {
		t.Fatal("expected error on malformed/too short secret file, got nil")
	}
	if !strings.Contains(err.Error(), "refusal to silently overwrite") {
		t.Fatalf("unexpected error message: %v", err)
	}

	// Confirm file was NOT overwritten
	content, _ := os.ReadFile(secretFile)
	if string(content) != "short-secret" {
		t.Fatalf("file was overwritten! Content: %q", string(content))
	}
}

func TestSecretNotLeakedInLogs(t *testing.T) {
	ResetDesktopSecretForTest()
	tempDir := t.TempDir()
	t.Setenv("AUTH_SECRET", "")

	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	sec, err := InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret failed: %v", err)
	}

	logOutput := buf.String()
	if strings.Contains(logOutput, sec) {
		t.Fatalf("CRITICAL SECURITY: generated secret %q was leaked into log stream: %s", sec, logOutput)
	}
}

func TestServerModeUnsetAuthSecret(t *testing.T) {
	ResetDesktopSecretForTest()
	t.Setenv("AUTH_SECRET", "")

	// In server mode (non-desktop, no InitDesktopAuthSecret), SecretOK must return false
	sec, ok := SecretOK()
	if ok || sec != "" {
		t.Fatalf("expected unset AUTH_SECRET in server mode to return false and empty, got %q (ok=%v)", sec, ok)
	}
}

func TestValidateSecret_ErrorDoesNotLeakSuppliedSecret(t *testing.T) {
	sensitiveSuffix := "super-private-token-material-994821"
	attemptedSecret := "secret-" + sensitiveSuffix

	err := ValidateSecret(attemptedSecret)
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}

	errMsg := err.Error()
	if strings.Contains(errMsg, sensitiveSuffix) {
		t.Fatalf("CRITICAL SECURITY LEAK: validation error message exposed sensitive secret material: %s", errMsg)
	}
	if !strings.Contains(errMsg, `matching "secret"`) {
		t.Fatalf("expected error to name placeholder pattern, got: %s", errMsg)
	}
}

func TestInitDesktopAuthSecret_ConcurrentRace(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("AUTH_SECRET", "")

	const concurrency = 10
	var wg sync.WaitGroup
	secrets := make([]string, concurrency)
	errors := make([]error, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sec, err := InitDesktopAuthSecret(tempDir)
			secrets[idx] = sec
			errors[idx] = err
		}(i)
	}
	wg.Wait()

	for i, err := range errors {
		if err != nil {
			t.Fatalf("concurrent InitDesktopAuthSecret [%d] failed: %v", i, err)
		}
	}

	firstSecret := secrets[0]
	for i, sec := range secrets {
		if sec != firstSecret {
			t.Fatalf("concurrent secret mismatch at [%d]: %q != %q", i, sec, firstSecret)
		}
	}
}

func TestInitDesktopAuthSecret_FilePermissions(t *testing.T) {
	ResetDesktopSecretForTest()
	tempDir := t.TempDir()
	t.Setenv("AUTH_SECRET", "")

	sec, err := InitDesktopAuthSecret(tempDir)
	if err != nil {
		t.Fatalf("InitDesktopAuthSecret failed: %v", err)
	}
	if sec == "" {
		t.Fatal("empty secret")
	}

	secretFile := filepath.Join(tempDir, AuthSecretFilename)
	st, err := os.Stat(secretFile)
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}

	// On non-Windows platforms, verify permission is 0600
	if runtime.GOOS != "windows" {
		perm := st.Mode().Perm()
		if perm != 0600 {
			t.Fatalf("expected permissions 0600 on %s, got %04o", secretFile, perm)
		}
	}
}
