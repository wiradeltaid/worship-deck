# Privacy

**Last updated:** 2026-09-16

Worship Presenter Web is **self-hosted**. You — the congregation or organisation that installs it —
run it on your own server, and the data it holds never leaves that server unless you send it
somewhere. Wira Delta Indonesia writes the software. It does not operate your installation, does
not receive a copy of your data, and has no access to it.

That distinction decides who is responsible for what, so it is worth stating plainly rather than
leaving to be inferred:

| | Wira Delta Indonesia | You, the operator |
|---|---|---|
| Writes and maintains the code | Yes | No |
| Runs the server, holds the data | No | Yes |
| Decides who gets an account | No | Yes |
| Answers a member asking what is stored about them, or asking for it to be deleted | Cannot — has no access | Yes |

Under Indonesia's Personal Data Protection Law (UU 27/2022) and equivalent laws elsewhere, that
makes **you** the data controller for your installation. This document describes what the software
does with data so you can meet that responsibility. It is not a privacy policy you can hand to your
members as-is — see "For operators" at the end.

## What the application holds

| Data | Where it comes from | Why it exists |
|---|---|---|
| **Member names** | Entered by an administrator or operator | Assigning people to parts of the service |
| **Photographs** | Uploaded through the application | Shown on slides and in announcement flyers |
| **Service records** | Rundowns entered, pasted, or received through the webhook | Building and re-running services |
| **Accounts** | Created by an administrator | Sign-in, and per-person admin/operator roles |
| **Sessions** | Created at sign-in | Keeping a person signed in; revocable by an administrator |
| **Announcement images** | Uploaded, or fetched from a URL on your allow-list | Flyers shown during the service |

**Photographs of people are treated more strictly than the rest** by Indonesian law and by most
other data-protection regimes. If your congregation photographs children, that is stricter again.
The application does not distinguish these from any other upload — that judgment, and the consent
behind it, is yours.

## Where it is stored

| Path | Contents | Retention |
|---|---|---|
| SQLite database file — `./data.db` next to the server binary by default, or the path in `DB_PATH` | Members, services, accounts, sessions, the editable slide-template registry | Until deleted through the application or removed from the server |
| Upload directory — `./data/uploads` by default, or the path in `UPLOADS_DIR` | Uploaded photographs and announcement images | Until removed from the server (see note below) |

Both sit on storage **you** control. Their security is the security of that server: file
permissions, backups, disk encryption, and who can log in to it. The application does not encrypt
them on top of that, and does not pretend to.

**Deleting a member or an announcement through the interface removes the database row, not the
uploaded image file on disk.** The photograph or flyer image stays in the upload directory until an
operator removes it directly from the server's filesystem. If your congregation needs a photo gone
completely, delete it from both places.

## Network activity

Everything below is a request **your server** makes or receives. The application makes no request
to Wira Delta Indonesia, on any path, ever. There is no telemetry, no analytics, no crash
reporting, and no licence or update check.

- **The rundown webhook.** The application accepts a `POST` of a service rundown at a secret-gated
  endpoint, so a chat bot can send one in. Whoever holds `WEBHOOK_SECRET` can submit a rundown.
  Treat that secret as a credential, keep it unique to your deployment, and never commit it.
- **Announcement images from a URL.** When an operator supplies an image URL, your server fetches
  it. The site hosting that image sees your server's IP address, as it would for any request. Only
  hosts on your allow-list can be fetched.
- **Scripture lookup.** The King James Version text is a corpus file committed in the repository
  (`data/en/bible-translation/kjv.json`), reconciled into the database on first boot. A lookup reads
  your own database — no request leaves your server, and no third-party host is contacted.
- **Hymn lyrics** come from a corpus file shipped with the application. No lookup leaves your
  server.
- **Manual Sync (`/admin/sync`).** If you run more than one WorshipDeck instance — for example a
  desktop app on one laptop and a browser build on another — an administrator can push and pull
  Services, member names in them, photographs, Song Set entries, background images, and
  announcements between those two instances, over your local network, address entered by hand.
  This is the one feature that moves the data in "What the application holds" above to somewhere
  other than the server it was entered on. It runs only when an administrator on one instance
  triggers it, never automatically, and only reaches the address that administrator supplies — no
  third party, and never Wira Delta Indonesia. **If you sync, the second instance becomes a second
  copy of that data**, and you are the data controller for that copy too. **This feature is
  experimental.** It has been verified as one server exchanging data with itself; syncing between
  two genuinely separate machines has not yet been confirmed working end-to-end, and the browser's
  own cross-origin rules may refuse the request outright before any data moves. Do not rely on it
  as your only path to keep two instances consistent until this is confirmed.

Once a PowerPoint deck is downloaded, running the service needs no network at all — which is
deliberate, because the deck is what runs the service if anything else fails.

## What the software does not do

- It does not send anything to Wira Delta Indonesia.
- It does not include an analytics script, a tracking pixel, or a third-party font or CDN request
  that would tell an outside party who is using it. Fonts (`@fontsource/geist-sans`,
  `@fontsource/geist-mono`) ship as npm packages bundled into the app, not loaded from a font CDN.
- It does not create accounts by itself. Every account exists because an administrator made it.

## For operators: what you still have to do

The software being private does not make your installation compliant. At minimum:

1. **Write your own notice for your members** — see [`docs/operator-privacy-template.md`](docs/operator-privacy-template.md) for a customizable template — saying what your congregation stores, why, for how
   long, and whom to ask for removal. This document describes the software; it does not describe
   your practices, and it cannot.
2. **Obtain consent before photographing people**, and separately before publishing those
   photographs on slides — especially for children.
3. **Run it behind HTTPS**, with `AUTH_SECRET` and `WEBHOOK_SECRET` unique to your deployment and
   never committed. `SECURITY.md` states that a deployment skipping this is insecure regardless of
   the code, and that remains true.
4. **Remove accounts when people leave** a role, and revoke their sessions.
5. **Decide how long you keep past services and photographs**, and actually delete them. Nothing
   in the application expires on its own.
6. **If you use Manual Sync**, treat the second instance as a second copy of every record it
   receives — deleting a member's data on one instance does not remove it from the other, and
   both need their own retention decision.

## Questions

About this software: **support@wiradelta.id**. About the data in a particular installation, ask
whoever runs it — Wira Delta Indonesia cannot see it and cannot answer for it.
