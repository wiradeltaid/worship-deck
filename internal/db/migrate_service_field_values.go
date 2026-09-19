package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// LegacyFieldMap maps legacy parsed_data / images_payload keys to predefined field variable_names
var LegacyFieldMap = map[string]string{
	"verseReading.reference":   "scripture_reference",
	"verseReading.text":        "scripture_text",
	"verseReading.translation": "scripture_bible_version",
	"sermon.speaker":           "sermon_speaker_name",
	"sermon.title":             "sermon_title",
	"sermonGraphicUrl":         "sermon_poster",
	"closingPrayerPerson":      "closing_prayer_person",
	"specialSong":              "special_song",
	"familyName":               "family_name",
	"familyPhotoUrl":           "family_photo",
	"familyPrayerRequest":      "family_request",
	"youthName":                "youth_name",
	"youthPhotoUrl":            "youth_photo",
	"youthPrayerRequest":       "youth_request",
}

// BuildFormLayoutSnapshot returns an immutable JSON snapshot of a form layout
func BuildFormLayoutSnapshot(handle *sql.DB, layoutID string) (string, error) {
	if layoutID == "" {
		layoutID = "default-layout"
	}

	var layout FormLayout
	err := handle.QueryRow(`
		SELECT id, title, description, is_active, version, created_at, updated_at
		FROM form_layouts
		WHERE id = ?
	`, layoutID).Scan(&layout.ID, &layout.Title, &layout.Description, &layout.IsActive, &layout.Version, &layout.CreatedAt, &layout.UpdatedAt)
	if err != nil {
		return "", err
	}

	gRows, err := handle.Query(`
		SELECT id, layout_id, label, description, sort_order, created_at, updated_at
		FROM form_groupings
		WHERE layout_id = ?
		ORDER BY sort_order ASC
	`, layoutID)
	if err != nil {
		return "", err
	}
	defer gRows.Close()

	for gRows.Next() {
		var g FormGrouping
		if err := gRows.Scan(&g.ID, &g.LayoutID, &g.Label, &g.Description, &g.SortOrder, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return "", err
		}
		g.Slots = []FormGroupSlot{}
		layout.Groupings = append(layout.Groupings, g)
	}

	for i := range layout.Groupings {
		sRows, err := handle.Query(`
			SELECT id, layout_id, grouping_id, sort_order, widget_kind, ref_key, created_at, updated_at
			FROM form_group_slots
			WHERE grouping_id = ?
			ORDER BY sort_order ASC
		`, layout.Groupings[i].ID)
		if err != nil {
			return "", err
		}
		for sRows.Next() {
			var slot FormGroupSlot
			if err := sRows.Scan(&slot.ID, &slot.LayoutID, &slot.GroupingID, &slot.SortOrder, &slot.WidgetKind, &slot.RefKey, &slot.CreatedAt, &slot.UpdatedAt); err != nil {
				sRows.Close()
				return "", err
			}
			layout.Groupings[i].Slots = append(layout.Groupings[i].Slots, slot)
		}
		sRows.Close()
	}

	b, err := json.Marshal(layout)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func migrateServiceFieldValues(handle *sql.DB) error {
	// Ensure tables exist before running backfill
	if err := ensureFormLayoutTables(handle); err != nil {
		return err
	}

	// 1. Build default snapshot
	snapshotJSON, err := BuildFormLayoutSnapshot(handle, "default-layout")
	if err != nil {
		// Seed default layout first if missing
		if _, sErr := SeedDefaultFormLayout(handle); sErr == nil {
			snapshotJSON, _ = BuildFormLayoutSnapshot(handle, "default-layout")
		}
	}

	// Query all services
	rows, err := handle.Query(`
		SELECT id, COALESCE(parsed_data, ''), COALESCE(images_payload, ''), COALESCE(afternoon_program, '')
		FROM services
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type svcData struct {
		id               int
		parsedData       string
		imagesPayload    string
		afternoonProgram string
	}
	var servicesList []svcData
	for rows.Next() {
		var s svcData
		if err := rows.Scan(&s.id, &s.parsedData, &s.imagesPayload, &s.afternoonProgram); err != nil {
			return err
		}
		servicesList = append(servicesList, s)
	}
	rows.Close()

	tx, err := handle.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmtInsertField, err := tx.Prepare(`
		INSERT OR IGNORE INTO service_field_values (service_id, variable_name, value_text, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		return err
	}
	defer stmtInsertField.Close()

	stmtInsertSnapshot, err := tx.Prepare(`
		INSERT OR IGNORE INTO service_form_layout_snapshots (service_id, layout_version, snapshot_json, created_at)
		VALUES (?, 1, ?, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		return err
	}
	defer stmtInsertSnapshot.Close()

	for _, s := range servicesList {
		// Backfill snapshot
		if snapshotJSON != "" {
			if _, err := stmtInsertSnapshot.Exec(s.id, snapshotJSON); err != nil {
				return fmt.Errorf("backfill snapshot service %d: %w", s.id, err)
			}
		}

		fields := make(map[string]string)

		// Parse parsed_data
		if s.parsedData != "" {
			var parsed map[string]any
			if err := json.Unmarshal([]byte(s.parsedData), &parsed); err == nil {
				if vr, ok := parsed["verseReading"].(map[string]any); ok {
					if ref, ok := vr["reference"].(string); ok && strings.TrimSpace(ref) != "" {
						fields["scripture_reference"] = strings.TrimSpace(ref)
					}
					if text, ok := vr["text"].(string); ok && strings.TrimSpace(text) != "" {
						fields["scripture_text"] = strings.TrimSpace(text)
					}
					if trans, ok := vr["translation"].(string); ok && strings.TrimSpace(trans) != "" {
						fields["scripture_bible_version"] = strings.TrimSpace(trans)
					}
				}
				if sermon, ok := parsed["sermon"].(map[string]any); ok {
					if speaker, ok := sermon["speaker"].(string); ok && strings.TrimSpace(speaker) != "" {
						fields["sermon_speaker_name"] = strings.TrimSpace(speaker)
					}
					if title, ok := sermon["title"].(string); ok && strings.TrimSpace(title) != "" {
						fields["sermon_title"] = strings.TrimSpace(title)
					}
				}
				if cpp, ok := parsed["closingPrayerPerson"].(string); ok && strings.TrimSpace(cpp) != "" {
					fields["closing_prayer_person"] = strings.TrimSpace(cpp)
				}
				if ss, ok := parsed["specialSong"].(string); ok && strings.TrimSpace(ss) != "" {
					fields["special_song"] = strings.TrimSpace(ss)
				}
				if fn, ok := parsed["familyName"].(string); ok && strings.TrimSpace(fn) != "" {
					fields["family_name"] = strings.TrimSpace(fn)
				}
				if fpr, ok := parsed["familyPrayerRequest"].(string); ok && strings.TrimSpace(fpr) != "" {
					fields["family_request"] = strings.TrimSpace(fpr)
				}
				if yn, ok := parsed["youthName"].(string); ok && strings.TrimSpace(yn) != "" {
					fields["youth_name"] = strings.TrimSpace(yn)
				}
				if ypr, ok := parsed["youthPrayerRequest"].(string); ok && strings.TrimSpace(ypr) != "" {
					fields["youth_request"] = strings.TrimSpace(ypr)
				}
			}
		}

		// Parse images_payload
		if s.imagesPayload != "" {
			var images map[string]any
			if err := json.Unmarshal([]byte(s.imagesPayload), &images); err == nil {
				if sp, ok := images["sermonGraphicUrl"].(string); ok && strings.TrimSpace(sp) != "" {
					fields["sermon_poster"] = strings.TrimSpace(sp)
				}
				if fp, ok := images["familyPhotoUrl"].(string); ok && strings.TrimSpace(fp) != "" {
					fields["family_photo"] = strings.TrimSpace(fp)
				}
				if yp, ok := images["youthPhotoUrl"].(string); ok && strings.TrimSpace(yp) != "" {
					fields["youth_photo"] = strings.TrimSpace(yp)
				}
			}
		}

		if s.afternoonProgram != "" {
			fields["afternoon_program"] = strings.TrimSpace(s.afternoonProgram)
		}

		for varName, val := range fields {
			if _, err := stmtInsertField.Exec(s.id, varName, val); err != nil {
				return fmt.Errorf("backfill field %s for service %d: %w", varName, s.id, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("[registry] backfilled service_field_values and layout snapshots for %d services", len(servicesList))
	return nil
}
