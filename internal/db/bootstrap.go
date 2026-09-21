// Package db provides database access, migrations, and bootstrap.
// Mirrored on the TypeScript side by `src/lib/db/index.ts` (bootstrap).
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
	"strings"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/auth"
	"github.com/wiradeltaid/worship-deck/internal/plan"
)

const (
	artifactRegistryBootstrapKey = "artifact_registry_bootstrapped"
	dataVersionKey               = "data_version"
	bootstrapDataVersion         = "3"
	currentDataVersionInt        = 11
	currentDataVersion           = "11"
	// AD-26: the corpus code is the cross-boundary key. The shipped corpus is
	// SDAH; a per-book settings marker (song_book_bootstrapped_<code>) gates
	// its one-time bootstrap (DEC-005 / AD-36).
	DefaultSongBook              = "SDAH"
)

// ResolveSongBook resolves a hymn's book code following the DEC-004 S3 three-step fallback:
//  1. The explicit/weekly book code if non-empty (e.g. from song_set_inputs.song_book_code)
//  2. The global default book marked in song_books (is_default = 1)
//  3. The shipped DefaultSongBook constant ("SDAH") as the last resort
func ResolveSongBook(db *sql.DB, explicitBook string) string {
	explicit := strings.ToUpper(strings.TrimSpace(explicitBook))
	if explicit != "" {
		return explicit
	}
	if db != nil {
		var defaultBook string
		err := db.QueryRow(`SELECT book_code FROM song_books WHERE is_default = 1 LIMIT 1`).Scan(&defaultBook)
		if err == nil && strings.TrimSpace(defaultBook) != "" {
			return strings.ToUpper(strings.TrimSpace(defaultBook))
		}
	}
	return DefaultSongBook
}

// SongBookBootstrapKey is the per-book-code settings marker parallel to
// artifactRegistryBootstrapKey (AD-17), extended to hymns by DEC-005/AD-36.
func SongBookBootstrapKey(bookCode string) string {
	return "song_book_bootstrapped_" + strings.ToUpper(strings.TrimSpace(bookCode))
}

func songBookBootstrapKey(bookCode string) string {
	return SongBookBootstrapKey(bookCode)
}

func authBootstrap(handle *sql.DB) error {
	return auth.BootstrapAdmin(handle)
}

func seedHub(handle *sql.DB, root string) error {
	if root == "" {
		wd, err := os.Getwd()
		if err != nil {
			return err
		}
		root = wd
	}
	if err := repairPreCounter(handle); err != nil {
		return err
	}
	if err := repairPreThreeKind(handle); err != nil {
		return err
	}
	if err := bootstrapRegistry(handle, root); err != nil {
		return err
	}
	if err := migrateSongSetShape(handle); err != nil {
		return err
	}
	if err := migratePredefinedFields(handle); err != nil {
		return err
	}
	// DEC-005/AD-36: the song-book bootstrap-once migration must run before
	// upsertHymns so an existing install's books are marked bootstrapped and
	// never re-seeded; upsertHymns itself must run after the migrations for
	// the same reason. The bible reconcile (AD-25) is untouched by DEC-005.
	if err := migrateSongBookBootstrap(handle); err != nil {
		return err
	}
	if err := migrateSongBookMetadata(handle, root); err != nil {
		return err
	}
	if err := upsertHymns(handle, root); err != nil {
		return err
	}
	if err := reconcileBible(handle, root); err != nil {
		return err
	}
	// DEC-004 S2: backfill song_set_inputs from parsed_data buckets must run
	// before migrateSnapshots — migrateSnapshots stamps currentDataVersion,
	// which would skip this pass on every existing database.
	if err := migrateSongSetInputs(handle); err != nil {
		return err
	}
	// Announcement-items cascade retirement must run before migrateSnapshots —
	// migrateSnapshots stamps currentDataVersion, which would skip this pass on
	// every existing database.
	if err := migrateAnnouncementItemsCascade(handle); err != nil {
		return err
	}
	// AD-17 / AD-21: migration 10->11 seeds song_books row for existing installs
	// where the marker was already stamped, and must run before migrateSnapshots.
	if err := migrateSongBookRow(handle, root); err != nil {
		return err
	}
	if err := migrateSnapshots(handle); err != nil {
		return err
	}
	if err := ensureDataVersionCurrent(handle); err != nil {
		return err
	}
	if _, err := SeedDefaultFormLayout(handle); err != nil {
		return err
	}
	return EnsureSongSetLayoutSeeds(handle, root)
}

func repairPreCounter(db *sql.DB) error {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM settings WHERE key = ?`, dataVersionKey).Scan(&n)
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM artifact_templates`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		return nil
	}
	if _, err := db.Exec(`DELETE FROM artifact_templates`); err != nil {
		return err
	}
	log.Printf("[registry] Story 20.1: compacting %d pre-counter template row(s) into a fresh bootstrap", count)
	return nil
}

var allowedBaseTypes = map[string]struct{}{
	"general":        {},
	"song-set":       {},
	"song-set-entry": {},
	"ann-set-marker": {},
	"announcement":   {},
}

func repairPreThreeKind(db *sql.DB) error {
	rows, err := db.Query(`SELECT DISTINCT base_type FROM artifact_templates`)
	if err != nil {
		return err
	}
	retired := false
	for rows.Next() {
		var bt string
		if err := rows.Scan(&bt); err != nil {
			rows.Close()
			return err
		}
		if _, ok := allowedBaseTypes[bt]; !ok {
			retired = true
			break
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	// The pool is capped at one connection: an early break leaves this cursor
	// holding it, so it must be closed before any further query or the next
	// one deadlocks waiting for a conn that will never be released.
	rows.Close()
	if !retired {
		return nil
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM artifact_templates`).Scan(&count); err != nil {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM artifact_templates`); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM settings WHERE key = ?`, artifactRegistryBootstrapKey); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("[registry] Story 20.2: resetting %d row(s) with retired base types", count)
	return nil
}

type hymnSeed struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
	Lyrics string `json:"lyrics"`
}

// upsertHymns is a bootstrap, not a reconcile (DEC-005 / AD-36): the corpus
// file at data/song-book/<code>.json seeds a book the first time it is seen
// and never again. Gated by the per-book marker parallel to AD-17's registry
// marker; when the marker is absent it inserts only rows absent from the
// table (ON CONFLICT DO NOTHING), seeds the song_books registry row with
// corpus metadata if absent, and stamps the marker in the same transaction.
// Once a book is bootstrapped its rows and song_books entry are administrator-owned:
// no boot path may overwrite title, lyrics, or metadata, and a gap is never refilled.
// The bible family stays under AD-25's full reconcile (reconcileBible).
func upsertHymns(db *sql.DB, root string) error {
	path := filepath.Join(root, "data", "song-book", strings.ToLower(DefaultSongBook)+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var file struct {
		Book struct {
			Code        string `json:"code"`
			Name        string `json:"name"`
			Language    string `json:"language"`
			Attribution string `json:"attribution"`
			Licence     string `json:"licence"`
		} `json:"book"`
		Hymns []hymnSeed `json:"hymns"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		return fmt.Errorf("song book corpus: %w", err)
	}
	code := strings.ToUpper(strings.TrimSpace(file.Book.Code))
	if code == "" {
		code = DefaultSongBook
	}
	marker := songBookBootstrapKey(code)
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM settings WHERE key = ?`, marker).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var defaultCount int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM song_books WHERE is_default = 1`).Scan(&defaultCount); err != nil {
		return err
	}
	isDefault := 0
	if defaultCount == 0 {
		isDefault = 1
	}

	name := strings.TrimSpace(file.Book.Name)
	locale := strings.TrimSpace(file.Book.Language)
	licence := strings.TrimSpace(file.Book.Licence)
	provenance := strings.TrimSpace(file.Book.Attribution)
	now := nowUTCString()

	if _, err := tx.Exec(`
		INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(book_code) DO NOTHING`,
		code, name, locale, licence, provenance, isDefault, now,
	); err != nil {
		return err
	}

	stmt, err := tx.Prepare(`
		INSERT INTO hymns (book_code, number, title, lyrics)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(book_code, number) DO NOTHING`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, h := range file.Hymns {
		if _, err := stmt.Exec(code, h.Number, h.Title, h.Lyrics); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		marker, "1",
	); err != nil {
		return err
	}
	return tx.Commit()
}

func reconcileBible(db *sql.DB, root string) error {
	dataRoot := filepath.Join(root, "data")
	entries, err := os.ReadDir(dataRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	reserved := map[string]struct{}{"local": {}, "uploads": {}}
	type desc struct {
		code, path string
	}
	var found []desc
	for _, loc := range entries {
		if !loc.IsDir() {
			continue
		}
		if _, skip := reserved[loc.Name()]; skip {
			continue
		}
		bibleDir := filepath.Join(dataRoot, loc.Name(), "bible-translation")
		files, err := os.ReadDir(bibleDir)
		if err != nil {
			continue
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(strings.ToLower(f.Name()), ".json") {
				continue
			}
			code := strings.ToUpper(strings.TrimSuffix(f.Name(), filepath.Ext(f.Name())))
			found = append(found, desc{code: code, path: filepath.Join(bibleDir, f.Name())})
		}
	}
	for _, d := range found {
		if err := reconcileOneBible(db, d.path, d.code); err != nil {
			log.Printf("[corpus] bible translation %s at %s failed to load — table left unchanged: %v", d.code, d.path, err)
		}
	}
	return nil
}

type bibleFile struct {
	Translation struct {
		Code       string `json:"code"`
		Name       string `json:"name"`
		Locale     string `json:"locale"`
		Language   string `json:"language"`
		Licence    string `json:"licence"`
		Provenance string `json:"provenance"`
	} `json:"translation"`
	Books []struct {
		ID        int        `json:"id"`
		Name      string     `json:"name"`
		ShortName string     `json:"shortName"`
		Chapters  [][]string `json:"chapters"`
	} `json:"books"`
}

func reconcileOneBible(db *sql.DB, corpusPath, code string) error {
	raw, err := os.ReadFile(corpusPath)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(raw)
	contentHash := hex.EncodeToString(sum[:])
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err != nil {
		return err
	}
	if _, ok := probe["aliases"]; ok {
		return fmt.Errorf("bible corpus must not carry an aliases field (AD-28): %s", corpusPath)
	}
	var stored sql.NullString
	_ = db.QueryRow(`SELECT content_hash FROM bible_translations WHERE code = ?`, code).Scan(&stored)
	if stored.Valid && stored.String == contentHash {
		var n, names int
		_ = db.QueryRow(`SELECT COUNT(*) FROM bible_verses WHERE translation_code = ?`, code).Scan(&n)
		_ = db.QueryRow(`SELECT COUNT(*) FROM bible_book_names WHERE translation_code = ?`, code).Scan(&names)
		if n > 0 && names > 0 {
			return nil
		}
	}
	var file bibleFile
	if err := json.Unmarshal(raw, &file); err != nil {
		return err
	}
	metaCode := strings.ToUpper(strings.TrimSpace(file.Translation.Code))
	if metaCode == "" {
		metaCode = code
	}
	locale := strings.TrimSpace(file.Translation.Locale)
	if locale == "" {
		locale = strings.TrimSpace(file.Translation.Language)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(
		`INSERT INTO bible_translations (code, name, locale, licence, provenance, content_hash)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(code) DO UPDATE SET
		   name = excluded.name,
		   locale = excluded.locale,
		   licence = excluded.licence,
		   provenance = excluded.provenance,
		   content_hash = excluded.content_hash`,
		metaCode, file.Translation.Name, locale, file.Translation.Licence, file.Translation.Provenance, contentHash,
	); err != nil {
		return err
	}
	fileKeys := map[string]struct{}{}
	for _, book := range file.Books {
		short := book.ShortName
		if short == "" {
			short = book.Name
		}
		if _, err := tx.Exec(
			`INSERT INTO bible_books (id, name, short_name) VALUES (?, ?, ?)
			 ON CONFLICT(id) DO NOTHING`,
			book.ID, book.Name, short,
		); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT INTO bible_book_names (translation_code, book_id, name, short_name)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(translation_code, book_id) DO UPDATE SET
			   name = excluded.name, short_name = excluded.short_name`,
			metaCode, book.ID, book.Name, short,
		); err != nil {
			return err
		}
		for ci, verses := range book.Chapters {
			for vi, text := range verses {
				ch, v := ci+1, vi+1
				key := fmt.Sprintf("%d:%d:%d", book.ID, ch, v)
				fileKeys[key] = struct{}{}
				if _, err := tx.Exec(
					`INSERT INTO bible_verses (book_id, chapter, verse, verse_text, translation_code)
					 VALUES (?, ?, ?, ?, ?)
					 ON CONFLICT(book_id, chapter, verse, translation_code) DO UPDATE SET verse_text = excluded.verse_text`,
					book.ID, ch, v, text, metaCode,
				); err != nil {
					return err
				}
			}
		}
	}
	rows, err := tx.Query(
		`SELECT book_id, chapter, verse FROM bible_verses WHERE translation_code = ?`,
		metaCode,
	)
	if err != nil {
		return err
	}
	type triple struct{ b, c, v int }
	var extra []triple
	for rows.Next() {
		var t triple
		if err := rows.Scan(&t.b, &t.c, &t.v); err != nil {
			rows.Close()
			return err
		}
		key := fmt.Sprintf("%d:%d:%d", t.b, t.c, t.v)
		if _, ok := fileKeys[key]; !ok {
			extra = append(extra, t)
		}
	}
	rows.Close()
	for _, t := range extra {
		if _, err := tx.Exec(
			`DELETE FROM bible_verses WHERE translation_code = ? AND book_id = ? AND chapter = ? AND verse = ?`,
			metaCode, t.b, t.c, t.v,
		); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("[corpus] reconciled %s from %s", metaCode, corpusPath)
	return nil
}

func resolveSeedPath(root string) string {
	shipped := filepath.Join(root, "data", "default-registry.json")
	if os.Getenv("WPW_USE_SHIPPED_REGISTRY") == "1" {
		return shipped
	}
	local := filepath.Join(root, "data", "local", "default-registry.json")
	if _, err := os.Stat(local); err == nil {
		return local
	}
	return shipped
}

func bootstrapRegistry(db *sql.DB, root string) error {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM settings WHERE key = ?`, artifactRegistryBootstrapKey).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	path := resolveSeedPath(root)
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var templates []map[string]any
	if err := json.Unmarshal(raw, &templates); err != nil {
		return fmt.Errorf("registry seed: %w", err)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	inserted := 0
	for i, t := range templates {
		id, _ := t["id"].(string)
		label, _ := t["label"].(string)
		baseType, _ := t["baseType"].(string)
		if id == "" {
			continue
		}
		var exists int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM artifact_templates WHERE id = ?`, id).Scan(&exists); err != nil {
			return err
		}
		if exists > 0 {
			continue
		}
		if baseType == "song-set-entry" {
			// DEC-004: entries carry no payload of their own — the shared
			// trio in song_set_layouts is their body. variable_name is the
			// spine key (AD-31).
			variableName, _ := t["variableName"].(string)
			if variableName == "" {
				continue
			}
			if _, err := tx.Exec(
				`INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position, variable_name)
				 VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)`,
				id, label, baseType, now, i, variableName,
			); err != nil {
				return err
			}
			inserted++
			continue
		}
		payload, err := json.Marshal(t)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(payload)
		hash := hex.EncodeToString(sum[:])
		if _, err := tx.Exec(
			`INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, label, baseType, string(payload), now, hash, i,
		); err != nil {
			return err
		}
		inserted++
	}
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		artifactRegistryBootstrapKey, "1",
	); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		dataVersionKey, bootstrapDataVersion,
	); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("[registry] bootstrap: inserted %d template(s), stamped data version %s", inserted, bootstrapDataVersion)
	return nil
}

func ensureDataVersionCurrent(db *sql.DB) error {
	var ver string
	err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	if dataVersionAtLeast(ver, currentDataVersionInt) {
		return nil
	}
	_, err = db.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		dataVersionKey, currentDataVersion,
	)
	return err
}

func migrateSnapshots(db *sql.DB) error {
	var ver string
	err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	if dataVersionAtLeast(ver, currentDataVersionInt) {
		return nil
	}
	rows, err := db.Query(`SELECT id FROM services WHERE registry_snapshot_at IS NULL ORDER BY id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	trio, _ := plan.LoadSongSetLayoutTrio(db)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, id := range ids {
		if err := cloneLiveToService(tx, id, trio); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		dataVersionKey, currentDataVersion,
	); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("[registry] AD-16: cloned live registry onto %d existing service(s); data_version=%s", len(ids), currentDataVersion)
	return nil
}

func cloneLiveToService(tx *sql.Tx, serviceID int, trio *plan.SongSetLayoutTrio) error {
	if _, err := tx.Exec(`DELETE FROM service_registry_snapshots WHERE service_id = ?`, serviceID); err != nil {
		return err
	}
	rows, err := tx.Query(
		`SELECT id, label, base_type, payload, updated_at FROM artifact_templates ORDER BY position`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	pos := 0
	for rows.Next() {
		var id, label, baseType, updatedAt string
		var payloadNull sql.NullString
		if err := rows.Scan(&id, &label, &baseType, &payloadNull, &updatedAt); err != nil {
			return err
		}
		var payload string
		switch {
		case baseType == "song-set-entry" && trio != nil:
			serialized, err := plan.SongSetEntryPayloadJSON(id, label, trio)
			if err != nil {
				log.Printf("[registry] template %q: song-set-entry clone skipped: %v", id, err)
				continue
			}
			payload = serialized
		case baseType == "ann-set-marker":
			// ann-set-marker rows have NULL payload but are structural spine rows (AD-35)
			payload = ""
		case payloadNull.Valid && payloadNull.String != "":
			payload = payloadNull.String
			if !plan.AcceptLivePayload(id, payload) {
				continue
			}
		default:
			continue
		}
		if _, err := tx.Exec(
			`INSERT INTO service_registry_snapshots
			   (service_id, template_id, position, label, base_type, payload, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			serviceID, id, pos, label, baseType, payload, updatedAt,
		); err != nil {
			return err
		}
		pos++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	// AD-33: freeze the live trio alongside the snapshot rows so this
	// Service's song-set-entry payloads keep rendering against the canvases
	// they were cloned with, even after an admin edits the live trio.
	if _, err := tx.Exec(
		`DELETE FROM service_song_set_layouts WHERE service_id = ?`, serviceID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT INTO service_song_set_layouts (service_id, role, payload, updated_at)
		 SELECT ?, role, payload, updated_at FROM song_set_layouts`,
		serviceID,
	); err != nil {
		return err
	}
	_, err = tx.Exec(`UPDATE services SET registry_snapshot_at = `+StampNowSQL+` WHERE id = ?`, serviceID)
	return err
}

func CloneRegistryToNewService(db *sql.DB, serviceID int) error {
	trio, _ := plan.LoadSongSetLayoutTrio(db)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := cloneLiveToService(tx, serviceID, trio); err != nil {
		return err
	}
	return tx.Commit()
}
