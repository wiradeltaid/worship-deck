# Installation and Getting Started: WorshipDeck

WorshipDeck runs entirely on your local machine. No external cloud subscription is required, and no congregation data ever leaves your computer.

---

## 1. Distribution Methods

### Method 1: Self-Hosted Server (Recommended)

The primary and recommended deployment model for WorshipDeck is running the Go server and single-page application on your church network or local server machine:

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
* Tested on Linux (Ubuntu), Windows 10/11, and modern POSIX environments with Node.js 22.12+ and Go 1.24+.

### Method 2: Windows Desktop Installer (Experimental)

An experimental standalone desktop installer is available for single-machine church setups:

1. Download `WorshipDeck-0.1.0-x64-setup.exe` and `SHA256SUMS` from the official [GitHub Releases](https://github.com/wiradeltaid/worship-deck/releases).
2. Verify the downloaded installer hash against `SHA256SUMS`.
3. Run the installer. It installs WorshipDeck into your user profile directory (`%LocalAppData%\WorshipDeck`), requiring zero administrator privileges.
4. Launch **WorshipDeck** from your Windows Start Menu or desktop shortcut.
5. **Data Preservation:** Subsequent updates overwrite application binaries while strictly preserving your local database (`data.db`) and uploaded media.
6. **SmartScreen Notice:** Because this build is not code-signed with a commercial certificate, Windows SmartScreen may display a warning ("Windows protected your PC"). Click **More info** and then **Run anyway** to proceed.

---

## 2. First-Run Initialization

When launched for the first time, WorshipDeck executes an automatic bootstrap sequence:

1. **SQLite Provisioning:** Creates `./data.db` (or `%LocalAppData%\WorshipDeck\data.db` on desktop) with full table schemas and migrations.
2. **Hymnal Corpus Ingestion:** Loads the complete 695-song Seventh-day Adventist Hymnal (SDAH) and 31,102 verses of the King James Version Bible (KJV) into local SQLite tables for instant lookup.
3. **Slide Layouts:** Starts with a clean registry. Layouts are authored directly in the browser canvas editor or imported from PowerPoint presentations. Optional 38 sample layouts can be seeded via `npm run seed:demo` for demonstration purposes.
4. **Initial Account Setup:** On desktop, WorshipDeck prompts you to create your initial administrator account with a secure password on the first screen. On server installations, `npm run setup` generates administrative credentials in your local `.env`.
