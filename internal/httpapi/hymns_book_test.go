package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func TestGetHymnsBookCodeAndFiltering(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// Insert second song book "TESTBOOK"
	_, err := handle.Exec(
		`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES (?, ?, ?, ?)`,
		"TESTBOOK", "Test Hymnal", 0, "2026-08-21T00:00:00Z",
	)
	if err != nil {
		t.Fatalf("insert song_books: %v", err)
	}

	// Insert hymn #1 in TESTBOOK (distinct from SDAH #1)
	_, err = handle.Exec(
		`INSERT INTO hymns (book_code, number, title, lyrics) VALUES (?, ?, ?, ?)`,
		"TESTBOOK", 1, "Test Hymn in Test Book", "Verse 1\nTest lyrics",
	)
	if err != nil {
		t.Fatalf("insert hymn: %v", err)
	}

	// 1. GET /api/hymns returns bookCode in results (defaulting to global default book, SDAH)
	res := songSetRequest(t, ts, "GET", "/api/hymns?numbers=1", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/hymns?numbers=1 = %d, want 200", res.StatusCode)
	}
	bodyBytes, _ := io.ReadAll(res.Body)
	res.Body.Close()
	var payload struct {
		Hymns []struct {
			BookCode string `json:"bookCode"`
			Number   int    `json:"number"`
			Title    string `json:"title"`
		} `json:"hymns"`
	}
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		t.Fatalf("unmarshal hymns: %v", err)
	}
	if len(payload.Hymns) != 1 {
		t.Fatalf("expected 1 hymn, got %d", len(payload.Hymns))
	}
	if payload.Hymns[0].BookCode != "SDAH" {
		t.Fatalf("expected BookCode SDAH, got %q", payload.Hymns[0].BookCode)
	}
	if payload.Hymns[0].Title != "Praise to the Lord" {
		t.Fatalf("expected Title 'Praise to the Lord', got %q", payload.Hymns[0].Title)
	}

	// 2. GET /api/hymns?book_code=TESTBOOK&numbers=1 returns the TESTBOOK hymn
	res = songSetRequest(t, ts, "GET", "/api/hymns?book_code=TESTBOOK&numbers=1", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/hymns with book_code = %d, want 200", res.StatusCode)
	}
	bodyBytes, _ = io.ReadAll(res.Body)
	res.Body.Close()
	payload.Hymns = nil
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		t.Fatalf("unmarshal hymns: %v", err)
	}
	if len(payload.Hymns) != 1 {
		t.Fatalf("expected 1 hymn, got %d", len(payload.Hymns))
	}
	if payload.Hymns[0].BookCode != "TESTBOOK" {
		t.Fatalf("expected BookCode TESTBOOK, got %q", payload.Hymns[0].BookCode)
	}
	if payload.Hymns[0].Title != "Test Hymn in Test Book" {
		t.Fatalf("expected Title 'Test Hymn in Test Book', got %q", payload.Hymns[0].Title)
	}

	// 3. Search filtered by book_code
	res = songSetRequest(t, ts, "GET", "/api/hymns?book_code=TESTBOOK&q=Test", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/hymns with q and book_code = %d, want 200", res.StatusCode)
	}
	bodyBytes, _ = io.ReadAll(res.Body)
	res.Body.Close()
	payload.Hymns = nil
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		t.Fatalf("unmarshal hymns: %v", err)
	}
	if len(payload.Hymns) != 1 || payload.Hymns[0].Title != "Test Hymn in Test Book" {
		t.Fatalf("expected 1 match for TESTBOOK, got %v", payload.Hymns)
	}

	// Searching for "Test" in SDAH returns 0 hymns
	res = songSetRequest(t, ts, "GET", "/api/hymns?book_code=SDAH&q=Test+Hymn+in+Test+Book", "", cookie)
	bodyBytes, _ = io.ReadAll(res.Body)
	res.Body.Close()
	payload.Hymns = nil
	_ = json.Unmarshal(bodyBytes, &payload)
	if len(payload.Hymns) != 0 {
		t.Fatalf("expected 0 matches for SDAH, got %d", len(payload.Hymns))
	}
}

func TestGetHymnsUnregisteredBookCode404(t *testing.T) {
	ts, handle, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Unregistered book_code returns 404 "Song book not found"
	res := songSetRequest(t, ts, "GET", "/api/hymns?book_code=NONEXISTENT_BOOK", "", cookie)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("GET /api/hymns?book_code=NONEXISTENT_BOOK = %d, want 404", res.StatusCode)
	}
	var errResp map[string]any
	_ = json.NewDecoder(res.Body).Decode(&errResp)
	res.Body.Close()
	if errResp["error"] != "Song book not found" {
		t.Fatalf("expected error 'Song book not found', got %v", errResp["error"])
	}

	// 2. Unregistered bookCode (camelCase param) also returns 404
	res = songSetRequest(t, ts, "GET", "/api/hymns?bookCode=NONEXISTENT_BOOK", "", cookie)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("GET /api/hymns?bookCode=NONEXISTENT_BOOK = %d, want 404", res.StatusCode)
	}
	res.Body.Close()

	// 3. Registered book with ZERO hymns returns 200 {"hymns": []}, NOT 404
	_, err := handle.Exec(
		`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES ('EMPTYBOOK', 'Empty Hymnal', 0, '2026-08-21T00:00:00Z')`,
	)
	if err != nil {
		t.Fatalf("insert empty song book: %v", err)
	}
	res = songSetRequest(t, ts, "GET", "/api/hymns?book_code=EMPTYBOOK", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/hymns?book_code=EMPTYBOOK = %d, want 200", res.StatusCode)
	}
	var emptyPayload struct {
		Hymns []any `json:"hymns"`
	}
	_ = json.NewDecoder(res.Body).Decode(&emptyPayload)
	res.Body.Close()
	if len(emptyPayload.Hymns) != 0 {
		t.Fatalf("expected 0 hymns for EMPTYBOOK, got %d", len(emptyPayload.Hymns))
	}

	// 4. When book_code is omitted, default resolution succeeds with 200
	res = songSetRequest(t, ts, "GET", "/api/hymns", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/hymns with no book_code = %d, want 200", res.StatusCode)
	}
	res.Body.Close()
}
