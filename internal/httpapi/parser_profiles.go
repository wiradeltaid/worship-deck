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

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type parserProfileItem struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Description string `json:"description"`
	RulesJSON   string `json:"rulesJson"`
	IsBuiltin   bool   `json:"isBuiltin"`
	IsDefault   bool   `json:"isDefault"`
	Version     int    `json:"version"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type operatorParserProfileItem struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Description string `json:"description"`
	IsBuiltin   bool   `json:"isBuiltin"`
	IsDefault   bool   `json:"isDefault"`
	Version     int    `json:"version"`
}

type profileRulesEnvelope struct {
	SchemaVersion int `json:"schema_version"`
}

func validateRulesJSON(raw string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fmt.Errorf("rules_json cannot be empty")
	}
	var env profileRulesEnvelope
	if err := json.Unmarshal([]byte(trimmed), &env); err != nil {
		return fmt.Errorf("rules_json is invalid JSON: %w", err)
	}
	if env.SchemaVersion != 1 {
		return fmt.Errorf("rules_json schema_version must be 1, got %d", env.SchemaVersion)
	}
	return nil
}

func (s *Server) listParserProfiles(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	rows, err := s.DB.Query(
		`SELECT id, slug, title, COALESCE(description, ''), rules_json, is_builtin, is_default, version,
		        COALESCE(created_at, ''), COALESCE(updated_at, '')
		   FROM rundown_parser_profiles
		  ORDER BY is_default DESC, is_builtin DESC, title ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()

	var profiles []parserProfileItem
	for rows.Next() {
		var item parserProfileItem
		var isBuiltin, isDefault int
		if err := rows.Scan(
			&item.ID, &item.Slug, &item.Title, &item.Description, &item.RulesJSON,
			&isBuiltin, &isDefault, &item.Version, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		item.IsBuiltin = (isBuiltin == 1)
		item.IsDefault = (isDefault == 1)
		profiles = append(profiles, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if profiles == nil {
		profiles = []parserProfileItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"profiles": profiles})
}

func (s *Server) listParserProfilesForOperator(w http.ResponseWriter, r *http.Request) {
	if sessionFrom(r) == nil {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	rows, err := s.DB.Query(
		`SELECT id, slug, title, COALESCE(description, ''), is_builtin, is_default, version
		   FROM rundown_parser_profiles
		  ORDER BY is_default DESC, is_builtin DESC, title ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()

	var profiles []operatorParserProfileItem
	for rows.Next() {
		var item operatorParserProfileItem
		var isBuiltin, isDefault int
		if err := rows.Scan(&item.ID, &item.Slug, &item.Title, &item.Description, &isBuiltin, &isDefault, &item.Version); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		item.IsBuiltin = (isBuiltin == 1)
		item.IsDefault = (isDefault == 1)
		profiles = append(profiles, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if profiles == nil {
		profiles = []operatorParserProfileItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"profiles": profiles})
}

func (s *Server) getParserProfile(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing profile ID")
		return
	}

	var item parserProfileItem
	var isBuiltin, isDefault int
	err := s.DB.QueryRow(
		`SELECT id, slug, title, COALESCE(description, ''), rules_json, is_builtin, is_default, version,
		        COALESCE(created_at, ''), COALESCE(updated_at, '')
		   FROM rundown_parser_profiles
		  WHERE id = ? OR slug = ?`,
		id, id,
	).Scan(
		&item.ID, &item.Slug, &item.Title, &item.Description, &item.RulesJSON,
		&isBuiltin, &isDefault, &item.Version, &item.CreatedAt, &item.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Parser profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	item.IsBuiltin = (isBuiltin == 1)
	item.IsDefault = (isDefault == 1)
	writeJSON(w, http.StatusOK, item)
}

type createParserProfileRequest struct {
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Description string `json:"description"`
	RulesJSON   string `json:"rulesJson"`
	IsDefault   bool   `json:"isDefault"`
}

func (s *Server) createParserProfile(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	var req createParserProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	slug := strings.TrimSpace(strings.ToLower(req.Slug))
	if slug == "" || !slugRegex.MatchString(slug) || utf8.RuneCountInString(slug) > 64 {
		writeError(w, http.StatusBadRequest, "Slug must be lowercase alphanumeric with hyphens, 1-64 characters")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" || utf8.RuneCountInString(title) > 120 {
		writeError(w, http.StatusBadRequest, "Title is required and must be at most 120 characters")
		return
	}

	desc := strings.TrimSpace(req.Description)
	if utf8.RuneCountInString(desc) > 500 {
		writeError(w, http.StatusBadRequest, "Description must be at most 500 characters")
		return
	}

	rulesJSON := strings.TrimSpace(req.RulesJSON)
	if rulesJSON == "" {
		rulesJSON = db.BuiltinDefaultRulesJSON
	}
	if err := validateRulesJSON(rulesJSON); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Check unique slug
	var existingCount int
	err := s.DB.QueryRow(`SELECT COUNT(*) FROM rundown_parser_profiles WHERE slug = ?`, slug).Scan(&existingCount)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if existingCount > 0 {
		writeError(w, http.StatusConflict, fmt.Sprintf("Parser profile with slug %q already exists", slug))
		return
	}

	profileID := slug
	isDefaultVal := 0
	if req.IsDefault {
		isDefaultVal = 1
	}

	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if req.IsDefault {
		if _, err := tx.Exec(`UPDATE rundown_parser_profiles SET is_default = 0`); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	_, err = tx.Exec(
		`INSERT INTO rundown_parser_profiles (
			id, slug, title, description, rules_json, is_builtin, is_default, version, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`,
		profileID, slug, title, desc, rulesJSON, isDefaultVal, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	item := parserProfileItem{
		ID:          profileID,
		Slug:        slug,
		Title:       title,
		Description: desc,
		RulesJSON:   rulesJSON,
		IsBuiltin:   false,
		IsDefault:   req.IsDefault,
		Version:     1,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	writeJSON(w, http.StatusCreated, item)
}

type updateParserProfileRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	RulesJSON   *string `json:"rulesJson"`
	IsDefault   *bool   `json:"isDefault"`
}

func (s *Server) updateParserProfile(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing profile ID")
		return
	}

	var existing parserProfileItem
	var isBuiltin, isDefault int
	err := s.DB.QueryRow(
		`SELECT id, slug, title, COALESCE(description, ''), rules_json, is_builtin, is_default, version,
		        COALESCE(created_at, ''), COALESCE(updated_at, '')
		   FROM rundown_parser_profiles
		  WHERE id = ? OR slug = ?`,
		id, id,
	).Scan(
		&existing.ID, &existing.Slug, &existing.Title, &existing.Description, &existing.RulesJSON,
		&isBuiltin, &isDefault, &existing.Version, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Parser profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	existing.IsBuiltin = (isBuiltin == 1)
	existing.IsDefault = (isDefault == 1)

	if existing.IsBuiltin {
		writeError(w, http.StatusBadRequest, "Builtin profiles cannot be modified; please clone to a custom profile")
		return
	}

	var req updateParserProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	newTitle := existing.Title
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" || utf8.RuneCountInString(t) > 120 {
			writeError(w, http.StatusBadRequest, "Title must be 1-120 characters")
			return
		}
		newTitle = t
	}

	newDesc := existing.Description
	if req.Description != nil {
		d := strings.TrimSpace(*req.Description)
		if utf8.RuneCountInString(d) > 500 {
			writeError(w, http.StatusBadRequest, "Description must be at most 500 characters")
			return
		}
		newDesc = d
	}

	newRulesJSON := existing.RulesJSON
	if req.RulesJSON != nil {
		rj := strings.TrimSpace(*req.RulesJSON)
		if err := validateRulesJSON(rj); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		newRulesJSON = rj
	}

	newIsDefault := existing.IsDefault
	if req.IsDefault != nil {
		newIsDefault = *req.IsDefault
	}

	now := time.Now().UTC().Format(time.RFC3339)
	newVersion := existing.Version + 1

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if newIsDefault && !existing.IsDefault {
		if _, err := tx.Exec(`UPDATE rundown_parser_profiles SET is_default = 0`); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	defaultInt := 0
	if newIsDefault {
		defaultInt = 1
	}

	_, err = tx.Exec(
		`UPDATE rundown_parser_profiles
		    SET title = ?, description = ?, rules_json = ?, is_default = ?, version = ?, updated_at = ?
		  WHERE id = ?`,
		newTitle, newDesc, newRulesJSON, defaultInt, newVersion, now, existing.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	existing.Title = newTitle
	existing.Description = newDesc
	existing.RulesJSON = newRulesJSON
	existing.IsDefault = newIsDefault
	existing.Version = newVersion
	existing.UpdatedAt = now

	writeJSON(w, http.StatusOK, existing)
}

func (s *Server) deleteParserProfile(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing profile ID")
		return
	}

	var isBuiltin, isDefault int
	var profileID string
	err := s.DB.QueryRow(
		`SELECT id, is_builtin, is_default FROM rundown_parser_profiles WHERE id = ? OR slug = ?`,
		id, id,
	).Scan(&profileID, &isBuiltin, &isDefault)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Parser profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if isBuiltin == 1 {
		writeError(w, http.StatusBadRequest, "Builtin profiles cannot be deleted")
		return
	}
	if isDefault == 1 {
		writeError(w, http.StatusBadRequest, "Default parser profile cannot be deleted; designate another default first")
		return
	}

	_, err = s.DB.Exec(`DELETE FROM rundown_parser_profiles WHERE id = ?`, profileID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": profileID})
}

func (s *Server) setDefaultParserProfile(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing profile ID")
		return
	}

	var profileID string
	err := s.DB.QueryRow(
		`SELECT id FROM rundown_parser_profiles WHERE id = ? OR slug = ?`,
		id, id,
	).Scan(&profileID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Parser profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE rundown_parser_profiles SET is_default = 0`); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := tx.Exec(`UPDATE rundown_parser_profiles SET is_default = 1, updated_at = ? WHERE id = ?`, now, profileID); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"default": true, "id": profileID})
}
