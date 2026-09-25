package httpapi

import "testing"

func TestSpaIndexName(t *testing.T) {
	cases := []struct {
		path string
		want string
	}{
		{"/", "index.html"},
		{"/login", "index.html"},
		{"/services/1", "index.html"},
		{"/services/1/present", "index.html"},
		{"/services/1/slideshow", "projected.html"},
		{"/services/1/present/projector", "projected.html"},
	}
	for _, tc := range cases {
		if got := spaIndexName(tc.path); got != tc.want {
			t.Errorf("spaIndexName(%q) = %q, want %q", tc.path, got, tc.want)
		}
	}
}

func TestParseWordWrapParam(t *testing.T) {
	cases := []struct {
		raw  string
		want bool
	}{
		{"", true},
		{"true", true},
		{"TRUE", true},
		{"1", true},
		{"yes", true},
		{"arbitrary", true},
		{"false", false},
		{"FALSE", false},
		{"0", false},
		{" 0 ", false},
		{" false ", false},
	}
	for _, tc := range cases {
		if got := parseWordWrapParam(tc.raw); got != tc.want {
			t.Errorf("parseWordWrapParam(%q) = %v, want %v", tc.raw, got, tc.want)
		}
	}
}
