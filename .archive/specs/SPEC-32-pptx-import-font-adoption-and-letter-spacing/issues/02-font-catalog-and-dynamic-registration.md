# SPEC-32-02 — Durable Imported Font Faces

**Status:** open
**Blocked by:** SPEC-32-01

## What to build

Deliver usable embedded PPTX font faces through one durable API-to-SPA-to-worker slice:

1. Resolve only local presentation font relationships. Apply package limits, 16 MiB per face and 64 MiB cumulative accepted-font bytes; reject traversal, external, missing, duplicate/ambiguous, oversized, malformed, mismatched, and unsupported streams.
2. De-obfuscate Office font data only with an unambiguous standard key, then structurally validate TTF/OTF/WOFF/WOFF2. Store every regular/bold/italic/bold-italic face independently with family, weight, style, and immutable opaque asset id.
3. Promote assets and font records atomically with the imported templates. Serve them from a dedicated opaque font route with exact MIME type and `nosniff`, never from the image upload route.
4. Hydrate the persistent catalogue in the SPA with de-duplicated `FontFace` registration. Resolve selected local faces into an explicit font manifest for the database-free PPTX worker; it must embed only those validated local files and make no font-network request.

## Acceptance criteria

- A valid synthetic multi-face package survives import, page reload, second session, presenter rendering, and generated PPTX export with its exact face descriptors.
- Failed validation or promotion leaves no font record, template, or promoted font asset behind.
- The route rejects non-opaque ids and unsupported extensions, and the worker cannot fetch a font from the network.
- Tests cover relationship resolution, obfuscation rejection, structural validation, rollback, reload registration, face de-duplication, and plan-manifest handoff.
