# Features and Operator Workflows: WorshipDeck

WorshipDeck is designed around the core operational loop of Sunday morning: transitioning from an informal text rundown to an accurate sanctuary presentation in seconds.

---

## 1. Natural Rundown Ingestion

No need to retype or copy-paste line by line:

1. Navigate to **Services -> New Service**.
2. Paste raw text directly from your worship team chat group:
   ```text
   SABBATH, OCTOBER 10, 2026
   DIVINE SERVICE (10.00-11.30)
   Opening Song: SDAH #159 The Old Rugged Cross
   Scripture Reading: John 3:16-17 (Elder Samuel)
   Sermon: Pastor David Wilson "Anchored in Faith"
   Closing Song: SDAH #249 Praise Him! Praise Him!
   ```
3. Click **Baca susunan acara** (or **Parse** in English). The natural language parser automatically extracts song numbers, matches scripture references against the local KJV database, detects speaker names, and compiles the ordered slide plan.

---

## 2. Visual Canvas Editor

Customize presentation aesthetics via `/admin/artifacts`:

* **Center-Origin Geometry:** Sub-pixel alignment and rotation coordinates prevent jumpy layout shifts during slide transitions.
* **Typography Controls:** Fine-tune font family, weight, tracking, line height normalization, and text drop-shadows across all 35 local bundled fonts.
* **Background Asset Library:** Select solid dark colors, subtle gradients, or uploaded 16:9 still backgrounds.
* **Dynamic Hydration Markers:** Slide placeholders (such as `{song_title}`, `{verse_text}`, `{sermon_title}`) populate dynamically at runtime.

---

## 3. Dual-Screen Presenter and Congregation Output

* **Front-of-House (FOH) Operator Console:** Displays active slide, next-slide confidence preview, service timeline, and slide navigation grid on a dark `#0B0F14` surface that minimizes light pollution in the sound booth.
* **Congregation Screen Window:** Click **Open congregation screen** to open a clean display window with zero controls, chrome, or window borders. Move this window to your secondary display or sanctuary screen and press `F11` for fullscreen.
* **BroadcastChannel Synchronization:** Both windows communicate via browser-native inter-tab messaging with zero network latency.
* **Instant Blackout:** Press `B` to immediately blackout the congregation screen during prayer or sermon transitions without disrupting the operator console.

---

## 4. Standalone Offline PowerPoint Export (.pptx)

When visiting speakers prefer using PowerPoint on an external laptop:

1. Click **Download PPTX**.
2. WorshipDeck backend engine compiles a native ECMA-376 OpenXML `.pptx` presentation.
3. **Pure TrueType Font Embedding:** Local bundled TrueType font files are embedded directly inside the PowerPoint file archive, ensuring that opening the file on an offline laptop preserves 100% typography and text-wrap fidelity without font substitutions.

---

## 5. Local Wi-Fi Smartphone Remote

Control the service presentation from anywhere within the sanctuary:

1. Open `/services/:id/remote` on any smartphone connected to the church local Wi-Fi.
2. Enter the one-time 4-digit pairing code displayed on the operator console.
3. Advance slides directly from the mobile browser with responsive tap gestures.

---

## 6. Configurable Rundown Parsing and Service Form

For congregations whose rundown format does not match the default:

1. Open **Admin -> Registry (`/admin/artifacts`)**.
2. Under **Form Layout**, configure Predefined Fields with custom extraction regexes, Song Set entries, and announcement slots into groupings to shape the **New Service** form.
3. Field changes take effect immediately without requiring code modifications.

---

## 7. Media Library, Fonts, and Manual Device Sync

Also under **Admin -> Registry (`/admin/artifacts`)**:

* **Media Library:** A shared pool of background and flyer images, reusable across layouts and replaceable in place.
* **Custom Fonts:** Upload TrueType fonts for the canvas editor and PPTX export.
* **Manual Sync (`/admin/sync`):** On a multi-device setup, push and pull Services, Song Set entries, backgrounds, and announcements directly between two WorshipDeck instances on the same local network. Note: Manual Sync is experimental and has been verified with one server communicating locally; cross-machine sync remains experimental.
