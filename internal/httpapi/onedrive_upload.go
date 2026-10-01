package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	maxSimpleUploadBytes = 4 * 1024 * 1024 // 4 MiB limit for simple PUT
	uploadChunkSize      = 320 * 1024 * 10 // 3.2 MiB (must be multiple of 320 KiB for MS Graph)
)

func (s *Server) handlePostOneDriveUpload(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	serviceIDStr := r.PathValue("id")
	serviceID, err := strconv.Atoi(serviceIDStr)
	if err != nil || serviceID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid service ID")
		return
	}

	// Verify service exists in database
	var count int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM services WHERE id = ?", serviceID).Scan(&count); err != nil || count == 0 {
		writeError(w, http.StatusNotFound, "Service not found")
		return
	}

	// Retrieve user OneDrive config
	rec, err := s.getOneDriveConfigForUser(sess.UID)
	if err != nil || rec == nil || rec.AccessToken == "" {
		writeError(w, http.StatusBadRequest, "OneDrive account not connected")
		return
	}

	token, err := s.getValidOneDriveToken(sess.UID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "OneDrive authorization failed; please reconnect")
		return
	}

	// Strictly limit request size to 100 MiB to prevent memory exhaustion
	r.Body = http.MaxBytesReader(w, r.Body, 100*1024*1024)

	// Parse multipart form up to 64MB
	if err := r.ParseMultipartForm(64 * 1024 * 1024); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid multipart form data or payload too large")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		file, header, err = r.FormFile("pptx")
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "Missing file or pptx form field")
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read uploaded file")
		return
	}

	filename := header.Filename
	if filename == "" {
		filename = fmt.Sprintf("Service-%d.pptx", serviceID)
	}
	// Sanitize filename
	filename = filepath.Base(filename)
	filename = strings.ReplaceAll(filename, `\`, "")
	filename = strings.ReplaceAll(filename, `/`, "")
	if !strings.HasSuffix(strings.ToLower(filename), ".pptx") {
		filename += ".pptx"
	}

	targetFolderID := rec.TargetFolderID
	graphEndpoint := microsoftGraphURL
	if envGraph := os.Getenv("ONEDRIVE_GRAPH_URL"); envGraph != "" {
		graphEndpoint = envGraph
	}

	var webURL string
	var finalFilename string

	client := &http.Client{Timeout: 60 * time.Second}

	if len(fileBytes) < maxSimpleUploadBytes {
		// Simple PUT upload
		var uploadURL string
		escapedFilename := url.PathEscape(filename)
		if targetFolderID == "" || targetFolderID == "root" {
			uploadURL = fmt.Sprintf("%s/me/drive/root:/%s:/content?@microsoft.graph.conflictBehavior=rename", graphEndpoint, escapedFilename)
		} else {
			uploadURL = fmt.Sprintf("%s/me/drive/items/%s:/%s:/content?@microsoft.graph.conflictBehavior=rename", graphEndpoint, url.PathEscape(targetFolderID), escapedFilename)
		}

		req, err := http.NewRequestWithContext(r.Context(), "PUT", uploadURL, bytes.NewReader(fileBytes))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to create upload request")
			return
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("onedrive upload error: %v", err)
			writeError(w, http.StatusBadGateway, "Failed to upload to OneDrive")
			return
		}
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			log.Printf("onedrive upload non-200/201: %d %s", resp.StatusCode, string(respBytes))
			writeError(w, http.StatusBadGateway, "Microsoft Graph rejected the upload")
			return
		}

		var uploadResp struct {
			Name   string `json:"name"`
			WebURL string `json:"webUrl"`
		}
		if err := json.Unmarshal(respBytes, &uploadResp); err == nil {
			webURL = uploadResp.WebURL
			finalFilename = uploadResp.Name
		}
	} else {
		// Large upload session (>= 4 MiB)
		var sessionURL string
		escapedFilename := url.PathEscape(filename)
		if targetFolderID == "" || targetFolderID == "root" {
			sessionURL = fmt.Sprintf("%s/me/drive/root:/%s:/createUploadSession", graphEndpoint, escapedFilename)
		} else {
			sessionURL = fmt.Sprintf("%s/me/drive/items/%s:/%s:/createUploadSession", graphEndpoint, url.PathEscape(targetFolderID), escapedFilename)
		}

		sessionPayload := map[string]any{
			"item": map[string]any{
				"@microsoft.graph.conflictBehavior": "rename",
				"name":                              filename,
			},
		}
		sessionJSON, _ := json.Marshal(sessionPayload)

		reqSession, err := http.NewRequestWithContext(r.Context(), "POST", sessionURL, bytes.NewReader(sessionJSON))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to create upload session request")
			return
		}
		reqSession.Header.Set("Authorization", "Bearer "+token)
		reqSession.Header.Set("Content-Type", "application/json")

		respSession, err := client.Do(reqSession)
		if err != nil {
			log.Printf("onedrive createUploadSession error: %v", err)
			writeError(w, http.StatusBadGateway, "Failed to initiate OneDrive upload session")
			return
		}
		defer respSession.Body.Close()

		if respSession.StatusCode != http.StatusOK && respSession.StatusCode != http.StatusCreated {
			sBody, _ := io.ReadAll(respSession.Body)
			log.Printf("onedrive createUploadSession non-200: %d %s", respSession.StatusCode, string(sBody))
			writeError(w, http.StatusBadGateway, "Failed to start Microsoft Graph upload session")
			return
		}

		var sessionResp struct {
			UploadURL string `json:"uploadUrl"`
		}
		if err := json.NewDecoder(respSession.Body).Decode(&sessionResp); err != nil || sessionResp.UploadURL == "" {
			writeError(w, http.StatusBadGateway, "Invalid upload session response")
			return
		}

		totalBytes := len(fileBytes)
		for start := 0; start < totalBytes; start += uploadChunkSize {
			end := start + uploadChunkSize
			if end > totalBytes {
				end = totalBytes
			}
			chunk := fileBytes[start:end]

			reqChunk, err := http.NewRequestWithContext(r.Context(), "PUT", sessionResp.UploadURL, bytes.NewReader(chunk))
			if err != nil {
				writeError(w, http.StatusInternalServerError, "Failed to create chunk request")
				return
			}
			reqChunk.Header.Set("Content-Length", strconv.Itoa(len(chunk)))
			reqChunk.Header.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end-1, totalBytes))

			respChunk, err := client.Do(reqChunk)
			if err != nil {
				log.Printf("onedrive chunk upload error at %d-%d: %v", start, end, err)
				writeError(w, http.StatusBadGateway, "Failed to stream chunk to OneDrive")
				return
			}
			defer respChunk.Body.Close()

			if end < totalBytes {
				// Intermediate chunk must return 202 Accepted (or 200)
				if respChunk.StatusCode != http.StatusAccepted && respChunk.StatusCode != http.StatusOK {
					cBody, _ := io.ReadAll(respChunk.Body)
					log.Printf("onedrive intermediate chunk rejected: status %d body %s", respChunk.StatusCode, string(cBody))
					writeError(w, http.StatusBadGateway, "Microsoft Graph rejected intermediate upload chunk")
					return
				}
			} else {
				// Final chunk must return 200 OK or 201 Created with metadata
				if respChunk.StatusCode != http.StatusOK && respChunk.StatusCode != http.StatusCreated {
					cBody, _ := io.ReadAll(respChunk.Body)
					log.Printf("onedrive final chunk rejected: status %d body %s", respChunk.StatusCode, string(cBody))
					writeError(w, http.StatusBadGateway, "Microsoft Graph rejected final upload chunk")
					return
				}
				var itemResp struct {
					Name   string `json:"name"`
					WebURL string `json:"webUrl"`
				}
				if err := json.NewDecoder(respChunk.Body).Decode(&itemResp); err != nil || itemResp.WebURL == "" {
					log.Printf("onedrive final chunk metadata missing or invalid")
					writeError(w, http.StatusBadGateway, "Microsoft Graph final chunk response invalid")
					return
				}
				webURL = itemResp.WebURL
				finalFilename = itemResp.Name
			}
		}
	}

	if finalFilename == "" {
		finalFilename = filename
	}

	setNoStore(w)
	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"web_url":  webURL,
		"filename": finalFilename,
	})
}
