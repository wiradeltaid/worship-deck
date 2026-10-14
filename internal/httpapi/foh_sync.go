package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/desktop"
)

var uploadHashRegex = regexp.MustCompile(`(?i)(?:/api/uploads/|uploads/)?([a-fA-F0-9]{32}|[a-fA-F0-9]{64})\.([a-zA-Z0-9]+)`)

// POST /api/desktop/sync/pull-cloud
// Invariant K-FREEZE-01: F(t) => Psync(t) forbidden. Rejects with 409 if presenter is active.
// Invariant K2-01..K3-02: Atomically pulls mutations and streams missing media with SHA-256 verification.
func (s *Server) pullCloudSync(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	// 1. In-Flight Service Freeze Invariant (Kernel K-FREEZE-01 / K4-03)
	releaseSync, ok := globalRemoteHub.TryAcquireSyncLock()
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]string{
				"code":    "presenter_active",
				"message": "Sinkronisasi ditahan selama sesi presentasi.",
			},
		})
		return
	}
	defer releaseSync()

	// 2. Load pairing configuration
	dataDir := s.getDataDir()
	cfg, err := desktop.LoadPairingConfig(dataDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Error loading pairing config: %v", err))
		return
	}
	if cfg == nil {
		writeError(w, http.StatusBadRequest, "Aplikasi FOH belum terhubung ke workspace cloud")
		return
	}

	startTime := time.Now()

	// 3. Issue authenticated pull request to remote cloud instance (outside of SQLite transaction, Kernel K2-02)
	pullURL := fmt.Sprintf("%s/api/sync/pull", strings.TrimRight(cfg.CloudURL, "/"))
	client := &http.Client{Timeout: 60 * time.Second}

	req, err := http.NewRequestWithContext(r.Context(), "GET", pullURL, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Creating pull request: %v", err))
		return
	}
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "WorshipDeck-FOH-Sync/0.2.0")

	resp, err := client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("Gagal menghubungi cloud workspace: %v", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		writeError(w, http.StatusUnauthorized, "Token pairing ditolak atau telah dicabut oleh cloud workspace")
		return
	}
	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("Cloud instance mengembalikan HTTP %d", resp.StatusCode))
		return
	}

	var pullData struct {
		ServerTimestamp string          `json:"server_timestamp"`
		Cursor          string          `json:"cursor"`
		Changes         SyncMutations   `json:"changes"`
		Tombstones      []SyncTombstone `json:"tombstones"`
	}

	if err := json.NewDecoder(io.LimitReader(resp.Body, 50<<20)).Decode(&pullData); err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("Parsing sync pull response: %v", err))
		return
	}

	// 4. Discover referenced media asset hashes and download missing files (Kernel K3-01)
	upDir := uploadsDir()
	if err := os.MkdirAll(upDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Creating uploads dir: %v", err))
		return
	}

	assetHashes := extractAllAssetHashes(&pullData.Changes)
	downloadedCount := 0
	var bytesTransferred int64

	for _, assetItem := range assetHashes {
		// Check if asset already exists on disk
		if existing, err := findAssetBySHA256(upDir, assetItem.Hash); err == nil && existing != "" {
			continue // Already present
		}

		// Download asset and verify streaming SHA-256
		downloadURL := fmt.Sprintf("%s/api/sync/assets/%s", strings.TrimRight(cfg.CloudURL, "/"), assetItem.Hash)
		writtenBytes, err := downloadAndVerifyMediaAsset(r.Context(), client, downloadURL, cfg.Token, assetItem.Hash, assetItem.Ext, upDir)
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("Verifikasi integritas aset gagal (%s): %v", assetItem.Hash, err))
			return
		}
		downloadedCount++
		bytesTransferred += writtenBytes
	}

	// 5. Apply mutations inside atomic SQLite transaction (Kernel K2-02, K2-03)
	conn, err := s.DB.Conn(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Connecting to database: %v", err))
		return
	}
	defer conn.Close()

	if _, err := conn.ExecContext(r.Context(), `PRAGMA foreign_keys = ON;`); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Enforcing foreign keys: %v", err))
		return
	}

	if _, err := conn.ExecContext(r.Context(), `BEGIN IMMEDIATE;`); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Starting immediate transaction: %v", err))
		return
	}

	committed := false
	defer func() {
		if !committed {
			_, _ = conn.ExecContext(r.Context(), `ROLLBACK;`)
		}
	}()

	nowStr := time.Now().UTC().Format(time.RFC3339Nano)

	// Apply services
	servicesCount := 0
	for _, svc := range pullData.Changes.Services {
		if svc.GlobalID == "" || isTombstoned(r.Context(), conn, svc.GlobalID) {
			continue
		}
		createdTime := nowStr
		if svc.CreatedAt != "" {
			createdTime = svc.CreatedAt
		}
		updatedTime := nowStr
		if svc.UpdatedAt != "" {
			updatedTime = svc.UpdatedAt
		}
		hiddenStr := "[]"
		if len(svc.HiddenSlideIDs) > 0 {
			hiddenStr = string(svc.HiddenSlideIDs)
		}
		emergencyStr := "[]"
		if len(svc.EmergencyPatches) > 0 {
			emergencyStr = string(svc.EmergencyPatches)
		}

		_, err := conn.ExecContext(r.Context(), `
			INSERT INTO services (global_id, date, raw_payload, parsed_data, images_payload, afternoon_program, hidden_slide_ids, emergency_patches, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				date = excluded.date,
				raw_payload = excluded.raw_payload,
				parsed_data = excluded.parsed_data,
				images_payload = excluded.images_payload,
				afternoon_program = excluded.afternoon_program,
				hidden_slide_ids = excluded.hidden_slide_ids,
				emergency_patches = excluded.emergency_patches,
				updated_at = excluded.updated_at
		`, svc.GlobalID, svc.Date, svc.RawPayload, string(svc.ParsedData), string(svc.ImagesPayload), svc.AfternoonProgram, hiddenStr, emergencyStr, createdTime, updatedTime)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Upserting service %s: %v", svc.GlobalID, err))
			return
		}
		servicesCount++
	}

	// Apply hymns
	hymnsCount := 0
	for _, h := range pullData.Changes.Hymns {
		if h.GlobalID == "" || isTombstoned(r.Context(), conn, h.GlobalID) {
			continue
		}
		_, err := conn.ExecContext(r.Context(), `
			INSERT INTO hymns (global_id, book_code, number, title, lyrics)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				book_code = excluded.book_code,
				number = excluded.number,
				title = excluded.title,
				lyrics = excluded.lyrics
		`, h.GlobalID, h.BookCode, h.Number, h.Title, h.Lyrics)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Upserting hymn %s: %v", h.GlobalID, err))
			return
		}
		hymnsCount++
	}

	// Apply background library images
	for _, bg := range pullData.Changes.BackgroundLibraryImages {
		if bg.GlobalID == "" || isTombstoned(r.Context(), conn, bg.GlobalID) {
			continue
		}
		bgUpdated := nowStr
		if bg.UpdatedAt != "" {
			bgUpdated = bg.UpdatedAt
		}
		isDef := 0
		if bg.IsDefault {
			isDef = 1
		}
		_, err := conn.ExecContext(r.Context(), `
			INSERT INTO background_library_images (global_id, url, name, is_default, category, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				url = excluded.url,
				name = excluded.name,
				is_default = excluded.is_default,
				category = excluded.category,
				updated_at = excluded.updated_at
		`, bg.GlobalID, bg.URL, bg.Name, isDef, bg.Category, bgUpdated, bgUpdated)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Upserting background image %s: %v", bg.GlobalID, err))
			return
		}
	}

	// Apply tombstones
	for _, t := range pullData.Tombstones {
		if t.GlobalID == "" {
			continue
		}
		delTime := nowStr
		if t.DeletedAt != "" {
			delTime = t.DeletedAt
		}
		_, _ = conn.ExecContext(r.Context(), `
			INSERT OR REPLACE INTO sync_tombstones (global_id, entity_type, deleted_at)
			VALUES (?, ?, ?)
		`, t.GlobalID, t.EntityType, delTime)

		switch t.EntityType {
		case "service":
			_, _ = conn.ExecContext(r.Context(), `DELETE FROM services WHERE global_id = ?`, t.GlobalID)
		case "hymn":
			_, _ = conn.ExecContext(r.Context(), `DELETE FROM hymns WHERE global_id = ?`, t.GlobalID)
		case "background_image", "background_library_image", "background_library_images":
			_, _ = conn.ExecContext(r.Context(), `DELETE FROM background_library_images WHERE global_id = ?`, t.GlobalID)
		}
	}

	// Update sync cursor state in DB
	_, _ = conn.ExecContext(r.Context(), `
		INSERT OR REPLACE INTO sync_state (key, value, updated_at)
		VALUES ('last_cloud_pull_cursor', ?, ?)
	`, pullData.Cursor, nowStr)

	// Commit SQLite transaction atomically (Kernel K2-02)
	if _, err := conn.ExecContext(r.Context(), `COMMIT;`); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Committing sync transaction: %v", err))
		return
	}
	committed = true

	// 6. Update pairing config timestamp (Kernel K1-01)
	cfg.PairedAt = time.Now().UTC()
	_ = desktop.SavePairingConfig(dataDir, cfg)

	durationMs := time.Since(startTime).Milliseconds()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"services_count":    servicesCount,
		"hymns_count":       hymnsCount,
		"assets_downloaded": downloadedCount,
		"bytes_transferred": bytesTransferred,
		"duration_ms":       durationMs,
		"last_synced_at":    nowStr,
	})
}

type assetRef struct {
	Hash string
	Ext  string
}

func extractAllAssetHashes(mutations *SyncMutations) []assetRef {
	seen := make(map[string]assetRef)

	addMatch := func(val string) {
		matches := uploadHashRegex.FindAllStringSubmatch(val, -1)
		for _, m := range matches {
			if len(m) >= 3 {
				hash := strings.ToLower(m[1])
				ext := strings.ToLower(m[2])
				if _, ok := seen[hash]; !ok {
					seen[hash] = assetRef{Hash: hash, Ext: ext}
				}
			}
		}
	}

	for _, bg := range mutations.BackgroundLibraryImages {
		addMatch(bg.URL)
	}
	for _, it := range mutations.AnnouncementItems {
		addMatch(it.ImageURL)
	}
	for _, svc := range mutations.Services {
		addMatch(string(svc.ImagesPayload))
		addMatch(svc.RawPayload)
	}
	for _, slide := range mutations.AnnouncementSetSlides {
		addMatch(slide.Payload)
	}
	for _, tmpl := range mutations.ArtifactTemplates {
		if tmpl.Payload != nil {
			addMatch(*tmpl.Payload)
		}
	}

	result := make([]assetRef, 0, len(seen))
	for _, ref := range seen {
		result = append(result, ref)
	}
	return result
}

func downloadAndVerifyMediaAsset(ctx context.Context, client *http.Client, url, token, expectedHash, ext, uploadsDir string) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("creating asset request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("downloading asset from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("asset server returned HTTP %d", resp.StatusCode)
	}

	nonce := time.Now().UnixNano()
	tmpFilename := fmt.Sprintf(".tmp_%s_%d", expectedHash, nonce)
	tmpPath := filepath.Join(uploadsDir, tmpFilename)

	tmpFile, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return 0, fmt.Errorf("creating temp asset file: %w", err)
	}

	hasher := sha256.New()
	tee := io.TeeReader(resp.Body, hasher)

	written, err := io.Copy(tmpFile, tee)
	_ = tmpFile.Close()

	if err != nil {
		_ = os.Remove(tmpPath)
		return 0, fmt.Errorf("streaming asset payload: %w", err)
	}

	// Invariant K3-01: Verify computed SHA-256 digest on-the-fly
	computedHash := hex.EncodeToString(hasher.Sum(nil))
	if !strings.EqualFold(computedHash, expectedHash) {
		_ = os.Remove(tmpPath)
		return 0, fmt.Errorf("checksum mismatch: expected %s, computed %s", expectedHash, computedHash)
	}

	// Safe default extension if missing
	if ext == "" {
		ext = "bin"
	}
	finalFilename := fmt.Sprintf("%s.%s", expectedHash, ext)
	finalPath := filepath.Join(uploadsDir, finalFilename)

	// Atomic rename to final uploads destination
	if err := os.Rename(tmpPath, finalPath); err != nil {
		_ = os.Remove(tmpPath)
		return 0, fmt.Errorf("publishing verified asset: %w", err)
	}

	return written, nil
}
