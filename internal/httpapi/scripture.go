package httpapi

import (
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/wiradeltaid/worship-deck/internal/scripture"
)

func (s *Server) getScripture(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimSpace(r.URL.Query().Get("ref"))
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if ref == "" && q == "" {
		writeError(w, http.StatusBadRequest, "Missing ref or q query parameter")
		return
	}
	code, ok := s.resolveTranslation(w, r)
	if !ok {
		return
	}
	if ref != "" {
		passage, found := s.lookupScripture(ref, code)
		if !found {
			writeError(w, http.StatusNotFound, "Scripture reference not found")
			return
		}
		writeJSON(w, http.StatusOK, passage)
		return
	}
	names := s.loadBookNames(code)
	hits := scripture.SuggestBooks(q, names, scripture.AliasesFor(code), 20)
	suggestions := make([]map[string]string, 0, len(hits))
	for _, h := range hits {
		suggestions = append(suggestions, map[string]string{
			"name":       h.Name,
			"short_name": h.ShortName,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"suggestions": suggestions,
		"translation": code,
	})
}

func (s *Server) getBibleTranslations(w http.ResponseWriter, r *http.Request) {
	rows, err := s.listBibleTranslationRows()
	if err != nil {
		log.Printf("Error listing bible translations: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	codes := make([]string, 0, len(rows))
	for _, row := range rows {
		codes = append(codes, row["code"])
	}
	bible := s.resolveDefaultBibleTranslation(codes)
	writeJSON(w, http.StatusOK, map[string]any{
		"translations":                        rows,
		"default_bible_translation":           bible.configured,
		"default_bible_translation_resolved":  bible.resolved,
		"default_bible_translation_installed": bible.configuredInstalled,
	})
}

func (s *Server) listBibleTranslationRows() ([]map[string]string, error) {
	q, err := s.DB.Query(
		`SELECT code, name, locale, licence, provenance FROM bible_translations ORDER BY code`,
	)
	if err != nil {
		return nil, err
	}
	defer q.Close()
	out := make([]map[string]string, 0)
	for q.Next() {
		var code, name, locale, licence, provenance string
		if err := q.Scan(&code, &name, &locale, &licence, &provenance); err != nil {
			return nil, err
		}
		out = append(out, map[string]string{
			"code":       code,
			"name":       name,
			"locale":     locale,
			"licence":    licence,
			"provenance": provenance,
		})
	}
	return out, q.Err()
}

func (s *Server) resolveTranslation(w http.ResponseWriter, r *http.Request) (string, bool) {
	translationParam := strings.TrimSpace(r.URL.Query().Get("translation"))
	installed, err := s.listTranslationCodes()
	if err != nil {
		log.Printf("Error looking up scripture: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return "", false
	}
	code := s.resolveDefaultBibleTranslation(installed).resolved
	if translationParam != "" {
		normalized := strings.ToUpper(translationParam)
		known := false
		for _, c := range installed {
			if c == normalized {
				known = true
				break
			}
		}
		if !known {
			writeError(w, http.StatusBadRequest, `Unknown bible translation "`+normalized+`"`)
			return "", false
		}
		code = normalized
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM bible_verses WHERE translation_code = ?`, code).Scan(&n); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return "", false
	}
	if n == 0 {
		writeError(w, http.StatusServiceUnavailable,
			code+` corpus is empty. It ships at data/*/bible-translation/`+strings.ToLower(code)+`.json and is reconciled from that file on boot; check it with npm run corpus:verify.`)
		return "", false
	}
	return code, true
}

func (s *Server) listTranslationCodes() ([]string, error) {
	rows, err := s.DB.Query(`SELECT code FROM bible_translations ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Server) lookupScripture(ref, code string) (map[string]string, bool) {
	bookPart, chapter, start, end, ok := scripture.ParseRef(ref)
	if !ok {
		return nil, false
	}
	bookID, canonical, ok := s.resolveBook(bookPart, code)
	if !ok {
		return nil, false
	}
	rows, err := s.DB.Query(
		`SELECT verse, verse_text FROM bible_verses
		  WHERE book_id = ? AND chapter = ? AND verse >= ? AND verse <= ? AND translation_code = ?
		  ORDER BY verse ASC`,
		bookID, chapter, start, end, code,
	)
	if err != nil {
		return nil, false
	}
	defer rows.Close()
	var texts []string
	for rows.Next() {
		var verse int
		var text string
		if err := rows.Scan(&verse, &text); err != nil {
			return nil, false
		}
		texts = append(texts, stripVerseMarkup(text))
	}
	if len(texts) == 0 {
		return nil, false
	}
	reference := canonical + " " + strconv.Itoa(chapter) + ":" + strconv.Itoa(start)
	if start != end {
		reference += "-" + strconv.Itoa(end)
	}
	return map[string]string{
		"reference":   reference,
		"text":        strings.Join(texts, " "),
		"translation": code,
	}, true
}

func (s *Server) resolveBook(bookPart, translation string) (int, string, bool) {
	names := s.loadBookNames(translation)
	id, canonical, ok := scripture.MatchBook(bookPart, names, scripture.AliasesFor(translation))
	return id, canonical, ok
}

func (s *Server) loadBookNames(translation string) []scripture.BookName {
	rows, err := s.DB.Query(
		`SELECT book_id, name, short_name FROM bible_book_names WHERE translation_code = ?`,
		translation,
	)
	if err == nil {
		defer rows.Close()
		var out []scripture.BookName
		for rows.Next() {
			var n scripture.BookName
			if err := rows.Scan(&n.ID, &n.Name, &n.ShortName); err != nil {
				break
			}
			out = append(out, n)
		}
		if len(out) > 0 {
			return out
		}
	}
	fallback, err := s.DB.Query(`SELECT id, name, short_name FROM bible_books`)
	if err != nil {
		return nil
	}
	defer fallback.Close()
	var out []scripture.BookName
	for fallback.Next() {
		var n scripture.BookName
		if err := fallback.Scan(&n.ID, &n.Name, &n.ShortName); err != nil {
			return out
		}
		out = append(out, n)
	}
	return out
}

func stripVerseMarkup(text string) string {
	text = regexp.MustCompile(`@\d+`).ReplaceAllString(text, "")
	return strings.Join(strings.Fields(text), " ")
}
