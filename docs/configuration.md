# Configuration & Administration — WorshipDeck

WorshipDeck adapts to different church traditions and liturgical formats through flexible runtime configuration and local database administration.

---

## 1. Environment Variables

WorshipDeck reads environment variables from a `.env` file in the project root or desktop environment:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port for the local Go web server and API |
| `DB_PATH` | `./data.db` | Filesystem path to the local SQLite database file |
| `UPLOADS_DIR` | `./data/uploads` | Directory storing uploaded flyer graphics and slide assets |
| `SESSION_SECRET` | *(random 32-byte hex)* | Key for signing operator session cookies |
| `ADMIN_PASSWORD` | *(generated on setup)* | Password for initial administrative access |
| `DEFAULT_LOCALE` | `en` | Default UI locale (`en` or `id`) |

---

## 2. Dynamic Form Fields & Rundown Parser Profiles

Accessible via `/admin/artifacts` (the Registry Admin panel):
* **Predefined Fields:** Define custom liturgy fields (e.g., *Children's Story*, *Tithe & Offering*, *Responsive Reading*) as text, text area, or image widgets, each with its own variable name.
* **Form Layouts & Groupings:** Arrange predefined fields, Song Set entries, and announcement slots into named, reorderable groupings — the shape the Service creation form renders.
* **Rundown Parser Profiles:** Author and switch between named parsing rule sets, each with its own extraction regex per field, so the natural-language parser can be retuned per congregation without a code change.
* **Song Book Management:** Select default song books (SDAH, PKJ, NKB) and configure hymn number extraction prefixes.

---

## 3. Media Library, Fonts, and Manual Device Sync

Also under `/admin/artifacts`:
* **Media Library:** A shared pool of background and flyer images, separate from any one template — upload once, reuse or replace across the deck.
* **Custom Fonts:** Upload TrueType font files for use in canvas templates and PPTX export.
* **Manual Sync (`/admin/sync`):** For a multi-device setup (e.g. one laptop running the desktop app, one running the browser build), push and pull Services, Song Set entries, background images, and announcement items between two WorshipDeck instances over the local network — content-addressed by SHA-256, so an unchanged asset is never re-uploaded. This is a deliberate, on-demand action, never a background or cloud sync.

---

## 4. Webhook Rundown Intake API

Automate Sunday service ingestion from chat applications (WhatsApp / Telegram bots) or church management systems:

* **Endpoint:** `POST /api/webhook`
* **Header:** `X-Webhook-Secret: <YOUR_SESSION_SECRET>`
* **Content-Type:** `application/json`

**Sample Payload:**
```json
{
  "serviceDate": "2026-10-10",
  "rawRundown": "DIVINE SERVICE\nOpening Song: SDAH #159 The Old Rugged Cross\nScripture: John 3:16\nSermon: Pr. David Wilson\nClosing: SDAH #249"
}
```

**Response:**
```json
{
  "success": true,
  "serviceId": 14,
  "parsedItemsCount": 4
}
```

---

## 5. Data Sovereignty & Backup Strategy

All church records remain 100% under your congregation's physical control — no third-party server ever holds a copy:
* **Primary Database:** `./data.db` (or `%LocalAppData%\WorshipDeck\data.db`).
* **Media Storage:** `./data/uploads/`.
* **Backup Procedure:** While the WorshipDeck application is closed, simply copy `data.db` and the `uploads/` folder to a USB drive or local encrypted network backup. No cloud export tools or subscription renewals required.
* **Manual Sync is device-to-device, not cloud:** the Sync feature (§3) moves data directly between two WorshipDeck instances you run; nothing passes through a hosted service, and it only runs when an operator triggers it from `/admin/sync`.
