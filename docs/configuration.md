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

## 2. Dynamic Form Fields & Regex Sandbox

Accessible via `/admin/settings`:
* **Custom Field Layouts:** Add, reorder, or group custom liturgy fields (e.g., *Children's Story*, *Tithe & Offering*, *Responsive Reading*).
* **Parser Regex Sandbox:** Test regular expressions in real time against your congregation's past rundown text samples before committing changes to the active database.
* **Song Book Management:** Select default song books (SDAH, PKJ, NKB) and configure hymn number extraction prefixes.

---

## 3. Webhook Rundown Intake API

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

## 4. Data Sovereignty & Backup Strategy

All church records remain 100% under your congregation's physical control:
* **Primary Database:** `./data.db` (or `%LocalAppData%\WorshipDeck\data.db`).
* **Media Storage:** `./data/uploads/`.
* **Backup Procedure:** While the WorshipDeck application is closed, simply copy `data.db` and the `uploads/` folder to a USB drive or local encrypted network backup. No cloud export tools or subscription renewals required.
