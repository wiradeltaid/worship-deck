package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
	"github.com/wiradeltaid/worship-presenter-web/internal/parse"
	"github.com/wiradeltaid/worship-presenter-web/internal/plan"
)

type serviceListItem struct {
	ID         int             `json:"id"`
	Date       string          `json:"date"`
	CreatedAt  string          `json:"created_at"`
	UpdatedAt  string          `json:"updated_at"`
	RawPayload string          `json:"raw_payload"`
	ParsedData json.RawMessage `json:"parsed_data"`
}

func (s *Server) listServices(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	var rows *sql.Rows
	var err error
	const cols = `id, date, raw_payload, parsed_data, created_at, COALESCE(updated_at, created_at) AS updated_at`
	if q != "" {
		like := "%" + q + "%"
		rows, err = s.DB.Query(
			`SELECT `+cols+` FROM services
			  WHERE date LIKE ? OR raw_payload LIKE ? OR IFNULL(parsed_data, '') LIKE ?
			  ORDER BY date DESC, id DESC`,
			like, like, like,
		)
	} else {
		rows, err = s.DB.Query(`SELECT ` + cols + ` FROM services ORDER BY date DESC, id DESC`)
	}
	if err != nil {
		log.Printf("Error listing services: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer rows.Close()
	list := []serviceListItem{}
	for rows.Next() {
		var it serviceListItem
		var parsed sql.NullString
		if err := rows.Scan(&it.ID, &it.Date, &it.RawPayload, &parsed, &it.CreatedAt, &it.UpdatedAt); err != nil {
			log.Printf("Error listing services: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if parsed.Valid && parsed.String != "" {
			it.ParsedData = json.RawMessage(parsed.String)
		} else {
			it.ParsedData = []byte("null")
		}
		it.CreatedAt = formatTimestamp(it.CreatedAt)
		it.UpdatedAt = formatTimestamp(it.UpdatedAt)
		list = append(list, it)
	}
	qOut := any(nil)
	if q != "" {
		qOut = q
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"services": list,
		"q":        qOut,
		"count":    len(list),
	})
}

func (s *Server) createService(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 4<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	rawPayload, _ := body["raw_payload"].(string)
	if strings.TrimSpace(rawPayload) == "" {
		writeError(w, http.StatusBadRequest, "raw_payload is required")
		return
	}
	parsed := parse.Normalize(parse.ParseRundown(s.DB, rawPayload))
	if parse.HasStructuredFields(body) {
		parse.ApplyStructuredFields(s.DB, &parsed, body)
		parsed = parse.Normalize(parsed)
	}
	if parsed.Date == nil || *parsed.Date == "" {
		writeError(w, http.StatusBadRequest, "Could not parse service date from raw_payload")
		return
	}
	serviceDate := *parsed.Date

	images, participants, errMsg := narrowCreatePayload(body)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	allowSecond, _ := body["allowSecond"].(bool)

	parsedJSON, _ := json.Marshal(parsed)
	imagesJSON, _ := json.Marshal(images)
	tx, err := s.DB.Begin()
	if err != nil {
		log.Printf("Error creating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	var existingID int
	err = tx.QueryRow(`SELECT id FROM services WHERE date = ?`, serviceDate).Scan(&existingID)
	if err == nil && !allowSecond {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":      "Service already exists for this date",
			"existingId": existingID,
			"date":       serviceDate,
		})
		return
	}
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error creating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	res, err := tx.Exec(
		`INSERT INTO services (date, raw_payload, parsed_data, images_payload, participants_payload, updated_at)
		 VALUES (?, ?, ?, ?, ?, `+db.StampNowSQL+`)`,
		serviceDate, rawPayload, string(parsedJSON), string(imagesJSON), participants,
	)
	if err != nil {
		log.Printf("Error creating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	id, _ := res.LastInsertId()
	if sets := songSetInputsFromBody(body); sets != nil {
		if err := upsertSongSetInputs(tx, id, sets); err != nil {
			log.Printf("Error creating service: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("Error creating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if err := db.CloneRegistryToNewService(s.DB, int(id)); err != nil {
		log.Printf("Error creating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"message":           "Service created successfully",
		"id":                id,
		"date":              serviceDate,
		"failedHymnNumbers": parsed.FailedHymnNumbers,
	})
}

func boolFrom(v any) bool {
	b, _ := v.(bool)
	return b
}

// songSetInputsFromBody extracts the Song Set weekly inputs from a create or
// update body (DEC-004 / FR-32). The Hub form sends them under
// `fields.songSets`, keyed by the Registry entry's variable_name; a top-level
// `songSets` is accepted for parity with the other structured fields. A nil
// result means the body carries no song-set section and stored rows are left
// untouched.
func songSetInputsFromBody(body map[string]any) map[string]any {
	if m, ok := body["songSets"].(map[string]any); ok {
		return m
	}
	if f, ok := body["fields"].(map[string]any); ok {
		if m, ok := f["songSets"].(map[string]any); ok {
			return m
		}
	}
	return nil
}

func nullableTrimmedString(v any) any {
	s, ok := v.(string)
	if !ok {
		return nil
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return s
}

// upsertSongSetInputs writes one song_set_inputs row per entry (LC-12: upsert,
// never insert-only). Entry shape per `.how/hub/05-model/form-fields.md`:
// `{ songNumber, songBookCode?, background?, lyricText? }`; an absent or empty
// value stores NULL so resolution falls through to the defaults (Supplement
// S3/S4, BR-7). Keys that cannot be a Registry variable_name are skipped —
// they can never match a live entry and would only litter the table.
func upsertSongSetInputs(tx *sql.Tx, serviceID int64, sets map[string]any) error {
	const q = `INSERT INTO song_set_inputs
	  (service_id, variable_name, song_number, song_book_code, background_id, lyric_override, updated_at)
	  VALUES (?, ?, ?, ?, ?, ?, ?)
	  ON CONFLICT(service_id, variable_name) DO UPDATE SET
	    song_number = excluded.song_number,
	    song_book_code = excluded.song_book_code,
	    background_id = excluded.background_id,
	    lyric_override = excluded.lyric_override,
	    updated_at = excluded.updated_at`
	now := timeNowRFC3339Nano()
	for name, raw := range sets {
		if !songSetVariableNameRE.MatchString(strings.TrimSpace(name)) {
			continue
		}
		var number any
		if em, ok := raw.(map[string]any); ok {
			if n := parse.CoerceSongNumber(em["songNumber"]); n != nil {
				number = *n
			}
		}
		var book, background, lyric any
		if em, ok := raw.(map[string]any); ok {
			book = nullableTrimmedString(em["songBookCode"])
			background = nullableTrimmedString(em["background"])
			lyric = nullableTrimmedString(em["lyricText"])
		}
		if _, err := tx.Exec(q, serviceID, strings.TrimSpace(name), number, book, background, lyric, now); err != nil {
			return err
		}
	}
	return nil
}

func narrowCreatePayload(body map[string]any) (images map[string]any, participants any, errMsg string) {
	sermon, err := optionalImage(body, "sermonGraphicUrl")
	if err != nil {
		return nil, nil, err.Error()
	}
	family, err := optionalImage(body, "familyPhotoUrl")
	if err != nil {
		return nil, nil, err.Error()
	}
	youth, err := optionalImage(body, "youthPhotoUrl")
	if err != nil {
		return nil, nil, err.Error()
	}
	var urls []string
	if arr, ok := body["images"].([]any); ok {
		for _, x := range arr {
			if s, ok := x.(string); ok && plan.IsSafeImageURL(s) {
				urls = append(urls, s)
			}
		}
	}
	if urls == nil {
		urls = []string{}
	}
	images = map[string]any{
		"images":           urls,
		"sermonGraphicUrl": sermon,
		"familyPhotoUrl":   family,
		"youthPhotoUrl":    youth,
	}
	if _, has := body["participantsRaw"]; has {
		switch v := body["participantsRaw"].(type) {
		case nil:
			participants = nil
		case string:
			participants = v
		default:
			return nil, nil, "participantsRaw must be a string or null"
		}
	}
	return images, participants, ""
}

func optionalImage(body map[string]any, field string) (any, error) {
	v, has := body[field]
	if !has {
		return nil, nil
	}
	_, out, err := plan.CoerceOptionalSafeImageURL(v, field)
	if err != nil {
		return nil, err
	}
	if out == nil {
		return nil, nil
	}
	return *out, nil
}

func (s *Server) getService(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}
	row := s.DB.QueryRow(
		`SELECT id, date, raw_payload, parsed_data, images_payload, participants_payload,
		        created_at, COALESCE(updated_at, created_at)
		   FROM services WHERE id = ?`,
		id,
	)
	var out struct {
		ID            int             `json:"id"`
		Date          string          `json:"date"`
		RawPayload    string          `json:"raw_payload"`
		ParsedData    json.RawMessage `json:"parsed_data"`
		ImagesPayload json.RawMessage `json:"images_payload"`
		Participants  any             `json:"participants_payload"`
		SongSets      map[string]any  `json:"songSets"`
		CreatedAt     string          `json:"created_at"`
		UpdatedAt     string          `json:"updated_at"`
		Plan          any             `json:"plan"`
		PlanIdentity  string          `json:"plan_identity"`
		Transition    string          `json:"transition"`
	}
	var parsed, images, parts sql.NullString
	if err := row.Scan(&out.ID, &out.Date, &out.RawPayload, &parsed, &images, &parts, &out.CreatedAt, &out.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "Service not found")
			return
		}
		log.Printf("Error reading service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	out.ParsedData = nullJSON(parsed)
	out.ImagesPayload = nullJSON(images)
	out.SongSets = s.storedSongSets(id)
	if parts.Valid {
		out.Participants = parts.String
	}
	out.CreatedAt = formatTimestamp(out.CreatedAt)
	out.UpdatedAt = formatTimestamp(out.UpdatedAt)
	date, items, transition, err := plan.PlanForService(s.DB, id)
	if err == nil {
		out.Plan = items
		out.PlanIdentity = plan.Identity(items)
		out.Transition = transition
		if date != "" {
			out.Date = date
		}
	} else {
		out.Plan = []any{}
		out.PlanIdentity = plan.Identity(nil)
		out.Transition = plan.LoadTransition(s.DB)
	}
	writeJSON(w, http.StatusOK, out)
}

func nullJSON(s sql.NullString) json.RawMessage {
	if s.Valid && s.String != "" {
		return json.RawMessage(s.String)
	}
	return json.RawMessage("null")
}

func (s *Server) deleteService(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}
	body, err, status, msg := readJSONObjectOptional(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	token := concurrencyToken(r, body)
	if token == "" {
		writeError(w, http.StatusBadRequest, requiredUpdatedAtMsg)
		return
	}
	snap, err := s.loadServiceSnapshot(id)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Service not found")
		return
	}
	if err != nil {
		log.Printf("Error deleting service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if token != snap.UpdatedAt {
		writeStaleToken(w, serviceConflictMsg, snap.UpdatedAt)
		return
	}
	res, err := s.DB.Exec(
		`DELETE FROM services WHERE id = ? AND COALESCE(updated_at, created_at) = ?`,
		id, token,
	)
	if err != nil {
		log.Printf("Error deleting service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		latest, loadErr := s.loadServiceSnapshot(id)
		if loadErr == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "Service not found")
			return
		}
		if loadErr != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		writeStaleToken(w, serviceConflictMsg, latest.UpdatedAt)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Service deleted successfully"})
}

func (s *Server) updateService(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}
	body, err, status, msg := readJSONObject(r, 4<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	clientUpdatedAt, _ := body["updated_at"].(string)
	clientUpdatedAt = strings.TrimSpace(clientUpdatedAt)
	if clientUpdatedAt == "" {
		writeError(w, http.StatusBadRequest, "updated_at is required for concurrent edit protection")
		return
	}
	rawValue, _ := body["raw_payload"].(string)
	var rawPayload *string
	if rawValue != "" {
		rawPayload = &rawValue
	}
	if rawPayload == nil && !parse.HasStructuredFields(body) {
		writeError(w, http.StatusBadRequest, "Missing raw_payload or structured fields")
		return
	}

	var existing struct {
		raw, parsed, images, participants, date, created, updated sql.NullString
	}
	err = s.DB.QueryRow(
		`SELECT raw_payload, parsed_data, images_payload, participants_payload, date, created_at, updated_at
		   FROM services WHERE id = ?`,
		id,
	).Scan(&existing.raw, &existing.parsed, &existing.images, &existing.participants, &existing.date, &existing.created, &existing.updated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Service not found")
		return
	}
	if err != nil {
		log.Printf("Error updating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	currentUpdatedAt := formatTimestamp(existing.updated.String)
	if currentUpdatedAt == "" {
		currentUpdatedAt = formatTimestamp(existing.created.String)
	}
	clientUpdatedAt = formatTimestamp(clientUpdatedAt)
	if clientUpdatedAt != currentUpdatedAt {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":      "Conflict: service was modified; refresh and retry",
			"updated_at": currentUpdatedAt,
		})
		return
	}

	imagesJSON, errMsg := mergeImagesPayload(existing.images, body)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	participants := existing.participants.String
	participantsSet := false
	if _, has := body["participantsRaw"]; has {
		participantsSet = true
		switch v := body["participantsRaw"].(type) {
		case nil:
			participants = ""
		case string:
			participants = v
		default:
			writeError(w, http.StatusBadRequest, "participantsRaw must be a string or null")
			return
		}
	}
	storedRaw := existing.raw.String
	if rawPayload != nil {
		storedRaw = *rawPayload
	}
	var parsed parse.Rundown
	if rawPayload != nil {
		parsed = parse.Normalize(parse.ParseRundown(s.DB, storedRaw))
	} else if existing.parsed.Valid && existing.parsed.String != "" {
		if json.Unmarshal([]byte(existing.parsed.String), &parsed) != nil {
			parsed = parse.Normalize(parse.ParseRundown(s.DB, storedRaw))
		} else {
			parsed = parse.Normalize(parsed)
		}
	} else {
		parsed = parse.Normalize(parse.ParseRundown(s.DB, storedRaw))
	}
	if parse.HasStructuredFields(body) {
		parse.ApplyStructuredFields(s.DB, &parsed, body)
		parsed = parse.Normalize(parsed)
	}
	parsedJSON, _ := json.Marshal(parsed)
	newDate := existing.date.String
	if parsed.Date != nil && *parsed.Date != "" {
		newDate = *parsed.Date
	}

	tx, err := s.DB.Begin()
	if err != nil {
		log.Printf("Error updating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	assignments := []string{`date = ?`, `raw_payload = ?`, `parsed_data = ?`, `updated_at = ` + db.StampNowSQL}
	args := []any{newDate, storedRaw, string(parsedJSON)}
	if imagesJSON != nil {
		assignments = append(assignments, `images_payload = ?`)
		args = append(args, *imagesJSON)
	}
	if participantsSet {
		assignments = append(assignments, `participants_payload = ?`)
		if participants == "" && body["participantsRaw"] == nil {
			args = append(args, nil)
		} else {
			args = append(args, participants)
		}
	}
	args = append(args, id, currentUpdatedAt)
	res, err := tx.Exec(
		`UPDATE services SET `+strings.Join(assignments, ", ")+`
		  WHERE id = ? AND COALESCE(updated_at, created_at) = ?`,
		args...,
	)
	if err != nil {
		log.Printf("Error updating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":      "Conflict: service was modified; refresh and retry",
			"updated_at": currentUpdatedAt,
		})
		return
	}
	if sets := songSetInputsFromBody(body); sets != nil {
		if err := upsertSongSetInputs(tx, int64(id), sets); err != nil {
			log.Printf("Error updating service: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("Error updating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var updatedAt string
	_ = s.DB.QueryRow(`SELECT COALESCE(updated_at, created_at) FROM services WHERE id = ?`, id).Scan(&updatedAt)
	updatedAt = formatTimestamp(updatedAt)
	failed := parsed.FailedHymnNumbers
	if failed == nil {
		failed = []int{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message":           "Service updated successfully",
		"failedHymnNumbers": failed,
		"updated_at":        updatedAt,
	})
}

func mergeImagesPayload(stored sql.NullString, body map[string]any) (*string, string) {
	_, hasImages := body["images"]
	_, hasSermon := body["sermonGraphicUrl"]
	_, hasFamily := body["familyPhotoUrl"]
	_, hasYouth := body["youthPhotoUrl"]
	if !hasImages && !hasSermon && !hasFamily && !hasYouth {
		return nil, ""
	}
	current := map[string]any{
		"images":           []any{},
		"sermonGraphicUrl": nil,
		"familyPhotoUrl":   nil,
		"youthPhotoUrl":    nil,
	}
	if stored.Valid && stored.String != "" {
		var v any
		if json.Unmarshal([]byte(stored.String), &v) == nil {
			if arr, ok := v.([]any); ok {
				current["images"] = arr
			} else if obj, ok := v.(map[string]any); ok {
				if imgs, ok := obj["images"]; ok {
					current["images"] = imgs
				} else if flyers, ok := obj["flyers"]; ok {
					current["images"] = flyers
				}
				if _, ok := obj["sermonGraphicUrl"]; ok {
					current["sermonGraphicUrl"] = obj["sermonGraphicUrl"]
				}
				if _, ok := obj["familyPhotoUrl"]; ok {
					current["familyPhotoUrl"] = obj["familyPhotoUrl"]
				}
				if _, ok := obj["youthPhotoUrl"]; ok {
					current["youthPhotoUrl"] = obj["youthPhotoUrl"]
				}
			}
		}
	}
	if hasImages {
		arr, _ := body["images"].([]any)
		urls := []string{}
		if arr != nil {
			for _, x := range arr {
				if s, ok := x.(string); ok && plan.IsSafeImageURL(s) {
					urls = append(urls, s)
				}
			}
		}
		current["images"] = urls
	}
	if hasSermon {
		_, out, err := plan.CoerceOptionalSafeImageURL(body["sermonGraphicUrl"], "sermonGraphicUrl")
		if err != nil {
			return nil, err.Error()
		}
		if out == nil {
			current["sermonGraphicUrl"] = nil
		} else {
			current["sermonGraphicUrl"] = *out
		}
	}
	if hasFamily {
		_, out, err := plan.CoerceOptionalSafeImageURL(body["familyPhotoUrl"], "familyPhotoUrl")
		if err != nil {
			return nil, err.Error()
		}
		if out == nil {
			current["familyPhotoUrl"] = nil
		} else {
			current["familyPhotoUrl"] = *out
		}
	}
	if hasYouth {
		_, out, err := plan.CoerceOptionalSafeImageURL(body["youthPhotoUrl"], "youthPhotoUrl")
		if err != nil {
			return nil, err.Error()
		}
		if out == nil {
			current["youthPhotoUrl"] = nil
		} else {
			current["youthPhotoUrl"] = *out
		}
	}
	b, _ := json.Marshal(current)
	s := string(b)
	return &s, ""
}

func (s *Server) previewService(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 4<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	rawPayload, _ := body["raw_payload"].(string)
	if strings.TrimSpace(rawPayload) == "" {
		writeError(w, http.StatusBadRequest, "raw_payload is required")
		return
	}
	parsed := parse.Normalize(parse.ParseRundown(s.DB, rawPayload))
	if parse.HasStructuredFields(body) {
		parse.ApplyStructuredFields(s.DB, &parsed, body)
		parsed = parse.Normalize(parsed)
	}
	if parsed.Date == nil || *parsed.Date == "" {
		writeError(w, http.StatusBadRequest, "Could not parse service date from raw_payload")
		return
	}
	sermon, err := optionalImage(body, "sermonGraphicUrl")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	family, err := optionalImage(body, "familyPhotoUrl")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	youth, err := optionalImage(body, "youthPhotoUrl")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var flyers []string
	if arr, ok := body["images"].([]any); ok {
		for _, x := range arr {
			if u, ok := x.(string); ok && plan.IsAnnouncementImageURL(u) {
				flyers = append(flyers, u)
			}
		}
	}
	media := plan.Media{Flyers: flyers}
	if s, ok := sermon.(string); ok {
		media.SermonGraphicURL = &s
	}
	if s, ok := family.(string); ok {
		media.FamilyPhotoURL = &s
	}
	if s, ok := youth.(string); ok {
		media.YouthPhotoURL = &s
	}
	serviceID := 0
	if sid, ok := body["serviceId"].(float64); ok && sid > 0 {
		serviceID = int(sid)
	} else if sid, ok := body["service_id"].(float64); ok && sid > 0 {
		serviceID = int(sid)
	}
	snap, err := plan.LoadSnapshot(s.DB, serviceID)
	if err != nil {
		log.Printf("Error generating preview: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	s.applyPreviewSongSets(&snap, body)
	items, err := plan.BuildSlidePlan(*parsed.Date, parsed.ToPlan(), media, snap)
	if err != nil {
		log.Printf("Error generating preview: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	preview := make([]map[string]any, 0, len(items))
	for i, it := range items {
		entryLabel := it.Artifact.Label
		if it.Artifact.BaseType == "song-set-entry" {
			roleLabel := ""
			if it.Artifact.Group != nil {
				roleLabel = strings.ToLower(strings.TrimSpace(it.Artifact.Group.RoleLabel))
			}
			if it.Artifact.LayoutKey == "title" || (it.Artifact.Group != nil && it.Artifact.Group.Role == "title") {
				entryLabel = "Song Title"
			} else if it.Artifact.LayoutKey == "reff" || strings.HasPrefix(roleLabel, "reff") || strings.HasPrefix(roleLabel, "chorus") {
				entryLabel = "Song Reff"
			} else if it.Artifact.LayoutKey == "verse" || it.Artifact.LayoutKey == "lyric" || (it.Artifact.Group != nil && it.Artifact.Group.Role == "lyric") {
				entryLabel = "Song Verse"
			}
		}
		entry := map[string]any{
			"index":      i,
			"instanceId": it.Artifact.InstanceID,
			"templateId": it.Artifact.TemplateID,
			"label":      entryLabel,
			"baseType":   it.Artifact.BaseType,
		}
		if it.Artifact.Group != nil {
			entry["groupId"] = it.Artifact.Group.ID
			entry["groupLabel"] = it.Artifact.Group.Label
			entry["role"] = it.Artifact.Group.Role
			if it.Artifact.Group.RoleLabel != "" {
				entry["roleLabel"] = it.Artifact.Group.RoleLabel
			}
		}
		preview = append(preview, entry)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"plan":              items,
		"previewEntries":    preview,
		"date":              *parsed.Date,
		"failedHymnNumbers": parsed.FailedHymnNumbers,
		"fields":            fieldsFromParsed(parsed),
	})
}

func (s *Server) applyPreviewSongSets(snap *plan.Snapshot, body map[string]any) {
	if snap == nil || body == nil {
		return
	}
	if snap.SongInputs == nil {
		snap.SongInputs = map[string]plan.HymnItem{}
	}
	var rawSets map[string]any
	if fields, ok := body["fields"].(map[string]any); ok {
		if ss, ok := fields["songSets"].(map[string]any); ok {
			rawSets = ss
		}
	}
	if rawSets == nil {
		if ss, ok := body["songSets"].(map[string]any); ok {
			rawSets = ss
		}
	}
	if rawSets == nil {
		return
	}
	defaultBook := db.ResolveSongBook(s.DB, "")
	for name, raw := range rawSets {
		vn := strings.TrimSpace(name)
		if vn == "" {
			continue
		}
		em, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		num := parse.CoerceSongNumber(em["songNumber"])
		if num == nil || *num <= 0 {
			continue
		}
		bookCode := ""
		if b, ok := em["songBookCode"].(string); ok && strings.TrimSpace(b) != "" {
			bookCode = strings.ToUpper(strings.TrimSpace(b))
		}
		resolvedBook := db.ResolveSongBook(s.DB, bookCode)
		if resolvedBook == "" {
			resolvedBook = defaultBook
		}
		lyricOverride := ""
		if lyr, ok := em["lyricText"].(string); ok && strings.TrimSpace(lyr) != "" {
			lyricOverride = strings.TrimSpace(lyr)
		}
		var title, dbLyrics string
		err := s.DB.QueryRow(
			`SELECT COALESCE(title, ''), COALESCE(lyrics, '') FROM hymns WHERE number = ? AND book_code = ?`,
			*num, resolvedBook,
		).Scan(&title, &dbLyrics)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("previewService: hymn lookup %d (%s): %v", *num, resolvedBook, err)
		}
		if title == "" {
			title = fmt.Sprintf("%s %d", resolvedBook, *num)
		}
		finalLyrics := dbLyrics
		if lyricOverride != "" {
			finalLyrics = lyricOverride
		}
		snap.SongInputs[vn] = plan.HymnItem{
			BookCode:   resolvedBook,
			Number:     *num,
			Title:      title,
			Lyrics:     finalLyrics,
			Incomplete: strings.TrimSpace(finalLyrics) == "",
		}
	}
}

// storedSongSets reads a Service's weekly Song Set inputs for form hydrate,
// keyed by variable_name. A read failure yields an empty object rather than an
// error — the edit form must still open when the table has no rows for this
// Service (AD-17 posture: a gap in existing data is never a crash).
func (s *Server) storedSongSets(serviceID int) map[string]any {
	out := map[string]any{}
	rows, err := s.DB.Query(
		`SELECT variable_name, song_number, song_book_code, background_id, lyric_override
		   FROM song_set_inputs WHERE service_id = ? ORDER BY variable_name`,
		serviceID,
	)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var number sql.NullInt64
		var book, background, lyric sql.NullString
		if err := rows.Scan(&name, &number, &book, &background, &lyric); err != nil {
			return out
		}
		entry := map[string]any{
			"songNumber":   nil,
			"songBookCode": nullStringOrEmpty(book),
			"background":   nullStringOrEmpty(background),
			"lyricText":    nullStringOrEmpty(lyric),
		}
		if number.Valid && number.Int64 > 0 {
			entry["songNumber"] = number.Int64
		}
		out[name] = entry
	}
	return out
}

func nullStringOrEmpty(s sql.NullString) string {
	if !s.Valid {
		return ""
	}
	return s.String
}

func fieldsFromParsed(p parse.Rundown) map[string]any {
	ref, text := "", ""
	if p.VerseReading != nil {
		if p.VerseReading.Reference != nil {
			ref = *p.VerseReading.Reference
		}
		text = p.VerseReading.Text
	}
	speaker, special, closing, family, youth, familyName, youthName := "", "", "", "", "", "", ""
	if p.Sermon != nil {
		speaker = p.Sermon.Speaker
	}
	if p.SpecialSong != nil {
		special = *p.SpecialSong
	}
	if p.ClosingPrayerPerson != nil {
		closing = *p.ClosingPrayerPerson
	}
	if p.FamilyPrayerRequest != nil {
		family = *p.FamilyPrayerRequest
	}
	if p.YouthPrayerRequest != nil {
		youth = *p.YouthPrayerRequest
	}
	if p.FamilyName != nil {
		familyName = *p.FamilyName
	}
	if p.YouthName != nil {
		youthName = *p.YouthName
	}
	// Song sets are weekly inputs owned by song_set_inputs (DEC-004), not
	// parsed_data overlays — the hydrate payload carries an empty map so the
	// create form starts clean and the edit form hydrates from the Service's
	// own stored rows instead.
	return map[string]any{
		"songSets":            map[string]any{},
		"verseReference":      ref,
		"verseText":           text,
		"sermonSpeaker":       speaker,
		"specialSong":         special,
		"closingPrayerPerson": closing,
		"familyPrayerRequest": family,
		"youthPrayerRequest":  youth,
		"familyName":          familyName,
		"youthName":           youthName,
	}
}
