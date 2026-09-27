package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/db"
)

// SyncPushPayload defines the incoming batch of local changes pushed to the server.
type SyncPushPayload struct {
	ClientDeviceID string          `json:"client_device_id"`
	MutationID     string          `json:"mutation_id"`
	BaseRev        int             `json:"base_rev"`
	Mutations      SyncMutations   `json:"mutations"`
	Tombstones     []SyncTombstone `json:"tombstones"`
}

type SyncMutations struct {
	Services                 []SyncService                 `json:"services"`
	Hymns                    []SyncHymn                    `json:"hymns"`
	SongSetEntries           []SyncSongSetEntry            `json:"song_set_entries"`
	BackgroundLibraryImages  []SyncBackgroundImage         `json:"background_library_images"`
	AnnouncementItems        []SyncAnnouncementItem        `json:"announcement_items"`
	AnnouncementSets         []SyncAnnouncementSet         `json:"announcement_sets"`
	AnnouncementSetSlides    []SyncAnnouncementSetSlide    `json:"announcement_set_slides"`
	ArtifactTemplates        []SyncArtifactTemplate        `json:"artifact_templates"`
	ServiceRegistrySnapshots []SyncServiceRegistrySnapshot `json:"service_registry_snapshots"`
	SongSetLayouts           []SyncSongSetLayout           `json:"song_set_layouts"`
	ServiceSongSetLayouts    []SyncServiceSongSetLayout    `json:"service_song_set_layouts"`
}

type SyncTombstone struct {
	GlobalID   string `json:"global_id"`
	EntityType string `json:"entity_type"`
	DeletedAt  string `json:"deleted_at"`
}

type SyncService struct {
	GlobalID            string          `json:"global_id"`
	Date                string          `json:"date"`
	RawPayload          string          `json:"raw_payload"`
	ParsedData          json.RawMessage `json:"parsed_data,omitempty"`
	ImagesPayload       json.RawMessage `json:"images_payload,omitempty"`
	ParticipantsPayload any             `json:"participants_payload,omitempty"`
	AfternoonProgram    string          `json:"afternoon_program"`
	HiddenSlideIDs      json.RawMessage `json:"hidden_slide_ids,omitempty"`
	EmergencyPatches    json.RawMessage `json:"emergency_patches,omitempty"`
	CreatedAt           string          `json:"created_at"`
	UpdatedAt           string          `json:"updated_at"`
}

type SyncAnnouncementSet struct {
	GlobalID  string `json:"global_id"`
	Label     string `json:"label"`
	UpdatedAt string `json:"updated_at"`
}

type SyncAnnouncementSetSlide struct {
	GlobalID       string  `json:"global_id"`
	AnnSetGlobalID string  `json:"ann_set_global_id"`
	Label          string  `json:"label"`
	Payload        string  `json:"payload"`
	Position       int     `json:"position"`
	UpdatedAt      string  `json:"updated_at"`
	SeedHash       *string `json:"seed_hash,omitempty"`
}

type SyncArtifactTemplate struct {
	ID             string  `json:"id"`
	Label          string  `json:"label"`
	BaseType       string  `json:"base_type"`
	Payload        *string `json:"payload,omitempty"`
	UpdatedAt      string  `json:"updated_at"`
	SeedHash       *string `json:"seed_hash,omitempty"`
	Position       int     `json:"position"`
	VariableName   *string `json:"variable_name,omitempty"`
	AnnSetGlobalID *string `json:"ann_set_global_id,omitempty"`
}

type SyncServiceRegistrySnapshot struct {
	ServiceGlobalID string  `json:"service_global_id"`
	TemplateID      string  `json:"template_id"`
	Position        int     `json:"position"`
	Label           string  `json:"label"`
	BaseType        string  `json:"base_type"`
	Payload         *string `json:"payload,omitempty"`
	UpdatedAt       string  `json:"updated_at"`
	VariableName    *string `json:"variable_name,omitempty"`
	AnnSetGlobalID  *string `json:"ann_set_global_id,omitempty"`
}

type SyncSongSetLayout struct {
	Role      string  `json:"role"`
	Payload   *string `json:"payload,omitempty"`
	UpdatedAt string  `json:"updated_at"`
	SeedHash  *string `json:"seed_hash,omitempty"`
}

type SyncServiceSongSetLayout struct {
	ServiceGlobalID string  `json:"service_global_id"`
	Role            string  `json:"role"`
	Payload         *string `json:"payload,omitempty"`
	UpdatedAt       string  `json:"updated_at"`
}

type SyncHymn struct {
	GlobalID string `json:"global_id"`
	BookCode string `json:"book_code"`
	Number   int    `json:"number"`
	Title    string `json:"title"`
	Lyrics   string `json:"lyrics"`
}

type SyncSongSetEntry struct {
	GlobalID        string  `json:"global_id"`
	VariableName    string  `json:"variable_name"`
	Title           string  `json:"title"`
	Position        int     `json:"position"`
	UpdatedAt       string  `json:"updated_at"`
	ExtractionRegex *string `json:"extraction_regex,omitempty"`
}

type SyncBackgroundImage struct {
	GlobalID  string  `json:"global_id"`
	URL       string  `json:"url"`
	Name      string  `json:"name"`
	IsDefault bool    `json:"is_default"`
	Category  string  `json:"category"`
	CreatedAt *string `json:"created_at,omitempty"`
	UpdatedAt string  `json:"updated_at"`
}

type SyncAnnouncementItem struct {
	GlobalID        string  `json:"global_id"`
	ImageURL        string  `json:"image_url"`
	ServiceGlobalID *string `json:"service_global_id,omitempty"`
	ServiceID       *int    `json:"service_id,omitempty"`
	SortOrder       int     `json:"sort_order"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

func parseTimestampFlex(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty timestamp")
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02 15:04:05", s)
}

func isTombstoned(ctx context.Context, conn *sql.Conn, globalID string) bool {
	if globalID == "" {
		return false
	}
	var dummy int
	err := conn.QueryRowContext(ctx, `SELECT 1 FROM sync_tombstones WHERE global_id = ?`, globalID).Scan(&dummy)
	return err == nil
}

// POST /api/sync/push
func (s *Server) syncPush(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	// 1. Presenter Liveness Guard with synchronized admission lock (SPEC-47-05)
	releaseSync, ok := globalRemoteHub.TryAcquireSyncLock()
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":   "presenter_active",
			"message": "Presenter actively projecting — sync paused until presentation completes",
		})
		return
	}
	defer releaseSync()

	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)
	var payload SyncPushPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) || strings.Contains(strings.ToLower(err.Error()), "too large") {
			writeError(w, http.StatusBadRequest, "Failed to read upload body or file too large")
			return
		}
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if payload.MutationID == "" {
		writeError(w, http.StatusBadRequest, "mutation_id is required")
		return
	}

	// 2. Open dedicated connection and start BEGIN IMMEDIATE transaction (SPEC-47-05)
	conn, err := s.DB.Conn(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer conn.Close()

	if _, err := conn.ExecContext(r.Context(), `BEGIN IMMEDIATE`); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	committed := false
	defer func() {
		if !committed {
			_, _ = conn.ExecContext(r.Context(), `ROLLBACK`)
		}
	}()

	// 3. Concurrency-safe Idempotency check inside immediate transaction
	mutationKey := fmt.Sprintf("mutation:%s:%s", payload.ClientDeviceID, payload.MutationID)
	var existingMutation string
	err = conn.QueryRowContext(r.Context(), `SELECT value FROM sync_state WHERE key = ?`, mutationKey).Scan(&existingMutation)
	if err != nil && err != sql.ErrNoRows {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("checking idempotency key %s: %v", mutationKey, err))
		return
	}
	if err == nil && existingMutation != "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":              true,
			"already_applied": true,
			"mutation_id":     payload.MutationID,
		})
		return
	}

	nowStr := time.Now().UTC().Format(time.RFC3339Nano)
	appliedCount := 0

	// a. Apply Services mutations
	for _, svc := range payload.Mutations.Services {
		if svc.GlobalID == "" || svc.Date == "" || isTombstoned(r.Context(), conn, svc.GlobalID) {
			continue
		}
		var existingUpdatedAt string
		var existingID int
		checkErr := conn.QueryRowContext(r.Context(), `SELECT id, updated_at FROM services WHERE global_id = ?`, svc.GlobalID).Scan(&existingID, &existingUpdatedAt)
		if checkErr != nil && checkErr != sql.ErrNoRows {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("querying existing service %s: %v", svc.GlobalID, checkErr))
			return
		}
		if checkErr == nil {
			// Optimistic conflict check via parsed time
			existingTime, err1 := parseTimestampFlex(existingUpdatedAt)
			incomingTime, err2 := parseTimestampFlex(svc.UpdatedAt)
			if err1 == nil && err2 == nil && existingTime.After(incomingTime) {
				writeJSON(w, http.StatusConflict, map[string]any{
					"error":             "service_conflict",
					"message":           fmt.Sprintf("Service %s has newer remote edits (%s vs incoming %s)", svc.Date, existingUpdatedAt, svc.UpdatedAt),
					"global_id":         svc.GlobalID,
					"server_updated_at": existingUpdatedAt,
				})
				return
			}
			updatedTimestamp := nowStr
			if svc.UpdatedAt != "" {
				updatedTimestamp = svc.UpdatedAt
			}
			hiddenVal := ""
			if len(svc.HiddenSlideIDs) > 0 {
				hiddenVal = string(svc.HiddenSlideIDs)
			}
			emergencyVal := ""
			if len(svc.EmergencyPatches) > 0 {
				emergencyVal = string(svc.EmergencyPatches)
			}
			_, updateErr := conn.ExecContext(r.Context(), `
				UPDATE services
				SET date = ?, raw_payload = ?, parsed_data = ?, images_payload = ?, afternoon_program = ?,
					hidden_slide_ids = CASE WHEN ? != '' THEN ? ELSE COALESCE(hidden_slide_ids, '[]') END,
					emergency_patches = CASE WHEN ? != '' THEN ? ELSE COALESCE(emergency_patches, '[]') END,
					updated_at = ?
				WHERE global_id = ?
			`, svc.Date, svc.RawPayload, string(svc.ParsedData), string(svc.ImagesPayload), svc.AfternoonProgram,
				hiddenVal, hiddenVal, emergencyVal, emergencyVal, updatedTimestamp, svc.GlobalID)
			if updateErr != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("updating service %s: %v", svc.GlobalID, updateErr))
				return
			}
		} else if checkErr == sql.ErrNoRows {
			createdTimestamp := nowStr
			if svc.CreatedAt != "" {
				createdTimestamp = svc.CreatedAt
			}
			updatedTimestamp := nowStr
			if svc.UpdatedAt != "" {
				updatedTimestamp = svc.UpdatedAt
			}
			hiddenStr := "[]"
			if len(svc.HiddenSlideIDs) > 0 {
				hiddenStr = string(svc.HiddenSlideIDs)
			}
			emergencyStr := "[]"
			if len(svc.EmergencyPatches) > 0 {
				emergencyStr = string(svc.EmergencyPatches)
			}
			_, insertErr := conn.ExecContext(r.Context(), `
				INSERT INTO services (global_id, date, raw_payload, parsed_data, images_payload, afternoon_program, hidden_slide_ids, emergency_patches, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, svc.GlobalID, svc.Date, svc.RawPayload, string(svc.ParsedData), string(svc.ImagesPayload), svc.AfternoonProgram, hiddenStr, emergencyStr, createdTimestamp, updatedTimestamp)
			if insertErr != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("inserting service %s: %v", svc.GlobalID, insertErr))
				return
			}
		}
		appliedCount++
	}

	// b. Apply Announcement Sets (Parent entity)
	for _, set := range payload.Mutations.AnnouncementSets {
		if set.GlobalID == "" || isTombstoned(r.Context(), conn, set.GlobalID) {
			continue
		}
		setUpdated := nowStr
		if set.UpdatedAt != "" {
			setUpdated = set.UpdatedAt
		}
		_, setErr := conn.ExecContext(r.Context(), `
			INSERT INTO announcement_sets (global_id, label, updated_at)
			VALUES (?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				label = excluded.label,
				updated_at = excluded.updated_at
		`, set.GlobalID, set.Label, setUpdated)
		if setErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting announcement set %s: %v", set.GlobalID, setErr))
			return
		}
		appliedCount++
	}

	// c. Apply Announcement Set Slides (Child entity of AnnouncementSets)
	for _, slide := range payload.Mutations.AnnouncementSetSlides {
		if slide.GlobalID == "" || slide.AnnSetGlobalID == "" || isTombstoned(r.Context(), conn, slide.GlobalID) {
			continue
		}
		var annSetID int
		err := conn.QueryRowContext(r.Context(), `SELECT id FROM announcement_sets WHERE global_id = ?`, slide.AnnSetGlobalID).Scan(&annSetID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":             "unresolved_announcement_set_reference",
				"message":           fmt.Sprintf("Slide %s references unknown announcement set %s. Sync announcement sets first.", slide.GlobalID, slide.AnnSetGlobalID),
				"global_id":         slide.GlobalID,
				"ann_set_global_id": slide.AnnSetGlobalID,
			})
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("resolving announcement set %s: %v", slide.AnnSetGlobalID, err))
			return
		}

		slideUpdated := nowStr
		if slide.UpdatedAt != "" {
			slideUpdated = slide.UpdatedAt
		}
		_, slideErr := conn.ExecContext(r.Context(), `
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
		if slideErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting announcement set slide %s: %v", slide.GlobalID, slideErr))
			return
		}
		appliedCount++
	}

	// d. Apply Artifact Templates
	for _, tmpl := range payload.Mutations.ArtifactTemplates {
		if tmpl.ID == "" || tmpl.BaseType == "" || isTombstoned(r.Context(), conn, tmpl.ID) {
			continue
		}
		var annSetID any = nil
		if tmpl.AnnSetGlobalID != nil && *tmpl.AnnSetGlobalID != "" {
			var sid int
			err := conn.QueryRowContext(r.Context(), `SELECT id FROM announcement_sets WHERE global_id = ?`, *tmpl.AnnSetGlobalID).Scan(&sid)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusConflict, map[string]any{
					"error":             "unresolved_announcement_set_reference",
					"message":           fmt.Sprintf("Artifact template %s references unknown announcement set %s. Sync announcement sets first.", tmpl.ID, *tmpl.AnnSetGlobalID),
					"template_id":       tmpl.ID,
					"ann_set_global_id": *tmpl.AnnSetGlobalID,
				})
				return
			} else if err != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("resolving announcement set %s for template: %v", *tmpl.AnnSetGlobalID, err))
				return
			}
			annSetID = sid
		}
		tmplUpdated := nowStr
		if tmpl.UpdatedAt != "" {
			tmplUpdated = tmpl.UpdatedAt
		}
		_, tmplErr := conn.ExecContext(r.Context(), `
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
		if tmplErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting artifact template %s: %v", tmpl.ID, tmplErr))
			return
		}
		appliedCount++
	}

	// e. Apply Service Registry Snapshots (Parent Services already inserted)
	for _, snap := range payload.Mutations.ServiceRegistrySnapshots {
		if snap.ServiceGlobalID == "" || snap.TemplateID == "" || isTombstoned(r.Context(), conn, snap.TemplateID) || isTombstoned(r.Context(), conn, snap.ServiceGlobalID) {
			continue
		}
		var serviceID int
		err := conn.QueryRowContext(r.Context(), `SELECT id FROM services WHERE global_id = ?`, snap.ServiceGlobalID).Scan(&serviceID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":             "unresolved_service_reference",
				"message":           fmt.Sprintf("Registry snapshot references unknown service %s. Sync service first.", snap.ServiceGlobalID),
				"service_global_id": snap.ServiceGlobalID,
			})
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("resolving service %s for snapshot: %v", snap.ServiceGlobalID, err))
			return
		}

		var annSetID any = nil
		if snap.AnnSetGlobalID != nil && *snap.AnnSetGlobalID != "" {
			var sid int
			err := conn.QueryRowContext(r.Context(), `SELECT id FROM announcement_sets WHERE global_id = ?`, *snap.AnnSetGlobalID).Scan(&sid)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusConflict, map[string]any{
					"error":             "unresolved_announcement_set_reference",
					"message":           fmt.Sprintf("Registry snapshot references unknown announcement set %s. Sync announcement sets first.", *snap.AnnSetGlobalID),
					"service_global_id": snap.ServiceGlobalID,
					"ann_set_global_id": *snap.AnnSetGlobalID,
				})
				return
			} else if err != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("resolving announcement set %s for snapshot: %v", *snap.AnnSetGlobalID, err))
				return
			}
			annSetID = sid
		}

		snapUpdated := nowStr
		if snap.UpdatedAt != "" {
			snapUpdated = snap.UpdatedAt
		}
		_, snapErr := conn.ExecContext(r.Context(), `
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
		if snapErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting service registry snapshot: %v", snapErr))
			return
		}
		appliedCount++
	}

	// f. Apply Song Set Layouts (Master data)
	for _, layout := range payload.Mutations.SongSetLayouts {
		if layout.Role == "" || isTombstoned(r.Context(), conn, layout.Role) {
			continue
		}
		layoutUpdated := nowStr
		if layout.UpdatedAt != "" {
			layoutUpdated = layout.UpdatedAt
		}
		_, lErr := conn.ExecContext(r.Context(), `
			INSERT INTO song_set_layouts (role, payload, updated_at, seed_hash)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(role) DO UPDATE SET
				payload = excluded.payload,
				updated_at = excluded.updated_at,
				seed_hash = excluded.seed_hash
		`, layout.Role, layout.Payload, layoutUpdated, layout.SeedHash)
		if lErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting song set layout %s: %v", layout.Role, lErr))
			return
		}
		appliedCount++
	}

	// g. Apply Service Song Set Layouts (Parent Services already inserted)
	for _, sLayout := range payload.Mutations.ServiceSongSetLayouts {
		if sLayout.ServiceGlobalID == "" || sLayout.Role == "" || isTombstoned(r.Context(), conn, sLayout.ServiceGlobalID) {
			continue
		}
		var serviceID int
		err := conn.QueryRowContext(r.Context(), `SELECT id FROM services WHERE global_id = ?`, sLayout.ServiceGlobalID).Scan(&serviceID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":             "unresolved_service_reference",
				"message":           fmt.Sprintf("Service layout references unknown service %s. Sync service first.", sLayout.ServiceGlobalID),
				"service_global_id": sLayout.ServiceGlobalID,
			})
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("resolving service %s for layout: %v", sLayout.ServiceGlobalID, err))
			return
		}

		sLayoutUpdated := nowStr
		if sLayout.UpdatedAt != "" {
			sLayoutUpdated = sLayout.UpdatedAt
		}
		_, slErr := conn.ExecContext(r.Context(), `
			INSERT INTO service_song_set_layouts (service_id, service_global_id, role, payload, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(service_id, role) DO UPDATE SET
				service_global_id = excluded.service_global_id,
				payload = excluded.payload,
				updated_at = excluded.updated_at
		`, serviceID, sLayout.ServiceGlobalID, sLayout.Role, sLayout.Payload, sLayoutUpdated)
		if slErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting service song set layout: %v", slErr))
			return
		}
		appliedCount++
	}

	// h. Apply Hymns mutations
	for _, hymn := range payload.Mutations.Hymns {
		if hymn.GlobalID == "" || hymn.Number <= 0 || isTombstoned(r.Context(), conn, hymn.GlobalID) {
			continue
		}
		_, hErr := conn.ExecContext(r.Context(), `
			INSERT INTO hymns (global_id, book_code, number, title, lyrics)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(book_code, number) DO UPDATE SET
				global_id = excluded.global_id,
				title = excluded.title,
				lyrics = excluded.lyrics
		`, hymn.GlobalID, hymn.BookCode, hymn.Number, hymn.Title, hymn.Lyrics)
		if hErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting hymn: %v", hErr))
			return
		}
		appliedCount++
	}

	// i. Apply Song Set Entries mutations
	for _, entry := range payload.Mutations.SongSetEntries {
		if entry.GlobalID == "" || entry.VariableName == "" || isTombstoned(r.Context(), conn, entry.GlobalID) {
			continue
		}
		_, sErr := conn.ExecContext(r.Context(), `
			INSERT INTO song_set_entries (global_id, variable_name, title, position, updated_at, extraction_regex)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(variable_name) DO UPDATE SET
				global_id = excluded.global_id,
				title = excluded.title,
				position = excluded.position,
				updated_at = excluded.updated_at,
				extraction_regex = excluded.extraction_regex
		`, entry.GlobalID, entry.VariableName, entry.Title, entry.Position, nowStr, entry.ExtractionRegex)
		if sErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting song set entry: %v", sErr))
			return
		}
		appliedCount++
	}

	// j. Apply Background Library mutations
	for _, img := range payload.Mutations.BackgroundLibraryImages {
		if img.GlobalID == "" || img.URL == "" || isTombstoned(r.Context(), conn, img.GlobalID) {
			continue
		}
		isDefInt := 0
		if img.IsDefault {
			isDefInt = 1
		}
		_, bErr := conn.ExecContext(r.Context(), `
			INSERT INTO background_library_images (global_id, url, name, is_default, category, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				url = excluded.url,
				name = excluded.name,
				is_default = excluded.is_default,
				category = excluded.category,
				updated_at = excluded.updated_at
		`, img.GlobalID, img.URL, img.Name, isDefInt, img.Category, nowStr, nowStr)
		if bErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting background image: %v", bErr))
			return
		}
		appliedCount++
	}

	// k. Apply Announcement Items mutations
	for _, item := range payload.Mutations.AnnouncementItems {
		if item.GlobalID == "" || item.ImageURL == "" || isTombstoned(r.Context(), conn, item.GlobalID) {
			continue
		}
		var localServiceID any = nil
		if item.ServiceGlobalID != nil && *item.ServiceGlobalID != "" {
			var sid int
			err := conn.QueryRowContext(r.Context(), `SELECT id FROM services WHERE global_id = ?`, *item.ServiceGlobalID).Scan(&sid)
			if err == nil {
				localServiceID = sid
			} else if err == sql.ErrNoRows {
				writeJSON(w, http.StatusConflict, map[string]any{
					"error":             "unresolved_service_reference",
					"message":           fmt.Sprintf("Announcement item %s references unknown service %s. Sync referenced service first.", item.GlobalID, *item.ServiceGlobalID),
					"global_id":         item.GlobalID,
					"service_global_id": *item.ServiceGlobalID,
				})
				return
			} else {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("resolving service %s for announcement %s: %v", *item.ServiceGlobalID, item.GlobalID, err))
				return
			}
		} else if item.ServiceID != nil {
			localServiceID = *item.ServiceID
		}

		_, aErr := conn.ExecContext(r.Context(), `
			INSERT INTO announcement_items (global_id, image_url, service_id, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(global_id) DO UPDATE SET
				image_url = excluded.image_url,
				service_id = excluded.service_id,
				sort_order = excluded.sort_order,
				updated_at = excluded.updated_at
		`, item.GlobalID, item.ImageURL, localServiceID, item.SortOrder, nowStr, nowStr)
		if aErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("upserting announcement item: %v", aErr))
			return
		}
		appliedCount++
	}

	// l. Apply Tombstones with atomic deletion
	for _, t := range payload.Tombstones {
		if t.GlobalID == "" || t.EntityType == "" {
			continue
		}
		if err := db.RecordTombstoneExec(r.Context(), conn, t.GlobalID, t.EntityType); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("recording tombstone %s: %v", t.GlobalID, err))
			return
		}
		var delErr error
		switch t.EntityType {
		case "service", "services":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM services WHERE global_id = ?`, t.GlobalID)
		case "hymn", "hymns":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM hymns WHERE global_id = ?`, t.GlobalID)
		case "song_set_entry", "song_set_entries":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM song_set_entries WHERE global_id = ?`, t.GlobalID)
		case "background_library_image", "background_library_images":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM background_library_images WHERE global_id = ?`, t.GlobalID)
		case "announcement_item", "announcement_items":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM announcement_items WHERE global_id = ?`, t.GlobalID)
		case "announcement_set", "announcement_sets":
			var setID int
			if err := conn.QueryRowContext(r.Context(), `SELECT id FROM announcement_sets WHERE global_id = ?`, t.GlobalID).Scan(&setID); err == nil {
				_, _ = conn.ExecContext(r.Context(), `DELETE FROM announcement_set_slides WHERE ann_set_id = ? OR ann_set_global_id = ?`, setID, t.GlobalID)
			}
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM announcement_sets WHERE global_id = ?`, t.GlobalID)
		case "announcement_set_slide", "announcement_set_slides":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM announcement_set_slides WHERE global_id = ?`, t.GlobalID)
		case "artifact_template", "artifact_templates":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM artifact_templates WHERE id = ?`, t.GlobalID)
		case "service_registry_snapshot", "service_registry_snapshots":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM service_registry_snapshots WHERE template_id = ? OR service_global_id = ?`, t.GlobalID, t.GlobalID)
		case "song_set_layout", "song_set_layouts":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM song_set_layouts WHERE role = ?`, t.GlobalID)
		case "service_song_set_layout", "service_song_set_layouts":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM service_song_set_layouts WHERE service_global_id = ?`, t.GlobalID)
		}
		if delErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("deleting entity %s (%s): %v", t.GlobalID, t.EntityType, delErr))
			return
		}
		appliedCount++
	}

	// g. Record mutation_id and last_sync_timestamp in sync_state
	_, err = conn.ExecContext(r.Context(), `
		INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
	`, mutationKey, payload.ClientDeviceID, nowStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	_, err = conn.ExecContext(r.Context(), `
		INSERT INTO sync_state (key, value, updated_at) VALUES ('client_device_id', ?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
	`, payload.ClientDeviceID, nowStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	_, err = conn.ExecContext(r.Context(), `
		INSERT INTO sync_state (key, value, updated_at) VALUES ('last_sync_timestamp', ?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
	`, nowStr, nowStr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if _, err := conn.ExecContext(r.Context(), `COMMIT`); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	committed = true

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"applied_count": appliedCount,
		"mutation_id":   payload.MutationID,
		"timestamp":     nowStr,
	})
}

// GET /api/sync/pull
func (s *Server) syncPull(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	since := strings.TrimSpace(r.URL.Query().Get("since"))
	nowStr := time.Now().UTC().Format(time.RFC3339Nano)

	// Fetch Services
	var services []SyncService
	sQuery := `SELECT global_id, date, raw_payload, COALESCE(parsed_data, '{}'), COALESCE(images_payload, '{}'), afternoon_program, COALESCE(hidden_slide_ids, '[]'), COALESCE(emergency_patches, '[]'), created_at, updated_at FROM services`
	var sArgs []any
	if since != "" {
		sQuery += ` WHERE updated_at > ? OR created_at > ?`
		sArgs = append(sArgs, since, since)
	}
	sQuery += ` ORDER BY updated_at ASC`

	sRows, err := s.DB.Query(sQuery, sArgs...)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var svc SyncService
			var parsedStr, imagesStr, hiddenStr, emergencyStr string
			if err := sRows.Scan(&svc.GlobalID, &svc.Date, &svc.RawPayload, &parsedStr, &imagesStr, &svc.AfternoonProgram, &hiddenStr, &emergencyStr, &svc.CreatedAt, &svc.UpdatedAt); err == nil {
				svc.ParsedData = json.RawMessage(parsedStr)
				svc.ImagesPayload = json.RawMessage(imagesStr)
				svc.HiddenSlideIDs = json.RawMessage(hiddenStr)
				svc.EmergencyPatches = json.RawMessage(emergencyStr)
				services = append(services, svc)
			}
		}
	}

	// Fetch Hymns
	var hymns []SyncHymn
	hQuery := `SELECT global_id, book_code, number, title, lyrics FROM hymns`
	var hArgs []any
	hRows, err := s.DB.Query(hQuery, hArgs...)
	if err == nil {
		defer hRows.Close()
		for hRows.Next() {
			var h SyncHymn
			if err := hRows.Scan(&h.GlobalID, &h.BookCode, &h.Number, &h.Title, &h.Lyrics); err == nil {
				hymns = append(hymns, h)
			}
		}
	}

	// Fetch Song Set Entries
	var songSetEntries []SyncSongSetEntry
	sseQuery := `SELECT global_id, variable_name, title, position, updated_at, extraction_regex FROM song_set_entries`
	var sseArgs []any
	if since != "" {
		sseQuery += ` WHERE updated_at > ?`
		sseArgs = append(sseArgs, since)
	}
	sseRows, err := s.DB.Query(sseQuery, sseArgs...)
	if err == nil {
		defer sseRows.Close()
		for sseRows.Next() {
			var sse SyncSongSetEntry
			if err := sseRows.Scan(&sse.GlobalID, &sse.VariableName, &sse.Title, &sse.Position, &sse.UpdatedAt, &sse.ExtractionRegex); err == nil {
				songSetEntries = append(songSetEntries, sse)
			}
		}
	}

	// Fetch Background Library Images
	var bgImages []SyncBackgroundImage
	bgQuery := `SELECT global_id, COALESCE(url, ''), name, is_default, category, created_at, updated_at FROM background_library_images`
	var bgArgs []any
	if since != "" {
		bgQuery += ` WHERE updated_at > ? OR created_at > ?`
		bgArgs = append(bgArgs, since, since)
	}
	bgRows, err := s.DB.Query(bgQuery, bgArgs...)
	if err == nil {
		defer bgRows.Close()
		for bgRows.Next() {
			var bg SyncBackgroundImage
			var isDef int
			if err := bgRows.Scan(&bg.GlobalID, &bg.URL, &bg.Name, &isDef, &bg.Category, &bg.CreatedAt, &bg.UpdatedAt); err == nil {
				bg.IsDefault = (isDef == 1)
				bgImages = append(bgImages, bg)
			}
		}
	}

	// Fetch Announcement Items
	var annItems []SyncAnnouncementItem
	aQuery := `
		SELECT a.global_id, a.image_url, s.global_id, a.service_id, a.sort_order, a.created_at, a.updated_at
		FROM announcement_items a
		LEFT JOIN services s ON a.service_id = s.id
	`
	var aArgs []any
	if since != "" {
		aQuery += ` WHERE a.updated_at > ? OR a.created_at > ?`
		aArgs = append(aArgs, since, since)
	}
	aRows, err := s.DB.Query(aQuery, aArgs...)
	if err == nil {
		defer aRows.Close()
		for aRows.Next() {
			var item SyncAnnouncementItem
			var sGlobalID sql.NullString
			var svcID sql.NullInt64
			var upAt sql.NullString
			if err := aRows.Scan(&item.GlobalID, &item.ImageURL, &sGlobalID, &svcID, &item.SortOrder, &item.CreatedAt, &upAt); err == nil {
				if sGlobalID.Valid && sGlobalID.String != "" {
					item.ServiceGlobalID = &sGlobalID.String
				}
				if svcID.Valid {
					v := int(svcID.Int64)
					item.ServiceID = &v
				}
				if upAt.Valid {
					item.UpdatedAt = upAt.String
				}
				annItems = append(annItems, item)
			}
		}
	}

	// Fetch Announcement Sets
	var annSets []SyncAnnouncementSet
	annSetQuery := `SELECT global_id, COALESCE(label, ''), COALESCE(updated_at, '') FROM announcement_sets`
	var annSetArgs []any
	if since != "" {
		annSetQuery += ` WHERE updated_at > ?`
		annSetArgs = append(annSetArgs, since)
	}
	if setRows, err := s.DB.Query(annSetQuery, annSetArgs...); err == nil {
		defer setRows.Close()
		for setRows.Next() {
			var set SyncAnnouncementSet
			if err := setRows.Scan(&set.GlobalID, &set.Label, &set.UpdatedAt); err == nil {
				annSets = append(annSets, set)
			}
		}
	}

	// Fetch Announcement Set Slides
	var annSlides []SyncAnnouncementSetSlide
	slideQuery := `SELECT global_id, COALESCE(ann_set_global_id, ''), COALESCE(label, ''), COALESCE(payload, ''), position, COALESCE(updated_at, ''), seed_hash FROM announcement_set_slides`
	var slideArgs []any
	if since != "" {
		slideQuery += ` WHERE updated_at > ?`
		slideArgs = append(slideArgs, since)
	}
	if slideRows, err := s.DB.Query(slideQuery, slideArgs...); err == nil {
		defer slideRows.Close()
		for slideRows.Next() {
			var slide SyncAnnouncementSetSlide
			if err := slideRows.Scan(&slide.GlobalID, &slide.AnnSetGlobalID, &slide.Label, &slide.Payload, &slide.Position, &slide.UpdatedAt, &slide.SeedHash); err == nil {
				annSlides = append(annSlides, slide)
			}
		}
	}

	// Fetch Artifact Templates
	var templates []SyncArtifactTemplate
	tmplQuery := `SELECT id, label, base_type, payload, updated_at, seed_hash, position, variable_name, ann_set_global_id FROM artifact_templates`
	var tmplArgs []any
	if since != "" {
		tmplQuery += ` WHERE updated_at > ?`
		tmplArgs = append(tmplArgs, since)
	}
	if tmplRows, err := s.DB.Query(tmplQuery, tmplArgs...); err == nil {
		defer tmplRows.Close()
		for tmplRows.Next() {
			var tmpl SyncArtifactTemplate
			if err := tmplRows.Scan(&tmpl.ID, &tmpl.Label, &tmpl.BaseType, &tmpl.Payload, &tmpl.UpdatedAt, &tmpl.SeedHash, &tmpl.Position, &tmpl.VariableName, &tmpl.AnnSetGlobalID); err == nil {
				templates = append(templates, tmpl)
			}
		}
	}

	// Fetch Service Registry Snapshots
	var snapshots []SyncServiceRegistrySnapshot
	snapQuery := `SELECT COALESCE(service_global_id, ''), template_id, position, label, base_type, payload, updated_at, variable_name, ann_set_global_id FROM service_registry_snapshots`
	var snapArgs []any
	if since != "" {
		snapQuery += ` WHERE updated_at > ?`
		snapArgs = append(snapArgs, since)
	}
	if snapRows, err := s.DB.Query(snapQuery, snapArgs...); err == nil {
		defer snapRows.Close()
		for snapRows.Next() {
			var snap SyncServiceRegistrySnapshot
			if err := snapRows.Scan(&snap.ServiceGlobalID, &snap.TemplateID, &snap.Position, &snap.Label, &snap.BaseType, &snap.Payload, &snap.UpdatedAt, &snap.VariableName, &snap.AnnSetGlobalID); err == nil {
				snapshots = append(snapshots, snap)
			}
		}
	}

	// Fetch Song Set Layouts
	var layouts []SyncSongSetLayout
	layoutQuery := `SELECT role, payload, COALESCE(updated_at, ''), seed_hash FROM song_set_layouts`
	var layoutArgs []any
	if since != "" {
		layoutQuery += ` WHERE updated_at > ?`
		layoutArgs = append(layoutArgs, since)
	}
	if layoutRows, err := s.DB.Query(layoutQuery, layoutArgs...); err == nil {
		defer layoutRows.Close()
		for layoutRows.Next() {
			var layout SyncSongSetLayout
			if err := layoutRows.Scan(&layout.Role, &layout.Payload, &layout.UpdatedAt, &layout.SeedHash); err == nil {
				layouts = append(layouts, layout)
			}
		}
	}

	// Fetch Service Song Set Layouts
	var serviceLayouts []SyncServiceSongSetLayout
	sLayoutQuery := `SELECT COALESCE(service_global_id, ''), role, payload, COALESCE(updated_at, '') FROM service_song_set_layouts`
	var sLayoutArgs []any
	if since != "" {
		sLayoutQuery += ` WHERE updated_at > ?`
		sLayoutArgs = append(sLayoutArgs, since)
	}
	if sLayoutRows, err := s.DB.Query(sLayoutQuery, sLayoutArgs...); err == nil {
		defer sLayoutRows.Close()
		for sLayoutRows.Next() {
			var sLayout SyncServiceSongSetLayout
			if err := sLayoutRows.Scan(&sLayout.ServiceGlobalID, &sLayout.Role, &sLayout.Payload, &sLayout.UpdatedAt); err == nil {
				serviceLayouts = append(serviceLayouts, sLayout)
			}
		}
	}

	// Fetch Tombstones
	var tombstones []SyncTombstone
	tQuery := `SELECT global_id, entity_type, deleted_at FROM sync_tombstones`
	var tArgs []any
	if since != "" {
		tQuery += ` WHERE deleted_at > ?`
		tArgs = append(tArgs, since)
	}
	tRows, err := s.DB.Query(tQuery, tArgs...)
	if err == nil {
		defer tRows.Close()
		for tRows.Next() {
			var t SyncTombstone
			if err := tRows.Scan(&t.GlobalID, &t.EntityType, &t.DeletedAt); err == nil {
				tombstones = append(tombstones, t)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"server_timestamp": nowStr,
		"cursor":           nowStr,
		"changes": map[string]any{
			"services":                   services,
			"hymns":                      hymns,
			"song_set_entries":           songSetEntries,
			"background_library_images":  bgImages,
			"announcement_items":         annItems,
			"announcement_sets":          annSets,
			"announcement_set_slides":    annSlides,
			"artifact_templates":         templates,
			"service_registry_snapshots": snapshots,
			"song_set_layouts":           layouts,
			"service_song_set_layouts":   serviceLayouts,
		},
		"tombstones": tombstones,
	})
}

// GET /api/sync/status
func (s *Server) syncStatus(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var lastSyncAt string
	_ = s.DB.QueryRow(`SELECT value FROM sync_state WHERE key = 'last_sync_timestamp'`).Scan(&lastSyncAt)
	var clientDeviceID string
	_ = s.DB.QueryRow(`SELECT value FROM sync_state WHERE key = 'client_device_id'`).Scan(&clientDeviceID)

	var tombstoneCount int
	_ = s.DB.QueryRow(`SELECT COUNT(*) FROM sync_tombstones`).Scan(&tombstoneCount)

	writeJSON(w, http.StatusOK, map[string]any{
		"device_id":        clientDeviceID,
		"last_synced_at":   lastSyncAt,
		"total_tombstones": tombstoneCount,
		"presenter_active": globalRemoteHub.HasActivePresenter(),
	})
}
