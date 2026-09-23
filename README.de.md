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

`npm run setup` erstellt die `.env`-Datei, initialisiert die SQLite-Datenbank, richtet die Standardvorlagen ein und gibt das generierte Administratorpasswort aus. `npm run dev` startet die Go-API unter <http://localhost:3000> und das React-SPA unter <http://localhost:5173> (Vite leitet `/api` an Go weiter). Melden Sie sich im SPA als `admin` an. Für einen einzigen Ursprung: `npm run spa:build && npm start` und Port 3000 öffnen. Ein erneuter Aufruf von `setup` ist unbedenklich: eine bestehende `.env`-Datei oder Datenbank wird nie überschrieben.

Lesen Sie [`.constitution/project/private-data.md`](.constitution/project/private-data.md), bevor Sie die Daten Ihrer eigenen Gemeinde eintragen.

### Einen Gottesdienst anlegen

**Services → Neu.** Fügen Sie einen Ablaufplan in das Rohtextfeld ein. Die erwartete Form sieht so aus (synthetische Namen):

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 /80 min)
》welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50- 12.05/ 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Klicken Sie auf **Parse**. Rollen, Zeiten und Liednummern werden ins Formular übernommen; Lieder werden anhand des lokalen Korpus zu Titeln aufgelöst. Alles, was der Parser nicht zuordnen konnte, wird aufgelistet statt verworfen.

Tragen Sie den Predigtzettel sowie Familien-/Jugendfotos ein, falls vorhanden, und speichern Sie.

### Präsentieren

Von der Service-Seite aus:

- **PPTX herunterladen** — die Offline-Präsentation. Diese läuft weiter, wenn Netzwerk, Notebook oder Server ausfallen.
- **Präsentieren** — die Operatorkonsole. Aktuelle und nächste Folie, Miniaturstreifen, Folienliste und **Alle Folien**, um an jede Stelle zu springen.
- **Beamer öffnen** — ein separates Fenster zum Ziehen auf den zweiten Bildschirm. Pfeiltasten steuern beide. `B` blendet den Beamer aus und wieder ein.

### Optionale Zusatzfunktionen

**Bibelstellen-Suche.** Der Präsentationsmodus kann eine KJV-Bibelstelle auf den Beamer legen. Der Korpus liegt unter `data/en/bible-translation/kjv.json` und wird bei jedem Start aus dieser Datei abgeglichen.

**Chat-Import.** `POST /api/webhook` mit einem `x-webhook-secret`-Header nimmt einen Ablaufplan als JSON entgegen, sodass ein Bot einen Gottesdienst anlegen oder korrigieren kann. Das Geheimnis liegt in `.env`; der Endpunkt wird ausschließlich davon abgesichert, niemals durch eine Sitzung.

### Fehlerbehebung

**`Missing song book corpus`** — `data/song-book/sdah.json` fehlt. Die Datei liegt dem Repository bei, stellen Sie sie also aus der Versionskontrolle wieder her: `git checkout -- data/song-book/sdah.json`. Führen Sie danach `npm run corpus:verify` aus, um zu bestätigen, dass beide Korpora vollständig sind.

**Ausgesperrt** — `npm run auth:set-password -- admin` setzt über eine interaktive Eingabeaufforderung ein neues Passwort. `npm run auth:unlock -- --list` zeigt die Anmeldedrosselung an und hebt sie auf.

**Bilder fehlen in der Präsentation** — externe Bilder müssen die URL-Sicherheitsregeln erfüllen. Der direkte Upload auf den Server funktioniert immer.

## An die eigene Gemeinde anpassen

Das mitgelieferte Register ist ein Arbeitsbeispiel — ein echter Gottesdienstablauf mit Platzhalter-Kontakt- und Zahlungsdaten. Zwei Dinge sollten Sie ändern:

1. **Folienvorlagen.** Melden Sie sich als Administrator an und öffnen Sie `/admin/artifacts`. Jede Vorlage ist auf einer Leinwand bearbeitbar; die feststehenden Folien (Kollekte, Wochengebet, Kontakt) sind die Stelle für Ihre eigenen Angaben.
2. **Private Überschreibung.** Wenn Sie das Register Ihrer Gemeinde ganz aus Git heraushalten möchten, legen Sie es unter `data/local/default-registry.json` ab — die Anwendung sät stattdessen von dort. Dieser Pfad ist von Git ignoriert. Siehe [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Mitgelieferte Korpora

Zwei Standardkorpora sind eingebunden, sodass ein frisch geklonter Stand eine Liednummer und eine Bibelstelle auflöst, ohne dass beim Start eine zusätzliche Datei oder ein Netzwerk nötig ist:

| Datei | Enthält | Beim Start |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 Lieder des Seventh-day Adventist Hymnal | Titel und Liedtext werden aus der Datei neu übernommen |
| `data/en/bible-translation/kjv.json` | 66 Bücher, 1189 Kapitel, 31102 KJV-Verse | bei jedem Start aus der mitgelieferten Datei abgeglichen (~130–150 ms gemessen) |

`npm run corpus:verify` prüft, dass beide vollständig sind. Keiner der beiden hat einen Generator: Die Exporte, aus denen sie einst konvertiert wurden, existieren nicht mehr — diese Dateien sind daher die maßgebliche Quelle und sollten aus der Versionskontrolle wiederhergestellt statt neu erzeugt werden.

Lesen Sie [ATTRIBUTIONS.md](ATTRIBUTIONS.md) — dort werden die Rechteinhaber genannt, der nicht-kommerzielle gemeindliche Verwendungszweck erklärt und ein Kontakt für Löschanfragen angegeben. Jeder Korpus trägt zusätzlich seinen eigenen Lizenztext innerhalb der Datei.

Wenn Sie dies für ein anderes Gesangbuch anpassen, fügen Sie Ihren Korpus unter `data/song-book/<book-code>.json` in derselben Form hinzu. Lieder werden über `(book_code, number)` indiziert, sodass ein zweites Buch neben dem mitgelieferten steht, statt es zu ersetzen.

## Betrieb

Kompilieren Sie die Go-API und das SPA, führen Sie `./api` (oder `npm start`) auf einem Host mit Node 22 im `PATH` für den PPTX-Worker aus — siehe [`.constitution/project/deployment.md`](.constitution/project/deployment.md). SQLite, hochgeladene Bilder und der Präsentations-Cache benötigen alle dauerhafte Host-Pfade; diese Datei nennt, welche.

## Projektgeschichte

Dieses Projekt begann als privates Repository für eine einzelne Gemeinde. Diese Historie wurde hier nicht übernommen, da sie echte Mitgliedernamen, Fotografien identifizierbarer Personen einschließlich Minderjähriger, Screenshots privater Nachrichten und einen aktiven Zahlungscode enthielt — nichts davon gehörte in ein öffentliches Repository, und nichts davon lässt sich nach einer Indizierung wieder zurücknehmen.

Dieses Repository beginnt daher mit einem einzigen initialen Commit mit einer synthetischen Beispielgemeinde. Warum das System so aufgebaut ist, wie es ist, steht in `.what/` und `.how/` (DEC-001).

Mitwirkende: Bitte lesen Sie [`.constitution/project/private-data.md`](.constitution/project/private-data.md) vor Ihrem ersten Commit. Es gibt einen Test, der fehlschlägt, sobald Gemeindedaten in eine versionierte Datei gelangen — und das aus gutem Grund.

## Lizenz und Markenschutz

- **Code-Lizenz:** Veröffentlicht unter der [MIT-Lizenz](LICENSE).
- **Liedkorpus & Danksagungen:** Gesangbücher, Bibelübersetzungen und Lizenzen Dritter sind in [ATTRIBUTIONS.md](ATTRIBUTIONS.md) aufgeführt.
- **Datenschutz & Sicherheit:** Kein Cloud-Backend und null Telemetrie — jede Anfrage bleibt auf Ihrem Rechner oder im lokalen Netzwerk Ihrer Gemeinde. Die einzige Funktion, die mit einem anderen Host spricht, ist die manuelle Synchronisation, und dieser Host ist eine weitere WorshipDeck-Instanz, die Sie selbst betreiben und die nur erreicht wird, wenn ein Bediener sie auslöst (siehe [PRIVACY.md](PRIVACY.md) und [SECURITY.md](SECURITY.md)).
- **Markenhinweis:** Die MIT-Lizenz gewährt Rechte am Code, nicht an Namen oder Logos. Die Namen **WorshipDeck** und **Wira Delta Indonesia** sowie das Produktlogo sind Eigentum der PT Wira Delta Indonesia.
