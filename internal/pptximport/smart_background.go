package pptximport

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"path"
	"regexp"
	"strings"
)

var hexColorRegex = regexp.MustCompile(`^[0-9A-Fa-f]{6}$`)

type RawShapeNode struct {
	Tag     string // "sp" or "pic"
	Shape   *XMLShape
	Picture *XMLPicture
	ZIndex  int
}

// parseShapeTreeSequentially parses p:spTree children in exact document order
func parseShapeTreeSequentially(decoder *xml.Decoder) ([]RawShapeNode, []string, error) {
	var nodes []RawShapeNode
	var warnings []string
	zIndex := 0

	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, warnings, err
		}

		switch se := tok.(type) {
		case xml.StartElement:
			local := se.Name.Local
			switch local {
			case "sp":
				var sp XMLShape
				if err := decoder.DecodeElement(&sp, &se); err != nil {
					return nil, warnings, err
				}
				nodes = append(nodes, RawShapeNode{
					Tag:    "sp",
					Shape:  &sp,
					ZIndex: zIndex,
				})
				zIndex++
			case "pic":
				var pic XMLPicture
				if err := decoder.DecodeElement(&pic, &se); err != nil {
					return nil, warnings, err
				}
				nodes = append(nodes, RawShapeNode{
					Tag:     "pic",
					Picture: &pic,
					ZIndex:  zIndex,
				})
				zIndex++
			case "grpSp":
				warnings = append(warnings, "Group shapes (p:grpSp) are unsupported in initial import and were omitted")
				if err := decoder.Skip(); err != nil {
					return nil, warnings, err
				}
			case "graphicFrame":
				warnings = append(warnings, "Graphic frames (tables/charts/SmartArt) are unsupported in initial import and were omitted")
				if err := decoder.Skip(); err != nil {
					return nil, warnings, err
				}
			default:
				// Skip non-shape elements like nvGrpSpPr, grpSpPr
			}
		}
	}

	return nodes, warnings, nil
}

func parseSlide(pr *PackageReader, slidePartPath string, slideNum int, slideWidthEMU, slideHeightEMU int64) (*ParsedSlide, error) {
	slideBytes, err := pr.ReadEntry(slidePartPath)
	if err != nil {
		return nil, err
	}

	var slide XMLSlide
	if err := xml.Unmarshal(slideBytes, &slide); err != nil {
		return nil, fmt.Errorf("failed to parse slide XML: %w", err)
	}

	slideRels, err := pr.ReadRelationships(slidePartPath)
	if err != nil {
		return nil, err
	}

	parsed := &ParsedSlide{
		SlideNumber:     slideNum,
		Name:            fmt.Sprintf("Slide %d", slideNum),
		BackgroundColor: "#000000",
		Elements:        make([]ParsedElement, 0),
		Warnings:        make([]string, 0),
	}

	// Rule 1: Native slide background
	hasNativeBg := false
	if slide.CSld.Bg != nil && slide.CSld.Bg.BgPr != nil {
		bgPr := slide.CSld.Bg.BgPr
		if bgPr.BlipFill != nil && bgPr.BlipFill.Blip.Embed != "" {
			relID := bgPr.BlipFill.Blip.Embed
			if rel, ok := slideRels[relID]; ok {
				imgPath, err := ResolveSafeTarget(path.Dir(slidePartPath), rel.Target, "ppt/media/")
				if err == nil {
					img, err := pr.ExtractImage(imgPath)
					if err == nil {
						parsed.BackgroundImage = img
						hasNativeBg = true
					} else {
						parsed.Warnings = append(parsed.Warnings, fmt.Sprintf("failed to extract native slide background image %s: %v", imgPath, err))
					}
				}
			}
		}
		if !hasNativeBg && bgPr.SolidFill != nil && bgPr.SolidFill.SrgbClr != nil && hexColorRegex.MatchString(bgPr.SolidFill.SrgbClr.Val) {
			parsed.BackgroundColor = "#" + strings.ToUpper(bgPr.SolidFill.SrgbClr.Val)
			hasNativeBg = true
		}
	}

	// Rule 1 Fallback: Native slide layout background
	if !hasNativeBg {
		var layoutRelPath string
		for _, rel := range slideRels {
			if strings.HasSuffix(rel.Type, "/slideLayout") {
				target, err := ResolveSafeTarget(path.Dir(slidePartPath), rel.Target, "ppt/slideLayouts/")
				if err == nil {
					layoutRelPath = target
				}
				break
			}
		}

		if layoutRelPath != "" {
			var layout XMLSlideLayout
			if err := pr.ParseXML(layoutRelPath, &layout); err == nil {
				layoutRels, _ := pr.ReadRelationships(layoutRelPath)
				if layout.CSld.Bg != nil && layout.CSld.Bg.BgPr != nil {
					bgPr := layout.CSld.Bg.BgPr
					if bgPr.BlipFill != nil && bgPr.BlipFill.Blip.Embed != "" {
						relID := bgPr.BlipFill.Blip.Embed
						if rel, ok := layoutRels[relID]; ok {
							imgPath, err := ResolveSafeTarget(path.Dir(layoutRelPath), rel.Target, "ppt/media/")
							if err == nil {
								img, err := pr.ExtractImage(imgPath)
								if err == nil {
									parsed.BackgroundImage = img
									hasNativeBg = true
								}
							}
						}
					}
					if !hasNativeBg && bgPr.SolidFill != nil && bgPr.SolidFill.SrgbClr != nil && hexColorRegex.MatchString(bgPr.SolidFill.SrgbClr.Val) {
						parsed.BackgroundColor = "#" + strings.ToUpper(bgPr.SolidFill.SrgbClr.Val)
						hasNativeBg = true
					}
				}
			}
		}
	}

	// Parse shape tree sequentially to preserve exact z-index order
	spTreeBytes := extractSpTreeXML(slideBytes)
	nodes, warnings, err := parseShapeTreeSequentially(xml.NewDecoder(bytes.NewReader(spTreeBytes)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse shape tree: %w", err)
	}
	parsed.Warnings = append(parsed.Warnings, warnings...)

	// Rule 2: Bottom-most full-covering image detection (only if no native background found)
	omittedNodeIdx := -1
	if !hasNativeBg && len(nodes) > 0 {
		first := nodes[0]
		isCandidate := false
		var embedRelID string
		var xfrm *XMLTransform2D
		hasText := false

		if first.Tag == "pic" && first.Picture != nil {
			embedRelID = first.Picture.BlipFill.Blip.Embed
			xfrm = first.Picture.SpPr.Xfrm
			isCandidate = embedRelID != "" && xfrm != nil
		} else if first.Tag == "sp" && first.Shape != nil {
			if first.Shape.SpPr.BlipFill != nil && first.Shape.SpPr.BlipFill.Blip.Embed != "" {
				embedRelID = first.Shape.SpPr.BlipFill.Blip.Embed
				xfrm = first.Shape.SpPr.Xfrm
				isCandidate = xfrm != nil
				// Check if shape contains foreground text
				if first.Shape.TxBody != nil {
					extractedText := extractTextFromTxBody(first.Shape.TxBody)
					if strings.TrimSpace(extractedText) != "" {
						hasText = true
					}
				}
			}
		}

		if isCandidate && !hasText && xfrm != nil {
			xPct := calcPct(xfrm.Off.X, slideWidthEMU)
			yPct := calcPct(xfrm.Off.Y, slideHeightEMU)
			wPct := calcPct(xfrm.Ext.CX, slideWidthEMU)
			hPct := calcPct(xfrm.Ext.CY, slideHeightEMU)

			// Check 5% edge threshold: x <= 5%, y <= 5%, x+w >= 95%, y+h >= 95%
			if xPct <= 5.0 && yPct <= 5.0 && (xPct+wPct) >= 95.0 && (yPct+hPct) >= 95.0 {
				if rel, ok := slideRels[embedRelID]; ok {
					imgPath, err := ResolveSafeTarget(path.Dir(slidePartPath), rel.Target, "ppt/media/")
					if err == nil {
						img, err := pr.ExtractImage(imgPath)
						if err == nil {
							parsed.BackgroundImage = img
							omittedNodeIdx = 0 // Omit this bottom covering shape from elements
						}
					}
				}
			}
		}
	}

	// Extract foreground elements
	elementIdx := 1
	for idx, node := range nodes {
		if idx == omittedNodeIdx {
			continue // Skip detected background image shape
		}

		el, ok, elWarnings := extractElementFromNode(node, slideRels, slidePartPath, slideWidthEMU, slideHeightEMU, elementIdx, pr)
		parsed.Warnings = append(parsed.Warnings, elWarnings...)
		if ok {
			parsed.Elements = append(parsed.Elements, el)
			elementIdx++
		}
	}

	return parsed, nil
}

func calcPct(emu int64, totalEMU int64) float64 {
	if totalEMU <= 0 {
		return 0
	}
	pct := (float64(emu) / float64(totalEMU)) * 100.0
	return math.Round(pct*10000.0) / 10000.0
}

func extractSpTreeXML(slideData []byte) []byte {
	startTag := []byte("<p:spTree")
	endTag := []byte("</p:spTree>")
	sIdx := bytes.Index(slideData, startTag)
	if sIdx == -1 {
		// Try without prefix
		startTag = []byte("<spTree")
		endTag = []byte("</spTree>")
		sIdx = bytes.Index(slideData, startTag)
	}
	if sIdx == -1 {
		return slideData
	}
	eIdx := bytes.Index(slideData[sIdx:], endTag)
	if eIdx == -1 {
		return slideData[sIdx:]
	}
	return slideData[sIdx : sIdx+eIdx+len(endTag)]
}
