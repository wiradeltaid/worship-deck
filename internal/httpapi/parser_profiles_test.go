package httpapi

import (
	"fmt"
	"net/http"
	"testing"
)

func TestParserProfiles_AdminCRUDAndOperatorList(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)
	cookie := songSetLogin(t, ts)

	// 1. Unauthenticated access -> 401
	res := songSetRequest(t, ts, "GET", "/api/admin/parser-profiles", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth admin GET = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles", `{"slug":"test","title":"Test"}`, nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth admin POST = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	res = songSetRequest(t, ts, "GET", "/api/parser-profiles", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth operator GET = %d, want 401", res.StatusCode)
	}
	res.Body.Close()

	// 2. Initial listing as admin -> includes builtin-default
	res = songSetRequest(t, ts, "GET", "/api/admin/parser-profiles", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("admin GET = %d, want 200", res.StatusCode)
	}
	var listBody map[string]any
	_ = jsonDecode(res.Body, &listBody)
	res.Body.Close()

	profiles, ok := listBody["profiles"].([]any)
	if !ok || len(profiles) == 0 {
		t.Fatalf("expected non-empty profiles, got %v", listBody)
	}
	first := profiles[0].(map[string]any)
	if first["slug"] != "builtin-default" {
		t.Fatalf("expected first profile to be builtin-default, got %v", first["slug"])
	}
	if first["isDefault"] != true || first["isBuiltin"] != true {
		t.Fatalf("expected builtin-default to be default and builtin, got %v", first)
	}

	// 3. Get builtin-default
	res = songSetRequest(t, ts, "GET", "/api/admin/parser-profiles/builtin-default", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get builtin-default = %d, want 200", res.StatusCode)
	}
	var profileBody map[string]any
	_ = jsonDecode(res.Body, &profileBody)
	res.Body.Close()
	if profileBody["id"] != "builtin-default" {
		t.Fatalf("expected id builtin-default, got %v", profileBody["id"])
	}

	// 4. Validation on creation
	// 4a. Invalid slug
	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles", `{"slug":"Invalid Slug!","title":"Test"}`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid slug = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 4b. Invalid JSON in rulesJson
	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles", `{"slug":"custom-profile","title":"Custom","rulesJson":"{not valid json"`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid rulesJson = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 4c. Schema version != 1
	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles", `{"slug":"custom-profile","title":"Custom","rulesJson":"{\"schema_version\":2}"}`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid schema_version = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 5. Create valid custom profile
	validRules := `{"schema_version":1,"default_book":"SDAH"}`
	createPayload := fmt.Sprintf(`{"slug":"custom-adventist","title":"Custom Adventist Profile","description":"Custom test profile","rulesJson":%q,"isDefault":false}`, validRules)
	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles", createPayload, cookie)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create profile = %d, want 201", res.StatusCode)
	}
	var created map[string]any
	_ = jsonDecode(res.Body, &created)
	res.Body.Close()

	if created["slug"] != "custom-adventist" || created["version"] != float64(1) {
		t.Fatalf("unexpected created profile: %v", created)
	}

	// 6. Cannot update builtin-default
	res = songSetRequest(t, ts, "PATCH", "/api/admin/parser-profiles/builtin-default", `{"title":"Hacked Title"}`, cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("update builtin = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 7. Update custom profile
	res = songSetRequest(t, ts, "PATCH", "/api/admin/parser-profiles/custom-adventist", `{"title":"Updated Custom Profile"}`, cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update custom = %d, want 200", res.StatusCode)
	}
	var updated map[string]any
	_ = jsonDecode(res.Body, &updated)
	res.Body.Close()
	if updated["title"] != "Updated Custom Profile" || updated["version"] != float64(2) {
		t.Fatalf("unexpected updated profile: %v", updated)
	}

	// 8. Set custom as default
	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles/custom-adventist/set-default", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("set-default = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// Verify custom is default and builtin-default is no longer default
	res = songSetRequest(t, ts, "GET", "/api/admin/parser-profiles/custom-adventist", "", cookie)
	_ = jsonDecode(res.Body, &updated)
	res.Body.Close()
	if updated["isDefault"] != true {
		t.Fatalf("expected custom-adventist to be default")
	}

	res = songSetRequest(t, ts, "GET", "/api/admin/parser-profiles/builtin-default", "", cookie)
	_ = jsonDecode(res.Body, &profileBody)
	res.Body.Close()
	if profileBody["isDefault"] != false {
		t.Fatalf("expected builtin-default isDefault=false, got %v", profileBody["isDefault"])
	}

	// 9. Cannot delete default profile
	res = songSetRequest(t, ts, "DELETE", "/api/admin/parser-profiles/custom-adventist", "", cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("delete default = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 10. Cannot delete builtin profile
	res = songSetRequest(t, ts, "DELETE", "/api/admin/parser-profiles/builtin-default", "", cookie)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("delete builtin = %d, want 400", res.StatusCode)
	}
	res.Body.Close()

	// 11. Restore builtin as default, then delete custom
	res = songSetRequest(t, ts, "POST", "/api/admin/parser-profiles/builtin-default/set-default", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("restore builtin default = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	res = songSetRequest(t, ts, "DELETE", "/api/admin/parser-profiles/custom-adventist", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete custom = %d, want 200", res.StatusCode)
	}
	res.Body.Close()

	// 12. Operator listing
	res = songSetRequest(t, ts, "GET", "/api/parser-profiles", "", cookie)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("operator list = %d, want 200", res.StatusCode)
	}
	var opBody map[string]any
	_ = jsonDecode(res.Body, &opBody)
	res.Body.Close()
	opProfiles, ok := opBody["profiles"].([]any)
	if !ok || len(opProfiles) == 0 {
		t.Fatalf("expected operator profiles, got %v", opBody)
	}
}
