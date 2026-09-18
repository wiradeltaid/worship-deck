package parse

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

type PreprocessRules struct {
	StripPrefixes  []string `json:"strip_prefixes"`
	TimingPatterns []string `json:"timing_patterns"`
}

type HymnPatternRule struct {
	Pattern string   `json:"pattern"`
	Flags   []string `json:"flags,omitempty"`
}

type FieldRule struct {
	Pattern string `json:"pattern"`
}

type RolePatterns struct {
	BracketRole string `json:"bracket_role"`
	ColonRole   string `json:"colon_role"`
	ClockRole   string `json:"clock_role"`
}

type LabelSlotMapping struct {
	Label  string `json:"label"`
	Target string `json:"target"`
}

type SongSetMatchingConfig struct {
	LabelSlots       []LabelSlotMapping `json:"label_slots"`
	SlotFamilyPrefix string             `json:"slot_family_prefix"`
}

type ParserProfile struct {
	ID                      string                `json:"id,omitempty"`
	Slug                    string                `json:"slug,omitempty"`
	SchemaVersion           int                   `json:"schema_version"`
	Preprocess              PreprocessRules       `json:"preprocess"`
	DatePattern             string                `json:"date_pattern"`
	SectionDelimiterPattern string                `json:"section_delimiter_pattern"`
	HymnPatterns            []HymnPatternRule     `json:"hymn_patterns"`
	BookAliases             map[string]string     `json:"book_aliases"`
	DefaultBook             string                `json:"default_book"`
	FieldRules              map[string]FieldRule  `json:"field_rules"`
	ScriptureSplitPattern   string                `json:"scripture_split_pattern"`
	ScriptureRefPattern     string                `json:"scripture_ref_pattern"`
	RolePatterns            RolePatterns          `json:"role_patterns"`
	SongSetMatching         SongSetMatchingConfig `json:"song_set_matching"`

	// Compiled cached regexes
	stripPrefixREs     []*regexp.Regexp
	timingREs          []*regexp.Regexp
	dateRE             *regexp.Regexp
	sectionDelimiterRE *regexp.Regexp
	hymnREs            []*regexp.Regexp
	fieldREs           map[string]*regexp.Regexp
	scriptureSplitRE   *regexp.Regexp
	scriptureRefRE     *regexp.Regexp
	bracketRoleRE      *regexp.Regexp
	colonRoleRE        *regexp.Regexp
	clockRoleRE        *regexp.Regexp
}

func DefaultParserProfile() *ParserProfile {
	p, err := LoadParserProfileFromJSON(db.BuiltinDefaultRulesJSON)
	if err != nil {
		panic(fmt.Sprintf("corrupt builtin-default rules: %v", err))
	}
	p.ID = db.BuiltinDefaultParserProfileID
	p.Slug = db.BuiltinDefaultParserProfileSlug
	return p
}

func LoadParserProfileFromJSON(raw string) (*ParserProfile, error) {
	var p ParserProfile
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return nil, fmt.Errorf("unmarshal parser profile: %w", err)
	}
	if err := p.Compile(); err != nil {
		return nil, err
	}
	return &p, nil
}

func LoadDefaultParserProfile(dbHandle *sql.DB) (*ParserProfile, error) {
	if dbHandle == nil {
		return DefaultParserProfile(), nil
	}
	var id, slug, rulesJSON string
	err := dbHandle.QueryRow(`
		SELECT id, slug, rules_json FROM rundown_parser_profiles WHERE is_default = 1 LIMIT 1
	`).Scan(&id, &slug, &rulesJSON)
	if err == sql.ErrNoRows {
		return DefaultParserProfile(), nil
	}
	if err != nil {
		return nil, err
	}
	p, err := LoadParserProfileFromJSON(rulesJSON)
	if err != nil {
		return nil, err
	}
	p.ID = id
	p.Slug = slug
	return p, nil
}

func LoadParserProfileByID(dbHandle *sql.DB, idOrSlug string) (*ParserProfile, error) {
	if dbHandle == nil || idOrSlug == "" || idOrSlug == db.BuiltinDefaultParserProfileID || idOrSlug == db.BuiltinDefaultParserProfileSlug {
		return DefaultParserProfile(), nil
	}
	var id, slug, rulesJSON string
	err := dbHandle.QueryRow(`
		SELECT id, slug, rules_json FROM rundown_parser_profiles WHERE id = ? OR slug = ? LIMIT 1
	`, idOrSlug, idOrSlug).Scan(&id, &slug, &rulesJSON)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("parser profile %q not found", idOrSlug)
	}
	if err != nil {
		return nil, err
	}
	p, err := LoadParserProfileFromJSON(rulesJSON)
	if err != nil {
		return nil, err
	}
	p.ID = id
	p.Slug = slug
	return p, nil
}

func (p *ParserProfile) Compile() error {
	var err error
	p.stripPrefixREs = make([]*regexp.Regexp, 0, len(p.Preprocess.StripPrefixes))
	for _, pat := range p.Preprocess.StripPrefixes {
		re, err := CompileProfileRegex(pat)
		if err != nil {
			return fmt.Errorf("compile strip_prefix %q: %w", pat, err)
		}
		p.stripPrefixREs = append(p.stripPrefixREs, re)
	}

	p.timingREs = make([]*regexp.Regexp, 0, len(p.Preprocess.TimingPatterns))
	for _, pat := range p.Preprocess.TimingPatterns {
		re, err := CompileProfileRegex(pat)
		if err != nil {
			return fmt.Errorf("compile timing_pattern %q: %w", pat, err)
		}
		p.timingREs = append(p.timingREs, re)
	}

	if p.DatePattern != "" {
		p.dateRE, err = CompileProfileRegex(p.DatePattern)
		if err != nil {
			return fmt.Errorf("compile date_pattern: %w", err)
		}
	}

	if p.SectionDelimiterPattern != "" {
		p.sectionDelimiterRE, err = CompileProfileRegex(p.SectionDelimiterPattern)
		if err != nil {
			return fmt.Errorf("compile section_delimiter_pattern: %w", err)
		}
	}

	p.hymnREs = make([]*regexp.Regexp, 0, len(p.HymnPatterns))
	for _, hp := range p.HymnPatterns {
		re, err := CompileProfileRegex(hp.Pattern)
		if err != nil {
			return fmt.Errorf("compile hymn_pattern %q: %w", hp.Pattern, err)
		}
		p.hymnREs = append(p.hymnREs, re)
	}

	p.fieldREs = make(map[string]*regexp.Regexp)
	for k, fr := range p.FieldRules {
		re, err := CompileProfileRegex(fr.Pattern)
		if err != nil {
			return fmt.Errorf("compile field_rule %q: %w", k, err)
		}
		p.fieldREs[k] = re
	}

	if p.ScriptureSplitPattern != "" {
		p.scriptureSplitRE, err = CompileProfileRegex(p.ScriptureSplitPattern)
		if err != nil {
			return fmt.Errorf("compile scripture_split_pattern: %w", err)
		}
	}
	if p.ScriptureRefPattern != "" {
		p.scriptureRefRE, err = CompileProfileRegex(p.ScriptureRefPattern)
		if err != nil {
			return fmt.Errorf("compile scripture_ref_pattern: %w", err)
		}
	}

	if p.RolePatterns.BracketRole != "" {
		p.bracketRoleRE, err = CompileProfileRegex(p.RolePatterns.BracketRole)
		if err != nil {
			return fmt.Errorf("compile bracket_role: %w", err)
		}
	}
	if p.RolePatterns.ColonRole != "" {
		p.colonRoleRE, err = CompileProfileRegex(p.RolePatterns.ColonRole)
		if err != nil {
			return fmt.Errorf("compile colon_role: %w", err)
		}
	}
	if p.RolePatterns.ClockRole != "" {
		p.clockRoleRE, err = CompileProfileRegex(p.RolePatterns.ClockRole)
		if err != nil {
			return fmt.Errorf("compile clock_role: %w", err)
		}
	}

	return nil
}

func (p *ParserProfile) ResolveBook(aliasOrCode string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(aliasOrCode))
	if cleaned == "" {
		if p.DefaultBook != "" {
			return strings.ToUpper(p.DefaultBook)
		}
		return "SDAH"
	}
	if p.BookAliases != nil {
		if target, ok := p.BookAliases[cleaned]; ok && target != "" {
			return strings.ToUpper(target)
		}
	}
	return cleaned
}
