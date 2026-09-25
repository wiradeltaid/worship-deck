package plan_test

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/wiradeltaid/worship-deck/internal/db"
	"github.com/wiradeltaid/worship-deck/internal/plan"
)

func TestBackgroundPrecedenceAndParity(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "bg_parity.db")
	handle, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := db.Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)

	// 1. Insert 3 background images
	res1, _ := handle.Exec(`INSERT INTO background_library_images (url, name, created_at, updated_at) VALUES ('/assets/song-default.png', 'Song Default', ?, ?)`, now, now)
	idSong, _ := res1.LastInsertId()

	res2, _ := handle.Exec(`INSERT INTO background_library_images (url, name, created_at, updated_at) VALUES ('/assets/general-default.png', 'General Default', ?, ?)`, now, now)
	idGeneral, _ := res2.LastInsertId()

	res3, _ := handle.Exec(`INSERT INTO background_library_images (url, name, created_at, updated_at) VALUES ('/assets/explicit-song.png', 'Explicit Song', ?, ?)`, now, now)
	idExplicit, _ := res3.LastInsertId()

	// Assign roles in background_default_assignments
	_, _ = handle.Exec(`INSERT OR REPLACE INTO background_default_assignments (role, background_image_id, updated_at) VALUES ('song_set', ?, ?), ('general', ?, ?)`, idSong, now, idGeneral, now)

	// Insert song-set-entry templates into artifact_templates
	_, err = handle.Exec(`
		INSERT OR REPLACE INTO artifact_templates (id, label, base_type, variable_name, position, payload, updated_at)
		VALUES ('bt-opening-song', 'Opening Song BT', 'song-set-entry', 'opening_song_bt', 100, NULL, ?),
		       ('bt-closing-song', 'Closing Song BT', 'song-set-entry', 'closing_song_bt', 200, NULL, ?),
		       ('welcome-test', 'Welcome Test', 'general', NULL, 300, '{"schemaVersion":1,"id":"welcome-test","label":"Welcome Test","baseType":"general","layouts":{"default":{"aspectRatio":"16:9","backgroundColor":"#000000","elements":[]}}}', ?)
	`, now, now, now)
	if err != nil {
		t.Fatalf("insert templates: %v", err)
	}

	// Create test service
	resSvc, err := handle.Exec(`INSERT INTO services (date, raw_payload, parsed_data) VALUES ('2026-09-26', 'sample', '{}')`)
	if err != nil {
		t.Fatalf("insert service: %v", err)
	}
	serviceID, _ := resSvc.LastInsertId()

	// Case A: Song with explicit background selection (idExplicit)
	_, _ = handle.Exec(`
		INSERT INTO song_set_inputs (service_id, variable_name, song_number, song_book_code, background_id, lyric_override, updated_at)
		VALUES (?, 'opening_song_bt', 159, 'SDAH', ?, 'Line 1\nLine 2', ?)
	`, serviceID, idExplicit, now)

	// Case B: Song with NO explicit background selection (NULL background_id) -> falls back to Song-Set Default
	_, _ = handle.Exec(`
		INSERT INTO song_set_inputs (service_id, variable_name, song_number, song_book_code, background_id, lyric_override, updated_at)
		VALUES (?, 'closing_song_bt', 200, 'SDAH', NULL, 'Closing 1\nClosing 2', ?)
	`, serviceID, now)

	snap, err := plan.LoadSnapshot(handle, int(serviceID))
	if err != nil {
		t.Fatalf("LoadSnapshot: %v", err)
	}

	if snap.SongSetDefaultBackground != "/assets/song-default.png" {
		t.Fatalf("expected SongSetDefaultBackground='/assets/song-default.png', got %q", snap.SongSetDefaultBackground)
	}
	if snap.GeneralDefaultBackground != "/assets/general-default.png" {
		t.Fatalf("expected GeneralDefaultBackground='/assets/general-default.png', got %q", snap.GeneralDefaultBackground)
	}

	items, err := plan.BuildSlidePlan("2026-09-26", plan.ParsedRundown{}, plan.Media{}, snap)
	if err != nil {
		t.Fatalf("BuildSlidePlan: %v", err)
	}

	var foundOpeningSongTitle, foundOpeningSongLyric bool
	var foundClosingSongTitle, foundClosingSongLyric bool
	var foundGeneralSlide bool

	for _, it := range items {
		bg := ""
		if it.Artifact.Layout.BackgroundImage != nil {
			bg = *it.Artifact.Layout.BackgroundImage
		}

		// Case A: Opening song (explicit selection)
		if strings.HasPrefix(it.Artifact.InstanceID, "bt-opening-title") {
			foundOpeningSongTitle = true
			if bg != "/assets/explicit-song.png" {
				t.Fatalf("opening song title bg=%q, want /assets/explicit-song.png", bg)
			}
		}
		if strings.HasPrefix(it.Artifact.InstanceID, "bt-opening-lyric") {
			foundOpeningSongLyric = true
			if bg != "/assets/explicit-song.png" {
				t.Fatalf("opening song lyric bg=%q, want /assets/explicit-song.png", bg)
			}
		}

		// Case B: Closing song (no selection -> fallback to song_set default)
		if strings.HasPrefix(it.Artifact.InstanceID, "bt-closing-title") {
			foundClosingSongTitle = true
			if bg != "/assets/song-default.png" {
				t.Fatalf("closing song title bg=%q, want /assets/song-default.png", bg)
			}
		}
		if strings.HasPrefix(it.Artifact.InstanceID, "bt-closing-lyric") {
			foundClosingSongLyric = true
			if bg != "/assets/song-default.png" {
				t.Fatalf("closing song lyric bg=%q, want /assets/song-default.png", bg)
			}
		}

		// Non-song slide lacking custom background receives General Default
		if it.Artifact.InstanceID == "welcome-test" {
			foundGeneralSlide = true
			if bg != "/assets/general-default.png" {
				t.Fatalf("general slide without custom bg=%q, want /assets/general-default.png", bg)
			}
		}

		// Non-song slide with authored template background retains it
		if it.Artifact.InstanceID == "welcome" {
			if bg != "/assets/welcome-bg.png" {
				t.Fatalf("welcome slide with authored bg=%q, want /assets/welcome-bg.png", bg)
			}
		}
	}

	if !foundOpeningSongTitle || !foundOpeningSongLyric {
		t.Fatalf("opening song slides not found in plan")
	}
	if !foundClosingSongTitle || !foundClosingSongLyric {
		t.Fatalf("closing song slides not found in plan")
	}
	if !foundGeneralSlide {
		t.Fatalf("general non-song slide not found in plan")
	}
}

func TestBackgroundPrecedence_TemplateAuthoringAndTerminalBlack(t *testing.T) {
	authoredBg := "/assets/authored-template.png"
	snap := plan.Snapshot{
		Order: []string{"song-with-authored-bg", "slide-terminal-black"},
		ByID: map[string]plan.Template{
			"song-with-authored-bg": {
				SchemaVersion: 1,
				ID:            "song-with-authored-bg",
				Label:         "Authored Bg Song",
				BaseType:      "song-set-entry",
				VariableName:  ptrString("authored_song"),
				Layouts: map[string]plan.Layout{
					"title": {AspectRatio: "16:9", BackgroundColor: "#111111", BackgroundImage: &authoredBg},
					"verse": {AspectRatio: "16:9", BackgroundColor: "#111111", BackgroundImage: &authoredBg},
					"reff":  {AspectRatio: "16:9", BackgroundColor: "#111111", BackgroundImage: &authoredBg},
				},
			},
			"slide-terminal-black": {
				SchemaVersion: 1,
				ID:            "slide-terminal-black",
				Label:         "Terminal Black Slide",
				BaseType:      "general",
				Layouts: map[string]plan.Layout{
					"default": {AspectRatio: "16:9", BackgroundColor: ""}, // Empty bg color and no image!
				},
			},
		},
		SongInputs: map[string]plan.HymnItem{
			"authored_song": {
				BookCode: "SDAH",
				Number:   10,
				Title:    "Authored Hymn",
				Lyrics:   "Authored Lyric 1",
			},
		},
		SongSetDefaultBackground: "", // No song-set default!
		GeneralDefaultBackground: "", // No general default!
	}

	items, err := plan.BuildSlidePlan("2026-09-26", plan.ParsedRundown{}, plan.Media{}, snap)
	if err != nil {
		t.Fatalf("BuildSlidePlan: %v", err)
	}

	var foundAuthoredTitle, foundAuthoredLyric bool
	var foundTerminalBlack bool

	for _, it := range items {
		if strings.HasPrefix(it.Artifact.InstanceID, "song-with-authored-bg-title") {
			foundAuthoredTitle = true
			if it.Artifact.Layout.BackgroundImage == nil || *it.Artifact.Layout.BackgroundImage != authoredBg {
				t.Fatalf("expected template authored background %q, got %v", authoredBg, it.Artifact.Layout.BackgroundImage)
			}
		}
		if strings.HasPrefix(it.Artifact.InstanceID, "song-with-authored-bg-lyric") {
			foundAuthoredLyric = true
			if it.Artifact.Layout.BackgroundImage == nil || *it.Artifact.Layout.BackgroundImage != authoredBg {
				t.Fatalf("expected template authored background %q, got %v", authoredBg, it.Artifact.Layout.BackgroundImage)
			}
		}
		if it.Artifact.InstanceID == "slide-terminal-black" {
			foundTerminalBlack = true
			if it.Artifact.Layout.BackgroundColor != "#000000" {
				t.Fatalf("expected terminal black background #000000, got %q", it.Artifact.Layout.BackgroundColor)
			}
		}
	}

	if !foundAuthoredTitle || !foundAuthoredLyric {
		t.Fatalf("authored background song slides not found")
	}
	if !foundTerminalBlack {
		t.Fatalf("terminal black slide not found")
	}
}

func ptrString(s string) *string {
	return &s
}
