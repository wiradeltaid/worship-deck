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
| **Peer WorshipDeck Instance (Manual Sync)** | Operator-supplied address, same local network by design | Services (incl. member names), photographs, Song Set entries, backgrounds, announcements | Admin session required on the receiving side; **experimental: see §3.7** |

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

### 3.7 Manual Sync (`POST /api/sync/push`, `GET /api/sync/pull`, `GET /api/sync/status`, `POST /api/sync/assets/check`, `POST /api/sync/assets/upload`, `GET /api/sync/assets/{sha256}`)

**Status: experimental, not yet verified between two separate machines.** SPEC-47 shipped this
feature and its Go-level tests pass, but every test (`internal/httpapi/sync_test.go`,
`tests/smoke-spec-47.test.mjs`) exercises one `httptest` server pushing to and pulling from
**itself**: none stands up two independent instances and syncs across them. This section
describes the code as it is, not a verified deployment shape.

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
- **Gaps, named rather than silently carried:**
  - **No payload size limit on `syncPush` or `syncAssetsCheck`.** Both decode `r.Body` directly
    with `json.NewDecoder` and no `http.MaxBytesReader` (contrast §3.1's `WEBHOOK_SECRET` endpoint,
    bounded to 4 MB, and `syncAssetUpload`, bounded to 50 MB at `sync_assets.go:132`). An
    authenticated admin session, the same bar every other admin write clears, can send an
    arbitrarily large `sync/push` or `sync/assets/check` body.
  - **No CORS support anywhere in the Go API.** `requireAdmin` authenticates by reading the
    `auth_session` cookie (`internal/httpapi/server.go:148`), and cookies are not sent
    cross-origin by a browser's default `fetch()` (`src/lib/sync/client.ts` sets no `credentials`
    option). A genuine two-machine sync, the UI's own stated use case, "one laptop running the
    desktop app, one running the browser build", means the browser tab is on one instance's
    origin while `remoteUrl` names a different one; without an `Access-Control-Allow-Origin`
    response and a `credentials: 'include'` request, the browser has no cookie to send and, for the
    `POST` calls, no successful preflight to complete the request at all. The push/pull protocol
    itself has not been shown to be reachable across two real origins.
  - **The "Device Authorization Token" field is not read by the server.** `AdminSyncPage.tsx`
    lets an operator save a token and sends it as `Authorization: Bearer <token>`
    (`AdminSyncPage.tsx:137`), but no Go handler, and no code anywhere under `internal/`, reads an
    `Authorization` header for a sync route (`webhook.go`'s Bearer handling is the unrelated
    `WEBHOOK_SECRET` path). The field is presented as an authorization control and currently does
    nothing.
- **Until the two gaps above close:** treat Manual Sync as usable only where both instances already
  share a session (practically, the same origin), not as a mechanism for moving data between two
  independently deployed church laptops. Do not point `IMAGE_URL_ALLOWLIST`-style trust at it.

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
  - **Manual Sync is the one deliberate exception**, not telemetry: it is operator-triggered,
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
3. **Data Deletion Semantics:** Deleting a service removes its database record and automatically deletes orphaned upload files that are no longer referenced by other services or announcements. Deleting an announcement slide or Background Library image removes only its database record while keeping the image file in `data/uploads/` on disk (operators must purge the file from the filesystem if complete deletion is required). Deleting an uploaded font removes both the database record and the font file from disk. Operators must periodically audit storage if total erasure is mandated by local policy.
4. **Host Security & Backups:** Access control to the physical or virtual host, file permissions for
   `data.db`, and backup storage encryption remain the exclusive responsibility of the operator.
5. **Manual Sync (§3.7) is experimental.** Do not depend on it as the only path keeping two
   deployments consistent until cross-machine operation, CORS handling, and the "Device
   Authorization Token" field are verified or fixed. Treat a second synced instance as a second,
   independently governed copy of every record it receives.
