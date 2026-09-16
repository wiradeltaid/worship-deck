package pptximport

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/wiradeltaid/worship-presenter-web/internal/plan"
)

// BuildTemplatePayload converts a ParsedSlide into valid artifact template JSON bytes
func BuildTemplatePayload(id, label string, slide *ParsedSlide, imageURLMap map[string]string, repoRoot string) ([]byte, error) {
	bgColor := slide.BackgroundColor
	if !hexColorRegex.MatchString(strings.TrimPrefix(bgColor, "#")) {
		bgColor = "#000000"
	}
	if !strings.HasPrefix(bgColor, "#") {
		bgColor = "#" + bgColor
	}

	var bgImage *string
	if slide.BackgroundImage != nil {
		if u, ok := imageURLMap[slide.BackgroundImage.PartPath]; ok && u != "" {
			bgImage = &u
		}
	}

	elements := make([]map[string]any, 0, len(slide.Elements))
	for _, el := range slide.Elements {
		elObj := map[string]any{
			"id":       el.ID,
			"type":     el.Type,
			"required": false,
			"x":        el.X,
			"y":        el.Y,
			"w":        el.W,
			"h":        el.H,
			"zIndex":   el.ZIndex,
		}

		if el.Type == "text" && el.Content != nil {
			elObj["content"] = *el.Content
		}

		if el.Type == "image" && el.Image != nil {
			if u, ok := imageURLMap[el.Image.PartPath]; ok && u != "" {
				elObj["imageRef"] = u
			}
		}

		if len(el.Style) > 0 {
			elObj["style"] = el.Style
		}

		elements = append(elements, elObj)
	}

	layoutObj := map[string]any{
		"aspectRatio":     "16:9",
		"backgroundColor": bgColor,
		"elements":        elements,
	}
	if bgImage != nil {
		layoutObj["backgroundImage"] = *bgImage
	}

	tplObj := map[string]any{
		"schemaVersion": 1,
		"id":            id,
		"label":         label,
		"baseType":      "general",
		"placeholders":  []any{},
		"layouts": map[string]any{
			"default": layoutObj,
		},
	}

	raw, err := json.Marshal(tplObj)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal template: %w", err)
	}

	// Validate through shared schema validator
	if _, err := plan.ValidateArtifactTemplate(raw, repoRoot); err != nil {
		return nil, fmt.Errorf("template validation failed: %w", err)
	}

	return raw, nil
}
