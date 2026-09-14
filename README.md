# worship-presenter-web

A self-hosted hub that turns a worship service rundown into slides — a downloadable PowerPoint deck for offline use, and a dual-screen presenter for the room.

Built for a Seventh-day Adventist congregation, but the slide templates are data rather than code, so any church running a similar order of service can adopt it by editing them.

## What problem it solves

Preparing worship slides by hand takes hours, most of it spent typing hymn lyrics that were already typed last month. A last-minute song change means redoing the deck. And the knowledge of how to build it lives with one volunteer.

This takes the rundown a service planner already writes — in a chat message or a form — and produces the finished slides.

```
rundown text  →  parsed service  →  slide plan  →  ┬→  PowerPoint deck (offline)
                                                   ├→  full-screen slideshow
                                                   └→  presenter + projector
```

Hymn lyrics come from a local corpus, looked up by number. Layouts come from a registry an administrator can edit in the browser. Nothing needs a network connection once the deck is downloaded — which matters, because the deck is what runs the service if anything else fails.

## Features

- **Rundown intake** — paste into the web form, or `POST` from a chat bot to a secret-gated webhook. Unrecognised lines are surfaced, never silently dropped.
- **Hymn resolution** — hymns referenced by number are expanded into title and lyric slides, split for readability, with the refrain repeated after each verse.
- **Editable slide templates** — 28 templates in a SQLite registry with a canvas editor: move and resize elements, change text and styling, add your own text boxes and shapes, reset any template to its shipped state.
- **One layout, four outputs** — the same hydrated slide drives the PowerPoint deck, the web slideshow, the projector and the live preview. No per-format layout code.
- **Presenter mode** — current and next slide, a thumbnail filmstrip, a slide list, a jump-to-any-slide grid, the run sheet, and a real second window you can drag onto the projector.
- **Blank screen** — black the projector out and restore it without losing your place.
- **Selectable transitions** — none, cut, fade, dissolve or push, applied identically to the deck and the browser.
- **Scripture lookup** — pull a KJV passage onto the projector during the service and clear it again.
- **Announcement flyers** — a persistent list, with images uploaded to the hub or pulled from an allow-listed URL.
- **Accounts and roles** — per-person admin and operator accounts, rate-limited sign-in, and sessions that can actually be revoked.

## Requirements

Go 1.24 and Node.js 22 or newer. `npm install` installs the SPA, PPTX worker, and tests. Storage is SQLite; there is no separate database server.

## Quickstart

```bash
git clone https://github.com/wiradigitalid/worship-presenter-web.git
cd worship-presenter-web
npm install
npm run setup
npm run dev
```

`npm run setup` generates `.env` with fresh secrets, creates the database, seeds the slide registry, and prints the admin password it generated for you. `npm run dev` starts the Go API on <http://localhost:3000> and the React SPA on <http://localhost:5173> (Vite proxies `/api` to Go). Sign in as `admin` on the SPA. For a single origin, `npm run spa:build && npm start` and open port 3000. Re-running setup is safe: it never overwrites an existing `.env` or database.

See [`.constitution/project/private-data.md`](.constitution/project/private-data.md) before you put your own congregation's details in.

### Create a service

**Services → New.** Paste a rundown into the raw text box. The shape it expects looks like this (synthetic names):

```
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

Press **Parse**. Roles, timings and hymn numbers are pulled out into the form; hymns are resolved to titles from the corpus. Anything the parser could not place is listed rather than dropped.

Fill in the sermon flyer and family/youth photographs if you have them, then save.

### Present it

From the service page:

- **Download PPTX** — the offline deck. This is the one that runs the service if the network, the laptop or the hub lets you down.
- **Present** — the operator console. Current and next slide, a filmstrip, a slide list, and **All slides** to jump anywhere.
- **Open projector** — a separate window to drag onto the second screen. Arrow keys advance both. `B` blanks the projector and restores it.

### Optional extras

**Scripture lookup.** Presenter mode can put a KJV passage on the projector. The corpus ships at `data/en/bible-translation/kjv.json` and is reconciled from that file on every boot.

**Chat intake.** `POST /api/webhook` with an `x-webhook-secret` header accepts a rundown as JSON, so a bot can create or correct a service. The secret is in `.env`; the endpoint is gated by it alone and never by a session.

### Troubleshooting

**`Missing song book corpus`** — `data/song-book/sdah.json` is absent. It ships with the repository, so restore it from version control: `git checkout -- data/song-book/sdah.json`. Then `npm run corpus:verify` to confirm both corpora are whole.

**Locked out** — `npm run auth:set-password -- admin` sets a new password from an interactive prompt. `npm run auth:unlock -- --list` shows and clears sign-in throttling.

**Deck missing images** — remote images must pass the URL safety rules. Uploading to the hub instead always works.

## Making it yours

The shipped registry is a worked example — a real order of service with placeholder contact and payment details. Two things to change:

1. **Slide templates.** Sign in as an administrator and open `/admin/artifacts`. Every template is editable on a canvas; the standing slides (offering, midweek prayer, contact) are where your own details go.
2. **Private overrides.** If you would rather keep your congregation's registry out of git entirely, drop it at `data/local/default-registry.json` and the app seeds from that instead. That path is git-ignored. See [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Shipped corpora

Two default corpora are committed, so a clone resolves a hymn number and a scripture reference with no file handed to it and no network at boot:

| File | Seeds | On boot |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 hymns of the Seventh-day Adventist Hymnal | title and lyrics re-applied from the file |
| `data/en/bible-translation/kjv.json` | 66 books, 1,189 chapters, 31,102 KJV verses | reconciled from the committed file on every boot (~130–150 ms measured) |

`npm run corpus:verify` asserts both are whole. Neither has a generator: the exports they were converted from are gone, so these files are the source of record — restore from version control rather than rebuilding.

Please read [ATTRIBUTIONS.md](ATTRIBUTIONS.md) — it names the copyright holders, states the non-commercial congregational purpose, and gives a contact for removal requests. Each corpus also carries its own licence text inside the file.

If you are adapting this for a different hymnal, add your corpus at `data/song-book/<book-code>.json` in the same shape. Hymns are keyed by `(book_code, number)`, so a second book sits alongside the shipped one instead of replacing it.

## Deployment

Build the Go API and SPA, run `./api` (or `npm start`) on a host with Node 22 on `PATH` for the PPTX worker — see [`.constitution/project/deployment.md`](.constitution/project/deployment.md). SQLite, uploaded images and the deck cache all need durable host paths; that file covers which. Dev deploy to `presenter-dev.bic.my.id` is systemd + nginx on a VPS (runbook lives in the devops repo).

## Project history

This project began as a private repository for one congregation. That history is not carried over here, because it contained real member names, photographs of identifiable people including minors, private message screenshots, and a live payment code — none of which belonged in a public repository, and none of which can be un-published once indexed.

This repository therefore starts from a single initial commit with a synthetic example congregation. Why the system is shaped the way it is lives in `.what/` and `.how/` (DEC-001).

Contributors: please read [`.constitution/project/private-data.md`](.constitution/project/private-data.md) before your first commit. There is a test that fails if congregation data reaches a tracked file, and it is there for a reason.

## Licence

[MIT](LICENSE) for the code. Third-party content is covered separately in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

## The name and the icon

The MIT licence in [LICENSE](LICENSE) grants broad rights over the code. It says nothing about names
or logos — so it covers this repository's code, not the name **Worship Presenter Web**, not
**Wira Digital Indonesia**, and not the icon or wordmark.

You may use those names to refer to this project: "based on Worship Presenter Web", "a fork of it",
"compatible with it". You may not use them as the name of your own product, or in a way that
suggests you are this project or endorsed by it.

If you publish a modified build — and adapting this for another tradition is expressly encouraged —
please give it your own name, so the congregations using it know whom to ask when it breaks. The
code is yours to take; the name is not.

This is separate from the hymn corpus, which is not ours to license at all. See
[ATTRIBUTIONS.md](ATTRIBUTIONS.md).
