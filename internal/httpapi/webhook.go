package httpapi

import (
	"net/http"
)

// WebhookDisabledMessage is returned unconditionally by POST /api/webhook for 0.1.0 release (Owner Decision Q1).
const WebhookDisabledMessage = "Webhook intake is disabled in this release"

func (s *Server) postWebhook(w http.ResponseWriter, r *http.Request) {
	// WSD-H-05: Webhook intake is paused for 0.1.0 release (Owner Decision Q1).
	// Unconditionally return HTTP 503 Service Unavailable before reading request body.
	writeError(w, http.StatusServiceUnavailable, WebhookDisabledMessage)
}
