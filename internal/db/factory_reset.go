package db

import (
	"database/sql"
	"fmt"
	"strings"
)

// ResetToFactory wipes dynamic worship services, snapshots, custom templates,
// sync state, and corpora, then re-seeds canonical factory defaults per DEC-078.
// Preserves user accounts and system settings.
func ResetToFactory(handle *sql.DB, root string) error {
	tables := []string{
		"service_field_values",
		"service_form_layout_snapshots",
		"service_registry_snapshots",
		"service_song_set_layouts",
		"service_announcement_set_slides",
		"services",
		"announcement_items",
		"announcement_set_slides",
		"announcement_sets",
		"sync_tombstones",
		"sync_state",
		"background_library_images",
		"artifact_templates",
		"song_set_layouts",
		"hymns",
		"song_books",
		"bible_verses",
		"bible_translations",
	}

	for _, tbl := range tables {
		if _, err := handle.Exec(`DELETE FROM ` + tbl); err != nil {
			if !strings.Contains(err.Error(), "no such table") {
				return fmt.Errorf("clearing %s: %w", tbl, err)
			}
		}
	}

	// Clear bootstrap markers from settings so seedHub restores canonical templates & seeds
	if _, err := handle.Exec(`DELETE FROM settings WHERE key = ?`, artifactRegistryBootstrapKey); err != nil {
		return fmt.Errorf("clearing artifact registry bootstrap marker: %w", err)
	}
	if _, err := handle.Exec(`DELETE FROM settings WHERE key LIKE 'song_book_bootstrapped_%'`); err != nil {
		return fmt.Errorf("clearing song book bootstrap markers: %w", err)
	}

	return seedHub(handle, root)
}
