"""inventory readers — how THIS product's code is read. Owned by the product, not the method.

Stack confirmed on disk (wdi-init intent `readers`, 2026-08-19; Host/Screen containers
amended DEC-003 — Go API mux + React SPA routes):

    db      SQLite DDL inside `src/lib/db/index.ts` (`CREATE TABLE IF NOT EXISTS`, better-sqlite3)
    api     Go `mux.HandleFunc` in `internal/httpapi/server.go`
            Host cell is container `api`
    screen  React Router `<Route>` in `spa/src/App.tsx`. Screen identity prefix is container `spa`

The whole file is yours. `wdi-method update` never writes over it and `promote` never publishes it.


WHAT THE ENGINE EXPECTS. Three functions, each taking the repo root and returning a `Derived`:

    derive_db(root)      -> Derived    the tables this product stores
    derive_api(root)     -> Derived    the endpoints it serves
    derive_screen(root)  -> Derived    the screens it renders

Three names are INJECTED before this module executes, so import nothing for them:

    Row(key, cells, source)
    Derived(rows, unread)
    decisions(path)

THE COLUMN ORDER `cells` MUST FOLLOW:

    db      Table · Owning component · What it holds · Key columns · Status
    api     Host · Method · Path · Owning component · Description · Status
    screen  Screen · Route · States · Owning component · UC served

(The leading `No` is the engine's; a reader MUST NOT supply it.)

Whatever a pattern cannot read is appended to `unread`. It MUST NOT be guessed.
"""

from __future__ import annotations

import re
from pathlib import Path

# API Host / SPA screen prefix: C4 containers after DEC-003 (not the as-built Next process).
API_HOST = "api"
SPA_HOST = "spa"

DEFAULT_API_DESC = {
    # DEC-006 remote control relay.
    "POST /api/present/[id]/remote/pair": "Claim the presenting role and get a pairing code to display",
    "DELETE /api/present/[id]/remote/pair": "End the pairing deliberately; idempotent",
    "POST /api/present/[id]/remote/claim": "Bind a remote device to one presenting client using the displayed code",
    "GET /api/present/[id]/remote/stream": "Role-scoped SSE stream: intents to the presenting client, mirrored state to the remote",
    "POST /api/present/[id]/remote/intent": "One control intent from the remote — index, blank, transition, background, scripture, clear-scripture",
    # DEC-004 / DEC-005 surfaces.
    "POST /api/admin/announcement-sets": "Create Announcement Set",
    "GET /api/admin/announcement-sets": "List Announcement Sets",
    "PATCH /api/admin/announcement-sets/[id]": "Rename Announcement Set",
    "DELETE /api/admin/announcement-sets/[id]": "Delete Announcement Set — refused while a spine marker references it (S13 R3)",
    "GET /api/admin/announcement-sets/[id]/slides": "List slides in an Announcement Set",
    "POST /api/admin/announcement-sets/[id]/slides": "Create a slide in an Announcement Set",
    "PUT /api/admin/announcement-sets/[id]/slides/order": "Reorder slides in an Announcement Set",
    "GET /api/admin/announcement-sets/[id]/slides/[slideId]": "One Announcement Set slide",
    "PUT /api/admin/announcement-sets/[id]/slides/[slideId]": "Save an Announcement Set slide layout (AD-6)",
    "PATCH /api/admin/announcement-sets/[id]/slides/[slideId]": "Rename an Announcement Set slide",
    "DELETE /api/admin/announcement-sets/[id]/slides/[slideId]": "Delete an Announcement Set slide — the shared image file survives (DEC-004 Copy / paste)",
    "POST /api/admin/announcement-sets/[id]/slides/[slideId]/reset": "Restore an Announcement Set slide to its shipped seed",
    "GET /api/admin/background-library": "List the background library",
    "POST /api/admin/background-library": "Add a background image (images only, S10)",
    "PATCH /api/admin/background-library/[id]": "Rename a background image",
    "DELETE /api/admin/background-library/[id]": "Remove a background image from the library",
    "GET /api/background-library": "Backgrounds the Operator may switch to during the service (S11)",
    "GET /api/admin/song-books": "List song books",
    "POST /api/admin/song-books": "Create a song book",
    "PATCH /api/admin/song-books/[bookCode]": "Update song book metadata (AD-6)",
    "DELETE /api/admin/song-books/[bookCode]": "Delete a song book — not resurrected on a later boot (AD-17)",
    "GET /api/song-books": "Song books the Operator may choose from",
    "GET /api/admin/song-set-entries": "List Song Set entries",
    "POST /api/admin/song-set-entries": "Create a Song Set entry",
    "PATCH /api/admin/song-set-entries/[variableName]": "Rename a Song Set entry",
    "DELETE /api/admin/song-set-entries/[variableName]": "Delete a Song Set entry — its variable_name may be reused (S13 R2)",
    "GET /api/song-set-entries": "Song Set entries the Service form renders",
    "GET /api/admin/song-set-layouts/[role]": "One layout of the shared Title / Verse / Reff trio (S4)",
    "PUT /api/admin/song-set-layouts/[role]": "Save a shared trio layout (AD-6)",
    "POST /api/admin/song-set-layouts/[role]/reset": "Restore a shared trio layout to its shipped seed",
    "POST /api/services/[id]/song-sets/[variableName]/save-to-book": "Write edited lyrics back to the song book (S12, UC-28)",
    "POST /api/auth/login": "Log in",
    "POST /api/auth/logout": "Log out",
    "POST /api/auth/change-password": "Change password",
    "GET /api/services": "List Services",
    "POST /api/services": "Create Service",
    "PUT /api/services/[id]": "Update Service (AD-6)",
    "DELETE /api/services/[id]": "Delete Service",
    "GET /api/services/[id]/pptx": "Download PPTX",
    "POST /api/services/preview": "Preview",
    "POST /api/services/[id]/sync-artifact": "Sync Artifact (AD-16)",
    "GET /api/announcements": "List announcements",
    "POST /api/announcements": "Add announcement item",
    "PUT /api/announcements": "Reorder list",
    "PATCH /api/announcements/[id]": "Update one item",
    "DELETE /api/announcements/[id]": "Delete one item",
    "POST /api/upload": "Upload image",
    "POST /api/upload/from-url": "Fetch image from URL",
    "GET /api/uploads/[filename]": "Read upload",
    "GET /api/hymns": "Search hymns",
    "GET /api/admin/accounts": "List accounts",
    "POST /api/admin/accounts": "Create account",
    "PATCH /api/admin/accounts/[id]": "Update account",
    "DELETE /api/admin/accounts/[id]": "Delete account",
    "GET /api/admin/settings": "Settings",
    "PUT /api/admin/settings": "Update settings",
    "GET /api/admin/artifacts": "List templates",
    "GET /api/admin/artifacts/[id]": "One template",
    "PUT /api/admin/artifacts/[id]": "Save layout",
    "POST /api/admin/artifacts/[id]/reset": "Restore seed",
    "DELETE /api/admin/artifacts/[id]": "Delete template",
    "PUT /api/admin/artifacts/order": "Reorder templates",
    "GET /api/scripture": "Verse lookup",
    "GET /api/session": "Current session",
    "GET /api/services/[id]": "One Service plus assembled plan",
    "POST /api/webhook": "picoclaw intake / correction",
    # SPEC-44: configurable rundown parser profiles.
    "GET /api/admin/parser-profiles": "List rundown parser profiles",
    "POST /api/admin/parser-profiles": "Create a rundown parser profile",
    "GET /api/admin/parser-profiles/[id]": "One rundown parser profile",
    "PATCH /api/admin/parser-profiles/[id]": "Update a rundown parser profile",
    "PUT /api/admin/parser-profiles/[id]": "Update a rundown parser profile",
    "DELETE /api/admin/parser-profiles/[id]": "Delete a rundown parser profile",
    "POST /api/admin/parser-profiles/[id]/set-default": "Mark a parser profile as the default",
    "GET /api/parser-profiles": "Rundown parser profiles the Operator may choose from",
    # SPEC-46: configurable form layout and predefined fields.
    "GET /api/worship-form-layout": "The assembled Service form layout (groupings, slots, predefined fields)",
    "POST /api/admin/form-groupings": "Create or update a form grouping",
    "DELETE /api/admin/form-groupings/[id]": "Delete a form grouping",
    "PUT /api/admin/form-groupings/reorder": "Reorder form groupings",
    "POST /api/admin/form-grouping-slots": "Create a form grouping slot",
    "DELETE /api/admin/form-grouping-slots/[id]": "Delete a form grouping slot",
    "PUT /api/admin/form-grouping-slots/reorder": "Reorder form grouping slots within a grouping",
    "POST /api/admin/form-grouping-slots/[id]/move-grouping": "Move a form grouping slot to another grouping",
    "POST /api/admin/predefined-fields": "Create or update a predefined form field",
    "DELETE /api/admin/predefined-fields/[id]": "Delete a predefined form field",
    "POST /api/admin/predefined-fields/seed-defaults": "Seed the built-in predefined fields",
    "PUT /api/admin/song-set-entries/[variableName]/extraction-regex": "Set a Song Set entry's lyric-extraction regex",
    # SPEC-47: offline desktop app, fonts, media library, manual device sync.
    "GET /api/fonts": "List installed fonts",
    "GET /api/fonts/[id]": "One installed font file",
    "POST /api/admin/fonts": "Upload a font",
    "POST /api/admin/artifacts/fonts": "Upload a font for use in templates",
    "POST /api/admin/artifacts/import-pptx": "Import a .pptx as an authored template",
    "GET /api/admin/media-library": "List the media library",
    "POST /api/admin/media-library": "Add a media asset",
    "PATCH /api/admin/media-library/[id]": "Update a media asset",
    "POST /api/admin/media-library/[id]/replace": "Replace a media asset's file in place",
    "DELETE /api/admin/media-library/[id]": "Remove a media asset",
    "GET /api/media-library": "Media assets the Operator may choose from",
    "POST /api/admin/background-library/[id]/replace": "Replace a background image's file in place",
    "POST /api/sync/push": "Push local changes to a peer device (manual sync)",
    "GET /api/sync/pull": "Pull changes from a peer device (manual sync)",
    "GET /api/sync/status": "Current sync state for this device",
    "POST /api/sync/assets/check": "Check which asset hashes the peer already holds",
    "POST /api/sync/assets/upload": "Upload a content-addressed asset for sync",
    "GET /api/sync/assets/[sha256]": "Download a content-addressed synced asset",
}

DEFAULT_DB_HOLDS = {
    "services": "One dated Service and the week's payload",
    "hymns": "Song Book entries",
    "announcement_items": "Announcement list",
    "accounts": "Per-person accounts",
    "login_attempts": "Login trail",
    "revoked_sessions": "Revoked sessions",
    "settings": "Application settings",
    "bible_translations": "Translation corpora",
    "bible_books": "Book names per translation",
    "bible_verses": "Verse text",
    "artifact_templates": "Slide order and layout",
    "service_registry_snapshots": "Per-Service frozen registry clone (AD-16)",
    "announcement_sets": "Admin-authored Announcement Sets (DEC-004)",
    "announcement_set_slides": "Slides inside an Announcement Set",
    "background_library_images": "Admin-owned background image library (S10)",
    "song_books": "Song book registry rows (DEC-005 / AD-36)",
    "song_set_layouts": "Shared Title / Verse / Reff layout trio (S4)",
    "service_song_set_layouts": "Per-Service frozen copy of the shared trio (S13 R4)",
    "song_set_inputs": "Per-Service weekly song-set input: number, book, background, lyric override",
    "bible_book_names": "Book names per translation",
    # DEC-004 / AD-31: Admin-configurable list of song-set entries (Master Data).
    "song_set_entries": "Admin-configurable list of song-set entries (Master Data, DEC-004/AD-31)",
    # SPEC-44: configurable rundown parser profiles.
    "rundown_parser_profiles": "Configurable rundown parsing rule profiles (SPEC-44)",
    # SPEC-46: configurable form layout and predefined fields.
    "form_layouts": "Named Service form layouts (SPEC-46)",
    "form_groupings": "Groupings inside a form layout (SPEC-46)",
    "form_group_slots": "Slots inside a form grouping, each bound to one field widget (SPEC-46)",
    "predefined_fields": "Admin-defined Service form fields (SPEC-46)",
    "service_field_values": "Per-Service values entered for predefined fields (SPEC-46)",
    "service_form_layout_snapshots": "Per-Service frozen copy of the form layout (SPEC-46)",
}

# Table → PC: from `owns:` in components.yaml against the DDL names in db/index.ts.
# hymns is Hub's Song Book (FR-23/24, `/api/hymns`), not a Presenter corpus table.
TABLE_PC = {
    "services": "hub",
    "hymns": "hub",
    "announcement_items": "hub",
    "accounts": "hub",
    "login_attempts": "hub",
    "revoked_sessions": "hub",
    "settings": "hub",
    "bible_translations": "presenter",
    "bible_books": "presenter",
    "bible_verses": "presenter",
    "artifact_templates": "registry",
    "service_registry_snapshots": "registry",
    # DEC-004 moved announcement composition, the song-set list, the shared layout
    # trio and the background library into the Registry, so the Admin owns them.
    "announcement_sets": "registry",
    "announcement_set_slides": "registry",
    "background_library_images": "registry",
    "song_books": "registry",
    "song_set_layouts": "registry",
    # Per-Service frozen copy of the trio (S13 R4), parallel to
    # service_registry_snapshots and owned by the same component.
    "service_song_set_layouts": "registry",
    # The weekly values an Operator types for a Service: hymn number, book choice,
    # background, lyric override. That is Service data, so Hub owns it.
    "song_set_inputs": "hub",
    # Sits beside bible_books, per translation.
    "bible_book_names": "presenter",
    # UC-24: Admin adds/renames/removes a Song Set entry — Registry-owned like
    # song_set_layouts and the other DEC-004 Master Data tables.
    "song_set_entries": "registry",
    # SPEC-44/46 tickets are all component: hub — the Service creation form and
    # its rundown-parsing/layout configuration are Hub concerns.
    "rundown_parser_profiles": "hub",
    "form_layouts": "hub",
    "form_groupings": "hub",
    "form_group_slots": "hub",
    "predefined_fields": "hub",
    "service_field_values": "hub",
    "service_form_layout_snapshots": "hub",
}

# One-shot rebuild names in the same file: created, copied, dropped, renamed. Not live tables.
MIGRATE_ONLY = {
    "hymns_with_book_code": "hymns",
    "bible_verses_with_translation_code": "bible_verses",
}


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _posix(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _paren_body(text: str, open_idx: int) -> str | None:
    """Body inside the '(' at open_idx, or None if unbalanced."""
    depth = 0
    for i, ch in enumerate(text[open_idx:], start=open_idx):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return text[open_idx + 1 : i]
    return None


def _key_columns(body: str) -> str:
    keys: list[str] = []
    for m in re.finditer(
        r"^\s*(\w+)\s+[^,\n]+PRIMARY KEY\b", body, re.I | re.M
    ):
        keys.append(m.group(1))
    for m in re.finditer(r"PRIMARY KEY\s*\(([^)]+)\)", body, re.I):
        keys.append(", ".join(p.strip() for p in m.group(1).split(",")))
    for m in re.finditer(r"UNIQUE\s*\(([^)]+)\)", body, re.I):
        keys.append(", ".join(p.strip() for p in m.group(1).split(",")))
    # Preserve order, drop duplicates.
    seen: list[str] = []
    for k in keys:
        if k not in seen:
            seen.append(k)
    return ", ".join(seen) if seen else "—"


LIVE_TABLE_RE = re.compile(r"CREATE TABLE IF NOT EXISTS (\w+)\s*\(", re.I)
ANY_TABLE_RE = re.compile(r"CREATE TABLE (\w+)\s*\(", re.I)
ROW_RE = re.compile(r"^\|\s*\d+\s*\|(.*)\|\s*$")


def _recorded_cell_lists(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    out: list[list[str]] = []
    inside = False
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("## "):
            inside = line[3:].strip().lower().startswith("rows")
            continue
        if not inside:
            continue
        match = ROW_RE.match(line.strip())
        if match:
            out.append([c.strip() for c in match.group(1).split("|")])
    return out


def _recorded_cells(path: Path) -> dict[str, list[str]]:
    """Judgement columns keyed by the first cell (table name)."""
    return {cells[0].strip("`"): cells for cells in _recorded_cell_lists(path) if cells}


def derive_db(root: Path) -> "Derived":  # noqa: F821
    """Tables from the SQLite DDL in `src/lib/db/index.ts`."""
    source = root / "src" / "lib" / "db" / "index.ts"
    text = read(source)
    unread: list[str] = []
    if not text:
        return Derived(unread=[f"{_posix(root, source)} could not be read"])

    rel = _posix(root, source)
    live: dict[str, tuple[str, str]] = {}
    for m in LIVE_TABLE_RE.finditer(text):
        name = m.group(1)
        body = _paren_body(text, m.end() - 1)
        if body is None:
            unread.append(f"{rel}: unbalanced CREATE TABLE IF NOT EXISTS {name}")
            continue
        live[name] = (_key_columns(body), rel)

    for m in ANY_TABLE_RE.finditer(text):
        name = m.group(1)
        if name in live:
            continue
        dest = MIGRATE_ONLY.get(name)
        if dest:
            unread.append(
                f"{rel}: CREATE TABLE {name} is a one-shot rebuild, then RENAME TO {dest} "
                f"— not a live table"
            )
        else:
            unread.append(f"{rel}: CREATE TABLE {name} is not IF NOT EXISTS — unread")

    recorded = _recorded_cells(root / ".how" / "_platform" / "inventory-db.md")
    rows = []
    for name in sorted(live):
        keys, src = live[name]
        owner = TABLE_PC.get(name)
        if owner is None:
            unread.append(f"{rel}: table {name} has no owns: mapping — owner left `_platform`")
            owner = "_platform"
        prior = recorded.get(name) or []
        holds = prior[2] if len(prior) > 2 and prior[2] not in ("", "—") else "—"
        if holds == "—":
            holds = DEFAULT_DB_HOLDS.get(name, "—")
        rows.append(Row(
            key=name,
            cells=[name, owner, holds, keys, "published"],
            source=src,
        ))
    return Derived(rows=rows, unread=unread)


METHOD_RE = re.compile(
    r"^export async function (GET|POST|PUT|PATCH|DELETE)\b", re.M
)


# Endpoints whose resource the Registry owns. DEC-004 moved announcement
# composition, the song-set list, the shared layout trio and the background
# library there, so an `owner` of `hub` for these would put them in the wrong
# component's Failure Behaviour list at G4.
REGISTRY_API_PREFIXES = (
    "/api/admin/artifacts",
    "/api/admin/announcement-sets",
    "/api/admin/background-library",
    "/api/admin/song-books",
    "/api/admin/song-set-entries",
    "/api/admin/song-set-layouts",
    "/api/background-library",
    "/api/song-books",
    "/api/song-set-entries",
    # SPEC-47: fonts and the media library are Artifact Registry assets, like
    # backgrounds and templates. `/api/sync/assets*` is the content-addressed
    # asset side of manual sync (SPEC-47-06) — the mutation side
    # (/api/sync/push, /pull, /status) is Hub (SPEC-47-05) and MUST NOT match
    # this prefix, hence the narrower "/api/sync/assets" rather than "/api/sync".
    "/api/admin/fonts",
    "/api/fonts",
    "/api/admin/media-library",
    "/api/media-library",
    "/api/sync/assets",
)


# The owner column is DERIVED, never read back from the recorded row — unlike
# Description. So a hand-curated owner that disagrees with this function is
# silently overwritten on the next `inventory --write`. Fix the function, not
# the table. `/api/bible-translations` was lost that way once.
PRESENTER_API_PREFIXES = (
    "/api/scripture",
    "/api/bible-translations",
    # The remote relay (LC-17/LC-18, DEC-006/AD-37). Presenter-owned even though it
    # lives on `api`: a relay between two browsers cannot live in either browser.
    "/api/present",
)


def _api_owner(path: str) -> str:
    if path.startswith(REGISTRY_API_PREFIXES):
        return "registry"
    if path.startswith(PRESENTER_API_PREFIXES):
        return "presenter"
    # save-to-book writes hymns, which Hub owns, even though the Registry owns
    # the song-set entry the edit came from.
    return "hub"


def derive_api(root: Path) -> "Derived":  # noqa: F821
    """Endpoints from Go `mux.HandleFunc` in `internal/httpapi/server.go`."""
    unread: list[str] = []
    rows: list = []
    go_src = root / "internal" / "httpapi" / "server.go"
    go_text = read(go_src)
    if not go_text:
        return Derived(unread=["internal/httpapi/server.go could not be read"])

    by_endpoint: dict[str, str] = {}
    for cells in _recorded_cell_lists(root / ".how" / "_platform" / "inventory-api.md"):
        if len(cells) >= 5:
            by_endpoint[f"{cells[1]} {cells[2].strip('`')}"] = cells[4]

    rel = _posix(root, go_src)
    seen: set[str] = set()
    for m in GO_HANDLE_RE.finditer(go_text):
        method, raw_path = m.group(1), m.group(2)
        path = re.sub(r"\{(\w+)\}", r"[\1]", raw_path)
        key = f"{API_HOST} {method} {path}"
        if key in seen:
            continue
        desc = by_endpoint.get(f"{method} {path}", "—")
        if desc in ("", "—"):
            desc = DEFAULT_API_DESC.get(f"{method} {path}", "—")
        rows.append(Row(
            key=key,
            cells=[API_HOST, method, f"`{path}`", _api_owner(path), desc, "published"],
            source=rel,
        ))
        seen.add(key)

    rows.sort(key=lambda r: (r.cells[2], r.cells[1]))
    return Derived(rows=rows, unread=unread)


GO_HANDLE_RE = re.compile(
    r'mux\.HandleFunc\("(GET|POST|PUT|PATCH|DELETE) (/api/[^"]+)"'
)


SPA_ROUTE_RE = re.compile(
    r'<Route\s+path="([^"]+)"\s+element=\{<(\w+)'
)


def _spa_route(path: str) -> str:
    return path.replace("/:id", "/[id]")


def derive_screen(root: Path) -> "Derived":  # noqa: F821
    """Screens from React Router routes in `spa/src/App.tsx`."""
    app = root / "spa" / "src" / "App.tsx"
    unread: list[str] = []
    text = read(app)
    if not text:
        return Derived(unread=["spa/src/App.tsx could not be read"])

    inv = root / ".how" / "_platform" / "inventory-screen.md"
    state_of, _plat = decisions(inv)
    by_parent: dict[str, list[str]] = {}
    for state_route, parent in sorted(state_of.items()):
        by_parent.setdefault(parent, []).append(state_route)

    recorded_screen: dict[str, str] = {}
    recorded_uc: dict[str, str] = {}
    for cells in _recorded_cell_lists(inv):
        if len(cells) >= 5:
            route = cells[1].strip("`")
            recorded_screen[route] = cells[0]
            recorded_uc[route] = cells[4]

    rel = _posix(root, app)
    rows = []
    for m in SPA_ROUTE_RE.finditer(text):
        raw_path, component = m.group(1), m.group(2)
        if raw_path == "*":
            continue
        route = _spa_route(raw_path)
        states = ", ".join(f"`{s}`" for s in by_parent.get(route, [])) or "—"
        owner = _screen_owner(route)
        uc = recorded_uc.get(route) or DEFAULT_SCREEN_UC.get(route, "—")
        if uc in ("", "—"):
            uc = DEFAULT_SCREEN_UC.get(route, "—")
        elif route == "/services/[id]" and "UC-16" not in uc:
            uc = "UC-4, UC-5, UC-6, UC-7, UC-16, UC-18"
        name = recorded_screen.get(route) or f"{SPA_HOST}/{component}"
        rows.append(Row(
            key=f"{SPA_HOST}:{route}",
            cells=[name, f"`{route}`", states, owner, uc],
            source=rel,
        ))

    unread.append(
        "UC served is not declared in App.tsx — values are kept from this inventory file"
    )
    rows.sort(key=lambda r: r.cells[1])
    return Derived(rows=rows, unread=unread)


DEFAULT_SCREEN_UC = {
    "/login": "UC-9",
    "/": "UC-3",
    "/services/new": "UC-2",
    "/services/[id]": "UC-4, UC-5, UC-6, UC-7, UC-16, UC-18",
    "/announcements": "UC-21",
    "/admin": "UC-9, UC-19, UC-22",
    "/admin/artifacts": "UC-14, UC-15",
    "/services/[id]/slideshow": "UC-11",
    "/services/[id]/present": "UC-12, UC-13",
    "/services/[id]/present/projector": "UC-12",
    "/services/[id]/remote": "UC-29",
    # SPEC-26: canvas-vs-presenter visual parity diagnostic, Registry-owned like /admin/artifacts.
    "/services/diagnostic-parity": "UC-14",
    # SPEC-48: unified schedule workspace visual prototype, built toward the Hub run sheet.
    "/new": "UC-5",
    # SPEC-47-06: manual device sync has no use case of its own in the catalogue yet — see
    # the open question this inventory's Findings section files.
}


def _screen_owner(route: str) -> str:
    if route.startswith("/admin/artifacts") or route in ("/admin/sync", "/services/diagnostic-parity"):
        return "registry"
    # `/remote` is presenter-owned too (UC-29, DEC-006): it is the presenter view on a
    # second device. It does not contain "/present", so it fell to hub until 2026-08-22.
    if "/slideshow" in route or "/present" in route or route.endswith("/remote"):
        return "presenter"
    return "hub"

