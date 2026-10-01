package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type OneDriveFolderItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ChildCount   int    `json:"child_count"`
	LastModified string `json:"last_modified"`
	ParentID     string `json:"parent_id"`
}

// getValidOneDriveToken retrieves the user's access token, automatically refreshing it if expired.
func (s *Server) getValidOneDriveToken(userID int) (string, error) {
	rec, err := s.getOneDriveConfigForUser(userID)
	if err != nil {
		return "", err
	}
	if rec == nil || rec.AccessToken == "" {
		return "", fmt.Errorf("onedrive not connected")
	}

	// If token expires in less than 60 seconds and we have a refresh token, refresh it
	if rec.TokenExpiry > 0 && time.Now().Unix() >= (rec.TokenExpiry-60) && rec.RefreshToken != "" {
		tokenEndpoint := fmt.Sprintf(microsoftTokenURL, rec.TenantID)
		if envToken := os.Getenv("ONEDRIVE_TOKEN_URL"); envToken != "" {
			tokenEndpoint = envToken
		}

		form := url.Values{}
		form.Set("client_id", rec.ClientID)
		form.Set("grant_type", "refresh_token")
		form.Set("refresh_token", rec.RefreshToken)

		resp, err := http.PostForm(tokenEndpoint, form)
		if err != nil {
			log.Printf("onedrive: refresh token request failed: %v", err)
			return rec.AccessToken, nil // return existing token as fallback
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var tokenResp struct {
				AccessToken  string `json:"access_token"`
				RefreshToken string `json:"refresh_token"`
				ExpiresIn    int64  `json:"expires_in"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err == nil && tokenResp.AccessToken != "" {
				newExpiry := time.Now().Unix() + tokenResp.ExpiresIn
				newRefresh := rec.RefreshToken
				if tokenResp.RefreshToken != "" {
					newRefresh = tokenResp.RefreshToken
				}
				_, _ = s.DB.Exec(`
					UPDATE onedrive_configs
					SET access_token = ?, refresh_token = ?, token_expiry = ?, updated_at = datetime('now')
					WHERE user_id = ?
				`, tokenResp.AccessToken, newRefresh, newExpiry, userID)
				return tokenResp.AccessToken, nil
			}
		}
	}

	return rec.AccessToken, nil
}

func (s *Server) handleGetOneDriveFolders(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	token, err := s.getValidOneDriveToken(sess.UID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "OneDrive account not connected")
		return
	}

	parentID := strings.TrimSpace(r.URL.Query().Get("parent_id"))

	graphEndpoint := microsoftGraphURL
	if envGraph := os.Getenv("ONEDRIVE_GRAPH_URL"); envGraph != "" {
		graphEndpoint = envGraph
	}

	var reqURL string
	if parentID == "" || parentID == "root" {
		reqURL = graphEndpoint + "/me/drive/root/children?$filter=folder%20ne%20null&$select=id,name,parentReference,folder,lastModifiedDateTime"
	} else {
		reqURL = fmt.Sprintf("%s/me/drive/items/%s/children?$filter=folder%%20ne%%20null&$select=id,name,parentReference,folder,lastModifiedDateTime", graphEndpoint, url.PathEscape(parentID))
	}

	req, err := http.NewRequestWithContext(r.Context(), "GET", reqURL, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create Graph request")
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("onedrive: error querying graph folders: %v", err)
		writeError(w, http.StatusBadGateway, "Failed to reach Microsoft Graph API")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		writeError(w, http.StatusUnauthorized, "OneDrive authorization expired; please reconnect")
		return
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("onedrive: graph folders non-200: %d %s", resp.StatusCode, string(respBody))
		writeError(w, http.StatusBadGateway, "Microsoft Graph returned an error")
		return
	}

	var graphResp struct {
		Value []struct {
			ID           string `json:"id"`
			Name         string `json:"name"`
			LastModified string `json:"lastModifiedDateTime"`
			Folder       *struct {
				ChildCount int `json:"childCount"`
			} `json:"folder"`
			ParentReference *struct {
				ID string `json:"id"`
			} `json:"parentReference"`
		} `json:"value"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&graphResp); err != nil {
		log.Printf("onedrive: error decoding graph folders JSON: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to parse Graph API response")
		return
	}

	result := make([]OneDriveFolderItem, 0, len(graphResp.Value))
	for _, item := range graphResp.Value {
		childCount := 0
		if item.Folder != nil {
			childCount = item.Folder.ChildCount
		}
		parent := ""
		if item.ParentReference != nil {
			parent = item.ParentReference.ID
		}
		result = append(result, OneDriveFolderItem{
			ID:           item.ID,
			Name:         item.Name,
			ChildCount:   childCount,
			LastModified: item.LastModified,
			ParentID:     parent,
		})
	}

	setNoStore(w)
	writeJSON(w, http.StatusOK, result)
}
