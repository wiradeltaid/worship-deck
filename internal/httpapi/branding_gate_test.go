package httpapi

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestBrandingAssets_ExemptFromGate(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequest("GET", ts.URL+"/branding/worship-deck-icon-square.svg", nil)
	if err != nil {
		t.Fatalf("new request failed: %v", err)
	}

	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET /branding/... failed: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for /branding asset, got %d (location: %s)", res.StatusCode, res.Header.Get("Location"))
	}

	contentType := res.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/svg+xml") {
		t.Errorf("expected Content-Type starting with image/svg+xml, got %q", contentType)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read body failed: %v", err)
	}
	if !strings.Contains(string(body), "<svg") {
		t.Errorf("expected body to contain '<svg', got: %s", string(body))
	}
}

func TestBrandingPrefixCollision_Gated(t *testing.T) {
	ts, _, _ := newSongSetTestServer(t)

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequest("GET", ts.URL+"/brandingfoo", nil)
	if err != nil {
		t.Fatalf("new request failed: %v", err)
	}

	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET /brandingfoo failed: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307 Temporary Redirect for /brandingfoo, got %d", res.StatusCode)
	}

	loc := res.Header.Get("Location")
	if !strings.HasPrefix(loc, "/login?next=") {
		t.Errorf("expected Location starting with /login?next=, got %q", loc)
	}
}
