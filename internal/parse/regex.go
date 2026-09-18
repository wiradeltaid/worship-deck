package parse

import (
	"fmt"
	"regexp"
)

var (
	lookaheadRegex     = regexp.MustCompile(`\(\?[=!]`)
	lookbehindRegex    = regexp.MustCompile(`\(\?<[=!]`)
	backreferenceRegex = regexp.MustCompile(`\\k<|\\[1-9]`)
	jsNamedGroupRegex  = regexp.MustCompile(`\(\?<([a-zA-Z0-9_]+)>`)
)

// ValidateAndTranslateRegex converts JS-style (?<name>...) to Go RE2 (?P<name>...)
// and rejects unsupported lookarounds or backreferences.
func ValidateAndTranslateRegex(pattern string) (string, error) {
	if lookaheadRegex.MatchString(pattern) || lookbehindRegex.MatchString(pattern) {
		return "", fmt.Errorf("regex lookarounds (?=, (?!, (?<=, (?<! are not supported in profile patterns: %s", pattern)
	}
	if backreferenceRegex.MatchString(pattern) {
		return "", fmt.Errorf("regex backreferences are not supported in profile patterns: %s", pattern)
	}
	translated := jsNamedGroupRegex.ReplaceAllString(pattern, "(?P<$1>")
	if _, err := regexp.Compile(translated); err != nil {
		return "", fmt.Errorf("invalid regex pattern %q: %w", pattern, err)
	}
	return translated, nil
}

// CompileProfileRegex compiles a translated pattern or returns error.
func CompileProfileRegex(pattern string) (*regexp.Regexp, error) {
	translated, err := ValidateAndTranslateRegex(pattern)
	if err != nil {
		return nil, err
	}
	return regexp.Compile(translated)
}
