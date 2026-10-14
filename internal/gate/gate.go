package gate

import "strings"

var exemptPrefixes = []string{
	"/api/webhook",
	"/api/auth/login",
	"/api/auth/logout",
	"/api/setup",
	"/api/settings/onedrive/callback",
	"/login",
	"/assets",
	"/branding",
}

// IsSetupPath reports whether the path is for initial desktop setup.
func IsSetupPath(pathname string) bool {
	return pathname == "/api/setup" || strings.HasPrefix(pathname, "/api/setup/")
}

// IsRemotePublicPath reports whether the path is exempt from session cookie checks
// for mobile remote control pairing and capability-token operations.
func IsRemotePublicPath(pathname string) bool {
	if pathname == "/remote" || strings.HasPrefix(pathname, "/remote/") {
		return true
	}
	if strings.HasPrefix(pathname, "/api/present/") && strings.Contains(pathname, "/remote/") {
		parts := strings.Split(pathname, "/")
		if len(parts) >= 6 && parts[1] == "api" && parts[2] == "present" && parts[4] == "remote" {
			switch parts[5] {
			case "claim", "stream", "resume", "intent":
				return true
			}
		}
	}
	return false
}

// IsGated reports whether the request path must pass the session check.
// Path is the URL path without query string.
func IsGated(pathname string) bool {
	if pathname == "" {
		pathname = "/"
	}
	if !strings.HasPrefix(pathname, "/") {
		pathname = "/" + pathname
	}
	if pathname == "/favicon.ico" {
		return false
	}
	if IsRemotePublicPath(pathname) {
		return false
	}
	for _, prefix := range exemptPrefixes {
		if pathname == prefix || strings.HasPrefix(pathname, prefix+"/") {
			return false
		}
	}
	return true
}

func IsAdminPath(pathname string) bool {
	return pathname == "/admin" ||
		strings.HasPrefix(pathname, "/admin/") ||
		strings.HasPrefix(pathname, "/api/admin")
}

func WantsJSON(pathname, accept string) bool {
	if strings.HasPrefix(pathname, "/api/") {
		return true
	}
	return strings.Contains(accept, "application/json")
}
