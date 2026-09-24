# Security policy

This application stores member names and photographs — personal data of people who are not its
direct users — and accepts two kinds of network input: a secret-gated webhook and an
operator-supplied image URL that your server fetches. Both deserve scrutiny; see "Two facts most
people want up front" below, [`docs/threat-model.md`](docs/threat-model.md) for the full component
and attack vector analysis, and [`PRIVACY.md`](PRIVACY.md) for what is stored and where.

## Two facts most people want up front

1. **Does it send member data anywhere?** No outbound request in the codebase carries member names,
   photographs, or service content to a third party or to Wira Delta Indonesia. The only outbound
   HTTP call the server makes is fetching an image from a URL an operator explicitly supplies
   (`postUploadFromURL`), and that call goes to the address the operator chose, not to WDI.
2. **What network input does it accept, and how is it restricted?** The rundown webhook is
   secret-gated (`WEBHOOK_SECRET`); the URL-based image fetch is restricted to an allow-list and
   refuses redirects. No other endpoint accepts unauthenticated input.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub Security Advisories on this repository, or
contact the maintainer through the org at <https://github.com/wiradeltaid>.

You will get an acknowledgement, and a fix or an explanation of why it is not
one. This is a volunteer-maintained project for congregations, so please allow
reasonable time.

## Scope

This application holds member names, uploaded photographs and service records.
Reports about authentication, session handling, the secret-gated webhook, image
URL handling and file upload paths are especially welcome.

## Projection display and injected content

Rundowns, member names, and service text reach the projection view as data, not as markup: the
frontend has no `dangerouslySetInnerHTML` or raw `innerHTML` assignment anywhere in `src/`, so
React's default JSX rendering escapes text content before it reaches the screen shown to the
congregation. A report showing a path where operator- or webhook-supplied text is rendered as HTML
instead of text is a valid, in-scope finding.

## Deployment expectations

The application assumes it sits behind HTTPS, that `AUTH_SECRET` and
`WEBHOOK_SECRET` are unique per deployment and never committed, and that
database and upload directories are on storage the operator controls. A
deployment that skips those is insecure regardless of the code.

## Release integrity

Building from source remains available: clone the repository at the commit or tag you choose, build
it yourself, and you are running exactly what you can read.

A packaged Windows installer is also published on tagged GitHub Releases, built by CI
(`.github/workflows/release.yml`) directly from that tag's source — the workflow runs the Go and
guard test suites before packaging, and refuses to release if the tag, `package.json` version, and
the matching `CHANGELOG.md` entry disagree. The installer is **not code-signed**, so Windows
SmartScreen will likely warn on first run; what you can verify instead is the SHA-256 checksum —
every release publishes a `SHA256SUMS` file alongside the installer. Hash the file you downloaded and
compare before running it.

No tagged release has been cut yet as of this writing; the above describes what a release will
contain once one is.

## Privacy

If this repository ever contains data about a real person who did not consent to
it, that is a security issue and will be treated as one. See
[`.constitution/project/private-data.md`](.constitution/project/private-data.md).
