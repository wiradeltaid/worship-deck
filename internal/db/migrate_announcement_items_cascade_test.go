package db

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestAnnouncementItemsCascadeMigration(t *testing.T) {
	t.Setenv("WPW_USE_SHIPPED_REGISTRY", "1")

	// 1. A database at version 9 with CASCADE foreign key rebuilds table, keeps rows, removes CASCADE and bumps to 10
	t.Run("migration 9->10 preserves rows and removes cascade", func(t *testing.T) {
		dbPath := filepath.Join(t.TempDir(), "v9_cascade.db")
		handle, err := Open(dbPath)
		if err != nil {
			t.Fatalf("open: %v", err)
		}
		defer handle.Close()

		// Setup schema as it existed at version 9 (with ON DELETE CASCADE)
		_, err = handle.Exec(`
			DROP TABLE IF EXISTS announcement_items;
			CREATE TABLE announcement_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				image_url TEXT NOT NULL,
				service_id INTEGER,
				sort_order INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT,
				FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
			);
			INSERT INTO settings (key, value) VALUES ('data_version', '9');
		`)
		if err != nil {
			t.Fatalf("setup v9 db: %v", err)
		}

		// Insert a service and announcement_items rows
		res, err := handle.Exec(`INSERT INTO services (date, raw_payload) VALUES ('2026-08-22', 'raw')`)
		if err != nil {
			t.Fatalf("insert service: %v", err)
		}
		svcID, err := res.LastInsertId()
		if err != nil {
			t.Fatalf("service id: %v", err)
		}

		_, err = handle.Exec(`
			INSERT INTO announcement_items (id, image_url, service_id, sort_order, created_at, updated_at)
			VALUES (101, '/api/uploads/flyer1.png', ?, 1, '2026-08-20 10:00:00', '2026-08-20 10:05:00'),
			       (102, '/api/uploads/flyer2.png', ?, 2, '2026-08-20 11:00:00', '2026-08-20 11:05:00');
		`, svcID, svcID)
		if err != nil {
			t.Fatalf("insert announcement_items: %v", err)
		}

		// Run migration 9->10
		if err := migrateAnnouncementItemsCascade(handle); err != nil {
			t.Fatalf("migrateAnnouncementItemsCascade: %v", err)
		}

		// Assert data_version is 10
		var ver string
		if err := handle.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver); err != nil {
			t.Fatalf("read version: %v", err)
		}
		if ver != "10" {
			t.Fatalf("data_version = %q, want '10'", ver)
		}

		// Assert rows and column values are preserved exactly
		type annRow struct {
			id        int
			imageURL  string
			serviceID sql.NullInt64
			sortOrder int
			createdAt string
			updatedAt sql.NullString
		}
		rows, err := handle.Query(`SELECT id, image_url, service_id, sort_order, created_at, updated_at FROM announcement_items ORDER BY id`)
		if err != nil {
			t.Fatalf("query announcement_items: %v", err)
		}
		var items []annRow
		for rows.Next() {
			var r annRow
			if err := rows.Scan(&r.id, &r.imageURL, &r.serviceID, &r.sortOrder, &r.createdAt, &r.updatedAt); err != nil {
				rows.Close()
				t.Fatalf("scan: %v", err)
			}
			items = append(items, r)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			t.Fatalf("rows err: %v", err)
		}
		rows.Close()

		if len(items) != 2 {
			t.Fatalf("expected 2 items, got %d", len(items))
		}
		if items[0].id != 101 || items[0].imageURL != "/api/uploads/flyer1.png" || !items[0].serviceID.Valid || items[0].serviceID.Int64 != svcID || items[0].sortOrder != 1 || items[0].updatedAt.String != "2026-08-20 10:05:00" {
			t.Fatalf("item 0 preserved mismatch: %+v", items[0])
		}
		if items[1].id != 102 || items[1].imageURL != "/api/uploads/flyer2.png" || !items[1].serviceID.Valid || items[1].serviceID.Int64 != svcID || items[1].sortOrder != 2 || items[1].updatedAt.String != "2026-08-20 11:05:00" {
			t.Fatalf("item 1 preserved mismatch: %+v", items[1])
		}

		// Delete the Service and assert announcement_items survive
		if _, err := handle.Exec(`DELETE FROM services WHERE id = ?`, svcID); err != nil {
			t.Fatalf("delete service: %v", err)
		}

		var count int
		if err := handle.QueryRow(`SELECT COUNT(*) FROM announcement_items WHERE service_id = ?`, svcID).Scan(&count); err != nil {
			t.Fatalf("count items: %v", err)
		}
		if count != 2 {
			t.Fatalf("announcement_items was deleted when service was deleted! count=%d, want 2", count)
		}
	})

	// 2. Second run is a no-op
	t.Run("migration is idempotent", func(t *testing.T) {
		dbPath := filepath.Join(t.TempDir(), "idempotent.db")
		handle, err := Open(dbPath)
		if err != nil {
			t.Fatalf("open: %v", err)
		}
		defer handle.Close()

		// Setup schema with FK and v9
		_, err = handle.Exec(`
			DROP TABLE IF EXISTS announcement_items;
			CREATE TABLE announcement_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				image_url TEXT NOT NULL,
				service_id INTEGER,
				sort_order INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT,
				FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
			);
			INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '9');
		`)
		if err != nil {
			t.Fatalf("setup v9 schema: %v", err)
		}

		if err := migrateAnnouncementItemsCascade(handle); err != nil {
			t.Fatalf("first run: %v", err)
		}
		if err := migrateAnnouncementItemsCascade(handle); err != nil {
			t.Fatalf("second run: %v", err)
		}

		var ver string
		if err := handle.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver); err != nil {
			t.Fatalf("read version: %v", err)
		}
		if ver != "10" {
			t.Fatalf("data_version = %q, want '10'", ver)
		}
	})

	// 3. Other cascades on services(id) are unaffected (service_song_set_layouts, service_registry_snapshots, song_set_inputs)
	t.Run("other service cascades are unaffected", func(t *testing.T) {
		dbPath := filepath.Join(t.TempDir(), "cascades.db")
		handle, err := Open(dbPath)
		if err != nil {
			t.Fatalf("open: %v", err)
		}
		defer handle.Close()

		res, err := handle.Exec(`INSERT INTO services (date, raw_payload) VALUES ('2026-08-23', 'raw')`)
		if err != nil {
			t.Fatalf("insert service: %v", err)
		}
		svcID, err := res.LastInsertId()
		if err != nil {
			t.Fatalf("service id: %v", err)
		}

		// Insert rows in dependent cascade tables
		if _, err := handle.Exec(`
			INSERT INTO song_set_inputs (service_id, variable_name, song_number, song_book_code, updated_at)
			VALUES (?, 'opening_song_bt', 100, 'SDAH', '2026-08-20');
			INSERT INTO service_song_set_layouts (service_id, role, payload, updated_at)
			VALUES (?, 'title', '{}', '2026-08-20');
			INSERT INTO service_registry_snapshots (service_id, template_id, position, label, base_type, payload, updated_at)
			VALUES (?, 'verse-reading', 0, 'Verse', 'general', '{}', '2026-08-20');
		`, svcID, svcID, svcID); err != nil {
			t.Fatalf("insert cascades: %v", err)
		}

		// Delete Service
		if _, err := handle.Exec(`DELETE FROM services WHERE id = ?`, svcID); err != nil {
			t.Fatalf("delete service: %v", err)
		}

		// Assert song_set_inputs, service_song_set_layouts, service_registry_snapshots were cascaded (deleted)
		var ssiCount, ssslCount, srsCount int
		_ = handle.QueryRow(`SELECT COUNT(*) FROM song_set_inputs WHERE service_id = ?`, svcID).Scan(&ssiCount)
		_ = handle.QueryRow(`SELECT COUNT(*) FROM service_song_set_layouts WHERE service_id = ?`, svcID).Scan(&ssslCount)
		_ = handle.QueryRow(`SELECT COUNT(*) FROM service_registry_snapshots WHERE service_id = ?`, svcID).Scan(&srsCount)

		if ssiCount != 0 {
			t.Fatalf("song_set_inputs cascade failed, count = %d (want 0)", ssiCount)
		}
		if ssslCount != 0 {
			t.Fatalf("service_song_set_layouts cascade failed, count = %d (want 0)", ssslCount)
		}
		if srsCount != 0 {
			t.Fatalf("service_registry_snapshots cascade failed, count = %d (want 0)", srsCount)
		}
	})

	// 4. Boot-path test: Open + Bootstrap on v8 DB with FK removes FK, stamps 10, keeps rows
	t.Run("boot-path bootstrap removes FK and stamps 10", func(t *testing.T) {
		dbPath := filepath.Join(t.TempDir(), "boot_path_v8.db")
		// Prepare a v8 database file before Open/Bootstrap
		preHandle, err := Open(dbPath)
		if err != nil {
			t.Fatalf("pre open: %v", err)
		}
		_, err = preHandle.Exec(`
			DROP TABLE IF EXISTS announcement_items;
			CREATE TABLE announcement_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				image_url TEXT NOT NULL,
				service_id INTEGER,
				sort_order INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT,
				FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
			);
			INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '8');
		`)
		if err != nil {
			preHandle.Close()
			t.Fatalf("setup v8 schema: %v", err)
		}
		res, err := preHandle.Exec(`INSERT INTO services (date, raw_payload) VALUES ('2026-08-22', 'raw')`)
		if err != nil {
			preHandle.Close()
			t.Fatalf("insert service: %v", err)
		}
		svcID, err := res.LastInsertId()
		if err != nil {
			preHandle.Close()
			t.Fatalf("service id: %v", err)
		}
		_, err = preHandle.Exec(`
			INSERT INTO announcement_items (id, image_url, service_id, sort_order, created_at, updated_at)
			VALUES (301, '/api/uploads/boot_flyer.png', ?, 1, '2026-08-20 10:00:00', '2026-08-20 10:05:00');
		`, svcID)
		if err != nil {
			preHandle.Close()
			t.Fatalf("insert item: %v", err)
		}
		preHandle.Close()

		// Now run the real Open + Bootstrap boot path
		handle, err := Open(dbPath)
		if err != nil {
			t.Fatalf("open: %v", err)
		}
		defer handle.Close()

		if err := Bootstrap(handle, ""); err != nil {
			t.Fatalf("bootstrap: %v", err)
		}

		// Verify version reached current version
		var ver string
		if err := handle.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver); err != nil {
			t.Fatalf("read version: %v", err)
		}
		if ver != currentDataVersion {
			t.Fatalf("data_version = %q, want %s", ver, currentDataVersion)
		}

		// Verify FK is gone from announcement_items
		rows, err := handle.Query(`PRAGMA foreign_key_list(announcement_items)`)
		if err != nil {
			t.Fatalf("query foreign_key_list: %v", err)
		}
		hasFK := false
		for rows.Next() {
			var id, seq int
			var table, from, to, onUpdate, onDelete, match string
			if err := rows.Scan(&id, &seq, &table, &from, &to, &onUpdate, &onDelete, &match); err != nil {
				rows.Close()
				t.Fatalf("scan fk: %v", err)
			}
			if from == "service_id" {
				hasFK = true
			}
		}
		rows.Close()
		if hasFK {
			t.Fatalf("announcement_items still has foreign key on service_id after bootstrap!")
		}

		// Delete service and assert row survived
		if _, err := handle.Exec(`DELETE FROM services WHERE id = ?`, svcID); err != nil {
			t.Fatalf("delete service: %v", err)
		}
		var count int
		if err := handle.QueryRow(`SELECT COUNT(*) FROM announcement_items WHERE id = 301`).Scan(&count); err != nil {
			t.Fatalf("count items: %v", err)
		}
		if count != 1 {
			t.Fatalf("announcement_item 301 lost on service deletion in boot path test (count=%d)", count)
		}
	})

	// 5. Already stamped 10 repair case: DB stamped 10 with FK intact gets repaired on Bootstrap / migration run
	t.Run("repair already-stamped-10 with intact FK", func(t *testing.T) {
		dbPath := filepath.Join(t.TempDir(), "v10_broken.db")
		handle, err := Open(dbPath)
		if err != nil {
			t.Fatalf("open: %v", err)
		}
		defer handle.Close()

		// Setup schema stamped 10 but with FK intact (the production bug state)
		_, err = handle.Exec(`
			DROP TABLE IF EXISTS announcement_items;
			CREATE TABLE announcement_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				image_url TEXT NOT NULL,
				service_id INTEGER,
				sort_order INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT,
				FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
			);
			INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '10');
		`)
		if err != nil {
			t.Fatalf("setup v10 broken schema: %v", err)
		}

		res, err := handle.Exec(`INSERT INTO services (date, raw_payload) VALUES ('2026-08-22', 'raw')`)
		if err != nil {
			t.Fatalf("insert service: %v", err)
		}
		svcID, err := res.LastInsertId()
		if err != nil {
			t.Fatalf("service id: %v", err)
		}
		_, err = handle.Exec(`
			INSERT INTO announcement_items (id, image_url, service_id, sort_order, created_at, updated_at)
			VALUES (401, '/api/uploads/broken_flyer.png', ?, 1, '2026-08-20 10:00:00', '2026-08-20 10:05:00');
		`, svcID)
		if err != nil {
			t.Fatalf("insert item: %v", err)
		}

		// Run Bootstrap
		if err := Bootstrap(handle, ""); err != nil {
			t.Fatalf("bootstrap: %v", err)
		}

		// Verify FK is gone from announcement_items
		rows, err := handle.Query(`PRAGMA foreign_key_list(announcement_items)`)
		if err != nil {
			t.Fatalf("query foreign_key_list: %v", err)
		}
		hasFK := false
		for rows.Next() {
			var id, seq int
			var table, from, to, onUpdate, onDelete, match string
			if err := rows.Scan(&id, &seq, &table, &from, &to, &onUpdate, &onDelete, &match); err != nil {
				rows.Close()
				t.Fatalf("scan fk: %v", err)
			}
			if from == "service_id" {
				hasFK = true
			}
		}
		rows.Close()
		if hasFK {
			t.Fatalf("announcement_items still has foreign key on service_id on already-stamped-10 DB!")
		}

		// Delete service and assert row survived
		if _, err := handle.Exec(`DELETE FROM services WHERE id = ?`, svcID); err != nil {
			t.Fatalf("delete service: %v", err)
		}
		var count int
		if err := handle.QueryRow(`SELECT COUNT(*) FROM announcement_items WHERE id = 401`).Scan(&count); err != nil {
			t.Fatalf("count items: %v", err)
		}
		if count != 1 {
			t.Fatalf("announcement_item 401 lost on service deletion in v10 repair test (count=%d)", count)
		}
	})
}
