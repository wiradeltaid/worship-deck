package httpapi

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/parse"
	"github.com/wiradeltaid/worship-deck/internal/plan"
)

func (s *Server) postWebhook(w http.ResponseWriter, r *http.Request) {
	env := os.Getenv("WEBHOOK_SECRET")
	if env == "" {
		writeError(w, http.StatusServiceUnavailable, "Webhook not configured (WEBHOOK_SECRET missing)")
		return
	}
	provided := r.Header.Get("X-Webhook-Secret")
	if provided == "" {
		authz := r.Header.Get("Authorization")
		provided = regexpReplaceBearer(authz)
	}
	if provided == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(env)) != 1 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	body, err, status, msg := readJSONObject(r, 4<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	if asString(body["action"]) == "correct" {
		s.handleCorrection(w, body)
		return
	}
	rawPayload := asString(body["text"])
	if rawPayload == "" {
		if msg, ok := body["message"].(map[string]any); ok {
			rawPayload = asString(msg["text"])
		}
	}
	if rawPayload == "" {
		writeError(w, http.StatusBadRequest, "Missing or invalid text payload in request body")
		return
	}
	parsed := parse.ParseRundown(s.DB, rawPayload)
	serviceDate := parse.LocalISODate(time.Now())
	if parsed.Date != nil && *parsed.Date != "" {
		serviceDate = *parsed.Date
	}
	parsedJSON, _ := json.Marshal(parsed)
	urls := plan.CoerceImageURLs(body["images"])
	imagesJSON, _ := json.Marshal(urls)
	var existingID int
	err = s.DB.QueryRow(`SELECT id FROM services WHERE date = ?`, serviceDate).Scan(&existingID)
	if err == nil {
		snap, loadErr := s.loadServiceSnapshot(existingID)
		if loadErr != nil {
			log.Printf("Error processing webhook: %v", loadErr)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		writeWebhookConflict(w, snap, webhookDateConflictMsg)
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("Error processing webhook: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	profileID := db.BuiltinDefaultParserProfileID
	profileVersion := 1

	tx, err := s.DB.Begin()
	if err != nil {
		log.Printf("Error processing webhook: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(
		`INSERT INTO services (date, raw_payload, parsed_data, images_payload, afternoon_program, parser_profile_id, parser_profile_version, updated_at)
		 VALUES (?, ?, ?, ?, '', ?, ?, `+db.StampNowSQL+`)`,
		serviceDate, rawPayload, string(parsedJSON), imagesJSON, profileID, profileVersion,
	)
	if err != nil {
		log.Printf("Error processing webhook: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	id, _ := res.LastInsertId()
	serviceID := int(id)
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if err := db.CloneRegistryToNewService(s.DB, serviceID); err != nil {
		log.Printf("Error cloning registry for webhook service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	resolved := []map[string]any{}
	for _, it := range parsed.Items {
		if it.Type == "hymn" {
			resolved = append(resolved, map[string]any{"number": it.Number, "title": it.Title})
		}
	}
	msgOut := "Webhook received and processed successfully"
	writeJSON(w, http.StatusCreated, map[string]any{
		"message":            msgOut,
		"id":                 serviceID,
		"date":               serviceDate,
		"parsedData":         parsed,
		"resolvedHymns":      resolved,
		"failedHymnNumbers":  parsed.FailedHymnNumbers,
		"imagesCount":        len(urls),
		"announcementsAdded": 0,
		"updated":            false,
	})
}

func (s *Server) handleCorrection(w http.ResponseWriter, body map[string]any) {
	text := asString(body["text"])
	if text == "" {
		if msg, ok := body["message"].(map[string]any); ok {
			text = asString(msg["text"])
		}
	}
	if text == "" {
		writeError(w, http.StatusBadRequest, "Correction requires text and/or fields")
		return
	}
	token := concurrencyToken(nil, body)
	if token == "" {
		writeError(w, http.StatusBadRequest, requiredUpdatedAtMsg)
		return
	}
	parsed := parse.ParseRundown(s.DB, text)
	dateRaw := asString(body["date"])
	serviceID, _ := asPositiveInt(body["serviceId"])
	if serviceID == 0 {
		serviceID, _ = asPositiveInt(body["id"])
	}
	var err error
	if serviceID > 0 {
		err = s.DB.QueryRow(`SELECT id FROM services WHERE id = ?`, serviceID).Scan(&serviceID)
	} else if dateRaw != "" {
		date := dateRaw
		if parsed.Date != nil {
			date = *parsed.Date
		}
		err = s.DB.QueryRow(`SELECT id FROM services WHERE date = ?`, date).Scan(&serviceID)
	} else {
		writeError(w, http.StatusNotFound, "Service not found for correction")
		return
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "Service not found for correction")
		return
	}
	snap, err := s.loadServiceSnapshot(serviceID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Service not found for correction")
		return
	}
	if token != snap.UpdatedAt {
		writeWebhookConflict(w, snap, serviceConflictMsg)
		return
	}
	newDate := snap.Date
	if parsed.Date != nil && *parsed.Date != "" {
		newDate = *parsed.Date
	}
	parsedJSON, _ := json.Marshal(parsed)
	res, err := s.DB.Exec(
		`UPDATE services SET date = ?, raw_payload = ?, parsed_data = ?, updated_at = `+db.StampNowSQL+`
		  WHERE id = ? AND (COALESCE(updated_at, created_at) = ? OR COALESCE(updated_at, created_at) = ?)`,
		newDate, text, string(parsedJSON), serviceID, snap.UpdatedAt, snap.RawStoredToken,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		latest, loadErr := s.loadServiceSnapshot(serviceID)
		if loadErr != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		writeWebhookConflict(w, latest, serviceConflictMsg)
		return
	}
	var updatedAt string
	_ = s.DB.QueryRow(`SELECT COALESCE(updated_at, created_at) FROM services WHERE id = ?`, serviceID).Scan(&updatedAt)
	updatedAt = formatTimestamp(updatedAt)
	resolved := []map[string]any{}
	for _, it := range parsed.Items {
		if it.Type == "hymn" {
			resolved = append(resolved, map[string]any{"number": it.Number, "title": it.Title})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message":           "Service correction applied",
		"action":            "correct",
		"id":                serviceID,
		"date":              newDate,
		"parsedData":        parsed,
		"resolvedHymns":     resolved,
		"failedHymnNumbers": parsed.FailedHymnNumbers,
		"updated":           true,
		"updated_at":        updatedAt,
	})
}

func regexpReplaceBearer(authz string) string {
	if authz == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		return strings.TrimSpace(authz[7:])
	}
	return ""
}
