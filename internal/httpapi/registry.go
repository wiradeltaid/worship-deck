package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/plan"
)

var kebabTemplateID = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

const maxTemplateLabelRunes = 80

type artifactSummary struct {
	ID           string `json:"id"`
	Label        string `json:"label"`
	BaseType     string `json:"baseType"`
	UpdatedAt    string `json:"updatedAt"`
	Editable     bool   `json:"editable"`
	Resettable   bool   `json:"resettable"`
	VariableName string `json:"variableName,omitempty"`
	AnnSetID     int    `json:"annSetId,omitempty"`
}

func (s *Server) listArtifacts(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(
		`SELECT id, label, base_type, updated_at, seed_hash, variable_name, ann_set_id FROM artifact_templates ORDER BY position`,
	)
	if err != nil {
		log.Printf("Error listing artifact templates: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	list := []artifactSummary{}
	for rows.Next() {
		var it artifactSummary
		var seedHash, varName sql.NullString
		var annSetID sql.NullInt64
		if err := rows.Scan(&it.ID, &it.Label, &it.BaseType, &it.UpdatedAt, &seedHash, &varName, &annSetID); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		it.Editable = it.BaseType == "general"
		it.Resettable = seedHash.Valid && seedHash.String != ""
		if varName.Valid && varName.String != "" {
			it.VariableName = varName.String
		}
		if annSetID.Valid {
			it.AnnSetID = int(annSetID.Int64)
		}
		list = append(list, it)
	}
	writeJSON(w, http.StatusOK, map[string]any{"templates": list})
}

func (s *Server) getArtifact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	raw, err := s.loadArtifactJSON(id)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Template not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) loadArtifactJSON(id string) ([]byte, error) {
	var payloadNull sql.NullString
	var label, baseType, updatedAt string
	var annSetID sql.NullInt64
	var varName sql.NullString
	err := s.DB.QueryRow(
		`SELECT label, base_type, payload, updated_at, ann_set_id, variable_name FROM artifact_templates WHERE id = ?`, id,
	).Scan(&label, &baseType, &payloadNull, &updatedAt, &annSetID, &varName)
	if err != nil {
		return nil, err
	}
	if !payloadNull.Valid || payloadNull.String == "" {
		obj := map[string]any{
			"schemaVersion": 1,
			"id":            id,
			"label":         label,
			"baseType":      baseType,
			"updatedAt":     updatedAt,
		}
		if annSetID.Valid {
			obj["annSetId"] = int(annSetID.Int64)
		}
		if varName.Valid && varName.String != "" {
			obj["variableName"] = varName.String
		}
		return json.Marshal(obj)
	}
	var obj map[string]any
	if err := json.Unmarshal([]byte(payloadNull.String), &obj); err != nil {
		return nil, err
	}
	obj["updatedAt"] = updatedAt
	return json.Marshal(obj)
}

func normalizeTemplateLabel(raw any) (string, string) {
	s, _ := raw.(string)
	label := strings.TrimSpace(s)
	if label == "" {
		return "", "label is required"
	}
	if utf8.RuneCountInString(label) > maxTemplateLabelRunes {
		return "", "label must be at most 80 characters"
	}
	return label, ""
}

func newAuthoredTemplateID() (string, error) {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "custom-" + hex.EncodeToString(b[:]), nil
}

func authoredGeneralPayload(id, label string) ([]byte, error) {
	obj := map[string]any{
		"schemaVersion": 1,
		"id":            id,
		"label":         label,
		"baseType":      "general",
		"placeholders":  []any{},
		"layouts": map[string]any{
			"default": map[string]any{
				"aspectRatio":     "16:9",
				"backgroundColor": "#000000",
				"elements":        []any{},
			},
		},
	}
	return json.Marshal(obj)
}

func (s *Server) createArtifact(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		if msg == "Invalid body" {
			writeError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		writeError(w, status, msg)
		return
	}
	baseType := "general"
	var annSetID any = nil
	var varName any = nil
	var payloadStr any = nil

	bt, _ := body["baseType"].(string)
	if bt == "ann-set-marker" {
		baseType = "ann-set-marker"
		rawAnnSetID, hasAnnSetID := body["annSetId"]
		if !hasAnnSetID || rawAnnSetID == nil {
			writeError(w, http.StatusBadRequest, "annSetId is required for ann-set-marker")
			return
		}
		setID, ok := asPositiveInt(rawAnnSetID)
		if !ok {
			writeError(w, http.StatusBadRequest, "annSetId must be a positive integer")
			return
		}
		var setLabel string
		if err := s.DB.QueryRow(`SELECT label FROM announcement_sets WHERE id = ?`, setID).Scan(&setLabel); err != nil {
			if err == sql.ErrNoRows {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("Announcement set %d not found", setID))
				return
			}
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		annSetID = setID
		if body["label"] == nil || strings.TrimSpace(asString(body["label"])) == "" {
			body["label"] = setLabel
		}
	} else if bt == "song-set-entry" {
		baseType = "song-set-entry"
		rawVarName, hasVarName := body["variableName"]
		if !hasVarName || rawVarName == nil {
			writeError(w, http.StatusBadRequest, "variableName is required for song-set-entry")
			return
		}
		vn := strings.TrimSpace(asString(rawVarName))
		if !songSetVariableNameRE.MatchString(vn) {
			writeError(w, http.StatusBadRequest, "Invalid variableName")
			return
		}
		var songLabel string
		if err := s.DB.QueryRow(`SELECT title FROM song_set_entries WHERE variable_name = ?`, vn).Scan(&songLabel); err != nil {
			if err == sql.ErrNoRows {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("Song set entry %s not found", vn))
				return
			}
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		varName = vn
		if body["label"] == nil || strings.TrimSpace(asString(body["label"])) == "" {
			body["label"] = songLabel
		}
	}

	label, errMsg := normalizeTemplateLabel(body["label"])
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	id, _ := body["id"].(string)
	id = strings.TrimSpace(id)
	if id == "" {
		generated, genErr := newAuthoredTemplateID()
		if genErr != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		id = generated
	}
	if id == "order" || !kebabTemplateID.MatchString(id) {
		writeError(w, http.StatusBadRequest, "id must be kebab-case")
		return
	}

	var exists int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM artifact_templates WHERE id = ?`, id).Scan(&exists); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if exists > 0 {
		writeError(w, http.StatusConflict, "Template id already exists")
		return
	}

	if baseType == "general" {
		payload, err := authoredGeneralPayload(id, label)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		payloadStr = string(payload)
	}

	var pos int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM artifact_templates`).Scan(&pos); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)

	_, err = s.DB.Exec(
		`INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position, ann_set_id, variable_name)
		 VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
		id, label, baseType, payloadStr, now, pos, annSetID, varName,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			writeError(w, http.StatusConflict, "Template id already exists")
			return
		}
		log.Printf("Error creating artifact template: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	raw, err := s.loadArtifactJSON(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(raw)
}

func (s *Server) putArtifact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	body, err, status, msg := readJSONObject(r, 8<<20)
	if err != nil {
		if msg == "Invalid body" {
			writeError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}
	var storedUpdated, payload, baseType, label string
	var seedHash sql.NullString
	err = s.DB.QueryRow(
		`SELECT updated_at, payload, base_type, label, seed_hash FROM artifact_templates WHERE id = ?`, id,
	).Scan(&storedUpdated, &payload, &baseType, &label, &seedHash)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Unknown template: "+id)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}
	if baseType != "general" {
		writeError(w, http.StatusBadRequest, "Template base type is read-only")
		return
	}
	if v, has := body["baseType"]; has {
		if bt, _ := v.(string); bt != "" && bt != baseType {
			writeError(w, http.StatusBadRequest, "baseType cannot be changed")
			return
		}
	}
	delete(body, "updatedAt")
	if pid, _ := body["id"].(string); pid != "" && pid != id {
		writeError(w, http.StatusBadRequest, "Template id in payload must match route id")
		return
	}
	body["id"] = id
	next, err := json.Marshal(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	cleaned, err := plan.ValidateArtifactTemplate(next, s.Root, s.getActivePredefinedFieldCatalog())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var incoming plan.Template
	if err := json.Unmarshal(cleaned, &incoming); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if seedHash.Valid && seedHash.String != "" {
		seedMap, seedErr := loadSeedTemplate(s.Root, id)
		if seedErr != nil {
			writeError(w, http.StatusBadRequest, "Unknown template: "+id)
			return
		}
		seedRaw, _ := json.Marshal(seedMap)
		seedClean, seedErr := plan.ValidateArtifactTemplate(seedRaw, s.Root)
		if seedErr != nil {
			log.Printf("Error validating seed template %s: %v", id, seedErr)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		var seed, existing plan.Template
		if err := json.Unmarshal(seedClean, &seed); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		_ = json.Unmarshal([]byte(payload), &existing)
		if err := plan.AssertStableAgainstSeed(incoming, seed, existing); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	newLabel := incoming.Label
	if newLabel == "" {
		newLabel = label
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := s.DB.Exec(
		`UPDATE artifact_templates SET label = ?, payload = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
		newLabel, string(cleaned), now, id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}
	raw, err := s.loadArtifactJSON(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) patchArtifact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		if msg == "Invalid body" {
			writeError(w, http.StatusBadRequest, "Invalid JSON")
			return
		}
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}
	label, errMsg := normalizeTemplateLabel(body["label"])
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	var storedUpdated string
	var payloadNull sql.NullString
	err = s.DB.QueryRow(
		`SELECT updated_at, payload FROM artifact_templates WHERE id = ?`, id,
	).Scan(&storedUpdated, &payloadNull)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Unknown template: "+id)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}

	var payloadStr any = nil
	if payloadNull.Valid && payloadNull.String != "" {
		var obj map[string]any
		if err := json.Unmarshal([]byte(payloadNull.String), &obj); err != nil {
			log.Printf("Error parsing artifact payload for rename %s: %v", id, err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		obj["label"] = label
		next, err := json.Marshal(obj)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		payloadStr = string(next)
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := s.DB.Exec(
		`UPDATE artifact_templates SET label = ?, payload = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
		label, payloadStr, now, id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}
	raw, err := s.loadArtifactJSON(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) deleteArtifact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
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
	var stored string
	err = s.DB.QueryRow(`SELECT updated_at FROM artifact_templates WHERE id = ?`, id).Scan(&stored)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Unknown template: "+id)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if stored != updatedAt {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM artifact_templates WHERE id = ?`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	rows, err := tx.Query(`SELECT id FROM artifact_templates ORDER BY position`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var ids []string
	for rows.Next() {
		var sid string
		if err := rows.Scan(&sid); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		ids = append(ids, sid)
	}
	rows.Close()
	for i, sid := range ids {
		if _, err := tx.Exec(`UPDATE artifact_templates SET position = ?, updated_at = ? WHERE id = ?`, i, now, sid); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	s.listArtifacts(w, r)
}

func (s *Server) reorderArtifacts(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	items, ok := body["items"].([]any)
	if !ok {
		writeError(w, http.StatusBadRequest, "items must be an array")
		return
	}
	rows, err := s.DB.Query(`SELECT id, updated_at FROM artifact_templates ORDER BY position`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	type tok struct{ id, at string }
	var live []tok
	for rows.Next() {
		var t tok
		if err := rows.Scan(&t.id, &t.at); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		live = append(live, t)
	}
	rows.Close()
	if len(items) != len(live) {
		writeError(w, http.StatusBadRequest, "items must contain every live template exactly once")
		return
	}
	tokens := map[string]string{}
	for _, t := range live {
		tokens[t.id] = t.at
	}
	seen := map[string]struct{}{}
	var order []string
	for _, raw := range items {
		m, ok := raw.(map[string]any)
		if !ok {
			writeError(w, http.StatusBadRequest, "items must contain id and updatedAt")
			return
		}
		id, _ := m["id"].(string)
		at, _ := m["updatedAt"].(string)
		if strings.TrimSpace(id) == "" {
			writeError(w, http.StatusBadRequest, "item id is required")
			return
		}
		if strings.TrimSpace(at) == "" {
			writeError(w, http.StatusBadRequest, "item updatedAt is required")
			return
		}
		if _, ok := tokens[id]; !ok {
			writeError(w, http.StatusBadRequest, "Unknown template: "+id)
			return
		}
		if _, dup := seen[id]; dup {
			writeError(w, http.StatusBadRequest, "Duplicate template: "+id)
			return
		}
		if tokens[id] != at {
			writeError(w, http.StatusConflict, "Template was modified by another session")
			return
		}
		seen[id] = struct{}{}
		order = append(order, id)
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	for i, id := range order {
		if _, err := tx.Exec(`UPDATE artifact_templates SET position = ?, updated_at = ? WHERE id = ?`, i, now, id); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	s.listArtifacts(w, r)
}

func (s *Server) resetArtifact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
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
	var stored string
	var seedHash sql.NullString
	err = s.DB.QueryRow(`SELECT updated_at, seed_hash FROM artifact_templates WHERE id = ?`, id).Scan(&stored, &seedHash)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Template not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if !seedHash.Valid || seedHash.String == "" {
		writeError(w, http.StatusBadRequest, "Authored templates cannot be reset")
		return
	}
	if stored != updatedAt {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}
	seed, err := loadSeedTemplate(s.Root, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Unknown template: "+id)
		return
	}
	payload, _ := json.Marshal(seed)
	label, _ := seed["label"].(string)
	baseType, _ := seed["baseType"].(string)
	sum := sha256.Sum256(payload)
	hash := hex.EncodeToString(sum[:])
	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := s.DB.Exec(
		`UPDATE artifact_templates SET label = ?, base_type = ?, payload = ?, updated_at = ?, seed_hash = ?
		  WHERE id = ? AND updated_at = ?`,
		label, baseType, string(payload), now, hash, id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusConflict, "Template was modified by another session")
		return
	}
	raw, err := s.loadArtifactJSON(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func loadSeedTemplate(root, id string) (map[string]any, error) {
	path := filepath.Join(root, "data", "default-registry.json")
	if os.Getenv("WPW_USE_SHIPPED_REGISTRY") != "1" {
		local := filepath.Join(root, "data", "local", "default-registry.json")
		if _, err := os.Stat(local); err == nil {
			path = local
		}
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var templates []map[string]any
	if err := json.Unmarshal(raw, &templates); err != nil {
		return nil, err
	}
	for _, t := range templates {
		if tid, _ := t["id"].(string); tid == id {
			return t, nil
		}
	}
	return nil, fmt.Errorf("missing")
}

func requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	sess := sessionFrom(r)
	if sess == nil || sess.Role != "admin" {
		writeError(w, http.StatusForbidden, "Forbidden")
		return false
	}
	return true
}

func (s *Server) syncArtifact(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updated_at"].(string)
	updatedAt = strings.TrimSpace(updatedAt)
	if updatedAt == "" {
		writeError(w, http.StatusBadRequest, "updated_at is required for concurrent edit protection")
		return
	}
	var current string
	err = s.DB.QueryRow(`SELECT COALESCE(updated_at, created_at) FROM services WHERE id = ?`, id).Scan(&current)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Service not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	updatedAt = formatTimestamp(updatedAt)
	current = formatTimestamp(current)
	if current != updatedAt {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":      "Conflict: service was modified; refresh and retry",
			"updated_at": current,
		})
		return
	}
	// The trio is read before the transaction opens — MaxOpenConns(1) means a
	// query inside the tx loop would deadlock against the open rows cursor.
	trio, _ := plan.LoadSongSetLayoutTrio(s.DB)
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM service_registry_snapshots WHERE service_id = ?`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if _, err := tx.Exec(`DELETE FROM service_announcement_set_slides WHERE service_id = ?`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	rows, err := tx.Query(`SELECT id, label, base_type, payload, updated_at, variable_name, ann_set_id FROM artifact_templates ORDER BY position`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	pos := 0
	for rows.Next() {
		var tid, label, baseType, at string
		var payloadNull, varName sql.NullString
		var annSetID sql.NullInt64
		if err := rows.Scan(&tid, &label, &baseType, &payloadNull, &at, &varName, &annSetID); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		var payload string
		switch {
		case baseType == "song-set-entry" && trio != nil:
			serialized, err := plan.SongSetEntryPayloadJSON(tid, label, trio)
			if err != nil {
				log.Printf("[registry] template %q: song-set-entry sync skipped: %v", tid, err)
				continue
			}
			payload = serialized
		case baseType == "ann-set-marker":
			// ann-set-marker rows have NULL payload but are structural spine rows (AD-35)
			payload = ""
		case payloadNull.Valid && payloadNull.String != "":
			payload = payloadNull.String
			if !plan.AcceptLivePayload(tid, payload) {
				continue
			}
		default:
			continue
		}
		if _, err := tx.Exec(
			`INSERT INTO service_registry_snapshots
			   (service_id, template_id, position, label, base_type, payload, updated_at, variable_name, ann_set_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, tid, pos, label, baseType, payload, at, varName, annSetID,
		); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		pos++
	}
	rows.Close()
	// AD-33: freeze the live trio next to the snapshot rows so this Service's
	// entry payloads keep rendering against the canvases they were synced with.
	if _, err := tx.Exec(
		`DELETE FROM service_song_set_layouts WHERE service_id = ?`, id,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO service_song_set_layouts (service_id, role, payload, updated_at)
		 SELECT ?, role, payload, updated_at FROM song_set_layouts`,
		id,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if err := db.CloneAnnouncementSlidesTx(tx, id); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	res, err := tx.Exec(
		`UPDATE services SET updated_at = `+db.StampNowSQL+`, registry_snapshot_at = `+db.StampNowSQL+`
		  WHERE id = ? AND COALESCE(updated_at, created_at) = ?`,
		id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":      "Conflict: service was modified; refresh and retry",
			"updated_at": current,
		})
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var after string
	_ = s.DB.QueryRow(`SELECT COALESCE(updated_at, created_at) FROM services WHERE id = ?`, id).Scan(&after)
	writeJSON(w, http.StatusOK, map[string]any{
		"message":       "Artifact registry synced",
		"updated_at":    after,
		"templateCount": pos,
	})
}

func (s *Server) getActivePredefinedFieldCatalog() map[string]string {
	if s.DB == nil {
		return nil
	}
	rows, err := s.DB.Query(`SELECT variable_name, field_type FROM predefined_fields WHERE is_active = 1`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	catalog := make(map[string]string)
	for rows.Next() {
		var varName, fieldType string
		if err := rows.Scan(&varName, &fieldType); err != nil {
			continue
		}
		switch fieldType {
		case "image":
			catalog[varName] = "image"
		default: // "text", "text_area"
			catalog[varName] = "text"
		}
	}
	return catalog
}
