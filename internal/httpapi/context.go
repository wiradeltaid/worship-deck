package httpapi

import (
	"context"
	"net/http"

	"github.com/wiradeltaid/worship-presenter-web/internal/auth"
)

type ctxKey int

const sessionCtxKey ctxKey = 1

func withSession(r *http.Request, s *auth.Session) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), sessionCtxKey, s))
}

func sessionFrom(r *http.Request) *auth.Session {
	s, _ := r.Context().Value(sessionCtxKey).(*auth.Session)
	return s
}

func requireSession(w http.ResponseWriter, r *http.Request) bool {
	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return false
	}
	return true
}
