# 01: Parser Profile Schema and Built-in Rules Migration

**What to build:**
Create database tables and Go models for configurable rundown parser profiles, and seed the existing hardcoded parsing rules as an immutable `builtin-default` profile on database migration so that all existing services continue parsing with zero regressions.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Add `rundown_parser_profiles` table to SQLite schema with `id`, `slug`, `title`, `description`, `rules_json`, `is_builtin`, `is_default`, `version`, `created_at`, `updated_at`.
- [x] Add migration establishing the table and seeding the immutable `builtin-default` profile containing the existing regex rules (SDAH/Hymn/# patterns, Bible Talk / Divine Service section delimiters, standard role keywords).
- [x] Add `parser_profile_id` and `parser_profile_version` optional columns to `services` table for traceability.
- [x] Implement Go HTTP API endpoints under `/api/admin/parser-profiles` for listing, reading, creating, updating, and setting default parser profiles.
- [x] Profile validation rejects invalid JSON and enforces schema version 1 and unique slug constraints.
