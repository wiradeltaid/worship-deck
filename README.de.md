# WorshipDeck

> Lokale Kirchenpräsentations- und Bühnen-Suite (Local-first), die Gottesdienstabläufe direkt in einsatzbereite Folien verwandelt: erzeugt offline nutzbare PowerPoint-Präsentationen (.pptx) mit eingebetteten Schriftarten, eine Dual-Screen-Operatorkonsole für den Gemeindebildschirm und eine lokale WLAN-Smartphone-Fernbedienung.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Übersetzungshinweis:** Diese Datei ist eine Übersetzung von [README.md](README.md) und dient ausschließlich Informationszwecken. Bei Widersprüchen oder Auslegungsunterschieden ist die offizielle englische Originalfassung (`README.md`) maßgeblich. Alle tiefergehenden technischen Dokumentationen und rechtlichen Bedingungen werden auf Englisch geführt.

Entwickelt für Kirchengemeinden und liturgische Gottesdienste. Die Folien-Layouts werden als flexible Daten und nicht als starrer Code verwaltet, sodass jede Gemeinde ihren Ablauf direkt im Browser anpassen kann.

## Gelöste Kernprobleme

Das manuelle Erstellen von Gottesdienstfolien kostet wöchentlich 2 bis 4 Stunden, wovon ein Großteil für das wiederholte Eintippen bereits vorhandener Liedtexte verloren geht. Kurzfristige Liedänderungen erfordern oft das Neuerstellen der gesamten Präsentation, und das technische Wissen liegt meist bei einer einzelnen Person.

WorshipDeck liest den von der Gottesdienstleitung vorbereiteten Ablaufplan aus Chatnachrichten oder Formularen ein und erstellt automatisch konsistente, typografisch saubere Folien.

```text
Ablauf-Text  ->  Gottesdienst analysieren  ->  Folienplan generieren  ->  +->  Offline PowerPoint (.pptx)
                                                                          +->  Vollbild-Web-Slideshow
                                                                          +->  Operator-Konsole + Gemeindebildschirm
```

Liedtexte werden anhand der Liednummer direkt aus der lokalen Datenbank geladen. Die Layouts können über eine SQLite-Verwaltung direkt im Browser angepasst werden. Nach dem Herunterladen der PowerPoint-Datei ist keine Internetverbindung erforderlich, was entscheidend ist, damit der Gottesdienst auch bei Netzwerkausfällen sicher weiterläuft.

## Hauptfunktionen

- **Automatischer Ablauf-Import:** Text in das Webformular einfügen. Nicht erkannte Zeilen werden transparent ausgewiesen und niemals verworfen. (Webhook-Import folgt in einem kommenden Release.)
- **Automatische Strophen- und Refrainteilung:** Anhand der Nummer ausgewählte Lieder werden übersichtlich in Titel, Strophen und Refrains aufgeteilt.
- **Bearbeitbare Folien-Layouts:** Verwalten Sie Folien-Layouts in einer SQLite-Registrierung mit einem Browser-Canvas-Editor. Verschieben und formatieren Sie Elemente, fügen Sie eigene Textfelder hinzu oder importieren Sie Layouts aus PowerPoint-Dateien. Eine optionale Sammlung von 38 Beispiel-Layouts steht per Demo-Seed bereit.
- **Ein Layout für vier Ausgaben:** Ein einheitlicher Foliendatensatz steuert PPTX, Web-Präsentation, Gemeindebildschirm und Live-Vorschau im nativen 16:9 Breitbild an.
- **Zwei-Bildschirm-Präsentationsmodus:** Aktuelle und nächste Folie, Miniaturstreifen, Folienliste, Schnellwahlsprung und eigenständiges Gemeindebildschirm-Fenster.
- **Blackout-Funktion (Blank Screen):** Den Gemeindebildschirm sofort abdunkeln und ohne Verlust der Folienposition wieder einblenden (`B`).
- **Wählbare Übergangseffekte:** Schnitt, Überblenden, Auflösen und Schieben werden identisch in Web und PowerPoint umgesetzt.
- **Schnellanzeige von Bibelstellen:** Bibeltexte (KJV) während des Gottesdienstes auf den Gemeindebildschirm einblenden und anschließend wieder entfernen.
- **Gemeindeankündigungen:** Verwaltung von Ankündigungsfolien aus lokalem Speicher oder von freigegebenen Adressen.
- **Schriftarten-Unterstützung:** 41 lokal gebündelte Offline-Schriftfamilien sowie ECMA-376-Schrifteinbettung für eigene Schriftarten.
- **Benutzerrollen und Sicherheit:** Getrennte Konten für Administratoren und Bediener, Ratengrenzen gegen Angriffe und widerrufbare Sitzungen.
- **Dynamisches Formularlayout und Parsing:** Konfigurieren Sie vordefinierte Felder mit benutzerdefinierten Regex-Regeln und ordnen Sie Formulargruppen direkt im Admin-Panel an.
- **Medienbibliothek:** Ein wiederverwendbarer Pool aus Hintergrund- und Ankündigungsbildern, unabhängig von einem einzelnen Layout.
- **Manuelle Geräte-Synchronisation (experimentell):** Gottesdienste, Liedfolgen, Hintergründe und Ankündigungen zwischen zwei WorshipDeck-Instanzen im selben lokalen Netzwerk auf Wunsch übertragen. Keine Cloud, keine Hintergrundsynchronisation. Auf einem Host verifiziert; netzwerkübergreifende Synchronisation bleibt experimentell.

## Systemanforderungen

- **Server-Installation (Empfohlen):** Linux (getestet unter Ubuntu), Windows 10/11 oder POSIX-Host mit Go 1.24+ und Node.js 22.12+. Entwickelt mit React 19. Verwendet eingebettetes SQLite; kein externer Datenbankserver erforderlich.
- **Windows Desktop-App (Experimentell):** Windows 10/11 64-Bit.
- **macOS:** Nicht offiziell getestet.

## Installation

### Selbst gehosteter Server (Empfohlen)

Der Betrieb als selbst gehosteter lokaler Server ist das empfohlene Standardmodell:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` erstellt die `.env`-Datei, initialisiert die SQLite-Datenbank und gibt das generierte Administratorpasswort aus. `npm run dev` startet die Go-API unter <http://localhost:3000> und das React-SPA unter <http://localhost:5173>. Melden Sie sich im SPA als `admin` an. Für Produktionsbetrieb auf einem Port: `npm run spa:build && npm start` ausführen und Port 3000 öffnen.

Lesen Sie [`.constitution/project/private-data.md`](.constitution/project/private-data.md), bevor Sie die Daten Ihrer eigenen Gemeinde eintragen.

### Windows Desktop-Installationsprogramm (Experimentell)

Laden Sie `WorshipDeck-0.1.0-x64-setup.exe` und `SHA256SUMS` von der offiziellen [Release-Seite](https://github.com/wiradeltaid/worship-deck/releases) herunter und starten Sie den Assistenten.

Vergleichen Sie vor dem Ausführen den SHA-256-Hashwert der heruntergeladenen Datei mit der Datei `SHA256SUMS`.

> **Hinweis zu Windows SmartScreen:** Da dieses Release noch nicht mit einem kommerziellen Zertifikat signiert ist, kann Windows SmartScreen eine Warnung anzeigen. Klicken Sie auf **Weitere Informationen** und wählen Sie **Trotzdem ausführen**.

### Einen Gottesdienst anlegen

**Services -> Neu.** Fügen Sie einen Ablaufplan in das Rohtextfeld ein. Die erwartete Form sieht so aus:

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 / 80 min)
>> welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50-12.05 / 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Klicken Sie auf **Baca susunan acara** (oder **Parse** auf Englisch). Rollen, Zeiten und Liednummern werden ins Formular übernommen; Lieder werden anhand des lokalen Korpus zu Titeln aufgelöst. Alles, was der Parser nicht zuordnen konnte, wird aufgelistet statt verworfen.

Tragen Sie den Predigtzettel sowie Fotos ein, falls vorhanden, und speichern Sie.

### Präsentieren

Von der Service-Seite aus:

- **PPTX herunterladen:** Die Offline-Präsentation. Diese läuft weiter, wenn Netzwerk, Notebook oder Server ausfallen.
- **Präsentieren:** Die Operatorkonsole mit Folienvorschau, Miniaturstreifen und Schnellwahl.
- **Gemeindebildschirm öffnen:** Ein separates Fenster zum Ziehen auf den zweiten Bildschirm. Pfeiltasten steuern beide Fenster. `B` blendet den Gemeindebildschirm aus und wieder ein.

### Optionale Zusatzfunktionen

**Bibelstellen-Suche:** Der Präsentationsmodus kann eine KJV-Bibelstelle auf den Gemeindebildschirm legen. Der Korpus liegt unter `data/en/bible-translation/kjv.json`.

**Chat-Import:** Ein Webhook-Ablaufimport folgt in einer künftigen Version.

### Fehlerbehebung

**`Missing song book corpus`:** `data/song-book/sdah.json` fehlt. Stellen Sie die Datei aus der Versionskontrolle wieder her: `git checkout -- data/song-book/sdah.json` und führen Sie `npm run corpus:verify` aus.

**Ausgesperrt:** `npm run auth:set-password -- admin` setzt ein neues Passwort. `npm run auth:unlock -- --list` hebt Anmeldedrosselungen auf.

**Bilder fehlen in der Präsentation:** Externe Bilder müssen die URL-Sicherheitsregeln erfüllen. Der direkte Upload auf den Server funktioniert immer.

## An die eigene Gemeinde anpassen

Die Standardinstallation startet mit einer sauberen Registrierung für eigene Gestaltungen:

1. **Folien-Layouts:** Melden Sie sich als Administrator an und öffnen Sie `/admin/artifacts`. Layouts können im Canvas-Editor erstellt oder aus PowerPoint importiert werden. 38 Beispiel-Layouts können mit `npm run seed:demo` eingespielt werden.
2. **Private Überschreibung:** Speichern Sie Ihre Gemeindedaten unter `data/local/default-registry.json` ab; die Anwendung lädt vorrangig von dort. Dieser Pfad wird von Git ignoriert. Siehe [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Mitgelieferte Korpora

Zwei Standardkorpora sind eingebunden:

| Datei | Enthält | Beim Start |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 Lieder des Seventh-day Adventist Hymnal | Titel und Liedtext werden aus der Datei übernommen |
| `data/en/bible-translation/kjv.json` | 66 Bücher, 1189 Kapitel, 31102 KJV-Verse | bei jedem Start abgeglichen (~130 bis 150 ms) |

`npm run corpus:verify` prüft, dass beide vollständig sind.

Lesen Sie [ATTRIBUTIONS.md](ATTRIBUTIONS.md) bezüglich Urheberrechten und Kontakten für Löschanfragen.

## Betrieb

Kompilieren Sie die Go-API und das SPA, führen Sie `./api` (oder `npm start`) auf einem Host mit Node 22 im `PATH` aus. Siehe [`.constitution/project/deployment.md`](.constitution/project/deployment.md).

## Projektgeschichte

Dieses Projekt begann als privates Repository für eine einzelne Gemeinde. Die Historie wurde bereinigt, um keine vertraulichen Personendaten öffentlich zu machen. Dieses Repository startet mit synthetischen Beispieldaten (*Harborlight Adventist Fellowship*).

Mitwirkende: Bitte lesen Sie [`.constitution/project/private-data.md`](.constitution/project/private-data.md) vor Ihrem ersten Commit.

## Lizenz und Markenschutz

- **Code-Lizenz:** Veröffentlicht unter der [MIT-Lizenz](LICENSE).
- **Liedkorpus und Danksagungen:** Gesangbücher, Bibelübersetzungen und Lizenzen Dritter sind in [ATTRIBUTIONS.md](ATTRIBUTIONS.md) aufgeführt.
- **Drittanbieter-Schriftarten:** Detaillierte Urheberrechtshinweise und vollständige Lizenztexte (SIL OFL 1.1 und Apache 2.0) für 41 Schriftfamilien finden sich in [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES).
- **Datenschutz und Sicherheit:** 100% Offline-first. Daten verbleiben vollständig auf Ihrem lokalen Rechner; null Telemetrie, null Analyse (siehe [PRIVACY.md](PRIVACY.md) und [SECURITY.md](SECURITY.md)).
- **Markenhinweis:** Die MIT-Lizenz gewährt Rechte am Code, nicht an Namen oder Logos. Die Namen **WorshipDeck** und **Wira Delta Indonesia** sowie das Produktlogo sind Eigentum der PT Wira Delta Indonesia.
