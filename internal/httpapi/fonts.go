package httpapi

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/wiradigitalid/worship-presenter-web/internal/pptximport"
)

var fontIDRegex = regexp.MustCompile(`(?i)^[a-f0-9]{8,64}(\.(ttf|otf|woff2?))?$`)

type FontFaceResponse struct {
	ID             string `json:"id"`
	Family         string `json:"family"`
	SourceTypeface string `json:"sourceTypeface"`
	Weight         string `json:"weight"`
	Style          string `json:"style"`
	Format         string `json:"format"`
	URL            string `json:"url"`
}

func (s *Server) listFonts(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.QueryContext(r.Context(), `
		SELECT id, family, source_typeface, weight, style, format
		FROM font_faces
		ORDER BY family, weight, style
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list font faces")
		return
	}
	defer rows.Close()

	fonts := make([]FontFaceResponse, 0)
	for rows.Next() {
		var f FontFaceResponse
		if err := rows.Scan(&f.ID, &f.Family, &f.SourceTypeface, &f.Weight, &f.Style, &f.Format); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to read font faces")
			return
		}
		f.URL = "/api/fonts/" + f.ID
		fonts = append(fonts, f)
	}

	writeJSON(w, http.StatusOK, fonts)
}

func (s *Server) getFont(w http.ResponseWriter, r *http.Request) {
	rawID := r.PathValue("id")
	rawID = strings.TrimSpace(rawID)
	if rawID == "" || !fontIDRegex.MatchString(rawID) || strings.Contains(rawID, "..") || strings.Contains(rawID, "/") {
		writeError(w, http.StatusBadRequest, "Invalid font identifier")
		return
	}

	lookupID := rawID
	if idx := strings.Index(lookupID, "."); idx != -1 {
		lookupID = lookupID[:idx]
	}

	var assetPath, format string
	err := s.DB.QueryRowContext(r.Context(), `
		SELECT asset_path, format FROM font_faces WHERE id = ?
	`, lookupID).Scan(&assetPath, &format)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Font not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Database error")
		return
	}

	fontsDir := filepath.Join(uploadsDir(), "fonts")
	fullPath := filepath.Join(fontsDir, filepath.Base(assetPath))
	data, err := os.ReadFile(fullPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "Font asset missing on disk")
		return
	}

	var contentType string
	switch strings.ToLower(format) {
	case "ttf":
		contentType = "font/ttf"
	case "otf":
		contentType = "font/otf"
	case "woff":
		contentType = "font/woff"
	case "woff2":
		contentType = "font/woff2"
	default:
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

type FontManifestEntry struct {
	Family string `json:"family"`
	Weight string `json:"weight"`
	Style  string `json:"style"`
	Path   string `json:"path"`
}

func (s *Server) getFontManifest(ctx context.Context) ([]FontManifestEntry, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT family, weight, style, asset_path
		FROM font_faces
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fontsDir := filepath.Join(uploadsDir(), "fonts")
	var manifest []FontManifestEntry
	for rows.Next() {
		var family, weight, style, assetPath string
		if err := rows.Scan(&family, &weight, &style, &assetPath); err != nil {
			continue
		}
		manifest = append(manifest, FontManifestEntry{
			Family: family,
			Weight: weight,
			Style:  style,
			Path:   filepath.Join(fontsDir, filepath.Base(assetPath)),
		})
	}
	return manifest, nil
}

const maxFontUploadSizeBytes = 16 * 1024 * 1024 // 16 MiB (SPEC-33-03)

func (s *Server) uploadFont(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxFontUploadSizeBytes)
	if err := r.ParseMultipartForm(maxFontUploadSizeBytes); err != nil {
		writeError(w, http.StatusBadRequest, "File exceeds maximum size of 16 MiB or malformed form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Missing required 'file' in multipart form")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".ttf" && ext != ".otf" {
		writeError(w, http.StatusBadRequest, "Only .ttf and .otf font files are supported")
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to read font upload data")
		return
	}

	normalizedData, format, err := pptximport.ValidateAndDeobfuscateFont(data, header.Filename)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid font file: %v", err))
		return
	}

	// Determine family, weight, style using SFNT name table metadata where available
	meta, metaErr := pptximport.ParseSFNTMetadata(normalizedData)

	reqFamily := strings.TrimSpace(r.FormValue("family"))
	reqWeight := strings.TrimSpace(r.FormValue("weight"))
	reqStyle := strings.TrimSpace(r.FormValue("style"))

	rawBaseName := strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename))
	normalizedFamily, parsedWeight, parsedStyle, _ := pptximport.NormalizeTypeface(rawBaseName, "", "")

	var family, weight, style, sourceTypeface string
	if metaErr == nil && meta != nil && meta.Family != "" {
		family = meta.Family
		weight = meta.Weight
		style = meta.Style
		sourceTypeface = meta.SourceTypeface
	} else {
		family = normalizedFamily
		weight = parsedWeight
		style = parsedStyle
		sourceTypeface = rawBaseName
	}

	if reqFamily != "" {
		family = reqFamily
		sourceTypeface = reqFamily
	}
	if reqWeight != "" {
		weight = reqWeight
	}
	if reqStyle != "" {
		style = reqStyle
	}

	hash := sha256.Sum256(normalizedData)
	contentHash := hex.EncodeToString(hash[:])
	fontID := contentHash[:16]
	assetFilename := fmt.Sprintf("%s.%s", fontID, format)

	// Check if already present in font_faces
	var existing FontFaceResponse
	err = s.DB.QueryRowContext(r.Context(), `
		SELECT id, family, source_typeface, weight, style, format
		FROM font_faces WHERE content_hash = ?
	`, contentHash).Scan(&existing.ID, &existing.Family, &existing.SourceTypeface, &existing.Weight, &existing.Style, &existing.Format)
	if err == nil {
		existing.URL = "/api/fonts/" + existing.ID
		writeJSON(w, http.StatusOK, existing)
		return
	}

	destFontsDir := filepath.Join(uploadsDir(), "fonts")
	if err := os.MkdirAll(destFontsDir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to access font storage directory")
		return
	}

	fullPath := filepath.Join(destFontsDir, assetFilename)
	tmpPath := fullPath + ".tmp"
	if err := testHookWriteFile(tmpPath, normalizedData, 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save font file")
		return
	}
	if err := os.Rename(tmpPath, fullPath); err != nil {
		_ = os.Remove(tmpPath)
		writeError(w, http.StatusInternalServerError, "Failed to commit font file")
		return
	}

	_, err = s.DB.ExecContext(r.Context(), `
		INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, fontID, family, sourceTypeface, weight, style, format, assetFilename, contentHash)
	if err != nil {
		_ = os.Remove(fullPath)
		writeError(w, http.StatusInternalServerError, "Failed to record font face in database")
		return
	}

	resp := FontFaceResponse{
		ID:             fontID,
		Family:         family,
		SourceTypeface: sourceTypeface,
		Weight:         weight,
		Style:          style,
		Format:         format,
		URL:            "/api/fonts/" + fontID,
	}
	writeJSON(w, http.StatusCreated, resp)
}
