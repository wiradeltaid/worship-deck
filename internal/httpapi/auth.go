package httpapi

import (
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/wiradeltaid/worship-deck/internal/auth"
)

var positiveID = regexp.MustCompile(`^\d+$`)

const (
	invalidCredentials = "Invalid username or password"
	rateLimitedLogin   = "Too many login attempts. Try again later."
	maxUsernameInput   = 96
)

func (s *Server) getSetupStatus(w http.ResponseWriter, r *http.Request) {
	if !s.isDesktop() || !isLoopbackRequest(r) {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if s.DB == nil {
		writeError(w, http.StatusServiceUnavailable, "Database not available")
		return
	}
	count, err := auth.CountAccounts(s.DB)
	if err != nil {
		log.Printf("getSetupStatus error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"setupRequired": count == 0,
	})
}

func (s *Server) postSetupAdmin(w http.ResponseWriter, r *http.Request) {
	if !s.isDesktop() || !isLoopbackRequest(r) {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if s.DB == nil {
		writeError(w, http.StatusServiceUnavailable, "Database not available")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	username := asString(body["username"])
	password := asString(body["password"])

	acct, err := auth.CreateFirstAdmin(s.DB, username, password)
	if err != nil {
		if errors.Is(err, auth.ErrSetupAlreadyCompleted) {
			writeError(w, http.StatusForbidden, "Setup already completed")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	token, err := auth.Sign(acct.ID, acct.Role, acct.TokenVersion)
	if err != nil {
		log.Printf("postSetupAdmin session error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	auth.SetSessionCookie(w, token)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"role":     acct.Role,
		"username": acct.Username,
	})
}

func (s *Server) postLogin(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	rawUsername := asString(body["username"])
	password := asString(body["password"])
	if len(rawUsername) > maxUsernameInput || len(password) > auth.MaxPassword {
		writeError(w, http.StatusUnauthorized, invalidCredentials)
		return
	}
	username := strings.TrimSpace(rawUsername)
	if username == "" || password == "" {
		writeError(w, http.StatusUnauthorized, invalidCredentials)
		return
	}
	if _, ok := auth.SecretOK(); !ok {
		log.Printf("AUTH_SECRET is missing or shorter than 16 characters")
		writeError(w, http.StatusServiceUnavailable, "Auth not configured")
		return
	}
	clientIP := auth.ClientIP(r)
	limit := auth.CheckLoginRateLimit(s.DB, username, clientIP)
	if limit.Limited {
		w.Header().Set("Retry-After", strconv.Itoa(limit.RetryAfterSeconds))
		writeError(w, http.StatusTooManyRequests, rateLimitedLogin)
		return
	}
	account := auth.Authenticate(s.DB, username, password)
	if account == nil {
		auth.RecordLoginFailure(s.DB, username, clientIP)
		writeError(w, http.StatusUnauthorized, invalidCredentials)
		return
	}
	auth.ClearLoginFailures(s.DB, account.Username, clientIP)
	token, err := auth.Sign(account.ID, account.Role, account.TokenVersion)
	if err != nil {
		log.Printf("Login error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	auth.SetSessionCookie(w, token)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"role":     account.Role,
		"username": account.Username,
	})
}

func (s *Server) postLogout(w http.ResponseWriter, r *http.Request) {
	accept := r.Header.Get("Accept")
	wantsJSON := strings.Contains(accept, "application/json")
	cookie, _ := r.Cookie(auth.CookieName)
	token := ""
	if cookie != nil {
		token = cookie.Value
	}
	sess := auth.Verify(token)
	if sess != nil {
		if err := auth.RevokeSession(s.DB, sess.SID, sess.Exp); err != nil {
			log.Printf("Logout revocation failed: %v", err)
			if wantsJSON {
				writeError(w, http.StatusInternalServerError, "Logout failed")
				return
			}
			http.Error(w, "Logout failed", http.StatusInternalServerError)
			return
		}
	}
	auth.ClearSessionCookie(w)
	if wantsJSON {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (s *Server) postChangePassword(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	currentPassword, _ := body["currentPassword"].(string)
	newPassword, _ := body["newPassword"].(string)
	if currentPassword == "" {
		writeError(w, http.StatusBadRequest, "Current password is required")
		return
	}
	if newPassword == "" || len(newPassword) < 8 {
		writeError(w, http.StatusBadRequest, "Password must be at least 8 characters long")
		return
	}
	if len(newPassword) > auth.MaxPassword {
		writeError(w, http.StatusBadRequest, "Password must be at most 128 characters")
		return
	}
	account, err := auth.LookupAccount(s.DB, sess.UID)
	if err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if account == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	clientIP := auth.ClientIP(r)
	limit := auth.CheckLoginRateLimit(s.DB, account.Username, clientIP)
	if limit.Limited {
		w.Header().Set("Retry-After", strconv.Itoa(limit.RetryAfterSeconds))
		writeError(w, http.StatusTooManyRequests, "Too many attempts. Try again later.")
		return
	}
	if len(currentPassword) > auth.MaxPassword {
		writeError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}
	if !auth.VerifyPassword(currentPassword, account.PasswordHash) {
		auth.RecordLoginFailure(s.DB, account.Username, clientIP)
		writeError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}
	auth.ClearLoginFailures(s.DB, account.Username, clientIP)

	tx, err := s.DB.Begin()
	if err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer tx.Rollback()
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if _, err := tx.Exec(`UPDATE accounts SET password_hash = ? WHERE id = ?`, hash, sess.UID); err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if _, err := tx.Exec(`UPDATE accounts SET token_version = token_version + 1 WHERE id = ?`, sess.UID); err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var tv int
	if err := tx.QueryRow(`SELECT token_version FROM accounts WHERE id = ?`, sess.UID).Scan(&tv); err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	token, err := auth.Sign(account.ID, account.Role, tv)
	if err != nil {
		log.Printf("Password change error: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	auth.SetSessionCookie(w, token)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) getSession(w http.ResponseWriter, r *http.Request) {
	locale := s.uiLocale()
	sess := sessionFrom(r)
	if sess == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error":      "Unauthorized",
			"ui_locale":  locale,
		})
		return
	}
	acct, err := auth.LookupAccount(s.DB, sess.UID)
	if err != nil || acct == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error":      "Unauthorized",
			"ui_locale":  locale,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"username":  acct.Username,
		"role":      acct.Role,
		"id":        acct.ID,
		"ui_locale": locale,
	})
}

func isClientAccountError(message string) bool {
	m := strings.ToLower(message)
	return strings.Contains(m, "username") ||
		strings.Contains(m, "password") ||
		strings.Contains(m, "role") ||
		strings.Contains(m, "already exists") ||
		strings.Contains(m, "required") ||
		strings.Contains(m, "too long") ||
		strings.Contains(m, "may only") ||
		strings.Contains(m, "not found") ||
		strings.Contains(m, "last admin") ||
		strings.Contains(m, "invalid")
}

func (s *Server) listAccounts(w http.ResponseWriter, r *http.Request) {
	accounts, err := auth.ListAccounts(s.DB)
	if err != nil {
		log.Printf("Error listing accounts: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"accounts": accounts})
}

func (s *Server) createAccount(w http.ResponseWriter, r *http.Request) {
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	username := asString(body["username"])
	password := asString(body["password"])
	role, _ := body["role"].(string)
	account, err := auth.CreateAccount(s.DB, username, password, role)
	if err != nil {
		if isClientAccountError(err.Error()) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("Error creating account: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"account": account})
}

func (s *Server) patchAccount(w http.ResponseWriter, r *http.Request) {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid account id")
		return
	}
	body, err, status, msg := readJSONObject(r, 1<<20)
	if err != nil {
		writeError(w, status, msg)
		return
	}
	var role *string
	var password *string
	if _, has := body["role"]; has {
		rstr, _ := body["role"].(string)
		role = &rstr
	}
	if _, has := body["password"]; has {
		p := asString(body["password"])
		password = &p
	}
	if role == nil && password == nil {
		writeError(w, http.StatusBadRequest, "Provide role and/or password to update")
		return
	}

	account, err := auth.UpdateAccount(s.DB, id, role, password)
	if err != nil {
		if isClientAccountError(err.Error()) {
			st := http.StatusBadRequest
			if strings.Contains(strings.ToLower(err.Error()), "not found") {
				st = http.StatusNotFound
			}
			writeError(w, st, err.Error())
			return
		}
		log.Printf("Error updating account: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	var tokenVersion *int
	if password != nil {
		tv, err := auth.BumpTokenVersion(s.DB, id)
		if err != nil {
			log.Printf("Error updating account: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		tokenVersion = &tv
	}
	if tokenVersion != nil && id == sess.UID {
		token, err := auth.Sign(account.ID, account.Role, *tokenVersion)
		if err != nil {
			log.Printf("Error updating account: %v", err)
			writeError(w, http.StatusInternalServerError, "Internal Server Error")
			return
		}
		auth.SetSessionCookie(w, token)
	}
	writeJSON(w, http.StatusOK, map[string]any{"account": account})
}

func (s *Server) deleteAccount(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePositiveID(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid account id")
		return
	}
	if err := auth.DeleteAccount(s.DB, id); err != nil {
		if isClientAccountError(err.Error()) {
			st := http.StatusBadRequest
			if strings.Contains(strings.ToLower(err.Error()), "not found") {
				st = http.StatusNotFound
			}
			writeError(w, st, err.Error())
			return
		}
		log.Printf("Error deleting account: %v", err)
		writeError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func parsePositiveID(raw string) (int, bool) {
	if !positiveID.MatchString(raw) {
		return 0, false
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return 0, false
	}
	return n, true
}
