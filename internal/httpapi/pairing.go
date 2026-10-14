package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/desktop"
)

type pairingPayload struct {
	CloudURL string `json:"cloud_url"`
	Token    string `json:"token"`
}

type handshakeResult struct {
	OK         bool   `json:"ok"`
	TenantID   string `json:"tenant_id,omitempty"`
	ChurchName string `json:"church_name,omitempty"`
	DeviceID   string `json:"device_id,omitempty"`
}

func (s *Server) getDataDir() string {
	if s.DataDir != "" {
		return s.DataDir
	}
	dir, err := desktop.ResolveDataDir("", s.isDesktop())
	if err == nil && dir != "" {
		return dir
	}
	if s.Root != "" {
		return s.Root
	}
	return "data"
}

func (s *Server) getUploadsDir() string {
	if d := strings.TrimSpace(os.Getenv("UPLOADS_DIR")); d != "" {
		return d
	}
	return filepath.Join(s.getDataDir(), "uploads")
}

// GET /api/desktop/pairing
func (s *Server) getDesktopPairing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")

	dataDir := s.getDataDir()
	cfg, err := desktop.LoadPairingConfig(dataDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Error loading pairing config: %v", err))
		return
	}

	if cfg == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"paired": false,
		})
		return
	}

	var lastSyncedStr any = nil
	if !cfg.LastSyncedAt.IsZero() {
		lastSyncedStr = cfg.LastSyncedAt.Format(time.RFC3339)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"paired":         true,
		"version":        cfg.Version,
		"cloud_url":      cfg.CloudURL,
		"tenant_id":      cfg.TenantID,
		"church_name":    cfg.ChurchName,
		"device_id":      cfg.DeviceID,
		"token_masked":   desktop.MaskToken(cfg.Token),
		"paired_at":      cfg.PairedAt.Format(time.RFC3339),
		"last_synced_at": lastSyncedStr,
	})
}

// POST /api/desktop/pairing/test
// Tests connectivity and credentials against remote instance without persisting pairing config (Janji Opus T3).
func (s *Server) testDesktopPairing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	var body pairingPayload
	if err := json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	sanitizedURL, token, err := validatePairingInputs(body.CloudURL, body.Token)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := executeCloudHandshake(sanitizedURL, token)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"cloud_url":   sanitizedURL,
		"tenant_id":   res.TenantID,
		"church_name": res.ChurchName,
		"device_id":   res.DeviceID,
	})
}

// POST /api/desktop/pairing
// Validates, executes handshake, and atomically saves pairing.json.
func (s *Server) postDesktopPairing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	var body pairingPayload
	if err := json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	sanitizedURL, token, err := validatePairingInputs(body.CloudURL, body.Token)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := executeCloudHandshake(sanitizedURL, token)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	dataDir := s.getDataDir()
	cfg := &desktop.PairingConfig{
		Version:    1,
		CloudURL:   sanitizedURL,
		TenantID:   res.TenantID,
		ChurchName: res.ChurchName,
		DeviceID:   res.DeviceID,
		Token:      token,
		PairedAt:   time.Now().UTC(),
	}

	if err := desktop.SavePairingConfig(dataDir, cfg); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to save pairing: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"paired":      true,
		"cloud_url":   cfg.CloudURL,
		"tenant_id":   cfg.TenantID,
		"church_name": cfg.ChurchName,
	})
}

// DELETE /api/desktop/pairing
// Unpairs the device by clearing pairing.json. Does not delete local presentation data.
func (s *Server) deleteDesktopPairing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	dataDir := s.getDataDir()
	if err := desktop.ClearPairingConfig(dataDir); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to unpair: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"paired": false,
	})
}

func validatePairingInputs(rawURL, rawToken string) (string, string, error) {
	sanitizedURL, err := desktop.SanitizeCloudURL(rawURL)
	if err != nil {
		return "", "", fmt.Errorf("invalid cloud URL: %w", err)
	}

	token := strings.TrimSpace(rawToken)
	if !desktop.ValidatePairingToken(token) {
		return "", "", errors.New("invalid pairing token format: token must match foh_<id>.<secret>")
	}

	return sanitizedURL, token, nil
}

func executeCloudHandshake(cloudURL, token string) (*handshakeResult, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	statusURL := cloudURL + "/api/sync/status"
	req, err := http.NewRequest("GET", statusURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating handshake request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "WorshipDeck-FOH-Client/0.2.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("alamat cloud tidak dapat dijangkau: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, errors.New("token pairing tidak diterima atau telah dicabut oleh pengelola cloud")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cloud instance mengembalikan status HTTP %d", resp.StatusCode)
	}

	var statusData struct {
		OK         bool   `json:"ok"`
		TenantID   string `json:"tenant_id"`
		ChurchName string `json:"church_name"`
		DeviceID   string `json:"device_id"`
	}

	if err := json.NewDecoder(io.LimitReader(resp.Body, 16384)).Decode(&statusData); err != nil {
		return nil, fmt.Errorf("parsing respon status cloud: %w", err)
	}

	churchName := strings.TrimSpace(statusData.ChurchName)
	if churchName == "" {
		churchName = "WorshipDeck Sanctuary"
	}

	tenantID := strings.TrimSpace(statusData.TenantID)
	if tenantID == "" {
		parts := strings.SplitN(token, ".", 2)
		tenantID = strings.TrimPrefix(parts[0], "foh_")
	}

	return &handshakeResult{
		OK:         true,
		TenantID:   tenantID,
		ChurchName: churchName,
		DeviceID:   statusData.DeviceID,
	}, nil
}
