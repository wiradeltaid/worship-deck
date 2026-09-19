package db

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigrateSyncIdentity_FullCoverage(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test-sync-identity.db")

	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer handle.Close()

	// 1. Verify sync_tombstones and sync_state exist
	var tombstoneCount int
	err = handle.QueryRow(`SELECT COUNT(*) FROM sync_tombstones`).Scan(&tombstoneCount)
	if err != nil {
		t.Fatalf("sync_tombstones table query failed: %v", err)
	}

	var stateCount int
	err = handle.QueryRow(`SELECT COUNT(*) FROM sync_state`).Scan(&stateCount)
	if err != nil {
		t.Fatalf("sync_state table query failed: %v", err)
	}

	// 2. Verify all syncable tables have global_id
	for _, table := range syncableTables {
		var hasGID bool
		rows, err := handle.Query(`PRAGMA table_info(` + table + `)`)
		if err != nil {
			t.Fatalf("pragma table_info(%s): %v", table, err)
		}
		for rows.Next() {
			var cid, notNull, pk int
			var name, colType string
			var dflt any
			if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err == nil && name == "global_id" {
				hasGID = true
				break
			}
		}
		rows.Close()
		if !hasGID {
			t.Fatalf("expected table %s to have global_id column", table)
		}
	}

	// 3. Test backfilling on rows with NULL / empty global_id
	_, err = handle.Exec(`INSERT INTO services (date, raw_payload) VALUES ('2026-09-19', 'Rundown test')`)
	if err != nil {
		t.Fatalf("insert service failed: %v", err)
	}
	var svcID int
	if err := handle.QueryRow(`SELECT last_insert_rowid()`).Scan(&svcID); err != nil {
		t.Fatal(err)
	}

	// Force global_id to NULL to test backfill migration
	_, _ = handle.Exec(`UPDATE services SET global_id = NULL WHERE id = ?`, svcID)

	if err := ensureGlobalEntityIdentity(handle); err != nil {
		t.Fatalf("ensureGlobalEntityIdentity backfill failed: %v", err)
	}

	gid, err := GetGlobalID(handle, "services", svcID)
	if err != nil {
		t.Fatalf("GetGlobalID failed: %v", err)
	}
	if !IsValidUUIDv7(gid) {
		t.Fatalf("expected valid UUIDv7 for service %d, got %q", svcID, gid)
	}

	// 4. Test RecordTombstone
	if err := RecordTombstone(handle, gid, "service"); err != nil {
		t.Fatalf("RecordTombstone failed: %v", err)
	}

	var storedType string
	err = handle.QueryRow(`SELECT entity_type FROM sync_tombstones WHERE global_id = ?`, gid).Scan(&storedType)
	if err != nil {
		t.Fatalf("query tombstone failed: %v", err)
	}
	if storedType != "service" {
		t.Fatalf("expected entity_type 'service', got %q", storedType)
	}

	// Test idempotency: recording same tombstone updates deleted_at without error
	if err := RecordTombstone(handle, gid, "service"); err != nil {
		t.Fatalf("idempotent RecordTombstone failed: %v", err)
	}

	// 5. Test RecordTombstoneTx
	tx, err := handle.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	txGid := NewUUIDv7()
	if err := RecordTombstoneTx(tx, txGid, "song_set_entry"); err != nil {
		t.Fatalf("RecordTombstoneTx failed: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	var count int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM sync_tombstones WHERE global_id = ?`, txGid).Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected 1 tombstone for txGid, got %d (err: %v)", count, err)
	}
}

func TestMigrateSyncIdentity_LegacySchemaEvolution(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "legacy-sync-identity.db")

	// Open raw SQLite without running modern schema.sql
	handle, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("sql.Open failed: %v", err)
	}
	defer handle.Close()

	// Create pre-SPEC-47 legacy tables without global_id column
	_, err = handle.Exec(`
		CREATE TABLE services (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			date TEXT NOT NULL,
			raw_payload TEXT NOT NULL
		);
		CREATE TABLE hymns (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			book_code TEXT NOT NULL DEFAULT 'SDAH',
			number INTEGER NOT NULL,
			title TEXT NOT NULL,
			lyrics TEXT NOT NULL
		);
		CREATE TABLE announcement_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			image_url TEXT NOT NULL
		);
		CREATE TABLE song_set_entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			variable_name TEXT UNIQUE NOT NULL,
			title TEXT NOT NULL,
			position INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE background_library_images (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			url TEXT
		);
	`)
	if err != nil {
		t.Fatalf("create legacy tables failed: %v", err)
	}

	// Insert legacy rows
	_, err = handle.Exec(`
		INSERT INTO services (date, raw_payload) VALUES ('2026-08-01', 'Legacy service 1');
		INSERT INTO services (date, raw_payload) VALUES ('2026-08-08', 'Legacy service 2');
		INSERT INTO hymns (number, title, lyrics) VALUES (101, 'Hymn 101', 'Words 101');
		INSERT INTO announcement_items (image_url) VALUES ('https://example.com/flyer.jpg');
		INSERT INTO song_set_entries (variable_name, title, position, updated_at) VALUES ('opening_song', 'Opening', 1, '2026-08-01T00:00:00Z');
		INSERT INTO background_library_images (url) VALUES ('https://example.com/bg.jpg');
	`)
	if err != nil {
		t.Fatalf("insert legacy rows failed: %v", err)
	}

	// Execute ensureGlobalEntityIdentity migration
	if err := ensureGlobalEntityIdentity(handle); err != nil {
		t.Fatalf("ensureGlobalEntityIdentity failed on legacy database: %v", err)
	}

	// Verify all 5 syncable tables have global_id column and all rows have valid UUIDv7
	for _, table := range syncableTables {
		var hasCol bool
		cols, err := handle.Query(`PRAGMA table_info(` + table + `)`)
		if err != nil {
			t.Fatalf("table_info %s: %v", table, err)
		}
		for cols.Next() {
			var cid, notNull, pk int
			var name, cType string
			var dflt any
			if err := cols.Scan(&cid, &name, &cType, &notNull, &dflt, &pk); err == nil && name == "global_id" {
				hasCol = true
				break
			}
		}
		cols.Close()
		if !hasCol {
			t.Fatalf("table %s missing global_id after migration", table)
		}

		rows, err := handle.Query(`SELECT id, global_id FROM ` + table)
		if err != nil {
			t.Fatalf("query %s: %v", table, err)
		}
		var rowCount int
		for rows.Next() {
			var id int
			var gid string
			if err := rows.Scan(&id, &gid); err != nil {
				t.Fatalf("scan %s: %v", table, err)
			}
			if !IsValidUUIDv7(gid) {
				t.Fatalf("invalid UUIDv7 %q backfilled for %s row %d", gid, table, id)
			}
			rowCount++
		}
		rows.Close()
		if rowCount == 0 {
			t.Fatalf("expected rows in %s to be backfilled, got 0", table)
		}
	}

	// Verify unique constraint: inserting duplicate global_id fails on ALL 5 syncable tables
	collisionInserts := map[string]string{
		"services":                  `INSERT INTO services (global_id, date, raw_payload) VALUES (?, '2026-08-15', 'Collision')`,
		"hymns":                     `INSERT INTO hymns (global_id, number, title, lyrics) VALUES (?, 999, 'Dup', 'Dup')`,
		"announcement_items":        `INSERT INTO announcement_items (global_id, image_url) VALUES (?, 'https://dup.com')`,
		"song_set_entries":          `INSERT INTO song_set_entries (global_id, variable_name, title, updated_at) VALUES (?, 'dup_var', 'Dup', '2026-08-01T00:00:00Z')`,
		"background_library_images": `INSERT INTO background_library_images (global_id, url) VALUES (?, 'https://dup-bg.com')`,
	}

	for _, table := range syncableTables {
		var existingGid string
		if err := handle.QueryRow(fmt.Sprintf(`SELECT global_id FROM %s LIMIT 1`, table)).Scan(&existingGid); err != nil {
			t.Fatalf("reading existing global_id for %s: %v", table, err)
		}
		query := collisionInserts[table]
		_, err = handle.Exec(query, existingGid)
		if err == nil {
			t.Fatalf("expected UNIQUE constraint violation when inserting duplicate global_id into %s", table)
		}
	}
}

func TestGetGlobalIDTx_ErrorPropagation(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "err-propagation.db")

	handle, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()

	// Insert row with NULL global_id
	_, err = handle.Exec(`INSERT INTO services (date, raw_payload, global_id) VALUES ('2026-09-19', 'Rundown', NULL)`)
	if err != nil {
		t.Fatal(err)
	}
	var id int
	_ = handle.QueryRow(`SELECT last_insert_rowid()`).Scan(&id)

	// Install trigger failing UPDATE of global_id
	_, err = handle.Exec(`
		CREATE TRIGGER fail_gid_update
		BEFORE UPDATE OF global_id ON services
		BEGIN
			SELECT RAISE(FAIL, 'simulated update failure');
		END;
	`)
	if err != nil {
		t.Fatal(err)
	}

	// 1. Test GetGlobalIDTx returns the UPDATE failure
	tx, err := handle.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	_, err = GetGlobalIDTx(tx, "services", id)
	if err == nil || !strings.Contains(err.Error(), "simulated update failure") {
		t.Fatalf("expected simulated update failure from GetGlobalIDTx, got: %v", err)
	}
	_ = tx.Rollback()

	// 2. Test non-transactional GetGlobalID also returns the UPDATE failure
	_, err = GetGlobalID(handle, "services", id)
	if err == nil || !strings.Contains(err.Error(), "simulated update failure") {
		t.Fatalf("expected simulated update failure from GetGlobalID, got: %v", err)
	}

	// 3. Drop trigger and verify success
	_, _ = handle.Exec(`DROP TRIGGER fail_gid_update`)
	gid, err := GetGlobalID(handle, "services", id)
	if err != nil || !IsValidUUIDv7(gid) {
		t.Fatalf("expected successful GetGlobalID after dropping trigger, got %q (err: %v)", gid, err)
	}
}
