# 01: Remote Code Generator Bugfix and Presenter Header UX

**What to build:**
Repair the remote pairing code generation bug in the Go API (`%0604d` to `%06d`), harmonize the Run-Sheet button styling in PresenterOperator, and provide an intuitive Remote Pairing trigger/dialog in the presenter header with pairing status, 6-digit code display, and mobile URL.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `internal/httpapi/remote.go` formats remote pairing codes strictly as 6-digit zero-padded numbers (`%06d`), returning an exact 6-character numeric string across all random values (including leading zeros, e.g. `001234`).
- [ ] Run-Sheet button in `PresenterOperator.tsx` is styled with standard button variant (`outline`), visually consistent with adjacent actions (`All slides`, `Open projector`).
- [ ] Presenter header replaces the raw inline remote code text with a dedicated Remote Pairing trigger displaying current pairing state and opening a pairing modal/popover.
- [ ] Remote pairing dialog displays the 6-digit pairing code prominently, along with direct URL to `/services/:id/remote` and regenerate/disconnect options.
- [ ] Remote pairing protocol states (`idle`, `pairing`, `connected`, `role-lost`, `error`) and failure cases (expired code, invalid code) transition accurately.
- [ ] Mobile remote controller (`RemoteOperator.tsx`) pairs seamlessly with the 6-digit code.
