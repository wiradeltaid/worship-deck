package db

import (
	"path/filepath"
	"testing"
)

func TestFormLayoutSchemaAndAdaptiveSeeder(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "form_layout.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// 1. Verify tables exist and default layout exists
	var layoutCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM form_layouts WHERE id = 'default-layout'`).Scan(&layoutCount); err != nil {
		t.Fatalf("query default layout: %v", err)
	}
	if layoutCount != 1 {
		t.Fatalf("expected 1 default layout, got %d", layoutCount)
	}

	// 2. Verify all 13 default predefined fields seeded
	var fieldCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM predefined_fields`).Scan(&fieldCount); err != nil {
		t.Fatalf("query predefined fields: %v", err)
	}
	if fieldCount != 13 {
		t.Fatalf("expected 13 predefined fields, got %d", fieldCount)
	}

	// Verify specific fields and types
	var ft string
	var initialLines, inputLength *int
	var extRegex *string
	err = handle.QueryRow(`
		SELECT field_type, initial_lines, extraction_regex
		FROM predefined_fields
		WHERE variable_name = 'scripture_text'
	`).Scan(&ft, &initialLines, &extRegex)
	if err != nil {
		t.Fatalf("query scripture_text: %v", err)
	}
	if ft != "text_area" || initialLines == nil || *initialLines != 5 || extRegex != nil {
		t.Fatalf("unexpected scripture_text config: type=%s, lines=%v, regex=%v", ft, initialLines, extRegex)
	}

	err = handle.QueryRow(`
		SELECT field_type, input_length, extraction_regex
		FROM predefined_fields
		WHERE variable_name = 'scripture_reference'
	`).Scan(&ft, &inputLength, &extRegex)
	if err != nil {
		t.Fatalf("query scripture_reference: %v", err)
	}
	if ft != "text" || inputLength == nil || *inputLength != 100 || extRegex == nil || *extRegex == "" {
		t.Fatalf("unexpected scripture_reference config: type=%s, len=%v, regex=%v", ft, inputLength, extRegex)
	}

	err = handle.QueryRow(`
		SELECT field_type, extraction_regex
		FROM predefined_fields
		WHERE variable_name = 'sermon_poster'
	`).Scan(&ft, &extRegex)
	if err != nil {
		t.Fatalf("query sermon_poster: %v", err)
	}
	if ft != "image" || extRegex != nil {
		t.Fatalf("unexpected sermon_poster config: type=%s, regex=%v", ft, extRegex)
	}

	// 3. Verify all 7 default groupings exist
	var groupCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM form_groupings WHERE layout_id = 'default-layout'`).Scan(&groupCount); err != nil {
		t.Fatalf("query groupings: %v", err)
	}
	if groupCount != 7 {
		t.Fatalf("expected 7 groupings, got %d", groupCount)
	}

	// 4. Verify all default slots exist
	var slotCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM form_group_slots WHERE layout_id = 'default-layout'`).Scan(&slotCount); err != nil {
		t.Fatalf("query slots: %v", err)
	}
	if slotCount != 21 {
		t.Fatalf("expected 21 total slots (4 song, 2 bible, 1 divine, 4 sermon, 4 ann, 3 family, 3 youth), got %d", slotCount)
	}

	// 5. Test adaptive seeder idempotence
	report, err := SeedDefaultPredefinedFields(handle)
	if err != nil {
		t.Fatalf("re-seed defaults: %v", err)
	}
	if report.Inserted != 0 || report.Skipped != 13 || report.InactiveSkipped != 0 {
		t.Fatalf("expected 0 inserted, 13 skipped, 0 inactive_skipped, got %+v", report)
	}

	// 6. Test soft-deletion / inactive_skipped behavior
	_, err = handle.Exec(`UPDATE predefined_fields SET is_active = 0 WHERE variable_name = 'special_song'`)
	if err != nil {
		t.Fatalf("soft-delete special_song: %v", err)
	}

	report, err = SeedDefaultPredefinedFields(handle)
	if err != nil {
		t.Fatalf("re-seed with inactive: %v", err)
	}
	if report.Inserted != 0 || report.Skipped != 12 || report.InactiveSkipped != 1 {
		t.Fatalf("expected 0 inserted, 12 skipped, 1 inactive_skipped, got %+v", report)
	}

	// Restore special_song
	_, err = handle.Exec(`UPDATE predefined_fields SET is_active = 1 WHERE variable_name = 'special_song'`)
	if err != nil {
		t.Fatalf("restore special_song: %v", err)
	}

	// 7. Verify Cardinality Unique Constraint on form_group_slots (UNIQUE(layout_id, widget_kind, ref_key))
	_, err = handle.Exec(`
		INSERT INTO form_group_slots (id, layout_id, grouping_id, sort_order, widget_kind, ref_key)
		VALUES ('slot-dup', 'default-layout', 'grouping-bible-talk', 99, 'song_set_entry', 'ds_opening_song')
	`)
	if err == nil {
		t.Fatalf("expected unique constraint violation for duplicate slot across groupings, got nil")
	}

	// 8. Verify Check Constraint on image extraction_regex
	_, err = handle.Exec(`
		INSERT INTO predefined_fields (id, variable_name, shown_text, field_type, extraction_regex, is_active)
		VALUES ('field-invalid-image', 'invalid_image', 'Invalid Image', 'image', 'some_regex', 1)
	`)
	if err == nil {
		t.Fatalf("expected check constraint error for image with extraction_regex, got nil")
	}

	// 9. Verify extraction_regex column on song_set_entries exists
	rows, err := handle.Query(`PRAGMA table_info(song_set_entries)`)
	if err != nil {
		t.Fatalf("pragma song_set_entries: %v", err)
	}
	defer rows.Close()
	foundExtCol := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt any
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err == nil {
			if name == "extraction_regex" {
				foundExtCol = true
				break
			}
		}
	}
	if !foundExtCol {
		t.Fatalf("expected extraction_regex column on song_set_entries")
	}
}

func TestVariableNameValidationAndReservedKeys(t *testing.T) {
	valid := []string{"valid_name", "custom_field_1", "scripture_ref", "a_b"}
	for _, v := range valid {
		if !IsValidVariableName(v) {
			t.Errorf("expected %q to be valid variable name", v)
		}
	}

	invalid := []string{"", "123num", "UpperCase", "has-hyphen", "has space", "a"}
	for _, inv := range invalid {
		if IsValidVariableName(inv) {
			t.Errorf("expected %q to be invalid variable name", inv)
		}
	}

	reserved := []string{
		"service_date",
		"serviceDate",
		"hymnNumber",
		"songTitle",
		"lyrics",
		"label",
		"background",
		"announcement_inserts",
	}
	for _, res := range reserved {
		if !IsReservedVariableName(res) {
			t.Errorf("expected %q to be recognized as reserved", res)
		}
	}
}

func TestMigrateServiceFieldValues(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "backfill.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// Insert legacy service with parsed_data and images_payload
	res, err := handle.Exec(`
		INSERT INTO services (date, raw_payload, parsed_data, images_payload, afternoon_program)
		VALUES (
			'2026-12-12',
			'raw',
			'{"verseReading":{"reference":"Hebrews 11:1","text":"Now faith is the substance of things hoped for","translation":"KJV"},"sermon":{"speaker":"Elder Test","title":"Faith"},"closingPrayerPerson":"Deacon Close","specialSong":"Special Choir","familyName":"Smith","familyPrayerRequest":"Health","youthName":"Johnson","youthPrayerRequest":"Guidance"}',
			'{"sermonGraphicUrl":"https://example.com/sermon.png","familyPhotoUrl":"https://example.com/family.png","youthPhotoUrl":"https://example.com/youth.png"}',
			'Afternoon Study'
		)
	`)
	if err != nil {
		t.Fatalf("insert legacy service: %v", err)
	}
	svcID, _ := res.LastInsertId()

	// Clear out any backfilled rows for svcID to test migration pass explicitly
	_, _ = handle.Exec(`DELETE FROM service_field_values WHERE service_id = ?`, svcID)
	_, _ = handle.Exec(`DELETE FROM service_form_layout_snapshots WHERE service_id = ?`, svcID)

	// Run migration
	if err := migrateServiceFieldValues(handle); err != nil {
		t.Fatalf("migrateServiceFieldValues: %v", err)
	}

	// Verify all 14 fields backfilled
	expected := map[string]string{
		"scripture_reference":     "Hebrews 11:1",
		"scripture_text":          "Now faith is the substance of things hoped for",
		"scripture_bible_version": "KJV",
		"sermon_speaker_name":     "Elder Test",
		"sermon_title":            "Faith",
		"closing_prayer_person":   "Deacon Close",
		"special_song":            "Special Choir",
		"family_name":             "Smith",
		"family_request":          "Health",
		"youth_name":              "Johnson",
		"youth_request":           "Guidance",
		"sermon_poster":           "https://example.com/sermon.png",
		"family_photo":            "https://example.com/family.png",
		"youth_photo":             "https://example.com/youth.png",
		"afternoon_program":       "Afternoon Study",
	}

	for k, want := range expected {
		var got string
		err := handle.QueryRow(`SELECT value_text FROM service_field_values WHERE service_id = ? AND variable_name = ?`, svcID, k).Scan(&got)
		if err != nil {
			t.Errorf("missing backfilled field %s: %v", k, err)
		} else if got != want {
			t.Errorf("field %s = %q, want %q", k, got, want)
		}
	}

	// Verify snapshot exists
	var snapCount int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM service_form_layout_snapshots WHERE service_id = ?`, svcID).Scan(&snapCount)
	if snapCount != 1 {
		t.Errorf("expected 1 snapshot for service %d, got %d", svcID, snapCount)
	}
}
