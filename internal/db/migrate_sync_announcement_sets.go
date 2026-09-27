package db

import (
	"database/sql"
	"fmt"
	"strings"
)

// ensureSyncAnnouncementSetsAndEntities adds global_id and relational global ID references
// across announcement sets, slides, artifact templates, and snapshots (SPEC-91).
func ensureSyncAnnouncementSetsAndEntities(handle *sql.DB) error {
	// 1. Ensure announcement_sets has global_id
	if err := ensureColumnExists(handle, "announcement_sets", "global_id", "TEXT"); err != nil {
		return err
	}
	if err := backfillTableGlobalID(handle, "announcement_sets"); err != nil {
		return err
	}
	if _, err := handle.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_announcement_sets_global_id ON announcement_sets(global_id)`); err != nil {
		return fmt.Errorf("creating index on announcement_sets(global_id): %w", err)
	}

	// 2. Ensure announcement_set_slides has global_id and ann_set_global_id
	if err := ensureColumnExists(handle, "announcement_set_slides", "global_id", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumnExists(handle, "announcement_set_slides", "ann_set_global_id", "TEXT"); err != nil {
		return err
	}
	if err := backfillTableGlobalID(handle, "announcement_set_slides"); err != nil {
		return err
	}
	// Backfill ann_set_global_id from announcement_sets.global_id where missing
	if _, err := handle.Exec(`
		UPDATE announcement_set_slides
		SET ann_set_global_id = (
			SELECT global_id FROM announcement_sets WHERE announcement_sets.id = announcement_set_slides.ann_set_id
		)
		WHERE (ann_set_global_id IS NULL OR ann_set_global_id = '') AND ann_set_id IS NOT NULL AND ann_set_id > 0
	`); err != nil {
		return fmt.Errorf("backfilling ann_set_global_id on announcement_set_slides: %w", err)
	}
	if _, err := handle.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ann_set_slides_global_id ON announcement_set_slides(global_id)`); err != nil {
		return fmt.Errorf("creating index on announcement_set_slides(global_id): %w", err)
	}
	if _, err := handle.Exec(`CREATE INDEX IF NOT EXISTS idx_ann_set_slides_set_global ON announcement_set_slides(ann_set_global_id)`); err != nil {
		return fmt.Errorf("creating index on announcement_set_slides(ann_set_global_id): %w", err)
	}

	// 3. Ensure artifact_templates has ann_set_global_id
	if err := ensureColumnExists(handle, "artifact_templates", "ann_set_global_id", "TEXT"); err != nil {
		return err
	}
	if _, err := handle.Exec(`
		UPDATE artifact_templates
		SET ann_set_global_id = (
			SELECT global_id FROM announcement_sets WHERE announcement_sets.id = artifact_templates.ann_set_id
		)
		WHERE (ann_set_global_id IS NULL OR ann_set_global_id = '') AND ann_set_id IS NOT NULL AND ann_set_id > 0
	`); err != nil {
		return fmt.Errorf("backfilling ann_set_global_id on artifact_templates: %w", err)
	}

	// 4. Ensure service_registry_snapshots has service_global_id and ann_set_global_id
	if err := ensureColumnExists(handle, "service_registry_snapshots", "service_global_id", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumnExists(handle, "service_registry_snapshots", "ann_set_global_id", "TEXT"); err != nil {
		return err
	}
	if _, err := handle.Exec(`
		UPDATE service_registry_snapshots
		SET service_global_id = (
			SELECT global_id FROM services WHERE services.id = service_registry_snapshots.service_id
		)
		WHERE (service_global_id IS NULL OR service_global_id = '') AND service_id IS NOT NULL AND service_id > 0
	`); err != nil {
		return fmt.Errorf("backfilling service_global_id on service_registry_snapshots: %w", err)
	}
	if _, err := handle.Exec(`
		UPDATE service_registry_snapshots
		SET ann_set_global_id = (
			SELECT global_id FROM announcement_sets WHERE announcement_sets.id = service_registry_snapshots.ann_set_id
		)
		WHERE (ann_set_global_id IS NULL OR ann_set_global_id = '') AND ann_set_id IS NOT NULL AND ann_set_id > 0
	`); err != nil {
		return fmt.Errorf("backfilling ann_set_global_id on service_registry_snapshots: %w", err)
	}
	if _, err := handle.Exec(`CREATE INDEX IF NOT EXISTS idx_svc_reg_snaps_svc_global ON service_registry_snapshots(service_global_id)`); err != nil {
		return fmt.Errorf("creating index on service_registry_snapshots(service_global_id): %w", err)
	}

	// 5. Ensure service_song_set_layouts has service_global_id
	if err := ensureColumnExists(handle, "service_song_set_layouts", "service_global_id", "TEXT"); err != nil {
		return err
	}
	if _, err := handle.Exec(`
		UPDATE service_song_set_layouts
		SET service_global_id = (
			SELECT global_id FROM services WHERE services.id = service_song_set_layouts.service_id
		)
		WHERE (service_global_id IS NULL OR service_global_id = '') AND service_id IS NOT NULL AND service_id > 0
	`); err != nil {
		return fmt.Errorf("backfilling service_global_id on service_song_set_layouts: %w", err)
	}
	if _, err := handle.Exec(`CREATE INDEX IF NOT EXISTS idx_svc_layouts_svc_global ON service_song_set_layouts(service_global_id)`); err != nil {
		return fmt.Errorf("creating index on service_song_set_layouts(service_global_id): %w", err)
	}

	return nil
}

func ensureColumnExists(handle *sql.DB, table, column, colType string) error {
	rows, err := handle.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
	if err != nil {
		return err
	}
	defer rows.Close()

	hasCol := false
	for rows.Next() {
		var cid int
		var name, ctype string
		var notNull, pk int
		var dfltValue any
		if err := rows.Scan(&cid, &name, &ctype, &notNull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == column {
			hasCol = true
			break
		}
	}
	rows.Close()

	if !hasCol {
		_, err = handle.Exec(fmt.Sprintf(`ALTER TABLE %s ADD COLUMN %s %s`, table, column, colType))
		if err != nil && !strings.Contains(err.Error(), "duplicate column") {
			return fmt.Errorf("adding column %s to %s: %w", column, table, err)
		}
	}
	return nil
}

func backfillTableGlobalID(handle *sql.DB, table string) error {
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
	if err := qRows.Err(); err != nil {
		return err
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
	return nil
}
