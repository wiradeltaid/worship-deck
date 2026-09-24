# Overview: WorshipDeck Documentation

WorshipDeck is a local-first presentation and staging suite engineered specifically for church multimedia volunteers, worship leaders, and pastors. It eliminates the 2 to 4 hours of weekly slide preparation by transforming raw, unstructured rundowns (from WhatsApp, email, or meeting notes) into a presentation-ready sanctuary display, front-of-house operator console, and offline PowerPoint bundle in seconds.

---

## 1. Core Architecture

WorshipDeck has no cloud backend and sends zero telemetry: every request stays on your machine or your church local network. The one feature that communicates with another host at all is Manual Sync, and that host is another WorshipDeck instance you run, reached only when an operator triggers it. Manual Sync is experimental: verified so far as one server communicating locally, and not yet confirmed working between two separate machines:

```text
+------------------------------------------------------------------------+
|                   WorshipDeck Local Architecture                       |
+------------------------------------------------------------------------+
                                    |
    +-------------------------------+-------------------------------+
    |                                                               |
    v                                                               v
[Go API Server and Embedded DB]                     [React Single-Page App]
* Embedded SQLite (modernc.org/sqlite)              * Vite + Tailwind CSS + Base UI
* Natural language rundown regex parser             * FOH Dark Operator Console (#0B0F14)
* Dynamic form layouts and liturgy fields           * Dual-screen 16:9 Congregation Screen
* Hymnal corpus (SDAH, KJV)                         * Fabric.js Visual Canvas Editor
* Local HTTP API on port 3000                       * Media library, font and sync admin
    |                                                               |
    +-------------------------------+-------------------------------+
                                    |
                                    v
                     [Offline Presentation Engines]
                     * Dual-Screen BroadcastChannel Sync
                     * ECMA-376 OpenXML PPTX Generator
                     * Embedded TrueType Font Archive
                     * Local Wi-Fi Smartphone Remote
                     * On-demand manual sync between two instances (LAN, no cloud)
```

---

## 2. Documentation Map

* **[Getting Started](getting-started.md)**: Install via the recommended self-hosted server or the experimental Windows desktop setup wizard.
* **[Features and Workflows](features.md)**: Explore natural rundown intake, visual canvas editing, dual-screen congregation display, offline PowerPoint generation, and mobile remote.
* **[Configuration and Administration](configuration.md)**: Customize dynamic service form fields and layouts, manage the media library and fonts, review webhook status, run manual device sync, and manage database backups.
* **[Contributing Guide](contributing.md)**: Development environment prerequisites, public repository privacy guard invariants, and automated test commands.

---

## 3. Operator Keyboard Shortcuts

WorshipDeck is designed for calm, tactile keyboard control under live Sunday service pressure:

| Shortcut | Action | Scope |
|---|---|---|
| `Space` / `->` | Advance to the next slide (*Next Slide*) | Presenter and Congregation Screen |
| `Backspace` / `<-` | Return to the previous slide (*Previous Slide*) | Presenter and Congregation Screen |
| `B` | Instant screen blackout (*Toggle Blank Screen*) | Congregation Screen |
| `Esc` | Clear on-demand scripture overlay or close modal dialogs | Operator Console |
| `1` .. `9` | Quick-jump to corresponding slide in active section | Operator Console |
| `F11` | Toggle native browser fullscreen | Congregation Screen Window |
