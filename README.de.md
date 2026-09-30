# WorshipDeck

> Lokale Kirchenpräsentations- und Bühnen-Suite (Local-first), die Gottesdienstabläufe direkt in einsatzbereite Folien verwandelt: erzeugt offline nutzbare PowerPoint-Präsentationen (.pptx) mit eingebetteten Schriftarten, eine Dual-Screen-Operatorkonsole für den Gemeindebildschirm und eine lokale WLAN-Smartphone-Fernbedienung.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Download v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Alle Releases](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Entwickelt für Kirchengemeinden und liturgische Gottesdienste. Die Folien-Layouts werden als flexible Daten und nicht als starrer Code verwaltet, sodass jede Gemeinde ihren Ablauf direkt im Browser anpassen kann.

## Gelöste Kernprobleme

Das manuelle Erstellen von Gottesdienstfolien kostet wöchentlich viel Zeit, wovon ein Großteil für das wiederholte Eintippen bereits vorhandener Liedtexte verloren geht. Kurzfristige Änderungen erfordern das Neuerstellen der Präsentation.

WorshipDeck liest den Ablaufplan ein und erstellt automatisch konsistente, typografisch saubere Folien:

```text
Ablauf-Text  ->  Gottesdienst analysieren  ->  Folienplan generieren  ->  +->  Offline PowerPoint (.pptx)
                                                                          +->  Operator-Konsole + Gemeindebildschirm
```

Liedtexte werden anhand der Liednummer direkt aus der lokalen Datenbank geladen. Die Layouts können über SQLite direkt im Browser angepasst werden. Nach dem Download ist keine Internetverbindung erforderlich.

## Installation

### Selbst gehosteter Server (Empfohlen)

Der Betrieb als selbst gehosteter lokaler Server ist das empfohlene Standardmodell:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` erzeugt eine `.env`-Datei mit Schlüsseln und initialisiert SQLite. `npm run dev` startet die Go-API unter `http://localhost:3000` und die Vite-SPA unter `http://localhost:5173`. Siehe [docs/deployment.md](docs/deployment.md) für Produktivumgebungen.

### Windows Desktop-App (Experimentell)

Laden Sie den eigenständigen Installationsassistenten für Einzelplatz-Rechner herunter:

- **Direkter Download:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Prüfsumme:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Alle Releases](https://github.com/wiradeltaid/worship-deck/releases)

> **Hinweis zu Windows SmartScreen:** Da dieses Build noch nicht mit einem kommerziellen EV-Zertifikat signiert ist, zeigt Windows SmartScreen möglicherweise eine Warnung an. Klicken Sie auf **Weitere Informationen** (More info) und dann auf **Trotzdem ausführen** (Run anyway).

## Hauptfunktionen

- **Automatischer Ablauf-Import:** Text in das Webformular einfügen; nicht erkannte Zeilen werden transparent ausgewiesen.
- **Automatische Strophenteilung:** Lieder werden übersichtlich in Titel, Strophen und Refrains aufgeteilt.
- **Bearbeitbare Folien-Layouts:** Verwalten Sie Folien-Layouts in SQLite mit einem Browser-Canvas-Editor oder via PowerPoint-Import.
- **Zwei-Bildschirm-Modus:** Operatorkonsole, separater Gemeindebildschirm mit Abdunklung (`B`) und Smartphone-Fernbedienung.
- **16:9 PowerPoint-Export:** Offline nutzbare `.pptx`-Dateien mit eingebetteten Schriftarten für verlässliche Wiedergabe.
- **Bibelstellen-Schnellanzeige:** Bibelverse (KJV) während des Gottesdienstes einblenden und wieder entfernen.
- **Schriftarten-Unterstützung:** 41 gebündelte Offline-Schriftfamilien sowie Unterstützung für benutzerdefinierte Schriftarten.
- **Manuelle Synchronisation (experimentell):** Datenübertragung zwischen zwei lokalen Instanzen auf Anforderung.

## Dokumentation

- **[Getting Started](docs/getting-started.md):** Server-Einrichtung und Desktop-Installationsanleitung.
- **[Features and Workflows](docs/features.md):** Funktionsübersicht und Bedienerhandbuch.
- **[Configuration and Administration](docs/configuration.md):** Formularfelder, Gruppierungen und Datenbankverwaltung.
- **[Customization and Slide Layouts](docs/customization.md):** Canvas-Layouts, PowerPoint-Import und Demodaten.
- **[Shipped Corpora](docs/corpora.md):** Details zu mitgelieferten SDAH- und KJV-Korpora.
- **[Production Deployment](docs/deployment.md):** Dauerhafter systemd-Betrieb und Reverse-Proxy.
- **[Project History](docs/history.md):** Projektursprung, Abstammung und Datenschutzgarantien.

## Systemanforderungen

- **Server (Empfohlen):** Linux (Ubuntu), Windows 10/11 oder POSIX-Host mit Go 1.24+ und Node.js 22.12+. React 19 und SQLite.
- **Windows Desktop-App (Experimentell):** Windows 10/11 64-Bit.

## Lizenz und Markenschutz

- **Code-Lizenz:** Bereitgestellt unter der [MIT-Lizenz](LICENSE).
- **Atributionen:** Schriftarten-, Lied- und Bibel-Urheberrechte sind in [ATTRIBUTIONS.md](ATTRIBUTIONS.md) aufgeführt.
