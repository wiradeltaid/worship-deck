package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/wiradeltaid/worship-deck/internal/auth"
	"github.com/wiradeltaid/worship-deck/internal/gate"
	"github.com/wiradeltaid/worship-deck/internal/plan"
	"github.com/wiradeltaid/worship-deck/internal/pptx"
)

type Server struct {
	DB        *sql.DB
	Root      string
	IsDesktop bool
}

func (s *Server) isDesktop() bool {
	return s.IsDesktop || os.Getenv("DESKTOP") == "1"
}

func isLoopbackRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip != nil && ip.IsLoopback() {
		return true
	}
	return host == "127.0.0.1" || host == "::1" || host == "localhost"
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/setup/status", s.getSetupStatus)
	mux.HandleFunc("POST /api/setup/admin", s.postSetupAdmin)
	mux.HandleFunc("POST /api/auth/login", s.postLogin)
	mux.HandleFunc("POST /api/auth/logout", s.postLogout)
	mux.HandleFunc("POST /api/auth/change-password", s.postChangePassword)
	mux.HandleFunc("GET /api/session", s.getSession)
	mux.HandleFunc("GET /api/services", s.listServices)
	mux.HandleFunc("POST /api/services", s.createService)
	mux.HandleFunc("POST /api/services/preview", s.previewService)
	mux.HandleFunc("GET /api/services/{id}/pptx", s.getPptx)
	mux.HandleFunc("POST /api/services/{id}/sync-artifact", s.syncArtifact)
	mux.HandleFunc("GET /api/services/{id}", s.getService)
	mux.HandleFunc("PUT /api/services/{id}", s.updateService)
	mux.HandleFunc("PATCH /api/services/{id}", s.patchService)
	mux.HandleFunc("DELETE /api/services/{id}", s.deleteService)
	mux.HandleFunc("POST /api/services/{id}/song-sets/{variableName}/save-to-book", s.saveSongSetToBook)
	mux.HandleFunc("GET /api/song-set-entries", s.listSongSetEntriesForOperator)
	mux.HandleFunc("POST /api/upload", s.postUpload)
	mux.HandleFunc("POST /api/upload/from-url", s.postUploadFromURL)
	mux.HandleFunc("GET /api/uploads/{filename}", s.getUpload)
	mux.HandleFunc("GET /api/fonts", s.listFonts)
	mux.HandleFunc("GET /api/fonts/{id}", s.getFont)
	mux.HandleFunc("GET /api/admin/accounts", s.listAccounts)
	mux.HandleFunc("POST /api/admin/accounts", s.createAccount)
	mux.HandleFunc("PATCH /api/admin/accounts/{id}", s.patchAccount)
	mux.HandleFunc("DELETE /api/admin/accounts/{id}", s.deleteAccount)
	mux.HandleFunc("GET /api/admin/settings", s.getSettings)
	mux.HandleFunc("PUT /api/admin/settings", s.putSettings)
	mux.HandleFunc("GET /api/admin/artifacts", s.listArtifacts)
	mux.HandleFunc("POST /api/admin/artifacts", s.createArtifact)
	mux.HandleFunc("POST /api/admin/artifacts/import-pptx", s.importPptx)
	mux.HandleFunc("POST /api/admin/fonts", s.uploadFont)
	mux.HandleFunc("POST /api/admin/artifacts/fonts", s.uploadFont)
	mux.HandleFunc("DELETE /api/admin/fonts/{id}", s.deleteFont)
	mux.HandleFunc("DELETE /api/admin/artifacts/fonts/{id}", s.deleteFont)
	mux.HandleFunc("POST /api/admin/reset-factory", s.handleResetFactory)
	mux.HandleFunc("GET /api/admin/artifacts/{id}", s.getArtifact)
	mux.HandleFunc("PUT /api/admin/artifacts/{id}", s.putArtifact)
	mux.HandleFunc("PATCH /api/admin/artifacts/{id}", s.patchArtifact)
	mux.HandleFunc("DELETE /api/admin/artifacts/{id}", s.deleteArtifact)
	mux.HandleFunc("POST /api/admin/artifacts/{id}/reset", s.resetArtifact)
	mux.HandleFunc("PUT /api/admin/artifacts/order", s.reorderArtifacts)
	mux.HandleFunc("GET /api/admin/song-set-entries", s.listSongSetEntries)
	mux.HandleFunc("POST /api/admin/song-set-entries", s.createSongSetEntry)
	mux.HandleFunc("PATCH /api/admin/song-set-entries/{variableName}", s.patchSongSetEntry)
	mux.HandleFunc("DELETE /api/admin/song-set-entries/{variableName}", s.deleteSongSetEntry)
	mux.HandleFunc("GET /api/admin/song-set-layouts/{role}", s.getSongSetLayout)
	mux.HandleFunc("PUT /api/admin/song-set-layouts/{role}", s.putSongSetLayout)
	mux.HandleFunc("POST /api/admin/song-set-layouts/{role}/reset", s.resetSongSetLayout)
	mux.HandleFunc("GET /api/admin/announcement-sets", s.listAnnouncementSets)
	mux.HandleFunc("POST /api/admin/announcement-sets", s.createAnnouncementSet)
	mux.HandleFunc("PATCH /api/admin/announcement-sets/{id}", s.patchAnnouncementSet)
	mux.HandleFunc("DELETE /api/admin/announcement-sets/{id}", s.deleteAnnouncementSet)
	mux.HandleFunc("GET /api/admin/announcement-sets/{id}/slides", s.listAnnouncementSetSlides)
	mux.HandleFunc("POST /api/admin/announcement-sets/{id}/slides", s.createAnnouncementSetSlide)
	mux.HandleFunc("GET /api/admin/announcement-sets/{id}/slides/{slideId}", s.getAnnouncementSetSlide)
	mux.HandleFunc("PUT /api/admin/announcement-sets/{id}/slides/{slideId}", s.putAnnouncementSetSlide)
	mux.HandleFunc("PATCH /api/admin/announcement-sets/{id}/slides/{slideId}", s.patchAnnouncementSetSlide)
	mux.HandleFunc("POST /api/admin/announcement-sets/{id}/slides/{slideId}/reset", s.resetAnnouncementSetSlide)
	mux.HandleFunc("DELETE /api/admin/announcement-sets/{id}/slides/{slideId}", s.deleteAnnouncementSetSlide)
	mux.HandleFunc("PUT /api/admin/announcement-sets/{id}/slides/order", s.reorderAnnouncementSetSlides)
	mux.HandleFunc("GET /api/admin/background-library", s.listBackgroundLibrary)
	mux.HandleFunc("POST /api/admin/background-library", s.createBackgroundLibraryImage)
	mux.HandleFunc("PATCH /api/admin/background-library/{id}", s.patchBackgroundLibraryImage)
	mux.HandleFunc("POST /api/admin/background-library/{id}/replace", s.replaceBackgroundLibraryImage)
	mux.HandleFunc("DELETE /api/admin/background-library/{id}", s.deleteBackgroundLibraryImage)
	mux.HandleFunc("PUT /api/admin/background-defaults/{role}", s.putBackgroundDefaultRole)
	mux.HandleFunc("DELETE /api/admin/background-defaults/{role}", s.deleteBackgroundDefaultRole)
	mux.HandleFunc("GET /api/background-library", s.listBackgroundLibraryForOperator)
	mux.HandleFunc("GET /api/admin/media-library", s.listBackgroundLibrary)
	mux.HandleFunc("POST /api/admin/media-library", s.createBackgroundLibraryImage)
	mux.HandleFunc("PATCH /api/admin/media-library/{id}", s.patchBackgroundLibraryImage)
	mux.HandleFunc("POST /api/admin/media-library/{id}/replace", s.replaceBackgroundLibraryImage)
	mux.HandleFunc("DELETE /api/admin/media-library/{id}", s.deleteBackgroundLibraryImage)
	mux.HandleFunc("GET /api/media-library", s.listBackgroundLibraryForOperator)
	mux.HandleFunc("GET /api/admin/song-books", s.listSongBooks)
	mux.HandleFunc("POST /api/admin/song-books", s.createSongBook)
	mux.HandleFunc("PATCH /api/admin/song-books/{bookCode}", s.patchSongBook)
	mux.HandleFunc("DELETE /api/admin/song-books/{bookCode}", s.deleteSongBook)
	mux.HandleFunc("GET /api/song-books", s.listSongBooksForOperator)
	mux.HandleFunc("GET /api/worship-form-layout", s.getWorshipFormLayout)
	mux.HandleFunc("POST /api/admin/form-groupings", s.createOrUpdateFormGrouping)
	mux.HandleFunc("DELETE /api/admin/form-groupings/{id}", s.deleteFormGrouping)
	mux.HandleFunc("PUT /api/admin/form-groupings/reorder", s.reorderFormGroupings)
	mux.HandleFunc("POST /api/admin/form-grouping-slots", s.createFormGroupingSlot)
	mux.HandleFunc("DELETE /api/admin/form-grouping-slots/{id}", s.deleteFormGroupingSlot)
	mux.HandleFunc("PUT /api/admin/form-grouping-slots/reorder", s.reorderFormGroupingSlots)
	mux.HandleFunc("POST /api/admin/form-grouping-slots/{id}/move-grouping", s.moveFormGroupingSlot)
	mux.HandleFunc("POST /api/admin/predefined-fields", s.createOrUpdatePredefinedField)
	mux.HandleFunc("DELETE /api/admin/predefined-fields/{id}", s.deletePredefinedField)
	mux.HandleFunc("POST /api/admin/predefined-fields/seed-defaults", s.seedDefaultPredefinedFields)
	mux.HandleFunc("PUT /api/admin/song-set-entries/{variableName}/extraction-regex", s.updateSongSetEntryExtractionRegex)
	mux.HandleFunc("GET /api/hymns", s.getHymns)
	mux.HandleFunc("GET /api/scripture", s.getScripture)
	mux.HandleFunc("GET /api/bible-translations", s.getBibleTranslations)
	mux.HandleFunc("POST /api/present/{id}/remote/pair", s.postRemotePair)
	mux.HandleFunc("GET /api/present/{id}/remote/pair", s.getRemotePairStatus)
	mux.HandleFunc("POST /api/present/{id}/remote/claim", s.postRemoteClaim)
	mux.HandleFunc("GET /api/present/{id}/remote/stream", s.getRemoteStream)
	mux.HandleFunc("POST /api/present/{id}/remote/intent", s.postRemoteIntent)
	mux.HandleFunc("DELETE /api/present/{id}/remote/pair", s.deleteRemotePair)
	mux.HandleFunc("POST /api/sync/push", s.syncPush)
	mux.HandleFunc("GET /api/sync/pull", s.syncPull)
	mux.HandleFunc("GET /api/sync/status", s.syncStatus)
	mux.HandleFunc("POST /api/sync/assets/check", s.syncAssetsCheck)
	mux.HandleFunc("POST /api/sync/assets/upload", s.syncAssetUpload)
	mux.HandleFunc("GET /api/sync/assets/{sha256}", s.syncAssetDownload)
	mux.HandleFunc("POST /api/webhook", s.postWebhook)

	// SPEC-95: Microsoft OneDrive Cloud Connector
	mux.HandleFunc("GET /api/settings/onedrive", s.handleGetOneDriveSettings)
	mux.HandleFunc("POST /api/settings/onedrive", s.handlePostOneDriveSettings)
	mux.HandleFunc("GET /api/settings/onedrive/auth-url", s.handleGetOneDriveAuthURL)
	mux.HandleFunc("GET /api/settings/onedrive/callback", s.handleGetOneDriveCallback)
	mux.HandleFunc("DELETE /api/settings/onedrive", s.handleDeleteOneDriveSettings)
	mux.HandleFunc("GET /api/settings/onedrive/folders", s.handleGetOneDriveFolders)
	mux.HandleFunc("POST /api/services/{id}/onedrive-upload", s.handlePostOneDriveUpload)

	mux.HandleFunc("/", s.fallback)
	return s.gate(mux)
}

func isCORSPath(pathname string) bool {
	return pathname == "/api/sync" ||
		strings.HasPrefix(pathname, "/api/sync/") ||
		pathname == "/api/auth/login"
}

func isSyncPath(pathname string) bool {
	return pathname == "/api/sync" || strings.HasPrefix(pathname, "/api/sync/")
}

func (s *Server) isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	allowedEnv := strings.TrimSpace(os.Getenv("SYNC_ALLOWED_ORIGINS"))
	var patterns []string
	if allowedEnv != "" {
		for _, part := range strings.Split(allowedEnv, ",") {
			p := strings.TrimSpace(part)
			if p != "" {
				patterns = append(patterns, p)
			}
		}
	}
	if allowedEnv == "" || s.isDesktop() {
		patterns = append(patterns, "http://localhost:*", "http://127.0.0.1:*", "https://localhost:*", "https://127.0.0.1:*")
	}

	for _, pattern := range patterns {
		if pattern == "*" {
			return true
		}
		if pattern == origin || strings.EqualFold(pattern, origin) {
			return true
		}
		if strings.HasSuffix(pattern, ":*") {
			prefix := strings.TrimSuffix(pattern, ":*")
			if origin == prefix || strings.HasPrefix(origin, prefix+":") {
				return true
			}
		}
	}
	return false
}

func (s *Server) gate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if isCORSPath(path) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if s.isOriginAllowed(origin) {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					if r.Method == http.MethodOptions {
						w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
						w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Content-SHA256, X-Asset-Identifier, X-Filename")
						w.Header().Set("Access-Control-Max-Age", "86400")
						w.Header().Set("Vary", "Origin")
						w.WriteHeader(http.StatusNoContent)
						return
					}
					w.Header().Add("Vary", "Origin")
				} else if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			} else if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}

		if !gate.IsGated(path) {
			next.ServeHTTP(w, r)
			return
		}
		setNoStore(w)

		var current *auth.Session
		cookie, _ := r.Cookie(auth.CookieName)
		if cookie != nil && cookie.Value != "" {
			if sess := auth.Verify(cookie.Value); sess != nil {
				if dbSess, err := auth.ValidateAgainstDB(s.DB, sess); err == nil && dbSess != nil {
					current = dbSess
				}
			}
		}

		// On sync paths: if cookie is absent, invalid, expired, or non-admin, fall back to Authorization: Bearer <token>
		if isSyncPath(path) && (current == nil || current.Role != "admin") {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				bearerToken := strings.TrimPrefix(authHeader, "Bearer ")
				if bearerSess := auth.Verify(bearerToken); bearerSess != nil {
					if bearerCurrent, err := auth.ValidateAgainstDB(s.DB, bearerSess); err == nil && bearerCurrent != nil {
						current = bearerCurrent
					}
				}
			}
		}

		if current == nil {
			unauthorized(w, r)
			return
		}

		if (gate.IsAdminPath(path) || isSyncPath(path)) && current.Role != "admin" {
			forbidden(w, r)
			return
		}
		next.ServeHTTP(w, withSession(r, current))
	})
}

func setNoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "private, no-store")
	if strings.Contains(w.Header().Get("Vary"), "Origin") {
		w.Header().Set("Vary", "Origin, Cookie")
	} else {
		w.Header().Set("Vary", "Cookie")
	}
}

func unauthorized(w http.ResponseWriter, r *http.Request) {
	setNoStore(w)
	if gate.WantsJSON(r.URL.Path, r.Header.Get("Accept")) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"Unauthorized"}`))
		return
	}
	login := "/login"
	next := auth.SafeNextPath(r.URL.RequestURI())
	if next != "/" {
		login += "?next=" + url.QueryEscape(next)
	}
	http.Redirect(w, r, login, http.StatusTemporaryRedirect)
}

func forbidden(w http.ResponseWriter, r *http.Request) {
	setNoStore(w)
	if strings.HasPrefix(r.URL.Path, "/api/") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":"Forbidden"}`))
		return
	}
	http.Error(w, "Forbidden", http.StatusForbidden)
}

func parseWordWrapParam(param string) bool {
	wrapParam := strings.ToLower(strings.TrimSpace(param))
	if wrapParam == "false" || wrapParam == "0" {
		return false
	}
	return true
}

func (s *Server) getPptx(w http.ResponseWriter, r *http.Request) {
	setNoStore(w)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		http.Error(w, "Invalid Service ID", http.StatusBadRequest)
		return
	}
	date, items, transition, err := plan.PlanForService(s.DB, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "Service not found or not parsed", http.StatusNotFound)
			return
		}
		log.Printf("Error generating PPTX: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	fontManifest, _ := s.getFontManifest(r.Context())
	wordWrap := parseWordWrapParam(r.URL.Query().Get("wrap"))

	payload, err := json.Marshal(map[string]interface{}{
		"serviceDate": date,
		"transition":  transition,
		"plan":        items,
		"fonts":       fontManifest,
		"wordWrap":    wordWrap,
	})
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	buf, err := pptx.Draw(s.Root, payload)
	if err != nil {
		log.Printf("Error generating PPTX: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
	w.Header().Set("Content-Disposition", `attachment; filename="Service-`+date+`.pptx"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buf)
}

func spaIndexName(pathname string) string {
	if strings.HasSuffix(pathname, "/slideshow") || strings.HasSuffix(pathname, "/projector") {
		return "projected.html"
	}
	return "index.html"
}

func (s *Server) fallback(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		if r.URL.Path == "/api/auth/login" || r.URL.Path == "/api/auth/logout" ||
			strings.HasPrefix(r.URL.Path, "/api/webhook") {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}
	indexName := spaIndexName(r.URL.Path)
	rel := strings.TrimPrefix(r.URL.Path, "/")
	candidates := []string{
		filepath.Join(s.Root, "spa", "dist", rel),
		filepath.Join(s.Root, "dist", rel),
		filepath.Join(s.Root, "public", rel),
		filepath.Join(s.Root, "spa", rel),
	}
	if rel == "" || rel == "login" || strings.HasPrefix(rel, "services") ||
		strings.HasPrefix(rel, "admin") || strings.HasSuffix(rel, "/") {
		candidates = append([]string{
			filepath.Join(s.Root, "spa", "dist", indexName),
			filepath.Join(s.Root, "dist", indexName),
			filepath.Join(s.Root, "spa", indexName),
			filepath.Join(s.Root, "public", "index.html"),
		}, candidates...)
	}
	for _, p := range candidates {
		if !strings.HasPrefix(filepath.Clean(p), filepath.Clean(s.Root)) {
			continue
		}
		st, err := os.Stat(p)
		if err != nil || st.IsDir() {
			continue
		}
		http.ServeFile(w, r, p)
		return
	}
	index := filepath.Join(s.Root, "spa", "dist", indexName)
	if _, err := os.Stat(index); err != nil {
		index = filepath.Join(s.Root, "spa", indexName)
	}
	if _, err := os.Stat(index); err == nil {
		http.ServeFile(w, r, index)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, "Worship Presenter Web API\n")
}
