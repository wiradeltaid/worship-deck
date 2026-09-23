package httpapi

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/parse"
	"github.com/wiradeltaid/worship-deck/internal/plan"
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
		rawPayload, _ = body["rawPayload"].(string)
	}
	if strings.TrimSpace(rawPayload) == "" {
		writeError(w, http.StatusBadRequest, "raw_payload is required")
		return
	}

	var profile *parse.ParserProfile
	var profileID string
	var profileVersion int
	if pid, ok := body["parserProfileId"].(string); ok && strings.TrimSpace(pid) != "" {
		p, err := parse.LoadParserProfileByID(s.DB, strings.TrimSpace(pid))
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("parser profile %q not found", pid))
			return
		}
		profile = p
		profileID = p.ID
	} else if pid, ok := body["parser_profile_id"].(string); ok && strings.TrimSpace(pid) != "" {
		p, err := parse.LoadParserProfileByID(s.DB, strings.TrimSpace(pid))
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("parser profile %q not found", pid))
			return
		}
		profile = p
		profileID = p.ID
	}
	if profile == nil {
		p, err := parse.LoadDefaultParserProfile(s.DB)
		if err == nil {
			profile = p
			profileID = p.ID
		} else {
			profile = parse.DefaultParserProfile()
			profileID = db.BuiltinDefaultParserProfileID
		}
	}
	if profile != nil && profileID != "" {
		_ = s.DB.QueryRow(`SELECT version FROM rundown_parser_profiles WHERE id = ?`, profileID).Scan(&profileVersion)
		if profileVersion == 0 {
			profileVersion = 1
		}
	}

	parsed := parse.Normalize(parse.ParseRundownWithProfile(s.DB, rawPayload, profile))
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
	activeLayoutID := "default-layout"
	_ = s.DB.QueryRow(`SELECT id FROM form_layouts WHERE is_active = 1 LIMIT 1`).Scan(&activeLayoutID)
	snapJSON, _ := db.BuildFormLayoutSnapshot(s.DB, activeLayoutID)

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
	gid := db.NewUUIDv7()
	res, err := tx.Exec(
		`INSERT INTO services (global_id, date, raw_payload, parsed_data, images_payload, participants_payload, afternoon_program, parser_profile_id, parser_profile_version, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, `+db.StampNowSQL+`)`,
		gid, serviceDate, rawPayload, string(parsedJSON), string(imagesJSON), participants, profileID, profileVersion,
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
	if fields := fieldValuesFromBody(body); len(fields) > 0 {
		if err := upsertFieldValues(tx, id, fields); err != nil {
			log.Printf("Error creating field values: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}
	if snapJSON != "" {
		_, _ = tx.Exec(`INSERT OR IGNORE INTO service_form_layout_snapshots (service_id, layout_version, snapshot_json, created_at) VALUES (?, 1, ?, CURRENT_TIMESTAMP)`, id, snapJSON)
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

func fieldValuesFromBody(body map[string]any) map[string]any {
	out := make(map[string]any)
	if fv, ok := body["field_values"].(map[string]any); ok {
		for k, v := range fv {
			out[k] = v
		}
	} else if fv, ok := body["fieldValues"].(map[string]any); ok {
		for k, v := range fv {
			out[k] = v
		}
	} else if f, ok := body["fields"].(map[string]any); ok {
		if fv, ok := f["field_values"].(map[string]any); ok {
			for k, v := range fv {
				out[k] = v
			}
		} else if fv, ok := f["fieldValues"].(map[string]any); ok {
			for k, v := range fv {
				out[k] = v
			}
		}
	}

	checkSet := func(canonical string, val any) {
		if _, exists := out[canonical]; !exists {
			if s, ok := val.(string); ok && strings.TrimSpace(s) != "" {
				out[canonical] = strings.TrimSpace(s)
			}
		}
	}

	if vr, ok := body["verseReading"].(map[string]any); ok {
		checkSet("scripture_reference", vr["reference"])
		checkSet("scripture_text", vr["text"])
		checkSet("scripture_bible_version", vr["translation"])
	}
	if sermon, ok := body["sermon"].(map[string]any); ok {
		checkSet("sermon_speaker_name", sermon["speaker"])
		checkSet("sermon_title", sermon["title"])
	}
	checkSet("sermon_poster", body["sermonGraphicUrl"])
	checkSet("closing_prayer_person", body["closingPrayerPerson"])
	checkSet("special_song", body["specialSong"])
	checkSet("family_name", body["familyName"])
	checkSet("family_photo", body["familyPhotoUrl"])
	checkSet("family_request", body["familyPrayerRequest"])
	checkSet("youth_name", body["youthName"])
	checkSet("youth_photo", body["youthPhotoUrl"])
	checkSet("youth_request", body["youthPrayerRequest"])

	return out
}

func upsertFieldValues(tx *sql.Tx, serviceID int64, fieldValues map[string]any) error {
	if len(fieldValues) == 0 {
		return nil
	}
	stmt, err := tx.Prepare(`
		INSERT INTO service_field_values (service_id, variable_name, value_text, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(service_id, variable_name) DO UPDATE SET
			value_text = excluded.value_text,
			updated_at = CURRENT_TIMESTAMP
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for k, v := range fieldValues {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		var valStr string
		if s, ok := v.(string); ok {
			valStr = s
		} else if v != nil {
			valStr = fmt.Sprintf("%v", v)
		}
		if _, err := stmt.Exec(serviceID, k, valStr); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) storedFieldValues(serviceID int, parsedJSON, imagesJSON string) map[string]string {
	fields := make(map[string]string)
	hasStoredKey := make(map[string]bool)
	rows, err := s.DB.Query(`SELECT variable_name, value_text FROM service_field_values WHERE service_id = ?`, serviceID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k, v string
			if err := rows.Scan(&k, &v); err == nil {
				fields[k] = v
				hasStoredKey[k] = true
			}
		}
	}

	// Per-key fallback from legacy parsed_data and images_payload for keys not stored in service_field_values
	if parsedJSON != "" {
		var parsed map[string]any
		if err := json.Unmarshal([]byte(parsedJSON), &parsed); err == nil {
			if vr, ok := parsed["verseReading"].(map[string]any); ok {
				if ref, ok := vr["reference"].(string); ok && ref != "" && !hasStoredKey["scripture_reference"] {
					fields["scripture_reference"] = ref
				}
				if text, ok := vr["text"].(string); ok && text != "" && !hasStoredKey["scripture_text"] {
					fields["scripture_text"] = text
				}
				if trans, ok := vr["translation"].(string); ok && trans != "" && !hasStoredKey["scripture_bible_version"] {
					fields["scripture_bible_version"] = trans
				}
			}
			if sermon, ok := parsed["sermon"].(map[string]any); ok {
				if sp, ok := sermon["speaker"].(string); ok && sp != "" && !hasStoredKey["sermon_speaker_name"] {
					fields["sermon_speaker_name"] = sp
				}
				if title, ok := sermon["title"].(string); ok && title != "" && !hasStoredKey["sermon_title"] {
					fields["sermon_title"] = title
				}
			}
			if cpp, ok := parsed["closingPrayerPerson"].(string); ok && cpp != "" && !hasStoredKey["closing_prayer_person"] {
				fields["closing_prayer_person"] = cpp
			}
			if ss, ok := parsed["specialSong"].(string); ok && ss != "" && !hasStoredKey["special_song"] {
				fields["special_song"] = ss
			}
			if fn, ok := parsed["familyName"].(string); ok && fn != "" && !hasStoredKey["family_name"] {
				fields["family_name"] = fn
			}
			if fpr, ok := parsed["familyPrayerRequest"].(string); ok && fpr != "" && !hasStoredKey["family_request"] {
				fields["family_request"] = fpr
			}
			if yn, ok := parsed["youthName"].(string); ok && yn != "" && !hasStoredKey["youth_name"] {
				fields["youth_name"] = yn
			}
			if ypr, ok := parsed["youthPrayerRequest"].(string); ok && ypr != "" && !hasStoredKey["youth_request"] {
				fields["youth_request"] = ypr
			}
		}
	}
	if imagesJSON != "" {
		var images map[string]any
		if err := json.Unmarshal([]byte(imagesJSON), &images); err == nil {
			if sp, ok := images["sermonGraphicUrl"].(string); ok && sp != "" && !hasStoredKey["sermon_poster"] {
				fields["sermon_poster"] = sp
			}
			if fp, ok := images["familyPhotoUrl"].(string); ok && fp != "" && !hasStoredKey["family_photo"] {
				fields["family_photo"] = fp
			}
			if yp, ok := images["youthPhotoUrl"].(string); ok && yp != "" && !hasStoredKey["youth_photo"] {
				fields["youth_photo"] = yp
			}
		}
	}
	return fields
}

func (s *Server) storedLayoutSnapshot(serviceID int) json.RawMessage {
	var snap string
	err := s.DB.QueryRow(`SELECT snapshot_json FROM service_form_layout_snapshots WHERE service_id = ?`, serviceID).Scan(&snap)
	if err == nil && snap != "" {
		return json.RawMessage(snap)
	}
	snap, err = db.BuildFormLayoutSnapshot(s.DB, "default-layout")
	if err == nil && snap != "" {
		return json.RawMessage(snap)
	}
	return json.RawMessage("null")
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
	var inserts []string
	if arr, ok := body["announcementInserts"].([]any); ok {
		inserts = make([]string, 4)
		for i := 0; i < 4 && i < len(arr); i++ {
			if s, ok := arr[i].(string); ok && plan.IsSafeImageURL(s) {
				inserts[i] = s
			}
		}
	}
	if inserts == nil {
		inserts = []string{}
	}
	images = map[string]any{
		"images":           urls,
		"sermonGraphicUrl": sermon,
		"familyPhotoUrl":   family,
		"youthPhotoUrl":    youth,
	}
	if _, has := body["announcementInserts"]; has {
		images["announcementInserts"] = inserts
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
		`SELECT id, COALESCE(global_id, ''), date, raw_payload, parsed_data, images_payload, participants_payload,
		        parser_profile_id, parser_profile_version,
		        created_at, COALESCE(updated_at, created_at)
		   FROM services WHERE id = ?`,
		id,
	)
	var out struct {
		ID                   int             `json:"id"`
		GlobalID             string          `json:"global_id"`
		Date                 string          `json:"date"`
		RawPayload           string          `json:"raw_payload"`
		ParsedData           json.RawMessage `json:"parsed_data"`
		ImagesPayload        json.RawMessage `json:"images_payload"`
		Participants         any             `json:"participants_payload"`
		SongSets             map[string]any  `json:"songSets"`
		ParserProfileID      *string         `json:"parser_profile_id,omitempty"`
		ParserProfileVersion *int            `json:"parser_profile_version,omitempty"`
		CreatedAt            string          `json:"created_at"`
		UpdatedAt            string          `json:"updated_at"`
		Plan                 any             `json:"plan"`
		PlanIdentity         string            `json:"plan_identity"`
		Transition           string            `json:"transition"`
		FieldValues          map[string]string `json:"field_values"`
		FormLayoutSnapshot   json.RawMessage   `json:"form_layout_snapshot"`
	}
	var parsed, images, parts, profileID sql.NullString
	var profileVersion sql.NullInt64
	if err := row.Scan(&out.ID, &out.GlobalID, &out.Date, &out.RawPayload, &parsed, &images, &parts, &profileID, &profileVersion, &out.CreatedAt, &out.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "Service not found")
			return
		}
		log.Printf("Error reading service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if profileID.Valid && profileID.String != "" {
		out.ParserProfileID = &profileID.String
	}
	if profileVersion.Valid {
		v := int(profileVersion.Int64)
		out.ParserProfileVersion = &v
	}
	out.ParsedData = nullJSON(parsed)
	out.ImagesPayload = nullJSON(images)
	out.SongSets = s.storedSongSets(id)
	out.FieldValues = s.storedFieldValues(id, parsed.String, images.String)
	out.FormLayoutSnapshot = s.storedLayoutSnapshot(id)
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

	tx, err := s.DB.Begin()
	if err != nil {
		log.Printf("Error deleting service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	gid, err := db.GetGlobalIDTx(tx, "services", id)
	if err != nil {
		log.Printf("Error resolving service global_id: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if gid != "" {
		if err := db.RecordTombstoneTx(tx, gid, "service"); err != nil {
			log.Printf("Error recording tombstone: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	// SPEC-58: Collect candidate upload files belonging only to this service before deleting
	candidateUploads := collectServiceLocalUploads(tx, id)

	res, err := tx.Exec(
		`DELETE FROM services WHERE id = ? AND (COALESCE(updated_at, created_at) = ? OR COALESCE(updated_at, created_at) = ?)`,
		id, snap.UpdatedAt, snap.RawStoredToken,
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

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing service deletion: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	// Unlink now-unreferenced local uploads from disk after commit succeeds (FR-10)
	unlinkUnreferencedLocalUploads(s.DB, candidateUploads)

	writeJSON(w, http.StatusOK, map[string]any{"message": "Service deleted successfully"})
}

func collectServiceLocalUploads(tx *sql.Tx, serviceID int) []string {
	seen := make(map[string]struct{})
	var candidates []string

	// 1. services.images_payload
	var imagesPayload sql.NullString
	if err := tx.QueryRow(`SELECT images_payload FROM services WHERE id = ?`, serviceID).Scan(&imagesPayload); err == nil && imagesPayload.Valid && imagesPayload.String != "" {
		for _, fn := range plan.ExtractLocalUploadFilenames(imagesPayload.String) {
			if _, ok := seen[fn]; !ok {
				seen[fn] = struct{}{}
				candidates = append(candidates, fn)
			}
		}
	}

	// 2. service_field_values
	rows, err := tx.Query(`SELECT value_text FROM service_field_values WHERE service_id = ?`, serviceID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var val string
			if err := rows.Scan(&val); err == nil && val != "" {
				if fn, ok := plan.LocalUploadFilename(val); ok {
					if _, exists := seen[fn]; !exists {
						seen[fn] = struct{}{}
						candidates = append(candidates, fn)
					}
				} else {
					for _, fn := range plan.ExtractLocalUploadFilenames(val) {
						if _, exists := seen[fn]; !exists {
							seen[fn] = struct{}{}
							candidates = append(candidates, fn)
						}
					}
				}
			}
		}
	}

	return candidates
}

func isLocalUploadStillReferenced(db *sql.DB, filename string) bool {
	likePattern := "%" + filename + "%"

	queries := []string{
		`SELECT 1 FROM services WHERE images_payload LIKE ? LIMIT 1`,
		`SELECT 1 FROM service_field_values WHERE value_text LIKE ? LIMIT 1`,
		`SELECT 1 FROM announcement_items WHERE image_url LIKE ? LIMIT 1`,
		`SELECT 1 FROM artifact_templates WHERE payload IS NOT NULL AND payload LIKE ? LIMIT 1`,
		`SELECT 1 FROM announcement_set_slides WHERE payload IS NOT NULL AND payload LIKE ? LIMIT 1`,
		`SELECT 1 FROM background_library_images WHERE url IS NOT NULL AND url LIKE ? LIMIT 1`,
		`SELECT 1 FROM song_set_layouts WHERE payload IS NOT NULL AND payload LIKE ? LIMIT 1`,
		`SELECT 1 FROM service_song_set_layouts WHERE payload IS NOT NULL AND payload LIKE ? LIMIT 1`,
	}

	for _, q := range queries {
		var dummy int
		err := db.QueryRow(q, likePattern).Scan(&dummy)
		if err == nil {
			return true
		}
	}

	return false
}

func unlinkUnreferencedLocalUploads(db *sql.DB, filenames []string) {
	if len(filenames) == 0 {
		return
	}
	dir := uploadsDir()
	for _, fn := range filenames {
		if isLocalUploadStillReferenced(db, fn) {
			continue
		}
		path := filepath.Join(dir, filepath.Base(fn))
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			log.Printf("Error unlinking service upload %s: %v", fn, err)
		}
	}
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
	hasFieldValues := false
	if fv, ok := body["field_values"].(map[string]any); ok && len(fv) > 0 {
		hasFieldValues = true
	} else if fv, ok := body["fieldValues"].(map[string]any); ok && len(fv) > 0 {
		hasFieldValues = true
	}
	if rawPayload == nil && !parse.HasStructuredFields(body) && !hasFieldValues {
		writeError(w, http.StatusBadRequest, "Missing raw_payload or structured fields")
		return
	}

	var existing struct {
		raw, parsed, images, participants, date, created, updated, profileID sql.NullString
		profileVersion                                                       sql.NullInt64
	}
	err = s.DB.QueryRow(
		`SELECT raw_payload, parsed_data, images_payload, participants_payload, date,
		        parser_profile_id, parser_profile_version, created_at, updated_at
		   FROM services WHERE id = ?`,
		id,
	).Scan(&existing.raw, &existing.parsed, &existing.images, &existing.participants, &existing.date, &existing.profileID, &existing.profileVersion, &existing.created, &existing.updated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Service not found")
		return
	}
	if err != nil {
		log.Printf("Error updating service: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	rawStoredToken := existing.updated.String
	if rawStoredToken == "" {
		rawStoredToken = existing.created.String
	}
	currentUpdatedAt := formatTimestamp(rawStoredToken)
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

	var profile *parse.ParserProfile
	var profileID string
	var profileVersion int
	if pid, ok := body["parserProfileId"].(string); ok && strings.TrimSpace(pid) != "" {
		profileID = strings.TrimSpace(pid)
	} else if pid, ok := body["parser_profile_id"].(string); ok && strings.TrimSpace(pid) != "" {
		profileID = strings.TrimSpace(pid)
	}

	if profileID != "" {
		p, err := parse.LoadParserProfileByID(s.DB, profileID)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("parser profile %q not found", profileID))
			return
		}
		profile = p
		profileID = p.ID
		_ = s.DB.QueryRow(`SELECT version FROM rundown_parser_profiles WHERE id = ?`, p.ID).Scan(&profileVersion)
		if profileVersion == 0 {
			profileVersion = 1
		}
	}
	if profile == nil {
		p, err := parse.LoadDefaultParserProfile(s.DB)
		if err == nil {
			profile = p
			profileID = p.ID
			_ = s.DB.QueryRow(`SELECT version FROM rundown_parser_profiles WHERE id = ?`, p.ID).Scan(&profileVersion)
		} else {
			profile = parse.DefaultParserProfile()
			profileID = db.BuiltinDefaultParserProfileID
			profileVersion = 1
		}
	}

	storedRaw := existing.raw.String
	if rawPayload != nil {
		storedRaw = *rawPayload
	}
	var parsed parse.Rundown
	if rawPayload != nil {
		parsed = parse.Normalize(parse.ParseRundownWithProfile(s.DB, storedRaw, profile))
	} else if existing.parsed.Valid && existing.parsed.String != "" {
		if json.Unmarshal([]byte(existing.parsed.String), &parsed) != nil {
			parsed = parse.Normalize(parse.ParseRundownWithProfile(s.DB, storedRaw, profile))
		} else {
			parsed = parse.Normalize(parsed)
		}
	} else {
		parsed = parse.Normalize(parse.ParseRundownWithProfile(s.DB, storedRaw, profile))
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
	assignments := []string{`date = ?`, `raw_payload = ?`, `parsed_data = ?`, `parser_profile_id = ?`, `parser_profile_version = ?`, `updated_at = ` + db.StampNowSQL}
	args := []any{newDate, storedRaw, string(parsedJSON), profileID, profileVersion}
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
	args = append(args, id, currentUpdatedAt, rawStoredToken)
	res, err := tx.Exec(
		`UPDATE services SET `+strings.Join(assignments, ", ")+`
		  WHERE id = ? AND (COALESCE(updated_at, created_at) = ? OR COALESCE(updated_at, created_at) = ?)`,
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
	if fields := fieldValuesFromBody(body); len(fields) > 0 {
		if err := upsertFieldValues(tx, int64(id), fields); err != nil {
			log.Printf("Error updating field values: %v", err)
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
	_, hasInserts := body["announcementInserts"]

	fieldValues := fieldValuesFromBody(body)
	_, hasFvSermon := fieldValues["sermon_poster"]
	_, hasFvFamily := fieldValues["family_photo"]
	_, hasFvYouth := fieldValues["youth_photo"]

	if !hasImages && !hasSermon && !hasFamily && !hasYouth && !hasInserts && !hasFvSermon && !hasFvFamily && !hasFvYouth {
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
				if ins, ok := obj["announcementInserts"]; ok {
					current["announcementInserts"] = ins
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
	if hasInserts {
		if arr, ok := body["announcementInserts"].([]any); ok {
			inserts := make([]string, 4)
			for i := 0; i < 4 && i < len(arr); i++ {
				if s, ok := arr[i].(string); ok && plan.IsSafeImageURL(s) {
					inserts[i] = s
				}
			}
			current["announcementInserts"] = inserts
		} else {
			current["announcementInserts"] = []string{}
		}
	}
	if hasFvSermon && !hasSermon {
		if s, ok := fieldValues["sermon_poster"].(string); ok && strings.TrimSpace(s) != "" && plan.IsSafeImageURL(s) {
			current["sermonGraphicUrl"] = s
		} else {
			current["sermonGraphicUrl"] = nil
		}
	}
	if hasFvFamily && !hasFamily {
		if s, ok := fieldValues["family_photo"].(string); ok && strings.TrimSpace(s) != "" && plan.IsSafeImageURL(s) {
			current["familyPhotoUrl"] = s
		} else {
			current["familyPhotoUrl"] = nil
		}
	}
	if hasFvYouth && !hasYouth {
		if s, ok := fieldValues["youth_photo"].(string); ok && strings.TrimSpace(s) != "" && plan.IsSafeImageURL(s) {
			current["youthPhotoUrl"] = s
		} else {
			current["youthPhotoUrl"] = nil
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
	var profile *parse.ParserProfile
	if pid, ok := body["parserProfileId"].(string); ok && pid != "" {
		p, err := parse.LoadParserProfileByID(s.DB, pid)
		if err == nil {
			profile = p
		}
	} else if pid, ok := body["parser_profile_id"].(string); ok && pid != "" {
		p, err := parse.LoadParserProfileByID(s.DB, pid)
		if err == nil {
			profile = p
		}
	}
	if profile == nil {
		p, err := parse.LoadDefaultParserProfile(s.DB)
		if err == nil {
			profile = p
		} else {
			profile = parse.DefaultParserProfile()
		}
	}

	parsed := parse.Normalize(parse.ParseRundownWithProfile(s.DB, rawPayload, profile))
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
	if arr, ok := body["announcementInserts"].([]any); ok {
		inserts := make([]string, 4)
		for i := 0; i < 4 && i < len(arr); i++ {
			if s, ok := arr[i].(string); ok && plan.IsSafeImageURL(s) {
				inserts[i] = s
			}
		}
		media.AnnouncementInserts = inserts
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

	var slots []parse.SongSetEntrySlot
	sRows, sErr := s.DB.Query(`SELECT variable_name, title, position FROM song_set_entries ORDER BY position ASC`)
	if sErr == nil {
		defer sRows.Close()
		for sRows.Next() {
			var sl parse.SongSetEntrySlot
			if err := sRows.Scan(&sl.VariableName, &sl.Title, &sl.Position); err == nil {
				slots = append(slots, sl)
			}
		}
	}
	matchingResult := parse.MatchSongSets(parsed.SongCandidates, slots, profile.SongSetMatching)
	for k, v := range parsed.SongSetSuggestions {
		matchingResult.Suggestions[k] = v
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"plan":                items,
		"previewEntries":      preview,
		"date":                *parsed.Date,
		"failedHymnNumbers":   parsed.FailedHymnNumbers,
		"fields":              fieldsFromParsed(parsed),
		"fieldSuggestions":    parsed.FieldSuggestions,
		"songSetSuggestions": matchingResult.Suggestions,
		"songOverflow":        matchingResult.SongOverflow,
		"songSlotsUnfilled":   matchingResult.SongSlotsUnfilled,
		"unmappedLines":       parsed.UnmappedLines,
		"parserProfileId":     profile.ID,
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
