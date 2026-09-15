package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
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

