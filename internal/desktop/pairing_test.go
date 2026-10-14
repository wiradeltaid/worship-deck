package desktop

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestValidatePairingToken(t *testing.T) {
	// Valid token: foh_<id>.<32-byte-base64url (43 chars)>
	validSecret := "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8" // 43 chars
	validToken := "foh_tenant123." + validSecret
	if !ValidatePairingToken(validToken) {
		t.Errorf("expected valid token %q to pass validation", validToken)
	}

	// Invalid tokens
	invalidTokens := []string{
		"",
		"foh_",
		"foh_tenant123",
		"foh_tenant123.",
		"foh_tenant123.short",
		"foh_tenant123." + validSecret + "extra",
		"bearer_tenant123." + validSecret,
		"foh_tenant 123." + validSecret,
		"foh_tenant123." + validSecret + "!@#",
	}

	for _, inv := range invalidTokens {
		if ValidatePairingToken(inv) {
			t.Errorf("expected invalid token %q to fail validation", inv)
		}
	}
}

func TestMaskToken(t *testing.T) {
	token := "foh_tenant123.7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"
	masked := MaskToken(token)
	if !strings.HasPrefix(masked, "foh_tenant123.") {
		t.Errorf("masked token should preserve prefix, got %q", masked)
	}
	if strings.Contains(masked, "7f8a9b0c") {
		t.Errorf("masked token should NOT contain secret, got %q", masked)
	}
	if !strings.HasSuffix(masked, "********") {
		t.Errorf("masked token should end with ********, got %q", masked)
	}

	// Empty or non-token
	if MaskToken("") != "" {
		t.Errorf("expected empty mask for empty token")
	}
}

func TestPairingConfig_SaveAndLoad(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "worshipdeck-pairing-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Initially not paired
	cfg, err := LoadPairingConfig(tempDir)
	if err != nil {
		t.Fatalf("unexpected error loading non-existent pairing: %v", err)
	}
	if cfg != nil {
		t.Fatalf("expected nil config for un-paired state, got %+v", cfg)
	}

	// Save new config
	now := time.Now().UTC().Truncate(time.Second)
	newCfg := &PairingConfig{
		Version:    1,
		CloudURL:   "https://gereja-anda.worshipdeck.org",
		TenantID:   "tenant_01J9X4T7M5",
		ChurchName: "Gereja Contoh Sintetis",
		DeviceID:   "dev_foh_01",
		Token:      "foh_tenant_01J9X4T7M5.7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
		PairedAt:   now,
	}

	if err := SavePairingConfig(tempDir, newCfg); err != nil {
		t.Fatalf("failed to save pairing config: %v", err)
	}

	// Verify file exists and check file permissions
	targetPath := filepath.Join(tempDir, PairingFileName)
	fi, err := os.Stat(targetPath)
	if err != nil {
		t.Fatalf("pairing file was not created: %v", err)
	}
	// On Unix, check mode 0600
	if runtime.GOOS != "windows" && fi.Mode().Perm()&0077 != 0 {
		t.Errorf("expected file perm 0600 or stricter, got %o", fi.Mode().Perm())
	}

	// Load and compare
	loaded, err := LoadPairingConfig(tempDir)
	if err != nil {
		t.Fatalf("failed to load saved pairing config: %v", err)
	}
	if loaded == nil {
		t.Fatal("expected loaded config, got nil")
	}
	if loaded.CloudURL != newCfg.CloudURL {
		t.Errorf("CloudURL mismatch: got %q, want %q", loaded.CloudURL, newCfg.CloudURL)
	}
	if loaded.TenantID != newCfg.TenantID {
		t.Errorf("TenantID mismatch: got %q, want %q", loaded.TenantID, newCfg.TenantID)
	}
	if loaded.Token != newCfg.Token {
		t.Errorf("Token mismatch: got %q, want %q", loaded.Token, newCfg.Token)
	}

	// Clear pairing
	if err := ClearPairingConfig(tempDir); err != nil {
		t.Fatalf("failed to clear pairing: %v", err)
	}
	if _, err := os.Stat(targetPath); !os.IsNotExist(err) {
		t.Errorf("expected pairing file to be removed, got err=%v", err)
	}

	// Loading again yields nil
	loadedAgain, err := LoadPairingConfig(tempDir)
	if err != nil || loadedAgain != nil {
		t.Errorf("expected nil after clear, got cfg=%v, err=%v", loadedAgain, err)
	}
}

func TestSanitizeCloudURL(t *testing.T) {
	cases := []struct {
		input    string
		expected string
		wantErr  bool
	}{
		{"https://gereja-anda.worshipdeck.org", "https://gereja-anda.worshipdeck.org", false},
		{"https://gereja-anda.worshipdeck.org/", "https://gereja-anda.worshipdeck.org", false},
		{"gereja-anda.worshipdeck.org", "https://gereja-anda.worshipdeck.org", false},
		{"http://127.0.0.1:8080", "http://127.0.0.1:8080", false}, // Allowed for local testing
		{"http://localhost:3000", "http://localhost:3000", false}, // Allowed for local testing
		{"http://remote-server.com", "", true},                     // Insecure HTTP to remote host rejected
		{"https://user:pass@evil.com", "", true},                   // Userinfo rejected
		{"", "", true},
	}

	for _, tc := range cases {
		out, err := SanitizeCloudURL(tc.input)
		if tc.wantErr && err == nil {
			t.Errorf("expected error for input %q, got output %q", tc.input, out)
		}
		if !tc.wantErr && err != nil {
			t.Errorf("unexpected error for input %q: %v", tc.input, err)
		}
		if !tc.wantErr && out != tc.expected {
			t.Errorf("for input %q, got %q, want %q", tc.input, out, tc.expected)
		}
	}
}
