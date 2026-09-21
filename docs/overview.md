# Overview — WorshipDeck Documentation

WorshipDeck is a local-first presentation and staging suite engineered specifically for church multimedia volunteers, worship leaders, and pastors. It eliminates the 2–4 hours of weekly slide preparation by transforming raw, unstructured rundowns (from WhatsApp, email, or meeting notes) into a presentation-ready sanctuary display, front-of-house operator console, and offline PowerPoint bundle in seconds.

---

## 1. Core Architecture

WorshipDeck operates 100% disconnected from the cloud, ensuring congregation privacy with zero external telemetry:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WorshipDeck Local Architecture                      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
[Go API Server & Embedded DB]                       [React Single-Page App]
• Embedded SQLite (modernc.org/sqlite)              • Vite + Tailwind CSS + Radix UI
• Natural language rundown regex parser             • FOH Dark Operator Console (#0B0F14)
• Hymnal corpus (SDAH, Kidung, KJV)                • Dual-screen 16:9 Projector Shell
• Local HTTP API on port 3000                       • Fabric.js Visual Canvas Editor
    │                                                               │
    └───────────────────────────────┬───────────────────────────────┘
                                    │
                                    ▼
                     [Offline Presentation Engines]
                     • Dual-Screen BroadcastChannel Sync
                     • ECMA-376 OpenXML PPTX Generator
                     • Embedded TrueType Font Archive
                     • Local Wi-Fi Smartphone Remote
```

---

## 2. Documentation Map

* **[Getting Started](getting-started.md)**: Install via the Windows setup wizard, extract the standalone portable bundle, or build from source on any platform.
* **[Features & Workflows](features.md)**: Explore the natural rundown intake, visual canvas editing, dual-screen projection, offline PowerPoint generation, and mobile remote.
* **[Configuration & Administration](configuration.md)**: Customize dynamic service form fields, test regex parsing in the sandbox, configure webhooks, and manage database backups.
* **[Contributing Guide](contributing.md)**: Development environment prerequisites, public repository privacy guard invariants, and automated test commands.

---

## 3. Operator Keyboard Shortcuts

WorshipDeck is designed for calm, tactile keyboard control under live Sunday service pressure:

| Shortcut | Action | Scope |
|---|---|---|
| `Space` / `→` | Advance to the next slide (*Next Slide*) | Presenter & Projector |
| `Backspace` / `←` | Return to the previous slide (*Previous Slide*) | Presenter & Projector |
| `B` | Instant screen blackout (*Toggle Blank Screen*) | Congregation Projector |
| `Esc` | Clear on-demand scripture overlay / close modal dialogs | Operator Console |
| `1` .. `9` | Quick-jump to corresponding slide in active section | Operator Console |
| `F11` | Toggle native browser fullscreen | Projector Output Window |
