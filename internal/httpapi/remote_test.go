package httpapi

import (
	"regexp"
	"testing"
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
