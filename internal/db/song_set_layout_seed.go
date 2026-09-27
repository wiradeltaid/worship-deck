package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

// Song-set layout trio seeding (DEC-004 / AD-31). The shipped seed file holds
// the three roles derived from the shipped song-set template with the same
// placeholder rename mapping migration 3->4 applies, so a fresh database and
// a migrated one start from identical content.
//
// EnsureSongSetLayoutSeeds:
//   - inserts all three rows (with seed_hash recorded) when the table is empty,
//   - backfills seed_hash on rows migration 3->4 created with NULL, but only
//     when the stored payload still byte-matches the shipped seed — an edited
//     layout keeps seed_hash NULL so reset keeps refusing per LC-11.
func EnsureSongSetLayoutSeeds(db *sql.DB, root string) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM song_set_layouts`).Scan(&count); err != nil {
		return err
	}

	seeds, err := LoadSongSetLayoutSeeds(root)
	if err != nil {
		if count == 0 {
			return fmt.Errorf("fresh database requires song-set layout seeds: %w", err)
		}
		log.Printf("[registry] song-set layout seeds unavailable; skipping: %v", err)
		return nil
	}

	now := nowUTCString()
	if count == 0 {
		for _, role := range []string{"title", "verse", "reff"} {
			payload := seeds[role]
			if _, err := db.Exec(
				`INSERT OR REPLACE INTO song_set_layouts (role, payload, updated_at, seed_hash)
				 VALUES (?, ?, ?, ?)`,
				role, string(payload), now, songSetSeedHash(payload),
			); err != nil {
				return err
			}
		}
		log.Printf("[registry] seeded song_set_layouts trio from shipped defaults")
		return nil
	}

	// Self-repair: inspect presence of each canonical role ('title', 'verse', 'reff').
	// If any role is missing in a partially populated table, insert it from seeds with seed_hash.
	for _, role := range []string{"title", "verse", "reff"} {
		var roleCount int
		if err := db.QueryRow(`SELECT COUNT(*) FROM song_set_layouts WHERE role = ?`, role).Scan(&roleCount); err != nil {
			return err
		}
		if roleCount == 0 {
			payload := seeds[role]
			if _, err := db.Exec(
				`INSERT OR REPLACE INTO song_set_layouts (role, payload, updated_at, seed_hash)
				 VALUES (?, ?, ?, ?)`,
				role, string(payload), now, songSetSeedHash(payload),
			); err != nil {
				return err
			}
			log.Printf("[registry] self-repaired missing song_set_layout role %s from shipped defaults", role)
		}
	}

	for role, payload := range seeds {
		res, err := db.Exec(
			`UPDATE song_set_layouts SET seed_hash = ?
			  WHERE role = ? AND seed_hash IS NULL AND payload = ?`,
			songSetSeedHash(payload), role, string(payload),
		)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			log.Printf("[registry] recorded seed hash for song set layout %s", role)
		}
	}
	return nil
}

// LoadSongSetLayoutSeeds returns the canonical compact JSON payload for each
// trio role. Mirrors loadSeedTemplate's local/shipped resolution.
func LoadSongSetLayoutSeeds(root string) (map[string][]byte, error) {
	if root == "" {
		if wd, err := os.Getwd(); err == nil {
			root = wd
		}
	}
	path := filepath.Join(root, "data", "default-song-set-layouts.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		alt := filepath.Join(root, "..", "..", "data", "default-song-set-layouts.json")
		if stat, aErr := os.Stat(alt); aErr == nil && !stat.IsDir() {
			path = alt
		}
	}
	if os.Getenv("WPW_USE_SHIPPED_REGISTRY") != "1" {
		local := filepath.Join(root, "data", "local", "default-song-set-layouts.json")
		if _, err := os.Stat(local); err == nil {
			path = local
		}
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var parsed map[string]json.RawMessage
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("song-set layout seeds: invalid JSON: %w", err)
	}
	out := map[string][]byte{}
	for _, role := range []string{"title", "verse", "reff"} {
		obj, ok := parsed[role]
		if !ok {
			return nil, fmt.Errorf("song-set layout seeds: missing role %s", role)
		}
		var v any
		if err := json.Unmarshal(obj, &v); err != nil {
			return nil, fmt.Errorf("song-set layout seeds: role %s: %w", role, err)
		}
		canonical, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		out[role] = canonical
	}
	return out, nil
}

func songSetSeedHash(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}
