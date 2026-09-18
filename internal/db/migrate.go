package db

import (
	"database/sql"
	"time"
)

// migrateColumns applies additive schema that CREATE TABLE IF NOT EXISTS cannot
// reach on an existing file (AD-9). DEC-004 widens this with the new
// song_set_layouts trio table and the variable_name/ann_set_id columns.
func migrateColumns(handle *sql.DB) error {
	if err := ensureAnnouncementUpdatedAt(handle); err != nil {
		return err
	}
	if err := ensureArtifactTemplatesNewColumns(handle); err != nil {
		return err
	}
	if err := ensureSongSetEntriesTable(handle); err != nil {
		return err
	}
	if err := ensureServiceRegistrySnapshotsColumns(handle); err != nil {
		return err
	}
	if err := ensureArtifactTemplatesPayloadNullable(handle); err != nil {
		return err
	}
	if err := ensureFontFacesColumns(handle); err != nil {
		return err
	}
	if err := ensureBackgroundLibraryColumns(handle); err != nil {
		return err
	}
	return nil
}

func ensureBackgroundLibraryColumns(handle *sql.DB) error {
	rows, err := handle.Query(`PRAGMA table_info(background_library_images)`)
	if err != nil {
		return err
	}
	have := map[string]struct{}{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		have[name] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	if len(have) == 0 {
		return nil
	}

	if _, ok := have["category"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE background_library_images ADD COLUMN category TEXT NOT NULL DEFAULT 'background'`); err != nil {
			return err
		}
	}
	return nil
}

func ensureFontFacesColumns(handle *sql.DB) error {
	rows, err := handle.Query(`PRAGMA table_info(font_faces)`)
	if err != nil {
		return err
	}
	have := map[string]struct{}{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		have[name] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	if len(have) == 0 {
		return nil
	}

	if _, ok := have["is_restricted"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE font_faces ADD COLUMN is_restricted INTEGER DEFAULT 0`); err != nil {
			return err
		}
	}

	// SPEC-36-02: Reconcile any pre-existing duplicate family/weight/style entries before creating unique index
	_, _ = handle.Exec(`
		DELETE FROM font_faces
		WHERE id NOT IN (
			SELECT MIN(id) FROM font_faces
			GROUP BY family COLLATE NOCASE, weight COLLATE NOCASE, style COLLATE NOCASE
		)
	`)

	if _, err := handle.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_font_faces_family_weight_style
		ON font_faces (family COLLATE NOCASE, weight COLLATE NOCASE, style COLLATE NOCASE)
	`); err != nil {
		return err
	}
	return nil
}

func ensureAnnouncementUpdatedAt(handle *sql.DB) error {
	rows, err := handle.Query(`PRAGMA table_info(announcement_items)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return err
		}
		if name == "updated_at" {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if _, err := handle.Exec(`ALTER TABLE announcement_items ADD COLUMN updated_at TEXT`); err != nil {
		return err
	}
	_, err = handle.Exec(
		`UPDATE announcement_items
		    SET updated_at = COALESCE(created_at, ` + StampNowSQL + `)
		  WHERE updated_at IS NULL OR updated_at = ''`,
	)
	return err
}

// ensureArtifactTemplatesNewColumns adds the DEC-004 columns to
// artifact_templates. ALTER TABLE ADD COLUMN is idempotent at the SQL level
// when guarded by PRAGMA table_info; SQLite has no IF NOT EXISTS for ADD
// COLUMN, so the guard runs first and only ADDs when missing.
func ensureArtifactTemplatesNewColumns(handle *sql.DB) error {
	rows, err := handle.Query(`PRAGMA table_info(artifact_templates)`)
	if err != nil {
		return err
	}
	have := map[string]struct{}{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		have[name] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	if _, ok := have["variable_name"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE artifact_templates ADD COLUMN variable_name TEXT`); err != nil {
			return err
		}
	}
	if _, ok := have["ann_set_id"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE artifact_templates ADD COLUMN ann_set_id INTEGER`); err != nil {
			return err
		}
	}
	return nil
}

// ensureArtifactTemplatesPayloadNullable drops the NOT NULL constraint on
// artifact_templates.payload. SQLite cannot ALTER COLUMN in place, so the
// table is rebuilt once. Song-set-entry rows (DEC-004) carry payload = NULL.
func ensureArtifactTemplatesPayloadNullable(handle *sql.DB) error {
	rows, err := handle.Query(`PRAGMA table_info(artifact_templates)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	alreadyNullable := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return err
		}
		if name == "payload" && notnull == 0 {
			alreadyNullable = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if alreadyNullable {
		return nil
	}
	_, err = handle.Exec(`
		CREATE TABLE artifact_templates_new (
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
		INSERT INTO artifact_templates_new
		  (id, label, base_type, payload, updated_at, seed_hash, position, variable_name, ann_set_id)
		  SELECT id, label, base_type, payload, updated_at, seed_hash, position, variable_name, ann_set_id
		    FROM artifact_templates;
		DROP TABLE artifact_templates;
		ALTER TABLE artifact_templates_new RENAME TO artifact_templates;
	`)
	return err
}

func ensureServiceRegistrySnapshotsColumns(handle *sql.DB) error {
	rows, err := handle.Query(`PRAGMA table_info(service_registry_snapshots)`)
	if err != nil {
		return err
	}
	have := map[string]struct{}{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		have[name] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	if len(have) == 0 {
		return nil
	}
	if _, ok := have["variable_name"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE service_registry_snapshots ADD COLUMN variable_name TEXT`); err != nil {
			return err
		}
	}
	if _, ok := have["ann_set_id"]; !ok {
		if _, err := handle.Exec(`ALTER TABLE service_registry_snapshots ADD COLUMN ann_set_id INTEGER`); err != nil {
			return err
		}
	}
	// Backfill existing snapshot rows from artifact_templates
	_, _ = handle.Exec(`
		UPDATE service_registry_snapshots
		   SET variable_name = (
		       SELECT a.variable_name
		         FROM artifact_templates a
		        WHERE a.id = service_registry_snapshots.template_id
		   )
		 WHERE variable_name IS NULL
	`)
	_, _ = handle.Exec(`
		UPDATE service_registry_snapshots
		   SET ann_set_id = (
		       SELECT a.ann_set_id
		         FROM artifact_templates a
		        WHERE a.id = service_registry_snapshots.template_id
		   )
		 WHERE ann_set_id IS NULL
	`)
	return nil
}

func ensureSongSetEntriesTable(handle *sql.DB) error {
	_, err := handle.Exec(`CREATE TABLE IF NOT EXISTS song_set_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		variable_name TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		position INTEGER NOT NULL DEFAULT 0,
		updated_at TEXT NOT NULL
	)`)
	if err != nil {
		return err
	}

	// Backfill existing rows from artifact_templates if any exist
	_, _ = handle.Exec(`INSERT OR IGNORE INTO song_set_entries (variable_name, title, position, updated_at)
		SELECT variable_name, label, position, updated_at
		FROM artifact_templates
		WHERE base_type = 'song-set-entry' AND variable_name IS NOT NULL
		ORDER BY position ASC, id ASC`)

	// Ensure standard defaults exist if table is empty
	var count int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM song_set_entries`).Scan(&count)
	if count == 0 {
		now := time.Now().UTC().Format(time.RFC3339Nano)
		defaults := []struct {
			variableName string
			title        string
			pos          int
		}{
			{"opening_song_bt", "Bible Talk Opening Song", 0},
			{"closing_song_bt", "Bible Talk Closing Song", 1},
			{"opening_song_dw", "Divine Service Opening Song", 2},
			{"closing_song_dw", "Divine Service Closing Song", 3},
		}
		for _, d := range defaults {
			_, _ = handle.Exec(
				`INSERT OR IGNORE INTO song_set_entries (variable_name, title, position, updated_at) VALUES (?, ?, ?, ?)`,
				d.variableName, d.title, d.pos, now,
			)
		}
	}
	return nil
}
