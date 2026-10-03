# 02: Whole Chapter Reference Parsing & Backend/Client Data Parity

**What to build:** In `internal/scripture/match.go`, `internal/httpapi/scripture.go`, and `src/lib/scripture.ts`:

1. **Reference Parser Upgrade (Go & TypeScript Parity)**:
   - Extend `ParseRef(raw string)` in `internal/scripture/match.go` and `parseScriptureRef(raw string)` in `src/lib/scripture.ts`:
     - Support pattern `<Book> <Chapter>` without colon (e.g. `John 4`, `Yohanes 4`, `1 Korintus 13`, `Mazmur 23`, `Song of Solomon 2`).
     - Flag whole-chapter queries (`isWholeChapter: true`, with `start: 0, end: 0` or verse boundary resolution).
     - Preserve 100% backward compatibility for colon-based ranges (`Book C:V` and `Book C:V-V`).
     - Normalize book aliases consistently (e.g. `Jn 4` -> `John 4`, `Ps 23` -> `Psalm 23`).

2. **Backend Query & Canonical Formatting**:
   - In `internal/httpapi/scripture.go` (`lookupScripture`):
     - When whole-chapter is detected, query all verses in the chapter:
       ```sql
       SELECT verse, verse_text FROM bible_verses
       WHERE book_id = ? AND chapter = ? AND translation_code = ?
       ORDER BY verse ASC
       ```
     - Return canonical reference as `<Book> <Chapter>` (e.g. `John 4`).
     - Return structured payload with ordered verses:
       ```json
       {
         "reference": "John 4",
         "chapter": 4,
         "is_whole_chapter": true,
         "verses": [
           { "verse": 1, "text": "When therefore the Lord knew..." },
           { "verse": 2, "text": "Though Jesus himself baptized not..." }
         ],
         "text": "(1) When therefore the Lord knew...\n(2) Though Jesus himself baptized not...",
         "translation": "KJV"
       }
       ```

3. **Client-Side Lookup & Autocomplete Parity**:
   - Update `src/lib/scripture.ts`:
     - Update `lookupScripture` in TypeScript to query and structure whole chapters identically when invoked locally.
     - Ensure autocomplete `suggestBooks` handles trailing chapter numbers without throwing or malformed filtering.
   - Add integration tests in `tests/scripture-chapter-lookup.test.mjs`.

**Blocked by:** none

**Status:** open

- [ ] Support chapter-only references without colon in Go and TypeScript parsers with full alias normalization.
- [ ] Query and return all verses for whole chapter in `/api/scripture`.
- [ ] Format canonical reference without artificial verse numbers for full chapters.
- [ ] Return structured `verses` array alongside formatted text in API response.
- [ ] Maintain 100% backward compatibility for standard verse range lookups.
