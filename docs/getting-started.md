# Installation & Getting Started — WorshipDeck

WorshipDeck runs entirely on your local machine. No external cloud subscription is required, and no congregation data ever leaves your computer.

---

## 1. Distribution Methods

### Method 1: Windows Setup Installer (`WorshipDeckSetup.exe`) — Recommended
The standard installer provides a seamless Windows desktop installation:
1. Download `WorshipDeckSetup.exe` from the official [GitHub Releases](https://github.com/wiradeltaid/worship-deck/releases).
2. Run the installer. It installs WorshipDeck into your user profile directory (`%LocalAppData%\WorshipDeck`), requiring **zero administrator privileges**.
3. Launch **WorshipDeck** from your Windows Start Menu or desktop shortcut.
4. **Data Preservation:** Subsequent updates via `WorshipDeckSetup.exe` overwrite application binaries while strictly preserving your local database (`data.db`) and uploaded media.

### Method 2: Portable ZIP Bundle (`worship-deck-portable.zip`)
If your church laptop enforces strict IT group policies preventing executable installation:
1. Download and extract `worship-deck-portable.zip` to any folder or USB flash drive.
2. Double-click `worship-deck.exe`.
3. The portable environment runs isolated in place without creating Windows registry entries.

### Method 3: Compiling from Source
For software engineers, custom liturgy adapters, or Linux/macOS hosts:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

* The Go backend boots on `http://localhost:3000`.
* The Vite development server boots on `http://localhost:5173`.
* For single-origin production serving: `npm run spa:build && npm start` (served on port 3000).

---

## 2. First-Run Initialization

When launched for the first time, WorshipDeck executes an automatic bootstrap sequence:
1. **SQLite Provisioning:** Creates `./data.db` (or `%LocalAppData%\WorshipDeck\data.db` on desktop) with full table schemas and migrations.
2. **Hymnal Corpus Ingestion:** Loads the complete 695-song *Seventh-day Adventist Hymnal* (SDAH) and 31,102 verses of the King James Version Bible (KJV) into local full-text search indexes.
3. **Template Seeding:** Seeds 28 default 16:9 widescreen presentation templates covering opening hymns, scripture reading, sermon titles, announcements, and benedictions.
4. **Initial Account Setup:** Displays the default administrative credentials (`admin`) on the first boot screen and prompts you to configure a secure password.
