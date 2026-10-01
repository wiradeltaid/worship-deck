package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	microsoftAuthURL  = "https://login.microsoftonline.com/%s/oauth2/v2.0/authorize"
	microsoftTokenURL = "https://login.microsoftonline.com/%s/oauth2/v2.0/token"
	microsoftGraphURL = "https://graph.microsoft.com/v1.0"

	pkceMu    sync.Mutex
	pkceStore = make(map[string]pkceSession)
)

type pkceSession struct {
	State        string
	CodeVerifier string
	UserID       int
	TenantID     string
	ClientID     string
	RedirectURI  string
	ExpiresAt    time.Time
}

// OneDrivePublicConfig is returned to frontend clients.
// ABSENCE GUARD: Sensitive tokens (access_token, refresh_token) MUST NOT exist here.
type OneDrivePublicConfig struct {
	Connected        bool   `json:"connected"`
	AccountEmail     string `json:"account_email"`
	AccountName      string `json:"account_name"`
	TargetFolderID   string `json:"target_folder_id"`
	TargetFolderPath string `json:"target_folder_path"`
	SyncMode         string `json:"sync_mode"`
}

type onedriveConfigRecord struct {
	UserID           int
	ClientID         string
	TenantID         string
	AccessToken      string
	RefreshToken     string
	TokenExpiry      int64
	AccountEmail     string
	AccountName      string
	TargetFolderID   string
	TargetFolderPath string
	SyncMode         string
	UpdatedAt        string
}

func getOneDriveClientID() string {
	if cid := strings.TrimSpace(os.Getenv("ONEDRIVE_CLIENT_ID")); cid != "" {
		return cid
	}
	return "worshipdeck-onedrive-client"
}

func getOneDriveTenantID() string {
	if tid := strings.TrimSpace(os.Getenv("ONEDRIVE_TENANT_ID")); tid != "" {
		return tid
	}
	return "common"
}

func (s *Server) getOneDriveConfigForUser(userID int) (*onedriveConfigRecord, error) {
	row := s.DB.QueryRow(`
		SELECT user_id, client_id, tenant_id, access_token, refresh_token, token_expiry,
		       account_email, account_name, target_folder_id, target_folder_path, sync_mode, updated_at
		FROM onedrive_configs
		WHERE user_id = ?
	`, userID)

	var rec onedriveConfigRecord
	err := row.Scan(
		&rec.UserID, &rec.ClientID, &rec.TenantID, &rec.AccessToken, &rec.RefreshToken, &rec.TokenExpiry,
		&rec.AccountEmail, &rec.AccountName, &rec.TargetFolderID, &rec.TargetFolderPath, &rec.SyncMode, &rec.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (s *Server) handleGetOneDriveSettings(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	rec, err := s.getOneDriveConfigForUser(sess.UID)
	if err != nil {
		log.Printf("onedrive: error loading config: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	pub := OneDrivePublicConfig{
		Connected:        false,
		AccountEmail:     "",
		AccountName:      "",
		TargetFolderID:   "",
		TargetFolderPath: "",
		SyncMode:         "ask",
	}

	if rec != nil {
		pub.TargetFolderID = rec.TargetFolderID
		pub.TargetFolderPath = rec.TargetFolderPath
		if rec.SyncMode != "" {
			pub.SyncMode = rec.SyncMode
		}
		if rec.AccessToken != "" && rec.RefreshToken != "" {
			pub.Connected = true
			pub.AccountEmail = rec.AccountEmail
			pub.AccountName = rec.AccountName
		}
	}

	setNoStore(w)
	writeJSON(w, http.StatusOK, pub)
}

func (s *Server) handlePostOneDriveSettings(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	body, err, status, msg := readJSONObject(r, 64*1024)
	if err != nil {
		writeError(w, status, msg)
		return
	}

	rec, err := s.getOneDriveConfigForUser(sess.UID)
	if err != nil {
		log.Printf("onedrive: error loading config: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}

	syncMode := "ask"
	targetFolderID := ""
	targetFolderPath := ""

	if rec != nil {
		syncMode = rec.SyncMode
		targetFolderID = rec.TargetFolderID
		targetFolderPath = rec.TargetFolderPath
	}

	if sm, ok := body["sync_mode"].(string); ok {
		sm = strings.ToLower(strings.TrimSpace(sm))
		if sm != "ask" && sm != "always" && sm != "off" {
			writeError(w, http.StatusBadRequest, "Invalid sync_mode (must be 'ask', 'always', or 'off')")
			return
		}
		syncMode = sm
	}

	if fid, ok := body["target_folder_id"].(string); ok {
		targetFolderID = strings.TrimSpace(fid)
	}

	if fpath, ok := body["target_folder_path"].(string); ok {
		targetFolderPath = strings.TrimSpace(fpath)
	}

	clientID := getOneDriveClientID()
	tenantID := getOneDriveTenantID()
	if rec != nil && rec.ClientID != "" {
		clientID = rec.ClientID
	}
	if rec != nil && rec.TenantID != "" {
		tenantID = rec.TenantID
	}

	_, err = s.DB.Exec(`
		INSERT INTO onedrive_configs (
			user_id, client_id, tenant_id, target_folder_id, target_folder_path, sync_mode, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(user_id) DO UPDATE SET
			target_folder_id = excluded.target_folder_id,
			target_folder_path = excluded.target_folder_path,
			sync_mode = excluded.sync_mode,
			updated_at = datetime('now')
	`, sess.UID, clientID, tenantID, targetFolderID, targetFolderPath, syncMode)

	if err != nil {
		log.Printf("onedrive: error saving settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to save settings")
		return
	}

	pub := OneDrivePublicConfig{
		Connected:        rec != nil && rec.AccessToken != "",
		AccountEmail:     "",
		AccountName:      "",
		TargetFolderID:   targetFolderID,
		TargetFolderPath: targetFolderPath,
		SyncMode:         syncMode,
	}
	if rec != nil {
		pub.AccountEmail = rec.AccountEmail
		pub.AccountName = rec.AccountName
	}

	setNoStore(w)
	writeJSON(w, http.StatusOK, pub)
}

func (s *Server) handleDeleteOneDriveSettings(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	_, err := s.DB.Exec(`
		UPDATE onedrive_configs
		SET access_token = '', refresh_token = '', token_expiry = 0, account_email = '', account_name = '', updated_at = datetime('now')
		WHERE user_id = ?
	`, sess.UID)

	if err != nil {
		log.Printf("onedrive: error clearing tokens: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to disconnect account")
		return
	}

	setNoStore(w)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func generateRandomString(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func deriveCodeChallenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func (s *Server) handleGetOneDriveAuthURL(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	verifier, err := generateRandomString(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate PKCE verifier")
		return
	}

	state, err := generateRandomString(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate state token")
		return
	}

	challenge := deriveCodeChallenge(verifier)
	clientID := getOneDriveClientID()
	tenantID := getOneDriveTenantID()

	// Build redirect URI
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	if envURI := os.Getenv("ONEDRIVE_REDIRECT_URI"); envURI != "" {
		host = envURI
	}
	var redirectURI string
	if strings.HasPrefix(host, "http://") || strings.HasPrefix(host, "https://") {
		redirectURI = host
	} else {
		redirectURI = fmt.Sprintf("%s://%s/api/settings/onedrive/callback", scheme, host)
	}

	pkceMu.Lock()
	// Clean expired states
	now := time.Now()
	for k, v := range pkceStore {
		if now.After(v.ExpiresAt) {
			delete(pkceStore, k)
		}
	}
	pkceStore[state] = pkceSession{
		State:        state,
		CodeVerifier: verifier,
		UserID:       sess.UID,
		TenantID:     tenantID,
		ClientID:     clientID,
		RedirectURI:  redirectURI,
		ExpiresAt:    now.Add(5 * time.Minute),
	}
	pkceMu.Unlock()

	authBase := fmt.Sprintf(microsoftAuthURL, tenantID)
	if envAuth := os.Getenv("ONEDRIVE_AUTH_URL"); envAuth != "" {
		authBase = envAuth
	}

	params := url.Values{}
	params.Set("client_id", clientID)
	params.Set("response_type", "code")
	params.Set("redirect_uri", redirectURI)
	params.Set("response_mode", "query")
	params.Set("scope", "Files.ReadWrite offline_access User.Read")
	params.Set("state", state)
	params.Set("code_challenge", challenge)
	params.Set("code_challenge_method", "S256")

	authURL := fmt.Sprintf("%s?%s", authBase, params.Encode())

	setNoStore(w)
	writeJSON(w, http.StatusOK, map[string]any{
		"auth_url": authURL,
	})
}

func (s *Server) handleGetOneDriveCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("<html><body><h3>Authorization failed: missing code or state</h3></body></html>"))
		return
	}

	pkceMu.Lock()
	pSession, exists := pkceStore[state]
	if exists {
		delete(pkceStore, state)
	}
	pkceMu.Unlock()

	if !exists || time.Now().After(pSession.ExpiresAt) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("<html><body><h3>Authorization session expired or invalid</h3></body></html>"))
		return
	}

	tokenEndpoint := fmt.Sprintf(microsoftTokenURL, pSession.TenantID)
	if envToken := os.Getenv("ONEDRIVE_TOKEN_URL"); envToken != "" {
		tokenEndpoint = envToken
	}

	form := url.Values{}
	form.Set("client_id", pSession.ClientID)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", pSession.RedirectURI)
	form.Set("code_verifier", pSession.CodeVerifier)

	httpClient := &http.Client{Timeout: 15 * time.Second}

	resp, err := httpClient.PostForm(tokenEndpoint, form)
	if err != nil {
		log.Printf("onedrive: token exchange request error: %v", err)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("<html><body><h3>Token exchange failed</h3></body></html>"))
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("onedrive: token exchange non-200: %s", string(bodyBytes))
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("<html><body><h3>Token exchange returned error from identity provider</h3></body></html>"))
		return
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(bodyBytes, &tokenResp); err != nil {
		log.Printf("onedrive: token json unmarshal error: %v", err)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("<html><body><h3>Invalid token response</h3></body></html>"))
		return
	}

	tokenExpiry := time.Now().Unix() + tokenResp.ExpiresIn

	// Fetch user account details from Microsoft Graph /me
	accountEmail := ""
	accountName := ""
	graphEndpoint := microsoftGraphURL
	if envGraph := os.Getenv("ONEDRIVE_GRAPH_URL"); envGraph != "" {
		graphEndpoint = envGraph
	}

	reqMe, err := http.NewRequest("GET", graphEndpoint+"/me", nil)
	if err == nil {
		reqMe.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
		reqMe.Header.Set("Accept", "application/json")
		respMe, errMe := httpClient.Do(reqMe)
		if errMe == nil {
			defer respMe.Body.Close()
			if respMe.StatusCode == http.StatusOK {
				var meData struct {
					DisplayName       string `json:"displayName"`
					Mail              string `json:"mail"`
					UserPrincipalName string `json:"userPrincipalName"`
				}
				if json.NewDecoder(respMe.Body).Decode(&meData) == nil {
					accountName = meData.DisplayName
					accountEmail = meData.Mail
					if accountEmail == "" {
						accountEmail = meData.UserPrincipalName
					}
				}
			}
		}
	}

	// Persist tokens and metadata
	_, err = s.DB.Exec(`
		INSERT INTO onedrive_configs (
			user_id, client_id, tenant_id, access_token, refresh_token, token_expiry,
			account_email, account_name, sync_mode, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ask', datetime('now'))
		ON CONFLICT(user_id) DO UPDATE SET
			access_token = excluded.access_token,
			refresh_token = excluded.refresh_token,
			token_expiry = excluded.token_expiry,
			account_email = excluded.account_email,
			account_name = excluded.account_name,
			updated_at = datetime('now')
	`, pSession.UserID, pSession.ClientID, pSession.TenantID, tokenResp.AccessToken, tokenResp.RefreshToken, tokenExpiry, accountEmail, accountName)

	if err != nil {
		log.Printf("onedrive: error persisting tokens: %v", err)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("<html><body><h3>Failed to save credentials</h3></body></html>"))
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	html := `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OneDrive Connected</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 2rem; border-radius: 12px; text-align: center; border: 1px solid #334155; }
    h2 { color: #38bdf8; margin-top: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>OneDrive Connected Successfully</h2>
    <p>You can close this window now.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'ONEDRIVE_AUTH_SUCCESS' }, window.location.origin);
      }
    } catch (e) {}
    setTimeout(function() { window.close(); }, 600);
  </script>
</body>
</html>`
	w.Write([]byte(html))
}
