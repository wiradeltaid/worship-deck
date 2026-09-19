package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

var syncableTables = []string{
	"services",
	"announcement_items",
	"hymns",
	"song_set_entries",
	"background_library_images",
}

// ensureGlobalEntityIdentity backfills UUIDv7 global_id keys on all syncable entities
// and creates sync_tombstones and sync_state tables (SPEC-47-04).
func ensureGlobalEntityIdentity(handle *sql.DB) error {
	// 1. Create sync_tombstones table
	_, err := handle.Exec(`
		CREATE TABLE IF NOT EXISTS sync_tombstones (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			global_id TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			deleted_at TEXT NOT NULL,
			source_rev INTEGER NOT NULL DEFAULT 1,
			UNIQUE(global_id)
		);
		CREATE INDEX IF NOT EXISTS idx_sync_tombstones_type ON sync_tombstones(entity_type);
		CREATE INDEX IF NOT EXISTS idx_sync_tombstones_deleted ON sync_tombstones(deleted_at);

		CREATE TABLE IF NOT EXISTS sync_state (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
	`)
	if err != nil {
		return fmt.Errorf("creating sync metadata tables: %w", err)
	}

	// 2. Add global_id and backfill each syncable table
	for _, table := range syncableTables {
		if err := ensureTableGlobalID(handle, table); err != nil {
			return fmt.Errorf("ensuring global_id on table %s: %w", table, err)
		}
	}

	return nil
}

func ensureTableGlobalID(handle *sql.DB, table string) error {
	rows, err := handle.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
	if err != nil {
		return err
	}
	defer rows.Close()

	hasGlobalID := false
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dfltValue any
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "global_id" {
			hasGlobalID = true
			break
		}
	}
	rows.Close()

	if !hasGlobalID {
		_, err = handle.Exec(fmt.Sprintf(`ALTER TABLE %s ADD COLUMN global_id TEXT`, table))
		if err != nil && !strings.Contains(err.Error(), "duplicate column") {
			return fmt.Errorf("adding global_id column to %s: %w", table, err)
		}
	}

	// Backfill missing global_id with monotonic UUIDv7
	qRows, err := handle.Query(fmt.Sprintf(`SELECT id FROM %s WHERE global_id IS NULL OR global_id = ''`, table))
	if err != nil {
		return err
	}
	defer qRows.Close()

	var ids []int
	for qRows.Next() {
		var id int
		if err := qRows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	qRows.Close()

	if len(ids) > 0 {
		stmt, err := handle.Prepare(fmt.Sprintf(`UPDATE %s SET global_id = ? WHERE id = ?`, table))
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, id := range ids {
			newID := NewUUIDv7()
			if _, err := stmt.Exec(newID, id); err != nil {
				return fmt.Errorf("backfilling global_id for %s row %d: %w", table, id, err)
			}
		}
	}

	// Create unique index
	indexSQL := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_global_id ON %s(global_id)`, table, table)
	if _, err := handle.Exec(indexSQL); err != nil {
		return fmt.Errorf("creating unique index on %s(global_id): %w", table, err)
	}

	return nil
}

// RecordTombstone records a deleted entity into sync_tombstones.
func RecordTombstone(handle *sql.DB, globalID, entityType string) error {
	if globalID == "" {
		return nil
	}
	_, err := handle.Exec(`
		INSERT INTO sync_tombstones (global_id, entity_type, deleted_at, source_rev)
		VALUES (?, ?, CURRENT_TIMESTAMP, 1)
		ON CONFLICT(global_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP
	`, globalID, entityType)
	return err
}

// ExecerContext abstracts both *sql.Tx and *sql.Conn for executing SQL statements.
type ExecerContext interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// RecordTombstoneExec records a deleted entity within an active transaction or connection.
func RecordTombstoneExec(ctx context.Context, execer ExecerContext, globalID, entityType string) error {
	if globalID == "" {
		return nil
	}
	_, err := execer.ExecContext(ctx, `
		INSERT INTO sync_tombstones (global_id, entity_type, deleted_at, source_rev)
		VALUES (?, ?, CURRENT_TIMESTAMP, 1)
		ON CONFLICT(global_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP
	`, globalID, entityType)
	return err
}

// RecordTombstoneTx records a deleted entity within an active transaction.
func RecordTombstoneTx(tx *sql.Tx, globalID, entityType string) error {
	return RecordTombstoneExec(context.Background(), tx, globalID, entityType)
}

// GetGlobalID returns the global_id for an entity row.
func GetGlobalID(handle *sql.DB, table string, id int) (string, error) {
	var gid sql.NullString
	err := handle.QueryRow(fmt.Sprintf(`SELECT global_id FROM %s WHERE id = ?`, table), id).Scan(&gid)
	if err != nil {
		return "", err
	}
	if !gid.Valid || gid.String == "" {
		newGid := NewUUIDv7()
		if _, err := handle.Exec(fmt.Sprintf(`UPDATE %s SET global_id = ? WHERE id = ?`, table), newGid, id); err != nil {
			return "", fmt.Errorf("persisting generated global_id on %s: %w", table, err)
		}
		return newGid, nil
	}
	return gid.String, nil
}

// GetGlobalIDTx returns the global_id for an entity row inside a transaction.
func GetGlobalIDTx(tx *sql.Tx, table string, id int) (string, error) {
	var gid sql.NullString
	err := tx.QueryRow(fmt.Sprintf(`SELECT global_id FROM %s WHERE id = ?`, table), id).Scan(&gid)
	if err != nil {
		return "", err
	}
	if !gid.Valid || gid.String == "" {
		newGid := NewUUIDv7()
		if _, err := tx.Exec(fmt.Sprintf(`UPDATE %s SET global_id = ? WHERE id = ?`, table), newGid, id); err != nil {
			return "", fmt.Errorf("persisting generated global_id on %s: %w", table, err)
		}
		return newGid, nil
	}
	return gid.String, nil
}
