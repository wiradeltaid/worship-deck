# 02: The canvas editor stops flagging an Admin-created Predefined Field as "unknown"

**What to build:** With ticket 01 landed, an Admin-created Predefined Field can actually be saved on
a template — but the canvas editor's own warning still does not know about it, so an Admin placing
`{event_poster}` or any other admin-created key inside a text element sees a spurious "Unknown
predefined field token" warning every time, even though the save now succeeds and the deck renders
correctly (text-type tokens already generate correctly today; only the warning is wrong). This
ticket makes the editor's warning check aware of every Predefined Field Admin has created, so the
warning only ever fires for a genuinely unrecognised key — **and stays accurate as fields are added
and removed**, not just on first load.

`registerDynamicCatalogToken(s)` already exists in `src/lib/registry/placeholder-catalog.ts` but is
never called, and it is **one-way**: it can only add to the module-level `CATALOG_BY_KEY` map, with
no reset or unregister. Calling it once on load is not enough — a field deleted after the editor
opened would stay falsely "known" until a full page reload, and the reverse (a field created after
load) would stay falsely "unknown." This ticket's fix must rebuild the dynamic portion of the catalog
from the current fetched list each time it's refreshed, not only append to it once.

**Blocked by:** 01 (the field has to be acceptable to the server before it's worth telling the editor
about it).

**Status:** closed

- [x] Opening the canvas editor loads the current list of Admin-created Predefined Fields, and every
      one of them is treated as a known catalog key via `resetDynamicCatalogTokens`.
- [x] Placing `{<admin-created-key>}` inside a text element, or binding an image element's
      placeholder key to an admin-created field, shows no "unknown" warning.
- [x] Placing `{<a key nobody created>}` still shows the warning exactly as before.
- [x] Deleting a Predefined Field and then re-fetching/refreshing the editor's known-fields list
      (reopening the editor or on save) makes its key show the "unknown" warning again if still
      referenced on a template — tested in `tests/placeholder-catalog.test.mjs`.
- [x] The 17 built-in catalog keys are still recognised exactly as before; this ticket only adds
      admin-created keys to what the editor already treats as known.
