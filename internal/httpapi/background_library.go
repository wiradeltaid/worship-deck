package httpapi

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-presenter-web/internal/plan"
)

// BackgroundLibraryImage represents one image in the background or media library (UC-25, S10, SPEC-39, SPEC-40).
type backgroundLibraryImage struct {
	ID        int    `json:"id"`
	URL       string `json:"url"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	IsDefault bool   `json:"isDefault"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// listBackgroundLibrary serves GET /api/admin/background-library and GET /api/admin/media-library (UC-25, SPEC-39, SPEC-40).
func (s *Server) listBackgroundLibrary(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	category := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("category")))
	if category == "flyer" {
		category = "announcement"
	}
	var rows *sql.Rows
	var err error
	if category == "announcement" {
		rows, err = s.DB.Query(
			`SELECT id, COALESCE(url, ''), COALESCE(name, ''), is_default, COALESCE(created_at, ''), COALESCE(updated_at, ''), COALESCE(category, 'background')
			   FROM background_library_images
			  WHERE (category = 'announcement' OR category = 'flyer')
			  ORDER BY id ASC`,
		)
	} else if category != "" && category != "all" {
		rows, err = s.DB.Query(
			`SELECT id, COALESCE(url, ''), COALESCE(name, ''), is_default, COALESCE(created_at, ''), COALESCE(updated_at, ''), COALESCE(category, 'background')
			   FROM background_library_images
			  WHERE category = ?
			  ORDER BY id ASC`,
			category,
		)
	} else {
		rows, err = s.DB.Query(
			`SELECT id, COALESCE(url, ''), COALESCE(name, ''), is_default, COALESCE(created_at, ''), COALESCE(updated_at, ''), COALESCE(category, 'background')
			   FROM background_library_images
			  ORDER BY id ASC`,
		)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()

	images := []backgroundLibraryImage{}
	for rows.Next() {
		var img backgroundLibraryImage
		var isDef int
		if err := rows.Scan(&img.ID, &img.URL, &img.Name, &isDef, &img.CreatedAt, &img.UpdatedAt, &img.Category); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if img.Category == "flyer" {
			img.Category = "announcement"
		}
		img.IsDefault = (isDef == 1)
		images = append(images, img)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"images": images})
}

// listBackgroundLibraryForOperator serves GET /api/background-library and GET /api/media-library for any signed-in Hub user/operator (FR-32, UC-27, SPEC-39, SPEC-40).
func (s *Server) listBackgroundLibraryForOperator(w http.ResponseWriter, r *http.Request) {
	if sessionFrom(r) == nil {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	category := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("category")))
	if category == "flyer" {
		category = "announcement"
	}
	var rows *sql.Rows
	var err error
	if category == "announcement" {
		rows, err = s.DB.Query(
			`SELECT id, COALESCE(url, ''), COALESCE(name, ''), is_default, COALESCE(category, 'background')
			   FROM background_library_images
			  WHERE (category = 'announcement' OR category = 'flyer')
			  ORDER BY id ASC`,
		)
	} else if category != "" && category != "all" {
		rows, err = s.DB.Query(
			`SELECT id, COALESCE(url, ''), COALESCE(name, ''), is_default, COALESCE(category, 'background')
			   FROM background_library_images
			  WHERE category = ?
			  ORDER BY id ASC`,
			category,
		)
	} else {
		rows, err = s.DB.Query(
			`SELECT id, COALESCE(url, ''), COALESCE(name, ''), is_default, COALESCE(category, 'background')
			   FROM background_library_images
			  ORDER BY id ASC`,
		)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()

	type opImage struct {
		ID        int    `json:"id"`
		URL       string `json:"url"`
		Name      string `json:"name"`
		Category  string `json:"category"`
		IsDefault bool   `json:"isDefault"`
	}
	images := []opImage{}
	for rows.Next() {
		var img opImage
		var isDef int
		if err := rows.Scan(&img.ID, &img.URL, &img.Name, &isDef, &img.Category); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if img.Category == "flyer" {
			img.Category = "announcement"
		}
		img.IsDefault = (isDef == 1)
		images = append(images, img)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"images": images})
}

// createBackgroundLibraryImage serves POST /api/admin/background-library (UC-25).
// Body: { url, isDefault? } - must be a valid image reference (AD-8, S10).
func (s *Server) createBackgroundLibraryImage(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	rawURL, _ := body["url"].(string)
	imageURL := strings.TrimSpace(rawURL)
	if imageURL == "" {
		writeError(w, http.StatusBadRequest, "Background must be an image")
		return
	}
	if !plan.IsRegistryImageRef(imageURL, s.Root) {
		writeError(w, http.StatusBadRequest, "Background must be an image")
		return
	}

	isDef := false
	if v, ok := body["isDefault"].(bool); ok && v {
		isDef = true
	}

	rawName, _ := body["name"].(string)
	name := strings.TrimSpace(rawName)

	rawCategory, _ := body["category"].(string)
	category := strings.ToLower(strings.TrimSpace(rawCategory))
	if category == "flyer" {
		category = "announcement"
	}
	if category == "" {
		category = "background"
	} else if category != "background" && category != "announcement" && category != "general" {
		category = "general"
	}

	now := timeNowRFC3339Nano()
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if isDef {
		if _, err := tx.Exec(`UPDATE background_library_images SET is_default = 0, updated_at = ? WHERE is_default = 1`, now); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	isDefInt := 0
	if isDef {
		isDefInt = 1
	}

	res, err := tx.Exec(
		`INSERT INTO background_library_images (url, name, is_default, created_at, updated_at, category) VALUES (?, ?, ?, ?, ?, ?)`,
		imageURL, name, isDefInt, now, now, category,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusCreated, backgroundLibraryImage{
		ID:        int(id),
		URL:       imageURL,
		Name:      name,
		Category:  category,
		IsDefault: isDef,
		CreatedAt: now,
		UpdatedAt: now,
	})
}

// patchBackgroundLibraryImage serves PATCH /api/admin/background-library/{id} (UC-25).
// Mark this image as the global default (clears any prior default) or updates name/category/default state.
func (s *Server) patchBackgroundLibraryImage(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid image ID")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}

	var storedUpdated string
	var currentURL string
	var currentName string
	var currentDef int
	var currentCategory string
	var currentCreatedAt string
	err = s.DB.QueryRow(
		`SELECT url, COALESCE(name, ''), is_default, COALESCE(created_at, ''), updated_at, COALESCE(category, 'background')
		   FROM background_library_images
		  WHERE id = ?`,
		id,
	).Scan(&currentURL, &currentName, &currentDef, &currentCreatedAt, &storedUpdated, &currentCategory)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Image not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Image was modified by another session")
		return
	}

	if currentCategory == "flyer" {
		currentCategory = "announcement"
	}

	if rawName, ok := body["name"].(string); ok {
		currentName = strings.TrimSpace(rawName)
	}

	if rawCat, ok := body["category"].(string); ok {
		cat := strings.ToLower(strings.TrimSpace(rawCat))
		if cat == "flyer" {
			cat = "announcement"
		}
		if cat == "background" || cat == "announcement" || cat == "general" {
			currentCategory = cat
		}
	}

	isDef := (currentDef == 1)
	if v, ok := body["isDefault"].(bool); ok {
		isDef = v
	}

	now := timeNowRFC3339Nano()
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if isDef && currentDef != 1 {
		if _, err := tx.Exec(`UPDATE background_library_images SET is_default = 0, updated_at = ? WHERE is_default = 1 AND id != ?`, now, id); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	isDefInt := 0
	if isDef {
		isDefInt = 1
	}

	res, err := tx.Exec(
		`UPDATE background_library_images SET name = ?, is_default = ?, category = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
		currentName, isDefInt, currentCategory, now, id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Image was modified by another session")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, backgroundLibraryImage{
		ID:        int(id),
		URL:       currentURL,
		Name:      currentName,
		Category:  currentCategory,
		IsDefault: isDef,
		CreatedAt: currentCreatedAt,
		UpdatedAt: now,
	})
}

// replaceBackgroundLibraryImage serves POST /api/admin/media-library/{id}/replace and POST /api/admin/background-library/{id}/replace (SPEC-40).
// Atomically replaces the image asset file on disk while strictly preserving record ID and URL path.
func (s *Server) replaceBackgroundLibraryImage(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid image ID")
		return
	}

	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "No file uploaded or file exceeds 20MB limit")
		return
	}

	updatedAt := strings.TrimSpace(r.FormValue("updatedAt"))
	if updatedAt == "" {
		updatedAt = strings.TrimSpace(r.Header.Get("X-Updated-At"))
	}
	if updatedAt == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}

	var storedUpdated string
	var currentURL string
	var currentName string
	var currentDef int
	var currentCategory string
	var currentCreatedAt string
	err := s.DB.QueryRow(
		`SELECT url, COALESCE(name, ''), is_default, COALESCE(created_at, ''), updated_at, COALESCE(category, 'background')
		   FROM background_library_images
		  WHERE id = ?`,
		id,
	).Scan(&currentURL, &currentName, &currentDef, &currentCreatedAt, &storedUpdated, &currentCategory)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Image not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Image was modified by another session")
		return
	}

	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file parameter is required")
		return
	}
	defer file.Close()

	ct := hdr.Header.Get("Content-Type")
	if ct != "" && !strings.HasPrefix(ct, "image/") {
		writeError(w, http.StatusBadRequest, "File must be an image")
		return
	}
	ext := normalizeExt(hdr.Filename)
	if ext == "" {
		writeError(w, http.StatusBadRequest, "Unsupported image type (use .jpg, .jpeg, .png, .gif, or .webp)")
		return
	}

	buf, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read replacement image")
		return
	}

	if len(buf) == 0 {
		writeError(w, http.StatusBadRequest, "Empty image file")
		return
	}

	// Invariant: The stored URL and filename are strictly preserved.
	// Only valid uploaded gallery assets (/api/uploads/<32-hex>.<ext>) can be replaced in-place.
	if !strings.HasPrefix(currentURL, "/api/uploads/") {
		writeError(w, http.StatusBadRequest, "Only uploaded gallery assets can be replaced in-place")
		return
	}
	targetFilename := strings.TrimPrefix(currentURL, "/api/uploads/")
	if !uploadRef.MatchString(targetFilename) {
		writeError(w, http.StatusBadRequest, "Invalid upload asset filename")
		return
	}

	dir := uploadsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	targetPath := filepath.Join(dir, targetFilename)
	tempPath := filepath.Join(dir, fmt.Sprintf("tmp_%d_%s", time.Now().UnixNano(), targetFilename))

	if err := os.WriteFile(tempPath, buf, 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to write temporary image")
		return
	}

	// Concurrency guard: win atomic database CAS lock inside a transaction BEFORE touching targetPath on disk.
	tx, err := s.DB.Begin()
	if err != nil {
		_ = os.Remove(tempPath)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	now := timeNowRFC3339Nano()
	res, err := tx.Exec(
		`UPDATE background_library_images
		    SET updated_at = ?,
		        category = CASE WHEN category = 'flyer' THEN 'announcement' ELSE category END
		  WHERE id = ? AND updated_at = ?`,
		now, id, updatedAt,
	)
	if err != nil {
		_ = os.Remove(tempPath)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		_ = os.Remove(tempPath)
		writeError(w, http.StatusConflict, "Image was modified by another session")
		return
	}

	// Having won the atomic database CAS lock, commit the in-place file rename
	if err := os.Rename(tempPath, targetPath); err != nil {
		_ = os.Remove(tempPath)
		writeError(w, http.StatusInternalServerError, "Failed to overwrite image file")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if currentCategory == "flyer" {
		currentCategory = "announcement"
	}

	writeJSON(w, http.StatusOK, backgroundLibraryImage{
		ID:        id,
		URL:       currentURL,
		Name:      currentName,
		Category:  currentCategory,
		IsDefault: (currentDef == 1),
		CreatedAt: currentCreatedAt,
		UpdatedAt: now,
	})
}

// deleteBackgroundLibraryImage serves DELETE /api/admin/background-library/{id} (UC-25).
func (s *Server) deleteBackgroundLibraryImage(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid image ID")
		return
	}
	body, err, status, msg := readJSONObjectOptional(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		updatedAt = r.URL.Query().Get("updated_at")
	}
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}

	var storedUpdated string
	err = s.DB.QueryRow(
		`SELECT updated_at FROM background_library_images WHERE id = ?`, id,
	).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Image not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Image was modified by another session")
		return
	}

	res, err := s.DB.Exec(
		`DELETE FROM background_library_images WHERE id = ? AND updated_at = ?`,
		id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Image was modified by another session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
}
