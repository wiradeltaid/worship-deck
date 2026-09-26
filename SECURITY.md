# Security Policy
<!-- Copied from the Wira Delta Indonesia legal source (worship-deck/security.en.md) on 2026-09-26.
     Edit the source, then copy it here again. -->

This is an English translation of the Indonesian original ([SECURITY.id.md](SECURITY.id.md)). If the two differ in interpretation, the Indonesian text prevails.

**Effective:** September 24, 2026 · applies to WorshipDeck 0.1.0

WorshipDeck stores the names and photos of people who are not its direct users, namely the personal data of members and of those serving. The server accepts file uploads, including PowerPoint files that are unpacked on the server. The server fetches images from web addresses that account holders supply, and by default it accepts any public host. On a server installation, WorshipDeck can be opened from other computers and phones on your network. These properties deserve scrutiny. See "Two Facts Most People Want Up Front" below, [`docs/threat-model.md`](docs/threat-model.md) for the full analysis of components and attack paths, and the [Privacy Policy](PRIVACY.md) for what is stored and where.

In this document, "you" means the church or organization that installs and runs WorshipDeck, and "server" means the computer WorshipDeck runs on.

## Two Facts Most People Want Up Front

1. **Does WorshipDeck send member data anywhere?** No request in the code sends names, photos, or service content to a third party or to Wira Delta Indonesia. The server makes exactly two kinds of outbound request, and both only fetch an image from a web address an account holder chose: uploading an image from a web address (`postUploadFromURL`), and placing an image from a web address into a PowerPoint file while that file is built. There is no request to Google Fonts, no update check, no telemetry, and no crash reporting. Service data leaves the server only through PowerPoint files and pages that account holders open, and through the experimental Manual Sync, to an address an admin types in.
2. **What network input does it accept, and how is it restricted?** Without a valid session, the server accepts only the sign-in page, sign-in and sign-out requests, static files under `/assets` and `/branding`, the initial administrator setup request (restricted strictly to desktop mode, loopback connections from the local machine, and only while zero accounts exist), and the webhook endpoint. The webhook endpoint is not offered in this release and is disabled in the code until the feature is ready. Every other endpoint requires a session cookie signed with `AUTH_SECRET` and checked again against the database on every request. Admin paths, including PowerPoint import, font upload, and Manual Sync, also require the admin role. Fetching an image from a web address does not follow redirects, refuses loopback, private network, link-local, and cloud metadata addresses, and accepts only hosts in `IMAGE_URL_ALLOWLIST` when that list is filled in.

## Reporting a Vulnerability

Please do not open a public issue for a security problem.

Report it privately through [GitHub Security Advisories](https://github.com/wiradeltaid/worship-deck/security/advisories/new) on the WorshipDeck repository. WorshipDeck's source code is public, so an outside reporter can reach this path, and the report stays private until a fix exists. Questions that are not about security can go to support@wiradelta.com.

You will get an acknowledgement, then a fix or an explanation of why the report is not a vulnerability. There is no bug bounty program and no guaranteed response time. This is a small project, and honesty about that is more useful than a promise it cannot keep. Only the latest release receives fixes. There is no long-term support branch.

## Scope

**In scope**, and especially welcome:

- sign-in, sessions, and session revocation;
- the separation between the admin and operator roles;
- fetching images from a web address, including ways around the private address refusal;
- file uploads and PowerPoint file import;
- phone remote pairing and remote commands;
- Manual Sync, even though it is still experimental, and any way to make the disabled webhook endpoint accept a request;
- text from an order of service or other data that appears as HTML on the congregation screen instead of as text.

**Out of scope**, with the reason:

- An attacker who already holds an admin account. An admin may change all content, upload files, and run sync by design; using that right is not a vulnerability.
- An attacker who can already read the server's file system or runs under the same account as the server. That person can read `data.db`, `.env`, and the `AUTH_SECRET` in the data folder directly, so there is nothing the application could protect from them.
- A server installation without HTTPS, with an `AUTH_SECRET` that is shared or copied from the `.env.example` sample, or with `NODE_ENV` set to anything other than `production` behind HTTPS. These requirements are listed under "Deployment Requirements"; an installation that skips them is insecure regardless of the code.
- The risks under "Known Risks" below. They are documented rather than fixed. Reports of a new way to exploit them are still welcome.

## Projection Display and Injected Content

Orders of service, names, and service text reach the congregation screen as data, not as markup. The frontend code has no `dangerouslySetInnerHTML` and no direct `innerHTML` assignment anywhere in `src/` and `spa/src/`, so React's default JSX rendering escapes text before it appears on the screen the congregation sees. A report that shows a path where text from an account holder appears as HTML is a valid, in-scope finding.

## Deployment Requirements

The code does not enforce the requirements below. It only assumes they are met, and an installation that skips them is insecure regardless of the code.

1. **HTTPS for server installations, also on the church network.** Run a WorshipDeck server installation behind an HTTPS reverse proxy (for example Caddy, Nginx, or Cloudflare Tunnel), also when the server is opened only from the church network. Without HTTPS, passwords and session cookies can be read by anyone on the same network, including guest Wi-Fi. The Windows installer is exempt from this requirement: it listens only on `127.0.0.1`, so its traffic does not leave that computer.
2. **A unique secret.** Set `AUTH_SECRET` to a random value of at least 16 characters, unique to each installation, and never commit it. `npm run setup` generates it at random. The Windows installer generates it by itself the first time it runs and stores it in the `%LOCALAPPDATA%\WorshipDeck\` folder; the first admin account is created on the setup screen. If `AUTH_SECRET` is empty or shorter than 16 characters, nobody can sign in.
3. **`NODE_ENV=production` behind HTTPS.** The session cookie gets the `Secure` flag only when `NODE_ENV` is `production`. Without it, the browser will send the session cookie over plain HTTP.
4. **Limit image sources.** Put the image hosts you use in `IMAGE_URL_ALLOWLIST`. Without that list, the server will fetch images from any public host.
5. **Listen only where needed.** The server listens only on `127.0.0.1` unless `LISTEN_HOST` or `--host` is set. Set it only when other computers or phones really need to open it, and only behind HTTPS.
6. **Storage under your control.** Keep the database and the upload folder on storage you control, limit who can sign in to the server, and make backups regularly.

## Known Risks

The risks below are documented rather than fixed. The full description is in [`docs/threat-model.md`](docs/threat-model.md).

- **IP address for sign-in rate limiting.** The sign-in rate limiter reads the client address from the `CF-Connecting-IP` or `X-Forwarded-For` header when present. If the server can be reached without passing through a proxy that overwrites those headers, a client can choose its own address and avoid the per-IP limit. Put the server behind a proxy that overwrites those headers, and do not expose the server port directly.
- **Manual Sync.** `POST /api/sync/push` and `POST /api/sync/assets/check` do not limit the size of the request body. The "Device Authorization Token" field on the Manual Sync page is sent but not read by the server, so it is not a security control. Without CORS support, sync between two different origins cannot yet work.
- **Image sources open by default.** See requirement 4.

## Deletion Is Permanent

WorshipDeck has no trash. Data deleted through the application is gone from the database and cannot be recovered from the application. Deleting an announcement slide or a Background Library image does not remove the image file from the upload folder. The details are in the Privacy Policy, under "Deletion".

## Release Integrity

Building from source is always available: clone the repository at the commit or tag you choose, build it yourself, and you are running exactly the code you can read.

A Windows installer is published on GitHub Releases for each tag, named `WorshipDeck-<version>-x64-setup.exe`. The installer is still experimental; the main way to use WorshipDeck is a server installation. The installer is built by CI (`.github/workflows/release.yml`) directly from that tag's source code. The workflow runs the Go tests, the type check, and the guard tests before building the installer, and refuses to release if the tag, the version in `package.json`, and the matching section of `CHANGELOG.md` disagree.

The installer is **not code-signed**. Because of that, Windows SmartScreen will likely warn the first time it runs. That warning is normal for an unsigned installer, and for the same reason the warning cannot help you tell a genuine installer from a fake one.

What you can check is the SHA-256 checksum. Every release publishes a `SHA256SUMS` file next to the installer. Hash the file you downloaded and compare before running it. Know its limit: a checksum served from the same place as the download proves the file arrived intact, **not** where it came from. Code signing is the real fix, and it has not been done yet.

## Privacy

If this repository ever contains data about a real person who did not consent to it, that is a security issue and will be treated as one. See [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Language

This is an English translation of the Indonesian original. If the two differ in interpretation, the Indonesian text prevails.
