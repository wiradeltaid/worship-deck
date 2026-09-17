package plan

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	dir := wd
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "data", "default-registry.json")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatal("repo root not found")
	return ""
}

func TestValidateArtifactTemplateNamesProperty(t *testing.T) {
	root := repoRoot(t)
	raw, err := os.ReadFile(filepath.Join(root, "data", "default-registry.json"))
	if err != nil {
		t.Fatal(err)
	}
	var list []map[string]any
	if err := json.Unmarshal(raw, &list); err != nil {
		t.Fatal(err)
	}
	var welcome map[string]any
	for _, tmpl := range list {
		if id, _ := tmpl["id"].(string); id == "welcome" {
			welcome = tmpl
			break
		}
	}
	if welcome == nil {
		t.Fatal("no welcome")
	}
	_, err = ValidateArtifactTemplate(mustJSON(welcome), root)
	if err != nil {
		t.Fatalf("seed welcome must validate: %v", err)
	}

	welcome["extraField"] = true
	_, err = ValidateArtifactTemplate(mustJSON(welcome), root)
	if err == nil || !strings.Contains(err.Error(), "Unknown field: template.extraField") {
		t.Fatalf("unknown field: %v", err)
	}
	delete(welcome, "extraField")

	layouts, _ := welcome["layouts"].(map[string]any)
	def, _ := layouts["default"].(map[string]any)
	els, _ := def["elements"].([]any)
	first, _ := els[0].(map[string]any)
	style, _ := first["style"].(map[string]any)
	style["fontSize"] = 0.0
	_, err = ValidateArtifactTemplate(mustJSON(welcome), root)
	if err == nil || !strings.Contains(err.Error(), "layouts.default.elements[0].style.fontSize must be positive") {
		t.Fatalf("fontSize: %v", err)
	}
}

func TestValidateArtifactTemplateCatalogKey(t *testing.T) {
	root := repoRoot(t)
	payload := map[string]any{
		"schemaVersion": 1,
		"id":            "custom-board",
		"label":         "Board",
		"baseType":      "general",
		"placeholders": []any{
			map[string]any{"key": "inventedWeekly", "type": "text", "required": false},
		},
		"layouts": map[string]any{
			"default": map[string]any{
				"aspectRatio":     "16:9",
				"backgroundColor": "#000000",
				"elements":        []any{},
			},
		},
	}
	_, err := ValidateArtifactTemplate(mustJSON(payload), root)
	if err == nil || !strings.Contains(err.Error(), "placeholder key is not in the catalog: inventedWeekly") {
		t.Fatalf("catalog: %v", err)
	}

	validPayload := map[string]any{
		"schemaVersion": 1,
		"id":            "custom-s1-keys",
		"label":         "S1 Keys",
		"baseType":      "general",
		"placeholders": []any{
			map[string]any{"key": "youth_name", "type": "text", "required": false},
			map[string]any{"key": "scripture_bible_version", "type": "text", "required": false},
		},
		"layouts": map[string]any{
			"default": map[string]any{
				"aspectRatio":     "16:9",
				"backgroundColor": "#000000",
				"elements": []any{
					map[string]any{
						"id":     "t1",
						"type":   "text",
						"x":      10.0,
						"y":      10.0,
						"w":      100.0,
						"h":      50.0,
						"zIndex": 1,
						"content": "Youth: {youth_name}, Ver: {scripture_bible_version}",
					},
				},
			},
		},
	}
	_, err = ValidateArtifactTemplate(mustJSON(validPayload), root)
	if err != nil {
		t.Fatalf("validPayload with S1 keys must pass validation: %v", err)
	}
}

func TestAuthoredGeneralAppearsInPlan(t *testing.T) {
	empty := Layout{AspectRatio: "16:9", BackgroundColor: "#000000"}
	snap := Snapshot{
		Order: []string{"custom-board"},
		ByID: map[string]Template{
			"custom-board": {
				ID:       "custom-board",
				Label:    "Board",
				BaseType: "general",
				Layouts:  map[string]Layout{"default": empty},
			},
		},
	}
	items, err := BuildSlidePlan("2026-07-11", ParsedRundown{}, Media{}, snap)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Artifact.TemplateID != "custom-board" {
		t.Fatalf("authored general missing from plan: %#v", items)
	}
}

func TestLineHeightAndTextShadowValidation(t *testing.T) {
	root := repoRoot(t)
	template := map[string]any{
		"schemaVersion": 1,
		"id":            "test-line-height-shadow",
		"label":         "Test",
		"baseType":      "general",
		"placeholders":  []any{},
		"layouts": map[string]any{
			"default": map[string]any{
				"aspectRatio":     "16:9",
				"backgroundColor": "#000000",
				"elements": []any{
					map[string]any{
						"id":     "e1",
						"type":   "text",
						"x":      10.0,
						"y":      10.0,
						"w":      80.0,
						"h":      30.0,
						"zIndex": 0,
						"style": map[string]any{
							"fontSize":   32.0,
							"lineHeight": 1.4,
							"textShadow": true,
						},
					},
				},
			},
		},
	}

	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err != nil {
		t.Fatalf("template with lineHeight and textShadow must pass validation: %v", err)
	}

	elements := template["layouts"].(map[string]any)["default"].(map[string]any)["elements"].([]any)
	el := elements[0].(map[string]any)
	el["style"] = map[string]any{"fontSize": 32.0, "lineHeight": -1.0}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil {
		t.Fatalf("expected error on negative lineHeight")
	}

	el["style"] = map[string]any{"fontSize": 32.0, "textShadow": "invalid"}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil {
		t.Fatalf("expected error on non-boolean textShadow")
	}

	for _, validBlur := range []float64{0, 4, 15, 20} {
		el["style"] = map[string]any{"fontSize": 32.0, "textShadow": true, "textShadowBlur": validBlur}
		if _, err := ValidateArtifactTemplate(mustJSON(template), root); err != nil {
			t.Fatalf("expected valid blur %v to pass, got: %v", validBlur, err)
		}
	}

	el["style"] = map[string]any{"fontSize": 32.0, "textShadow": true, "textShadowBlur": -1.0}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil {
		t.Fatalf("expected error on negative textShadowBlur")
	}

	el["style"] = map[string]any{"fontSize": 32.0, "textShadow": true, "textShadowBlur": 21.0}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil {
		t.Fatalf("expected error on textShadowBlur > 20")
	}

	el["style"] = map[string]any{"fontSize": 32.0, "textShadow": true, "textShadowBlur": "invalid"}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil {
		t.Fatalf("expected error on non-number textShadowBlur")
	}
}

func TestLongestWordPxAndMeasuredWithValidation(t *testing.T) {
	root := repoRoot(t)
	template := map[string]any{
		"schemaVersion": 1,
		"id":            "test-longest-word-stamp",
		"label":         "Test",
		"baseType":      "general",
		"placeholders":  []any{},
		"layouts": map[string]any{
			"default": map[string]any{
				"aspectRatio":     "16:9",
				"backgroundColor": "#000000",
				"elements": []any{
					map[string]any{
						"id":      "e1",
						"type":    "text",
						"x":       10.0,
						"y":       10.0,
						"w":       80.0,
						"h":       30.0,
						"zIndex":  0,
						"content": "Sample text",
						"style": map[string]any{
							"fontSize":   32.0,
							"fontFamily": "Arial",
						},
					},
				},
			},
		},
	}

	// 1. Both absent passes
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err != nil {
		t.Fatalf("element without measurement must pass: %v", err)
	}

	elements := template["layouts"].(map[string]any)["default"].(map[string]any)["elements"].([]any)
	el := elements[0].(map[string]any)

	// 2. Orphan longestWordPx fails
	el["longestWordPx"] = 450.0
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil || !strings.Contains(err.Error(), "longestWordPx and measuredWith must be provided together") {
		t.Fatalf("expected error on orphan longestWordPx, got: %v", err)
	}

	// 3. Orphan measuredWith fails
	delete(el, "longestWordPx")
	el["measuredWith"] = map[string]any{
		"fontFamily": "Arial",
		"fontSize":   32.0,
		"fontWeight": "normal",
		"fontStyle":  "normal",
	}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil || !strings.Contains(err.Error(), "longestWordPx and measuredWith must be provided together") {
		t.Fatalf("expected error on orphan measuredWith, got: %v", err)
	}

	// 4. Both present and valid passes
	el["longestWordPx"] = 450.0
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err != nil {
		t.Fatalf("valid pair must pass: %v", err)
	}

	// 5. Invalid measuredWith field fails
	el["measuredWith"] = map[string]any{
		"fontFamily": "",
		"fontSize":   32.0,
		"fontWeight": "normal",
		"fontStyle":  "normal",
	}
	if _, err := ValidateArtifactTemplate(mustJSON(template), root); err == nil {
		t.Fatalf("expected error on empty fontFamily")
	}
}

func TestLineAndOutlineShapeValidation(t *testing.T) {
	root := repoRoot(t)
	base := map[string]any{
		"schemaVersion": 1,
		"id":            "test-line-shape-schema",
		"label":         "Test Line & Shape",
		"baseType":      "general",
		"placeholders":  []any{},
		"layouts": map[string]any{
			"default": map[string]any{
				"aspectRatio":     "16:9",
				"backgroundColor": "#000000",
				"elements": []any{
					map[string]any{
						"id":     "line-1",
						"type":   "line",
						"x":      10.0,
						"y":      20.0,
						"w":      80.0,
						"h":      0.0,
						"zIndex": 1,
						"style": map[string]any{
							"strokeColor": "#FFFFFF",
							"strokeWidth": 2.0,
						},
					},
					map[string]any{
						"id":     "outline-1",
						"type":   "shape",
						"x":      15.0,
						"y":      25.0,
						"w":      70.0,
						"h":      50.0,
						"zIndex": 2,
						"style": map[string]any{
							"fillColor":   "transparent",
							"strokeColor": "#FF5500",
							"strokeWidth": 4.0,
							"opacity":     0.9,
						},
					},
				},
			},
		},
	}

	// 1. Valid line (h=0) and outline shape (fill=transparent) passes
	tmplBytes, err := ValidateArtifactTemplate(mustJSON(base), root)
	if err != nil {
		t.Fatalf("valid line and outline shape must pass: %v", err)
	}
	var tmpl Template
	if err := json.Unmarshal(tmplBytes, &tmpl); err != nil {
		t.Fatalf("unmarshal validated template: %v", err)
	}
	if len(tmpl.Layouts["default"].Elements) != 2 {
		t.Fatalf("expected 2 elements, got %d", len(tmpl.Layouts["default"].Elements))
	}
	if tmpl.Layouts["default"].Elements[0].H != 0.0 {
		t.Fatalf("expected line H to be 0, got %f", tmpl.Layouts["default"].Elements[0].H)
	}

	// 2. Negative height on line must fail
	layouts := base["layouts"].(map[string]any)
	defaultLayout := layouts["default"].(map[string]any)
	elements := defaultLayout["elements"].([]any)
	lineEl := elements[0].(map[string]any)
	lineEl["h"] = -1.0
	if _, err := ValidateArtifactTemplate(mustJSON(base), root); err == nil || !strings.Contains(err.Error(), "must be non-negative") {
		t.Fatalf("expected non-negative error for line h=-1, got: %v", err)
	}
	lineEl["h"] = 0.0

	// 3. Zero height on shape must fail (requires positive)
	shapeEl := elements[1].(map[string]any)
	shapeEl["h"] = 0.0
	if _, err := ValidateArtifactTemplate(mustJSON(base), root); err == nil || !strings.Contains(err.Error(), "must be positive") {
		t.Fatalf("expected positive error for shape h=0, got: %v", err)
	}
	shapeEl["h"] = 50.0

	// 4. Invalid strokeColor (non-hex) must fail
	lineStyle := lineEl["style"].(map[string]any)
	lineStyle["strokeColor"] = "red"
	if _, err := ValidateArtifactTemplate(mustJSON(base), root); err == nil || !strings.Contains(err.Error(), "strokeColor is invalid") {
		t.Fatalf("expected strokeColor invalid error, got: %v", err)
	}
	lineStyle["strokeColor"] = "#FFFFFF"

	// 5. StrokeWidth > 50 must fail
	lineStyle["strokeWidth"] = 55.0
	if _, err := ValidateArtifactTemplate(mustJSON(base), root); err == nil || !strings.Contains(err.Error(), "strokeWidth exceeds max 50") {
		t.Fatalf("expected strokeWidth exceeds max error, got: %v", err)
	}

	// 6. Negative strokeWidth must fail
	lineStyle["strokeWidth"] = -2.0
	if _, err := ValidateArtifactTemplate(mustJSON(base), root); err == nil || !strings.Contains(err.Error(), "must be positive") {
		t.Fatalf("expected positive error for negative strokeWidth, got: %v", err)
	}
	lineStyle["strokeWidth"] = 2.0
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
