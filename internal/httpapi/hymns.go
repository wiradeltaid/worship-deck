package httpapi

import (
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/wiradeltaid/worship-deck/internal/db"
)

func (s *Server) getHymns(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	all := q.Get("all") == "1" || q.Get("all") == "true"
	search := strings.TrimSpace(q.Get("q"))
	limit := parseHymnLimit(q.Get("limit"))

	// Resolve book_code: query parameter if provided, otherwise the global default book.
	reqBook := strings.TrimSpace(q.Get("book_code"))
	if reqBook == "" {
		reqBook = strings.TrimSpace(q.Get("bookCode"))
	}
	resolvedBook := db.ResolveSongBook(s.DB, reqBook)

	type row struct {
		BookCode string `json:"bookCode"`
		Number   int    `json:"number"`
		Title    string `json:"title"`
		Lyrics   string `json:"lyrics,omitempty"`
	}
	var rows []row
	var err error
	if all {
		err = s.queryHymnsArgs(
			`SELECT book_code, number, title, lyrics FROM hymns WHERE book_code = ? ORDER BY number ASC`,
			[]any{resolvedBook},
			func(b string, n int, t, l string) {
				rows = append(rows, row{BookCode: b, Number: n, Title: t, Lyrics: l})
			},
		)
	} else if q.Has("numbers") {
		nums := parseHymnNumbers(q.Get("numbers"))
		if len(nums) == 0 {
			rows = []row{}
		} else {
			placeholders := strings.TrimRight(strings.Repeat("?,", len(nums)), ",")
			args := make([]any, 0, len(nums)+1)
			args = append(args, resolvedBook)
			for _, n := range nums {
				args = append(args, n)
			}
			err = s.queryHymnsArgs(
				`SELECT book_code, number, title, lyrics FROM hymns WHERE book_code = ? AND number IN (`+placeholders+`) ORDER BY number ASC`,
				args,
				func(b string, n int, t, l string) {
					rows = append(rows, row{BookCode: b, Number: n, Title: t, Lyrics: l})
				},
			)
		}
	} else if search != "" {
		pattern := "%" + escapeLike(search) + "%"
		err = s.queryHymnsArgs(
			`SELECT book_code, number, title, lyrics FROM hymns
			  WHERE book_code = ?
			    AND (CAST(number AS TEXT) LIKE ? ESCAPE '\' OR title LIKE ? ESCAPE '\')
			  ORDER BY number ASC LIMIT ?`,
			[]any{resolvedBook, pattern, pattern, limit},
			func(b string, n int, t, l string) {
				rows = append(rows, row{BookCode: b, Number: n, Title: t, Lyrics: l})
			},
		)
	} else {
		err = s.queryHymnsArgs(
			`SELECT book_code, number, title, lyrics FROM hymns WHERE book_code = ? ORDER BY number ASC LIMIT ?`,
			[]any{resolvedBook, limit},
			func(b string, n int, t, l string) {
				rows = append(rows, row{BookCode: b, Number: n, Title: t, Lyrics: l})
			},
		)
	}
	if err != nil {
		log.Printf("Error searching hymns: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if rows == nil {
		rows = []row{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"hymns": rows})
}

func (s *Server) queryHymnsArgs(sql string, args []any, fn func(string, int, string, string)) error {
	rows, err := s.DB.Query(sql, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var b, t, l string
		var n int
		if err := rows.Scan(&b, &n, &t, &l); err != nil {
			return err
		}
		fn(b, n, t, l)
	}
	return rows.Err()
}

func parseHymnLimit(raw string) int {
	if raw == "" {
		return 15
	}
	if !regexp.MustCompile(`^\d+$`).MatchString(strings.TrimSpace(raw)) {
		return 15
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 15
	}
	if n > 40 {
		return 40
	}
	return n
}

func parseHymnNumbers(raw string) []int {
	seen := map[int]struct{}{}
	var out []int
	for _, part := range strings.Split(raw, ",") {
		token := strings.TrimSpace(part)
		if !regexp.MustCompile(`^\d+$`).MatchString(token) {
			continue
		}
		n, err := strconv.Atoi(token)
		if err != nil || n <= 0 {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
		if len(out) >= 40 {
			break
		}
	}
	return out
}

func escapeLike(value string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return r.Replace(value)
}
