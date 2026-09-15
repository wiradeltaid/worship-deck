package httpapi

import (
	"crypto/rand"
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

	"github.com/wiradigitalid/worship-presenter-web/internal/pptximport"
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

	// 3. Stage extracted images into an isolated temporary staging directory
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

	// 4. Validate and construct all templates before starting SQLite transaction
	type stagedTemplate struct {
		ID      string
		Label   string
		Payload string
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

	// 5. Commit all templates atomically in a single SQLite transaction
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

	// 6. Before commit: promote all staged files to permanent uploadsDir()
	destUploadsDir := uploadsDir()
	if err := os.MkdirAll(destUploadsDir, 0o755); err != nil {
		log.Printf("Failed to create uploads directory: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to access uploads storage")
		return
	}

	var promotedFiles []string
	rollbackPromotedFiles := func() {
		for _, f := range promotedFiles {
			_ = os.Remove(filepath.Join(destUploadsDir, f))
		}
	}

	promotionFailed := false
	for _, img := range stagedImages {
		src := filepath.Join(stagingDir, img.filename)
		dst := filepath.Join(destUploadsDir, img.filename)
		data, err := os.ReadFile(src)
		if err != nil {
			promotionFailed = true
			break
		}
		if err := testHookWriteFile(dst, data, 0o644); err != nil {
			_ = os.Remove(dst)
			promotionFailed = true
			break
		}
		promotedFiles = append(promotedFiles, img.filename)
	}

	if promotionFailed {
		rollbackPromotedFiles()
		writeError(w, http.StatusInternalServerError, "Failed to promote slide images to permanent storage")
		return
	}

	if err := tx.Commit(); err != nil {
		rollbackPromotedFiles()
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
	})
}
