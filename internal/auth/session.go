package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

const CookieName = "auth_session"
const SessionTTLSeconds = 60 * 60 * 24 * 7
const AuthSecretFilename = "auth-secret.dat"

var (
	sidPattern             = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)
	prohibitedPlaceholders = []string{
		"change-me",
		"your-secret-here",
		"secret",
		"password",
	}
	desktopInitMu     sync.Mutex
	desktopSecret     string
	desktopSecretInit bool
)

// ValidateSecret checks whether a given secret string is insecure or matches known placeholders.
// Note: Error messages MUST NOT embed the secret value itself to prevent secret leakage in logs.
func ValidateSecret(s string) error {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return nil
	}
	lower := strings.ToLower(trimmed)
	for _, p := range prohibitedPlaceholders {
		if lower == p || strings.HasPrefix(lower, p) {
			return fmt.Errorf("insecure secret placeholder matching %q is not permitted; please configure a secure random secret", p)
		}
	}
	return nil
}

// ValidateStartupSecrets validates that neither AUTH_SECRET nor JWT_SECRET uses known insecure placeholders.
func ValidateStartupSecrets() error {
	for _, envKey := range []string{"AUTH_SECRET", "JWT_SECRET"} {
		val := os.Getenv(envKey)
		if val != "" {
			if err := ValidateSecret(val); err != nil {
				return fmt.Errorf("%s invalid: %w", envKey, err)
			}
		}
	}
	return nil
}

// ResetDesktopSecretForTest resets desktop secret state for test isolation.
func ResetDesktopSecretForTest() {
	desktopInitMu.Lock()
	defer desktopInitMu.Unlock()
	desktopSecret = ""
	desktopSecretInit = false
}

// InitDesktopAuthSecret resolves or securely generates AUTH_SECRET for desktop mode.
// Priority:
// 1. Explicit AUTH_SECRET environment variable takes precedence.
// 2. Secret file in dataDir/auth-secret.dat.
// 3. Securely generated 32-byte secret persisted to dataDir/auth-secret.dat (0600 permissions, atomic creation).
func InitDesktopAuthSecret(dataDir string) (string, error) {
	desktopInitMu.Lock()
	defer desktopInitMu.Unlock()

	if envSecret := strings.TrimSpace(os.Getenv("AUTH_SECRET")); envSecret != "" {
		if err := ValidateSecret(envSecret); err != nil {
			return "", err
		}
		if len(envSecret) < 16 {
			return "", fmt.Errorf("AUTH_SECRET must be at least 16 characters long")
		}
		desktopSecret = envSecret
		desktopSecretInit = true
		return envSecret, nil
	}

	if dataDir == "" {
		return "", fmt.Errorf("desktop auth secret requires data directory to be set")
	}

	secretPath := filepath.Join(dataDir, AuthSecretFilename)
	if st, err := os.Stat(secretPath); err == nil {
		// Tighten permissions on non-Windows platforms if necessary
		if runtime.GOOS != "windows" && st.Mode().Perm()&0077 != 0 {
			_ = os.Chmod(secretPath, 0600)
		}
		data, err := os.ReadFile(secretPath)
		if err != nil {
			return "", fmt.Errorf("reading desktop auth secret from %s: %w", secretPath, err)
		}
		sec := strings.TrimSpace(string(data))
		if len(sec) < 32 {
			return "", fmt.Errorf("desktop auth secret in %s is malformed or too short (minimum 32 characters, got %d); refusal to silently overwrite existing session secret", secretPath, len(sec))
		}
		if err := ValidateSecret(sec); err != nil {
			return "", fmt.Errorf("desktop auth secret in %s is insecure: %w", secretPath, err)
		}
		desktopSecret = sec
		desktopSecretInit = true
		return sec, nil
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("checking desktop auth secret at %s: %w", secretPath, err)
	}

	// Generate 32 bytes cryptographically secure random bytes
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generating secure desktop auth secret: %w", err)
	}
	sec := base64.RawURLEncoding.EncodeToString(b)

	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return "", fmt.Errorf("creating data directory %q: %w", dataDir, err)
	}

	// Atomic creation using O_CREATE|O_EXCL to prevent race condition
	f, err := os.OpenFile(secretPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		if os.IsExist(err) {
			// Another process just created it - read it back
			return InitDesktopAuthSecret(dataDir)
		}
		return "", fmt.Errorf("creating desktop auth secret file at %s: %w", secretPath, err)
	}
	defer f.Close()

	if _, err := f.WriteString(sec); err != nil {
		return "", fmt.Errorf("writing desktop auth secret to %s: %w", secretPath, err)
	}

	desktopSecret = sec
	desktopSecretInit = true
	return sec, nil
}

type Session struct {
	UID  int    `json:"uid"`
	Role string `json:"role"`
	SID  string `json:"sid"`
	TV   int    `json:"tv"`
	Exp  int64  `json:"exp"`
}

func secret() (string, bool) {
	if s := strings.TrimSpace(os.Getenv("AUTH_SECRET")); s != "" {
		if len(s) < 16 || ValidateSecret(s) != nil {
			return "", false
		}
		return s, true
	}
	if desktopSecretInit && len(desktopSecret) >= 16 && ValidateSecret(desktopSecret) == nil {
		return desktopSecret, true
	}
	return "", false
}

func SecretOK() (string, bool) {
	return secret()
}

func Verify(token string) *Session {
	if token == "" {
		return nil
	}
	dot := strings.IndexByte(token, '.')
	if dot <= 0 || dot == len(token)-1 {
		return nil
	}
	payloadB64 := token[:dot]
	sigB64 := token[dot+1:]
	sec, ok := secret()
	if !ok {
		return nil
	}
	mac := hmac.New(sha256.New, []byte(sec))
	mac.Write([]byte(payloadB64))
	want := mac.Sum(nil)
	got, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil {
		return nil
	}
	if !hmac.Equal(want, got) {
		return nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil
	}
	var s Session
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil
	}
	if s.UID <= 0 || (s.Role != "admin" && s.Role != "operator") {
		return nil
	}
	if !sidPattern.MatchString(s.SID) || s.TV < 1 || s.Exp <= time.Now().Unix() {
		return nil
	}
	return &s
}

func GenerateSID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func Sign(uid int, role string, tv int) (string, error) {
	if role != "admin" && role != "operator" {
		return "", fmt.Errorf("signSession: invalid role")
	}
	if tv < 1 {
		return "", fmt.Errorf("signSession: tv must be an integer >= 1")
	}
	sid, err := GenerateSID()
	if err != nil {
		return "", err
	}
	return SignPayload(Session{
		UID:  uid,
		Role: role,
		SID:  sid,
		TV:   tv,
		Exp:  time.Now().Unix() + SessionTTLSeconds,
	})
}

func SignPayload(s Session) (string, error) {
	if !sidPattern.MatchString(s.SID) {
		return "", fmt.Errorf("signSession: sid is not a valid session id")
	}
	if s.TV < 1 {
		return "", fmt.Errorf("signSession: tv must be an integer >= 1")
	}
	sec, ok := secret()
	if !ok {
		return "", fmt.Errorf("AUTH_SECRET is not configured")
	}
	raw, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(sec))
	mac.Write([]byte(payloadB64))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payloadB64 + "." + sigB64, nil
}

func CookieSecure() bool {
	return os.Getenv("NODE_ENV") == "production"
}

func SetSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   SessionTTLSeconds,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   CookieSecure(),
	})
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   CookieSecure(),
	})
}
