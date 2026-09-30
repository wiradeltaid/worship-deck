# WorshipDeck

> A local-first church presentation and staging suite that turns a worship service rundown into slides: a downloadable PowerPoint deck with embedded fonts for offline use, a dual-screen presenter for the room, and a smartphone remote control.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Download v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [All Releases](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Built for liturgical and Seventh-day Adventist congregations, but slide layouts are managed data rather than code, so any church running a similar order of service can adapt it directly in the browser.

## What problem it solves

Preparing worship slides by hand takes hours, most of it spent typing hymn lyrics that were already typed last month. A last-minute song change means redoing the deck. And the knowledge of how to build it lives with one volunteer.

This takes the rundown a service planner already writes in a chat message or a form and produces the finished slides:

```text
rundown text  ->  parsed service  ->  slide plan  ->  +->  PowerPoint deck (offline)
                                                      +->  presenter + congregation screen
```

Hymn lyrics come from a local corpus, looked up by number. Layouts come from a SQLite registry an administrator can edit in the browser. Nothing needs a network connection once the deck is downloaded.

## Installation

### Self-Hosted Server (Recommended)

Running WorshipDeck as a self-hosted local server is the primary and recommended deployment model:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` generates `.env` with fresh secrets, initializes SQLite, and outputs administrative credentials. `npm run dev` starts the Go API on `http://localhost:3000` and Vite SPA on `http://localhost:5173`. See [docs/deployment.md](docs/deployment.md) for production hosting.

### Windows Desktop Installer (Experimental)

Download the standalone setup wizard for single-machine church setups:

- **Direct Download:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Integrity Checksum:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [All Releases](https://github.com/wiradeltaid/worship-deck/releases)

> **Note on Windows SmartScreen:** Because this build is not yet code-signed with a commercial EV certificate, Windows SmartScreen may display a warning ("Windows protected your PC"). Click **More info** and then **Run anyway** to proceed.

## Features

- **Rundown intake:** Paste into the web form. Unrecognised lines are surfaced, never silently dropped.
- **Hymn resolution:** Hymns referenced by number are expanded into title and lyric slides, with refrains repeated after each verse.
- **Editable slide layouts:** Manage slide layouts in SQLite with a browser canvas editor, or import layouts from PowerPoint presentations.
- **Dual-screen presenting:** Synchronized operator console, a separate congregation screen with blanking (`B`), and smartphone remote control.
- **Widescreen 16:9 PowerPoint export:** Downloadable `.pptx` presentation deck with embedded fonts for true offline sanctuary projection.
- **Scripture lookup:** Pull a KJV passage onto the congregation screen during the service and clear it again.
- **Offline typography:** 41 bundled font families, plus support for importing custom font files with automated variant pairing.
- **Manual device sync (experimental):** Push and pull data between two local WorshipDeck instances on demand. No cloud required.

## Documentation

- **[Getting Started](docs/getting-started.md):** Detailed server setup and desktop installation instructions.
- **[Features and Workflows](docs/features.md):** Full feature walkthrough and operator guide.
- **[Configuration and Administration](docs/configuration.md):** Custom form fields, groupings, and database administration.
- **[Customization and Slide Layouts](docs/customization.md):** Authoring canvas layouts, PowerPoint import, and demo seeding.
- **[Shipped Corpora](docs/corpora.md):** Details on bundled SDAH and KJV corpora and custom song books.
- **[Production Deployment](docs/deployment.md):** Persistent systemd hosting and reverse proxy configuration.
- **[Project History](docs/history.md):** Origins, lineage, and public repository privacy guarantees.

## Requirements

- **Server (Recommended):** Linux (Ubuntu), Windows 10/11, or POSIX host with Go 1.24+ and Node.js 22.12+. Built with React 19. Storage is embedded SQLite.
- **Windows Desktop App (Experimental):** Windows 10/11 64-bit.

## Licence and Attribution

- **Code License:** Distributed under the [MIT License](LICENSE).
- **Attributions and Corpora:** Third-party font notices, scripture, and hymnal acknowledgements are detailed in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
