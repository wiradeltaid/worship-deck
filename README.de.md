# WorshipDeck

> Lokale Kirchenpräsentations- und Bühnen-Suite (Local-first), die Gottesdienstabläufe direkt in einsatzbereite Folien verwandelt — erzeugt offline nutzbare PowerPoint-Präsentationen (.pptx) mit eingebetteten Schriftarten, eine Dual-Screen-Operatorkonsole und eine lokale WLAN-Smartphone-Fernbedienung.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Übersetzungshinweis:** Diese Datei ist eine Übersetzung von [README.md](README.md) und dient ausschließlich Informationszwecken. Bei Widersprüchen oder Auslegungsunterschieden ist die offizielle englische Originalfassung (`README.md`) maßgeblich. Alle tiefergehenden technischen Dokumentationen und rechtlichen Bedingungen werden auf Englisch geführt.

Entwickelt für Kirchengemeinden und liturgische Gottesdienste. Die Folienvorlagen werden als flexible Daten und nicht als starrer Code verwaltet, sodass jede Gemeinde ihren Ablauf direkt im Browser anpassen kann.

## Gelöste Kernprobleme

Das manuelle Erstellen von Gottesdienstfolien kostet wöchentlich 2 bis 4 Stunden, wovon ein Großteil für das wiederholte Eintippen bereits vorhandener Liedtexte verloren geht. Kurzfristige Liedänderungen erfordern oft das Neuerstellen der gesamten Präsentation, und das technische Wissen liegt meist bei einer einzelnen Person.

WorshipDeck liest den von der Gottesdienstleitung vorbereiteten Ablaufplan ein und erstellt automatisch konsistente, typografisch saubere Folien.

```text
Ablauf-Text  →  Gottesdienst analysieren  →  Folienplan generieren  →  ┬→  Offline PowerPoint (.pptx)
                                                                       ├→  Vollbild-Web-Slideshow
                                                                       └→  Operator-Konsole + Beamer
```

Liedtexte werden anhand der Liednummer direkt aus der lokalen Datenbank geladen. Das Layout der Vorlagen kann über eine SQLite-Verwaltung direkt im Browser angepasst werden. Nach dem Herunterladen der PowerPoint-Datei ist keine Internetverbindung erforderlich — der Gottesdienst läuft auch bei Netzwerkausfällen sicher weiter.

## Hauptfunktionen

- **Automatischer Ablauf-Import:** Text einfügen oder per Webhook übermitteln. Nicht erkannte Zeilen werden transparent ausgewiesen und niemals verworfen.
- **Automatische Strophen- und Refrainteilung:** Anhand der Nummer ausgewählte Lieder werden übersichtlich in Titel, Strophen und Refrains aufgeteilt.
- **Visueller Vorlagen-Editor (WYSIWYG):** 38 integrierte Vorlagen können direkt auf der Leinwand verschoben, vergrößert und formatiert werden.
- **Ein Layout für vier Ausgaben (16:9 Breitbild):** Ein einheitlicher Foliendatensatz steuert PPTX, Web-Präsentation, Beamer-Fenster und Live-Vorschau pixelgenau an.
- **Zwei-Bildschirm-Präsentationsmodus:** Aktuelle und nächste Folie, Miniaturstreifen, Ablaufübersicht und eigenständiges Beamer-Fenster.
- **Blackout-Funktion (Blank Screen):** Den Beamer sofort abdunkeln und ohne Verlust der Folienposition wieder einblenden (`B`).
- **Wählbare Übergangseffekte:** Schnitt, Überblenden, Auflösen und Schieben werden identisch in Web und PowerPoint umgesetzt.
- **Schnellanzeige von Bibelstellen:** Bibeltexte (KJV) während der Predigt auf den Beamer einblenden und anschließend wieder entfernen.
- **Gemeindeankündigungen:** Verwaltung von Ankündigungsfolien aus lokalem Speicher oder von freigegebenen Adressen.
- **Einbettung eigener Schriftarten:** ECMA-376-Schrifteinbettung für originalgetreue Darstellung auf jedem Windows-PC mit PowerPoint.
- **Benutzerrollen und Sicherheit:** Getrennte Konten für Administratoren und Bediener, Ratengrenzen gegen Brute-Force-Angriffe.
- **Konfigurierbarer Ablauf-Parser und Formularlayout:** Benannte Parser-Profile im Admin-Panel anlegen und Felder/Gruppierungen des Service-Formulars ohne Code-Änderung anordnen.
- **Medienbibliothek:** Ein wiederverwendbarer Pool aus Hintergrund- und Ankündigungsbildern, unabhängig von einer einzelnen Vorlage.
- **Manuelle Geräte-Synchronisation** *(experimentell — noch nicht zwischen zwei echten Geräten verifiziert)*: Services, Song-Set-Einträge, Hintergründe und Ankündigungen zwischen zwei WorshipDeck-Instanzen im selben lokalen Netzwerk auf Wunsch übertragen. Keine Cloud, keine Hintergrundsynchronisation.

## Systemanforderungen

- **Desktop-App:** Windows 10/11 64-Bit.
- **Quellcode-Build:** Go 1.24+ und Node.js 22+. Verwendet eingebettetes SQLite; kein externer Datenbankserver erforderlich.

## Installation

### Windows Desktop-Installationsprogramm (Empfohlen)

Laden Sie `WorshipDeckSetup.exe` von der offiziellen [Release-Seite](https://github.com/wiradeltaid/worship-deck/releases) herunter und starten Sie den Assistenten.

> **Hinweis zu Windows SmartScreen:** Da dieses Release noch nicht mit einem teuren kommerziellen EV-Zertifikat signiert ist, kann Windows SmartScreen eine Warnung anzeigen. Klicken Sie auf **"Weitere Informationen"** und wählen Sie **"Trotzdem ausführen"**.

### Ausführung aus dem Quellcode

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` erstellt die `.env`-Datei, initialisiert die SQLite-Datenbank, richtet die Standardvorlagen ein und gibt das Administratorpasswort aus.

---

## Lizenz und Markenschutz

- **Code-Lizenz:** Veröffentlicht unter der [MIT-Lizenz](LICENSE).
- **Liedkorpus & Danksagungen:** Gesangbücher, Bibelübersetzungen und Lizenzen Dritter sind in [ATTRIBUTIONS.md](ATTRIBUTIONS.md) aufgeführt.
- **Datenschutz & Sicherheit:** Kein Cloud-Backend und null Telemetrie — jede Anfrage bleibt auf Ihrem Rechner oder im lokalen Netzwerk Ihrer Gemeinde. Die einzige Funktion, die mit einem anderen Host spricht, ist die manuelle Synchronisation, und dieser Host ist eine weitere WorshipDeck-Instanz, die Sie selbst betreiben und die nur erreicht wird, wenn ein Bediener sie auslöst (siehe [PRIVACY.md](PRIVACY.md) und [SECURITY.md](SECURITY.md)).
- **Markenhinweis:** Die MIT-Lizenz gewährt Rechte am Code, nicht an Namen oder Logos. Die Namen **WorshipDeck** und **Wira Delta Indonesia** sowie das Produktlogo sind Eigentum der PT Wira Delta Indonesia.
