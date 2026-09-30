# Project History: WorshipDeck

WorshipDeck began as a bespoke private internal repository developed for a single congregation.

---

## 1. Clean Public Lineage

That original development history was intentionally not carried into this open-source repository. The private commit log contained real congregation member names, photographs of identifiable adults and minors, private pastoral message screenshots, and live bank payment QR codes. None of these items belong in a public repository, and once indexed by public search engines and mirrors, such data cannot be reliably erased.

Consequently, this public repository originated from a clean initial commit containing synthetic congregation examples and sanitized test fixtures. The design rationale for this boundary is documented in architectural records under `.what/` and `.how/` (DEC-001).

---

## 2. Privacy Guarantees and Invariants

To guarantee that no congregation records ever enter this public repository:

1. An automated test guard (`tests/public-repo-guard.test.mjs`) executes before every commit and pull request. It immediately fails if real congregation names, phone numbers, banking details, or unapproved binary media are detected in tracked paths.
2. All contributors must review [`.constitution/project/private-data.md`](../.constitution/project/private-data.md) before submitting changes.
3. Test fixtures and demonstration data must use synthetic names and public domain references.
