package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/wiradigitalid/worship-presenter-web/internal/auth"
	"github.com/wiradigitalid/worship-presenter-web/internal/gate"
	"github.com/wiradigitalid/worship-presenter-web/internal/plan"
	"github.com/wiradigitalid/worship-presenter-web/internal/pptx"
)

type Server struct {
	DB   *sql.DB
	Root string
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
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
	mux.HandleFunc("DELETE /api/services/{id}", s.deleteService)
	mux.HandleFunc("POST /api/services/{id}/song-sets/{variableName}/save-to-book", s.saveSongSetToBook)
	mux.HandleFunc("GET /api/song-set-entries", s.listSongSetEntriesForOperator)
	mux.HandleFunc("POST /api/upload", s.postUpload)
	mux.HandleFunc("POST /api/upload/from-url", s.postUploadFromURL)
	mux.HandleFunc("GET /api/uploads/{filename}", s.getUpload)
	mux.HandleFunc("GET /api/admin/accounts", s.listAccounts)
	mux.HandleFunc("POST /api/admin/accounts", s.createAccount)
	mux.HandleFunc("PATCH /api/admin/accounts/{id}", s.patchAccount)
	mux.HandleFunc("DELETE /api/admin/accounts/{id}", s.deleteAccount)
	mux.HandleFunc("GET /api/admin/settings", s.getSettings)
	mux.HandleFunc("PUT /api/admin/settings", s.putSettings)
	mux.HandleFunc("GET /api/admin/artifacts", s.listArtifacts)
	mux.HandleFunc("POST /api/admin/artifacts", s.createArtifact)
	mux.HandleFunc("POST /api/admin/artifacts/import-pptx", s.importPptx)
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
	mux.HandleFunc("DELETE /api/admin/background-library/{id}", s.deleteBackgroundLibraryImage)
	mux.HandleFunc("GET /api/background-library", s.listBackgroundLibraryForOperator)
	mux.HandleFunc("GET /api/admin/song-books", s.listSongBooks)
	mux.HandleFunc("POST /api/admin/song-books", s.createSongBook)
	mux.HandleFunc("PATCH /api/admin/song-books/{bookCode}", s.patchSongBook)
	mux.HandleFunc("DELETE /api/admin/song-books/{bookCode}", s.deleteSongBook)
	mux.HandleFunc("GET /api/song-books", s.listSongBooksForOperator)
	mux.HandleFunc("GET /api/hymns", s.getHymns)
	mux.HandleFunc("GET /api/scripture", s.getScripture)
	mux.HandleFunc("GET /api/bible-translations", s.getBibleTranslations)
	mux.HandleFunc("POST /api/present/{id}/remote/pair", s.postRemotePair)
	mux.HandleFunc("POST /api/present/{id}/remote/claim", s.postRemoteClaim)
	mux.HandleFunc("GET /api/present/{id}/remote/stream", s.getRemoteStream)
	mux.HandleFunc("POST /api/present/{id}/remote/intent", s.postRemoteIntent)
	mux.HandleFunc("DELETE /api/present/{id}/remote/pair", s.deleteRemotePair)
	mux.HandleFunc("POST /api/webhook", s.postWebhook)
	mux.HandleFunc("/", s.fallback)
	return s.gate(mux)
}

func (s *Server) gate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if !gate.IsGated(path) {
			next.ServeHTTP(w, r)
			return
		}
		setNoStore(w)
		cookie, _ := r.Cookie(auth.CookieName)
		token := ""
		if cookie != nil {
			token = cookie.Value
		}
		sess := auth.Verify(token)
		if sess == nil {
			unauthorized(w, r)
			return
		}
		current, err := auth.ValidateAgainstDB(s.DB, sess)
		if err != nil {
			log.Printf("Session re-check failed: %v", err)
			unauthorized(w, r)
			return
		}
		if current == nil {
			unauthorized(w, r)
			return
		}
		if gate.IsAdminPath(path) && current.Role != "admin" {
			forbidden(w, r)
			return
		}
		next.ServeHTTP(w, withSession(r, current))
	})
}

func setNoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Vary", "Cookie")
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
	payload, err := json.Marshal(map[string]interface{}{
		"serviceDate": date,
		"transition":  transition,
		"plan":        items,
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
		filepath.Join(s.Root, "public", rel),
		filepath.Join(s.Root, "spa", rel),
	}
	if rel == "" || rel == "login" || strings.HasPrefix(rel, "services") ||
		strings.HasPrefix(rel, "admin") || strings.HasSuffix(rel, "/") {
		candidates = append([]string{
			filepath.Join(s.Root, "spa", "dist", indexName),
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
