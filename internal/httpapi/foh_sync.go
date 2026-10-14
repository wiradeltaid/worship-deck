package httpapi

import (
	"context"
	"crypto/sha256"
	"database/sql"
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

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/desktop"
)

var uploadHashRegex = regexp.MustCompile(`(?i)(?:/api/uploads/|uploads/)?([a-fA-F0-9]{32}|[a-fA-F0-9]{64})\.([a-zA-Z0-9]+)`)

// POST /api/desktop/sync/pull-cloud
// Invariant K-FREEZE-01: F(t) => Psync(t) forbidden. Rejects with 409 if presenter is active.
// Invariant K2-01..K3-02: Atomically pulls mutations and streams missing media with SHA-256 verification.
// Invariant K2-04: Dirty local state holds pull (409 local_changes_pending).
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

	// 2. Invariant K2-04: Dirty local emergency changes hold pull
	var dirtyCount int
	err := s.DB.QueryRowContext(r.Context(), `
		SELECT count(*) FROM services
		WHERE emergency_patches IS NOT NULL
		  AND emergency_patches != ''
		  AND emergency_patches != '[]'
	`).Scan(&dirtyCount)
	if err == nil && dirtyCount > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]string{
				"code":    "local_changes_pending",
				"message": "Ada perubahan darurat lokal yang belum tersinkron ke cloud.",
			},
		})
		return
	}

	// 3. Load pairing configuration
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

	// 4. Issue authenticated pull request to remote cloud instance (outside of SQLite transaction, Kernel K2-02)
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

	// 5. Discover referenced media asset hashes and download missing files into desktop uploads dir (Kernel K3-01 / Finding 3)
	upDir := s.getUploadsDir()
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

	// 6. Apply all mutations inside atomic SQLite transaction (Kernel K2-01, K2-02, K2-03 / Finding 1)
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

	// Apply complete mutation batch across all 11 categories + tombstones (Finding 1)
	appliedCount, err := applyFullFohSyncMutations(r.Context(), conn, &pullData.Changes, pullData.Tombstones, nowStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Applying sync mutations: %v", err))
		return
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

	// 7. Update pairing config with LastSyncedAt without altering PairedAt (Kernel K1-01 / Finding 5)
	cfg.LastSyncedAt = time.Now().UTC()
	_ = desktop.SavePairingConfig(dataDir, cfg)

	durationMs := time.Since(startTime).Milliseconds()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"services_count":    len(pullData.Changes.Services),
		"hymns_count":       len(pullData.Changes.Hymns),
		"applied_count":     appliedCount,
		"assets_downloaded": downloadedCount,
		"bytes_transferred": bytesTransferred,
		"duration_ms":       durationMs,
		"last_synced_at":    nowStr,
	})
}

func applyFullFohSyncMutations(ctx context.Context, conn *sql.Conn, mutations *SyncMutations, tombstones []SyncTombstone, nowStr string) (int, error) {
	appliedCount := 0

	// 1. Services
	for _, svc := range mutations.Services {
		if svc.GlobalID == "" || svc.Date == "" || isTombstoned(ctx, conn, svc.GlobalID) {
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

		_, err := conn.ExecContext(ctx, `
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
			return appliedCount, fmt.Errorf("upserting service %s: %w", svc.GlobalID, err)
		}
		appliedCount++
	}

	// 2. Announcement Sets (Parent entity)
	for _, set := range mutations.AnnouncementSets {
		if set.GlobalID == "" || isTombstoned(ctx, conn, set.GlobalID) {
			continue
		}
		setUpdated := nowStr
		if set.UpdatedAt != "" {
			setUpdated = set.UpdatedAt
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO announcement_sets (global_id, label, updated_at)
			VALUES (?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				label = excluded.label,
				updated_at = excluded.updated_at
		`, set.GlobalID, set.Label, setUpdated)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting announcement set %s: %w", set.GlobalID, err)
		}
		appliedCount++
	}

	// 3. Announcement Set Slides (Child entity of AnnouncementSets)
	for _, slide := range mutations.AnnouncementSetSlides {
		if slide.GlobalID == "" || slide.AnnSetGlobalID == "" || isTombstoned(ctx, conn, slide.GlobalID) {
			continue
		}
		var annSetID int
		err := conn.QueryRowContext(ctx, `SELECT id FROM announcement_sets WHERE global_id = ?`, slide.AnnSetGlobalID).Scan(&annSetID)
		if err == sql.ErrNoRows {
			continue // Skip unresolved announcement set slide
		} else if err != nil {
			return appliedCount, fmt.Errorf("resolving announcement set %s: %w", slide.AnnSetGlobalID, err)
		}

		slideUpdated := nowStr
		if slide.UpdatedAt != "" {
			slideUpdated = slide.UpdatedAt
		}
		_, err = conn.ExecContext(ctx, `
			INSERT INTO announcement_set_slides (global_id, ann_set_id, ann_set_global_id, label, payload, position, updated_at, seed_hash)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				ann_set_id = excluded.ann_set_id,
				ann_set_global_id = excluded.ann_set_global_id,
				label = excluded.label,
				payload = excluded.payload,
				position = excluded.position,
				updated_at = excluded.updated_at,
				seed_hash = excluded.seed_hash
		`, slide.GlobalID, annSetID, slide.AnnSetGlobalID, slide.Label, slide.Payload, slide.Position, slideUpdated, slide.SeedHash)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting announcement set slide %s: %w", slide.GlobalID, err)
		}
		appliedCount++
	}

	// 4. Artifact Templates
	for _, tmpl := range mutations.ArtifactTemplates {
		if tmpl.ID == "" || tmpl.BaseType == "" || isTombstoned(ctx, conn, tmpl.ID) {
			continue
		}
		var annSetID any = nil
		if tmpl.AnnSetGlobalID != nil && *tmpl.AnnSetGlobalID != "" {
			var sid int
			err := conn.QueryRowContext(ctx, `SELECT id FROM announcement_sets WHERE global_id = ?`, *tmpl.AnnSetGlobalID).Scan(&sid)
			if err == nil {
				annSetID = sid
			}
		}
		tmplUpdated := nowStr
		if tmpl.UpdatedAt != "" {
			tmplUpdated = tmpl.UpdatedAt
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position, variable_name, ann_set_id, ann_set_global_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				label = excluded.label,
				base_type = excluded.base_type,
				payload = excluded.payload,
				updated_at = excluded.updated_at,
				seed_hash = excluded.seed_hash,
				position = excluded.position,
				variable_name = excluded.variable_name,
				ann_set_id = excluded.ann_set_id,
				ann_set_global_id = excluded.ann_set_global_id
		`, tmpl.ID, tmpl.Label, tmpl.BaseType, tmpl.Payload, tmplUpdated, tmpl.SeedHash, tmpl.Position, tmpl.VariableName, annSetID, tmpl.AnnSetGlobalID)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting artifact template %s: %w", tmpl.ID, err)
		}
		appliedCount++
	}

	// 5. Service Registry Snapshots
	for _, snap := range mutations.ServiceRegistrySnapshots {
		if snap.ServiceGlobalID == "" || snap.TemplateID == "" || isTombstoned(ctx, conn, snap.TemplateID) || isTombstoned(ctx, conn, snap.ServiceGlobalID) {
			continue
		}
		var serviceID int
		err := conn.QueryRowContext(ctx, `SELECT id FROM services WHERE global_id = ?`, snap.ServiceGlobalID).Scan(&serviceID)
		if err != nil {
			continue // Unresolved service
		}
		var annSetID any = nil
		if snap.AnnSetGlobalID != nil && *snap.AnnSetGlobalID != "" {
			var sid int
			if err := conn.QueryRowContext(ctx, `SELECT id FROM announcement_sets WHERE global_id = ?`, *snap.AnnSetGlobalID).Scan(&sid); err == nil {
				annSetID = sid
			}
		}
		snapUpdated := nowStr
		if snap.UpdatedAt != "" {
			snapUpdated = snap.UpdatedAt
		}
		_, err = conn.ExecContext(ctx, `
			INSERT INTO service_registry_snapshots (service_id, service_global_id, template_id, position, label, base_type, payload, updated_at, variable_name, ann_set_id, ann_set_global_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(service_id, template_id) DO UPDATE SET
				service_global_id = excluded.service_global_id,
				position = excluded.position,
				label = excluded.label,
				base_type = excluded.base_type,
				payload = excluded.payload,
				updated_at = excluded.updated_at,
				variable_name = excluded.variable_name,
				ann_set_id = excluded.ann_set_id,
				ann_set_global_id = excluded.ann_set_global_id
		`, serviceID, snap.ServiceGlobalID, snap.TemplateID, snap.Position, snap.Label, snap.BaseType, snap.Payload, snapUpdated, snap.VariableName, annSetID, snap.AnnSetGlobalID)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting registry snapshot %s: %w", snap.TemplateID, err)
		}
		appliedCount++
	}

	// 6. Song Set Layouts
	for _, layout := range mutations.SongSetLayouts {
		if layout.Role == "" || isTombstoned(ctx, conn, layout.Role) {
			continue
		}
		layoutUpdated := nowStr
		if layout.UpdatedAt != "" {
			layoutUpdated = layout.UpdatedAt
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO song_set_layouts (role, payload, updated_at, seed_hash)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(role) DO UPDATE SET
				payload = excluded.payload,
				updated_at = excluded.updated_at,
				seed_hash = excluded.seed_hash
		`, layout.Role, layout.Payload, layoutUpdated, layout.SeedHash)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting song set layout %s: %w", layout.Role, err)
		}
		appliedCount++
	}

	// 7. Service Song Set Layouts
	for _, sLayout := range mutations.ServiceSongSetLayouts {
		if sLayout.ServiceGlobalID == "" || sLayout.Role == "" || isTombstoned(ctx, conn, sLayout.ServiceGlobalID) {
			continue
		}
		var serviceID int
		err := conn.QueryRowContext(ctx, `SELECT id FROM services WHERE global_id = ?`, sLayout.ServiceGlobalID).Scan(&serviceID)
		if err != nil {
			continue // Unresolved service
		}
		sLayoutUpdated := nowStr
		if sLayout.UpdatedAt != "" {
			sLayoutUpdated = sLayout.UpdatedAt
		}
		_, err = conn.ExecContext(ctx, `
			INSERT INTO service_song_set_layouts (service_id, service_global_id, role, payload, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(service_id, role) DO UPDATE SET
				service_global_id = excluded.service_global_id,
				payload = excluded.payload,
				updated_at = excluded.updated_at
		`, serviceID, sLayout.ServiceGlobalID, sLayout.Role, sLayout.Payload, sLayoutUpdated)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting service song set layout: %w", err)
		}
		appliedCount++
	}

	// 8. Hymns
	for _, hymn := range mutations.Hymns {
		if hymn.GlobalID == "" || hymn.Number <= 0 || isTombstoned(ctx, conn, hymn.GlobalID) {
			continue
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO hymns (global_id, book_code, number, title, lyrics)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(book_code, number) DO UPDATE SET
				global_id = excluded.global_id,
				title = excluded.title,
				lyrics = excluded.lyrics
		`, hymn.GlobalID, hymn.BookCode, hymn.Number, hymn.Title, hymn.Lyrics)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting hymn %s: %w", hymn.GlobalID, err)
		}
		appliedCount++
	}

	// 9. Song Set Entries
	for _, sse := range mutations.SongSetEntries {
		if sse.GlobalID == "" || sse.VariableName == "" || isTombstoned(ctx, conn, sse.GlobalID) {
			continue
		}
		sseUpdated := nowStr
		if sse.UpdatedAt != "" {
			sseUpdated = sse.UpdatedAt
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO song_set_entries (global_id, variable_name, title, position, updated_at, extraction_regex)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				variable_name = excluded.variable_name,
				title = excluded.title,
				position = excluded.position,
				updated_at = excluded.updated_at,
				extraction_regex = excluded.extraction_regex
		`, sse.GlobalID, sse.VariableName, sse.Title, sse.Position, sseUpdated, sse.ExtractionRegex)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting song set entry %s: %w", sse.GlobalID, err)
		}
		appliedCount++
	}

	// 10. Background Library Images
	for _, img := range mutations.BackgroundLibraryImages {
		if img.GlobalID == "" || img.URL == "" || isTombstoned(ctx, conn, img.GlobalID) {
			continue
		}
		isDefInt := 0
		if img.IsDefault {
			isDefInt = 1
		}
		imgUpdated := nowStr
		if img.UpdatedAt != "" {
			imgUpdated = img.UpdatedAt
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO background_library_images (global_id, url, name, is_default, category, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				url = excluded.url,
				name = excluded.name,
				is_default = excluded.is_default,
				category = excluded.category,
				updated_at = excluded.updated_at
		`, img.GlobalID, img.URL, img.Name, isDefInt, img.Category, imgUpdated, imgUpdated)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting background image: %w", err)
		}
		appliedCount++
	}

	// 11. Announcement Items
	for _, item := range mutations.AnnouncementItems {
		if item.GlobalID == "" || item.ImageURL == "" || isTombstoned(ctx, conn, item.GlobalID) {
			continue
		}
		var localServiceID any = nil
		if item.ServiceGlobalID != nil && *item.ServiceGlobalID != "" {
			var sid int
			if err := conn.QueryRowContext(ctx, `SELECT id FROM services WHERE global_id = ?`, *item.ServiceGlobalID).Scan(&sid); err == nil {
				localServiceID = sid
			}
		}
		itemCreated := nowStr
		if item.CreatedAt != "" {
			itemCreated = item.CreatedAt
		}
		itemUpdated := nowStr
		if item.UpdatedAt != "" {
			itemUpdated = item.UpdatedAt
		}
		_, err := conn.ExecContext(ctx, `
			INSERT INTO announcement_items (global_id, service_id, image_url, sort_order, created_at, updated_at, service_global_id)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				service_id = excluded.service_id,
				image_url = excluded.image_url,
				sort_order = excluded.sort_order,
				updated_at = excluded.updated_at,
				service_global_id = excluded.service_global_id
		`, item.GlobalID, localServiceID, item.ImageURL, item.SortOrder, itemCreated, itemUpdated, item.ServiceGlobalID)
		if err != nil {
			return appliedCount, fmt.Errorf("upserting announcement item %s: %w", item.GlobalID, err)
		}
		appliedCount++
	}

	// 12. Tombstones
	for _, t := range tombstones {
		if t.GlobalID == "" || t.EntityType == "" {
			continue
		}
		if err := db.RecordTombstoneExec(ctx, conn, t.GlobalID, t.EntityType); err != nil {
			return appliedCount, fmt.Errorf("recording tombstone %s: %w", t.GlobalID, err)
		}
		var delErr error
		switch t.EntityType {
		case "service", "services":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM services WHERE global_id = ?`, t.GlobalID)
		case "hymn", "hymns":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM hymns WHERE global_id = ?`, t.GlobalID)
		case "song_set_entry", "song_set_entries":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM song_set_entries WHERE global_id = ?`, t.GlobalID)
		case "background_library_image", "background_library_images":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM background_library_images WHERE global_id = ?`, t.GlobalID)
		case "announcement_item", "announcement_items":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM announcement_items WHERE global_id = ?`, t.GlobalID)
		case "announcement_set", "announcement_sets":
			var setID int
			if err := conn.QueryRowContext(ctx, `SELECT id FROM announcement_sets WHERE global_id = ?`, t.GlobalID).Scan(&setID); err == nil {
				_, _ = conn.ExecContext(ctx, `DELETE FROM announcement_set_slides WHERE ann_set_id = ? OR ann_set_global_id = ?`, setID, t.GlobalID)
			}
			_, delErr = conn.ExecContext(ctx, `DELETE FROM announcement_sets WHERE global_id = ?`, t.GlobalID)
		case "announcement_set_slide", "announcement_set_slides":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM announcement_set_slides WHERE global_id = ?`, t.GlobalID)
		case "artifact_template", "artifact_templates":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM artifact_templates WHERE id = ?`, t.GlobalID)
		case "service_registry_snapshot", "service_registry_snapshots":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM service_registry_snapshots WHERE template_id = ? OR service_global_id = ?`, t.GlobalID, t.GlobalID)
		case "song_set_layout", "song_set_layouts":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM song_set_layouts WHERE role = ?`, t.GlobalID)
		case "service_song_set_layout", "service_song_set_layouts":
			_, delErr = conn.ExecContext(ctx, `DELETE FROM service_song_set_layouts WHERE service_global_id = ?`, t.GlobalID)
		}
		if delErr != nil {
			return appliedCount, fmt.Errorf("deleting entity %s (%s): %w", t.GlobalID, t.EntityType, delErr)
		}
		appliedCount++
	}

	return appliedCount, nil
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
