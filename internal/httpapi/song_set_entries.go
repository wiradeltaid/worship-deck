package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/parse"
	"github.com/wiradeltaid/worship-deck/internal/plan"
)

// timeNowRFC3339Nano matches the updated_at convention used across the
// registry endpoints (registry.go).
func timeNowRFC3339Nano() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

// LC-11 admin CRUD for the song-set spine and the shared layout trio
// (DEC-004 S2 / AD-31/AD-33). All routes live under /api/admin so the AD-5
// gate plus requireAdmin cover authorization.

var songSetVariableNameRE = regexp.MustCompile(`^[a-z][a-z0-9_-]{0,79}$`)

const maxSongSetTitleRunes = 120

var songSetLayoutRoles = map[string]struct{}{"title": {}, "verse": {}, "reff": {}}

type songSetEntry struct {
	VariableName    string  `json:"variableName"`
	Title           string  `json:"title"`
	Position        int     `json:"position"`
	UpdatedAt       string  `json:"updatedAt"`
	ExtractionRegex *string `json:"extraction_regex"`
}

func validSongSetTitle(title string) bool {
	n := utf8.RuneCountInString(strings.TrimSpace(title))
	return n >= 1 && n <= maxSongSetTitleRunes
}

func (s *Server) listSongSetEntries(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	rows, err := s.DB.Query(
		`SELECT variable_name, title, position, updated_at, extraction_regex FROM song_set_entries
		  ORDER BY position ASC, id ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	entries := []songSetEntry{}
	for rows.Next() {
		var e songSetEntry
		var rawRegex sql.NullString
		if err := rows.Scan(&e.VariableName, &e.Title, &e.Position, &e.UpdatedAt, &rawRegex); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if rawRegex.Valid && rawRegex.String != "" {
			e.ExtractionRegex = &rawRegex.String
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

// listSongSetEntriesForOperator serves GET /api/song-set-entries for any
// signed-in Hub user (FR-32): the create/edit forms render one Song Set group
// per Registry entry in spine order. Session-gated by the AD-5 middleware —
// deliberately NOT admin-only, unlike the CRUD above.
func (s *Server) listSongSetEntriesForOperator(w http.ResponseWriter, r *http.Request) {
	if sessionFrom(r) == nil {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	rows, err := s.DB.Query(
		`SELECT variable_name, title, position, extraction_regex FROM song_set_entries
		  ORDER BY position ASC, id ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	type entry struct {
		VariableName    string  `json:"variableName"`
		Title           string  `json:"title"`
		Position        int     `json:"position"`
		ExtractionRegex *string `json:"extraction_regex"`
	}
	entries := []entry{}
	for rows.Next() {
		var e entry
		var rawRegex sql.NullString
		if err := rows.Scan(&e.VariableName, &e.Title, &e.Position, &rawRegex); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if rawRegex.Valid && rawRegex.String != "" {
			e.ExtractionRegex = &rawRegex.String
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) createSongSetEntry(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	variableName := strings.TrimSpace(asString(body["variableName"]))
	title := asString(body["title"])
	if !songSetVariableNameRE.MatchString(variableName) {
		writeError(w, http.StatusBadRequest, "Invalid variableName")
		return
	}
	if !validSongSetTitle(title) {
		writeError(w, http.StatusBadRequest, "Invalid title")
		return
	}

	var extractionRegex *string
	if raw, ok := body["extraction_regex"]; ok && raw != nil {
		s := strings.TrimSpace(asString(raw))
		if s != "" {
			if _, err := parse.ValidateAndTranslateRegex(s); err != nil {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid regex pattern: %v", err))
				return
			}
			extractionRegex = &s
		}
	} else if raw, ok := body["extractionRegex"]; ok && raw != nil {
		s := strings.TrimSpace(asString(raw))
		if s != "" {
			if _, err := parse.ValidateAndTranslateRegex(s); err != nil {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid regex pattern: %v", err))
				return
			}
			extractionRegex = &s
		}
	}

	var count int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM song_set_entries WHERE variable_name = ?`,
		variableName,
	).Scan(&count); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if count > 0 {
		writeError(w, http.StatusConflict, "variableName already exists")
		return
	}

	var maxPos sql.NullInt64
	if err := s.DB.QueryRow(
		`SELECT MAX(position) FROM song_set_entries`,
	).Scan(&maxPos); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	position := int(maxPos.Int64) + 1

	now := timeNowRFC3339Nano()
	songSetGid := db.NewUUIDv7()
	if _, err := s.DB.Exec(
		`INSERT INTO song_set_entries (global_id, variable_name, title, position, updated_at, extraction_regex)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		songSetGid, variableName, strings.TrimSpace(title), position, now, extractionRegex,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Also insert an initial slide into artifact_templates so it appears in the active deck sequence
	id, err := s.songSetEntryID(variableName)
	if err == nil {
		var maxDeckPos sql.NullInt64
		_ = s.DB.QueryRow(`SELECT MAX(position) FROM artifact_templates`).Scan(&maxDeckPos)
		deckPos := int(maxDeckPos.Int64) + 1
		_, _ = s.DB.Exec(
			`INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position, variable_name)
			 VALUES (?, ?, 'song-set-entry', NULL, ?, NULL, ?, ?)`,
			id, strings.TrimSpace(title), now, deckPos, variableName,
		)
	}

	writeJSON(w, http.StatusCreated, songSetEntry{
		VariableName:    variableName,
		Title:           strings.TrimSpace(title),
		Position:        position,
		UpdatedAt:       now,
		ExtractionRegex: extractionRegex,
	})
}

// songSetEntryID derives a unique kebab row id for a new entry. The spine is
// keyed by variable_name; id only has to be unique across all templates.
func (s *Server) songSetEntryID(variableName string) (string, error) {
	base := "song-" + strings.ReplaceAll(variableName, "_", "-")
	candidate := base
	for n := 2; ; n++ {
		var count int
		err := s.DB.QueryRow(
			`SELECT COUNT(*) FROM artifact_templates WHERE id = ?`, candidate,
		).Scan(&count)
		if err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, n)
	}
}

func (s *Server) patchSongSetEntry(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	variableName := r.PathValue("variableName")
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	targetVariableName := variableName
	if raw, ok := body["variableName"]; ok {
		trimmed := strings.TrimSpace(asString(raw))
		if trimmed == "" || !songSetVariableNameRE.MatchString(trimmed) {
			writeError(w, http.StatusBadRequest, "Invalid variableName")
			return
		}
		targetVariableName = trimmed
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}
	title := asString(body["title"])
	if !validSongSetTitle(title) {
		writeError(w, http.StatusBadRequest, "Invalid title")
		return
	}

	var extractionRegex *string
	hasRegexUpdate := false
	if raw, ok := body["extraction_regex"]; ok {
		hasRegexUpdate = true
		if raw != nil {
			s := strings.TrimSpace(asString(raw))
			if s != "" {
				if _, err := parse.ValidateAndTranslateRegex(s); err != nil {
					writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid regex pattern: %v", err))
					return
				}
				extractionRegex = &s
			}
		}
	} else if raw, ok := body["extractionRegex"]; ok {
		hasRegexUpdate = true
		if raw != nil {
			s := strings.TrimSpace(asString(raw))
			if s != "" {
				if _, err := parse.ValidateAndTranslateRegex(s); err != nil {
					writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid regex pattern: %v", err))
					return
				}
				extractionRegex = &s
			}
		}
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	var storedUpdated string
	err = tx.QueryRow(
		`SELECT updated_at FROM song_set_entries WHERE variable_name = ?`,
		variableName,
	).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Song set entry was modified by another session")
		return
	}

	if targetVariableName != variableName {
		var conflictCount int
		if err := tx.QueryRow(
			`SELECT COUNT(*) FROM song_set_entries WHERE variable_name = ?`,
			targetVariableName,
		).Scan(&conflictCount); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if conflictCount > 0 {
			writeError(w, http.StatusConflict, "Song set entry already exists")
			return
		}
	}

	now := timeNowRFC3339Nano()
	var res sql.Result
	if hasRegexUpdate {
		res, err = tx.Exec(
			`UPDATE song_set_entries SET title = ?, variable_name = ?, extraction_regex = ?, updated_at = ?
			  WHERE variable_name = ? AND updated_at = ?`,
			strings.TrimSpace(title), targetVariableName, extractionRegex, now, variableName, updatedAt,
		)
	} else {
		res, err = tx.Exec(
			`UPDATE song_set_entries SET title = ?, variable_name = ?, updated_at = ?
			  WHERE variable_name = ? AND updated_at = ?`,
			strings.TrimSpace(title), targetVariableName, now, variableName, updatedAt,
		)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Song set entry was modified by another session")
		return
	}

	// Update any live slides in the deck sequence currently referencing this song set
	_, _ = tx.Exec(
		`UPDATE artifact_templates SET label = ?, variable_name = ?, updated_at = ?
		  WHERE base_type = 'song-set-entry' AND variable_name = ?`,
		strings.TrimSpace(title), targetVariableName, now, variableName,
	)

	// Migrate existing weekly song_set_inputs if variableName was changed.
	// Purge any inert/orphaned rows under targetVariableName across all services
	// so stale data from deleted entries cannot be adopted, and update all rows
	// from variableName to targetVariableName.
	if targetVariableName != variableName {
		if _, err := tx.Exec(
			`DELETE FROM song_set_inputs WHERE variable_name = ?`,
			targetVariableName,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if _, err := tx.Exec(
			`UPDATE song_set_inputs SET variable_name = ? WHERE variable_name = ?`,
			targetVariableName, variableName,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	var position int
	var rawRegex sql.NullString
	_ = s.DB.QueryRow(
		`SELECT position, extraction_regex FROM song_set_entries WHERE variable_name = ?`,
		targetVariableName,
	).Scan(&position, &rawRegex)
	var outRegex *string
	if rawRegex.Valid && rawRegex.String != "" {
		outRegex = &rawRegex.String
	}
	writeJSON(w, http.StatusOK, songSetEntry{
		VariableName:    targetVariableName,
		Title:           strings.TrimSpace(title),
		Position:        position,
		UpdatedAt:       now,
		ExtractionRegex: outRegex,
	})
}

func (s *Server) deleteSongSetEntry(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	variableName := r.PathValue("variableName")
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
		`SELECT updated_at FROM song_set_entries WHERE variable_name = ?`,
		variableName,
	).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Song set entry was modified by another session")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	var songSetGid string
	err = tx.QueryRow(`SELECT global_id FROM song_set_entries WHERE variable_name = ?`, variableName).Scan(&songSetGid)
	if err != nil && err != sql.ErrNoRows {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if songSetGid != "" {
		if err := db.RecordTombstoneTx(tx, songSetGid, "song_set_entry"); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	// Delete from master song_set_entries table
	res, err := tx.Exec(
		`DELETE FROM song_set_entries WHERE variable_name = ? AND updated_at = ?`,
		variableName, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Song set entry was modified by another session")
		return
	}

	// Also delete any corresponding slides from artifact_templates deck sequence
	if _, err := tx.Exec(
		`DELETE FROM artifact_templates WHERE base_type = 'song-set-entry' AND variable_name = ?`,
		variableName,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "variableName": variableName})
}

func songSetRoleOr404(w http.ResponseWriter, role string) bool {
	if _, ok := songSetLayoutRoles[role]; ok {
		return true
	}
	writeError(w, http.StatusNotFound, "Unknown song set layout role")
	return false
}

func (s *Server) getSongSetLayout(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	role := r.PathValue("role")
	if !songSetRoleOr404(w, role) {
		return
	}
	var payload, updatedAt string
	err := s.DB.QueryRow(
		`SELECT payload, updated_at FROM song_set_layouts WHERE role = ?`, role,
	).Scan(&payload, &updatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var layout any
	if err := json.Unmarshal([]byte(payload), &layout); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"role": role, "layout": layout, "updatedAt": updatedAt})
}

func (s *Server) putSongSetLayout(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	role := r.PathValue("role")
	if !songSetRoleOr404(w, role) {
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
	rawLayout, ok := body["layout"].(map[string]any)
	if !ok {
		writeError(w, http.StatusBadRequest, "layout must be an object")
		return
	}
	layoutBytes, err := json.Marshal(rawLayout)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	cleaned, err := plan.ValidateSongSetLayout(layoutBytes, role, s.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var storedUpdated string
	err = s.DB.QueryRow(
		`SELECT updated_at FROM song_set_layouts WHERE role = ?`, role,
	).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Song set layout was modified by another session")
		return
	}

	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(
		`UPDATE song_set_layouts SET payload = ?, updated_at = ? WHERE role = ? AND updated_at = ?`,
		string(cleaned), now, role, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Song set layout was modified by another session")
		return
	}
	var out any
	_ = json.Unmarshal(cleaned, &out)
	writeJSON(w, http.StatusOK, map[string]any{"role": role, "layout": out, "updatedAt": now})
}

func (s *Server) resetSongSetLayout(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	role := r.PathValue("role")
	if !songSetRoleOr404(w, role) {
		return
	}
	var seedHash sql.NullString
	err := s.DB.QueryRow(
		`SELECT seed_hash FROM song_set_layouts WHERE role = ?`, role,
	).Scan(&seedHash)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if !seedHash.Valid {
		writeError(w, http.StatusConflict, "Song set layout has no recorded seed")
		return
	}
	seeds, err := db.LoadSongSetLayoutSeeds(s.Root)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	payload, ok := seeds[role]
	if !ok {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	now := timeNowRFC3339Nano()
	if _, err := s.DB.Exec(
		`UPDATE song_set_layouts SET payload = ?, updated_at = ? WHERE role = ?`,
		string(payload), now, role,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var out any
	_ = json.Unmarshal(payload, &out)
	writeJSON(w, http.StatusOK, map[string]any{"role": role, "layout": out, "updatedAt": now})
}

func (s *Server) updateSongSetEntryExtractionRegex(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	variableName := strings.TrimSpace(r.PathValue("variableName"))
	if variableName == "" {
		writeError(w, http.StatusBadRequest, "variableName is required")
		return
	}

	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}

	rawPattern := ""
	if raw, ok := body["extraction_regex"]; ok && raw != nil {
		rawPattern = asString(raw)
	} else if raw, ok := body["extractionRegex"]; ok && raw != nil {
		rawPattern = asString(raw)
	}

	pattern := strings.TrimSpace(rawPattern)
	if pattern != "" {
		if _, err := parse.ValidateAndTranslateRegex(pattern); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid regex pattern: %v", err))
			return
		}
	}

	var sqlVal any = pattern
	if pattern == "" {
		sqlVal = nil
	}

	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(`
		UPDATE song_set_entries
		SET extraction_regex = ?, updated_at = ?
		WHERE variable_name = ?
	`, sqlVal, now, variableName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update song set entry regex: %v", err))
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, fmt.Sprintf("Song set entry with variable_name %q not found", variableName))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"variable_name":    variableName,
		"extraction_regex": sqlVal,
		"updatedAt":        now,
	})
}
