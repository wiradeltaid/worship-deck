package pptximport

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"path"
	"regexp"
	"strings"
)

var (
	sigTTF   = []byte{0x00, 0x01, 0x00, 0x00}
	sigOTF   = []byte{'O', 'T', 'T', 'O'}
	sigWOFF  = []byte{'w', 'O', 'F', 'F'}
	sigWOFF2 = []byte{'w', 'O', 'F', '2'}
	sigTTC   = []byte{'t', 't', 'c', 'f'}

	guidRegex = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
)

const expectedFontRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"

// ParseObfuscationKey parses the 16-byte font obfuscation key from a GUID string
// according to ECMA-376 Part 2 §8.5.2.
// The GUID string is formatted as {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}.
// Bytes are reversed within each of the first three components.
func ParseObfuscationKey(guidStr string) ([]byte, bool) {
	match := guidRegex.FindString(guidStr)
	if match == "" {
		return nil, false
	}
	parts := strings.Split(match, "-")
	if len(parts) != 5 {
		return nil, false
	}

	p1, err1 := hex.DecodeString(parts[0]) // 4 bytes
	p2, err2 := hex.DecodeString(parts[1]) // 2 bytes
	p3, err3 := hex.DecodeString(parts[2]) // 2 bytes
	p4, err4 := hex.DecodeString(parts[3]) // 2 bytes
	p5, err5 := hex.DecodeString(parts[4]) // 6 bytes

	if err1 != nil || err2 != nil || err3 != nil || err4 != nil || err5 != nil {
		return nil, false
	}
	if len(p1) != 4 || len(p2) != 2 || len(p3) != 2 || len(p4) != 2 || len(p5) != 6 {
		return nil, false
	}

	key := make([]byte, 16)
	// First 4 bytes reversed
	key[0] = p1[3]
	key[1] = p1[2]
	key[2] = p1[1]
	key[3] = p1[0]
	// Next 2 bytes reversed
	key[4] = p2[1]
	key[5] = p2[0]
	// Next 2 bytes reversed
	key[6] = p3[1]
	key[7] = p3[0]
	// Remaining 8 bytes as-is
	key[8] = p4[0]
	key[9] = p4[1]
	copy(key[10:16], p5)

	return key, true
}

// ValidateAndDeobfuscateFont checks if the font data starts with a standard signature.
// If obfuscated, it attempts de-obfuscation using the key parsed from targetFilename.
// Returns normalized data, format string ("ttf", "otf", "woff", "woff2"), and error/warning if invalid.
func ValidateAndDeobfuscateFont(raw []byte, targetFilename string) ([]byte, string, error) {
	if len(raw) < 12 {
		return nil, "", fmt.Errorf("font stream is too short (%d bytes)", len(raw))
	}

	// Check if already valid plain font
	if format, ok := detectFontFormat(raw); ok {
		if err := validateFontStructure(raw, format); err != nil {
			return nil, "", err
		}
		return raw, format, nil
	}

	// Reject explicit TTC / OTC collections
	if len(raw) >= 4 && string(raw[:4]) == string(sigTTC) {
		return nil, "", fmt.Errorf("TTC font collections are not supported")
	}

	// Attempt de-obfuscation if GUID key is present
	key, ok := ParseObfuscationKey(targetFilename)
	if !ok {
		return nil, "", fmt.Errorf("unrecognized font format and no valid obfuscation key")
	}

	deobfuscated := make([]byte, len(raw))
	copy(deobfuscated, raw)

	// XOR first 32 bytes with key (16 bytes repeated twice)
	xorLen := 32
	if len(deobfuscated) < xorLen {
		xorLen = len(deobfuscated)
	}
	for i := 0; i < xorLen; i++ {
		deobfuscated[i] ^= key[i%16]
	}

	format, ok := detectFontFormat(deobfuscated)
	if !ok {
		return nil, "", fmt.Errorf("de-obfuscated font does not have a valid TTF/OTF/WOFF/WOFF2 signature")
	}

	if err := validateFontStructure(deobfuscated, format); err != nil {
		return nil, "", err
	}

	return deobfuscated, format, nil
}

func detectFontFormat(data []byte) (string, bool) {
	if len(data) < 4 {
		return "", false
	}
	if string(data[:4]) == string(sigTTF) {
		return "ttf", true
	}
	if string(data[:4]) == string(sigOTF) {
		return "otf", true
	}
	if string(data[:4]) == string(sigWOFF) {
		return "woff", true
	}
	if string(data[:4]) == string(sigWOFF2) {
		return "woff2", true
	}
	return "", false
}

func validateFontStructure(data []byte, format string) error {
	switch format {
	case "ttf", "otf":
		if len(data) < 12 {
			return fmt.Errorf("truncated %s header", format)
		}
		numTables := int(binary.BigEndian.Uint16(data[4:6]))
		if numTables == 0 || numTables > 100 {
			return fmt.Errorf("invalid table directory count (%d)", numTables)
		}
		if 12+numTables*16 > len(data) {
			return fmt.Errorf("table directory exceeds font file length")
		}
		for i := 0; i < numTables; i++ {
			recOffset := 12 + i*16
			tblOffset := binary.BigEndian.Uint32(data[recOffset+8 : recOffset+12])
			tblLength := binary.BigEndian.Uint32(data[recOffset+12 : recOffset+16])
			if uint64(tblOffset)+uint64(tblLength) > uint64(len(data)) {
				return fmt.Errorf("table record %d (offset %d, len %d) exceeds font length %d", i, tblOffset, tblLength, len(data))
			}
		}
	case "woff":
		if len(data) < 44 {
			return fmt.Errorf("truncated woff header")
		}
		numTables := int(binary.BigEndian.Uint16(data[12:14]))
		if numTables == 0 || numTables > 100 {
			return fmt.Errorf("invalid woff table directory count (%d)", numTables)
		}
		if 44+numTables*20 > len(data) {
			return fmt.Errorf("woff table directory exceeds font length")
		}
		for i := 0; i < numTables; i++ {
			recOffset := 44 + i*20
			tblOffset := binary.BigEndian.Uint32(data[recOffset+4 : recOffset+8])
			compLength := binary.BigEndian.Uint32(data[recOffset+8 : recOffset+12])
			if uint64(tblOffset)+uint64(compLength) > uint64(len(data)) {
				return fmt.Errorf("woff table %d exceeds font length", i)
			}
		}
	case "woff2":
		if len(data) < 48 {
			return fmt.Errorf("truncated woff2 header")
		}
		length := binary.BigEndian.Uint32(data[8:12])
		if uint64(length) > uint64(len(data)) {
			return fmt.Errorf("woff2 declared length %d exceeds stream %d", length, len(data))
		}
	}
	return nil
}

type ParsedFontMetadata struct {
	Family              string
	Subfamily           string
	SourceTypeface      string
	Weight              string
	Style               string
	UsWeightClass       uint16
	FsType              uint16
	RestrictedEmbedding bool
}

func decodeUTF16BE(b []byte) string {
	if len(b)%2 != 0 {
		b = b[:len(b)-1]
	}
	u16 := make([]uint16, len(b)/2)
	for i := range u16 {
		u16[i] = binary.BigEndian.Uint16(b[i*2 : i*2+2])
	}
	var runes []rune
	for _, r := range u16 {
		runes = append(runes, rune(r))
	}
	return string(runes)
}

// ParseSFNTMetadata reads standard OpenType/TrueType 'name' and 'OS/2' tables and extracts
// family, subfamily, typographic descriptors, and embedding safety flags.
func ParseSFNTMetadata(data []byte) (*ParsedFontMetadata, error) {
	if len(data) < 12 {
		return nil, fmt.Errorf("font data too short")
	}

	// SPEC-36-02: Reject TTC/OTC font collections
	if len(data) >= 4 && string(data[:4]) == "ttcf" {
		return nil, fmt.Errorf("TTC/OTC font collections are not supported; please upload individual .ttf or .otf files")
	}

	numTables := int(binary.BigEndian.Uint16(data[4:6]))
	if numTables == 0 || 12+numTables*16 > len(data) {
		return nil, fmt.Errorf("invalid table count")
	}

	var nameOffset, nameLength uint32
	var foundName bool
	var os2Offset, os2Length uint32
	var foundOS2 bool

	for i := 0; i < numTables; i++ {
		recOffset := 12 + i*16
		tag := string(data[recOffset : recOffset+4])

		// SPEC-36-02: Reject variable fonts with variation axes
		if tag == "fvar" || tag == "gvar" || tag == "CFF2" {
			return nil, fmt.Errorf("variable fonts with variation axes are not supported; please upload static face instances")
		}

		if tag == "name" {
			nameOffset = binary.BigEndian.Uint32(data[recOffset+8 : recOffset+12])
			nameLength = binary.BigEndian.Uint32(data[recOffset+12 : recOffset+16])
			foundName = true
		} else if tag == "OS/2" {
			os2Offset = binary.BigEndian.Uint32(data[recOffset+8 : recOffset+12])
			os2Length = binary.BigEndian.Uint32(data[recOffset+12 : recOffset+16])
			foundOS2 = true
		}
	}

	if !foundName || uint64(nameOffset)+uint64(nameLength) > uint64(len(data)) {
		return nil, fmt.Errorf("missing or invalid 'name' table")
	}

	var usWeightClass uint16 = 400
	var fsType uint16
	var fsSelection uint16
	var restrictedEmbedding bool

	if foundOS2 && uint64(os2Offset)+uint64(os2Length) <= uint64(len(data)) && os2Length >= 10 {
		os2Data := data[os2Offset : os2Offset+os2Length]
		usWeightClass = binary.BigEndian.Uint16(os2Data[4:6])
		fsType = binary.BigEndian.Uint16(os2Data[8:10])
		if (fsType & 0x0002) != 0 {
			restrictedEmbedding = true
		}
		if os2Length >= 64 {
			fsSelection = binary.BigEndian.Uint16(os2Data[62:64])
		}
	}

	nameData := data[nameOffset : nameOffset+nameLength]
	if len(nameData) < 6 {
		return nil, fmt.Errorf("name table too short")
	}

	count := int(binary.BigEndian.Uint16(nameData[2:4]))
	stringOffset := binary.BigEndian.Uint16(nameData[4:6])
	if 6+count*12 > len(nameData) {
		return nil, fmt.Errorf("name record directory exceeds table size")
	}

	names := make(map[uint16]string)

	for i := 0; i < count; i++ {
		recOff := 6 + i*12
		platformID := binary.BigEndian.Uint16(nameData[recOff : recOff+2])
		encodingID := binary.BigEndian.Uint16(nameData[recOff+2 : recOff+4])
		nameID := binary.BigEndian.Uint16(nameData[recOff+6 : recOff+8])
		length := binary.BigEndian.Uint16(nameData[recOff+8 : recOff+10])
		offset := binary.BigEndian.Uint16(nameData[recOff+10 : recOff+12])

		strStart := int(stringOffset) + int(offset)
		strEnd := strStart + int(length)
		if strStart < 0 || strEnd > len(nameData) {
			continue
		}

		rawBytes := nameData[strStart:strEnd]
		var val string
		if platformID == 0 || (platformID == 3 && (encodingID == 1 || encodingID == 10)) {
			val = decodeUTF16BE(rawBytes)
		} else {
			val = string(rawBytes)
		}
		val = strings.TrimSpace(val)
		if val != "" {
			if platformID == 3 || platformID == 0 || names[nameID] == "" {
				names[nameID] = val
			}
		}
	}

	family := names[16]
	if family == "" {
		family = names[1]
	}
	subfamily := names[17]
	if subfamily == "" {
		subfamily = names[2]
	}
	fullName := names[4]
	if fullName == "" {
		if subfamily != "" {
			fullName = family + " " + subfamily
		} else {
			fullName = family
		}
	}

	if family == "" {
		return nil, fmt.Errorf("could not extract font family from name table")
	}

	normFamily, weight, style, _ := NormalizeTypeface(fullName, "", "")
	if normFamily == "" {
		normFamily = family
	}

	// SPEC-36-02: If OS/2 table was present, prefer authoritative weight and style
	if foundOS2 {
		if usWeightClass >= 600 || (fsSelection&0x20) != 0 {
			weight = "700"
		} else {
			weight = "normal"
		}
		if (fsSelection&0x01) != 0 || strings.Contains(strings.ToLower(subfamily), "italic") || strings.Contains(strings.ToLower(subfamily), "oblique") {
			style = "italic"
		} else {
			style = "normal"
		}
	}

	return &ParsedFontMetadata{
		Family:              normFamily,
		Subfamily:           subfamily,
		SourceTypeface:      fullName,
		Weight:              weight,
		Style:               style,
		UsWeightClass:       usWeightClass,
		FsType:              fsType,
		RestrictedEmbedding: restrictedEmbedding,
	}, nil
}

// ExtractEmbeddedFonts scans presentation.xml for <p:embeddedFontLst> and extracts font faces.
func (pr *PackageReader) ExtractEmbeddedFonts(pres *XMLPresentation, presRels map[string]XMLRelationship) ([]*ExtractedFont, []string) {
	var extracted []*ExtractedFont
	var warnings []string

	if pres == nil || pres.EmbeddedFontLst == nil || len(pres.EmbeddedFontLst.Fonts) == 0 {
		return extracted, warnings
	}

	var cumulativeFontBytes int64 = 0
	seenHashes := make(map[string]bool)

	for _, ef := range pres.EmbeddedFontLst.Fonts {
		rawTypeface := strings.TrimSpace(ef.Font.Typeface)
		if rawTypeface == "" {
			continue
		}
		canonicalFamily, _, _, _ := NormalizeTypeface(rawTypeface, "", "")

		type faceEntry struct {
			ref    *XMLFontRelRef
			weight string
			style  string
			suffix string
		}

		entries := []faceEntry{
			{ef.Regular, "normal", "normal", "Regular"},
			{ef.Bold, "700", "normal", "Bold"},
			{ef.Italic, "normal", "italic", "Italic"},
			{ef.BoldItalic, "700", "italic", "Bold Italic"},
		}

		for _, fe := range entries {
			if fe.ref == nil || strings.TrimSpace(fe.ref.ID) == "" {
				continue
			}

			rel, ok := presRels[fe.ref.ID]
			if !ok {
				warnings = append(warnings, fmt.Sprintf("font face %s (%s) relationship %s not found", rawTypeface, fe.suffix, fe.ref.ID))
				continue
			}
			if rel.TargetMode == "External" {
				warnings = append(warnings, fmt.Sprintf("font face %s (%s) has forbidden external target: %s", rawTypeface, fe.suffix, rel.Target))
				continue
			}
			if !strings.EqualFold(rel.Type, expectedFontRelationshipType) {
				warnings = append(warnings, fmt.Sprintf("font face %s (%s) has invalid relationship type: %s", rawTypeface, fe.suffix, rel.Type))
				continue
			}

			fontPartPath, err := ResolveSafeTarget("ppt", rel.Target, "ppt/fonts/")
			if err != nil {
				warnings = append(warnings, fmt.Sprintf("font face %s (%s) safe path resolution failed: %v", rawTypeface, fe.suffix, err))
				continue
			}

			rawBytes, err := pr.ReadEntry(fontPartPath)
			if err != nil {
				warnings = append(warnings, fmt.Sprintf("failed to read font entry %s: %v", fontPartPath, err))
				continue
			}

			if int64(len(rawBytes)) > MaxExtractedFontSize {
				warnings = append(warnings, fmt.Sprintf("font entry %s exceeds 16 MiB limit (%d bytes)", fontPartPath, len(rawBytes)))
				continue
			}

			cumulativeFontBytes += int64(len(rawBytes))
			if cumulativeFontBytes > MaxTotalExtractedFontBytes {
				warnings = append(warnings, fmt.Sprintf("cumulative font size exceeds 64 MiB limit"))
				return extracted, warnings
			}

			fontData, format, err := ValidateAndDeobfuscateFont(rawBytes, path.Base(fontPartPath))
			if err != nil {
				warnings = append(warnings, fmt.Sprintf("font validation failed for %s (%s): %v", rawTypeface, fe.suffix, err))
				continue
			}

			hashBytes := sha256.Sum256(fontData)
			hashHex := hex.EncodeToString(hashBytes[:])

			if seenHashes[hashHex] {
				continue
			}
			seenHashes[hashHex] = true

			sourceTypeface := rawTypeface
			if fe.suffix != "Regular" && !strings.Contains(rawTypeface, fe.suffix) {
				sourceTypeface = fmt.Sprintf("%s %s", rawTypeface, fe.suffix)
			}

			meta, metaErr := ParseSFNTMetadata(fontData)
			isRestricted := metaErr == nil && meta != nil && meta.RestrictedEmbedding
			if metaErr == nil && meta != nil {
				if meta.Family != "" && (canonicalFamily == "" || canonicalFamily == rawTypeface) {
					canonicalFamily = meta.Family
				}
				if meta.Weight != "" {
					fe.weight = meta.Weight
				}
				if meta.Style != "" {
					fe.style = meta.Style
				}
			}

			extracted = append(extracted, &ExtractedFont{
				Family:         canonicalFamily,
				SourceTypeface: sourceTypeface,
				Weight:         fe.weight,
				Style:          fe.style,
				Format:         format,
				Data:           fontData,
				ContentHash:    hashHex,
				PartPath:       fontPartPath,
				Restricted:     isRestricted,
			})
		}
	}

	return extracted, warnings
}
