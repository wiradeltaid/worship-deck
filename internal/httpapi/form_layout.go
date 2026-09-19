package httpapi

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
	"github.com/wiradeltaid/worship-presenter-web/internal/parse"
)

func randomHex(bytes int) string {
	b := make([]byte, bytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Server) getWorshipFormLayout(w http.ResponseWriter, r *http.Request) {
	if !requireSession(w, r) {
		return
	}

	var layout db.FormLayout
	err := s.DB.QueryRow(`
		SELECT id, title, description, is_active, version, created_at, updated_at
		FROM form_layouts
		WHERE is_active = 1
		LIMIT 1
	`).Scan(&layout.ID, &layout.Title, &layout.Description, &layout.IsActive, &layout.Version, &layout.CreatedAt, &layout.UpdatedAt)
	if err == sql.ErrNoRows {
		err = s.DB.QueryRow(`
			SELECT id, title, description, is_active, version, created_at, updated_at
			FROM form_layouts
			WHERE id = 'default-layout'
			LIMIT 1
		`).Scan(&layout.ID, &layout.Title, &layout.Description, &layout.IsActive, &layout.Version, &layout.CreatedAt, &layout.UpdatedAt)
	}
	if err != nil && err != sql.ErrNoRows {
		writeError(w, http.StatusInternalServerError, "Failed to query form layout")
		return
	}
	if layout.ID == "" {
		layout = db.FormLayout{
			ID:          "default-layout",
			Title:       "Default Form Layout",
			Description: "Standard layout for worship services",
			IsActive:    1,
			Version:     1,
		}
	}

	// Fetch groupings
	gRows, err := s.DB.Query(`
		SELECT id, layout_id, label, description, sort_order, created_at, updated_at
		FROM form_groupings
		WHERE layout_id = ?
		ORDER BY sort_order ASC
	`, layout.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to query form groupings")
		return
	}
	defer gRows.Close()

	var groupings []db.FormGrouping
	for gRows.Next() {
		var g db.FormGrouping
		if err := gRows.Scan(&g.ID, &g.LayoutID, &g.Label, &g.Description, &g.SortOrder, &g.CreatedAt, &g.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan grouping")
			return
		}
		g.Slots = []db.FormGroupSlot{}
		groupings = append(groupings, g)
	}
	if err := gRows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed iterating groupings")
		return
	}

	// Fetch slots for each grouping
	for i := range groupings {
		sRows, err := s.DB.Query(`
			SELECT id, layout_id, grouping_id, sort_order, widget_kind, ref_key, created_at, updated_at
			FROM form_group_slots
			WHERE grouping_id = ?
			ORDER BY sort_order ASC
		`, groupings[i].ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to query slots")
			return
		}
		for sRows.Next() {
			var slot db.FormGroupSlot
			if err := sRows.Scan(&slot.ID, &slot.LayoutID, &slot.GroupingID, &slot.SortOrder, &slot.WidgetKind, &slot.RefKey, &slot.CreatedAt, &slot.UpdatedAt); err != nil {
				sRows.Close()
				writeError(w, http.StatusInternalServerError, "Failed to scan slot")
				return
			}
			groupings[i].Slots = append(groupings[i].Slots, slot)
		}
		sRows.Close()
	}

	// Fetch active predefined fields
	fRows, err := s.DB.Query(`
		SELECT id, variable_name, shown_text, field_type, input_length, initial_lines, extraction_regex, seed_key, is_system, is_active, created_at, updated_at
		FROM predefined_fields
		WHERE is_active = 1
		ORDER BY created_at ASC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to query predefined fields")
		return
	}
	defer fRows.Close()

	var fields []db.PredefinedField
	for fRows.Next() {
		var f db.PredefinedField
		if err := fRows.Scan(&f.ID, &f.VariableName, &f.ShownText, &f.FieldType, &f.InputLength, &f.InitialLines, &f.ExtractionRegex, &f.SeedKey, &f.IsSystem, &f.IsActive, &f.CreatedAt, &f.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan predefined field")
			return
		}
		fields = append(fields, f)
	}
	if fields == nil {
		fields = []db.PredefinedField{}
	}
	if groupings == nil {
		groupings = []db.FormGrouping{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"layout":            layout,
		"groupings":         groupings,
		"predefined_fields": fields,
	})
}

func (s *Server) createOrUpdateFormGrouping(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var req struct {
		ID          string `json:"id"`
		LayoutID    string `json:"layout_id"`
		Label       string `json:"label"`
		Description string `json:"description"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Label = strings.TrimSpace(req.Label)
	if req.Label == "" {
		writeError(w, http.StatusBadRequest, "label is required")
		return
	}

	if req.LayoutID == "" {
		req.LayoutID = "default-layout"
	}

	if req.ID != "" {
		res, err := s.DB.Exec(`
			UPDATE form_groupings
			SET label = ?, description = ?, sort_order = CASE WHEN ? > 0 THEN ? ELSE sort_order END, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, req.Label, req.Description, req.SortOrder, req.SortOrder, req.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update grouping: %v", err))
			return
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			writeError(w, http.StatusNotFound, "Grouping not found")
			return
		}
	} else {
		req.ID = "grouping-" + randomHex(4)
		if req.SortOrder <= 0 {
			_ = s.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) + 1 FROM form_groupings WHERE layout_id = ?`, req.LayoutID).Scan(&req.SortOrder)
		}
		_, err := s.DB.Exec(`
			INSERT INTO form_groupings (id, layout_id, label, description, sort_order)
			VALUES (?, ?, ?, ?, ?)
		`, req.ID, req.LayoutID, req.Label, req.Description, req.SortOrder)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to insert grouping: %v", err))
			return
		}
	}

	var result db.FormGrouping
	err := s.DB.QueryRow(`
		SELECT id, layout_id, label, description, sort_order, created_at, updated_at
		FROM form_groupings
		WHERE id = ?
	`, req.ID).Scan(&result.ID, &result.LayoutID, &result.Label, &result.Description, &result.SortOrder, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load saved grouping")
		return
	}
	result.Slots = []db.FormGroupSlot{}

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) deleteFormGrouping(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	_, _ = s.DB.Exec(`DELETE FROM form_group_slots WHERE grouping_id = ?`, id)
	res, err := s.DB.Exec(`DELETE FROM form_groupings WHERE id = ?`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to delete grouping: %v", err))
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "Grouping not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) reorderFormGroupings(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	type reorderItem struct {
		ID        string `json:"id"`
		SortOrder int    `json:"sort_order"`
	}

	var items []reorderItem
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := json.Unmarshal(raw, &items); err != nil {
		var wrapper struct {
			Groupings []reorderItem `json:"groupings"`
			Items     []reorderItem `json:"items"`
		}
		if err2 := json.Unmarshal(raw, &wrapper); err2 != nil {
			writeError(w, http.StatusBadRequest, "Invalid reorder payload format")
			return
		}
		if len(wrapper.Groupings) > 0 {
			items = wrapper.Groupings
		} else {
			items = wrapper.Items
		}
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	// Determine layout_id
	var layoutID string
	if len(items) > 0 {
		_ = tx.QueryRow(`SELECT layout_id FROM form_groupings WHERE id = ?`, items[0].ID).Scan(&layoutID)
	}
	if layoutID == "" {
		layoutID = "default-layout"
	}

	// Fetch all groupings in layout
	rows, err := tx.Query(`SELECT id FROM form_groupings WHERE layout_id = ? ORDER BY sort_order ASC`, layoutID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to query groupings")
		return
	}
	var allIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			allIDs = append(allIDs, id)
		}
	}
	rows.Close()

	// Step 1: Temporarily set negative sort orders for ALL groupings in this layout
	for i, id := range allIDs {
		tempOrder := -(i + 1) - 10000
		if _, err := tx.Exec(`UPDATE form_groupings SET sort_order = ? WHERE id = ?`, tempOrder, id); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed temp sort order: %v", err))
			return
		}
	}

	// Step 2: Apply provided sort orders
	usedOrders := make(map[int]bool)
	updatedIDs := make(map[string]bool)
	maxOrder := 0
	for _, item := range items {
		if item.ID != "" {
			if _, err := tx.Exec(`UPDATE form_groupings SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, item.SortOrder, item.ID); err != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update sort order for %s: %v", item.ID, err))
				return
			}
			usedOrders[item.SortOrder] = true
			updatedIDs[item.ID] = true
			if item.SortOrder > maxOrder {
				maxOrder = item.SortOrder
			}
		}
	}

	// Step 3: For any groupings in layout not in items, restore them to positive sort orders after maxOrder
	nextOrder := maxOrder + 1
	for _, id := range allIDs {
		if !updatedIDs[id] {
			for usedOrders[nextOrder] {
				nextOrder++
			}
			if _, err := tx.Exec(`UPDATE form_groupings SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, nextOrder, id); err != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed restoring unmentioned grouping %s: %v", id, err))
				return
			}
			usedOrders[nextOrder] = true
			nextOrder++
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) createFormGroupingSlot(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var req struct {
		ID         string `json:"id"`
		LayoutID   string `json:"layout_id"`
		GroupingID string `json:"grouping_id"`
		WidgetKind string `json:"widget_kind"`
		RefKey     string `json:"ref_key"`
		SortOrder  int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.GroupingID = strings.TrimSpace(req.GroupingID)
	req.WidgetKind = strings.TrimSpace(req.WidgetKind)
	req.RefKey = strings.TrimSpace(req.RefKey)

	if req.GroupingID == "" || req.WidgetKind == "" || req.RefKey == "" {
		writeError(w, http.StatusBadRequest, "grouping_id, widget_kind, and ref_key are required")
		return
	}

	if req.WidgetKind != "predefined_field" && req.WidgetKind != "song_set_entry" && req.WidgetKind != "announcement_slot" {
		writeError(w, http.StatusBadRequest, "widget_kind must be predefined_field, song_set_entry, or announcement_slot")
		return
	}

	if req.WidgetKind == "announcement_slot" {
		if req.RefKey != "1" && req.RefKey != "2" && req.RefKey != "3" && req.RefKey != "4" {
			writeError(w, http.StatusBadRequest, "announcement_slot ref_key must be '1', '2', '3', or '4'")
			return
		}
	}
	if req.WidgetKind == "predefined_field" {
		var exists int
		_ = s.DB.QueryRow(`SELECT COUNT(*) FROM predefined_fields WHERE variable_name = ?`, req.RefKey).Scan(&exists)
		if exists == 0 {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("predefined_field %q does not exist", req.RefKey))
			return
		}
	}

	var layoutID string
	err := s.DB.QueryRow(`SELECT layout_id FROM form_groupings WHERE id = ?`, req.GroupingID).Scan(&layoutID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid grouping_id: grouping does not exist")
		return
	}
	req.LayoutID = layoutID

	// Cardinality check: UNIQUE(layout_id, widget_kind, ref_key)
	var existingCount int
	_ = s.DB.QueryRow(`
		SELECT COUNT(*) FROM form_group_slots
		WHERE layout_id = ? AND widget_kind = ? AND ref_key = ?
	`, req.LayoutID, req.WidgetKind, req.RefKey).Scan(&existingCount)
	if existingCount > 0 {
		writeError(w, http.StatusConflict, fmt.Sprintf("Slot with widget_kind %q and ref_key %q already exists in this layout", req.WidgetKind, req.RefKey))
		return
	}

	if req.ID == "" {
		req.ID = "slot-" + randomHex(4)
	}
	if req.SortOrder <= 0 {
		_ = s.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) + 1 FROM form_group_slots WHERE grouping_id = ?`, req.GroupingID).Scan(&req.SortOrder)
	}

	_, err = s.DB.Exec(`
		INSERT INTO form_group_slots (id, layout_id, grouping_id, sort_order, widget_kind, ref_key)
		VALUES (?, ?, ?, ?, ?, ?)
	`, req.ID, req.LayoutID, req.GroupingID, req.SortOrder, req.WidgetKind, req.RefKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to insert slot: %v", err))
		return
	}

	var result db.FormGroupSlot
	err = s.DB.QueryRow(`
		SELECT id, layout_id, grouping_id, sort_order, widget_kind, ref_key, created_at, updated_at
		FROM form_group_slots
		WHERE id = ?
	`, req.ID).Scan(&result.ID, &result.LayoutID, &result.GroupingID, &result.SortOrder, &result.WidgetKind, &result.RefKey, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load saved slot")
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) deleteFormGroupingSlot(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	res, err := s.DB.Exec(`DELETE FROM form_group_slots WHERE id = ?`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to delete slot: %v", err))
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "Slot not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) reorderFormGroupingSlots(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	type reorderSlotItem struct {
		ID        string `json:"id"`
		SortOrder int    `json:"sort_order"`
	}

	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var items []reorderSlotItem
	var groupingID string
	if err := json.Unmarshal(raw, &items); err != nil {
		var wrapper struct {
			GroupingID string            `json:"grouping_id"`
			Slots      []reorderSlotItem `json:"slots"`
			Items      []reorderSlotItem `json:"items"`
		}
		if err2 := json.Unmarshal(raw, &wrapper); err2 != nil {
			writeError(w, http.StatusBadRequest, "Invalid reorder payload format")
			return
		}
		groupingID = wrapper.GroupingID
		if len(wrapper.Slots) > 0 {
			items = wrapper.Slots
		} else {
			items = wrapper.Items
		}
	}

	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	// Determine grouping_id if not given
	if groupingID == "" && len(items) > 0 {
		_ = tx.QueryRow(`SELECT grouping_id FROM form_group_slots WHERE id = ?`, items[0].ID).Scan(&groupingID)
	}

	var allSlotIDs []string
	if groupingID != "" {
		rows, err := tx.Query(`SELECT id FROM form_group_slots WHERE grouping_id = ? ORDER BY sort_order ASC`, groupingID)
		if err == nil {
			for rows.Next() {
				var sid string
				if err := rows.Scan(&sid); err == nil {
					allSlotIDs = append(allSlotIDs, sid)
				}
			}
			rows.Close()
		}
	}

	// Step 1: Temporarily set negative sort orders for ALL slots in grouping
	for i, sid := range allSlotIDs {
		tempOrder := -(i + 1) - 10000
		if _, err := tx.Exec(`UPDATE form_group_slots SET sort_order = ? WHERE id = ?`, tempOrder, sid); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed temp slot sort order for %s: %v", sid, err))
			return
		}
	}

	// Step 2: Apply target sort orders
	usedOrders := make(map[int]bool)
	updatedIDs := make(map[string]bool)
	maxOrder := 0
	for _, item := range items {
		if item.ID != "" {
			if _, err := tx.Exec(`UPDATE form_group_slots SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, item.SortOrder, item.ID); err != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update slot sort order for %s: %v", item.ID, err))
				return
			}
			usedOrders[item.SortOrder] = true
			updatedIDs[item.ID] = true
			if item.SortOrder > maxOrder {
				maxOrder = item.SortOrder
			}
		}
	}

	// Step 3: Restore unmentioned slots
	nextOrder := maxOrder + 1
	for _, sid := range allSlotIDs {
		if !updatedIDs[sid] {
			for usedOrders[nextOrder] {
				nextOrder++
			}
			if _, err := tx.Exec(`UPDATE form_group_slots SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, nextOrder, sid); err != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed restoring unmentioned slot %s: %v", sid, err))
				return
			}
			usedOrders[nextOrder] = true
			nextOrder++
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) createOrUpdatePredefinedField(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	var req struct {
		ID              string  `json:"id"`
		VariableName    string  `json:"variable_name"`
		ShownText       string  `json:"shown_text"`
		FieldType       string  `json:"field_type"`
		InputLength     *int    `json:"input_length"`
		InitialLines    *int    `json:"initial_lines"`
		ExtractionRegex *string `json:"extraction_regex"`
		IsActive        *int    `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.VariableName = strings.TrimSpace(req.VariableName)
	req.ShownText = strings.TrimSpace(req.ShownText)
	req.FieldType = strings.TrimSpace(req.FieldType)

	if req.VariableName == "" || req.ShownText == "" || req.FieldType == "" {
		writeError(w, http.StatusBadRequest, "variable_name, shown_text, and field_type are required")
		return
	}

	if !db.IsValidVariableName(req.VariableName) {
		writeError(w, http.StatusBadRequest, "Invalid variable_name format: must match /^[a-z][a-z0-9_]{1,63}$/")
		return
	}

	if db.IsReservedVariableName(req.VariableName) {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("variable_name %q is reserved", req.VariableName))
		return
	}

	if req.FieldType != "text" && req.FieldType != "text_area" && req.FieldType != "image" {
		writeError(w, http.StatusBadRequest, "field_type must be text, text_area, or image")
		return
	}

	if req.FieldType == "image" {
		if req.ExtractionRegex != nil && strings.TrimSpace(*req.ExtractionRegex) != "" {
			writeError(w, http.StatusBadRequest, "Image fields cannot have an extraction regex")
			return
		}
		req.ExtractionRegex = nil
	}

	if req.ExtractionRegex != nil && strings.TrimSpace(*req.ExtractionRegex) != "" {
		trimmed := strings.TrimSpace(*req.ExtractionRegex)
		if _, err := parse.ValidateAndTranslateRegex(trimmed); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid extraction regex: %v", err))
			return
		}
		req.ExtractionRegex = &trimmed
	} else {
		req.ExtractionRegex = nil
	}

	isActive := 1
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	if req.ID != "" {
		res, err := s.DB.Exec(`
			UPDATE predefined_fields
			SET shown_text = ?, field_type = ?, input_length = ?, initial_lines = ?, extraction_regex = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, req.ShownText, req.FieldType, req.InputLength, req.InitialLines, req.ExtractionRegex, isActive, req.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to update predefined field: %v", err))
			return
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			writeError(w, http.StatusNotFound, "Predefined field not found")
			return
		}
	} else {
		var existingID string
		err := s.DB.QueryRow(`SELECT id FROM predefined_fields WHERE variable_name = ?`, req.VariableName).Scan(&existingID)
		if err == nil {
			writeError(w, http.StatusConflict, fmt.Sprintf("variable_name %q already exists", req.VariableName))
			return
		}

		req.ID = "field-" + strings.ReplaceAll(req.VariableName, "_", "-")
		_, err = s.DB.Exec(`
			INSERT INTO predefined_fields (
				id, variable_name, shown_text, field_type, input_length, initial_lines, extraction_regex, is_system, is_active
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
		`, req.ID, req.VariableName, req.ShownText, req.FieldType, req.InputLength, req.InitialLines, req.ExtractionRegex, isActive)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to insert predefined field: %v", err))
			return
		}
	}

	var result db.PredefinedField
	err := s.DB.QueryRow(`
		SELECT id, variable_name, shown_text, field_type, input_length, initial_lines, extraction_regex, seed_key, is_system, is_active, created_at, updated_at
		FROM predefined_fields
		WHERE id = ?
	`, req.ID).Scan(&result.ID, &result.VariableName, &result.ShownText, &result.FieldType, &result.InputLength, &result.InitialLines, &result.ExtractionRegex, &result.SeedKey, &result.IsSystem, &result.IsActive, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load saved field")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) deletePredefinedField(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	res, err := s.DB.Exec(`UPDATE predefined_fields SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to soft-delete field: %v", err))
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "Predefined field not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) seedDefaultPredefinedFields(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}

	report, err := db.SeedDefaultPredefinedFields(s.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to seed default predefined fields: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, report)
}
