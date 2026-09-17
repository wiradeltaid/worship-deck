// Hand-mirrored port: internal/plan/validate_artifact.go <-> src/lib/registry/placeholder-catalog.ts
package plan

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	kebabID          = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)
	hexColor         = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
	bundledAsset     = regexp.MustCompile(`(?i)^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|gif|webp)$`)
	inlineTokenRegex = regexp.MustCompile(`\{([a-zA-Z0-9_]+)\}`)
	catalogKeys      = map[string]string{
		"service_date":            "text",
		"scripture_reference":     "text",
		"scripture_text":          "text",
		"scripture_bible_version": "text",
		"theme_reference":         "text",
		"theme_text":              "text",
		"special_song":            "text",
		"sermon_title":            "text",
		"sermon_speaker_name":     "text",
		"sermon_poster":           "image",
		"closing_prayer_person":   "text",
		"family_request":          "text",
		"youth_request":           "text",
		"family_name":             "text",
		"youth_name":              "text",
		"family_photo":            "image",
		"youth_photo":             "image",
	}
	allowedTemplateKeys = map[string]struct{}{
		"schemaVersion": {}, "id": {}, "label": {}, "baseType": {}, "placeholders": {}, "layouts": {},
	}
	allowedPlaceholderKeys = map[string]struct{}{"key": {}, "type": {}, "required": {}, "defaultValue": {}}
	allowedLayoutKeys      = map[string]struct{}{
		"aspectRatio": {}, "backgroundColor": {}, "backgroundImage": {}, "elements": {},
	}
	allowedElementKeys = map[string]struct{}{
		"id": {}, "type": {}, "required": {}, "x": {}, "y": {}, "w": {}, "h": {}, "zIndex": {},
		"content": {}, "wrapLines": {}, "longestWordPx": {}, "measuredWith": {}, "placeholderKey": {}, "imageRef": {}, "style": {},
		}
		allowedMeasuredWithKeys = map[string]struct{}{
			"fontFamily": {}, "fontSize": {}, "fontWeight": {}, "fontStyle": {},
	}
	allowedStyleKeys = map[string]struct{}{
		"fontFamily": {}, "fontSize": {}, "fontColor": {}, "fontWeight": {}, "fontStyle": {}, "textDecoration": {},
		"textAlign": {}, "verticalAlign": {}, "objectFit": {}, "fillColor": {}, "opacity": {},
		"lineHeight": {}, "textShadow": {}, "textShadowBlur": {},
		"letterSpacing": {}, "pptxTypeface": {}, "fontStatus": {},
		"strokeColor": {}, "strokeWidth": {},
	}
	entryKeys = map[string]struct{}{"general": {}, "song-set": {}, "song-set-entry": {}, "ann-set-marker": {}, "announcement": {}}
)

type templateValidationError struct{ msg string }

func (e *templateValidationError) Error() string { return e.msg }

func failf(format string, args ...any) error {
	return &templateValidationError{msg: fmt.Sprintf(format, args...)}
}

func asObject(v any, label string) (map[string]any, error) {
	obj, ok := v.(map[string]any)
	if !ok || obj == nil {
		return nil, failf("%s must be an object", label)
	}
	return obj, nil
}

func rejectUnknown(obj map[string]any, allowed map[string]struct{}, label string) error {
	for key := range obj {
		if _, ok := allowed[key]; !ok {
			return failf("Unknown field: %s.%s", label, key)
		}
	}
	return nil
}

func asNumber(v any, label string) (float64, error) {
	n, ok := v.(float64)
	if !ok || math.IsNaN(n) || math.IsInf(n, 0) {
		return 0, failf("%s must be a finite number", label)
	}
	return n, nil
}

func asPositive(v any, label string) (float64, error) {
	n, err := asNumber(v, label)
	if err != nil {
		return 0, err
	}
	if n <= 0 {
		return 0, failf("%s must be positive", label)
	}
	return n, nil
}

func asNonNegative(v any, label string) (float64, error) {
	n, err := asNumber(v, label)
	if err != nil {
		return 0, err
	}
	if n < 0 {
		return 0, failf("%s must be non-negative", label)
	}
	return n, nil
}

func asNonNegInt(v any, label string) (int, error) {
	n, err := asNumber(v, label)
	if err != nil {
		return 0, err
	}
	if n != math.Trunc(n) || n < 0 {
		return 0, failf("%s must be a non-negative integer", label)
	}
	return int(n), nil
}

func IsRegistryImageRef(ref, repoRoot string) bool {
	return isRegistryImageRef(ref, repoRoot)
}

func isRegistryImageRef(ref, repoRoot string) bool {
	if IsSafeImageURL(ref) {
		return true
	}
	if !strings.HasPrefix(ref, "/assets/") {
		return false
	}
	name := strings.TrimPrefix(ref, "/assets/")
	if name == "" || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return false
	}
	if !bundledAsset.MatchString(name) {
		return false
	}
	_, err := os.Stat(filepath.Join(repoRoot, "public", "assets", name))
	return err == nil
}

func parseStyle(raw any, label string) (map[string]any, error) {
	if raw == nil {
		return nil, nil
	}
	obj, err := asObject(raw, label)
	if err != nil {
		return nil, err
	}
	if err := rejectUnknown(obj, allowedStyleKeys, label); err != nil {
		return nil, err
	}
	style := map[string]any{}
	if v, ok := obj["fontFamily"]; ok {
		s, ok := v.(string)
		if !ok || strings.TrimSpace(s) == "" {
			return nil, failf("%s.fontFamily is invalid", label)
		}
		style["fontFamily"] = s
	}
	if v, ok := obj["fontSize"]; ok {
		n, err := asPositive(v, label+".fontSize")
		if err != nil {
			return nil, err
		}
		style["fontSize"] = n
	}
	if v, ok := obj["fontColor"]; ok {
		s, ok := v.(string)
		if !ok || !hexColor.MatchString(s) {
			return nil, failf("%s.fontColor is invalid", label)
		}
		style["fontColor"] = s
	}
	if v, ok := obj["fontWeight"]; ok {
		var s string
		switch val := v.(type) {
		case string:
			s = val
		case float64:
			if val >= 100 && val <= 900 && int(val)%100 == 0 {
				s = fmt.Sprintf("%d", int(val))
			}
		}
		if !isValidFontWeight(s) {
			return nil, failf("%s.fontWeight is invalid", label)
		}
		style["fontWeight"] = s
	}
	if v, ok := obj["fontStyle"]; ok {
		s, _ := v.(string)
		if s != "normal" && s != "italic" && s != "oblique" {
			return nil, failf("%s.fontStyle is invalid", label)
		}
		style["fontStyle"] = s
	}
	if v, ok := obj["letterSpacing"]; ok {
		n, err := asNumber(v, label+".letterSpacing")
		if err != nil {
			return nil, err
		}
		style["letterSpacing"] = n
	}
	if v, ok := obj["pptxTypeface"]; ok {
		s, ok := v.(string)
		if !ok || strings.TrimSpace(s) == "" {
			return nil, failf("%s.pptxTypeface is invalid", label)
		}
		style["pptxTypeface"] = s
	}
	if v, ok := obj["fontStatus"]; ok {
		s, _ := v.(string)
		if s != "system" && s != "catalog" && s != "embedded" && s != "uploaded" && s != "unresolved" {
			return nil, failf("%s.fontStatus is invalid", label)
		}
		style["fontStatus"] = s
	}
	if v, ok := obj["textDecoration"]; ok {
		s, _ := v.(string)
		if s != "none" && s != "underline" {
			return nil, failf("%s.textDecoration is invalid", label)
		}
		style["textDecoration"] = s
	}
	if v, ok := obj["textAlign"]; ok {
		s, _ := v.(string)
		if s != "left" && s != "center" && s != "right" {
			return nil, failf("%s.textAlign is invalid", label)
		}
		style["textAlign"] = s
	}
	if v, ok := obj["verticalAlign"]; ok {
		s, _ := v.(string)
		if s != "top" && s != "middle" && s != "bottom" {
			return nil, failf("%s.verticalAlign is invalid", label)
		}
		style["verticalAlign"] = s
	}
	if v, ok := obj["objectFit"]; ok {
		s, _ := v.(string)
		if s != "contain" && s != "cover" && s != "fill" {
			return nil, failf("%s.objectFit is invalid", label)
		}
		style["objectFit"] = s
	}
	if v, ok := obj["fillColor"]; ok {
		s, ok := v.(string)
		if !ok || (s != "transparent" && !hexColor.MatchString(s)) {
			return nil, failf("%s.fillColor is invalid", label)
		}
		style["fillColor"] = s
	}
	if v, ok := obj["opacity"]; ok {
		n, err := asNumber(v, label+".opacity")
		if err != nil {
			return nil, err
		}
		if n < 0 || n > 1 {
			return nil, failf("%s.opacity must be 0..1", label)
		}
		style["opacity"] = n
	}
	if v, ok := obj["lineHeight"]; ok {
		n, err := asPositive(v, label+".lineHeight")
		if err != nil {
			return nil, err
		}
		style["lineHeight"] = n
	}
	if v, ok := obj["textShadow"]; ok {
		b, ok := v.(bool)
		if !ok {
			return nil, failf("%s.textShadow must be a boolean", label)
		}
		style["textShadow"] = b
	}
	if v, ok := obj["textShadowBlur"]; ok {
		n, err := asNumber(v, label+".textShadowBlur")
		if err != nil {
			return nil, err
		}
		if n < 0 || n > 20 {
			return nil, failf("%s.textShadowBlur must be 0..20", label)
		}
		style["textShadowBlur"] = math.Round(n)
	}
	if v, ok := obj["strokeColor"]; ok {
		s, ok := v.(string)
		if !ok || !hexColor.MatchString(s) {
			return nil, failf("%s.strokeColor is invalid", label)
		}
		style["strokeColor"] = s
	}
	if v, ok := obj["strokeWidth"]; ok {
		n, err := asPositive(v, label+".strokeWidth")
		if err != nil {
			return nil, err
		}
		if n > 50 {
			return nil, failf("%s.strokeWidth exceeds max 50", label)
		}
		style["strokeWidth"] = n
	}
	if len(style) == 0 {
		return nil, nil
	}
	return style, nil
}

func isValidFontWeight(s string) bool {
	switch s {
	case "normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900":
		return true
	default:
		return false
	}
}

func parseElement(raw any, label, repoRoot string) (CanvasElement, error) {
	obj, err := asObject(raw, label)
	if err != nil {
		return CanvasElement{}, err
	}
	if err := rejectUnknown(obj, allowedElementKeys, label); err != nil {
		return CanvasElement{}, err
	}
	typ, _ := obj["type"].(string)
	if typ != "text" && typ != "image" && typ != "image-placeholder" && typ != "shape" && typ != "line" {
		return CanvasElement{}, failf("%s.type is invalid", label)
	}
	id, _ := obj["id"].(string)
	if strings.TrimSpace(id) == "" {
		return CanvasElement{}, failf("%s.id is required", label)
	}
	x, err := asNumber(obj["x"], label+".x")
	if err != nil {
		return CanvasElement{}, err
	}
	y, err := asNumber(obj["y"], label+".y")
	if err != nil {
		return CanvasElement{}, err
	}
	w, err := asPositive(obj["w"], label+".w")
	if err != nil {
		return CanvasElement{}, err
	}
	var h float64
	if typ == "line" {
		h, err = asNonNegative(obj["h"], label+".h")
		if err != nil {
			return CanvasElement{}, err
		}
	} else {
		h, err = asPositive(obj["h"], label+".h")
		if err != nil {
			return CanvasElement{}, err
		}
	}
	z, err := asNonNegInt(obj["zIndex"], label+".zIndex")
	if err != nil {
		return CanvasElement{}, err
	}
	el := CanvasElement{ID: id, Type: typ, X: x, Y: y, W: w, H: h, ZIndex: z}
	if v, ok := obj["required"]; ok {
		b, _ := v.(bool)
		el.Required = b
	}
	if v, ok := obj["content"]; ok {
		s, ok := v.(string)
		if !ok {
			return CanvasElement{}, failf("%s.content must be a string", label)
		}
		el.Content = &s
	}
	if v, ok := obj["wrapLines"]; ok {
		lines, ok := v.([]interface{})
		if !ok {
			return CanvasElement{}, failf("%s.wrapLines must be an array of strings", label)
		}
		strLines := make([]string, 0, len(lines))
		for i, line := range lines {
			s, ok := line.(string)
			if !ok {
				return CanvasElement{}, failf("%s.wrapLines[%d] must be a string", label, i)
			}
			strLines = append(strLines, s)
		}
		if len(strLines) > 0 {
			el.WrapLines = strLines
		}
	}
	hasLongestWordPx := false
	if _, ok := obj["longestWordPx"]; ok {
		hasLongestWordPx = true
	}
	hasMeasuredWith := false
	if _, ok := obj["measuredWith"]; ok {
		hasMeasuredWith = true
	}
	if hasLongestWordPx != hasMeasuredWith {
		return CanvasElement{}, failf("%s: longestWordPx and measuredWith must be provided together", label)
	}
	if hasLongestWordPx && hasMeasuredWith {
		lwp, err := asPositive(obj["longestWordPx"], label+".longestWordPx")
		if err != nil {
			return CanvasElement{}, err
		}
		mwObj, err := asObject(obj["measuredWith"], label+".measuredWith")
		if err != nil {
			return CanvasElement{}, err
		}
		if err := rejectUnknown(mwObj, allowedMeasuredWithKeys, label+".measuredWith"); err != nil {
			return CanvasElement{}, err
		}
		family, _ := mwObj["fontFamily"].(string)
		if strings.TrimSpace(family) == "" {
			return CanvasElement{}, failf("%s.measuredWith.fontFamily is invalid", label)
		}
		size, err := asPositive(mwObj["fontSize"], label+".measuredWith.fontSize")
		if err != nil {
			return CanvasElement{}, err
		}
		weight, ok := mwObj["fontWeight"].(string)
		if !ok {
			return CanvasElement{}, failf("%s.measuredWith.fontWeight must be a string", label)
		}
		styleStr, ok := mwObj["fontStyle"].(string)
		if !ok {
			return CanvasElement{}, failf("%s.measuredWith.fontStyle must be a string", label)
		}
		el.LongestWordPx = &lwp
		el.MeasuredWith = &MeasuredWith{
			FontFamily: family,
			FontSize:   size,
			FontWeight: weight,
			FontStyle:  styleStr,
		}
	}
	if v, ok := obj["placeholderKey"]; ok {
		s, ok := v.(string)
		if !ok || strings.TrimSpace(s) == "" {
			return CanvasElement{}, failf("%s.placeholderKey is invalid", label)
		}
		el.PlaceholderKey = &s
	}
	if v, ok := obj["imageRef"]; ok {
		s, ok := v.(string)
		if !ok || !isRegistryImageRef(s, repoRoot) {
			return CanvasElement{}, failf("%s.imageRef is unsafe or invalid", label)
		}
		el.ImageRef = &s
	}
	style, err := parseStyle(obj["style"], label+".style")
	if err != nil {
		return CanvasElement{}, err
	}
	if len(style) > 0 {
		el.Style = style
	}
	return el, nil
}

func parseLayout(raw any, label, repoRoot string) (Layout, error) {
	obj, err := asObject(raw, label)
	if err != nil {
		return Layout{}, err
	}
	if err := rejectUnknown(obj, allowedLayoutKeys, label); err != nil {
		return Layout{}, err
	}
	if obj["aspectRatio"] != "16:9" {
		return Layout{}, failf("%s.aspectRatio must be 16:9", label)
	}
	bg, _ := obj["backgroundColor"].(string)
	if !hexColor.MatchString(bg) {
		return Layout{}, failf("%s.backgroundColor is invalid", label)
	}
	layout := Layout{AspectRatio: "16:9", BackgroundColor: bg}
	if v, ok := obj["backgroundImage"]; ok {
		s, ok := v.(string)
		if !ok || !isRegistryImageRef(s, repoRoot) {
			return Layout{}, failf("%s.backgroundImage is unsafe or invalid", label)
		}
		layout.BackgroundImage = &s
	}
	rawEls, ok := obj["elements"].([]any)
	if !ok {
		return Layout{}, failf("%s.elements must be an array", label)
	}
	seen := map[string]struct{}{}
	for i, rawEl := range rawEls {
		el, err := parseElement(rawEl, fmt.Sprintf("%s.elements[%d]", label, i), repoRoot)
		if err != nil {
			return Layout{}, err
		}
		if _, dup := seen[el.ID]; dup {
			return Layout{}, failf("Duplicate element id in %s: %s", label, el.ID)
		}
		seen[el.ID] = struct{}{}
		layout.Elements = append(layout.Elements, el)
	}
	return layout, nil
}

func parsePlaceholder(raw any, label string) (Placeholder, error) {
	obj, err := asObject(raw, label)
	if err != nil {
		return Placeholder{}, err
	}
	if err := rejectUnknown(obj, allowedPlaceholderKeys, label); err != nil {
		return Placeholder{}, err
	}
	key, _ := obj["key"].(string)
	if strings.TrimSpace(key) == "" {
		return Placeholder{}, failf("%s.key is required", label)
	}
	typ, _ := obj["type"].(string)
	if typ != "text" && typ != "text[]" && typ != "image" && typ != "image[]" {
		return Placeholder{}, failf("%s has invalid placeholder type", label)
	}
	ph := Placeholder{Key: key, Type: typ}
	if v, ok := obj["required"]; ok {
		b, _ := v.(bool)
		ph.Required = b
	}
	if v, ok := obj["defaultValue"]; ok {
		ph.DefaultValue = v
	}
	return ph, nil
}

// ValidateArtifactTemplate enforces AD-15 on a live write. The error text names
// the property so a rejected Save is about a field, not an unknown template.
func ValidateArtifactTemplate(raw []byte, repoRoot string) ([]byte, error) {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, failf("Invalid JSON")
	}
	obj, err := asObject(v, "template")
	if err != nil {
		return nil, err
	}
	if err := rejectUnknown(obj, allowedTemplateKeys, "template"); err != nil {
		return nil, err
	}
	if !isSchemaVersion1(obj["schemaVersion"]) {
		return nil, failf("schemaVersion must be 1")
	}
	id, _ := obj["id"].(string)
	if !kebabID.MatchString(id) {
		return nil, failf("template.id must be kebab-case")
	}
	label, _ := obj["label"].(string)
	if strings.TrimSpace(label) == "" {
		return nil, failf("template.label is required")
	}
	baseType, _ := obj["baseType"].(string)
	if _, ok := entryKeys[baseType]; !ok {
		return nil, failf("template.baseType is invalid")
	}
	rawPh, ok := obj["placeholders"].([]any)
	if !ok {
		return nil, failf("template.placeholders must be an array")
	}
	var placeholders []Placeholder
	seenKeys := map[string]struct{}{}
	for i, item := range rawPh {
		ph, err := parsePlaceholder(item, fmt.Sprintf("placeholders[%d]", i))
		if err != nil {
			return nil, err
		}
		if _, dup := seenKeys[ph.Key]; dup {
			return nil, failf("Duplicate placeholder key: %s", ph.Key)
		}
		seenKeys[ph.Key] = struct{}{}
		placeholders = append(placeholders, ph)
	}
	if obj["layouts"] == nil {
		return nil, failf("layouts must be an object")
	}
	layoutsRaw, err := asObject(obj["layouts"], "layouts")
	if err != nil {
		return nil, err
	}
	for key := range layoutsRaw {
		if key != "default" && key != "title" && key != "lyric" && key != "verse" && key != "reff" {
			return nil, failf("Unknown layouts field: %s", key)
		}
	}
	layouts := map[string]Layout{}
	for _, name := range []string{"default", "title", "lyric", "verse", "reff"} {
		if rawLayout, ok := layoutsRaw[name]; ok {
			layout, err := parseLayout(rawLayout, "layouts."+name, repoRoot)
			if err != nil {
				return nil, err
			}
			layouts[name] = layout
		}
	}
	switch baseType {
	case "general":
		layout, ok := layouts["default"]
		if !ok {
			return nil, failf("General templates require layouts.default")
		}
		if err := checkLayoutPlaceholders(layout, seenKeys, "layouts.default"); err != nil {
			return nil, err
		}
		for _, ph := range placeholders {
			want, ok := catalogKeys[ph.Key]
			if !ok {
				return nil, failf("placeholder key is not in the catalog: %s", ph.Key)
			}
			if ph.Type != want {
				return nil, failf("placeholder %s must be type %s", ph.Key, want)
			}
		}
	case "song-set":
		title, okT := layouts["title"]
		lyric, okL := layouts["lyric"]
		if !okT || !okL {
			return nil, failf("SongSet requires layouts.title and layouts.lyric")
		}
		hasText := false
		for _, ph := range placeholders {
			if ph.Type == "text" || ph.Type == "text[]" {
				hasText = true
				break
			}
		}
		if !hasText {
			return nil, failf("SongSet requires text placeholders")
		}
		if err := checkLayoutPlaceholders(title, seenKeys, "layouts.title"); err != nil {
			return nil, err
		}
		if err := checkLayoutPlaceholders(lyric, seenKeys, "layouts.lyric"); err != nil {
			return nil, err
		}
	case "announcement":
		layout, ok := layouts["default"]
		if !ok {
			return nil, failf("Announcement requires layouts.default")
		}
		if len(placeholders) != 1 || placeholders[0].Type != "image[]" || !placeholders[0].Required {
			return nil, failf("Announcement requires one required image[] placeholder")
		}
		if err := checkLayoutPlaceholders(layout, seenKeys, "layouts.default"); err != nil {
			return nil, err
		}
	}
	cleaned := Template{
		SchemaVersion: 1,
		ID:            id,
		Label:         label,
		BaseType:      baseType,
		Placeholders:  placeholders,
		Layouts:       layouts,
	}
	out, err := marshalTemplate(cleaned)
	if err != nil {
		return nil, failf("Invalid JSON")
	}
	return out, nil
}

func checkLayoutPlaceholders(layout Layout, keys map[string]struct{}, label string) error {
	for _, el := range layout.Elements {
		if el.PlaceholderKey == nil {
			continue
		}
		if _, ok := keys[*el.PlaceholderKey]; !ok {
			return failf("%s references unknown placeholderKey: %s", label, *el.PlaceholderKey)
		}
	}
	return nil
}

// ExtractInlineTokens returns all unique token names inside content (e.g. "{service_date}" -> ["service_date"]).
func ExtractInlineTokens(content string) []string {
	matches := inlineTokenRegex.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := map[string]struct{}{}
	var out []string
	for _, m := range matches {
		if len(m) > 1 {
			token := m[1]
			if _, ok := seen[token]; !ok {
				seen[token] = struct{}{}
				out = append(out, token)
			}
		}
	}
	return out
}

// FindUnknownPredefinedFieldTokens returns a list of warning messages for unrecognized tokens.
func FindUnknownPredefinedFieldTokens(t Template) []string {
	var warnings []string
	for layoutKey, layout := range t.Layouts {
		for _, el := range layout.Elements {
			if el.Type == "text" && el.Content != nil {
				for _, token := range ExtractInlineTokens(*el.Content) {
					if _, ok := catalogKeys[token]; !ok {
						warnings = append(warnings, fmt.Sprintf("Unknown predefined field token {%s} in layout %q", token, layoutKey))
					}
				}
			} else if (el.Type == "image" || el.Type == "image-placeholder") && el.PlaceholderKey != nil {
				if _, ok := catalogKeys[*el.PlaceholderKey]; !ok {
					warnings = append(warnings, fmt.Sprintf("Unknown predefined field image key %q in layout %q", *el.PlaceholderKey, layoutKey))
				}
			}
		}
	}
	return warnings
}

func isSchemaVersion1(v any) bool {
	switch n := v.(type) {
	case float64:
		return n == 1
	case int:
		return n == 1
	case int64:
		return n == 1
	case json.Number:
		i, err := n.Int64()
		return err == nil && i == 1
	default:
		return false
	}
}

func marshalTemplate(t Template) ([]byte, error) {
	placeholders := make([]any, 0, len(t.Placeholders))
	for _, ph := range t.Placeholders {
		item := map[string]any{"key": ph.Key, "type": ph.Type, "required": ph.Required}
		if ph.DefaultValue != nil {
			item["defaultValue"] = ph.DefaultValue
		}
		placeholders = append(placeholders, item)
	}
	layouts := map[string]any{}
	for name, layout := range t.Layouts {
		layouts[name] = marshalLayout(layout)
	}
	return json.Marshal(map[string]any{
		"schemaVersion": t.SchemaVersion,
		"id":            t.ID,
		"label":         t.Label,
		"baseType":      t.BaseType,
		"placeholders":  placeholders,
		"layouts":       layouts,
	})
}

func marshalLayout(layout Layout) map[string]any {
	elements := make([]any, 0, len(layout.Elements))
	for _, el := range layout.Elements {
		item := map[string]any{
			"id": el.ID, "type": el.Type, "required": el.Required,
			"x": el.X, "y": el.Y, "w": el.W, "h": el.H, "zIndex": el.ZIndex,
		}
		if el.Content != nil {
			item["content"] = *el.Content
		}
		if len(el.WrapLines) > 0 {
			item["wrapLines"] = el.WrapLines
		}
		if el.LongestWordPx != nil {
			item["longestWordPx"] = *el.LongestWordPx
		}
		if el.MeasuredWith != nil {
			item["measuredWith"] = map[string]any{
				"fontFamily": el.MeasuredWith.FontFamily,
				"fontSize":   el.MeasuredWith.FontSize,
				"fontWeight": el.MeasuredWith.FontWeight,
				"fontStyle":  el.MeasuredWith.FontStyle,
			}
		}
		if el.PlaceholderKey != nil {
			item["placeholderKey"] = *el.PlaceholderKey
		}
		if el.ImageRef != nil {
			item["imageRef"] = *el.ImageRef
		}
		if len(el.Style) > 0 {
			item["style"] = el.Style
		}
		elements = append(elements, item)
	}
	out := map[string]any{
		"aspectRatio":     layout.AspectRatio,
		"backgroundColor": layout.BackgroundColor,
		"elements":        elements,
	}
	if layout.BackgroundImage != nil {
		out["backgroundImage"] = *layout.BackgroundImage
	}
	return out
}

// AssertStableAgainstSeed validates structural stability against the seed template.
// Per DEC-014, seeded elements are ordinary editable and deletable elements:
// an administrator may remove, rename, or modify elements that originated in the seed.
// Base type, placeholder keys count, and layout names must remain stable.
// Elements currently marked required in the existing layout cannot be removed.
func AssertStableAgainstSeed(incoming, seed, existing Template) error {
	if incoming.BaseType != seed.BaseType {
		return failf("baseType cannot be changed")
	}
	if len(incoming.Placeholders) != len(seed.Placeholders) {
		return failf("placeholder keys cannot be added or removed")
	}
	seedKeys := map[string]struct{}{}
	for _, ph := range seed.Placeholders {
		seedKeys[ph.Key] = struct{}{}
	}
	for _, ph := range incoming.Placeholders {
		if _, ok := seedKeys[ph.Key]; !ok {
			return failf("missing placeholder key: %s", ph.Key)
		}
	}
	if len(incoming.Layouts) != len(seed.Layouts) {
		return failf("layouts cannot be added or removed")
	}
	for name := range seed.Layouts {
		incomingLayout, ok := incoming.Layouts[name]
		if !ok {
			return failf("missing layout: %s", name)
		}
		incomingByID := map[string]CanvasElement{}
		for _, el := range incomingLayout.Elements {
			if strings.TrimSpace(el.ID) == "" {
				return failf("element id is required in layout %s", name)
			}
			if _, dup := incomingByID[el.ID]; dup {
				return failf("duplicate element id %s in layout %s", el.ID, name)
			}
			incomingByID[el.ID] = el
		}
		existingByID := map[string]CanvasElement{}
		if existingLayout, ok := existing.Layouts[name]; ok {
			for _, el := range existingLayout.Elements {
				existingByID[el.ID] = el
			}
		}
		for _, existingEl := range existingByID {
			if !existingEl.Required {
				continue
			}
			if _, ok := incomingByID[existingEl.ID]; !ok {
				return failf("element %s is required and cannot be removed in layout %s", existingEl.ID, name)
			}
		}
	}
	return nil
}
