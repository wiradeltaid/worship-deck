package db

import (
	"path/filepath"
	"testing"
)

func TestEnsureRundownParserProfiles(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "parser_profiles.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// 1. Verify rundown_parser_profiles table exists and has builtin-default profile
	var count int
	err = handle.QueryRow(`SELECT COUNT(*) FROM rundown_parser_profiles WHERE slug = 'builtin-default'`).Scan(&count)
	if err != nil {
		t.Fatalf("query builtin-default: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 builtin-default profile, got %d", count)
	}

	// 2. Verify profile details
	var id, title, rulesJSON string
	var isBuiltin, isDefault, version int
	err = handle.QueryRow(`
		SELECT id, title, rules_json, is_builtin, is_default, version
		FROM rundown_parser_profiles
		WHERE slug = 'builtin-default'
	`).Scan(&id, &title, &rulesJSON, &isBuiltin, &isDefault, &version)
	if err != nil {
		t.Fatalf("scan builtin-default: %v", err)
	}
	if id != BuiltinDefaultParserProfileID {
		t.Fatalf("expected id %s, got %s", BuiltinDefaultParserProfileID, id)
	}
	if isBuiltin != 1 || isDefault != 1 {
		t.Fatalf("expected isBuiltin=1, isDefault=1, got isBuiltin=%d, isDefault=%d", isBuiltin, isDefault)
	}
	if version != 1 {
		t.Fatalf("expected version=1, got %d", version)
	}
	if len(rulesJSON) == 0 {
		t.Fatalf("expected non-empty rules_json")
	}

	// 3. Verify services table has parser_profile_id and parser_profile_version columns
	rows, err := handle.Query(`PRAGMA table_info(services)`)
	if err != nil {
		t.Fatalf("pragma table_info(services): %v", err)
	}
	defer rows.Close()

	cols := map[string]string{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt any
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan column: %v", err)
		}
		cols[name] = ctype
	}
	if _, ok := cols["parser_profile_id"]; !ok {
		t.Errorf("missing parser_profile_id column in services table")
	}
	if _, ok := cols["parser_profile_version"]; !ok {
		t.Errorf("missing parser_profile_version column in services table")
	}

	// 4. Idempotency check: running ensureRundownParserProfiles again causes no errors or duplicate rows
	if err := ensureRundownParserProfiles(handle); err != nil {
		t.Fatalf("re-run ensureRundownParserProfiles: %v", err)
	}
	err = handle.QueryRow(`SELECT COUNT(*) FROM rundown_parser_profiles WHERE slug = 'builtin-default'`).Scan(&count)
	if err != nil || count != 1 {
		t.Fatalf("expected 1 builtin-default profile after re-run, got count=%d, err=%v", count, err)
	}
}
