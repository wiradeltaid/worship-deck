package pptximport

import (
	"fmt"
	"math"
	"path"
	"strings"
)

// Default styling constants
const (
	DefaultFontFamily = "Inter"
	DefaultFontSizePx = 32.0
	DefaultFontColor  = "#FFFFFF"
	DefaultLineHeight = 1.2
)

// PxToPt is 405 / 540 = 0.75
const PxToPt = 0.75

// DrawingML sz hundredths of a point to CSS Px: (sz / 100) / PxToPt
func DrawingMLSzToPx(sz int) float64 {
	if sz <= 0 {
		return DefaultFontSizePx
	}
	px := (float64(sz) / 100.0) / PxToPt
	return math.Round(px*10000.0) / 10000.0
}

func extractTextFromTxBody(txBody *XMLTextBody) string {
	if txBody == nil || len(txBody.Paragraphs) == 0 {
		return ""
	}

	var paraTexts []string
	for _, p := range txBody.Paragraphs {
		var pBuf strings.Builder
		for _, r := range p.Runs {
			pBuf.WriteString(r.T)
		}
		// Also handle explicit br elements if present
		if len(p.Brs) > 0 && len(p.Runs) == 0 {
			for range p.Brs {
				pBuf.WriteString("\n")
			}
		}
		paraTexts = append(paraTexts, pBuf.String())
	}
	return strings.Join(paraTexts, "\n")
}

func extractElementFromNode(
	node RawShapeNode,
	slideRels map[string]XMLRelationship,
	slidePartPath string,
	slideWidthEMU, slideHeightEMU int64,
	elementIdx int,
	pr *PackageReader,
) (ParsedElement, bool, []string) {
	var warnings []string

	// Check if this is a shape with text (p:sp with txBody)
	if node.Tag == "sp" && node.Shape != nil && node.Shape.TxBody != nil {
		text := extractTextFromTxBody(node.Shape.TxBody)
		if strings.TrimSpace(text) != "" {
			xfrm := node.Shape.SpPr.Xfrm
			if xfrm == nil {
				return ParsedElement{}, false, warnings
			}

			xPct := calcPct(xfrm.Off.X, slideWidthEMU)
			yPct := calcPct(xfrm.Off.Y, slideHeightEMU)
			wPct := calcPct(xfrm.Ext.CX, slideWidthEMU)
			hPct := calcPct(xfrm.Ext.CY, slideHeightEMU)

			// Minimum bounds guard for validator
			if wPct <= 0 {
				wPct = 1.0
			}
			if hPct <= 0 {
				hPct = 1.0
			}

			style := extractTextStyle(node.Shape.TxBody)

			el := ParsedElement{
				ID:      fmt.Sprintf("el-text-%d", elementIdx),
				Type:    "text",
				X:       xPct,
				Y:       yPct,
				W:       wPct,
				H:       hPct,
				ZIndex:  elementIdx - 1,
				Content: &text,
				Style:   style,
			}
			return el, true, warnings
		}
	}

	// Check if this is an image (p:pic or p:sp with blipFill)
	var embedRelID string
	var xfrm *XMLTransform2D

	if node.Tag == "pic" && node.Picture != nil {
		embedRelID = node.Picture.BlipFill.Blip.Embed
		xfrm = node.Picture.SpPr.Xfrm
	} else if node.Tag == "sp" && node.Shape != nil && node.Shape.SpPr.BlipFill != nil {
		embedRelID = node.Shape.SpPr.BlipFill.Blip.Embed
		xfrm = node.Shape.SpPr.Xfrm
	}

	if embedRelID != "" && xfrm != nil {
		if rel, ok := slideRels[embedRelID]; ok {
			imgPath, err := ResolveSafeTarget(path.Dir(slidePartPath), rel.Target, "ppt/media/")
			if err == nil {
				img, err := pr.ExtractImage(imgPath)
				if err == nil {
					xPct := calcPct(xfrm.Off.X, slideWidthEMU)
					yPct := calcPct(xfrm.Off.Y, slideHeightEMU)
					wPct := calcPct(xfrm.Ext.CX, slideWidthEMU)
					hPct := calcPct(xfrm.Ext.CY, slideHeightEMU)

					if wPct <= 0 {
						wPct = 1.0
					}
					if hPct <= 0 {
						hPct = 1.0
					}

					el := ParsedElement{
						ID:     fmt.Sprintf("el-img-%d", elementIdx),
						Type:   "image",
						X:      xPct,
						Y:      yPct,
						W:      wPct,
						H:      hPct,
						ZIndex: elementIdx - 1,
						Image:  img,
						Style: map[string]any{
							"objectFit": "contain",
						},
					}
					return el, true, warnings
				} else {
					warnings = append(warnings, fmt.Sprintf("failed to extract foreground image %s: %v", imgPath, err))
				}
			}
		}
	}

	// Check if this is a simple shape with solidFill
	if node.Tag == "sp" && node.Shape != nil && node.Shape.SpPr.SolidFill != nil && node.Shape.SpPr.SolidFill.SrgbClr != nil {
		val := node.Shape.SpPr.SolidFill.SrgbClr.Val
		if hexColorRegex.MatchString(val) && node.Shape.SpPr.Xfrm != nil {
			xfrm := node.Shape.SpPr.Xfrm
			xPct := calcPct(xfrm.Off.X, slideWidthEMU)
			yPct := calcPct(xfrm.Off.Y, slideHeightEMU)
			wPct := calcPct(xfrm.Ext.CX, slideWidthEMU)
			hPct := calcPct(xfrm.Ext.CY, slideHeightEMU)

			if wPct <= 0 {
				wPct = 1.0
			}
			if hPct <= 0 {
				hPct = 1.0
			}

			el := ParsedElement{
				ID:     fmt.Sprintf("el-shape-%d", elementIdx),
				Type:   "shape",
				X:      xPct,
				Y:      yPct,
				W:      wPct,
				H:      hPct,
				ZIndex: elementIdx - 1,
				Style: map[string]any{
					"fillColor": "#" + strings.ToUpper(val),
				},
			}
			return el, true, warnings
		}
	}

	return ParsedElement{}, false, warnings
}

func extractTextStyle(txBody *XMLTextBody) map[string]any {
	style := map[string]any{
		"fontFamily":     DefaultFontFamily,
		"fontSize":       DefaultFontSizePx,
		"fontColor":      DefaultFontColor,
		"fontWeight":     "normal",
		"fontStyle":      "normal",
		"textDecoration": "none",
		"textAlign":      "left",
		"lineHeight":     DefaultLineHeight,
	}

	if txBody == nil || len(txBody.Paragraphs) == 0 {
		return style
	}

	firstP := txBody.Paragraphs[0]
	if firstP.PPr != nil {
		switch firstP.PPr.Algn {
		case "ctr":
			style["textAlign"] = "center"
		case "r":
			style["textAlign"] = "right"
		case "l":
			style["textAlign"] = "left"
		}

		if firstP.PPr.LnSpc != nil {
			if firstP.PPr.LnSpc.SpcPct != nil && firstP.PPr.LnSpc.SpcPct.Val > 0 {
				lh := float64(firstP.PPr.LnSpc.SpcPct.Val) / 100000.0
				style["lineHeight"] = math.Round(lh*100.0) / 100.0
			}
		}
	}

	// Extract styling from first run with formatting
	for _, p := range txBody.Paragraphs {
		for _, r := range p.Runs {
			if r.RPr != nil {
				if r.RPr.Sz > 0 {
					style["fontSize"] = DrawingMLSzToPx(r.RPr.Sz)
				}
				if r.RPr.SolidFill != nil && r.RPr.SolidFill.SrgbClr != nil && hexColorRegex.MatchString(r.RPr.SolidFill.SrgbClr.Val) {
					style["fontColor"] = "#" + strings.ToUpper(r.RPr.SolidFill.SrgbClr.Val)
				}
				if r.RPr.Latin != nil && strings.TrimSpace(r.RPr.Latin.Typeface) != "" {
					style["fontFamily"] = strings.TrimSpace(r.RPr.Latin.Typeface)
				}
				if r.RPr.B == "1" {
					style["fontWeight"] = "bold"
				}
				if r.RPr.I == "1" {
					style["fontStyle"] = "italic"
				}
				if r.RPr.U == "sng" {
					style["textDecoration"] = "underline"
				}
				return style
			}
		}
	}

	return style
}
