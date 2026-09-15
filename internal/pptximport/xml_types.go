package pptximport

import "encoding/xml"

// Package Content_Types
type XMLContentTypes struct {
	XMLName   xml.Name      `xml:"Types"`
	Overrides []XMLOverride `xml:"Override"`
}

type XMLOverride struct {
	PartName    string `xml:"PartName,attr"`
	ContentType string `xml:"ContentType,attr"`
}

// Relationships (.rels)
type XMLRelationships struct {
	XMLName       xml.Name          `xml:"Relationships"`
	Relationships []XMLRelationship `xml:"Relationship"`
}

type XMLRelationship struct {
	ID         string `xml:"Id,attr"`
	Type       string `xml:"Type,attr"`
	Target     string `xml:"Target,attr"`
	TargetMode string `xml:"TargetMode,attr"`
}

// Presentation (ppt/presentation.xml)
type XMLPresentation struct {
	XMLName         xml.Name            `xml:"presentation"`
	SldSz           XMLSlideSize        `xml:"sldSz"`
	SldIdLst        XMLSlideIdList      `xml:"sldIdLst"`
	EmbeddedFontLst *XMLEmbeddedFontList `xml:"embeddedFontLst"`
}

type XMLEmbeddedFontList struct {
	Fonts []XMLEmbeddedFont `xml:"embeddedFont"`
}

type XMLEmbeddedFont struct {
	Font       XMLFontInfo    `xml:"font"`
	Regular    *XMLFontRelRef `xml:"regular"`
	Bold       *XMLFontRelRef `xml:"bold"`
	Italic     *XMLFontRelRef `xml:"italic"`
	BoldItalic *XMLFontRelRef `xml:"boldItalic"`
}

type XMLFontInfo struct {
	Typeface string `xml:"typeface,attr"`
}

type XMLFontRelRef struct {
	ID string
}

func (f *XMLFontRelRef) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	for _, attr := range start.Attr {
		if attr.Name.Local == "id" {
			f.ID = attr.Value
		}
	}
	return d.Skip()
}

type XMLSlideSize struct {
	CX int64 `xml:"cx,attr"`
	CY int64 `xml:"cy,attr"`
}

type XMLSlideIdList struct {
	SlideIDs []XMLSlideID `xml:"sldId"`
}

type XMLSlideID struct {
	ID  string
	RID string
}

func (s *XMLSlideID) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	for _, attr := range start.Attr {
		if attr.Name.Local == "id" {
			if attr.Name.Space == "" {
				s.ID = attr.Value
			} else {
				s.RID = attr.Value
			}
		}
	}
	return d.Skip()
}

// Slide (ppt/slides/slideN.xml)
type XMLSlide struct {
	XMLName xml.Name        `xml:"sld"`
	CSld    XMLCommonSlideData `xml:"cSld"`
}

// Slide Layout (ppt/slideLayouts/slideLayoutN.xml)
type XMLSlideLayout struct {
	XMLName xml.Name        `xml:"sldLayout"`
	CSld    XMLCommonSlideData `xml:"cSld"`
}

type XMLCommonSlideData struct {
	Bg     *XMLBackground `xml:"bg"`
	SpTree XMLShapeTree   `xml:"spTree"`
}

type XMLBackground struct {
	BgPr *XMLBackgroundProperties `xml:"bgPr"`
}

type XMLBackgroundProperties struct {
	SolidFill *XMLSolidFill `xml:"solidFill"`
	BlipFill  *XMLBlipFill  `xml:"blipFill"`
}

type XMLShapeTree struct {
	Shapes    []XMLShape   `xml:"sp"`
	Pictures  []XMLPicture `xml:"pic"`
	GrpShapes []any        `xml:"grpSp"`
}

// Shape (p:sp)
type XMLShape struct {
	NvSpPr XMLNonVisualShapeProperties `xml:"nvSpPr"`
	SpPr   XMLShapeProperties          `xml:"spPr"`
	TxBody *XMLTextBody                `xml:"txBody"`
}

type XMLNonVisualShapeProperties struct {
	CNvPr XMLCommonNonVisualProperties `xml:"cNvPr"`
}

type XMLCommonNonVisualProperties struct {
	ID   int    `xml:"id,attr"`
	Name string `xml:"name,attr"`
}

// Picture (p:pic)
type XMLPicture struct {
	NvPicPr XMLNonVisualPictureProperties `xml:"nvPicPr"`
	BlipFill XMLBlipFill                  `xml:"blipFill"`
	SpPr     XMLShapeProperties           `xml:"spPr"`
}

type XMLNonVisualPictureProperties struct {
	CNvPr XMLCommonNonVisualProperties `xml:"cNvPr"`
}

type XMLShapeProperties struct {
	Xfrm      *XMLTransform2D `xml:"xfrm"`
	SolidFill *XMLSolidFill   `xml:"solidFill"`
	BlipFill  *XMLBlipFill    `xml:"blipFill"`
}

type XMLTransform2D struct {
	Off XMLPoint2D `xml:"off"`
	Ext XMLSize2D  `xml:"ext"`
}

type XMLPoint2D struct {
	X int64 `xml:"x,attr"`
	Y int64 `xml:"y,attr"`
}

type XMLSize2D struct {
	CX int64 `xml:"cx,attr"`
	CY int64 `xml:"cy,attr"`
}

type XMLSolidFill struct {
	SrgbClr *XMLSrgbColor `xml:"srgbClr"`
}

type XMLSrgbColor struct {
	Val string `xml:"val,attr"`
}

type XMLBlipFill struct {
	Blip XMLBlip `xml:"blip"`
}

type XMLBlip struct {
	Embed string
}

func (b *XMLBlip) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	for _, attr := range start.Attr {
		if attr.Name.Local == "embed" {
			b.Embed = attr.Value
		}
	}
	return d.Skip()
}

// Text Body (p:txBody)
type XMLTextBody struct {
	Paragraphs []XMLParagraph `xml:"p"`
}

type XMLParagraph struct {
	PPr        *XMLParagraphProperties `xml:"pPr"`
	Runs       []XMLRun                `xml:"r"`
	Brs        []XMLBreak              `xml:"br"`
	EndParaRPr *XMLRunProperties       `xml:"endParaRPr"`
	// In DrawingML, runs and br elements are interspersed in document order.
	// We handle sequence parsing via a custom unmarshaler or token scanner.
}

type XMLParagraphProperties struct {
	Algn   string            `xml:"algn,attr"` // l, ctr, r, just
	LnSpc  *XMLLineSpacing   `xml:"lnSpc"`
	DefRPr *XMLRunProperties `xml:"defRPr"`
}

type XMLLineSpacing struct {
	SpcPct *XMLSpacingPercent `xml:"spcPct"`
	SpcPts *XMLSpacingPoints  `xml:"spcPts"`
}

type XMLSpacingPercent struct {
	Val int `xml:"val,attr"` // e.g. 100000 = 100%
}

type XMLSpacingPoints struct {
	Val int `xml:"val,attr"` // e.g. 1200 = 12pt
}

type XMLRun struct {
	RPr *XMLRunProperties `xml:"rPr"`
	T   string            `xml:"t"`
}

type XMLBreak struct {
	RPr *XMLRunProperties `xml:"rPr"`
}

type XMLRunProperties struct {
	Sz        int           `xml:"sz,attr"` // hundredths of a point (e.g. 4000 = 40pt)
	B         string        `xml:"b,attr"`  // "1" or "0"
	I         string        `xml:"i,attr"`  // "1" or "0"
	U         string        `xml:"u,attr"`  // "sng", "none"
	Spc       *int          `xml:"spc,attr"` // character tracking in hundredths of a pt
	SolidFill *XMLSolidFill `xml:"solidFill"`
	Latin     *XMLLatinFont `xml:"latin"`
}

type XMLLatinFont struct {
	Typeface string `xml:"typeface,attr"`
}
