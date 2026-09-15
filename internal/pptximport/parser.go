package pptximport

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"path"
	"strings"
)

type PackageReader struct {
	reader        *zip.Reader
	entries       map[string]*zip.File
	uncompressed  int64
	extractedMaps map[string]*ExtractedImage
}

func NewPackageReader(r io.ReaderAt, size int64) (*PackageReader, error) {
	if size > MaxCompressedSizeBytes {
		return nil, ErrArchiveTooLarge
	}
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidZip, err)
	}

	pr := &PackageReader{
		reader:        zr,
		entries:       make(map[string]*zip.File),
		extractedMaps: make(map[string]*ExtractedImage),
	}

	for _, f := range zr.File {
		cleanName := strings.ReplaceAll(f.Name, "\\", "/")
		if strings.Contains(cleanName, "..") ||
			strings.HasPrefix(cleanName, "/") ||
			strings.Contains(cleanName, ":") {
			return nil, fmt.Errorf("%w: %s", ErrUnsafePath, f.Name)
		}
		if f.UncompressedSize64 > uint64(MaxUncompressedEntrySize) {
			return nil, fmt.Errorf("%w: entry %s", ErrEntryTooLarge, f.Name)
		}
		pr.entries[cleanName] = f
	}

	return pr, nil
}

func (pr *PackageReader) ReadEntry(entryPath string) ([]byte, error) {
	entryPath = strings.TrimPrefix(path.Clean(strings.ReplaceAll(entryPath, "\\", "/")), "/")
	f, ok := pr.entries[entryPath]
	if !ok {
		return nil, fmt.Errorf("part not found: %s", entryPath)
	}

	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	// Limit reader to protect against zip bomb headers that lied about UncompressedSize64
	lr := io.LimitReader(rc, MaxUncompressedEntrySize+1)
	buf, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}
	if int64(len(buf)) > MaxUncompressedEntrySize {
		return nil, fmt.Errorf("%w: entry %s exceeded 32 MiB", ErrEntryTooLarge, entryPath)
	}

	pr.uncompressed += int64(len(buf))
	if pr.uncompressed > MaxTotalUncompressedSize {
		return nil, ErrTotalSizeTooLarge
	}

	return buf, nil
}

func (pr *PackageReader) ParseXML(entryPath string, v any) error {
	data, err := pr.ReadEntry(entryPath)
	if err != nil {
		return err
	}

	decoder := xml.NewDecoder(bytes.NewReader(data))
	// Standard encoding/xml without DTD entity expansion
	decoder.Entity = nil
	return decoder.Decode(v)
}

func (pr *PackageReader) ReadRelationships(partPath string) (map[string]XMLRelationship, error) {
	dir := path.Dir(partPath)
	base := path.Base(partPath)
	var relsPath string
	if dir == "." || dir == "" {
		relsPath = "_rels/" + base + ".rels"
	} else {
		relsPath = dir + "/_rels/" + base + ".rels"
	}

	if _, ok := pr.entries[relsPath]; !ok {
		return make(map[string]XMLRelationship), nil
	}

	var xmlRels XMLRelationships
	if err := pr.ParseXML(relsPath, &xmlRels); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", relsPath, err)
	}

	result := make(map[string]XMLRelationship, len(xmlRels.Relationships))
	for _, rel := range xmlRels.Relationships {
		if strings.EqualFold(rel.TargetMode, "External") {
			return nil, fmt.Errorf("%w: relationship %s points to external target %s", ErrExternalRelation, rel.ID, rel.Target)
		}
		result[rel.ID] = rel
	}
	return result, nil
}

func ResolveSafeTarget(baseDir, target string, requiredPrefix string) (string, error) {
	cleanTarget := strings.ReplaceAll(target, "\\", "/")
	if strings.Contains(cleanTarget, ":") {
		return "", fmt.Errorf("%w: target %s contains invalid character", ErrUnsafePath, target)
	}
	resolved := path.Clean(path.Join(baseDir, cleanTarget))
	resolved = strings.TrimPrefix(resolved, "/")
	if strings.HasPrefix(resolved, "..") || strings.Contains(resolved, "/../") {
		return "", fmt.Errorf("%w: target %s escapes base path", ErrUnsafePath, target)
	}
	if requiredPrefix != "" && !strings.HasPrefix(resolved, requiredPrefix) {
		return "", fmt.Errorf("%w: target %s is outside expected prefix %s", ErrUnsafePath, target, requiredPrefix)
	}
	return resolved, nil
}

func DetectImageFormat(buf []byte) (string, error) {
	if len(buf) < 12 {
		return "", ErrUnsupportedImage
	}
	// JPEG: FF D8 FF
	if buf[0] == 0xFF && buf[1] == 0xD8 && buf[2] == 0xFF {
		return ".jpg", nil
	}
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if buf[0] == 0x89 && buf[1] == 'P' && buf[2] == 'N' && buf[3] == 'G' &&
		buf[4] == 0x0D && buf[5] == 0x0A && buf[6] == 0x1A && buf[7] == 0x0A {
		return ".png", nil
	}
	// GIF: GIF87a or GIF89a
	if string(buf[0:6]) == "GIF87a" || string(buf[0:6]) == "GIF89a" {
		return ".gif", nil
	}
	// WebP: RIFF....WEBP
	if string(buf[0:4]) == "RIFF" && string(buf[8:12]) == "WEBP" {
		return ".webp", nil
	}
	return "", ErrUnsupportedImage
}

func (pr *PackageReader) ExtractImage(partPath string) (*ExtractedImage, error) {
	partPath = strings.TrimPrefix(path.Clean(strings.ReplaceAll(partPath, "\\", "/")), "/")
	if cached, ok := pr.extractedMaps[partPath]; ok {
		return cached, nil
	}

	data, err := pr.ReadEntry(partPath)
	if err != nil {
		return nil, err
	}

	if int64(len(data)) > MaxExtractedImageSize {
		return nil, fmt.Errorf("%w: image %s is %d bytes", ErrImageTooLarge, partPath, len(data))
	}

	ext, err := DetectImageFormat(data)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedImage, partPath)
	}

	img := &ExtractedImage{
		PartPath: partPath,
		Filename: path.Base(partPath),
		Ext:      ext,
		Data:     data,
	}
	pr.extractedMaps[partPath] = img
	return img, nil
}

// ParsePresentation parses the entire PPTX package and returns a PresentationParseResult.
func ParsePresentation(r io.ReaderAt, size int64) (*PresentationParseResult, error) {
	pr, err := NewPackageReader(r, size)
	if err != nil {
		return nil, err
	}

	// 1. Verify [Content_Types].xml exists
	if _, ok := pr.entries["[Content_Types].xml"]; !ok {
		return nil, errors.New("missing [Content_Types].xml in PPTX package")
	}

	// 2. Read presentation.xml and presentation rels
	presPath := "ppt/presentation.xml"
	var pres XMLPresentation
	if err := pr.ParseXML(presPath, &pres); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", presPath, err)
	}

	cx := pres.SldSz.CX
	cy := pres.SldSz.CY
	if cx <= 0 || cy <= 0 {
		return nil, errors.New("invalid slide dimensions in presentation.xml")
	}

	// 16:9 check within 0.1% tolerance
	aspectRatio := float64(cx) / float64(cy)
	targetRatio := 16.0 / 9.0
	tolerance := 0.001
	if math.Abs(aspectRatio-targetRatio)/targetRatio > tolerance {
		return nil, fmt.Errorf("%w: aspect ratio %.4f vs expected 16:9 (1.7778)", ErrNot16x9, aspectRatio)
	}

	slideHeightPt := float64(cy) / 12700.0 // 1 pt = 12,700 EMU
	pxToPt := slideHeightPt / 540.0        // reference Canvas height (540px)

	presRels, err := pr.ReadRelationships(presPath)
	if err != nil {
		return nil, err
	}

	slideCount := len(pres.SldIdLst.SlideIDs)
	if slideCount == 0 {
		return nil, ErrNoSlides
	}
	if slideCount > MaxSlideCount {
		return nil, fmt.Errorf("%w: found %d slides", ErrTooManySlides, slideCount)
	}

	result := &PresentationParseResult{
		SlideWidthEMU:  cx,
		SlideHeightEMU: cy,
		Slides:         make([]*ParsedSlide, 0, slideCount),
		Warnings:       make([]string, 0),
	}

	// 3. Extract embedded presentation fonts (SPEC-32-02)
	fonts, fontWarnings := pr.ExtractEmbeddedFonts(&pres, presRels)
	result.Fonts = fonts
	result.Warnings = append(result.Warnings, fontWarnings...)

	embeddedFontMap := make(map[string]bool)
	for _, ef := range fonts {
		if ef.Family != "" {
			embeddedFontMap[strings.ToLower(strings.TrimSpace(ef.Family))] = true
		}
		if ef.SourceTypeface != "" {
			embeddedFontMap[strings.ToLower(strings.TrimSpace(ef.SourceTypeface))] = true
		}
	}

	// 4. Process each slide
	for i, sldId := range pres.SldIdLst.SlideIDs {
		rel, ok := presRels[sldId.RID]
		if !ok {
			return nil, fmt.Errorf("missing relationship for slide %d (rId: %s)", i+1, sldId.RID)
		}

		slidePartPath, err := ResolveSafeTarget("ppt", rel.Target, "ppt/slides/")
		if err != nil {
			return nil, fmt.Errorf("invalid slide relationship for slide %d: %w", i+1, err)
		}
		slide, err := parseSlide(pr, slidePartPath, i+1, cx, cy, pxToPt)
		if err != nil {
			return nil, fmt.Errorf("error processing slide %d (%s): %w", i+1, slidePartPath, err)
		}

		// SPEC-33-03: Tag fontStatus and detect unacquired custom fonts
		for j := range slide.Elements {
			el := &slide.Elements[j]
			if el.Type == "text" && el.Style != nil {
				family, _ := el.Style["fontFamily"].(string)
				pptxTypeface, _ := el.Style["pptxTypeface"].(string)
				famLower := strings.ToLower(strings.TrimSpace(family))
				rawLower := strings.ToLower(strings.TrimSpace(pptxTypeface))

				if _, ok := StandardSystemFonts[famLower]; ok {
					el.Style["fontStatus"] = "system"
				} else if _, ok := StandardSystemFonts[rawLower]; ok {
					el.Style["fontStatus"] = "system"
				} else if embeddedFontMap[famLower] || embeddedFontMap[rawLower] {
					el.Style["fontStatus"] = "embedded"
				} else if _, ok := CuratedCatalogFonts[famLower]; ok {
					el.Style["fontStatus"] = "catalog"
				} else if _, ok := CuratedCatalogFonts[rawLower]; ok {
					el.Style["fontStatus"] = "catalog"
				} else {
					el.Style["fontStatus"] = "unresolved"
					warn := fmt.Sprintf("Custom font '%s' is not embedded in the PPTX package and will require acquisition or fallback.", family)
					el.Warnings = append(el.Warnings, warn)
					slide.Warnings = append(slide.Warnings, warn)
					result.Warnings = append(result.Warnings, warn)
				}
			}
		}

		result.Slides = append(result.Slides, slide)
	}

	// Collect unique extracted images
	imageMap := make(map[string]*ExtractedImage)
	for _, slide := range result.Slides {
		if slide.BackgroundImage != nil {
			imageMap[slide.BackgroundImage.PartPath] = slide.BackgroundImage
		}
		for _, el := range slide.Elements {
			if el.Image != nil {
				imageMap[el.Image.PartPath] = el.Image
			}
		}
	}
	for _, img := range imageMap {
		result.Images = append(result.Images, img)
	}

	return result, nil
}
