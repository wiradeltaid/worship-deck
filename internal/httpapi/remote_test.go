package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/wiradeltaid/worship-deck/internal/auth"
)

func TestFormat6DigitCodeBoundaries(t *testing.T) {
	cases := []struct {
		input    int64
		expected string
	}{
		{0, "000000"},
		{1, "000001"},
		{42, "000042"},
		{1234, "001234"},
		{99999, "099999"},
		{999999, "999999"},
		{1000000, "000000"},
		{1000042, "000042"},
	}

	for _, tc := range cases {
		actual := format6DigitCode(tc.input)
		if actual != tc.expected {
			t.Errorf("format6DigitCode(%d) = %q; expected %q", tc.input, actual, tc.expected)
		}
	}
}

func TestGenerate6DigitCode(t *testing.T) {
	digitRegex := regexp.MustCompile(`^\d{6}$`)
	for i := 0; i < 100; i++ {
		code := generate6DigitCode()
		if len(code) != 6 {
			t.Fatalf("expected code length 6, got %d (code: %s)", len(code), code)
		}
		if !digitRegex.MatchString(code) {
			t.Fatalf("expected 6-digit string, got %s", code)
		}
	}
}

func TestRemotePairStatus(t *testing.T) {
	srv, adminSess, opSess := setupTestServer(t)

	// 1. Unauthenticated -> 401
	req1 := httptest.NewRequest("GET", "/api/present/1/remote/pair", nil)
	req1.SetPathValue("id", "1")
	rec1 := httptest.NewRecorder()
	srv.getRemotePairStatus(rec1, req1)
	if rec1.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d, want 401", rec1.Code)
	}

	// 2. Not paired yet -> 200 {paired: false, has_grant: false}
	req2 := httptest.NewRequest("GET", "/api/present/1/remote/pair", nil)
	req2.SetPathValue("id", "1")
	req2 = withSession(req2, opSess)
	rec2 := httptest.NewRecorder()
	srv.getRemotePairStatus(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("unpaired status = %d, want 200", rec2.Code)
	}
	var data2 map[string]any
	_ = json.Unmarshal(rec2.Body.Bytes(), &data2)
	if data2["has_grant"] != false || data2["paired"] != false {
		t.Fatalf("expected has_grant=false, paired=false, got %v", data2)
	}

	// 3. Presenter generates code, and operator claims it
	reqPair := httptest.NewRequest("POST", "/api/present/1/remote/pair", nil)
	reqPair.SetPathValue("id", "1")
	reqPair = withSession(reqPair, adminSess)
	recPair := httptest.NewRecorder()
	srv.postRemotePair(recPair, reqPair)
	var pairResp map[string]any
	_ = json.Unmarshal(recPair.Body.Bytes(), &pairResp)
	code := pairResp["code"].(string)

	reqClaim := httptest.NewRequest("POST", "/api/present/1/remote/claim", strings.NewReader(fmt.Sprintf(`{"code":"%s"}`, code)))
	reqClaim.SetPathValue("id", "1")
	reqClaim = withSession(reqClaim, opSess)
	recClaim := httptest.NewRecorder()
	srv.postRemoteClaim(recClaim, reqClaim)
	if recClaim.Code != http.StatusOK {
		t.Fatalf("claim failed: %d, %s", recClaim.Code, recClaim.Body.String())
	}

	// 4. Operator checks status -> has_grant=true, paired=true
	reqStatus := httptest.NewRequest("GET", "/api/present/1/remote/pair", nil)
	reqStatus.SetPathValue("id", "1")
	reqStatus = withSession(reqStatus, opSess)
	recStatus := httptest.NewRecorder()
	srv.getRemotePairStatus(recStatus, reqStatus)
	if recStatus.Code != http.StatusOK {
		t.Fatalf("status code = %d, want 200", recStatus.Code)
	}
	var dataStatus map[string]any
	_ = json.Unmarshal(recStatus.Body.Bytes(), &dataStatus)
	if dataStatus["has_grant"] != true || dataStatus["paired"] != true {
		t.Fatalf("expected has_grant=true, paired=true, got %v", dataStatus)
	}

	// 5. Different user checks status -> paired=true, has_grant=false
	otherSess := &auth.Session{UID: 99, Role: "operator", SID: "other-99"}
	reqOther := httptest.NewRequest("GET", "/api/present/1/remote/pair", nil)
	reqOther.SetPathValue("id", "1")
	reqOther = withSession(reqOther, otherSess)
	recOther := httptest.NewRecorder()
	srv.getRemotePairStatus(recOther, reqOther)
	var dataOther map[string]any
	_ = json.Unmarshal(recOther.Body.Bytes(), &dataOther)
	if dataOther["has_grant"] != false || dataOther["paired"] != true {
		t.Fatalf("expected other user has_grant=false, paired=true, got %v", dataOther)
	}

	// 6. Delete pair -> has_grant=false, paired=false
	reqDel := httptest.NewRequest("DELETE", "/api/present/1/remote/pair", nil)
	reqDel.SetPathValue("id", "1")
	reqDel = withSession(reqDel, adminSess)
	recDel := httptest.NewRecorder()
	srv.deleteRemotePair(recDel, reqDel)

	reqStatusAfter := httptest.NewRequest("GET", "/api/present/1/remote/pair", nil)
	reqStatusAfter.SetPathValue("id", "1")
	reqStatusAfter = withSession(reqStatusAfter, opSess)
	recStatusAfter := httptest.NewRecorder()
	srv.getRemotePairStatus(recStatusAfter, reqStatusAfter)
	var dataAfter map[string]any
	_ = json.Unmarshal(recStatusAfter.Body.Bytes(), &dataAfter)
	if dataAfter["has_grant"] != false || dataAfter["paired"] != false {
		t.Fatalf("expected has_grant=false, paired=false after unpair, got %v", dataAfter)
	}
}
