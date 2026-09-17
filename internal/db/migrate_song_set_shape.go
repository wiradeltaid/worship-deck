package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
)

// Song-set physical-shape migration (DEC-004 / AD-31/AD-33). One-time pass
// from data_version 3 -> 4 that:
//   - snapshots every live base_type='song-set' row,
//   - derives one shared trio (title/verse/reff) into song_set_layouts,
//   - converts the four known default ids into song-set-entry rows with the
//     DEC-004 S2 variable_names,
//   - deletes the generic id='song-set' row (Hub's dsMiddle loop is retired
//     separately, out of this migration's scope),
//   - leaves any admin-added custom row as a song-set-entry with a derived
//     variable_name flagged needs-review.
//
// Runs once, inside a single SQLite transaction, gated by settings.data_version.
func migrateSongSetShape(db *sql.DB) error {
	ver, err := readDataVersion(db)
	if err != nil {
		return err
	}
	if dataVersionAtLeast(ver, 4) {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.Query(
		`SELECT id, label, payload, position
		   FROM artifact_templates
		  WHERE base_type = 'song-set'
		  ORDER BY position ASC`,
	)
	if err != nil {
		return err
	}
	type snapshotRow struct {
		id       string
		label    string
		payload  string
		position int
	}
	var snapshot []snapshotRow
	for rows.Next() {
		var r snapshotRow
		if err := rows.Scan(&r.id, &r.label, &r.payload, &r.position); err != nil {
			rows.Close()
			return err
		}
		snapshot = append(snapshot, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	if len(snapshot) == 0 {
		log.Printf("[registry] migration 3->4: no live song-set rows; refusing (data_version not bumped)")
		return nil
	}

	source := snapshot[0]
	var sourceTemplate map[string]any
	if err := json.Unmarshal([]byte(source.payload), &sourceTemplate); err != nil {
		return fmt.Errorf("source song-set row %s: invalid payload: %w", source.id, err)
	}
	sourceLayouts, _ := sourceTemplate["layouts"].(map[string]any)
	sourceTitle, _ := sourceLayouts["title"].(map[string]any)
	sourceLyric, _ := sourceLayouts["lyric"].(map[string]any)
	if sourceTitle == nil || sourceLyric == nil {
		return fmt.Errorf("source song-set row %s: missing title or lyric layout", source.id)
	}

	// Divergence check on every other row in the snapshot.
	for _, other := range snapshot[1:] {
		var otherTemplate map[string]any
		if err := json.Unmarshal([]byte(other.payload), &otherTemplate); err != nil {
			log.Printf("[registry] migration 3->4: row %s payload does not parse; leaving untouched: %v", other.id, err)
			continue
		}
		otherLayouts, _ := otherTemplate["layouts"].(map[string]any)
		otherTitle, _ := otherLayouts["title"].(map[string]any)
		otherLyric, _ := otherLayouts["lyric"].(map[string]any)
		if !layoutEqual(sourceTitle, otherTitle) {
			log.Printf("[registry] migration 3->4: row %s title diverges from source; needs-review", other.id)
		}
		if !layoutEqual(sourceLyric, otherLyric) {
			log.Printf("[registry] migration 3->4: row %s lyric diverges from source; needs-review", other.id)
		}
	}

	titlePayload := renamePlaceholderKeys(sourceTitle, map[string]string{
		"hymnNumber": "song_number",
		"songTitle":  "song_title",
	})
	versePayload := renamePlaceholderKeys(sourceLyric, map[string]string{
		"label":  "verse_number",
		"lyrics": "verse_content[]",
	})
	delete(versePayload, "backgroundImage")
	// reff is seeded from verse with `lyrics` -> `reff[]` and `label` cleared
	// (a refrain carries no verse number; DEC-004 mapping leaves `label` no
	// reff-side target).
	reffPayload := renamePlaceholderKeys(sourceLyric, map[string]string{
		"label":  "",
		"lyrics": "reff[]",
	})
	delete(reffPayload, "backgroundImage")

	now := timeNowUTC()
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO song_set_layouts (role, payload, updated_at, seed_hash)
		 VALUES (?, ?, ?, NULL)`,
		"title", marshalJSON(titlePayload), now,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO song_set_layouts (role, payload, updated_at, seed_hash)
		 VALUES (?, ?, ?, NULL)`,
		"verse", marshalJSON(versePayload), now,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO song_set_layouts (role, payload, updated_at, seed_hash)
		 VALUES (?, ?, ?, NULL)`,
		"reff", marshalJSON(reffPayload), now,
	); err != nil {
		return err
	}

	defaultSeeds := map[string]string{
		"bt-opening-song": "opening_song_bt",
		"bt-closing-song": "closing_song_bt",
		"ds-opening-song": "opening_song_dw",
		"ds-closing-song": "closing_song_dw",
	}

	reserved := map[string]struct{}{}
	for _, name := range defaultSeeds {
		reserved[name] = struct{}{}
	}
	// Also reserve every variable_name already live on the spine before this
	// pass — a derived name may not collide with another entry that pre-exists.
	existingRows, err := tx.Query(
		`SELECT variable_name FROM artifact_templates
		  WHERE variable_name IS NOT NULL AND base_type = 'song-set-entry'`,
	)
	if err != nil {
		return err
	}
	for existingRows.Next() {
		var vn string
		if err := existingRows.Scan(&vn); err != nil {
			existingRows.Close()
			return err
		}
		reserved[vn] = struct{}{}
	}
	existingRows.Close()

	derivedCounts := map[string]int{}
	for _, row := range snapshot {
		switch {
		case row.id == "song-set":
			// Generic middle-song loop row; retired per DEC-004 / AD-31.
			if _, err := tx.Exec(`DELETE FROM artifact_templates WHERE id = ?`, row.id); err != nil {
				return err
			}
			log.Printf("[registry] migration 3->4: retired generic row %s (dsMiddle loop)", row.id)
		case row.id == "bt-opening-song" || row.id == "bt-closing-song" ||
			row.id == "ds-opening-song" || row.id == "ds-closing-song":
			vn := defaultSeeds[row.id]
			if _, err := tx.Exec(
				`UPDATE artifact_templates
				    SET base_type = 'song-set-entry',
				        variable_name = ?,
				        payload = NULL,
				        seed_hash = NULL,
				        updated_at = ?
				  WHERE id = ?`,
				vn, now, row.id,
			); err != nil {
				return err
			}
		default:
			// Admin-added custom row: derive variable_name from label.
			vn := deriveVariableName(row.label, row.id)
			vn = dedupeVariableName(vn, reserved, derivedCounts)
			reserved[vn] = struct{}{}
			if _, err := tx.Exec(
				`UPDATE artifact_templates
				    SET base_type = 'song-set-entry',
				        variable_name = ?,
				        payload = NULL,
				        seed_hash = NULL,
				        updated_at = ?
				  WHERE id = ?`,
				vn, now, row.id,
			); err != nil {
				return err
			}
			log.Printf("[registry] migration 3->4: row %s converted to song-set-entry with derived variable_name=%s (needs-review)", row.id, vn)
		}
	}

	// Compact positions so AD-21's 0..N-1 invariant holds after the row
	// removal (the generic song-set row at position 20 is gone).
	survivors, err := tx.Query(
		`SELECT id FROM artifact_templates ORDER BY position`,
	)
	if err != nil {
		return err
	}
	var survivorIDs []string
	for survivors.Next() {
		var id string
		if err := survivors.Scan(&id); err != nil {
			survivors.Close()
			return err
		}
		survivorIDs = append(survivorIDs, id)
	}
	if err := survivors.Err(); err != nil {
		survivors.Close()
		return err
	}
	survivors.Close()
	reposition, err := tx.Prepare(
		`UPDATE artifact_templates SET position = ? WHERE id = ?`,
	)
	if err != nil {
		return err
	}
	defer reposition.Close()
	for i, id := range survivorIDs {
		if _, err := reposition.Exec(i, id); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		dataVersionKey, "4",
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("[registry] migration 3->4: applied song-set physical-shape migration")
	return nil
}

func marshalJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

// layoutEqual is structural equality: same keys with same JSON values. Used
// for the divergence check the migration logs (but does not abort on).
func layoutEqual(a, b map[string]any) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	ab, _ := json.Marshal(a)
	bb, _ := json.Marshal(b)
	return string(ab) == string(bb)
}

// renamePlaceholderKeys returns a deep copy of `layout` with each element's
// `placeholderKey` renamed per `mapping`. Empty-string mappings strip the key
// (used for the reff `label` drop). Other element properties are untouched.
func renamePlaceholderKeys(layout map[string]any, mapping map[string]string) map[string]any {
	out := map[string]any{}
	for k, v := range layout {
		out[k] = v
	}
	rawEls, ok := layout["elements"].([]any)
	if !ok {
		return out
	}
	copied := make([]any, 0, len(rawEls))
	for _, raw := range rawEls {
		el, ok := raw.(map[string]any)
		if !ok {
			copied = append(copied, raw)
			continue
		}
		clone := map[string]any{}
		for k, v := range el {
			clone[k] = v
		}
		if pk, ok := el["placeholderKey"].(string); ok {
			if rename, has := mapping[pk]; has {
				if rename == "" {
					delete(clone, "placeholderKey")
				} else {
					clone["placeholderKey"] = rename
				}
			}
		}
		copied = append(copied, clone)
	}
	out["elements"] = copied
	return out
}

var nonAlnumRE = regexp.MustCompile(`[^a-z0-9]+`)

func deriveVariableName(label, id string) string {
	lower := strings.ToLower(strings.TrimSpace(label))
	folded := nonAlnumRE.ReplaceAllString(lower, "_")
	folded = strings.Trim(folded, "_")
	if folded == "" {
		folded = "song_set_entry_" + id
	}
	if len(folded) > 40 {
		folded = folded[:40]
		folded = strings.TrimRight(folded, "_")
	}
	return folded
}

func dedupeVariableName(base string, reserved map[string]struct{}, counts map[string]int) string {
	if _, taken := reserved[base]; !taken {
		return base
	}
	for n := 2; ; n++ {
		candidate := fmt.Sprintf("%s_%d", base, n)
		if _, taken := reserved[candidate]; !taken {
			counts[base] = n
			return candidate
		}
	}
}

func timeNowUTC() string {
	// Mirror StampNowSQL grain so the trio's updated_at matches other rows.
	// SQLite evaluates strftime at write time; pass a literal so the SQL is
	// portable.
	return nowUTCString()
}

func readDataVersion(db *sql.DB) (string, error) {
	var ver string
	err := db.QueryRow(
		`SELECT value FROM settings WHERE key = ?`,
		dataVersionKey,
	).Scan(&ver)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return ver, err
}
