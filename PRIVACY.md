# Privacy Policy
<!-- Copied from the Wira Delta Indonesia legal source (worship-deck/privacy.en.md) on 2026-09-26.
     Edit the source, then copy it here again. -->

This is an English translation of the Indonesian original ([PRIVACY.id.md](PRIVACY.id.md)). If the two differ in interpretation, the Indonesian text prevails.

**Effective:** September 24, 2026 · applies to WorshipDeck 0.1.0

WorshipDeck is worship presentation software that you install and run yourself. In this document, "you" means the church or organization that installs and runs WorshipDeck, and "server" means the computer WorshipDeck runs on, including a laptop that uses the Windows installer. The data WorshipDeck stores stays on your server unless you send it somewhere yourself. Wira Delta Indonesia writes the software. Wira Delta Indonesia does not run your installation, does not receive a copy of your data, and has no access to it.

This division decides who is responsible for what, so we state it plainly:

| | Wira Delta Indonesia | You |
|---|---|---|
| Writes and maintains the code | Yes | No |
| Runs the server and holds the data | No | Yes |
| Decides who gets an account | No | Yes |
| Answers a member who asks what is stored about them, or who asks for it to be deleted | Cannot, because it has no access | Yes |

Under Indonesia's Personal Data Protection Law (Law No. 27 of 2022, UU PDP) and similar laws in other countries, this division makes **you** the data controller for your installation. This document explains what the software does with data, so that you can meet that responsibility. It is not a privacy policy you can hand to your members as it is. See "What Remains Your Responsibility" at the end.

## What the Application Stores

| Data | Where it comes from | What it is for |
|---|---|---|
| **Orders of service and service content** | Typed or pasted by an account holder | Building service slides and showing them again |
| **People's names** | Typed into order of service fields, for example the names of those serving | Showing who serves in each part of the service. WorshipDeck has no separate member list; names exist only inside service data |
| **Photos and images** | Uploaded, fetched from a web address an account holder supplies, or imported from a PowerPoint file | Shown on slides, in announcements, and in the Background Library |
| **Your slide designs** | Built in the slide editor, or imported from a PowerPoint file | How the service slides look. A new installation starts empty, with no templates |
| **Uploaded fonts** | Uploaded by an admin | Used on slides and embedded in exported PowerPoint files |
| **Accounts** | Created by an admin. The first admin account is created on the setup screen the first time the Windows installer runs, or, on an installation from source, from `AUTH_BOOTSTRAP_USER` and `AUTH_BOOTSTRAP_PASSWORD` when no account exists yet | Signing in with an admin or operator role. Passwords are stored as scrypt hashes, not as plain text |
| **Revoked session list** | Recorded when someone signs out or an admin revokes their session | Refusing that session until it would have expired |
| **Failed sign-in records** | Recorded on every failed sign-in | Slowing down password guessing. Each record holds the username that was typed and the IP address the request came from |
| **Settings** | Set by an admin | Interface language, slide transition, default Bible translation, and similar settings |

The sign-in session itself is not stored on the server. It travels in a signed `auth_session` cookie in the browser and lasts at most 7 days.

**Photos of people are treated more strictly than other data** by Indonesian law and by most data protection rules in other countries. If your congregation photographs children, the rules are stricter again. WorshipDeck cannot tell a photo of a person apart from any other upload, and cannot judge what is written in an order of service. That judgment, and the consent of the people concerned, is your responsibility.

## Where the Data Is Stored

| Path | Contents | Retention |
|---|---|---|
| SQLite database file: `data.db` in the folder the server is started from, or the path in `DB_PATH`. With the Windows installer: `%LOCALAPPDATA%\WorshipDeck\data.db` | All data in the table above, except image and font files | Until deleted through the application or removed from the server. Uninstalling does not remove the `%LOCALAPPDATA%\WorshipDeck\` folder |
| Upload folder: `data/uploads/` in the folder the server is started from, or the path in `UPLOADS_DIR`. With the Windows installer: `%LOCALAPPDATA%\WorshipDeck\uploads\` | Photos and images that were uploaded, fetched from a web address, or imported from PowerPoint; uploaded fonts in the `fonts` subfolder | See "Deletion" below |
| `%LOCALAPPDATA%\WorshipDeck\runtime.json` (Windows installer) | The address and port of the running server | Removed when the application closes normally |
| `AUTH_SECRET` in the `%LOCALAPPDATA%\WorshipDeck\` folder (Windows installer) | A random secret for signing sign-in sessions, generated automatically the first time the installer runs | Until that folder is removed. Uninstalling does not remove it |
| `.env` file (installation from source) | `AUTH_SECRET` and the first admin account's password in plain text, written by `npm run setup` | Until you change or delete it |

The Windows installer also creates a `%LOCALAPPDATA%\WorshipDeck\logs\` folder. This version writes nothing to it; server messages appear only in the terminal window or in the service log of whatever you use to run it.

An exported PowerPoint file is built on request and sent straight to the browser. The server does not keep a copy.

All of the files above sit on storage **you** control. Their security is the security of that server: file permissions, backups, disk encryption, and who can sign in to the server. WorshipDeck does not encrypt these files, and does not pretend to. Treat them as readable by anything else that runs under the same Windows account or server account.

### Deletion

- **Deleting a service** removes its data from the database, then removes the upload files that service used if no other data still uses them.
- **Deleting an announcement slide or a Background Library image** removes only its data from the database. The image file stays in the upload folder until it is removed directly from the server's file system. If a photo must be gone completely, delete it from both places.
- **Deleting an uploaded font** removes the font file as well.
- **There is no trash.** Deletion through the application is permanent and cannot be undone from the application. Deleted data can come back only from a backup you made yourself.

## What Is Stored in the Browser

| Name | Contents | Retention |
|---|---|---|
| Cookie `auth_session` | Signed sign-in session: account number, role, and expiry | 7 days, or until you sign out |
| `localStorage` `theme` | The light or dark theme choice | Until the site data in the browser is cleared |
| `localStorage` `wpw_presenter_loop_interval` | The announcement loop interval in the operator console | Until the site data in the browser is cleared |
| `localStorage` `wpw_device_id`, `wpw_sync_remote_url`, `wpw_sync_device_token` | The device identity, target instance address, and token entered on the Manual Sync page | Until the site data in the browser is cleared |
| `sessionStorage` `wpw_canvas_clipboard` | Slide objects copied in the slide editor | Until the tab is closed |

All of these are stored in the browser under your own server's address, and none is sent to Wira Delta Indonesia.

## Network Activity

Everything described below is a request that **your server** makes or receives, or that a browser opening your server makes. WorshipDeck makes no request to Wira Delta Indonesia, on any path. There is no telemetry, no analytics, no crash reporting, and no license check or update check.

### Images From a Web Address

An account holder can enter the web address of an image, either to upload it to the server or to place it directly on a slide or announcement.

- **What is sent.** An ordinary request for that image address. No service data, names, or photos are sent with it.
- **What is still revealed.** The site that hosts the image sees your server's IP address and the time of the request. If the image is placed directly from its web address, every browser that shows it (operator console, congregation screen, editor) also requests it from that site, so that site sees the IP address of that browser. The server also requests it again each time it builds a PowerPoint file that contains the image.
- **What is not sent, and cannot be.** The request carries no session cookie, no order of service, and no database content. The server does not follow redirects, refuses loopback, private network, link-local, and cloud metadata addresses, accepts only JPG, PNG, GIF, and WebP images, stops at 16 MB, and gives up after 8 seconds.
- **How to limit it.** Put the host names you allow in `IMAGE_URL_ALLOWLIST`; from then on only hosts on that list are accepted. If `IMAGE_URL_ALLOWLIST` is empty, which is the default, any public host over `http` or `https` is accepted. To stop it entirely, use only images uploaded from a computer. Nothing breaks except fetching from a web address.

### Phone Remote

On a server installation, an operator can pair a phone as a remote with a 6-digit code that lasts 60 seconds.

- **What is sent.** Remote commands (change slide, blank the screen, change the background, show or clear a verse) from the phone to your server, and the display state from the server to the phone.
- **What is still revealed.** The server sees the phone's IP address on your network.
- **What is not sent.** Nothing leaves the network between the phone and your server. The phone must sign in with a WorshipDeck account first.
- **How to turn it off.** Do not pair a phone. The Windows installer listens only on `127.0.0.1`, so the phone remote cannot be used there at all.

### Manual Sync (Experimental)

If you run more than one WorshipDeck instance, an admin can push and pull service data, Song Set entries, background images, and announcements between two instances, including the names and photos in them, to an address the admin types in.

- **What is sent.** The data named above, from the admin's browser directly to the target instance's address.
- **What is still revealed.** The target instance sees the IP address of the admin's browser.
- **What is not sent.** Nothing is sent to a third party or to Wira Delta Indonesia. Sync runs only when an admin starts it, never automatically.
- **How to turn it off.** Do not use the Manual Sync page. No other feature depends on it.

**If you sync, the second instance becomes a second copy of that data,** and you are the data controller for that copy too. **This feature is experimental.** Sync has been proven only with one server exchanging data with itself. Sync between two genuinely separate computers has not been shown to work, and the browser's cross-origin rules may refuse the request before any data moves. Do not rely on it as your only way to keep two instances the same.

### Webhook Endpoint

WorshipDeck's code contains a `POST /api/webhook` endpoint for receiving an order of service from a chat bot. This feature is not offered in this release and is coming soon. Until the feature is ready, the endpoint is disabled in the code: every request is answered with an error and its content is not read.

### What Makes No Network Request

- **Bible verses.** The King James Version text is a corpus file inside the application (`data/en/bible-translation/kjv.json`) that is loaded into the database the first time the server runs. A verse lookup reads your own database.
- **Song lyrics.** Lyrics come from a corpus file shipped with the application. A song lookup does not leave your server.
- **Fonts.** Every font, including the 35 font families in the font picker, ships inside the application. The operator console, the congregation screen, and PowerPoint export request nothing from Google Fonts or any other font CDN. Fonts embedded in a PowerPoint file are taken from local files.

Once a PowerPoint file is downloaded, the service can run with no network at all. This is deliberate, because that file is what runs the service if anything else fails.

## What the Software Does Not Do

- It does not send anything to Wira Delta Indonesia.
- It does not include an analytics script, a tracking pixel, or a third-party font or CDN request that would tell an outside party who is using it.
- It does not create accounts by itself. Every account exists because an admin created it, because you created the first admin account on the installer's setup screen, or because you filled in `AUTH_BOOTSTRAP_USER` and `AUTH_BOOTSTRAP_PASSWORD`.

## What Remains Your Responsibility

Software that respects privacy does not make your installation compliant by itself. At a minimum:

1. **Write your own notice for your members.** See [`docs/operator-privacy-template.md`](docs/operator-privacy-template.md) for a customizable template. Your notice says what your church stores, why, for how long, and whom members ask for removal. This document describes the software, not your church's practices, and it cannot.
2. **Ask for consent before photographing people**, and ask again, separately, before the photo is shown on a slide, especially for children.
3. **Run a WorshipDeck server installation behind HTTPS**, also when the server is opened only from the church network, with an `AUTH_SECRET` unique to your installation and never committed. The Security Policy states that an installation that skips this is insecure regardless of the code, and that remains true. The Windows installer is exempt from the HTTPS requirement because it listens only on `127.0.0.1`, so its traffic does not leave that computer. Its `AUTH_SECRET` is generated automatically and is unique to each installation.
4. **Remove accounts when someone stops serving**, and revoke their sessions.
5. **Decide how long you keep past services and photos**, and actually delete them. Nothing in the application expires on its own.
6. **If you use Manual Sync**, treat the second instance as a second copy of every record it receives. Deleting someone's data on one instance does not delete it on the other, and each needs its own retention decision.

## Questions

About this software: **support@wiradelta.com**. About the data in a particular installation, ask whoever runs it. Wira Delta Indonesia cannot see that data and cannot answer for it.

## Language

This is an English translation of the Indonesian original. If the two differ in interpretation, the Indonesian text prevails.
