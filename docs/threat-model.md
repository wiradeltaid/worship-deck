# Threat Model: WorshipDeck

WorshipDeck is a self-hosted church presentation hub consisting of a Go HTTP API server,
an embedded SQLite database, a React/Vite single-page application, and an export pipeline producing
offline PowerPoint decks.

This document exists because the application satisfies two explicit threat-model triggers defined in
WDI security standards ([`security-guideline.md`](https://github.com/wiradeltaid/ops)):
1. **Stores personal data of people other than its direct operators** (member names, photographs,
   pastoral assignments, service logs).
2. **Accepts input from the network** (a secret-gated rundown webhook, direct multipart file
   uploads, and operator-supplied image URLs fetched by the server).

Where a defense is asserted, the implementation file is named. Where security depends on operator
deployment decisions, it is cataloged under [Residual risks](#residual-risks-operator-responsibilities).

---

## 1. Component & Integrity Matrix

| Component | Execution Context / Integrity | Data Handled | Primary Defenses |
|---|---|---|---|
| **Go API Server (`cmd/api/`)** | Local process, standard user privileges (never root/admin) | HTTP requests, authentication, DB queries, file I/O | Strict input limits, rate limiting, HMAC session verification |
| **SQLite DB (`data.db`)** | Local filesystem (controlled by operator) | Accounts, sessions, services, member names, templates | Parameterized SQL queries; no client-exposed SQL interface |
| **Upload Directory (`data/uploads/`)** | Local filesystem (controlled by operator) | Uploaded photos, flyer images | Randomized hex filenames, strict extension allowlist, no script execution |
| **Presenter & Projector SPA (`spa/`, `src/`)** | Client browser (operator console & second-screen window) | Displayed lyrics, names, images, slide canvases | Standard React JSX escaping; zero `dangerouslySetInnerHTML` |
| **External Rundown Webhook Client** | External network (e.g., Telegram bot, automation script) | Service rundown text, song numbers, schedule | Gated by `WEBHOOK_SECRET` with constant-time comparison |
| **External Image Host** | Public Internet (operator-specified URL) | Remote image payloads for flyers | SSRF filter, allowlist, redirect refusal, size & timeout caps |
| **Peer WorshipDeck Instance (Data Sync)** | Operator-supplied address, same local network by design | Services (incl. member names), photographs, Song Set entries, backgrounds, announcements | Admin session required on the receiving side; **experimental: see §3.7** |

---

## 2. Sensitive Assets

| Asset | Sensitivity | Impact if Compromised | Location |
|---|---|---|---|
| **Member Names & Photos** | Personal Data (UU PDP No. 27/2022) | Privacy infringement, unauthorized public exposure of minors | `data.db`, `data/uploads/` |
| **`AUTH_SECRET`** | High (System Credential) | Forgery of administrative session tokens | Environment variable (`.env`) |
| **`WEBHOOK_SECRET`** | High (Endpoint Credential) | Unauthorized modification of worship services | Environment variable (`.env`) |
| **Account Password Hashes** | High (Authentication) | Offline dictionary/brute-force attacks | `data.db` (table `accounts`) |
| **Session Cookies (`auth_session`)** | High (Authentication) | Impersonation of logged-in operator/admin | Client cookie, validated via HMAC |

---

## 3. Threat Vectors & Mitigations

### 3.1 Rundown Webhook (`POST /api/webhook`)

- **Threats:** Unauthorized service alteration by unauthenticated actors, timing attacks to infer
  webhook credentials, denial of service via oversized payloads.
- **Code Reference:** `internal/httpapi/webhook.go`
- **Mitigations:**
  - **Endpoint Gating:** If `WEBHOOK_SECRET` is unset in the environment, the endpoint immediately
    returns `503 Service Unavailable`.
  - **Timing-Safe Authentication:** The client token from `X-Webhook-Secret` or `Authorization:
    Bearer` is compared against `WEBHOOK_SECRET` using `crypto/subtle.ConstantTimeCompare`.
  - **Payload Size Bound:** Request bodies are bounded to 4 MB via `readJSONObject(r, 4<<20)`,
    mitigating memory exhaustion DoS attacks.
  - **Robust Fallback Parsing:** Malformed input cannot corrupt existing services; unrecognized
    rundown lines are collected as unparsed notes rather than causing crashes or silent drops.

### 3.2 Remote Image Fetching (`POST /api/uploads/from-url`)

- **Threats:** Server-Side Request Forgery (SSRF) targeting internal network resources (e.g., local
  router interfaces, loopback ports, link-local metadata endpoints like AWS/GCP `169.254.169.254` or
  `metadata.google.internal`), open-redirect bypasses, slowloris/infinite stream attacks.
- **Code Reference:** `internal/httpapi/uploads.go`, `internal/plan/media.go`
- **Mitigations:**
  - **Host IP Validation:** `plan.IsSafeImageURL()` parses the target URL and checks
    `isPrivateHost()`. It rejects loopback (`127.0.0.1`, `localhost`, `::1`), private subnets (RFC
    1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local unicast/multicast, `.local`
    domains, and cloud metadata hostnames.
  - **Optional Strict Allow-List:** If `IMAGE_URL_ALLOWLIST` is configured, only explicitly listed
    hostnames are permitted.
  - **Redirect Refusal:** The HTTP client registers a custom `CheckRedirect` callback that returns an
    immediate error on any 3xx redirect, preventing attackers from using a benign external URL that
    redirects to an internal address.
  - **Strict Timeouts & Bounded Reads:** Client requests time out after 8 seconds. Inbound stream
    consumption is capped at 16 MB (`io.LimitReader(resp.Body, 16*1024*1024 + 1)`).
  - **MIME & Extension Enforcement:** The response `Content-Type` is verified to match known raster
    image formats (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`).

### 3.3 Direct File Uploads (`POST /api/uploads`)

- **Threats:** Path traversal / arbitrary file overwrite (e.g., upload named `../../etc/passwd`),
  executable script execution (uploading `.html`, `.php`, or `.svg` with embedded scripts), disk
  exhaustion.
- **Code Reference:** `internal/httpapi/uploads.go`
- **Mitigations:**
  - **Client Filename Discarded:** The original filename provided by the client is never used for
    storage. Filenames are generated using 16 cryptographically random bytes (`crypto/rand.Read`)
    encoded as a 32-character hex string (`hex.EncodeToString(b) + ext`).
  - **Extension Whitelist:** Files are normalized through `normalizeExt()` and restricted strictly to
    `.jpg`, `.jpeg`, `.png`, `.gif`, and `.webp`. Executables and SVG vectors are refused.
  - **Path Traversal Shield:** Static retrieval via `GET /api/uploads/{filename}` validates filenames
    against a strict regular expression: `^[a-f0-9]{32}\.(jpe?g|png|gif|webp)$`. Traversal tokens
    (`..`, `/`, `\`) fail regex evaluation and return `404 Not Found`.
  - **Upload Size Ceiling:** Multipart form parsing is restricted to 20 MB.

### 3.4 Authentication & Session Integrity

- **Threats:** Password brute-forcing, credential stuffing, user enumeration via response timing,
  session token forgery, open redirects following sign-in.
- **Code Reference:** `internal/auth/password.go`, `internal/auth/session.go`,
  `internal/auth/ratelimit.go`, `internal/auth/safe_next.go`
- **Mitigations:**
  - **Strong Password Hashing:** Passwords are hashed using `scrypt` (`N=16384, r=8, p=1, keylen=64`)
    with a 16-byte cryptographically secure random salt.
  - **User Enumeration Prevention:** On login attempts with non-existent usernames, a precomputed
    `DummyHash` is evaluated through `scrypt` so that timing remains identical between valid and
    invalid users. Verification uses `subtle.ConstantTimeCompare`.
  - **Brute-Force Rate Limiting:** `auth/ratelimit.go` throttles authentication attempts based on
    client IP and targeted account.
  - **Cryptographic Session Tokens:** Sessions are HMAC-SHA256 signed using `AUTH_SECRET`. Tokens
    contain user ID, role, expiration timestamp (TTL 7 days), and a Token Version (`TV`) field
    enabling immediate server-side revocation of compromised accounts or individual sessions.
  - **Safe Post-Login Redirection:** `auth/safe_next.go` validates redirect query parameters to
    prevent open redirection to external phishing sites.

### 3.5 Projection & UI Content Injection (XSS)

- **Threats:** Malicious operator input or injected webhook text executing JavaScript in the
  projector window or administration panel.
- **Code Reference:** `spa/`, `src/`
- **Mitigations:**
  - **Zero Raw HTML Injection:** A static sweep of `src/` and `spa/` verifies that
    `dangerouslySetInnerHTML` is not present anywhere in the codebase.
  - **Context-Aware JSX Escaping:** All service titles, hymn lyrics, pastor names, and scripture
    passages are rendered through standard React JSX expressions, ensuring browser-native text node
    escaping prior to presentation on public displays.

### 3.6 Database Injection (SQLi)

- **Threats:** SQL injection via crafted hymn queries, member names, or service payload fields.
- **Code Reference:** `internal/db/`
- **Mitigations:**
  - **Parameterized Queries:** All database interactions with SQLite use parameterized placeholders
    (`?`). No dynamic SQL string concatenation is performed with user input.

### 3.7 Data Sync (`POST /api/sync/push`, `GET /api/sync/pull`, `GET /api/sync/status`, `POST /api/sync/assets/check`, `POST /api/sync/assets/upload`, `GET /api/sync/assets/{sha256}`)

**Status: experimental.** SPEC-47 shipped the feature; SPEC-88 added
`tests/sync-cors-and-bearer-auth.test.mjs`, which spawns two independent Go API processes with
separate databases (`helpers/go-api.mjs`) and drives push, pull, CORS preflight, and
Bearer-token authentication across them (`SPEC-88-04`, line 211), closing the earlier gap where
every automated test exercised one `httptest` server against itself. It has also been tested
between a Windows app instance and a separate server instance during development. Neither is the
same as production use across many independently operated church installations on different
networks, which has not yet happened.

- **Threats:** Unbounded request bodies causing memory exhaustion, a stale in-flight sync
  colliding with a live presentation, an unauthenticated peer accepting data from a host the
  operator did not intend, and a UI control that looks like a security boundary but is not one.
- **Code Reference:** `internal/httpapi/sync.go`, `internal/httpapi/sync_assets.go`,
  `src/lib/sync/client.ts`, `spa/src/pages/AdminSyncPage.tsx`
- **Mitigations:**
  - **Presenter Liveness Guard:** `syncPush` calls `globalRemoteHub.TryAcquireSyncLock()` and
    returns `409 presenter_active` while a service is being projected, so a sync cannot mutate data
    a live presentation is reading (`sync.go:107`).
  - **Session Gate:** Every sync handler calls `requireAdmin`, the same admin-role check every
    other `/api/admin/*` route uses.
  - **Content-Addressed Assets:** `syncAssetUpload`/`syncAssetDownload` key files by their SHA-256,
    so a corrupted or mismatched upload is detectable by hash rather than trusted on filename alone.
  - **Origin Allow-List for Cross-Origin Sync:** `isOriginAllowed()` (`server.go:169-186`) gates
    every request whose path matches `isCORSPath()` (`/api/sync*`, `/api/auth/login`,
    `server.go:159-163`). When `SYNC_ALLOWED_ORIGINS` is unset, or the server runs in desktop mode,
    only loopback origins (`http(s)://localhost:*`, `http(s)://127.0.0.1:*`) are accepted. A
    configured value is a comma-separated list of exact origins or `host:*` wildcard-port patterns;
    `*` accepts any origin and the code does not refuse it, so it belongs only on a server that is
    never reachable from the internet (see residual risks below). An approved cross-origin request
    gets `Access-Control-Allow-Origin` echoed back and, on `OPTIONS`, a full preflight response
    (`gate()`, `server.go:204-229`).
  - **Sign-In Replaces the "Device Authorization Token" Field.** `AdminSyncPage.tsx` signs the
    operator in to the target instance through `POST /api/auth/login` (`loginRemote`,
    `AdminSyncPage.tsx:410`) rather than asking for a pre-shared token. The returned signed session
    is held only in page memory (`inMemoryRemoteToken` state, `AdminSyncPage.tsx:95`) and discarded
    on page close, remote-URL change, or explicit disconnect; it is never written to `localStorage`
    or a cookie. Every sync request sends it as `Authorization: Bearer <token>`
    (`AdminSyncPage.tsx:205, 276, 473`). On the receiving side, `gate()` first tries the
    `auth_session` cookie; if that is absent, invalid, or not an admin session, it falls back to the
    `Authorization: Bearer` header on sync paths (`server.go:248-258`), verifying the token the same
    way as a cookie session (`auth.Verify` then `auth.ValidateAgainstDB`), still requiring the
    `admin` role, with the same 7-day session lifetime as any other session
    (`internal/auth/session.go:21`).
- **Residual risks, named rather than silently carried:**
  - **No payload size limit on `syncAssetsCheck`.** It decodes `r.Body` directly with
    `json.NewDecoder` and no `http.MaxBytesReader` (`sync_assets.go:67`). By contrast, `syncPush`
    is bounded to 50 MB (`http.MaxBytesReader`, `sync.go:192`) and `syncAssetUpload` is bounded to
    50 MB the same way (`sync_assets.go:168`). An authenticated admin session, the same bar every
    other admin write clears, can still send an arbitrarily large `sync/assets/check` body.
  - **No rate limit on the sync endpoints themselves.** Only sign-in is rate limited
    (`internal/auth/ratelimit.go`); `/api/sync/push`, `/api/sync/pull`, and `/api/sync/assets/*`
    have no request-rate ceiling beyond requiring a valid admin session.
  - **Sync transfers are not logged.** Unlike Factory Reset, which logs the acting admin's UID
    (`admin_reset.go:86`), a push or pull leaves no audit trail of what data moved or who moved it.
  - **`SYNC_ALLOWED_ORIGINS=*` is dangerous on an internet-reachable server.** It lets any origin
    the signed-in admin's browser visits complete a cross-origin sync request. Set it to the exact
    origins you sync between, and never use `*` on a server reachable from the internet.

### 3.8 Outbound Network & Telemetry Audit

- **Threats:** Silent data exfiltration or unintended IP disclosure of congregation servers.
- **Mitigations:**
  - **Zero Outbound Telemetry:** The server contains no analytics SDKs, crash reporters, license
    validation checks, or auto-update requests to Wira Delta Indonesia or any third party.
  - **Self-Contained Offline Corpora:** Scripture lookups (KJV) and hymn lyrics (SDAH) resolve
    against committed local JSON files (`data/en/bible-translation/kjv.json`,
    `data/song-book/sdah.json`) that seed directly into SQLite.
  - **Bundled Typography:** Web fonts are packaged locally via `@fontsource/geist-sans` and
    `@fontsource/geist-mono`, avoiding third-party font CDN requests.
  - **Data Sync is the one deliberate exception**, not telemetry: it is operator-triggered,
    never automatic, and reaches only an address the operator supplies, never Wira Delta
    Indonesia or a third party. See §3.7 for its own threat analysis.

---

## 4. Residual Risks (Operator Responsibilities)

The application cannot protect against hazards arising from an insecure server environment.
Operators must address the following:

1. **HTTPS Enforcement:** The server must be deployed behind an HTTPS reverse proxy (e.g., Caddy,
   Nginx, Cloudflare Tunnel). Deploying over plain HTTP exposes session cookies and administrative
   passwords to local network eavesdroppers.
2. **Secret Management:** Operators must generate high-entropy strings for `AUTH_SECRET` and
   `WEBHOOK_SECRET` and keep them out of public version control.
3. **Data Deletion Semantics:** Deleting a service removes its database record and automatically deletes orphaned upload files that are no longer referenced by other services or announcements. Deleting an announcement slide or Background Library image removes only its database record while keeping the image file in `data/uploads/` on disk (operators must purge the file from the filesystem if complete deletion is required). Deleting an uploaded font removes both the database record and the font file from disk. **Factory Reset** (`internal/httpapi/admin_reset.go`), reachable only by an admin who types the confirmation phrase `factory reset`, deletes all service content, sync state, and upload files except uploaded fonts, then reseeds canonical defaults while preserving accounts and settings (`internal/db/factory_reset.go`); the server logs the acting admin's UID (`admin_reset.go:86`). The client purges the browser's IndexedDB offline cache (`worship_deck_offline_db`, SPEC-84) fail-closed on a successful reset, falling back to deleting the whole IndexedDB database if the targeted purge fails (`purgeOfflineStorageStrict`, `AdminSyncPage.tsx:598-602`). Operators must periodically audit storage if total erasure is mandated by local policy.
4. **Host Security & Backups:** Access control to the physical or virtual host, file permissions for
   `data.db`, and backup storage encryption remain the exclusive responsibility of the operator.
5. **Data Sync (§3.7) is experimental.** It has been exercised between two independently spawned
   Go API instances in automated tests (SPEC-88) and between a Windows app instance and a
   separate server instance during development, but not yet across many independently operated
   installations. Set `SYNC_ALLOWED_ORIGINS` to the exact origins you sync between, never `*` on
   a server reachable from the internet, and mind the residual risks in §3.7 (no size limit on
   `syncAssetsCheck`, no sync-specific rate limit, transfers not logged). Treat a second synced
   instance as a second, independently governed copy of every record it receives.
