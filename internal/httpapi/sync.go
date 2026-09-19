package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
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
	Services                []SyncService          `json:"services"`
	Hymns                   []SyncHymn             `json:"hymns"`
	SongSetEntries          []SyncSongSetEntry     `json:"song_set_entries"`
	BackgroundLibraryImages []SyncBackgroundImage  `json:"background_library_images"`
	AnnouncementItems       []SyncAnnouncementItem `json:"announcement_items"`
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
	CreatedAt           string          `json:"created_at"`
	UpdatedAt           string          `json:"updated_at"`
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

	var payload SyncPushPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
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
		if svc.GlobalID == "" || svc.Date == "" {
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
			_, updateErr := conn.ExecContext(r.Context(), `
				UPDATE services
				SET date = ?, raw_payload = ?, parsed_data = ?, images_payload = ?, afternoon_program = ?, updated_at = ?
				WHERE global_id = ?
			`, svc.Date, svc.RawPayload, string(svc.ParsedData), string(svc.ImagesPayload), svc.AfternoonProgram, updatedTimestamp, svc.GlobalID)
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
			_, insertErr := conn.ExecContext(r.Context(), `
				INSERT INTO services (global_id, date, raw_payload, parsed_data, images_payload, afternoon_program, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`, svc.GlobalID, svc.Date, svc.RawPayload, string(svc.ParsedData), string(svc.ImagesPayload), svc.AfternoonProgram, createdTimestamp, updatedTimestamp)
			if insertErr != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("inserting service %s: %v", svc.GlobalID, insertErr))
				return
			}
		}
		appliedCount++
	}

	// b. Apply Hymns mutations
	for _, hymn := range payload.Mutations.Hymns {
		if hymn.GlobalID == "" || hymn.Number <= 0 {
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

	// c. Apply Song Set Entries mutations
	for _, entry := range payload.Mutations.SongSetEntries {
		if entry.GlobalID == "" || entry.VariableName == "" {
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

	// d. Apply Background Library mutations
	for _, img := range payload.Mutations.BackgroundLibraryImages {
		if img.GlobalID == "" || img.URL == "" {
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

	// e. Apply Announcement Items mutations
	for _, item := range payload.Mutations.AnnouncementItems {
		if item.GlobalID == "" || item.ImageURL == "" {
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

	// f. Apply Tombstones with atomic deletion
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
		case "service":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM services WHERE global_id = ?`, t.GlobalID)
		case "hymn":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM hymns WHERE global_id = ?`, t.GlobalID)
		case "song_set_entry":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM song_set_entries WHERE global_id = ?`, t.GlobalID)
		case "background_library_image":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM background_library_images WHERE global_id = ?`, t.GlobalID)
		case "announcement_item":
			_, delErr = conn.ExecContext(r.Context(), `DELETE FROM announcement_items WHERE global_id = ?`, t.GlobalID)
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
	sQuery := `SELECT global_id, date, raw_payload, COALESCE(parsed_data, '{}'), COALESCE(images_payload, '{}'), afternoon_program, created_at, updated_at FROM services`
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
			var parsedStr, imagesStr string
			if err := sRows.Scan(&svc.GlobalID, &svc.Date, &svc.RawPayload, &parsedStr, &imagesStr, &svc.AfternoonProgram, &svc.CreatedAt, &svc.UpdatedAt); err == nil {
				svc.ParsedData = json.RawMessage(parsedStr)
				svc.ImagesPayload = json.RawMessage(imagesStr)
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
			"services":                  services,
			"hymns":                     hymns,
			"song_set_entries":          songSetEntries,
			"background_library_images": bgImages,
			"announcement_items":        annItems,
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
