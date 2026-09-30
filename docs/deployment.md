# Production Deployment: WorshipDeck

This guide details running WorshipDeck as a persistent, self-hosted church server for local sanctuary networks or VPS staging.

---

## 1. Process Architecture

The runtime architecture consists of a single Go API process and pre-compiled static Single-Page Application (SPA) assets, with Node.js 22+ available on `PATH` for the child PowerPoint worker:

1. **Go API Service:** Listens on port 3000 by default, hosting SQLite queries, rundown parsing, and HTTP endpoints.
2. **Static SPA Frontend:** Built with Vite (`npm run spa:build`) and served directly by the Go web server.
3. **PowerPoint Export Child Worker:** Executed on demand via `node src/worker/pptx-worker.mjs` by the Go API to generate `.pptx` bundles.

Do not run multiple API server processes against the same SQLite database file.

---

## 2. Durable Storage Paths

SQLite databases, generated presentation decks, and uploaded flyer graphics must be mounted to persistent host paths that survive server reboots:

| Path / Variable | Default | Purpose |
| --- | --- | --- |
| `DB_PATH` | `./data.db` | Primary SQLite database file path |
| `UPLOADS_DIR` | `./data/uploads` | Uploaded images and custom typography fonts |
| `PPTX_CACHE_DIR` | `./data/cache/pptx` | Cached `.pptx` presentation deck artifacts |
| `AUTH_SECRET` | *(auto-generated)* | Cryptographic HMAC-SHA256 secret for session verification |

---

## 3. Production Boot Sequence

```bash
# Build the production SPA bundle
npm run spa:build

# Launch the unified Go API server
npm start
```

For systemd on Linux, run the compiled `./api` binary behind a local reverse proxy (such as nginx) or Cloudflare Tunnel terminating TLS.
