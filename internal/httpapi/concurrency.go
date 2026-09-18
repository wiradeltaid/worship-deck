package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

const requiredUpdatedAtMsg = "updated_at is required for concurrent edit protection"
const serviceConflictMsg = "Conflict: service was modified; refresh and retry"
const webhookDateConflictMsg = "Conflict: a service already exists for this date; send action=correct with updated_at to overwrite"

func concurrencyToken(r *http.Request, body map[string]any) string {
	if body != nil {
		if s := strings.TrimSpace(asString(body["updated_at"])); s != "" {
			return formatTimestamp(s)
		}
	}
	if r != nil {
		if s := strings.TrimSpace(r.URL.Query().Get("updated_at")); s != "" {
			return formatTimestamp(s)
		}
	}
	return ""
}

type serviceSnapshot struct {
	ID             int
	Date           string
	RawPayload     string
	ParsedData     json.RawMessage
	UpdatedAt      string
	RawStoredToken string
}

func (s *Server) loadServiceSnapshot(id int) (*serviceSnapshot, error) {
	var raw, parsed, date, created, updated sql.NullString
	err := s.DB.QueryRow(
		`SELECT raw_payload, parsed_data, date, created_at, updated_at FROM services WHERE id = ?`,
		id,
	).Scan(&raw, &parsed, &date, &created, &updated)
	if err != nil {
		return nil, err
	}
	rawToken := updated.String
	if rawToken == "" {
		rawToken = created.String
	}
	token := formatTimestamp(rawToken)
	parsedJSON := json.RawMessage("null")
	if parsed.Valid && parsed.String != "" {
		parsedJSON = json.RawMessage(parsed.String)
	}
	return &serviceSnapshot{
		ID:             id,
		Date:           date.String,
		RawPayload:     raw.String,
		ParsedData:     parsedJSON,
		UpdatedAt:      token,
		RawStoredToken: rawToken,
	}, nil
}

func writeStaleToken(w http.ResponseWriter, msg, updatedAt string) {
	writeJSON(w, http.StatusConflict, map[string]any{
		"error":      msg,
		"updated_at": updatedAt,
	})
}

func writeWebhookConflict(w http.ResponseWriter, snap *serviceSnapshot, errMsg string) {
	writeJSON(w, http.StatusConflict, map[string]any{
		"error":       errMsg,
		"id":          snap.ID,
		"date":        snap.Date,
		"raw_payload": snap.RawPayload,
		"parsed_data": snap.ParsedData,
		"updated_at":  snap.UpdatedAt,
	})
}
