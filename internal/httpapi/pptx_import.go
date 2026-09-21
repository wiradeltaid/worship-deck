package httpapi

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/pptximport"
)

func newImportedTemplateID() (string, error) {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "import-" + hex.EncodeToString(b[:]), nil
}

var testHookWriteFile func(filename string, data []byte, perm os.FileMode) error = os.WriteFile

func (s *Server) importPptx(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil || sess.Role != "admin" {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}

	// 1. Limit multipart stream before parsing to prevent heap and disk exhaustion DoS
	maxUploadSize := pptximport.MaxCompressedSizeBytes + (1 << 20) // 100 MiB archive + 1 MiB framing margin
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	// Buffer only up to 10 MiB in memory; larger parts are spooled by Go to temporary files
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) || strings.Contains(strings.ToLower(err.Error()), "too large") {
			writeError(w, http.StatusRequestEntityTooLarge, "File exceeds upload limit (100 MiB)")
			return
		}
		writeError(w, http.StatusBadRequest, "Failed to parse upload request")
		return
	}

	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(hdr.Filename), ".pptx") {
		writeError(w, http.StatusBadRequest, "Only .pptx files are supported")
		return
	}

	// Stream upload bytes to temporary disk file with strict 100 MiB limit
	tempUploadFile, err := os.CreateTemp("", "pptx-upload-*.zip")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer func() {
		_ = tempUploadFile.Close()
		_ = os.Remove(tempUploadFile.Name())
	}()

	lr := io.LimitReader(file, pptximport.MaxCompressedSizeBytes+1)
	copied, err := io.Copy(tempUploadFile, lr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to store uploaded presentation")
		return
	}
	if copied > pptximport.MaxCompressedSizeBytes {
		writeError(w, http.StatusBadRequest, "File exceeds upload limit (100 MiB)")
		return
	}

	// 2. Parse presentation directly from disk file (io.ReaderAt)
	parseResult, err := pptximport.ParsePresentation(tempUploadFile, copied)
	if err != nil {
		log.Printf("PPTX parse error: %v", err)
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to parse presentation: %v", err))
		return
	}

	if len(parseResult.Slides) == 0 {
		writeError(w, http.StatusBadRequest, "Presentation contains no slides")
		return
	}

	// 3. Stage extracted images and fonts into an isolated temporary staging directory
	stagingDir, err := os.MkdirTemp("", "pptx-staging-*")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer os.RemoveAll(stagingDir)

	imageURLMap := make(map[string]string, len(parseResult.Images))
	type stagedImage struct {
		filename string
		partPath string
	}
	stagedImages := make([]stagedImage, 0, len(parseResult.Images))

	for _, img := range parseResult.Images {
		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		filename := hex.EncodeToString(b) + img.Ext
		stagePath := filepath.Join(stagingDir, filename)
		if err := os.WriteFile(stagePath, img.Data, 0o644); err != nil {
			log.Printf("Failed to write staged image %s: %v", filename, err)
			writeError(w, http.StatusInternalServerError, "Failed to stage extracted slide images")
			return
		}
		stagedImages = append(stagedImages, stagedImage{
			filename: filename,
			partPath: img.PartPath,
		})
		imageURLMap[img.PartPath] = "/api/uploads/" + filename
	}

	// 3b. Stage extracted fonts (SPEC-32-02)
	type stagedFont struct {
		id             string
		family         string
		sourceTypeface string
		weight         string
		style          string
		format         string
		filename       string
		contentHash    string
		data           []byte
		isRestricted   bool
		isExisting     bool
	}
	stagedFonts := make([]stagedFont, 0, len(parseResult.Fonts))
	stagingFontsDir := filepath.Join(stagingDir, "fonts")
	if len(parseResult.Fonts) > 0 {
		_ = os.MkdirAll(stagingFontsDir, 0o755)
	}

	for _, font := range parseResult.Fonts {
		var existingID string
		err := s.DB.QueryRowContext(r.Context(), `
			SELECT id FROM font_faces
			WHERE content_hash = ? OR (family = ? COLLATE NOCASE AND weight = ? COLLATE NOCASE AND style = ? COLLATE NOCASE)
		`, font.ContentHash, font.Family, font.Weight, font.Style).Scan(&existingID)
		if err == nil && existingID != "" {
			stagedFonts = append(stagedFonts, stagedFont{
				id:          existingID,
				contentHash: font.ContentHash,
				isExisting:  true,
			})
			continue
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			log.Printf("Failed to query font deduplication: %v", err)
			writeError(w, http.StatusInternalServerError, "Database error during font deduplication")
			return
		}

		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		fontID := hex.EncodeToString(b)
		filename := fontID + "." + font.Format
		stagePath := filepath.Join(stagingFontsDir, filename)
		if err := os.WriteFile(stagePath, font.Data, 0o644); err != nil {
			log.Printf("Failed to write staged font %s: %v", filename, err)
			writeError(w, http.StatusInternalServerError, "Failed to stage extracted font faces")
			return
		}
		stagedFonts = append(stagedFonts, stagedFont{
			id:             fontID,
			family:         font.Family,
			sourceTypeface: font.SourceTypeface,
			weight:         font.Weight,
			style:          font.Style,
			format:         font.Format,
			filename:       filename,
			contentHash:    font.ContentHash,
			data:           font.Data,
			isRestricted:   font.Restricted,
			isExisting:     false,
		})
	}

	// 4. Validate and construct all templates before starting SQLite transaction
	type stagedTemplate struct {
		ID      string
		Label   string
		Payload string
	}

	// SPEC-37-01: Reconcile unresolved font status against existing SQLite font_faces
	// If custom fonts in imported slides are already present in font_faces from prior imports,
	// mark them as uploaded/acquired and remove false unacquired warnings across elements, slides, and result.
	reconciledWarnings := make(map[string]bool)
	for _, slide := range parseResult.Slides {
		for j := range slide.Elements {
			el := &slide.Elements[j]
			if el.Type == "text" && el.Style != nil {
				if status, _ := el.Style["fontStatus"].(string); status == "unresolved" {
					family, _ := el.Style["fontFamily"].(string)
					pptxTypeface, _ := el.Style["pptxTypeface"].(string)

					var exists int
					err := s.DB.QueryRowContext(r.Context(), `
						SELECT 1 FROM font_faces
						WHERE (family = ? COLLATE NOCASE OR source_typeface = ? COLLATE NOCASE)
						   OR (family = ? COLLATE NOCASE OR source_typeface = ? COLLATE NOCASE)
						LIMIT 1
					`, family, family, pptxTypeface, pptxTypeface).Scan(&exists)
					if err == nil && exists == 1 {
						el.Style["fontStatus"] = "uploaded"
						warnPrefix := fmt.Sprintf("Custom font '%s' is not embedded in the PPTX package and will require acquisition", family)
						reconciledWarnings[warnPrefix] = true
						if len(el.Warnings) > 0 {
							filtered := make([]string, 0, len(el.Warnings))
							for _, w := range el.Warnings {
								if !strings.Contains(w, warnPrefix) {
									filtered = append(filtered, w)
								}
							}
							el.Warnings = filtered
						}
					}
				}
			}
		}

		if len(reconciledWarnings) > 0 && len(slide.Warnings) > 0 {
			filteredSlideWarns := make([]string, 0, len(slide.Warnings))
			for _, w := range slide.Warnings {
				drop := false
				for prefix := range reconciledWarnings {
					if strings.Contains(w, prefix) {
						drop = true
						break
					}
				}
				if !drop {
					filteredSlideWarns = append(filteredSlideWarns, w)
				}
			}
			slide.Warnings = filteredSlideWarns
		}
	}

	if len(reconciledWarnings) > 0 && len(parseResult.Warnings) > 0 {
		filteredResultWarns := make([]string, 0, len(parseResult.Warnings))
		for _, w := range parseResult.Warnings {
			drop := false
			for prefix := range reconciledWarnings {
				if strings.Contains(w, prefix) {
					drop = true
					break
				}
			}
			if !drop {
				filteredResultWarns = append(filteredResultWarns, w)
			}
		}
		parseResult.Warnings = filteredResultWarns
	}

	staged := make([]stagedTemplate, 0, len(parseResult.Slides))
	now := time.Now().UTC().Format(time.RFC3339Nano)

	for i, slide := range parseResult.Slides {
		id, err := newImportedTemplateID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		label := fmt.Sprintf("Imported Slide %d", i+1)
		payloadBytes, err := pptximport.BuildTemplatePayload(id, label, slide, imageURLMap, "")
		if err != nil {
			log.Printf("Template validation failed for slide %d: %v", i+1, err)
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Slide %d failed validation: %v", i+1, err))
			return
		}
		staged = append(staged, stagedTemplate{
			ID:      id,
			Label:   label,
			Payload: string(payloadBytes),
		})
	}

	// 5. Commit all templates and font records atomically in a single SQLite transaction
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	var startPos int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM artifact_templates`).Scan(&startPos); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	for idx, item := range staged {
		pos := startPos + idx
		_, err := tx.Exec(
			`INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position, ann_set_id, variable_name)
			 VALUES (?, ?, 'general', ?, ?, NULL, ?, NULL, NULL)`,
			item.ID, item.Label, item.Payload, now, pos,
		)
		if err != nil {
			log.Printf("Failed to insert imported template %s: %v", item.ID, err)
			writeError(w, http.StatusInternalServerError, "Failed to commit imported templates")
			return
		}
	}

	// Insert new font face records into font_faces
	for _, font := range stagedFonts {
		if font.isExisting {
			continue
		}
		restrictedInt := 0
		if font.isRestricted {
			restrictedInt = 1
		}
		_, err := tx.ExecContext(r.Context(), `
			INSERT INTO font_faces (id, family, source_typeface, weight, style, format, asset_path, content_hash, is_restricted)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(family COLLATE NOCASE, weight COLLATE NOCASE, style COLLATE NOCASE) DO NOTHING
		`, font.id, font.family, font.sourceTypeface, font.weight, font.style, font.format, font.filename, font.contentHash, restrictedInt)
		if err != nil {
			log.Printf("Failed to insert font face %s: %v", font.id, err)
			writeError(w, http.StatusInternalServerError, "Failed to commit imported font faces")
			return
		}
	}

	// 6. Before commit: promote all staged files to permanent uploadsDir()
	destUploadsDir := uploadsDir()
	if err := os.MkdirAll(destUploadsDir, 0o755); err != nil {
		log.Printf("Failed to create uploads directory: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to access uploads storage")
		return
	}

	destFontsDir := filepath.Join(destUploadsDir, "fonts")
	if len(stagedFonts) > 0 {
		if err := os.MkdirAll(destFontsDir, 0o755); err != nil {
			log.Printf("Failed to create fonts directory: %v", err)
			writeError(w, http.StatusInternalServerError, "Failed to access font storage")
			return
		}
	}

	var promotedFiles []string
	var promotedFonts []string
	rollbackAll := func() {
		for _, f := range promotedFiles {
			_ = os.Remove(filepath.Join(destUploadsDir, f))
		}
		for _, f := range promotedFonts {
			_ = os.Remove(filepath.Join(destFontsDir, f))
		}
	}

	promotionFailed := false
	for _, img := range stagedImages {
		src := filepath.Join(stagingDir, img.filename)
		dst := filepath.Join(destUploadsDir, img.filename)
		tmpDst := dst + ".tmp"
		data, err := os.ReadFile(src)
		if err != nil {
			promotionFailed = true
			break
		}
		if err := testHookWriteFile(tmpDst, data, 0o644); err != nil {
			_ = os.Remove(tmpDst)
			promotionFailed = true
			break
		}
		if err := os.Rename(tmpDst, dst); err != nil {
			_ = os.Remove(tmpDst)
			promotionFailed = true
			break
		}
		promotedFiles = append(promotedFiles, img.filename)
	}

	if !promotionFailed {
		for _, font := range stagedFonts {
			if font.isExisting {
				continue
			}
			src := filepath.Join(stagingFontsDir, font.filename)
			dst := filepath.Join(destFontsDir, font.filename)
			tmpDst := dst + ".tmp"
			data, err := os.ReadFile(src)
			if err != nil {
				promotionFailed = true
				break
			}
			if err := testHookWriteFile(tmpDst, data, 0o644); err != nil {
				_ = os.Remove(tmpDst)
				promotionFailed = true
				break
			}
			if err := os.Rename(tmpDst, dst); err != nil {
				_ = os.Remove(tmpDst)
				promotionFailed = true
				break
			}
			promotedFonts = append(promotedFonts, font.filename)
		}
	}

	if promotionFailed {
		rollbackAll()
		writeError(w, http.StatusInternalServerError, "Failed to promote slide assets to permanent storage")
		return
	}

	if err := tx.Commit(); err != nil {
		rollbackAll()
		log.Printf("Transaction commit failed: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to commit imported templates")
		return
	}

	// 7. Load first template and summaries for response
	firstID := staged[0].ID
	firstRaw, err := s.loadArtifactJSON(firstID)
	if err != nil {
		log.Printf("Failed to load imported template %s: %v", firstID, err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	var firstTemplate map[string]any
	_ = json.Unmarshal(firstRaw, &firstTemplate)

	createdSummaries := make([]artifactSummary, 0, len(staged))
	for _, item := range staged {
		createdSummaries = append(createdSummaries, artifactSummary{
			ID:         item.ID,
			Label:      item.Label,
			BaseType:   "general",
			UpdatedAt:  now,
			Editable:   true,
			Resettable: false,
		})
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"importedCount": len(staged),
		"templates":     createdSummaries,
		"firstTemplate": firstTemplate,
		"importedFonts": len(stagedFonts),
		"warnings":      parseResult.Warnings,
	})
}
