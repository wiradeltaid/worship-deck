package httpapi

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Timing constants for remote control and pairing (Story 5-1 / OQ-53).
//
// Sizing rationale (OQ-53):
// - PairingCodeLifetime: 60s (1 minute).
//   Long enough for the Operator to view the code on the presenter laptop,
//   pick up their phone, and enter the 6-digit code comfortably without rushing,
//   while short enough that an unclaimed code on an unattended screen does not
//   remain an open invitation.
// - StreamFreshnessWindow: 15s.
//   Provides a reliable heartbeat and freshness window for SSE streams,
//   absorbing temporary Wi-Fi jitter in a worship hall while detecting dead
//   connections in single-digit/low-double-digit seconds.
// OQ-53 asks for ONE exported pair read by both ends. These two constants are
// that pair, and the server is the single source: the pair response carries
// `expiresIn` so a client never declares its own copy. A parallel TypeScript
// declaration existed briefly and was deleted — Go cannot read a .ts file, so
// two files would have been two units each picking an honest number, which is
// exactly how AD-29's projector heartbeat once reported a healthy screen dead.
const (
	PairingCodeLifetime   = 60 * time.Second
	StreamFreshnessWindow = 15 * time.Second
)

// Allowed intent types on PresentMessage (src/lib/present-channel.ts).
// Six intents exist: sync, blank, transition, background, scripture, clear-scripture.
var allowedIntentTypes = map[string]bool{
	"sync":            true,
	"blank":           true,
	"transition":      true,
	"background":      true,
	"scripture":       true,
	"clear-scripture": true,
}

type clientChan chan []byte

type remoteSessionState struct {
	mu sync.Mutex

	serviceID int

	// Presenting client identity (session UID or unique connection token)
	presenterUID int

	// Pairing code state
	pendingCode   string
	codeExpiresAt time.Time

	// Remote client identity (session UID or token)
	pairedRemoteUID int
	hasPairedRemote bool

	// Cached last known presentation state to return on claim or stream reconnect
	lastState json.RawMessage

	// SSE listeners
	presenterChans map[clientChan]struct{}
	remoteChans    map[clientChan]struct{}
}

type RemoteHub struct {
	mu         sync.Mutex
	sessions   map[int]*remoteSessionState // keyed by serviceID
	syncActive bool
}

var globalRemoteHub = &RemoteHub{
	sessions: make(map[int]*remoteSessionState),
}

func (h *RemoteHub) getOrCreateSession(serviceID int) *remoteSessionState {
	h.mu.Lock()
	defer h.mu.Unlock()
	sess, ok := h.sessions[serviceID]
	if !ok {
		sess = &remoteSessionState{
			serviceID:      serviceID,
			presenterChans: make(map[clientChan]struct{}),
			remoteChans:    make(map[clientChan]struct{}),
		}
		h.sessions[serviceID] = sess
	}
	return sess
}

var testPresenterActiveOverride bool
var testPresenterOverrideMutex sync.Mutex

// SetActivePresenterForTest allows simulated testing of the Presenter Liveness Guard.
func SetActivePresenterForTest(active bool) {
	testPresenterOverrideMutex.Lock()
	defer testPresenterOverrideMutex.Unlock()
	testPresenterActiveOverride = active
}

// HasActivePresenter reports whether any presenter session is actively projecting.
func (h *RemoteHub) HasActivePresenter() bool {
	testPresenterOverrideMutex.Lock()
	if testPresenterActiveOverride {
		testPresenterOverrideMutex.Unlock()
		return true
	}
	testPresenterOverrideMutex.Unlock()

	h.mu.Lock()
	defer h.mu.Unlock()
	for _, sess := range h.sessions {
		sess.mu.Lock()
		activePresenters := len(sess.presenterChans)
		sess.mu.Unlock()
		if activePresenters > 0 {
			return true
		}
	}
	return false
}

// TryAcquireSyncLock atomically checks for active presenters and reserves the sync lock.
// It returns a release function and true if acquired, or nil and false if a presenter is actively projecting.
func (h *RemoteHub) TryAcquireSyncLock() (func(), bool) {
	testPresenterOverrideMutex.Lock()
	if testPresenterActiveOverride {
		testPresenterOverrideMutex.Unlock()
		return nil, false
	}
	testPresenterOverrideMutex.Unlock()

	h.mu.Lock()
	defer h.mu.Unlock()

	for _, sess := range h.sessions {
		sess.mu.Lock()
		active := len(sess.presenterChans)
		sess.mu.Unlock()
		if active > 0 {
			return nil, false
		}
	}

	h.syncActive = true
	release := func() {
		h.mu.Lock()
		h.syncActive = false
		h.mu.Unlock()
	}
	return release, true
}

func format6DigitCode(n int64) string {
	return fmt.Sprintf("%06d", n%1000000)
}

func generate6DigitCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return format6DigitCode(time.Now().UnixNano())
	}
	return format6DigitCode(n.Int64())
}

// 1. POST /api/present/{id}/remote/pair
// Claims presenting role for the caller and returns a short-lived single-use code.
// Called again while first code is unclaimed, returns a new code and invalidates the old.
// A second client claiming the presenting role takes it; the first client's stream is closed
// and its pairing ends.
func (s *Server) postRemotePair(w http.ResponseWriter, r *http.Request) {
	serviceID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || serviceID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}

	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	code := generate6DigitCode()
	state := globalRemoteHub.getOrCreateSession(serviceID)

	state.mu.Lock()
	// Claiming the presenting role replaces any existing presenter and ends any pairing
	for ch := range state.presenterChans {
		close(ch)
		delete(state.presenterChans, ch)
	}
	for ch := range state.remoteChans {
		close(ch)
		delete(state.remoteChans, ch)
	}
	state.hasPairedRemote = false
	state.pairedRemoteUID = 0
	state.presenterUID = sess.UID
	state.pendingCode = code
	state.codeExpiresAt = time.Now().Add(PairingCodeLifetime)
	state.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"code":      code,
		"expiresIn": int(PairingCodeLifetime.Seconds()),
	})
}

// 2. POST /api/present/{id}/remote/claim
// With a valid code, binds caller as remote and returns current session state.
// With wrong, expired, or already-used code -> 400 (opaque error).
// Second claim against live pairing -> 409 (first remote keeps working).
func (s *Server) postRemoteClaim(w http.ResponseWriter, r *http.Request) {
	serviceID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || serviceID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}

	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	body, err, status, msg := readJSONObject(r, 64<<10)
	if err != nil {
		writeError(w, status, msg)
		return
	}

	code, _ := body["code"].(string)
	if code == "" {
		writeError(w, http.StatusBadRequest, "Invalid pairing code")
		return
	}

	state := globalRemoteHub.getOrCreateSession(serviceID)
	state.mu.Lock()
	defer state.mu.Unlock()

	// Check if already paired with a live remote
	if state.hasPairedRemote {
		// Second claim against a live pairing is 409
		writeError(w, http.StatusConflict, "A remote is already paired")
		return
	}

	// Validate code: must match, must not be empty, must not be expired
	if state.pendingCode == "" || state.pendingCode != code || time.Now().After(state.codeExpiresAt) {
		// Opaque 400 for wrong, expired, or already-used code
		writeError(w, http.StatusBadRequest, "Invalid pairing code")
		return
	}

	// Successful claim: consume the code (single-use)
	state.pendingCode = ""
	state.hasPairedRemote = true
	state.pairedRemoteUID = sess.UID

	var currentState any = nil
	if len(state.lastState) > 0 {
		_ = json.Unmarshal(state.lastState, &currentState)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"paired": true,
		"state":  currentState,
	})
}

// 3. GET /api/present/{id}/remote/stream
// Emits text/event-stream.
// Role is determined by query ?role=presenter or ?role=remote (or by session binding).
// Closes older stream when the same role reconnects.
func (s *Server) getRemoteStream(w http.ResponseWriter, r *http.Request) {
	serviceID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || serviceID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}

	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	role := r.URL.Query().Get("role")
	if role != "presenter" && role != "remote" {
		// Default: if caller is the paired remote UID, role is remote; otherwise presenter
		state := globalRemoteHub.getOrCreateSession(serviceID)
		state.mu.Lock()
		if state.hasPairedRemote && state.pairedRemoteUID == sess.UID {
			role = "remote"
		} else {
			role = "presenter"
		}
		state.mu.Unlock()
	}

	state := globalRemoteHub.getOrCreateSession(serviceID)
	state.mu.Lock()

	ch := make(clientChan, 16)
	if role == "presenter" {
		globalRemoteHub.mu.Lock()
		if globalRemoteHub.syncActive {
			globalRemoteHub.mu.Unlock()
			state.mu.Unlock()
			writeError(w, http.StatusServiceUnavailable, "Sync in progress — presentation stream temporarily delayed")
			return
		}
		globalRemoteHub.mu.Unlock()

		// Close existing presenter streams when same role reconnects
		for oldCh := range state.presenterChans {
			close(oldCh)
			delete(state.presenterChans, oldCh)
		}
		state.presenterChans[ch] = struct{}{}
		state.presenterUID = sess.UID
	} else {
		// Remote role
		if !state.hasPairedRemote || state.pairedRemoteUID != sess.UID {
			state.mu.Unlock()
			writeError(w, http.StatusConflict, "Not paired")
			return
		}
		// Close existing remote streams when same role reconnects
		for oldCh := range state.remoteChans {
			close(oldCh)
			delete(state.remoteChans, oldCh)
		}
		state.remoteChans[ch] = struct{}{}
	}
	state.mu.Unlock()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.Header().Set("Connection", "keep-alive")
	// Disable proxy buffering in nginx so SSE events reach clients immediately without waiting for buffer flushes
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// If there's an initial event or keepalive
	ticker := time.NewTicker(StreamFreshnessWindow / 2)
	defer ticker.Stop()

	notify := r.Context().Done()

	defer func() {
		state.mu.Lock()
		if role == "presenter" {
			delete(state.presenterChans, ch)
		} else {
			delete(state.remoteChans, ch)
		}
		state.mu.Unlock()
	}()

	for {
		select {
		case <-notify:
			return
		case msg, open := <-ch:
			if !open {
				return
			}
			_, err := fmt.Fprintf(w, "data: %s\n\n", msg)
			if err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			_, err := fmt.Fprintf(w, ": keepalive\n\n")
			if err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

// 4. POST /api/present/{id}/remote/intent
// Accepts the six existing intents and rejects unknown type with 400.
// Intent from caller holding no live pairing is 409.
// Forwards the intent to the presenting client via SSE stream.
func (s *Server) postRemoteIntent(w http.ResponseWriter, r *http.Request) {
	serviceID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || serviceID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}

	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	body, err, status, msg := readJSONObject(r, 256<<10)
	if err != nil {
		writeError(w, status, msg)
		return
	}

	intentType, _ := body["type"].(string)
	if !allowedIntentTypes[intentType] {
		writeError(w, http.StatusBadRequest, "Unknown or invalid intent type")
		return
	}

	state := globalRemoteHub.getOrCreateSession(serviceID)
	state.mu.Lock()
	defer state.mu.Unlock()

	// Check if caller holds live pairing as the remote
	if !state.hasPairedRemote || state.pairedRemoteUID != sess.UID {
		writeError(w, http.StatusConflict, "Caller does not hold an active pairing")
		return
	}

	// Marshal raw intent to send to presenter
	intentBytes, err := json.Marshal(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid intent payload")
		return
	}

	// Update last known state if appropriate (e.g. sync/blank/transition/etc.)
	state.lastState = intentBytes

	// Forward to presenter stream(s)
	for ch := range state.presenterChans {
		select {
		case ch <- intentBytes:
		default:
			log.Printf("Presenter stream channel full for service %d", serviceID)
		}
	}

	// Also mirror state to other remote listeners if any
	for ch := range state.remoteChans {
		select {
		case ch <- intentBytes:
		default:
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// 5. DELETE /api/present/{id}/remote/pair
// Ends the pairing and is idempotent (second call is 204).
func (s *Server) deleteRemotePair(w http.ResponseWriter, r *http.Request) {
	serviceID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || serviceID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid Service ID")
		return
	}

	sess := sessionFrom(r)
	if sess == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	state := globalRemoteHub.getOrCreateSession(serviceID)
	state.mu.Lock()

	state.pendingCode = ""
	state.hasPairedRemote = false
	state.pairedRemoteUID = 0

	// Close remote client streams
	for ch := range state.remoteChans {
		close(ch)
		delete(state.remoteChans, ch)
	}

	state.mu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}

// ResetRemoteHubForTests resets all memory pairings (e.g. simulating API restart or clean test state).
func ResetRemoteHubForTests() {
	globalRemoteHub.mu.Lock()
	defer globalRemoteHub.mu.Unlock()
	for _, sess := range globalRemoteHub.sessions {
		sess.mu.Lock()
		for ch := range sess.presenterChans {
			close(ch)
		}
		for ch := range sess.remoteChans {
			close(ch)
		}
		sess.mu.Unlock()
	}
	globalRemoteHub.sessions = make(map[int]*remoteSessionState)
}
