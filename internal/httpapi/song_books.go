package httpapi

import (
	"database/sql"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/wiradeltaid/worship-deck/internal/db"
)

type songBookItem struct {
	BookCode   string  `json:"bookCode"`
	Name       string  `json:"name"`
	Locale     string  `json:"locale"`
	Licence    *string `json:"licence,omitempty"`
	Provenance *string `json:"provenance,omitempty"`
	IsDefault  bool    `json:"isDefault"`
	UpdatedAt  string  `json:"updatedAt"`
}

type operatorSongBookItem struct {
	BookCode  string `json:"bookCode"`
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
}

func (s *Server) listSongBooks(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	rows, err := s.DB.Query(
		`SELECT book_code, COALESCE(name, ''), COALESCE(locale, ''), licence, provenance, is_default, COALESCE(updated_at, '')
		   FROM song_books
		  ORDER BY book_code ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var books []songBookItem
	for rows.Next() {
		var item songBookItem
		var isDef int
		var licenceNull, provenanceNull sql.NullString
		if err := rows.Scan(&item.BookCode, &item.Name, &item.Locale, &licenceNull, &provenanceNull, &isDef, &item.UpdatedAt); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		if licenceNull.Valid {
			item.Licence = &licenceNull.String
		}
		if provenanceNull.Valid {
			item.Provenance = &provenanceNull.String
		}
		item.IsDefault = (isDef == 1)
		books = append(books, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	rows.Close()

	if books == nil {
		books = []songBookItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"books": books})
}

func (s *Server) listSongBooksForOperator(w http.ResponseWriter, r *http.Request) {
	if sessionFrom(r) == nil {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	rows, err := s.DB.Query(
		`SELECT book_code, COALESCE(name, ''), is_default
		   FROM song_books
		  ORDER BY book_code ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var books []operatorSongBookItem
	for rows.Next() {
		var item operatorSongBookItem
		var isDef int
		if err := rows.Scan(&item.BookCode, &item.Name, &isDef); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		item.IsDefault = (isDef == 1)
		books = append(books, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	rows.Close()

	if books == nil {
		books = []operatorSongBookItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"books": books})
}

func (s *Server) createSongBook(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}

	rawCode, _ := body["book_code"].(string)
	if rawCode == "" {
		rawCode, _ = body["bookCode"].(string)
	}
	bookCode := strings.TrimSpace(rawCode)
	codeLen := utf8.RuneCountInString(bookCode)
	if codeLen < 1 || codeLen > 20 {
		writeError(w, http.StatusBadRequest, "book_code must be between 1 and 20 characters")
		return
	}

	rawName, _ := body["name"].(string)
	name := strings.TrimSpace(rawName)
	nameLen := utf8.RuneCountInString(name)
	if nameLen < 1 || nameLen > 120 {
		writeError(w, http.StatusBadRequest, "name must be between 1 and 120 characters")
		return
	}

	rawLocale, _ := body["locale"].(string)
	locale := strings.TrimSpace(rawLocale)
	localeLen := utf8.RuneCountInString(locale)
	if localeLen < 1 || localeLen > 20 {
		writeError(w, http.StatusBadRequest, "locale is required (1 to 20 characters)")
		return
	}

	var licencePtr *string
	if rawLicence, ok := body["licence"].(string); ok {
		trimmed := strings.TrimSpace(rawLicence)
		licencePtr = &trimmed
	}
	var provenancePtr *string
	if rawProvenance, ok := body["provenance"].(string); ok {
		trimmed := strings.TrimSpace(rawProvenance)
		provenancePtr = &trimmed
	}

	var existingCount int
	err = s.DB.QueryRow(`SELECT COUNT(*) FROM song_books WHERE book_code = ?`, bookCode).Scan(&existingCount)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if existingCount > 0 {
		writeError(w, http.StatusConflict, "Song book already exists")
		return
	}

	isDef := false
	if v, ok := body["is_default"].(bool); ok && v {
		isDef = true
	} else if v, ok := body["isDefault"].(bool); ok && v {
		isDef = true
	}

	now := timeNowRFC3339Nano()
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if isDef {
		if _, err := tx.Exec(`UPDATE song_books SET is_default = 0, updated_at = ? WHERE is_default = 1`, now); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	isDefInt := 0
	if isDef {
		isDefInt = 1
	}

	if _, err := tx.Exec(
		`INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		bookCode, name, locale, licencePtr, provenancePtr, isDefInt, now,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	marker := db.SongBookBootstrapKey(bookCode)
	if _, err := tx.Exec(
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
		marker, "1",
	); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusCreated, songBookItem{
		BookCode:   bookCode,
		Name:       name,
		Locale:     locale,
		Licence:    licencePtr,
		Provenance: provenancePtr,
		IsDefault:  isDef,
		UpdatedAt:  now,
	})
}

func (s *Server) patchSongBook(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	bookCode := strings.TrimSpace(r.PathValue("bookCode"))
	if bookCode == "" {
		writeError(w, http.StatusBadRequest, "Invalid bookCode")
		return
	}

	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}

	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		updatedAt, _ = body["updated_at"].(string)
	}
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}

	var currentName string
	var currentLocale string
	var currentLicence sql.NullString
	var currentProvenance sql.NullString
	var currentDef int
	var storedUpdated string
	err = s.DB.QueryRow(
		`SELECT COALESCE(name, ''), COALESCE(locale, ''), licence, provenance, is_default, COALESCE(updated_at, '') FROM song_books WHERE book_code = ?`,
		bookCode,
	).Scan(&currentName, &currentLocale, &currentLicence, &currentProvenance, &currentDef, &storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Song book not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Song book was modified by another session")
		return
	}

	newName := currentName
	if rawName, ok := body["name"].(string); ok {
		trimmed := strings.TrimSpace(rawName)
		nameLen := utf8.RuneCountInString(trimmed)
		if nameLen < 1 || nameLen > 120 {
			writeError(w, http.StatusBadRequest, "name must be between 1 and 120 characters")
			return
		}
		newName = trimmed
	}

	newLocale := currentLocale
	if rawLocale, ok := body["locale"].(string); ok {
		trimmed := strings.TrimSpace(rawLocale)
		localeLen := utf8.RuneCountInString(trimmed)
		if localeLen < 1 || localeLen > 20 {
			writeError(w, http.StatusBadRequest, "locale must be between 1 and 20 characters")
			return
		}
		newLocale = trimmed
	}

	var newLicence *string
	if currentLicence.Valid {
		newLicence = &currentLicence.String
	}
	if rawLicence, ok := body["licence"].(string); ok {
		trimmed := strings.TrimSpace(rawLicence)
		newLicence = &trimmed
	} else if body["licence"] == nil {
		if _, present := body["licence"]; present {
			newLicence = nil
		}
	}

	var newProvenance *string
	if currentProvenance.Valid {
		newProvenance = &currentProvenance.String
	}
	if rawProvenance, ok := body["provenance"].(string); ok {
		trimmed := strings.TrimSpace(rawProvenance)
		newProvenance = &trimmed
	} else if body["provenance"] == nil {
		if _, present := body["provenance"]; present {
			newProvenance = nil
		}
	}

	isDef := (currentDef == 1)
	if v, ok := body["is_default"].(bool); ok {
		isDef = v
	} else if v, ok := body["isDefault"].(bool); ok {
		isDef = v
	}

	now := timeNowRFC3339Nano()
	tx, err := s.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()

	if isDef {
		if _, err := tx.Exec(`UPDATE song_books SET is_default = 0, updated_at = ? WHERE is_default = 1 AND book_code != ?`, now, bookCode); err != nil {
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
	}

	isDefInt := 0
	if isDef {
		isDefInt = 1
	}

	res, err := tx.Exec(
		`UPDATE song_books SET name = ?, locale = ?, licence = ?, provenance = ?, is_default = ?, updated_at = ? WHERE book_code = ? AND updated_at = ?`,
		newName, newLocale, newLicence, newProvenance, isDefInt, now, bookCode, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Song book was modified by another session")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	writeJSON(w, http.StatusOK, songBookItem{
		BookCode:   bookCode,
		Name:       newName,
		Locale:     newLocale,
		Licence:    newLicence,
		Provenance: newProvenance,
		IsDefault:  isDef,
		UpdatedAt:  now,
	})
}

func (s *Server) deleteSongBook(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	bookCode := strings.TrimSpace(r.PathValue("bookCode"))
	if bookCode == "" {
		writeError(w, http.StatusBadRequest, "Invalid bookCode")
		return
	}

	body, err, status, msg := readJSONObjectOptional(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	updatedAt, _ := body["updatedAt"].(string)
	if strings.TrimSpace(updatedAt) == "" {
		updatedAt, _ = body["updated_at"].(string)
	}
	if strings.TrimSpace(updatedAt) == "" {
		updatedAt = r.URL.Query().Get("updated_at")
	}
	if strings.TrimSpace(updatedAt) == "" {
		writeError(w, http.StatusBadRequest, "updatedAt is required")
		return
	}

	var storedUpdated string
	err = s.DB.QueryRow(
		`SELECT COALESCE(updated_at, '') FROM song_books WHERE book_code = ?`,
		bookCode,
	).Scan(&storedUpdated)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Song book not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if storedUpdated != updatedAt {
		writeError(w, http.StatusConflict, "Song book was modified by another session")
		return
	}

	var hymnCount int
	err = s.DB.QueryRow(`SELECT COUNT(*) FROM hymns WHERE book_code = ?`, bookCode).Scan(&hymnCount)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if hymnCount > 0 {
		writeError(w, http.StatusConflict, "Song book is still in use")
		return
	}

	var setInputCount int
	err = s.DB.QueryRow(`SELECT COUNT(*) FROM song_set_inputs WHERE song_book_code = ?`, bookCode).Scan(&setInputCount)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if setInputCount > 0 {
		writeError(w, http.StatusConflict, "Song book is still in use")
		return
	}

	res, err := s.DB.Exec(
		`DELETE FROM song_books WHERE book_code = ? AND updated_at = ?`,
		bookCode, updatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusConflict, "Song book was modified by another session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "book_code": bookCode})
}
