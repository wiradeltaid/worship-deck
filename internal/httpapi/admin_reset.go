package httpapi

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wiradeltaid/worship-deck/internal/db"
)

type FactoryResetRequest struct {
	Confirm string `json:"confirm"`
}

func cleanUploadsDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("reading uploads dir: %w", err)
	}
	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())
		if entry.IsDir() {
			// Strictly preserve fonts directory
			if strings.EqualFold(entry.Name(), "fonts") {
				continue
			}
			if err := os.RemoveAll(path); err != nil {
				return fmt.Errorf("removing directory %s: %w", entry.Name(), err)
			}
			continue
		}
		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))
		if ext == ".ttf" || ext == ".woff" || ext == ".woff2" || name == ".gitkeep" {
			continue
		}
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("removing file %s: %w", name, err)
		}
	}
	return nil
}

func (s *Server) handleResetFactory(w http.ResponseWriter, r *http.Request) {
	// Security gate: 401 on unauthenticated, 403 on non-admin
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if sess.Role != "admin" {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}

	var req FactoryResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.ToLower(strings.TrimSpace(req.Confirm)) != "factory reset" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":   "invalid_confirmation",
			"message": "Confirmation phrase 'factory reset' is required",
		})
		return
	}

	// Clean uploads directory, strictly preserving bundled fonts
	if err := cleanUploadsDir(uploadsDir()); err != nil {
		log.Printf("[reset-factory] clean uploads dir error: %v", err)
		writeError(w, http.StatusInternalServerError, "Factory reset failed")
		return
	}

	// Reset database tables and reseed canonical defaults
	if err := db.ResetToFactory(s.DB, s.Root); err != nil {
		log.Printf("[reset-factory] db reset error: %v", err)
		writeError(w, http.StatusInternalServerError, "Factory reset failed")
		return
	}

	log.Printf("[reset-factory] administrator (UID %d) successfully executed whole-application factory reset", sess.UID)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Factory reset complete",
	})
}
