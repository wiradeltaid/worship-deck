---
scope: project
purpose: Single-node deploy constraints and durable paths for this product
overrides: null
decision: null
---

# Deployment — this product

The as-built is one always-on **Go API** process on host storage, plus a **Node binary on PATH only** to exec the PPTX worker (DEC-003 / AD-4 / AD-30). **Do not run multiple API processes against the same database file.**

Packaging is **not** Docker Compose. Dev (`presenter-dev.bic.my.id`) ships as a `linux/amd64` binary, built SPA assets, worker tree, and `npm ci` on the VPS, then runs under **systemd** behind nginx. Production LiveServer uses the same process shape behind a Cloudflare Tunnel.

## Durable paths

SQLite, the PPTX cache, and uploads must sit on host storage that survives a process replace — never a throwaway layer.

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Session cookie signature (required in production) |
| `AUTH_BOOTSTRAP_USER` / `AUTH_BOOTSTRAP_PASSWORD` | First-boot admin seed; remove after `accounts` is no longer empty |
| `WEBHOOK_SECRET` | Paused for 0.1.0 release (webhook intake disabled in code) |
| `DB_PATH` | SQLite file. Default `./data.db`. On VPS/LiveServer, a path on durable host storage (for example `/var/lib/presenter-dev/data.db`) |
| `PPTX_CACHE_DIR` | Generated deck cache |
| `UPLOADS_DIR` | Local image files (when used) |
| `PPTX_RETENTION_DAYS` | Cache retention; default 60. `0` keeps forever |
| `IMAGE_URL_ALLOWLIST` | Hostnames allowed for remote image fetch (AD-8) |
| `PORT` | Go API listen port (default 3000) |
| `LISTEN_HOST` | Go API bind host. Unset = `127.0.0.1` (AD-4; avoids a Windows Firewall prompt on `api.exe`). On VPS set `0.0.0.0`; nginx or the tunnel still terminates TLS on the edge |

Operator runbooks for `presenter-dev` live in the devops repo (`deploy-dev.ps1`). A Cloudflare Tunnel in front of the listen port is the published pattern; there is no public inbound port on the venue router.

Webhook intake (picoclaw / Telegram) is paused for 0.1.0 release; `POST /api/webhook` unconditionally returns HTTP 503 Service Unavailable ("Webhook intake is disabled in this release"). It will be reintroduced in a future release.

## SQLite

On open the app sets WAL, `busy_timeout = 5000`, and `foreign_keys = ON`. Keep the `-wal` / `-shm` sidecars on the same volume as `DB_PATH`.

**Backup:** stop writes (or briefly stop the process), copy `data.db` plus `-wal`/`-shm` if present, or `sqlite3 "$DB_PATH" ".backup backup.db"`. Losing `DB_PATH` loses the authored registry; the seed is not a recovery channel (AD-17).

## Host

The production shape assumed at G3 is an always-on Windows host for venue LiveServer, or a small Linux VPS for dev/staging. Sleep and hibernation off on LiveServer. Fonts used by PptxGenJS must be installed on that machine (NFR-7). Phase-1 decks name Arial; if the venue machine lacks it, install a font pack or accept the host’s default sans-serif substitution.

A deploy copies shipped corpora and built SPA assets. Never bake `data.db`. The runtime is Go + static SPA + a Node binary for the PPTX child (OQ-35).
