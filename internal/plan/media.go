package plan

import (
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"os"
	"regexp"
	"strings"
)

var (
	localUpload = regexp.MustCompile(`(?i)^/api/uploads/([a-f0-9]{32}\.(?:jpe?g|png|gif|webp))$`)
	videoExt    = regexp.MustCompile(`(?i)\.(mp4|webm|mov|m4v|avi|mkv)$`)
	imageExt    = regexp.MustCompile(`(?i)\.(jpe?g|png|gif|webp)$`)
)

func isLocalUploadRef(ref string) bool {
	return localUpload.MatchString(strings.TrimSpace(ref))
}

func isPrivateHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "0.0.0.0" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast()
	}
	return strings.HasSuffix(host, ".local") || host == "metadata.google.internal"
}

func isSafeImageURL(ref string) bool {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return false
	}
	if isLocalUploadRef(ref) {
		return true
	}
	u, err := url.Parse(ref)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if raw := strings.TrimSpace(os.Getenv("IMAGE_URL_ALLOWLIST")); raw != "" {
		for _, h := range strings.Split(raw, ",") {
			if strings.EqualFold(strings.TrimSpace(h), host) {
				return true
			}
		}
		return false
	}
	return !isPrivateHost(host)
}

func announcementPathname(ref string) string {
	trimmed := strings.TrimSpace(ref)
	if strings.HasPrefix(trimmed, "/") {
		p := strings.SplitN(trimmed, "?", 2)[0]
		p = strings.SplitN(p, "#", 2)[0]
		return strings.TrimRight(p, "/")
	}
	u, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}
	return strings.TrimRight(u.Path, "/")
}

func isVideoURL(ref string) bool {
	p := announcementPathname(ref)
	return p != "" && videoExt.MatchString(p)
}

func isAnnouncementImageURL(ref string) bool {
	if !isSafeImageURL(ref) || isVideoURL(ref) {
		return false
	}
	p := announcementPathname(ref)
	return p != "" && imageExt.MatchString(p)
}

func coerceImageURLs(value interface{}) []string {
	arr, ok := value.([]interface{})
	if !ok {
		return nil
	}
	var out []string
	for _, x := range arr {
		s, ok := x.(string)
		if ok && isSafeImageURL(s) {
			out = append(out, s)
		}
	}
	return out
}

func parseImagesPayload(raw json.RawMessage) Media {
	empty := Media{}
	if len(raw) == 0 {
		return empty
	}
	var v interface{}
	if err := json.Unmarshal(raw, &v); err != nil {
		return empty
	}
	if arr, ok := v.([]interface{}); ok {
		empty.Flyers = coerceImageURLs(arr)
		return empty
	}
	obj, ok := v.(map[string]interface{})
	if !ok {
		return empty
	}
	images := obj["images"]
	if images == nil {
		images = obj["flyers"]
	}
	empty.Flyers = coerceImageURLs(images)
	if s, ok := obj["sermonGraphicUrl"].(string); ok && isSafeImageURL(s) {
		empty.SermonGraphicURL = &s
	}
	if s, ok := obj["familyPhotoUrl"].(string); ok && isSafeImageURL(s) {
		empty.FamilyPhotoURL = &s
	}
	if s, ok := obj["youthPhotoUrl"].(string); ok && isSafeImageURL(s) {
		empty.YouthPhotoURL = &s
	}
	if rawInserts, ok := obj["announcementInserts"].([]interface{}); ok {
		inserts := make([]string, 4)
		for i := 0; i < 4 && i < len(rawInserts); i++ {
			if s, ok := rawInserts[i].(string); ok && isSafeImageURL(s) {
				inserts[i] = s
			}
		}
		empty.AnnouncementInserts = inserts
	}
	return empty
}

func bucketHymns(items []ParsedItem) (bt, ds []HymnItem) {
	all := []HymnItem{}
	hasBT, hasDS := false, false
	for _, it := range items {
		if it.Type == "hymn" {
			all = append(all, HymnItem{BookCode: "", Number: it.Number, Title: it.Title, Lyrics: it.Lyrics, Incomplete: it.Incomplete})
		}
		if it.Type == "section" {
			t := it.Title
			if regexp.MustCompile(`(?i)^BIBLE\s+TALK\b`).MatchString(t) {
				hasBT = true
			}
			if regexp.MustCompile(`(?i)^DIVINE\s+SERVICE\b`).MatchString(t) {
				hasDS = true
			}
		}
	}
	if !hasBT && !hasDS {
		if len(all) > 2 {
			return all[:2], all[2:]
		}
		return all, nil
	}
	section := ""
	for _, it := range items {
		if it.Type == "section" {
			if regexp.MustCompile(`(?i)^BIBLE\s+TALK\b`).MatchString(it.Title) {
				section = "bt"
			} else if regexp.MustCompile(`(?i)^DIVINE\s+SERVICE\b`).MatchString(it.Title) {
				section = "ds"
			} else {
				section = ""
			}
			continue
		}
		if it.Type != "hymn" {
			continue
		}
		h := HymnItem{BookCode: "", Number: it.Number, Title: it.Title, Lyrics: it.Lyrics, Incomplete: it.Incomplete}
		if section == "bt" {
			bt = append(bt, h)
		} else if section == "ds" {
			ds = append(ds, h)
		}
	}
	return bt, ds
}

func IsSafeImageURL(ref string) bool { return isSafeImageURL(ref) }

func CoerceImageURLs(value interface{}) []string {
	out := coerceImageURLs(value)
	if out == nil {
		return []string{}
	}
	return out
}

func IsVideoURL(ref string) bool { return isVideoURL(ref) }

func IsAnnouncementImageURL(ref string) bool { return isAnnouncementImageURL(ref) }

func AssertAnnouncementImageURL(ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", fmt.Errorf("image_url must be a non-empty string")
	}
	if !isSafeImageURL(ref) {
		return "", fmt.Errorf("image_url must be an http(s) URL or a local /api/uploads/... path")
	}
	if isVideoURL(ref) {
		return "", fmt.Errorf("Video/MP4 URLs are not allowed")
	}
	if !isAnnouncementImageURL(ref) {
		return "", fmt.Errorf("image_url must end with an image extension (.jpg, .jpeg, .png, .gif, or .webp)")
	}
	return ref, nil
}

func CoerceOptionalSafeImageURL(value interface{}, field string) (present bool, out *string, err error) {
	if value == nil {
		return true, nil, nil
	}
	s, ok := value.(string)
	if !ok {
		return true, nil, fmt.Errorf("%s must be a string or null", field)
	}
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return true, nil, nil
	}
	if !isSafeImageURL(trimmed) {
		return true, nil, fmt.Errorf("%s is not a safe image URL", field)
	}
	path := trimmed
	if strings.HasPrefix(trimmed, "/") {
		path = strings.SplitN(trimmed, "?", 2)[0]
		path = strings.SplitN(path, "#", 2)[0]
	} else if u, e := url.Parse(trimmed); e == nil {
		path = u.Path
	} else {
		return true, nil, fmt.Errorf("%s is not a valid URL", field)
	}
	if !imageExt.MatchString(path) {
		return true, nil, fmt.Errorf("%s must end with an image extension (.jpg, .jpeg, .png, .gif, or .webp)", field)
	}
	return true, &trimmed, nil
}
