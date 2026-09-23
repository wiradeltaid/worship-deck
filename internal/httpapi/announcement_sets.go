package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/wiradeltaid/worship-deck/internal/plan"
)

const maxAnnouncementSetLabelRunes = 80

type announcementSetSummary struct {
	ID         int    `json:"id"`
	Label      string `json:"label"`
	SlideCount int    `json:"slideCount"`
	UpdatedAt  string `json:"updatedAt"`
}

type announcementSetSlide struct {
	ID        int            `json:"id"`
	AnnSetID  int            `json:"annSetId"`
	Label     string         `json:"label"`
	Position  int            `json:"position"`
	UpdatedAt string         `json:"updatedAt"`
	Payload   map[string]any `json:"payload,omitempty"`
}

type announcementSetSlideSummary struct {
	ID              int    `json:"id"`
	AnnSetID        int    `json:"annSetId"`
	Label           string `json:"label"`
	Position        int    `json:"position"`
	UpdatedAt       string `json:"updatedAt"`
	Resettable      bool   `json:"resettable"`
	IsPlaceholder   bool   `json:"isPlaceholder,omitempty"`
	PlaceholderSlot *int   `json:"placeholderSlot,omitempty"`
}

func normalizeAnnouncementSetLabel(raw any) (string, string) {
	s, _ := raw.(string)
	label := strings.TrimSpace(s)
	if label == "" {
		return "", "label is required"
	}
	if utf8.RuneCountInString(label) > maxAnnouncementSetLabelRunes {
		return "", "label must be at most 80 characters"
	}
	return label, ""
}

func authoredAnnouncementSlidePayload(label string) ([]byte, error) {
	obj := map[string]any{
		"schemaVersion": 1,
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

// GET /api/admin/announcement-sets
func (s *Server) listAnnouncementSets(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	rows, err := s.DB.Query(
		`SELECT s.id, COALESCE(s.label, ''), COALESCE(s.updated_at, ''), COUNT(sl.id) AS slide_count
		   FROM announcement_sets s
		   LEFT JOIN announcement_set_slides sl ON sl.ann_set_id = s.id
		  GROUP BY s.id
		  ORDER BY s.id ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	sets := []announcementSetSummary{}
	for rows.Next() {
		var set announcementSetSummary
		if err := rows.Scan(&set.ID, &set.Label, &set.UpdatedAt, &set.SlideCount); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sets": sets})
}

// POST /api/admin/announcement-sets
func (s *Server) createAnnouncementSet(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	label, errMsg := normalizeAnnouncementSetLabel(body["label"])
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(
		`INSERT INTO announcement_sets (label, updated_at) VALUES (?, ?)`,
		label, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, announcementSetSummary{
		ID:         int(id),
		Label:      label,
		SlideCount: 0,
		UpdatedAt:  now,
	})
}

// PATCH /api/admin/announcement-sets/{id}
func (s *Server) patchAnnouncementSet(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
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
	label, errMsg := normalizeAnnouncementSetLabel(body["label"])
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	var storedUpdated string
	err = s.DB.QueryRow(`SELECT updated_at FROM announcement_sets WHERE id = ?`, id).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Announcement set not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Announcement set was modified by another session")
		return
	}

	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(
		`UPDATE announcement_sets SET label = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
		label, now, id, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Announcement set was modified by another session")
		return
	}

	var slideCount int
	_ = s.DB.QueryRow(`SELECT COUNT(*) FROM announcement_set_slides WHERE ann_set_id = ?`, id).Scan(&slideCount)
	writeJSON(w, http.StatusOK, announcementSetSummary{
		ID:         id,
		Label:      label,
		SlideCount: slideCount,
		UpdatedAt:  now,
	})
}

// DELETE /api/admin/announcement-sets/{id}
func (s *Server) deleteAnnouncementSet(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
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
	err = s.DB.QueryRow(`SELECT updated_at FROM announcement_sets WHERE id = ?`, id).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Announcement set not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Announcement set was modified by another session")
		return
	}

	// Refuse delete if still referenced by a live ann-set-marker on the spine
	var markerCount int
	err = s.DB.QueryRow(
		`SELECT COUNT(*) FROM artifact_templates WHERE base_type = 'ann-set-marker' AND ann_set_id = ?`,
		id,
	).Scan(&markerCount)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if markerCount > 0 {
		writeError(w, http.StatusConflict, "Announcement set is still referenced by a marker on the main artifact registry — remove the marker first")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM announcement_set_slides WHERE ann_set_id = ?`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	res, err := tx.Exec(`DELETE FROM announcement_sets WHERE id = ? AND updated_at = ?`, id, updatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Announcement set was modified by another session")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
}

// GET /api/admin/announcement-sets/{id}/slides
func (s *Server) listAnnouncementSetSlides(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	var exists int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM announcement_sets WHERE id = ?`, setID).Scan(&exists); err != nil || exists == 0 {
		writeError(w, http.StatusNotFound, "Announcement set not found")
		return
	}
	rows, err := s.DB.Query(
		`SELECT id, ann_set_id, label, position, updated_at, seed_hash, payload
		   FROM announcement_set_slides
		  WHERE ann_set_id = ?
		  ORDER BY position ASC, id ASC`,
		setID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	slides := []announcementSetSlideSummary{}
	for rows.Next() {
		var sl announcementSetSlideSummary
		var seedHash sql.NullString
		var payloadStr string
		if err := rows.Scan(&sl.ID, &sl.AnnSetID, &sl.Label, &sl.Position, &sl.UpdatedAt, &seedHash, &payloadStr); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		sl.Resettable = seedHash.Valid && seedHash.String != ""
		var raw map[string]any
		if json.Unmarshal([]byte(payloadStr), &raw) == nil {
			if b, ok := raw["isPlaceholder"].(bool); ok {
				sl.IsPlaceholder = b
			}
			if n, ok := raw["placeholderSlot"].(float64); ok && n >= 1 && n <= 4 {
				slot := int(n)
				sl.PlaceholderSlot = &slot
			}
		}
		slides = append(slides, sl)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"slides": slides})
}

// POST /api/admin/announcement-sets/{id}/slides
func (s *Server) createAnnouncementSetSlide(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	var exists int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM announcement_sets WHERE id = ?`, setID).Scan(&exists); err != nil || exists == 0 {
		writeError(w, http.StatusNotFound, "Announcement set not found")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	label, errMsg := normalizeAnnouncementSetLabel(body["label"])
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	payload, err := authoredAnnouncementSlidePayload(label)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	var maxPos sql.NullInt64
	if err := s.DB.QueryRow(
		`SELECT MAX(position) FROM announcement_set_slides WHERE ann_set_id = ?`,
		setID,
	).Scan(&maxPos); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	position := 0
	if maxPos.Valid {
		position = int(maxPos.Int64) + 1
	}

	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(
		`INSERT INTO announcement_set_slides (ann_set_id, label, payload, updated_at, seed_hash, position)
		 VALUES (?, ?, ?, ?, NULL, ?)`,
		setID, label, string(payload), now, position,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	id, _ := res.LastInsertId()
	var rawPayload map[string]any
	_ = json.Unmarshal(payload, &rawPayload)
	writeJSON(w, http.StatusCreated, announcementSetSlide{
		ID:        int(id),
		AnnSetID:  setID,
		Label:     label,
		Position:  position,
		UpdatedAt: now,
		Payload:   rawPayload,
	})
}

// GET /api/admin/announcement-sets/{id}/slides/{slideId}
func (s *Server) getAnnouncementSetSlide(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	slideID, ok := parsePositiveID(r.PathValue("slideId"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slide id")
		return
	}
	var label, payloadStr, updatedAt string
	var pos int
	err := s.DB.QueryRow(
		`SELECT label, payload, position, updated_at
		   FROM announcement_set_slides
		  WHERE id = ? AND ann_set_id = ?`,
		slideID, setID,
	).Scan(&label, &payloadStr, &pos, &updatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Slide not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	payload["updatedAt"] = updatedAt
	payload["id"] = fmt.Sprintf("ann-slide-%d", slideID)
	payload["label"] = label
	writeJSON(w, http.StatusOK, map[string]any{
		"slide": announcementSetSlide{
			ID:        slideID,
			AnnSetID:  setID,
			Label:     label,
			Position:  pos,
			UpdatedAt: updatedAt,
			Payload:   payload,
		},
	})
}

// PUT /api/admin/announcement-sets/{id}/slides/{slideId}
func (s *Server) putAnnouncementSetSlide(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	slideID, ok := parsePositiveID(r.PathValue("slideId"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slide id")
		return
	}
	body, err, status, msg := readJSONObject(r, 8<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}
	var storedUpdated, storedLabel string
	err = s.DB.QueryRow(
		`SELECT updated_at, label FROM announcement_set_slides WHERE id = ? AND ann_set_id = ?`,
		slideID, setID,
	).Scan(&storedUpdated, &storedLabel)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Slide not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Slide was modified by another session")
		return
	}

	delete(body, "updatedAt")
	virtualID := fmt.Sprintf("ann-slide-%d", slideID)
	body["id"] = virtualID
	if _, ok := body["schemaVersion"]; !ok {
		body["schemaVersion"] = 1
	}
	if _, ok := body["baseType"]; !ok {
		body["baseType"] = "general"
	}
	if _, ok := body["label"]; !ok {
		body["label"] = storedLabel
	}
	if _, ok := body["placeholders"]; !ok {
		body["placeholders"] = []any{}
	}

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

	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(
		`UPDATE announcement_set_slides
		    SET payload = ?, updated_at = ?
		  WHERE id = ? AND ann_set_id = ? AND updated_at = ?`,
		string(cleaned), now, slideID, setID, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Slide was modified by another session")
		return
	}

	var outPayload map[string]any
	_ = json.Unmarshal(cleaned, &outPayload)
	outPayload["updatedAt"] = now
	writeJSON(w, http.StatusOK, map[string]any{
		"slide": announcementSetSlide{
			ID:        slideID,
			AnnSetID:  setID,
			Label:     storedLabel,
			UpdatedAt: now,
			Payload:   outPayload,
		},
	})
}

// PATCH /api/admin/announcement-sets/{id}/slides/{slideId}
func (s *Server) patchAnnouncementSetSlide(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	slideID, ok := parsePositiveID(r.PathValue("slideId"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slide id")
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
	label, errMsg := normalizeAnnouncementSetLabel(body["label"])
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	var storedUpdated, payloadStr string
	var pos int
	err = s.DB.QueryRow(
		`SELECT updated_at, payload, position FROM announcement_set_slides WHERE id = ? AND ann_set_id = ?`,
		slideID, setID,
	).Scan(&storedUpdated, &payloadStr, &pos)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Slide not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Slide was modified by another session")
		return
	}

	var obj map[string]any
	if err := json.Unmarshal([]byte(payloadStr), &obj); err == nil {
		obj["label"] = label
		if next, err := json.Marshal(obj); err == nil {
			payloadStr = string(next)
		}
	}

	now := timeNowRFC3339Nano()
	res, err := s.DB.Exec(
		`UPDATE announcement_set_slides
		    SET label = ?, payload = ?, updated_at = ?
		  WHERE id = ? AND ann_set_id = ? AND updated_at = ?`,
		label, payloadStr, now, slideID, setID, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Slide was modified by another session")
		return
	}

	writeJSON(w, http.StatusOK, announcementSetSlideSummary{
		ID:        slideID,
		AnnSetID:  setID,
		Label:     label,
		Position:  pos,
		UpdatedAt: now,
	})
}

// POST /api/admin/announcement-sets/{id}/slides/{slideId}/reset
func (s *Server) resetAnnouncementSetSlide(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	slideID, ok := parsePositiveID(r.PathValue("slideId"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slide id")
		return
	}
	var seedHash sql.NullString
	err := s.DB.QueryRow(
		`SELECT seed_hash FROM announcement_set_slides WHERE id = ? AND ann_set_id = ?`,
		slideID, setID,
	).Scan(&seedHash)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Slide not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if !seedHash.Valid || seedHash.String == "" {
		writeError(w, http.StatusBadRequest, "Slide has no seed to reset to")
		return
	}

	writeError(w, http.StatusBadRequest, "Slide has no seed to reset to")
}

// DELETE /api/admin/announcement-sets/{id}/slides/{slideId}
func (s *Server) deleteAnnouncementSetSlide(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	slideID, ok := parsePositiveID(r.PathValue("slideId"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slide id")
		return
	}
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
		`SELECT updated_at FROM announcement_set_slides WHERE id = ? AND ann_set_id = ?`,
		slideID, setID,
	).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Slide not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Slide was modified by another session")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`DELETE FROM announcement_set_slides WHERE id = ? AND ann_set_id = ? AND updated_at = ?`, slideID, setID, updatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Slide was modified by another session")
		return
	}

	// Compact positions 0..N-1
	now := timeNowRFC3339Nano()
	rows, err := tx.Query(`SELECT id FROM announcement_set_slides WHERE ann_set_id = ? ORDER BY position ASC, id ASC`, setID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var slideIDs []int
	for rows.Next() {
		var sid int
		if err := rows.Scan(&sid); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		slideIDs = append(slideIDs, sid)
	}
	rows.Close()

	for i, sid := range slideIDs {
		if _, err := tx.Exec(`UPDATE announcement_set_slides SET position = ?, updated_at = ? WHERE id = ?`, i, now, sid); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": slideID})
}

// PUT /api/admin/announcement-sets/{id}/slides/order
func (s *Server) reorderAnnouncementSetSlides(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	setID, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid announcement set id")
		return
	}
	var exists int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM announcement_sets WHERE id = ?`, setID).Scan(&exists); err != nil || exists == 0 {
		writeError(w, http.StatusNotFound, "Announcement set not found")
		return
	}

	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	rawItems, ok := body["items"].([]any)
	if !ok {
		writeError(w, http.StatusBadRequest, "items must be an array")
		return
	}

	rows, err := s.DB.Query(`SELECT id, updated_at FROM announcement_set_slides WHERE ann_set_id = ? ORDER BY position ASC, id ASC`, setID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	type slideTok struct {
		id int
		at string
	}
	var live []slideTok
	tokens := map[int]string{}
	for rows.Next() {
		var t slideTok
		if err := rows.Scan(&t.id, &t.at); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		live = append(live, t)
		tokens[t.id] = t.at
	}
	if len(rawItems) != len(live) {
		writeError(w, http.StatusBadRequest, "items must contain every live slide in the set exactly once")
		return
	}

	seen := map[int]struct{}{}
	var order []int
	for _, raw := range rawItems {
		m, ok := raw.(map[string]any)
		if !ok {
			writeError(w, http.StatusBadRequest, "items must contain id and updatedAt")
			return
		}
		sid, ok := asPositiveInt(m["id"])
		if !ok {
			writeError(w, http.StatusBadRequest, "item id must be a positive integer")
			return
		}
		at, _ := m["updatedAt"].(string)
		if strings.TrimSpace(at) == "" {
			writeError(w, http.StatusBadRequest, "item updatedAt is required")
			return
		}
		storedAt, ok := tokens[sid]
		if !ok {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Unknown slide: %d", sid))
			return
		}
		if _, dup := seen[sid]; dup {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Duplicate slide: %d", sid))
			return
		}
		if storedAt != at {
			writeError(w, http.StatusConflict, "Slide was modified by another session")
			return
		}
		seen[sid] = struct{}{}
		order = append(order, sid)
	}

	now := timeNowRFC3339Nano()
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	for i, sid := range order {
		if _, err := tx.Exec(`UPDATE announcement_set_slides SET position = ?, updated_at = ? WHERE id = ? AND ann_set_id = ?`, i, now, sid, setID); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	s.listAnnouncementSetSlides(w, r)
}
