package httpapi

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

// saveSongSetToBook implements POST /api/services/{id}/song-sets/{variableName}/save-to-book
// — the explicit "Save to Song Book" action (UC-28 alternate flow, BR-7,
// DEC-004 S12), sanctioned as a write into `hymns` by DEC-005 / AD-36.
//
// Body: { text, songNumber, songBookCode? } where songNumber/songBookCode are
// what the editor was showing at the moment of the press. The route re-reads
// the entry's current resolved hymn from song_set_inputs (LC-12) rather than
// trusting the page's last-loaded state (SCN-4): a mismatch refuses with 409
// and never touches the Service's own lyric override. A variable_name with no
// resolvable hymn is 400; a DB write failure is 500 and likewise leaves the
// override unaffected.
func (s *Server) saveSongSetToBook(w http.ResponseWriter, r *http.Request) {
	setNoStore(w)
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}
	variableName := strings.TrimSpace(r.PathValue("variableName"))
	if variableName == "" {
		writeError(w, http.StatusBadRequest, "Invalid Song Set entry")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	text, _ := body["text"].(string)
	expectedNumber := 0
	switch v := body["songNumber"].(type) {
	case float64:
		if v != float64(int(v)) || v <= 0 {
			writeError(w, http.StatusBadRequest, "songNumber must be a positive integer")
			return
		}
		expectedNumber = int(v)
	default:
		writeError(w, http.StatusBadRequest, "songNumber is required")
		return
	}
	expectedBook, _ := body["songBookCode"].(string)
	expectedBook = strings.ToUpper(strings.TrimSpace(expectedBook))

	var songNumber sql.NullInt64
	var bookCode sql.NullString
	err = s.DB.QueryRow(
		`SELECT song_number, song_book_code
		   FROM song_set_inputs
		  WHERE service_id = ? AND variable_name = ?`,
		id, variableName,
	).Scan(&songNumber, &bookCode)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "Song Set entry has no weekly input for this Service")
		return
	}
	if err != nil {
		log.Printf("save-to-book: read song_set_inputs: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if !songNumber.Valid || songNumber.Int64 <= 0 {
		writeError(w, http.StatusBadRequest, "Song Set entry has no resolvable song number")
		return
	}
	resolvedBook := db.ResolveSongBook(s.DB, bookCode.String)

	// SCN-4 precondition: refuse when the hymn moved under the Operator.
	if expectedNumber != int(songNumber.Int64) ||
		(expectedBook != "" && expectedBook != resolvedBook) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "song changed under you",
			"song": map[string]any{
				"book_code": resolvedBook,
				"number":    songNumber.Int64,
			},
		})
		return
	}

	var current string
	err = s.DB.QueryRow(
		`SELECT lyrics FROM hymns WHERE book_code = ? AND number = ?`,
		resolvedBook, songNumber.Int64,
	).Scan(&current)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "Unknown hymn number in the Song Book")
		return
	}
	if err != nil {
		log.Printf("save-to-book: read hymns: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if _, err := s.DB.Exec(
		`UPDATE hymns SET lyrics = ? WHERE book_code = ? AND number = ?`,
		text, resolvedBook, songNumber.Int64,
	); err != nil {
		log.Printf("save-to-book: write hymns: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Lyrics saved to the Song Book",
		"song": map[string]any{
			"book_code": resolvedBook,
			"number":    songNumber.Int64,
		},
	})
}
