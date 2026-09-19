CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  parsed_data TEXT,
  images_payload TEXT,
  participants_payload TEXT,
  afternoon_program TEXT DEFAULT '',
  parser_profile_id TEXT,
  parser_profile_version INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  registry_snapshot_at TEXT
);

CREATE TABLE IF NOT EXISTS hymns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_code TEXT NOT NULL DEFAULT 'SDAH',
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  UNIQUE(book_code, number)
);

CREATE TABLE IF NOT EXISTS announcement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  service_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator')),
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_scope_key_time
  ON login_attempts (scope, key, attempted_at);

CREATE TABLE IF NOT EXISTS revoked_sessions (
  sid TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires_at
  ON revoked_sessions (expires_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bible_translations (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  locale TEXT NOT NULL,
  licence TEXT NOT NULL,
  provenance TEXT NOT NULL,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS bible_books (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bible_book_names (
  translation_code TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  PRIMARY KEY (translation_code, book_id),
  FOREIGN KEY (book_id) REFERENCES bible_books(id)
);

CREATE TABLE IF NOT EXISTS bible_verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  verse_text TEXT NOT NULL,
  translation_code TEXT NOT NULL DEFAULT 'KJV',
  UNIQUE(book_id, chapter, verse, translation_code),
  FOREIGN KEY (book_id) REFERENCES bible_books(id)
);

CREATE TABLE IF NOT EXISTS artifact_templates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  base_type TEXT NOT NULL,
  payload TEXT,
  updated_at TEXT NOT NULL,
  seed_hash TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  variable_name TEXT,
  ann_set_id INTEGER
);

-- DEC-004 / AD-31: Admin-configurable list of song-set entries (Master Data).
CREATE TABLE IF NOT EXISTS song_set_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variable_name TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- DEC-004 / AD-31: Shared canvas trio for song-set entries.
CREATE TABLE IF NOT EXISTS song_set_layouts (
  role TEXT PRIMARY KEY,
  payload TEXT,
  updated_at TEXT,
  seed_hash TEXT
);

-- DEC-004 / AD-33: per-Service frozen copy of the live song_set_layouts trio.
CREATE TABLE IF NOT EXISTS service_song_set_layouts (
  service_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  payload TEXT,
  updated_at TEXT,
  PRIMARY KEY (service_id, role),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcement_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS announcement_set_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ann_set_id INTEGER NOT NULL,
  label TEXT,
  payload TEXT,
  updated_at TEXT,
  seed_hash TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS background_library_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT,
  name TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  category TEXT NOT NULL DEFAULT 'background'
);

CREATE TABLE IF NOT EXISTS song_books (
  book_code TEXT PRIMARY KEY,
  name TEXT,
  locale TEXT,
  licence TEXT,
  provenance TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS service_registry_snapshots (
  service_id INTEGER NOT NULL,
  template_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  base_type TEXT NOT NULL,
  payload TEXT,
  updated_at TEXT NOT NULL,
  variable_name TEXT,
  ann_set_id INTEGER,
  PRIMARY KEY (service_id, template_id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- DEC-004 / FR-32 / FR-34: per-Service weekly Song Set input and lyric
-- override, one row per Song Set entry. variable_name softly references the
-- Registry's song-set-entry identity — no FK, the entry list is Registry-owned
-- data; writes are upserts, never insert-only.
CREATE TABLE IF NOT EXISTS song_set_inputs (
  service_id INTEGER NOT NULL,
  variable_name TEXT NOT NULL,
  song_number INTEGER,
  song_book_code TEXT,
  background_id TEXT,
  lyric_override TEXT,
  updated_at TEXT,
  PRIMARY KEY (service_id, variable_name),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- SPEC-32-02 / SPEC-36-02: Durable imported font faces with variant identity
CREATE TABLE IF NOT EXISTS font_faces (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  source_typeface TEXT NOT NULL,
  weight TEXT NOT NULL,
  style TEXT NOT NULL,
  format TEXT NOT NULL,
  asset_path TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  is_restricted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SPEC-44: Configurable rundown parser profiles
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

-- SPEC-46: Configurable Form Layout and Predefined Fields
CREATE TABLE IF NOT EXISTS form_layouts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_groupings (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES form_layouts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(layout_id, sort_order)
);

CREATE TABLE IF NOT EXISTS form_group_slots (
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
);

CREATE TABLE IF NOT EXISTS predefined_fields (
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
);

CREATE TABLE IF NOT EXISTS service_field_values (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  value_text TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (service_id, variable_name)
);

CREATE TABLE IF NOT EXISTS service_form_layout_snapshots (
  service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  layout_version INTEGER NOT NULL DEFAULT 1,
  snapshot_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);



