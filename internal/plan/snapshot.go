package plan

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// AcceptLivePayload reports whether a live registry row may be cloned into a
// service snapshot. Corrupt JSON is omitted and logged (OQ-32), matching the
// TypeScript cloneValidLiveRows contract.
func AcceptLivePayload(id, payload string) bool {
	var tmpl Template
	if err := json.Unmarshal([]byte(payload), &tmpl); err != nil {
		log.Printf("[registry] template %q: persisted row rejected (not valid JSON); no layout is available: %v", id, err)
		return false
	}
	if tmpl.ID != id {
		log.Printf("[registry] template %q: persisted row rejected (payload id mismatch); no layout is available", id)
		return false
	}
	if tmpl.Layouts == nil {
		log.Printf("[registry] template %q: persisted row rejected (no layouts); no layout is available", id)
		return false
	}
	return true
}

// loadTemplates builds a snapshot from open Rows. trio must be loaded before
// opening rows — never query the DB from here (MaxOpenConns(1) deadlock).
func loadTemplates(rows *sql.Rows, useTemplateID bool, trio *songSetLayoutTrio) Snapshot {
	snap := Snapshot{
		ByID:                  map[string]Template{},
		SongInputs:            map[string]HymnItem{},
		AnnouncementSlides:    map[int][]AnnouncementSlide{},
		AnnouncementSetLabels: map[int]string{},
		FieldValues:           map[string]string{},
	}
	for rows.Next() {
		var id, label, baseType, updatedAt string
		var varName sql.NullString
		var payloadNull sql.NullString
		var annSetIDNull sql.NullInt64
		if err := rows.Scan(&id, &label, &baseType, &payloadNull, &updatedAt, &varName, &annSetIDNull); err != nil {
			log.Printf("[registry] scan failed: %v", err)
			continue
		}
		if baseType == "song-set-entry" && trio != nil {
			tmpl := composeSongSetEntryTemplate(id, label, trio)
			if varName.Valid && varName.String != "" {
				s := varName.String
				tmpl.VariableName = &s
			}
			snap.Order = append(snap.Order, id)
			snap.ByID[id] = tmpl
			continue
		}
		if baseType == "ann-set-marker" {
			tmpl := Template{
				SchemaVersion: 1,
				ID:            id,
				Label:         label,
				BaseType:      "ann-set-marker",
			}
			if annSetIDNull.Valid {
				v := int(annSetIDNull.Int64)
				tmpl.AnnSetID = &v
			}
			snap.Order = append(snap.Order, id)
			snap.ByID[id] = tmpl
			continue
		}
		if !payloadNull.Valid || payloadNull.String == "" {
			continue
		}
		payload := payloadNull.String
		if !AcceptLivePayload(id, payload) {
			continue
		}
		var tmpl Template
		_ = json.Unmarshal([]byte(payload), &tmpl)
		if varName.Valid && varName.String != "" {
			s := varName.String
			tmpl.VariableName = &s
		}
		if annSetIDNull.Valid {
			v := int(annSetIDNull.Int64)
			tmpl.AnnSetID = &v
		}
		snap.Order = append(snap.Order, id)
		snap.ByID[id] = tmpl
	}
	return snap
}

// loadSongSetLayoutTrioFor prefers the Service's frozen AD-33 trio over the
// live one: once a Service has been cloned (or Sync Artifact has run), its
// song-set-entry payloads must keep rendering against the canvases they were
// frozen with, even after an admin edits the live trio. Services without a
// freeze — and the live preview, serviceID 0 — read the live trio.
func loadSongSetLayoutTrioFor(db *sql.DB, serviceID int) (*songSetLayoutTrio, error) {
	if serviceID > 0 {
		var n int
		err := db.QueryRow(
			`SELECT COUNT(*) FROM service_song_set_layouts WHERE service_id = ?`,
			serviceID,
		).Scan(&n)
		if err == nil && n > 0 {
			return loadSongSetLayoutTrioQuery(
				db,
				`SELECT role, payload FROM service_song_set_layouts WHERE service_id = ?`,
				serviceID,
			)
		}
	}
	return loadSongSetLayoutTrio(db)
}

func LoadSnapshot(db *sql.DB, serviceID int) (Snapshot, error) {
	trio, _ := loadSongSetLayoutTrioFor(db, serviceID)
	var snap Snapshot
	var n int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM service_registry_snapshots WHERE service_id = ?`,
		serviceID,
	).Scan(&n); err != nil {
		return Snapshot{}, err
	}
	if n > 0 {
		rows, err := db.Query(
			`SELECT s.template_id, s.label, s.base_type, s.payload, s.updated_at,
			        COALESCE(s.variable_name, a.variable_name),
			        COALESCE(s.ann_set_id, a.ann_set_id)
			   FROM service_registry_snapshots s
			   LEFT JOIN artifact_templates a ON a.id = s.template_id
			  WHERE s.service_id = ?
			  ORDER BY s.position`,
			serviceID,
		)
		if err != nil {
			return Snapshot{}, err
		}
		defer rows.Close()
		snap = loadTemplates(rows, true, trio)
	} else {
		rows, err := db.Query(
			`SELECT id, label, base_type, payload, updated_at, variable_name, ann_set_id FROM artifact_templates ORDER BY position`,
		)
		if err != nil {
			return Snapshot{}, err
		}
		defer rows.Close()
		snap = loadTemplates(rows, false, trio)
	}

	if db != nil {
		loadAnnouncementSlidesIntoSnapshot(db, serviceID, &snap)
	}

	if serviceID > 0 && db != nil {
		loadSongSetInputsIntoSnapshot(db, serviceID, &snap)
		loadServiceFieldValuesIntoSnapshot(db, serviceID, &snap)
	}

	return snap, nil
}

func loadServiceFieldValuesIntoSnapshot(db *sql.DB, serviceID int, snap *Snapshot) {
	if snap.FieldValues == nil {
		snap.FieldValues = map[string]string{}
	}
	fRows, err := db.Query(`SELECT variable_name, value_text FROM service_field_values WHERE service_id = ?`, serviceID)
	if err != nil {
		return
	}
	defer fRows.Close()
	for fRows.Next() {
		var k, v string
		if err := fRows.Scan(&k, &v); err == nil {
			snap.FieldValues[k] = v
		}
	}
}

// ServiceIsRegistryFrozen reports whether the given service has a frozen registry snapshot
// (registry_snapshot_at IS NOT NULL), matching AD-16 / AD-35 freeze criteria.
func ServiceIsRegistryFrozen(db *sql.DB, serviceID int) bool {
	if db == nil || serviceID <= 0 {
		return false
	}
	var snapAt sql.NullString
	err := db.QueryRow(`SELECT registry_snapshot_at FROM services WHERE id = ?`, serviceID).Scan(&snapAt)
	return err == nil && snapAt.Valid && strings.TrimSpace(snapAt.String) != ""
}

func loadAnnouncementSlidesIntoSnapshot(db *sql.DB, serviceID int, snap *Snapshot) {
	if snap.AnnouncementSlides == nil {
		snap.AnnouncementSlides = map[int][]AnnouncementSlide{}
	}
	if snap.AnnouncementSetLabels == nil {
		snap.AnnouncementSetLabels = map[int]string{}
	}

	if ServiceIsRegistryFrozen(db, serviceID) {
		// Read from frozen service_announcement_set_slides
		rows, err := db.Query(
			`SELECT slide_id, ann_set_id, ann_set_label, label, payload, position
			   FROM service_announcement_set_slides
			  WHERE service_id = ?
			  ORDER BY position ASC, slide_id ASC`,
			serviceID,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var slideID, annSetID, pos int
				var annSetLabel, label, payloadStr string
				if err := rows.Scan(&slideID, &annSetID, &annSetLabel, &label, &payloadStr, &pos); err != nil {
					continue
				}
				if strings.TrimSpace(annSetLabel) != "" {
					snap.AnnouncementSetLabels[annSetID] = strings.TrimSpace(annSetLabel)
				}
				var tmpl Template
				if err := json.Unmarshal([]byte(payloadStr), &tmpl); err != nil {
					continue
				}
				tmpl.ID = fmt.Sprintf("ann-slide-%d", slideID)
				tmpl.Label = label
				tmpl.BaseType = "general"
				snap.AnnouncementSlides[annSetID] = append(snap.AnnouncementSlides[annSetID], AnnouncementSlide{
					ID:       slideID,
					AnnSetID: annSetID,
					Label:    label,
					Position: pos,
					Template: tmpl,
				})
			}
		}

		// Also ensure any ann-set-marker on the spine has its label in AnnouncementSetLabels even if 0 slides
		for _, tmpl := range snap.ByID {
			if tmpl.BaseType == "ann-set-marker" && tmpl.AnnSetID != nil {
				if _, exists := snap.AnnouncementSetLabels[*tmpl.AnnSetID]; !exists {
					snap.AnnouncementSetLabels[*tmpl.AnnSetID] = tmpl.Label
				}
			}
		}
		return
	}

	// Unfrozen service, or live preview (serviceID == 0): read live tables
	setRows, err := db.Query(`SELECT id, COALESCE(label, '') FROM announcement_sets`)
	if err == nil {
		defer setRows.Close()
		for setRows.Next() {
			var setID int
			var sLabel string
			if err := setRows.Scan(&setID, &sLabel); err == nil {
				lbl := strings.TrimSpace(sLabel)
				if lbl != "" {
					snap.AnnouncementSetLabels[setID] = lbl
				}
			}
		}
	}

	rows, err := db.Query(
		`SELECT id, ann_set_id, label, payload, position
		   FROM announcement_set_slides
		  ORDER BY position ASC, id ASC`,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, annSetID, pos int
		var label, payloadStr string
		if err := rows.Scan(&id, &annSetID, &label, &payloadStr, &pos); err != nil {
			continue
		}
		var tmpl Template
		if err := json.Unmarshal([]byte(payloadStr), &tmpl); err != nil {
			continue
		}
		slideIDStr := fmt.Sprintf("ann-slide-%d", id)
		tmpl.ID = slideIDStr
		tmpl.Label = label
		tmpl.BaseType = "general"
		snap.AnnouncementSlides[annSetID] = append(snap.AnnouncementSlides[annSetID], AnnouncementSlide{
			ID:       id,
			AnnSetID: annSetID,
			Label:    label,
			Position: pos,
			Template: tmpl,
		})
	}
}

// resolveDefaultBook resolves the global default song book from the database,
// falling back to "SDAH" as the shipped constant (DEC-004 S3).
func resolveDefaultBook(db *sql.DB) string {
	if db != nil {
		var defaultBook string
		err := db.QueryRow(`SELECT book_code FROM song_books WHERE is_default = 1 LIMIT 1`).Scan(&defaultBook)
		if err == nil && strings.TrimSpace(defaultBook) != "" {
			return strings.ToUpper(strings.TrimSpace(defaultBook))
		}
	}
	return "SDAH"
}

func loadSongSetInputsIntoSnapshot(db *sql.DB, serviceID int, snap *Snapshot) {
	if snap.SongInputs == nil {
		snap.SongInputs = map[string]HymnItem{}
	}
	defaultBook := resolveDefaultBook(db)

	rows, err := db.Query(
		`SELECT ssi.variable_name, ssi.song_number, COALESCE(ssi.song_book_code, ''),
		        COALESCE(h.title, ''), COALESCE(ssi.lyric_override, h.lyrics, '')
		   FROM song_set_inputs ssi
		   LEFT JOIN hymns h ON h.number = ssi.song_number
		                    AND h.book_code = CASE WHEN ssi.song_book_code IS NOT NULL AND TRIM(ssi.song_book_code) != ''
		                                           THEN UPPER(TRIM(ssi.song_book_code))
		                                           ELSE ? END
		  WHERE ssi.service_id = ? AND ssi.song_number IS NOT NULL AND ssi.song_number > 0`,
		defaultBook,
		serviceID,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var vn, book, title, lyrics string
		var num int
		if err := rows.Scan(&vn, &num, &book, &title, &lyrics); err != nil {
			continue
		}
		bookCode := strings.ToUpper(strings.TrimSpace(book))
		if bookCode == "" {
			bookCode = defaultBook
		}
		if title == "" {
			title = fmt.Sprintf("%s %d", bookCode, num)
		}
		snap.SongInputs[vn] = HymnItem{
			BookCode:   bookCode,
			Number:     num,
			Title:      title,
			Lyrics:     lyrics,
			Incomplete: strings.TrimSpace(lyrics) == "",
		}
	}
}

func LoadMedia(db *sql.DB, serviceID int, imagesPayload sql.NullString) Media {
	var raw json.RawMessage
	if imagesPayload.Valid {
		raw = json.RawMessage(imagesPayload.String)
	}
	extras := parseImagesPayload(raw)

	rows, err := db.Query(
		`SELECT image_url FROM announcement_items
		  WHERE service_id IS NULL OR service_id = ?
		  ORDER BY sort_order ASC, id ASC`,
		serviceID,
	)
	if err != nil {
		return extras
	}
	defer rows.Close()
	var fromList []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			continue
		}
		if isSafeImageURL(u) && !isVideoURL(u) {
			fromList = append(fromList, u)
		}
	}
	if len(fromList) > 0 {
		extras.Flyers = fromList
	} else {
		var filtered []string
		for _, u := range extras.Flyers {
			if !isVideoURL(u) {
				filtered = append(filtered, u)
			}
		}
		extras.Flyers = filtered
	}
	return extras
}

func LoadTransition(db *sql.DB) string {
	var v string
	err := db.QueryRow(`SELECT value FROM settings WHERE key = 'slide_transition'`).Scan(&v)
	if err != nil {
		return "fade"
	}
	switch v {
	case "none", "cut", "fade", "dissolve", "push":
		return v
	default:
		return "fade"
	}
}
