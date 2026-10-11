package httpapi

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var hexSha256Regex = regexp.MustCompile(`^[0-9a-f]{64}$`)

type MediaPlaylistItem struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	StorageKey string   `json:"storage_key"`
	SizeBytes  int64    `json:"size_bytes"`
	DurationMs *int64   `json:"duration_ms"`
	SHA256     string   `json:"sha256"`
	OrderKey   float64  `json:"order_key"`
	CreatedAt  string   `json:"created_at"`
	ContentURL string   `json:"content_url"`
}

type CreateMediaPlaylistItemRequest struct {
	ID         string  `json:"id,omitempty"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	StorageKey string  `json:"storage_key"`
	SizeBytes  int64   `json:"size_bytes"`
	DurationMs *int64  `json:"duration_ms,omitempty"`
	SHA256     string  `json:"sha256"`
	OrderKey   *float64 `json:"order_key,omitempty"`
}

type ReorderMediaPlaylistRequest struct {
	Items []struct {
		ID       string  `json:"id"`
		OrderKey float64 `json:"order_key"`
	} `json:"items"`
}

func (s *Server) listMediaPlaylistItems(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	rows, err := s.DB.Query(`
		SELECT id, name, type, storage_key, size_bytes, duration_ms, sha256, order_key, created_at
		FROM media_playlist_items
		ORDER BY order_key ASC, id ASC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to query media playlist")
		return
	}
	defer rows.Close()

	items := make([]MediaPlaylistItem, 0)
	for rows.Next() {
		var item MediaPlaylistItem
		var dur sql.NullInt64
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Type,
			&item.StorageKey,
			&item.SizeBytes,
			&dur,
			&item.SHA256,
			&item.OrderKey,
			&item.CreatedAt,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan playlist item")
			return
		}
		if dur.Valid {
			v := dur.Int64
			item.DurationMs = &v
		}
		item.ContentURL = fmt.Sprintf("/api/media/%s/content", item.ID)
		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createMediaPlaylistItem(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	var req CreateMediaPlaylistItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Item name must not be empty")
		return
	}
	if req.Type != "audio" && req.Type != "video" {
		writeError(w, http.StatusBadRequest, "Type must be 'audio' or 'video'")
		return
	}
	req.StorageKey = strings.TrimSpace(req.StorageKey)
	if req.StorageKey == "" {
		writeError(w, http.StatusBadRequest, "Storage key must not be empty")
		return
	}
	if req.SizeBytes < 0 {
		writeError(w, http.StatusBadRequest, "Size bytes must be non-negative")
		return
	}
	if req.DurationMs != nil && *req.DurationMs < 0 {
		writeError(w, http.StatusBadRequest, "Duration must be non-negative")
		return
	}
	req.SHA256 = strings.ToLower(strings.TrimSpace(req.SHA256))
	if !hexSha256Regex.MatchString(req.SHA256) {
		writeError(w, http.StatusBadRequest, "sha256 must be a 64-character lowercase hex string")
		return
	}

	id := strings.TrimSpace(req.ID)
	if id == "" {
		var b [8]byte
		_, _ = rand.Read(b[:])
		id = fmt.Sprintf("media-%d-%s", time.Now().UnixNano(), hex.EncodeToString(b[:]))
	}

	orderKey := 1.0
	if req.OrderKey != nil {
		orderKey = *req.OrderKey
	} else {
		var maxOrder sql.NullFloat64
		_ = s.DB.QueryRow(`SELECT MAX(order_key) FROM media_playlist_items`).Scan(&maxOrder)
		if maxOrder.Valid {
			orderKey = maxOrder.Float64 + 1.0
		}
	}

	createdAt := time.Now().UTC().Format(time.RFC3339)

	var durationVal any = nil
	if req.DurationMs != nil {
		durationVal = *req.DurationMs
	}

	_, err := s.DB.Exec(`
		INSERT INTO media_playlist_items (
			id, name, type, storage_key, size_bytes, duration_ms, sha256, order_key, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Name, req.Type, req.StorageKey, req.SizeBytes, durationVal, req.SHA256, orderKey, createdAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to insert playlist item: %v", err))
		return
	}

	item := MediaPlaylistItem{
		ID:         id,
		Name:       req.Name,
		Type:       req.Type,
		StorageKey: req.StorageKey,
		SizeBytes:  req.SizeBytes,
		DurationMs: req.DurationMs,
		SHA256:     req.SHA256,
		OrderKey:   orderKey,
		CreatedAt:  createdAt,
		ContentURL: fmt.Sprintf("/api/media/%s/content", id),
	}

	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) reorderMediaPlaylistItems(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	var req ReorderMediaPlaylistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`UPDATE media_playlist_items SET order_key = ? WHERE id = ?`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to prepare reorder statement")
		return
	}
	defer stmt.Close()

	for _, item := range req.Items {
		if _, err := stmt.Exec(item.OrderKey, item.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to update item order")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit reorder")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) deleteMediaPlaylistItem(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing playlist item id")
		return
	}

	var storageKey string
	err := s.DB.QueryRow(`SELECT storage_key FROM media_playlist_items WHERE id = ?`, id).Scan(&storageKey)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Playlist item not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to find item")
		return
	}

	// Unlink item row
	if _, err := s.DB.Exec(`DELETE FROM media_playlist_items WHERE id = ?`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete item")
		return
	}

	purged := false
	refcount := 0
	if r.URL.Query().Get("purge") == "true" {
		refcount, err = s.countAssetReferences(storageKey)
		if err == nil && refcount == 0 {
			if err := s.removeAssetFile(storageKey); err == nil {
				purged = true
			}
		}
	} else {
		refcount, _ = s.countAssetReferences(storageKey)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"deleted":  true,
		"purged":   purged,
		"refcount": refcount,
	})
}

func (s *Server) purgeMediaAsset(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	storageKey := r.PathValue("storageKey")
	if storageKey == "" {
		writeError(w, http.StatusBadRequest, "Missing storage key")
		return
	}

	refcount, err := s.countAssetReferences(storageKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to check reference count")
		return
	}

	if refcount > 0 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"purged":   false,
			"refcount": refcount,
			"error":    fmt.Sprintf("Asset still has %d active references", refcount),
		})
		return
	}

	if err := s.removeAssetFile(storageKey); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusOK, map[string]any{"purged": true, "refcount": 0, "note": "file already absent"})
			return
		}
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to remove asset file: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"purged":   true,
		"refcount": 0,
	})
}

func (s *Server) getMediaContent(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing id")
		return
	}

	var storageKey string
	err := s.DB.QueryRow(`SELECT storage_key FROM media_playlist_items WHERE id = ?`, id).Scan(&storageKey)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Playlist item not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to query media item")
		return
	}

	filename := filepath.Base(filepath.Clean(storageKey))
	filePath := filepath.Join(uploadsDir(), filename)

	st, err := os.Stat(filePath)
	if err != nil || st.IsDir() {
		writeError(w, http.StatusNotFound, "Media file not found on disk")
		return
	}

	f, err := os.Open(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to open media file")
		return
	}
	defer f.Close()

	ext := strings.ToLower(filepath.Ext(filename))
	ct := map[string]string{
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".m4a":  "audio/mp4",
		".ogg":  "audio/ogg",
		".mp4":  "video/mp4",
		".webm": "video/webm",
	}[ext]
	if ct == "" {
		ct = "application/octet-stream"
	}

	w.Header().Set("Content-Type", ct)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	w.Header().Set("Last-Modified", st.ModTime().UTC().Format(http.TimeFormat))
	w.Header().Set("ETag", fmt.Sprintf(`"%x-%x"`, st.ModTime().UnixNano(), st.Size()))

	http.ServeContent(w, r, filename, st.ModTime(), f)
}

func (s *Server) countAssetReferences(storageKey string) (int, error) {
	filename := filepath.Base(filepath.Clean(storageKey))

	var playlistRefs int
	err := s.DB.QueryRow(`
		SELECT COUNT(*) FROM media_playlist_items
		WHERE storage_key = ? OR storage_key LIKE ?
	`, storageKey, "%"+filename).Scan(&playlistRefs)
	if err != nil {
		return 0, err
	}

	var bgRefs int
	err = s.DB.QueryRow(`
		SELECT COUNT(*) FROM background_library_images
		WHERE url LIKE ?
	`, "%"+filename).Scan(&bgRefs)
	if err != nil {
		// Table might not exist in isolated tests, ignore error if missing
		bgRefs = 0
	}

	return playlistRefs + bgRefs, nil
}

func (s *Server) removeAssetFile(storageKey string) error {
	filename := filepath.Base(filepath.Clean(storageKey))
	filePath := filepath.Join(uploadsDir(), filename)
	return os.Remove(filePath)
}
