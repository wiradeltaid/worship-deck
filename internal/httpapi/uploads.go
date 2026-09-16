package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/wiradeltaid/worship-presenter-web/internal/plan"
)

var uploadRef = regexp.MustCompile(`(?i)^[a-f0-9]{32}\.(jpe?g|png|gif|webp)$`)

func uploadsDir() string {
	if d := strings.TrimSpace(os.Getenv("UPLOADS_DIR")); d != "" {
		return d
	}
	return filepath.Join("data", "uploads")
}

func (s *Server) postUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()
	ct := hdr.Header.Get("Content-Type")
	if ct != "" && !strings.HasPrefix(ct, "image/") {
		writeError(w, http.StatusBadRequest, "File must be an image")
		return
	}
	ext := normalizeExt(hdr.Filename)
	if ext == "" {
		writeError(w, http.StatusBadRequest, "Unsupported image type (use .jpg, .jpeg, .png, .gif, or .webp)")
		return
	}
	buf, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to upload image")
		return
	}
	name, url, err := writeUpload(ext, buf)
	if err != nil {
		log.Printf("Upload error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to upload image")
		return
	}
	_ = name
	writeJSON(w, http.StatusOK, map[string]any{"url": url})
}

func normalizeExt(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		return ext
	}
	return ""
}

func writeUpload(ext string, buf []byte) (string, string, error) {
	dir := uploadsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", err
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	filename := hex.EncodeToString(b) + ext
	path := filepath.Join(dir, filename)
	if err := os.WriteFile(path, buf, 0o644); err != nil {
		return "", "", err
	}
	return filename, "/api/uploads/" + filename, nil
}

func (s *Server) getUpload(w http.ResponseWriter, r *http.Request) {
	filename := r.PathValue("filename")
	if !uploadRef.MatchString(filename) {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}
	path := filepath.Join(uploadsDir(), strings.ToLower(filename))
	st, err := os.Stat(path)
	if err != nil || st.IsDir() {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}
	ext := strings.ToLower(filepath.Ext(path))
	ct := map[string]string{
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
		".webp": "image/webp", ".gif": "image/gif",
	}[ext]
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}

const maxImageBytes = 16 * 1024 * 1024

func (s *Server) postUploadFromURL(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		if msg == "Invalid JSON" {
			writeError(w, http.StatusBadRequest, "Expected a JSON body")
			return
		}
		writeError(w, status, msg)
		return
	}
	link := strings.TrimSpace(asString(body["url"]))
	if link == "" {
		writeError(w, http.StatusBadRequest, "No image link provided")
		return
	}
	if !plan.IsSafeImageURL(link) || strings.HasPrefix(link, "/") {
		writeError(w, http.StatusBadRequest, "That address is not allowed.")
		return
	}
	client := &http.Client{
		Timeout: 8 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return errors.New("redirect")
		},
	}
	resp, err := client.Get(link)
	if err != nil {
		if strings.Contains(err.Error(), "redirect") {
			writeError(w, http.StatusBadRequest, "That link redirects somewhere else. Use the image’s direct address instead.")
			return
		}
		if os.IsTimeout(err) || strings.Contains(strings.ToLower(err.Error()), "timeout") {
			writeError(w, http.StatusGatewayTimeout, "That host took too long to answer.")
			return
		}
		log.Printf("Image fetch refused (unreachable) for %s: %v", link, err)
		writeError(w, http.StatusBadGateway, "That host could not be reached.")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		writeError(w, http.StatusBadGateway, "That host refused to serve the image.")
		return
	}
	ct := strings.ToLower(strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0]))
	extByMIME := map[string]string{
		"image/jpg": ".jpg", "image/jpeg": ".jpeg", "image/png": ".png",
		"image/gif": ".gif", "image/webp": ".webp",
	}
	ext, ok := extByMIME[ct]
	if !ok {
		ext = normalizeExt(link)
	}
	if ext == "" {
		writeError(w, http.StatusBadRequest, "That link is not an image (use a .jpg, .jpeg, .png, .gif or .webp address).")
		return
	}
	limited := io.LimitReader(resp.Body, maxImageBytes+1)
	buf, err := io.ReadAll(limited)
	if err != nil {
		writeError(w, http.StatusBadGateway, "That host could not be reached.")
		return
	}
	if len(buf) == 0 {
		writeError(w, http.StatusBadGateway, "That link returned an empty response.")
		return
	}
	if len(buf) > maxImageBytes {
		writeError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("That image is larger than the %d MB limit.", maxImageBytes/(1024*1024)))
		return
	}
	_, urlPath, err := writeUpload(ext, buf)
	if err != nil {
		log.Printf("Image fetch write error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to save the image")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"url": urlPath})
}
