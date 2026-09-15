package pptximport

import (
	"errors"
	"fmt"
)

// Security and resource limits per SPEC-31
const (
	MaxCompressedSizeBytes   int64 = 100 * 1024 * 1024 // 100 MiB
	MaxUncompressedEntrySize int64 = 32 * 1024 * 1024  // 32 MiB
	MaxTotalUncompressedSize int64 = 250 * 1024 * 1024 // 250 MiB
	MaxSlideCount                  = 200
	MaxExtractedImageSize    int64 = 16 * 1024 * 1024 // 16 MiB
)

var (
	ErrInvalidZip          = errors.New("invalid or unreadable ZIP archive")
	ErrArchiveTooLarge     = errors.New("archive exceeds compressed size limit (100 MiB)")
	ErrTooManySlides       = errors.New("presentation exceeds slide limit (200 slides)")
	ErrEntryTooLarge       = errors.New("ZIP entry exceeds size limit (32 MiB)")
	ErrTotalSizeTooLarge   = errors.New("ZIP total uncompressed size exceeds limit (250 MiB)")
	ErrUnsafePath          = errors.New("unsafe path in ZIP entry")
	ErrExternalRelation    = errors.New("external relationship targets are forbidden")
	ErrNot16x9             = errors.New("presentation aspect ratio is not 16:9 (within 0.1% tolerance)")
	ErrUnsupportedImage    = errors.New("unsupported image format (must be JPEG, PNG, GIF, or WebP)")
	ErrImageTooLarge       = errors.New("extracted image exceeds size limit (16 MiB)")
	ErrNoSlides            = errors.New("presentation contains no slides")
)

// ExtractedImage represents an image file extracted from the PPTX package.
type ExtractedImage struct {
	PartPath string // ZIP internal path, e.g. "ppt/media/image1.png"
	Filename string // e.g. "image1.png"
	Ext      string // e.g. ".png"
	Data     []byte
	URL      string // Will be set after persistence, e.g. "/api/uploads/<32hex>.png"
}

// ParsedElement represents a foreground element ready for CanvasElement mapping.
type ParsedElement struct {
	ID       string
	Type     string // "text" or "image" or "shape"
	X        float64
	Y        float64
	W        float64
	H        float64
	ZIndex   int
	Content  *string
	Image    *ExtractedImage
	Style    map[string]any
	Warnings []string
}

// ParsedSlide represents an imported slide with its detected background and elements.
type ParsedSlide struct {
	SlideNumber     int
	Name            string
	BackgroundColor string
	BackgroundImage *ExtractedImage
	Elements        []ParsedElement
	Warnings        []string
}

// PresentationParseResult contains the complete output of the PPTX parsing pass.
type PresentationParseResult struct {
	SlideWidthEMU  int64
	SlideHeightEMU int64
	Slides         []*ParsedSlide
	Images         []*ExtractedImage
	Warnings       []string
}

// ValidationError wraps a structured validation failure.
type ValidationError struct {
	SlideNumber int
	Message     string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("slide %d: %s", e.SlideNumber, e.Message)
}
