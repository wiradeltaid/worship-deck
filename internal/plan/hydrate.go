package plan

import (
	"fmt"
	"sort"
	"strings"
)

const runtimeVersion = 1

type resolution struct {
	present bool
	value   string
}

func firstImageRef(entries []string) resolution {
	for _, e := range entries {
		if strings.TrimSpace(e) != "" {
			return resolution{true, e}
		}
	}
	return resolution{}
}

func asStringSlice(v interface{}) ([]string, bool) {
	switch t := v.(type) {
	case []string:
		return t, true
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, x := range t {
			s, ok := x.(string)
			if !ok {
				return nil, false
			}
			out = append(out, s)
		}
		return out, true
	default:
		return nil, false
	}
}

func resolvePlaceholderValue(def Placeholder, raw interface{}) resolution {
	candidate := raw
	if candidate == nil {
		candidate = def.DefaultValue
	}
	if candidate == nil {
		return resolution{}
	}
	isImage := def.Type == "image" || def.Type == "image[]"
	if arr, ok := asStringSlice(candidate); ok {
		if len(arr) == 0 {
			return resolution{}
		}
		if isImage {
			return firstImageRef(arr)
		}
		return resolution{true, strings.Join(arr, "\n")}
	}
	s, ok := candidate.(string)
	if !ok {
		return resolution{}
	}
	if isImage {
		if strings.TrimSpace(s) == "" {
			return resolution{}
		}
		return resolution{true, s}
	}
	return resolution{true, s}
}

func sortElements(elements []CanvasElement) []CanvasElement {
	indexed := make([]CanvasElement, len(elements))
	copy(indexed, elements)
	sort.SliceStable(indexed, func(i, j int) bool {
		return indexed[i].ZIndex < indexed[j].ZIndex
	})
	return indexed
}

func strPtr(s string) *string { return &s }

func substituteTokens(content string, values map[string]interface{}) string {
	return inlineTokenRegex.ReplaceAllStringFunc(content, func(m string) string {
		sub := inlineTokenRegex.FindStringSubmatch(m)
		if len(sub) < 2 {
			return ""
		}
		token := sub[1]
		val, ok := values[token]
		if !ok || val == nil {
			return ""
		}
		if arr, ok := asStringSlice(val); ok {
			return strings.Join(arr, "\n")
		}
		if s, ok := val.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", val)
	})
}

func hydrateArtifact(template Template, instanceID, layoutKey string, values map[string]interface{}, group *GroupRef) (ArtifactInstance, error) {
	if layoutKey == "" {
		layoutKey = "default"
	}
	layout, ok := template.Layouts[layoutKey]
	if !ok {
		return ArtifactInstance{}, fmt.Errorf("unknown layout %s on %s", layoutKey, template.ID)
	}
	defs := map[string]Placeholder{}
	for _, p := range template.Placeholders {
		defs[p.Key] = p
	}
	if values == nil {
		values = map[string]interface{}{}
	}
	effectiveValues := map[string]interface{}{}
	for k, v := range values {
		effectiveValues[k] = v
	}
	for _, p := range template.Placeholders {
		if _, ok := effectiveValues[p.Key]; !ok && p.DefaultValue != nil {
			effectiveValues[p.Key] = p.DefaultValue
		}
	}
	elements := make([]ResolvedElement, 0, len(layout.Elements))
	for _, element := range sortElements(layout.Elements) {
		style := element.Style
		if style == nil {
			style = map[string]interface{}{}
		}
		resolved := ResolvedElement{
			ID:            element.ID,
			Type:          element.Type,
			X:             element.X,
			Y:             element.Y,
			W:             element.W,
			H:             element.H,
			ZIndex:        element.ZIndex,
			WrapLines:     element.WrapLines,
			LongestWordPx: element.LongestWordPx,
			MeasuredWith:  element.MeasuredWith,
			Rotation:      element.Rotation,
			Style:         style,
		}
		if element.PlaceholderKey == nil || *element.PlaceholderKey == "" {
			if element.Type == "text" && element.Content != nil {
				tokens := ExtractInlineTokens(*element.Content)
				substituted := substituteTokens(*element.Content, effectiveValues)
				if len(tokens) > 0 {
					isSolelyToken := len(tokens) == 1 && strings.TrimSpace(*element.Content) == "{"+tokens[0]+"}"
					if isSolelyToken && strings.TrimSpace(substituted) == "" {
						_, isDeclaredPlaceholder := defs[tokens[0]]
						if element.Required && isDeclaredPlaceholder {
							return ArtifactInstance{}, fmt.Errorf("missing required placeholder %s", tokens[0])
						}
						continue
					}
					resolved.Text = &substituted
					if isSolelyToken {
						resolved.PlaceholderKey = strPtr(tokens[0])
						resolved.WrapLines = nil
						resolved.LongestWordPx = nil
						resolved.MeasuredWith = nil
					}
				} else {
					resolved.Text = element.Content
				}
			} else if (element.Type == "image" || element.Type == "image-placeholder") && element.ImageRef != nil {
				subImg := substituteTokens(*element.ImageRef, effectiveValues)
				if strings.TrimSpace(subImg) != "" && !strings.Contains(subImg, "{") {
					resolved.ImageURL = &subImg
				} else {
					resolved.ImageURL = nil
				}
			}
			elements = append(elements, resolved)
			continue
		}
		def, ok := defs[*element.PlaceholderKey]
		if !ok {
			// Dynamic predefined field token resolution (SPEC-46 / DEC-004 S5)
			if rawVal, hasVal := effectiveValues[*element.PlaceholderKey]; hasVal && rawVal != nil {
				valStr := fmt.Sprintf("%v", rawVal)
				if strArr, isArr := asStringSlice(rawVal); isArr {
					valStr = strings.Join(strArr, "\n")
				}
				if strings.TrimSpace(valStr) != "" {
					resolved.PlaceholderKey = strPtr(*element.PlaceholderKey)
					if element.Type == "text" {
						resolved.Text = strPtr(valStr)
					} else if element.Type == "image" || element.Type == "image-placeholder" {
						resolved.ImageURL = strPtr(valStr)
					}
					elements = append(elements, resolved)
					continue
				}
			}
			// DEC-004 S5: unknown or unregistered tokens render empty without blocking generation
			continue
		}
		value := resolvePlaceholderValue(def, effectiveValues[def.Key])
		if !value.present {
			if element.Required {
				return ArtifactInstance{}, fmt.Errorf("missing required placeholder %s", def.Key)
			}
			continue
		}
		resolved.PlaceholderKey = strPtr(def.Key)
		resolved.WrapLines = nil
		resolved.LongestWordPx = nil
		resolved.MeasuredWith = nil
		if element.Type == "text" {
			resolved.Text = strPtr(value.value)
		} else if element.Type == "image" || element.Type == "image-placeholder" {
			resolved.ImageURL = strPtr(value.value)
		}
		elements = append(elements, resolved)
	}
	inst := ArtifactInstance{
		RuntimeVersion: runtimeVersion,
		InstanceID:     instanceID,
		TemplateID:     template.ID,
		Label:          template.Label,
		BaseType:       template.BaseType,
		LayoutKey:      layoutKey,
		Layout: ResolvedLayout{
			AspectRatio:     layout.AspectRatio,
			BackgroundColor: layout.BackgroundColor,
			BackgroundImage: layout.BackgroundImage,
			Elements:        elements,
		},
		Group: group,
	}
	return inst, nil
}

func findResolvedText(instance ArtifactInstance, placeholderKey string) string {
	for _, el := range instance.Layout.Elements {
		if el.PlaceholderKey != nil && *el.PlaceholderKey == placeholderKey && el.Text != nil {
			return *el.Text
		}
	}
	return ""
}

func derivedLines(instance ArtifactInstance, title string) []string {
	type box struct {
		x, y float64
		text string
	}
	var boxes []box
	for _, el := range instance.Layout.Elements {
		if el.Type == "text" && el.Text != nil {
			boxes = append(boxes, box{el.X, el.Y, *el.Text})
		}
	}
	sort.SliceStable(boxes, func(i, j int) bool {
		if boxes[i].y != boxes[j].y {
			return boxes[i].y < boxes[j].y
		}
		return boxes[i].x < boxes[j].x
	})
	normalized := strings.TrimSpace(title)
	var lines []string
	for _, b := range boxes {
		for _, line := range strings.Split(b.text, "\n") {
			line = strings.TrimSpace(line)
			if line != "" && line != normalized {
				lines = append(lines, line)
			}
		}
	}
	return lines
}
