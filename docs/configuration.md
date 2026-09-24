# Configuration and Administration: WorshipDeck

WorshipDeck adapts to different church traditions and liturgical formats through flexible runtime configuration and local database administration.

---

## 1. Environment Variables

WorshipDeck reads environment variables from a `.env` file in the project root or desktop environment:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port for the local Go web server and API |
| `DB_PATH` | `./data.db` | Filesystem path to the local SQLite database file |
| `UPLOADS_DIR` | `./data/uploads` | Directory storing uploaded flyer graphics and slide assets |
| `AUTH_SECRET` | *(auto-generated)* | 32-byte secret for signing operator session cookies |
| `DEFAULT_LOCALE` | `en` | Default UI locale (`en` or `id`) |

---

## 2. Dynamic Form Fields and Liturgy Layouts

Accessible via `/admin/artifacts` (the Registry Admin panel):

* **Predefined Fields:** Define custom liturgy fields (such as Children Story, Tithe and Offering, Responsive Reading) as text, text area, or image widgets, each with its own variable name and dynamic regex pattern.
* **Form Layouts and Groupings:** Arrange predefined fields, Song Set entries, and announcement slots into named, reorderable groupings to shape the Service creation form.
* **Song Book Management:** Select default song books (SDAH) and configure hymn number extraction prefixes.

---

## 3. Media Library, Fonts, and Manual Device Sync

Also under `/admin/artifacts`:

* **Media Library:** A shared pool of background and flyer images, separate from any one slide layout. Upload once, reuse or replace across the deck.
* **Custom Fonts:** Upload TrueType font files for use in canvas layouts and PPTX export.
* **Manual Sync (`/admin/sync`):** For a multi-device setup, push and pull Services, Song Set entries, background images, and announcement items between two WorshipDeck instances over the local network. Assets are content-addressed by SHA-256 so unchanged items are never re-transferred. This is a deliberate, on-demand action, never a background or cloud sync. Note: Manual Sync is experimental and has been verified with one server communicating locally; cross-machine sync remains experimental.

---

## 4. Webhook Rundown Intake API (Coming Soon)

Webhook intake is disabled in this release and will be made available in a future update. When enabled, it will allow automated rundown ingestion from authorized external messaging tools.

---

## 5. Data Sovereignty and Backup Strategy

All church records remain 100% under your congregation physical control. No third-party server ever holds a copy:

* **Primary Database:** `./data.db` (or `%LocalAppData%\WorshipDeck\data.db` on desktop).
* **Media Storage:** `./data/uploads/`.
* **Backup Procedure:** While the WorshipDeck application is closed, copy `data.db` and the `uploads/` folder to a USB drive or local encrypted network backup. No cloud export tools or subscription renewals required.
* **Manual Sync:** Device-to-device only. Sync moves data directly between two local WorshipDeck instances you run. Nothing passes through a hosted service, and it only runs when an operator triggers it from `/admin/sync`.
