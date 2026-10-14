package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

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

func TestClaimRateLimiter_WindowPruningAndThresholdBoundary(t *testing.T) {
	limiter := &claimRateLimiter{
		failures: make(map[int][]time.Time),
	}
	testSvcID := 42

	// Initially not rate limited
	if limiter.isRateLimited(testSvcID) {
		t.Fatalf("expected initial service to not be rate limited")
	}

	// 4 failures -> still under limit
	for i := 0; i < 4; i++ {
		limiter.recordFailure(testSvcID)
	}
	if limiter.isRateLimited(testSvcID) {
		t.Fatalf("expected 4 failures to not be rate limited")
	}

	// 5th failure -> hits threshold
	limiter.recordFailure(testSvcID)
	if !limiter.isRateLimited(testSvcID) {
		t.Fatalf("expected 5 failures within 1 minute to be rate limited")
	}

	// Stale entries older than 1 minute are pruned
	limiter.mu.Lock()
	staleTime := time.Now().Add(-2 * time.Minute)
	limiter.failures[testSvcID] = []time.Time{staleTime, staleTime, staleTime}
	limiter.mu.Unlock()

	// isRateLimited prunes stale entries and deletes empty key
	if limiter.isRateLimited(testSvcID) {
		t.Fatalf("expected stale failures to be pruned and unblocked")
	}
	limiter.mu.Lock()
	if _, exists := limiter.failures[testSvcID]; exists {
		t.Fatalf("expected empty key to be deleted from failures map")
	}
	limiter.mu.Unlock()

	// reset clears failures
	limiter.recordFailure(testSvcID)
	limiter.reset(testSvcID)
	limiter.mu.Lock()
	if _, exists := limiter.failures[testSvcID]; exists {
		t.Fatalf("expected reset to delete service entry")
	}
	limiter.mu.Unlock()
}

func TestRemoteCapabilityToken_IsolationAndHijackRefusal(t *testing.T) {
	srv := &Server{
		DB: nil,
	}
	ResetRemoteHubForTests()

	testServiceID := 77
	presenterSess := &auth.Session{UID: 10, Role: "operator", SID: "pres-10"}
	siblingSess := &auth.Session{UID: 20, Role: "operator", SID: "sib-20"}
	adminSess := &auth.Session{UID: 1, Role: "admin", SID: "admin-1"}

	// 1. Presenter pairs
	reqPair := httptest.NewRequest("POST", fmt.Sprintf("/api/present/%d/remote/pair", testServiceID), nil)
	reqPair.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	reqPair = withSession(reqPair, presenterSess)
	recPair := httptest.NewRecorder()
	srv.postRemotePair(recPair, reqPair)
	if recPair.Code != http.StatusOK {
		t.Fatalf("pair failed: %d", recPair.Code)
	}
	var pairResp map[string]any
	_ = json.Unmarshal(recPair.Body.Bytes(), &pairResp)
	code := pairResp["code"].(string)

	// 1b. Proven presenter opens stream -> 200 OK
	ctxPres, cancelPres := context.WithCancel(context.Background())
	reqPresStream := httptest.NewRequest("GET", fmt.Sprintf("/api/present/%d/remote/stream?role=presenter", testServiceID), nil).WithContext(ctxPres)
	reqPresStream.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	reqPresStream = withSession(reqPresStream, presenterSess)
	recPresStream := httptest.NewRecorder()
	go srv.getRemoteStream(recPresStream, reqPresStream)
	time.Sleep(10 * time.Millisecond)
	cancelPres()
	if recPresStream.Code != http.StatusOK {
		t.Fatalf("authorized presenter stream failed: %d", recPresStream.Code)
	}

	// 2. Unauthenticated mobile phone claims with PIN (NO SESSION COOKIE)
	reqClaim := httptest.NewRequest("POST", fmt.Sprintf("/api/present/%d/remote/claim", testServiceID), strings.NewReader(fmt.Sprintf(`{"code":"%s"}`, code)))
	reqClaim.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	recClaim := httptest.NewRecorder()
	srv.postRemoteClaim(recClaim, reqClaim)
	if recClaim.Code != http.StatusOK {
		t.Fatalf("unauthenticated claim failed: %d, %s", recClaim.Code, recClaim.Body.String())
	}
	var claimResp map[string]any
	_ = json.Unmarshal(recClaim.Body.Bytes(), &claimResp)
	if claimResp["paired"] != true || claimResp["token"] == nil {
		t.Fatalf("expected paired=true and token, got %v", claimResp)
	}
	token := claimResp["token"].(string)

	// 3. Unauthenticated smartphone dispatches intent with token -> 200
	reqIntent := httptest.NewRequest("POST", fmt.Sprintf("/api/present/%d/remote/intent", testServiceID), strings.NewReader(fmt.Sprintf(`{"type":"blank","blank":true,"planIdentity":"p1","token":"%s"}`, token)))
	reqIntent.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	recIntent := httptest.NewRecorder()
	srv.postRemoteIntent(recIntent, reqIntent)
	if recIntent.Code != http.StatusOK {
		t.Fatalf("token-authorized intent failed: %d, %s", recIntent.Code, recIntent.Body.String())
	}

	// 4. Remote token tries to claim presenter role -> 403 Forbidden
	reqHijack := httptest.NewRequest("GET", fmt.Sprintf("/api/present/%d/remote/stream?role=presenter&token=%s", testServiceID, token), nil)
	reqHijack.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	recHijack := httptest.NewRecorder()
	srv.getRemoteStream(recHijack, reqHijack)
	if recHijack.Code != http.StatusForbidden {
		t.Fatalf("expected remote token presenter hijack to return 403, got %d", recHijack.Code)
	}

	// 5. Sibling authenticated session tries to claim presenter role -> 403 Forbidden
	reqSibHijack := httptest.NewRequest("GET", fmt.Sprintf("/api/present/%d/remote/stream?role=presenter", testServiceID), nil)
	reqSibHijack.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	reqSibHijack = withSession(reqSibHijack, siblingSess)
	recSibHijack := httptest.NewRecorder()
	srv.getRemoteStream(recSibHijack, reqSibHijack)
	if recSibHijack.Code != http.StatusForbidden {
		t.Fatalf("expected sibling presenter hijack to return 403, got %d", recSibHijack.Code)
	}

	// 6. Unauthenticated request without session tries to delete pair -> 401 Unauthorized
	reqUnauthDel := httptest.NewRequest("DELETE", fmt.Sprintf("/api/present/%d/remote/pair", testServiceID), nil)
	reqUnauthDel.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	recUnauthDel := httptest.NewRecorder()
	srv.deleteRemotePair(recUnauthDel, reqUnauthDel)
	if recUnauthDel.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated delete pair to return 401, got %d", recUnauthDel.Code)
	}

	// 7. Sibling non-admin user tries to delete pair -> 403 Forbidden
	reqSibDel := httptest.NewRequest("DELETE", fmt.Sprintf("/api/present/%d/remote/pair", testServiceID), nil)
	reqSibDel.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	reqSibDel = withSession(reqSibDel, siblingSess)
	recSibDel := httptest.NewRecorder()
	srv.deleteRemotePair(recSibDel, reqSibDel)
	if recSibDel.Code != http.StatusForbidden {
		t.Fatalf("expected sibling non-admin delete pair to return 403, got %d", recSibDel.Code)
	}

	// 8. Admin user deletes pair -> 204 No Content
	reqAdminDel := httptest.NewRequest("DELETE", fmt.Sprintf("/api/present/%d/remote/pair", testServiceID), nil)
	reqAdminDel.SetPathValue("id", fmt.Sprintf("%d", testServiceID))
	reqAdminDel = withSession(reqAdminDel, adminSess)
	recAdminDel := httptest.NewRecorder()
	srv.deleteRemotePair(recAdminDel, reqAdminDel)
	if recAdminDel.Code != http.StatusNoContent {
		t.Fatalf("expected admin delete pair to return 204, got %d", recAdminDel.Code)
	}
}
