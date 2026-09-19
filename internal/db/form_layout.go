package db

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"
)

var (
	variableNameRegex = regexp.MustCompile(`^[a-z][a-z0-9_]{1,63}$`)
	reservedVariableNames = map[string]struct{}{
		"service_date":         {},
		"serviceDate":          {},
		"hymnNumber":           {},
		"songTitle":            {},
		"lyrics":               {},
		"label":                {},
		"background":           {},
		"announcement_inserts": {},
	}
)

func IsValidVariableName(name string) bool {
	return variableNameRegex.MatchString(name)
}

func IsReservedVariableName(name string) bool {
	_, ok := reservedVariableNames[name]
	return ok
}

type PredefinedField struct {
	ID              string  `json:"id"`
	VariableName    string  `json:"variable_name"`
	ShownText       string  `json:"shown_text"`
	FieldType       string  `json:"field_type"`
	InputLength     *int    `json:"input_length,omitempty"`
	InitialLines    *int    `json:"initial_lines,omitempty"`
	ExtractionRegex *string `json:"extraction_regex,omitempty"`
	SeedKey         *string `json:"seed_key,omitempty"`
	IsSystem        int     `json:"is_system"`
	IsActive        int     `json:"is_active"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

type FormGroupSlot struct {
	ID         string `json:"id"`
	LayoutID   string `json:"layout_id"`
	GroupingID string `json:"grouping_id"`
	SortOrder  int    `json:"sort_order"`
	WidgetKind string `json:"widget_kind"`
	RefKey     string `json:"ref_key"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

type FormGrouping struct {
	ID          string          `json:"id"`
	LayoutID    string          `json:"layout_id"`
	Label       string          `json:"label"`
	Description string          `json:"description"`
	SortOrder   int             `json:"sort_order"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
	Slots       []FormGroupSlot `json:"slots"`
}

type FormLayout struct {
	ID               string            `json:"id"`
	Title            string            `json:"title"`
	Description      string            `json:"description"`
	IsActive         int               `json:"is_active"`
	Version          int               `json:"version"`
	CreatedAt        string            `json:"created_at"`
	UpdatedAt        string            `json:"updated_at"`
	Groupings        []FormGrouping    `json:"groupings,omitempty"`
	PredefinedFields []PredefinedField `json:"predefined_fields,omitempty"`
}

type SeedReport struct {
	Inserted        int `json:"inserted"`
	Skipped         int `json:"skipped"`
	InactiveSkipped int `json:"inactive_skipped"`
}

type defaultFieldManifestItem struct {
	seedKey         string
	variableName    string
	shownText       string
	fieldType       string
	inputLength     *int
	initialLines    *int
	extractionRegex *string
}

func intPtr(i int) *int {
	return &i
}

func strPtr(s string) *string {
	return &s
}

var defaultFieldsManifest = []defaultFieldManifestItem{
	{
		seedKey:         "default.verse_reference",
		variableName:    "scripture_reference",
		shownText:       "Verse Reading Reference",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: strPtr(`(?i)^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]\s*(?<value>.*)$`),
	},
	{
		seedKey:         "default.verse_text",
		variableName:    "scripture_text",
		shownText:       "Verse Reading Text",
		fieldType:       "text_area",
		inputLength:     nil,
		initialLines:    intPtr(5),
		extractionRegex: nil,
	},
	{
		seedKey:         "default.sermon_speaker",
		variableName:    "sermon_speaker_name",
		shownText:       "Sermon Speaker",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: strPtr(`(?i)^Sermon\s*[:\-]\s*(?<value>.+?)(?:\s+[\"“](?<title>[^\"”]+)[\"”])?\s*$`),
	},
	{
		seedKey:         "default.sermon_title",
		variableName:    "sermon_title",
		shownText:       "Sermon Title",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: nil,
	},
	{
		seedKey:         "default.sermon_graphic",
		variableName:    "sermon_poster",
		shownText:       "Sermon Poster",
		fieldType:       "image",
		inputLength:     nil,
		initialLines:    nil,
		extractionRegex: nil,
	},
	{
		seedKey:         "default.closing_prayer",
		variableName:    "closing_prayer_person",
		shownText:       "Closing Prayer",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: strPtr(`(?i)^(?:Closing\s+Prayer|Doa\s+Tutup)\s*[:\-]\s*(?<value>.*)$`),
	},
	{
		seedKey:         "default.special_song",
		variableName:    "special_song",
		shownText:       "Special Song",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: strPtr(`(?i)^Special\s+Song\s*[:\-]\s*(?<value>.*)$`),
	},
	{
		seedKey:         "default.family_photo",
		variableName:    "family_photo",
		shownText:       "Family Photo",
		fieldType:       "image",
		inputLength:     nil,
		initialLines:    nil,
		extractionRegex: nil,
	},
	{
		seedKey:         "default.family_name",
		variableName:    "family_name",
		shownText:       "Family Name",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: strPtr(`(?i)^(?:Family(?:\s*&\s*|\s+and\s+|/\s*)Youth|Family\s+of\s+the\s+Week|Keluarga)\s*[:\-]\s*(?<value>.*)$`),
	},
	{
		seedKey:         "default.family_request",
		variableName:    "family_request",
		shownText:       "Family Prayer Request",
		fieldType:       "text_area",
		inputLength:     nil,
		initialLines:    intPtr(5),
		extractionRegex: nil,
	},
	{
		seedKey:         "default.youth_photo",
		variableName:    "youth_photo",
		shownText:       "Youth Photo",
		fieldType:       "image",
		inputLength:     nil,
		initialLines:    nil,
		extractionRegex: nil,
	},
	{
		seedKey:         "default.youth_name",
		variableName:    "youth_name",
		shownText:       "Youth Name",
		fieldType:       "text",
		inputLength:     intPtr(100),
		initialLines:    nil,
		extractionRegex: strPtr(`(?i)^(?:Youth(?:\s+of\s+the\s+Week)?|Pemuda)\s*[:\-]\s*(?<value>.*)$`),
	},
	{
		seedKey:         "default.youth_request",
		variableName:    "youth_request",
		shownText:       "Youth Prayer Request",
		fieldType:       "text_area",
		inputLength:     nil,
		initialLines:    intPtr(5),
		extractionRegex: nil,
	},
}

func ensureFormLayoutTables(handle *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS form_layouts (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			is_active INTEGER NOT NULL DEFAULT 1,
			version INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS form_groupings (
			id TEXT PRIMARY KEY,
			layout_id TEXT NOT NULL REFERENCES form_layouts(id) ON DELETE CASCADE,
			label TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			sort_order INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(layout_id, sort_order)
		);`,
		`CREATE TABLE IF NOT EXISTS form_group_slots (
			id TEXT PRIMARY KEY,
			layout_id TEXT NOT NULL REFERENCES form_layouts(id) ON DELETE CASCADE,
			grouping_id TEXT NOT NULL REFERENCES form_groupings(id) ON DELETE CASCADE,
			sort_order INTEGER NOT NULL,
			widget_kind TEXT NOT NULL CHECK (widget_kind IN ('predefined_field', 'song_set_entry', 'announcement_slot')),
			ref_key TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(grouping_id, sort_order),
			UNIQUE(layout_id, widget_kind, ref_key)
		);`,
		`CREATE TABLE IF NOT EXISTS predefined_fields (
			id TEXT PRIMARY KEY,
			variable_name TEXT NOT NULL UNIQUE,
			shown_text TEXT NOT NULL,
			field_type TEXT NOT NULL CHECK (field_type IN ('text', 'text_area', 'image')),
			input_length INTEGER,
			initial_lines INTEGER,
			extraction_regex TEXT,
			seed_key TEXT UNIQUE,
			is_system INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			CHECK (field_type != 'image' OR extraction_regex IS NULL)
		);`,
		`CREATE TABLE IF NOT EXISTS service_field_values (
			service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
			variable_name TEXT NOT NULL,
			value_text TEXT NOT NULL DEFAULT '',
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (service_id, variable_name)
		);`,
		`CREATE TABLE IF NOT EXISTS service_form_layout_snapshots (
			service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
			layout_version INTEGER NOT NULL DEFAULT 1,
			snapshot_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, q := range queries {
		if _, err := handle.Exec(q); err != nil {
			return fmt.Errorf("ensureFormLayoutTables: %w", err)
		}
	}

	// Add extraction_regex to song_set_entries if not present
	rows, err := handle.Query(`PRAGMA table_info(song_set_entries)`)
	if err == nil {
		defer rows.Close()
		hasCol := false
		for rows.Next() {
			var cid, notnull, pk int
			var name, ctype string
			var dflt sql.NullString
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err == nil {
				if name == "extraction_regex" {
					hasCol = true
					break
				}
			}
		}
		if !hasCol {
			_, _ = handle.Exec(`ALTER TABLE song_set_entries ADD COLUMN extraction_regex TEXT`)
		}
	}

	return nil
}

func SeedDefaultPredefinedFields(db *sql.DB) (SeedReport, error) {
	var report SeedReport

	// Ensure default layout exists
	_, err := db.Exec(`
		INSERT INTO form_layouts (id, title, description, is_active, version)
		VALUES ('default-layout', 'Default Form Layout', 'Standard layout for worship services', 1, 1)
		ON CONFLICT(id) DO NOTHING
	`)
	if err != nil {
		return report, fmt.Errorf("seed default layout: %w", err)
	}

	// Seed fields
	for _, item := range defaultFieldsManifest {
		var existingID string
		var isActive int
		err := db.QueryRow(`SELECT id, is_active FROM predefined_fields WHERE seed_key = ?`, item.seedKey).Scan(&existingID, &isActive)
		if err == nil {
			if isActive == 0 {
				report.InactiveSkipped++
			} else {
				report.Skipped++
			}
			continue
		} else if err != sql.ErrNoRows {
			return report, err
		}

		// Check if variable_name exists under another seed_key or custom field
		var varExistingID string
		err = db.QueryRow(`SELECT id FROM predefined_fields WHERE variable_name = ?`, item.variableName).Scan(&varExistingID)
		if err == nil {
			report.Skipped++
			continue
		} else if err != sql.ErrNoRows {
			return report, err
		}

		// Manifest regex is compile-checked at unit test time

		fieldID := "field-" + strings.ReplaceAll(item.variableName, "_", "-")
		_, err = db.Exec(`
			INSERT INTO predefined_fields (
				id, variable_name, shown_text, field_type, input_length, initial_lines, extraction_regex, seed_key, is_system, is_active
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
		`, fieldID, item.variableName, item.shownText, item.fieldType, item.inputLength, item.initialLines, item.extractionRegex, item.seedKey)
		if err != nil {
			return report, fmt.Errorf("insert seed field %s: %w", item.variableName, err)
		}
		report.Inserted++
	}

	// Seed groupings and slots
	type groupingSlotDef struct {
		id         string
		sortOrder  int
		widgetKind string
		refKey     string
	}
	type groupingDef struct {
		id          string
		label       string
		description string
		sortOrder   int
		slots       []groupingSlotDef
	}

	defaultGroupings := []groupingDef{
		{
			id:          "grouping-song-set",
			label:       "Song Set",
			description: "Dynamic congregation song sets and hymns",
			sortOrder:   1,
			slots: []groupingSlotDef{
				{id: "slot-song-set-1", sortOrder: 1, widgetKind: "song_set_entry", refKey: "ds_opening_song"},
				{id: "slot-song-set-2", sortOrder: 2, widgetKind: "song_set_entry", refKey: "praise_song_1"},
				{id: "slot-song-set-3", sortOrder: 3, widgetKind: "song_set_entry", refKey: "praise_song_2"},
				{id: "slot-song-set-4", sortOrder: 4, widgetKind: "song_set_entry", refKey: "ds_closing_song"},
			},
		},
		{
			id:          "grouping-bible-talk",
			label:       "Bible Talk",
			description: "Scripture reading and thematic memory verse",
			sortOrder:   2,
			slots: []groupingSlotDef{
				{id: "slot-bible-talk-1", sortOrder: 1, widgetKind: "predefined_field", refKey: "scripture_reference"},
				{id: "slot-bible-talk-2", sortOrder: 2, widgetKind: "predefined_field", refKey: "scripture_text"},
			},
		},
		{
			id:          "grouping-divine-worship",
			label:       "Divine Worship",
			description: "Liturgical music and special ministry items",
			sortOrder:   3,
			slots: []groupingSlotDef{
				{id: "slot-divine-worship-1", sortOrder: 1, widgetKind: "predefined_field", refKey: "special_song"},
			},
		},
		{
			id:          "grouping-sermon",
			label:       "Sermon",
			description: "Spoken ministry, title, speaker, and closing prayer",
			sortOrder:   4,
			slots: []groupingSlotDef{
				{id: "slot-sermon-1", sortOrder: 1, widgetKind: "predefined_field", refKey: "sermon_speaker_name"},
				{id: "slot-sermon-2", sortOrder: 2, widgetKind: "predefined_field", refKey: "sermon_title"},
				{id: "slot-sermon-3", sortOrder: 3, widgetKind: "predefined_field", refKey: "closing_prayer_person"},
				{id: "slot-sermon-4", sortOrder: 4, widgetKind: "predefined_field", refKey: "sermon_poster"},
			},
		},
		{
			id:          "grouping-announcement-posters",
			label:       "Weekly Announcement Posters",
			description: "Weekly slide announcement poster slots",
			sortOrder:   5,
			slots: []groupingSlotDef{
				{id: "slot-ann-1", sortOrder: 1, widgetKind: "announcement_slot", refKey: "1"},
				{id: "slot-ann-2", sortOrder: 2, widgetKind: "announcement_slot", refKey: "2"},
				{id: "slot-ann-3", sortOrder: 3, widgetKind: "announcement_slot", refKey: "3"},
				{id: "slot-ann-4", sortOrder: 4, widgetKind: "announcement_slot", refKey: "4"},
			},
		},
		{
			id:          "grouping-family-of-the-week",
			label:       "Family of the Week",
			description: "Weekly highlighted family photo and prayer request",
			sortOrder:   6,
			slots: []groupingSlotDef{
				{id: "slot-family-1", sortOrder: 1, widgetKind: "predefined_field", refKey: "family_photo"},
				{id: "slot-family-2", sortOrder: 2, widgetKind: "predefined_field", refKey: "family_name"},
				{id: "slot-family-3", sortOrder: 3, widgetKind: "predefined_field", refKey: "family_request"},
			},
		},
		{
			id:          "grouping-youth-of-the-week",
			label:       "Youth of the Week",
			description: "Weekly highlighted youth photo and prayer request",
			sortOrder:   7,
			slots: []groupingSlotDef{
				{id: "slot-youth-1", sortOrder: 1, widgetKind: "predefined_field", refKey: "youth_photo"},
				{id: "slot-youth-2", sortOrder: 2, widgetKind: "predefined_field", refKey: "youth_name"},
				{id: "slot-youth-3", sortOrder: 3, widgetKind: "predefined_field", refKey: "youth_request"},
			},
		},
	}

	for _, g := range defaultGroupings {
		_, err := db.Exec(`
			INSERT INTO form_groupings (id, layout_id, label, description, sort_order)
			VALUES (?, 'default-layout', ?, ?, ?)
			ON CONFLICT(id) DO NOTHING
		`, g.id, g.label, g.description, g.sortOrder)
		if err != nil {
			return report, fmt.Errorf("insert default grouping %s: %w", g.id, err)
		}

		for _, s := range g.slots {
			_, err := db.Exec(`
				INSERT INTO form_group_slots (id, layout_id, grouping_id, sort_order, widget_kind, ref_key)
				VALUES (?, 'default-layout', ?, ?, ?, ?)
				ON CONFLICT(layout_id, widget_kind, ref_key) DO NOTHING
			`, s.id, g.id, s.sortOrder, s.widgetKind, s.refKey)
			if err != nil {
				return report, fmt.Errorf("insert default slot %s: %w", s.id, err)
			}
		}
	}

	return report, nil
}

func SeedDefaultFormLayout(db *sql.DB) (SeedReport, error) {
	if err := ensureFormLayoutTables(db); err != nil {
		return SeedReport{}, err
	}
	return SeedDefaultPredefinedFields(db)
}
