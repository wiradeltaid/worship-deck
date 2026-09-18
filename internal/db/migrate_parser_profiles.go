package db

import (
	"database/sql"
)

const (
	BuiltinDefaultParserProfileID    = "builtin-default"
	BuiltinDefaultParserProfileSlug  = "builtin-default"
	BuiltinDefaultParserProfileTitle = "Standard Adventist Bulletin (Builtin Default)"
	BuiltinDefaultParserProfileDesc  = "Standard parsing rules for Adventist bulletin rundowns with Bible Talk and Divine Service sections, SDAH numbering, and role keywords."

	BuiltinDefaultRulesJSON = `{
  "schema_version": 1,
  "preprocess": {
    "strip_prefixes": ["^》\\s*", "^\\[\\s*\\]\\s*"],
    "timing_patterns": [
      "(?i)\\(\\s*\\d{1,2}[.:]\\d{2}\\s*[-–]\\s*\\d{1,2}[.:]\\d{2}\\s*/?\\s*\\d*\\s*min?\\s*\\)",
      "(?i)\\(\\s*\\d+\\s*min(?:ute)?s?\\s*\\)",
      "(?i)\\(\\s*\\d+\\s*m\\s*\\)"
    ]
  },
  "date_pattern": "(?i)(?:20\\d{2}-\\d{2}-\\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2},?\\s+20\\d{2}",
  "section_delimiter_pattern": "(?i)^(BIBLE\\s+TALK|DIVINE\\s+SERVICE|BREAK)\\b",
  "hymn_patterns": [
    {
      "pattern": "(?i)(?:(?<book>SDAH|Hymn|#))\\s*#?\\s*(?<number>\\d+)",
      "flags": ["i"]
    }
  ],
  "book_aliases": {
    "SDAH": "SDAH",
    "HYMN": "SDAH",
    "#": "SDAH",
    "LAGU": "NKI",
    "NKI": "NKI",
    "KJ": "KJ",
    "PKJ": "PKJ"
  },
  "default_book": "SDAH",
  "field_rules": {
    "sermon": {
      "pattern": "(?i)^Sermon\\s*[:\\-]\\s*(?<speaker>.+?)(?:\\s+[\"“](?<title>[^\"”]+)[\"”])?\\s*$"
    },
    "special_song": {
      "pattern": "(?i)^Special\\s+Song\\s*[:\\-]\\s*(?<value>.*)$"
    },
    "theme_verse": {
      "pattern": "(?i)^Theme(?:\\s+Verse)?\\s*[:\\-]\\s*(?<value>.*)$"
    },
    "verse_reading": {
      "pattern": "(?i)^(?:Verse\\s+Reading|Memory\\s+(?:Verse|Text)|Ayat\\s+Bacaan)\\s*[:\\-]\\s*(?<value>.*)$"
    },
    "family_youth": {
      "pattern": "(?i)^(?:Family(?:\\s*&\\s*|\\s+and\\s+|/\\s*)Youth(?:\\s+of\\s+the\\s+Week)?|Family\\s+of\\s+the\\s+Week|Youth\\s+of\\s+the\\s+Week|Keluarga(?:\\s*&\\s*|\\s+dan\\s+)Pemuda)\\s*[:\\-]\\s*(?<value>.*)$"
    }
  },
  "scripture_split_pattern": "^(?<book_chapter>.+?\\s+\\d+:[\\d,\\-–]+)(?:\\s*[—–]\\s*|\\s+[-:]\\s*|\\s+)(?<text>.+)$",
  "scripture_ref_pattern": "^(?<book_chapter>.+?\\s+\\d+:[\\d,\\-–]+)\\s*$",
  "role_patterns": {
    "bracket_role": "^\\[(?<role>[^\\]]+)\\]\\s*(?<name>.+)$",
    "colon_role": "^(?<role>.+?)\\s*[:\\-]\\s*(?<name>.+)$",
    "clock_role": "^\\d{1,2}:\\d{2}$"
  },
  "song_set_matching": {
    "label_slots": [
      { "label": "Opening Song", "target": "ds_opening_song" },
      { "label": "Lagu Buka", "target": "ds_opening_song" },
      { "label": "Closing Song", "target": "ds_closing_song" },
      { "label": "Lagu Tutup", "target": "ds_closing_song" }
    ],
    "slot_family_prefix": "praise_song"
  }
}`
)

func ensureRundownParserProfiles(handle *sql.DB) error {
	_, err := handle.Exec(`
		CREATE TABLE IF NOT EXISTS rundown_parser_profiles (
			id TEXT PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			rules_json TEXT NOT NULL,
			is_builtin INTEGER NOT NULL DEFAULT 0,
			is_default INTEGER NOT NULL DEFAULT 0,
			version INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		return err
	}

	// Traceability columns in services table
	rows, err := handle.Query(`PRAGMA table_info(services)`)
	if err != nil {
		return err
	}
	haveCols := map[string]struct{}{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		haveCols[name] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	if _, ok := haveCols["parser_profile_id"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE services ADD COLUMN parser_profile_id TEXT`); err != nil {
			return err
		}
	}
	if _, ok := haveCols["parser_profile_version"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE services ADD COLUMN parser_profile_version INTEGER`); err != nil {
			return err
		}
	}

	// Seed immutable builtin-default profile if absent
	var count int
	err = handle.QueryRow(`SELECT COUNT(*) FROM rundown_parser_profiles WHERE slug = ?`, BuiltinDefaultParserProfileSlug).Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		_, err = handle.Exec(`
			INSERT INTO rundown_parser_profiles (
				id, slug, title, description, rules_json, is_builtin, is_default, version, created_at, updated_at
			) VALUES (
				?, ?, ?, ?, ?, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			)
		`, BuiltinDefaultParserProfileID, BuiltinDefaultParserProfileSlug, BuiltinDefaultParserProfileTitle, BuiltinDefaultParserProfileDesc, BuiltinDefaultRulesJSON)
		if err != nil {
			return err
		}
	}

	return nil
}
