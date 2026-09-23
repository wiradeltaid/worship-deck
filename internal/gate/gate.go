package gate

import "strings"

var exemptPrefixes = []string{
	"/api/webhook",
	"/api/auth/login",
	"/api/auth/logout",
	"/login",
	"/assets",
	"/branding",
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
