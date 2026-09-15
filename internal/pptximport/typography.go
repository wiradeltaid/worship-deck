package pptximport

import (
	"strings"
)

type suffixRule struct {
	suffix string
	weight string
	style  string
}

// Recognized suffixes ordered by length (longest match first)
var recognizedSuffixRules = []suffixRule{
	// Compound: Extra/Ultra Bold + Italic/Oblique
	{"extra bold italic", "800", "italic"},
	{"extra-bold italic", "800", "italic"},
	{"extrabold italic", "800", "italic"},
	{"ultra bold italic", "800", "italic"},
	{"ultra-bold italic", "800", "italic"},
	{"ultrabold italic", "800", "italic"},
	{"extra bold oblique", "800", "oblique"},
	{"extra-bold oblique", "800", "oblique"},
	{"extrabold oblique", "800", "oblique"},
	{"ultra bold oblique", "800", "oblique"},
	{"ultra-bold oblique", "800", "oblique"},
	{"ultrabold oblique", "800", "oblique"},

	// Compound: Semi/Demi Bold + Italic/Oblique
	{"semi bold italic", "600", "italic"},
	{"semi-bold italic", "600", "italic"},
	{"semibold italic", "600", "italic"},
	{"demi bold italic", "600", "italic"},
	{"demi-bold italic", "600", "italic"},
	{"demibold italic", "600", "italic"},
	{"semi bold oblique", "600", "oblique"},
	{"semi-bold oblique", "600", "oblique"},
	{"semibold oblique", "600", "oblique"},
	{"demi bold oblique", "600", "oblique"},
	{"demi-bold oblique", "600", "oblique"},
	{"demibold oblique", "600", "oblique"},

	// Compound: Extra/Ultra Light + Italic/Oblique
	{"extra light italic", "200", "italic"},
	{"extra-light italic", "200", "italic"},
	{"extralight italic", "200", "italic"},
	{"ultra light italic", "200", "italic"},
	{"ultra-light italic", "200", "italic"},
	{"ultralight italic", "200", "italic"},
	{"extra light oblique", "200", "oblique"},
	{"extra-light oblique", "200", "oblique"},
	{"extralight oblique", "200", "oblique"},
	{"ultra light oblique", "200", "oblique"},
	{"ultra-light oblique", "200", "oblique"},
	{"ultralight oblique", "200", "oblique"},

	// Compound: Single Weight + Italic/Oblique
	{"bold italic", "700", "italic"},
	{"bold-italic", "700", "italic"},
	{"bolditalic", "700", "italic"},
	{"bold oblique", "700", "oblique"},
	{"bold-oblique", "700", "oblique"},
	{"boldoblique", "700", "oblique"},

	{"black italic", "900", "italic"},
	{"black-italic", "900", "italic"},
	{"blackitalic", "900", "italic"},
	{"heavy italic", "900", "italic"},
	{"heavy-italic", "900", "italic"},
	{"heavyitalic", "900", "italic"},
	{"black oblique", "900", "oblique"},
	{"black-oblique", "900", "oblique"},
	{"heavy oblique", "900", "oblique"},

	{"light italic", "300", "italic"},
	{"light-italic", "300", "italic"},
	{"lightitalic", "300", "italic"},
	{"light oblique", "300", "oblique"},
	{"light-oblique", "300", "oblique"},

	{"medium italic", "500", "italic"},
	{"medium-italic", "500", "italic"},
	{"mediumitalic", "500", "italic"},
	{"medium oblique", "500", "oblique"},

	{"thin italic", "100", "italic"},
	{"thin-italic", "100", "italic"},
	{"thinitalic", "100", "italic"},
	{"hairline italic", "100", "italic"},
	{"thin oblique", "100", "oblique"},

	{"regular italic", "normal", "italic"},
	{"regular-italic", "normal", "italic"},
	{"roman italic", "normal", "italic"},
	{"book italic", "normal", "italic"},

	// Single Weight suffixes
	{"extra bold", "800", "normal"},
	{"extra-bold", "800", "normal"},
	{"extrabold", "800", "normal"},
	{"ultra bold", "800", "normal"},
	{"ultra-bold", "800", "normal"},
	{"ultrabold", "800", "normal"},

	{"semi bold", "600", "normal"},
	{"semi-bold", "600", "normal"},
	{"semibold", "600", "normal"},
	{"demi bold", "600", "normal"},
	{"demi-bold", "600", "normal"},
	{"demibold", "600", "normal"},

	{"extra light", "200", "normal"},
	{"extra-light", "200", "normal"},
	{"extralight", "200", "normal"},
	{"ultra light", "200", "normal"},
	{"ultra-light", "200", "normal"},
	{"ultralight", "200", "normal"},

	{"thin", "100", "normal"},
	{"hairline", "100", "normal"},
	{"light", "300", "normal"},
	{"medium", "500", "normal"},
	{"bold", "700", "normal"},
	{"black", "900", "normal"},
	{"heavy", "900", "normal"},

	{"regular", "normal", "normal"},
	{"roman", "normal", "normal"},
	{"book", "normal", "normal"},

	// Single Style suffixes
	{"italics", "normal", "italic"},
	{"italic", "normal", "italic"},
	{"oblique", "normal", "oblique"},
}

// NormalizeTypeface performs token-based right-to-left normalization per SPEC-32 §2.1.
// It removes recognized weight/style suffixes while preserving unrecognized families verbatim,
// and respects explicit XML b / i attributes.
func NormalizeTypeface(typeface string, explicitB, explicitI string) (family, weight, style, pptxTypeface string) {
	trimmed := strings.TrimSpace(typeface)
	if trimmed == "" {
		trimmed = DefaultFontFamily
	}
	pptxTypeface = trimmed

	inferredWeight := "normal"
	inferredStyle := "normal"
	matchedFamily := trimmed

	lower := strings.ToLower(trimmed)

	for _, rule := range recognizedSuffixRules {
		suf := rule.suffix
		if strings.HasSuffix(lower, suf) {
			prefixLen := len(trimmed) - len(suf)
			if prefixLen == 0 {
				// The entire string is the suffix (e.g. "Bold"). Rule: do not turn empty result into family name!
				inferredWeight = rule.weight
				inferredStyle = rule.style
				matchedFamily = trimmed
				break
			}

			// Verify boundary: prefix must end with space or hyphen, or suffix was glued
			boundaryChar := trimmed[prefixLen-1]
			if boundaryChar == ' ' || boundaryChar == '-' {
				candFamily := strings.TrimRight(trimmed[:prefixLen], " -")
				if candFamily != "" {
					inferredWeight = rule.weight
					inferredStyle = rule.style
					matchedFamily = candFamily
					break
				}
			} else {
				// Glued suffix without space/hyphen (e.g. "MontserratBold" or "MontserratItalic")
				// Only match if the boundary starts a word (e.g. uppercase in original or known suffix)
				candFamily := trimmed[:prefixLen]
				if candFamily != "" {
					inferredWeight = rule.weight
					inferredStyle = rule.style
					matchedFamily = candFamily
					break
				}
			}
		}
	}

	family = matchedFamily
	weight = inferredWeight
	style = inferredStyle

	// Explicit XML b and i override suffix decisions
	if explicitB == "1" {
		weight = "700"
	} else if explicitB == "0" {
		if weight == "600" || weight == "700" || weight == "800" || weight == "900" || weight == "bold" {
			weight = "normal"
		}
	}

	if explicitI == "1" {
		style = "italic"
	} else if explicitI == "0" {
		style = "normal"
	}

	return family, weight, style, pptxTypeface
}

// DrawingMLSpcToPx converts DrawingML spc (hundredths of a point) to CSS px.
// Formula: px = (spc / 100) / PxToPt = spc / 75.0
func DrawingMLSpcToPx(spc int) float64 {
	return float64(spc) / 75.0
}
