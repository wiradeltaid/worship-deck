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

// DrawingML sz hundredths of a point to CSS Px: (sz / 100) / pxToPt
func DrawingMLSzToPx(sz int, pxToPt float64) float64 {
	if sz <= 0 {
		return DefaultFontSizePx
	}
	scale := pxToPt
	if math.IsNaN(scale) || math.IsInf(scale, 0) || scale <= 0 {
		scale = 1.0
	}
	px := (float64(sz) / 100.0) / scale
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
	pxToPt float64,
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

			elID := fmt.Sprintf("el-text-%d", elementIdx)
			style, styleWarnings := extractTextStyleWithWarnings(node.Shape.TxBody, elID, pxToPt)
			warnings = append(warnings, styleWarnings...)

			el := ParsedElement{
				ID:       elID,
				Type:     "text",
				X:        xPct,
				Y:        yPct,
				W:        wPct,
				H:        hPct,
				ZIndex:   elementIdx - 1,
				Content:  &text,
				Style:    style,
				Warnings: styleWarnings,
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

func extractTextStyle(txBody *XMLTextBody, pxToPt float64) map[string]any {
	style, _ := extractTextStyleWithWarnings(txBody, "", pxToPt)
	return style
}

func resolveEffectiveRunProperties(rPr *XMLRunProperties, defRPr *XMLRunProperties, endParaRPr *XMLRunProperties) *XMLRunProperties {
	merged := &XMLRunProperties{}
	apply := func(src *XMLRunProperties) {
		if src == nil {
			return
		}
		if src.Sz > 0 {
			merged.Sz = src.Sz
		}
		if src.B != "" {
			merged.B = src.B
		}
		if src.I != "" {
			merged.I = src.I
		}
		if src.U != "" {
			merged.U = src.U
		}
		if src.Spc != nil {
			merged.Spc = src.Spc
		}
		if src.SolidFill != nil && src.SolidFill.SrgbClr != nil {
			merged.SolidFill = src.SolidFill
		}
		if src.Latin != nil && src.Latin.Typeface != "" {
			merged.Latin = src.Latin
		}
	}
	apply(defRPr)
	apply(endParaRPr)
	apply(rPr)

	if merged.Sz == 0 && merged.B == "" && merged.I == "" && merged.U == "" && merged.Spc == nil && merged.SolidFill == nil && merged.Latin == nil {
		return nil
	}
	return merged
}

func extractTextStyleWithWarnings(txBody *XMLTextBody, elID string, pxToPt float64) (map[string]any, []string) {
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
	var warnings []string

	if txBody == nil || len(txBody.Paragraphs) == 0 {
		return style, warnings
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

	// Find effective run properties with DrawingML inheritance (defRPr -> endParaRPr -> rPr)
	var effectiveRPr *XMLRunProperties
	var resolvedRunsWithText []*XMLRunProperties

	for _, p := range txBody.Paragraphs {
		var defRPr *XMLRunProperties
		if p.PPr != nil {
			defRPr = p.PPr.DefRPr
		}
		for _, r := range p.Runs {
			eff := resolveEffectiveRunProperties(r.RPr, defRPr, p.EndParaRPr)
			if strings.TrimSpace(r.T) != "" {
				resolvedRunsWithText = append(resolvedRunsWithText, eff)
			}
			if effectiveRPr == nil && eff != nil {
				effectiveRPr = eff
			}
		}
		if effectiveRPr == nil {
			if effDef := resolveEffectiveRunProperties(nil, defRPr, p.EndParaRPr); effDef != nil {
				effectiveRPr = effDef
			}
		}
	}

	// Apply formatting from the effective run properties source
	if effectiveRPr != nil {
		if effectiveRPr.Sz > 0 {
			style["fontSize"] = DrawingMLSzToPx(effectiveRPr.Sz, pxToPt)
		}
		if effectiveRPr.SolidFill != nil && effectiveRPr.SolidFill.SrgbClr != nil && hexColorRegex.MatchString(effectiveRPr.SolidFill.SrgbClr.Val) {
			style["fontColor"] = "#" + strings.ToUpper(effectiveRPr.SolidFill.SrgbClr.Val)
		}

		rawTypeface := DefaultFontFamily
		if effectiveRPr.Latin != nil && strings.TrimSpace(effectiveRPr.Latin.Typeface) != "" {
			rawTypeface = strings.TrimSpace(effectiveRPr.Latin.Typeface)
		}

		family, weight, fontStyle, pptxTypeface := NormalizeTypeface(rawTypeface, effectiveRPr.B, effectiveRPr.I)
		style["fontFamily"] = family
		style["fontWeight"] = weight
		style["fontStyle"] = fontStyle
		style["pptxTypeface"] = pptxTypeface

		if effectiveRPr.U == "sng" {
			style["textDecoration"] = "underline"
		}
		if effectiveRPr.Spc != nil {
			style["letterSpacing"] = DrawingMLSpcToPx(*effectiveRPr.Spc, pxToPt)
		}
	}

	// Check for mixed run typography across runs that carry text
	if len(resolvedRunsWithText) > 1 && effectiveRPr != nil {
		hasMixed := false
		effFace := ""
		if effectiveRPr.Latin != nil {
			effFace = strings.TrimSpace(effectiveRPr.Latin.Typeface)
		}
		effSz := effectiveRPr.Sz
		effB := effectiveRPr.B
		effI := effectiveRPr.I
		var effSpcVal *int = effectiveRPr.Spc

		for _, r := range resolvedRunsWithText {
			if r == nil {
				continue
			}
			rFace := ""
			if r.Latin != nil {
				rFace = strings.TrimSpace(r.Latin.Typeface)
			}
			if rFace != "" && effFace != "" && !strings.EqualFold(rFace, effFace) {
				hasMixed = true
				break
			}
			if r.Sz > 0 && effSz > 0 && math.Abs(float64(r.Sz-effSz)) > 50 {
				hasMixed = true
				break
			}
			if r.B != effB || r.I != effI {
				hasMixed = true
				break
			}
			if (r.Spc == nil && effSpcVal != nil) || (r.Spc != nil && effSpcVal == nil) {
				hasMixed = true
				break
			}
			if r.Spc != nil && effSpcVal != nil && *r.Spc != *effSpcVal {
				hasMixed = true
				break
			}
		}

		if hasMixed && elID != "" {
			warnings = append(warnings, fmt.Sprintf("element %s contains mixed run typography; imported using first run style", elID))
		}
	}

	return style, warnings
}
