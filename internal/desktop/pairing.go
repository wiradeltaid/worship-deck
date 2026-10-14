package desktop

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// PairingFileName is the standard filename for FOH cloud pairing configuration.
const PairingFileName = "pairing.json"

// PairingConfig represents the persistent FOH device pairing state.
// Invariant K1-01: Stored strictly in application data directory, NEVER in repository or git.
type PairingConfig struct {
	Version      int       `json:"version"` // Schema version (1)
	CloudURL     string    `json:"cloud_url"`
	TenantID     string    `json:"tenant_id"`
	ChurchName   string    `json:"church_name,omitempty"`
	DeviceID     string    `json:"device_id,omitempty"`
	Token        string    `json:"token"` // Full bearer token for internal FOH backend requests
	PairedAt     time.Time `json:"paired_at"`
	LastSyncedAt time.Time `json:"last_synced_at,omitempty"`
}

// pairingTokenRegex enforces ODR-019 / K1-02 token format:
// foh_<id>.<32-byte-base64url (43 chars)>
var pairingTokenRegex = regexp.MustCompile(`^foh_([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$`)

// ValidatePairingToken checks if the provided string matches canonical FOH token specification.
func ValidatePairingToken(token string) bool {
	token = strings.TrimSpace(token)
	return pairingTokenRegex.MatchString(token)
}

// MaskToken produces a safe masked preview of a pairing token (e.g. "foh_01J9X4T7M5.********").
// Invariant K1-05: The secret portion is never exposed in UI responses, logs, or telemetry.
func MaskToken(token string) string {
	token = strings.TrimSpace(token)
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "foh_") {
		return ""
	}
	return parts[0] + ".********"
}

// SanitizeCloudURL normalizes and validates a cloud workplace URL.
// Invariant K1-02: Enforces HTTPS for remote hosts (allowing HTTP only for 127.0.0.1/localhost testing).
// Strips trailing slashes, rejects userinfo, query strings, and fragments.
func SanitizeCloudURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("cloud URL cannot be empty")
	}

	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		raw = "https://" + raw
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("parsing URL: %w", err)
	}

	if parsed.User != nil {
		return "", errors.New("userinfo in cloud URL is forbidden")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("query strings and fragments in cloud URL are forbidden")
	}

	host := parsed.Hostname()
	if host == "" {
		return "", errors.New("invalid hostname in cloud URL")
	}

	isLocal := host == "127.0.0.1" || host == "localhost" || strings.HasSuffix(host, ".local")
	if !isLocal && parsed.Scheme != "https" {
		return "", errors.New("remote cloud instances must use secure HTTPS")
	}

	// Canonical scheme + host + optional port
	port := parsed.Port()
	if port != "" && !(parsed.Scheme == "https" && port == "443") && !(parsed.Scheme == "http" && port == "80") {
		return fmt.Sprintf("%s://%s:%s", parsed.Scheme, host, port), nil
	}

	return fmt.Sprintf("%s://%s", parsed.Scheme, host), nil
}

// LoadPairingConfig loads the pairing configuration from dataDir.
// Returns nil, nil if no pairing file exists.
func LoadPairingConfig(dataDir string) (*PairingConfig, error) {
	if dataDir == "" {
		return nil, errors.New("data directory is not configured")
	}

	filePath := filepath.Join(dataDir, PairingFileName)
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading pairing config: %w", err)
	}

	var cfg PairingConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing pairing config JSON: %w", err)
	}

	return &cfg, nil
}

// SavePairingConfig atomically writes the pairing configuration with restricted permissions.
// Invariant K1-04: Atomic replacement via temporary file with 0600 permissions.
func SavePairingConfig(dataDir string, cfg *PairingConfig) error {
	if dataDir == "" {
		return errors.New("data directory is not configured")
	}
	if cfg == nil {
		return errors.New("cannot save nil pairing configuration")
	}

	if err := EnsureDataDir(dataDir); err != nil {
		return fmt.Errorf("ensuring data dir: %w", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling pairing config: %w", err)
	}

	targetPath := filepath.Join(dataDir, PairingFileName)
	tmpPath := filepath.Join(dataDir, fmt.Sprintf(".tmp_pairing_%d.json", time.Now().UnixNano()))

	// Write with 0600 permissions
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("writing temporary pairing file: %w", err)
	}

	// Atomic rename to final path
	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("atomically replacing pairing config: %w", err)
	}

	return nil
}

// ClearPairingConfig deletes the pairing configuration file.
func ClearPairingConfig(dataDir string) error {
	if dataDir == "" {
		return nil
	}
	filePath := filepath.Join(dataDir, PairingFileName)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("clearing pairing config: %w", err)
	}
	return nil
}
