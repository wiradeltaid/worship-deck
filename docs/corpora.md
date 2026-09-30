# Shipped Corpora: WorshipDeck

Two default corpora ship with the repository so that a clone resolves hymn numbers and scripture references immediately without external network access or setup downloads:

---

## 1. Shipped Corpora Table

| File | Content | Startup Behavior |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 hymns of the Seventh-day Adventist Hymnal | Titles and lyrics ingested into SQLite on boot |
| `data/en/bible-translation/kjv.json` | 66 books, 1,189 chapters, 31,102 KJV verses | Reconciled from the committed JSON file on boot |

---

## 2. Integrity and Verification

Run `npm run corpus:verify` to verify that both JSON corpora files are complete, properly structured, and mathematically whole.

Neither corpus uses an automated runtime generator. These committed files represent the authoritative local source of record. If damaged or modified accidentally, restore them directly from version control:

```bash
git checkout -- data/song-book/sdah.json data/en/bible-translation/kjv.json
```

---

## 3. Copyright and Licensing

Please review [ATTRIBUTIONS.md](../ATTRIBUTIONS.md). It documents copyright holders, affirms the non-commercial congregational fair-use purpose, and provides contact procedures for removal requests. Each corpus file also embeds its own licensing header internally.

---

## 4. Adding Additional Song Books

To add an alternative hymnal or supplemental song book:

1. Create a JSON corpus file at `data/song-book/<book-code>.json` matching the schema of `sdah.json`.
2. Hymns are indexed in SQLite by the compound key `(book_code, number)`.
3. Supplemental books sit alongside the shipped hymnal rather than replacing it, allowing multi-hymnal services.
