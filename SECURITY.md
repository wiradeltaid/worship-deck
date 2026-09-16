# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub Security Advisories on this repository, or
contact security@wiradelta.id or through the org at <https://github.com/wiradeltaid>.

You will get an acknowledgement, and a fix or an explanation of why it is not
one. This is a volunteer-maintained project for congregations, so please allow
reasonable time.

## Scope

This application holds member names, uploaded photographs and service records.
Reports about authentication, session handling, the secret-gated webhook, image
URL handling and file upload paths are especially welcome.

## Deployment expectations

The application assumes it sits behind HTTPS, that `AUTH_SECRET` and
`WEBHOOK_SECRET` are unique per deployment and never committed, and that
database and upload directories are on storage the operator controls. A
deployment that skips those is insecure regardless of the code.

## Privacy

If this repository ever contains data about a real person who did not consent to
it, that is a security issue and will be treated as one. See
[`.constitution/project/private-data.md`](.constitution/project/private-data.md).
