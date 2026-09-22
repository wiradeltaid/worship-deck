# Features & Operator Workflows — WorshipDeck

WorshipDeck is designed around the core operational loop of Sunday morning: transitioning from an informal text rundown to an accurate sanctuary presentation in seconds.

---

## 1. Natural Rundown Ingestion (From WhatsApp to Screen in 10s)

No need to retype or copy-paste line by line:
1. Navigate to **Services → New Service**.
2. Paste raw text directly from your worship team's chat group:
   ```text
   SABBATH, OCTOBER 10, 2026
   DIVINE SERVICE (10.00-11.30)
   Opening Song: SDAH #159 The Old Rugged Cross
   Scripture Reading: John 3:16-17 (Elder Samuel)
   Sermon: Pastor David Wilson "Anchored in Faith"
   Closing Song: SDAH #249 Praise Him! Praise Him!
   ```
3. Click **Parse Rundown**. The natural language parser automatically extracts song numbers, matches scripture references against the local KJV database, detects speaker names, and compiles the ordered slide plan.

---

## 2. Visual Canvas Editor (Fabric.js)

Customize presentation aesthetics via `/admin/artifacts`:
* **Center-Origin Geometry:** Sub-pixel alignment and rotation coordinates prevent jumpy layout shifts during slide transitions.
* **Typography Controls:** Fine-tune font family, weight, tracking (letter-spacing), line height normalization, and text drop-shadows.
* **Background Asset Library:** Select solid dark colors, subtle gradients, or uploaded 16:9 still backgrounds.
* **Dynamic Hydration Markers:** Slide placeholders (e.g. `{song_title}`, `{verse_text}`, `{sermon_title}`) populate dynamically at runtime.

---

## 3. Dual-Screen Presenter & Auditorium Output

* **Front-of-House (FOH) Operator Console:** Displays active slide, next-slide confidence preview, service timeline, countdown timers, and servant notes on a dark `#0B0F14` surface that minimizes light pollution in the sound booth.
* **Independent 16:9 Projector Popup:** Click **Open Projector** to open a clean display window with zero controls, chrome, or window borders. Move this window to your secondary display / sanctuary projector and press `F11` (Fullscreen).
* **BroadcastChannel Synchronization:** Both windows communicate via browser-native inter-tab messaging with zero network latency.
* **Instant Blackout:** Press `B` to immediately blackout the sanctuary screen during solemn prayer or sermon transitions without disrupting the operator console.

---

## 4. Standalone Offline PowerPoint Export (`.pptx`)

When visiting guest speakers prefer using PowerPoint on an external laptop:
1. Click **Export Sunday Service Deck**.
2. WorshipDeck's backend engine compiles a native ECMA-376 OpenXML `.pptx` presentation.
3. **Pure TrueType Font Embedding:** Shipped fonts are embedded directly inside the PowerPoint file archive, ensuring that opening the file on an offline laptop preserves 100% typography and text-wrap fidelity without font substitutions.

---

## 5. Local Wi-Fi Smartphone Remote

Control the service presentation from anywhere within the sanctuary:
1. Open `/services/:id/remote` on any smartphone connected to the church local Wi-Fi.
2. Enter the one-time 4-digit pairing code displayed on the operator console.
3. The worship leader or speaker can advance slides or view speaker notes directly from their mobile browser with responsive swipe gestures.

---

## 6. Configurable Rundown Parsing & Service Form

For congregations whose rundown format doesn't match the default:
1. Open **Admin → Registry (`/admin/artifacts`)**.
2. Under **Rundown Parser Profiles**, author a named profile with its own extraction rules per field, and switch the active profile without a code change.
3. Under **Form Layout**, arrange Predefined Fields, Song Set entries, and announcement slots into groupings — this is the shape the **New Service** form renders.

---

## 7. Media Library, Fonts & Manual Device Sync

Also under **Admin → Registry (`/admin/artifacts`)**:
* **Media Library:** a shared pool of background and flyer images, reusable across templates and replaceable in place.
* **Custom Fonts:** upload TrueType fonts for the canvas editor and PPTX export.
* **Manual Sync (`/admin/sync`):** on a multi-device setup, push and pull Services, Song Set entries, backgrounds, and announcements directly between two WorshipDeck instances on the same local network — an explicit, on-demand action, never a background or cloud sync. **Experimental:** this has been tested one server talking to itself, not yet two independent machines end-to-end — treat it as unstable until that is confirmed.
