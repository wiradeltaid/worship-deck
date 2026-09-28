package httpapi

import (
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
	"sync"
)

var (
	assetIdRegex = regexp.MustCompile(`^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$`)
	syncUploadMu sync.Mutex
)

type SyncAssetsCheckRequest struct {
	Hashes []string `json:"hashes"`
}

type SyncAssetsCheckResponse struct {
	Missing []string `json:"missing"`
}

func findAssetBySHA256(dir, hash string) (string, error) {
	hash = strings.ToLower(strings.TrimSpace(hash))
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return "", os.ErrNotExist
		}
		return "", err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := strings.ToLower(entry.Name())
		if !uploadRef.MatchString(name) {
			continue
		}
		ext := filepath.Ext(name)
		stem := strings.TrimSuffix(name, ext)
		if stem == hash {
			return filepath.Join(dir, entry.Name()), nil
		}
	}
	return "", os.ErrNotExist
}

// POST /api/sync/assets/check
func (s *Server) syncAssetsCheck(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var req SyncAssetsCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dir := uploadsDir()
	var missing []string

	for _, h := range req.Hashes {
		h = strings.TrimSpace(h)
		if !assetIdRegex.MatchString(h) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid asset identifier: %s", h))
			return
		}
		if _, err := findAssetBySHA256(dir, h); err != nil {
			missing = append(missing, h)
		}
	}

	if missing == nil {
		missing = []string{}
	}

	writeJSON(w, http.StatusOK, SyncAssetsCheckResponse{
		Missing: missing,
	})
}

// POST /api/sync/assets/upload
func (s *Server) syncAssetUpload(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	expectedHash := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Content-SHA256")))
	if expectedHash == "" {
		expectedHash = strings.ToLower(strings.TrimSpace(r.Header.Get("X-Asset-Identifier")))
	}
	if expectedHash == "" || !assetIdRegex.MatchString(expectedHash) {
		writeError(w, http.StatusBadRequest, "X-Content-SHA256 header is required and must be a 32 or 64 character hex string")
		return
	}

	dir := uploadsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create uploads directory")
		return
	}

	rawFilename := strings.TrimSpace(r.URL.Query().Get("filename"))
	if rawFilename == "" {
		rawFilename = strings.TrimSpace(r.Header.Get("X-Filename"))
	}

	var filename string
	if rawFilename != "" {
		if strings.Contains(rawFilename, "/") || strings.Contains(rawFilename, "\\") || strings.Contains(rawFilename, "..") || filepath.Base(rawFilename) != rawFilename {
			writeError(w, http.StatusBadRequest, "Invalid filename: path traversal is forbidden")
			return
		}
		ext := strings.ToLower(filepath.Ext(rawFilename))
		stem := strings.ToLower(strings.TrimSuffix(rawFilename, ext))
		if assetIdRegex.MatchString(stem) && !strings.EqualFold(stem, expectedHash) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Filename stem (%s) does not match declared identifier (%s)", stem, expectedHash))
			return
		}
		if ext == "" || !uploadRef.MatchString(expectedHash+ext) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported asset extension: %s", ext))
			return
		}
		filename = expectedHash + ext
	} else {
		ct := r.Header.Get("Content-Type")
		ext := ".bin"
		switch {
		case strings.Contains(ct, "png"):
			ext = ".png"
		case strings.Contains(ct, "jpeg") || strings.Contains(ct, "jpg"):
			ext = ".jpg"
		case strings.Contains(ct, "webp"):
			ext = ".webp"
		case strings.Contains(ct, "gif"):
			ext = ".gif"
		}
		filename = expectedHash + ext
	}

	destPath := filepath.Join(dir, filename)

	// Deduplication short-circuit: if content-addressed asset already exists, return immediately
	if existingFile, err := findAssetBySHA256(dir, expectedHash); err == nil && existingFile != "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"sha256":       expectedHash,
			"url":          "/api/uploads/" + filepath.Base(existingFile),
			"filename":     filepath.Base(existingFile),
			"deduplicated": true,
		})
		return
	}

	buf, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 50<<20)) // 50MB limit
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to read upload body or file too large")
		return
	}
	if len(buf) == 0 {
		writeError(w, http.StatusBadRequest, "Empty upload body")
		return
	}

	if len(expectedHash) == 64 {
		hasher := sha256.New()
		hasher.Write(buf)
		actualHash := hex.EncodeToString(hasher.Sum(nil))

		if expectedHash != actualHash {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error":    "hash_mismatch",
				"message":  fmt.Sprintf("SHA256 mismatch: expected %s, got %s", expectedHash, actualHash),
				"expected": expectedHash,
				"actual":   actualHash,
			})
			return
		}
	}

	// Write atomically via unique temporary file in the same directory
	tmpFile, err := os.CreateTemp(dir, "upload-*.tmp")
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create temporary upload file: %v", err))
		return
	}
	tmpName := tmpFile.Name()
	defer func() {
		_ = os.Remove(tmpName)
	}()

	if _, err := tmpFile.Write(buf); err != nil {
		_ = tmpFile.Close()
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to write temporary upload file: %v", err))
		return
	}
	if err := tmpFile.Sync(); err != nil {
		_ = tmpFile.Close()
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to sync temporary upload file: %v", err))
		return
	}
	if err := tmpFile.Close(); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to close temporary upload file: %v", err))
		return
	}

	syncUploadMu.Lock()
	defer syncUploadMu.Unlock()

	// Concurrency protection: if asset was committed concurrently while writing tmp file
	if existingFile, err := findAssetBySHA256(dir, expectedHash); err == nil && existingFile != "" {
		_ = os.Remove(tmpName)
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"sha256":       expectedHash,
			"url":          "/api/uploads/" + filepath.Base(existingFile),
			"filename":     filepath.Base(existingFile),
			"deduplicated": true,
		})
		return
	}

	if err := os.Rename(tmpName, destPath); err != nil {
		if existingFile, fErr := findAssetBySHA256(dir, expectedHash); fErr == nil && existingFile != "" {
			_ = os.Remove(tmpName)
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":           true,
				"sha256":       expectedHash,
				"url":          "/api/uploads/" + filepath.Base(existingFile),
				"filename":     filepath.Base(existingFile),
				"deduplicated": true,
			})
			return
		}
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to commit asset: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"sha256":       expectedHash,
		"url":          "/api/uploads/" + filename,
		"filename":     filename,
		"deduplicated": false,
	})
}

// GET /api/sync/assets/{sha256}
func (s *Server) syncAssetDownload(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	hash := strings.TrimSpace(r.PathValue("sha256"))
	if !assetIdRegex.MatchString(hash) {
		writeError(w, http.StatusBadRequest, "Invalid SHA256 parameter")
		return
	}

	dir := uploadsDir()
	filePath, err := findAssetBySHA256(dir, hash)
	if err != nil {
		writeError(w, http.StatusNotFound, "Asset not found")
		return
	}

	f, err := os.Open(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to open asset")
		return
	}
	defer f.Close()

	st, err := f.Stat()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to inspect asset")
		return
	}

	w.Header().Set("X-Content-SHA256", strings.ToLower(hash))
	http.ServeContent(w, r, filepath.Base(filePath), st.ModTime(), f)
}
