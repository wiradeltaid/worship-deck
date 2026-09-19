package plan

import (
	"strings"
	"testing"
)

func TestHydrateArtifact_DynamicPredefinedTokensAndContractS5(t *testing.T) {
	tmpl := Template{
		SchemaVersion: 1,
		ID:            "test-dynamic-template",
		Label:         "Test Dynamic Template",
		BaseType:      "general",
		Layouts: map[string]Layout{
			"default": {
				AspectRatio:     "16:9",
				BackgroundColor: "#000000",
				Elements: []CanvasElement{
					{
						ID:      "el-text-custom",
						Type:    "text",
						ZIndex:  1,
						Content: strPtr("Mission Speaker: {mission_speaker}"),
					},
					{
						ID:      "el-text-unknown",
						Type:    "text",
						ZIndex:  2,
						Content: strPtr("Greeting: {unregistered_token}"),
					},
					{
						ID:             "el-img-custom",
						Type:           "image",
						ZIndex:         3,
						PlaceholderKey: strPtr("mission_poster"),
					},
					{
						ID:       "el-img-src-token",
						Type:     "image",
						ZIndex:   4,
						ImageRef: strPtr("https://cdn.example.com/{banner_image}"),
					},
				},
			},
		},
	}

	values := map[string]interface{}{
		"mission_speaker": "Pastor Dynamic",
		"mission_poster":  "https://example.com/poster.jpg",
		"banner_image":    "weekly-banner.png",
		// unregistered_token is omitted
	}

	instance, err := hydrateArtifact(tmpl, "inst-1", "default", values, nil)
	if err != nil {
		t.Fatalf("hydrateArtifact error: %v", err)
	}

	if len(instance.Layout.Elements) != 4 {
		t.Fatalf("expected 4 resolved elements, got %d", len(instance.Layout.Elements))
	}

	// 1. Text substitution
	el1 := instance.Layout.Elements[0]
	if el1.Text == nil || *el1.Text != "Mission Speaker: Pastor Dynamic" {
		t.Errorf("expected substituted text 'Mission Speaker: Pastor Dynamic', got %v", el1.Text)
	}

	// 2. Unregistered token renders empty without crashing (DEC-004 S5)
	el2 := instance.Layout.Elements[1]
	if el2.Text == nil || *el2.Text != "Greeting: " {
		t.Errorf("expected 'Greeting: ', got %v", el2.Text)
	}

	// 3. Dynamic image via PlaceholderKey
	el3 := instance.Layout.Elements[2]
	if el3.ImageURL == nil || *el3.ImageURL != "https://example.com/poster.jpg" {
		t.Errorf("expected ImageURL 'https://example.com/poster.jpg', got %v", el3.ImageURL)
	}

	// 4. Dynamic image via token in ImageRef
	el4 := instance.Layout.Elements[3]
	if el4.ImageURL == nil || *el4.ImageURL != "https://cdn.example.com/weekly-banner.png" {
		t.Errorf("expected ImageURL 'https://cdn.example.com/weekly-banner.png', got %v", el4.ImageURL)
	}
}

func TestHydrateArtifact_RequiredPlaceholderError(t *testing.T) {
	tmpl := Template{
		SchemaVersion: 1,
		ID:            "test-req-template",
		Label:         "Test Required Template",
		BaseType:      "general",
		Placeholders: []Placeholder{
			{Key: "required_field", Type: "text", Required: true},
		},
		Layouts: map[string]Layout{
			"default": {
				AspectRatio:     "16:9",
				BackgroundColor: "#000000",
				Elements: []CanvasElement{
					{
						ID:             "el-req",
						Type:           "text",
						ZIndex:         1,
						Required:       true,
						PlaceholderKey: strPtr("required_field"),
					},
				},
			},
		},
	}

	values := map[string]interface{}{}
	_, err := hydrateArtifact(tmpl, "inst-2", "default", values, nil)
	if err == nil {
		t.Fatalf("expected error for missing required placeholder, got nil")
	}
	if !strings.Contains(err.Error(), "missing required placeholder") {
		t.Errorf("expected error to mention 'missing required placeholder', got: %v", err)
	}
}

func TestCatalogTokenRegistration(t *testing.T) {
	RegisterCatalogToken("special_mission", "text")
	if !IsValidCatalogToken("special_mission") {
		t.Errorf("expected special_mission to be recognized as valid catalog token")
	}
}
