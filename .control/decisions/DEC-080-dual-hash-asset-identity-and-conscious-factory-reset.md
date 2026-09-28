---
type: course-correction
id: DEC-080
status: accepted
accepted_by: "kodesh87 (2026-09-28)"
touches:
  - .how/_platform/ARCHITECTURE-SPINE.md
  - .how/registry/SDD-registry.md
  - .control/registry/decisions.yaml
supersedes: DEC-078
superseded_by: null
created: '2026-09-28'
---

# DEC-080 — Dual-Hash Asset Identity Protocol and Conscious Factory Reset Confirmation

## Decision

> **1. Dual-Mode Asset Identity Protocol**:
> WorshipDeck officially adopts a dual-mode asset identity model for cloud synchronization:
> - **Write-Path Modernization**: All newly uploaded files created via `internal/httpapi/uploads.go` (`writeUpload`)
>   are content-addressed using SHA-256 (`actualSha256 + ext`) with automatic deduplication.
> - **Discrete Identity Validation**: The sync protocol strictly accepts only two discrete identifier lengths:
>   exactly 32-hex characters (legacy random tokens) or exactly 64-hex characters (SHA-256 digests), enforced via
>   `^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$`. Ambiguous intermediate lengths (33..63 hex) are strictly rejected.
> - **Filename Stem & Traversal Safety**: The upload endpoint validates that the supplied filename is a pure basename
>   without directory traversal, that its stem matches the declared asset identifier, and that it preserves the original
>   extension rather than falling back to `.bin`. Exact basename lookup is enforced to eliminate ambiguous prefix matching.
> - **Integrity Verification**: Cryptographic SHA-256 validation applies to 64-hex assets; legacy 32-hex
>   assets are verified for non-empty buffer transfer and storage key parity.
> - **Outcome Fidelity**: A sync where any referenced asset fails to transfer must be flagged as degraded/incomplete
>   with retry capability, never reported as a completely successful sync while assets are missing.
>
> **2. Conscious Confirmation and Client Cache Purge for Factory Reset (Supersedes DEC-078)**:
> This decision supersedes `DEC-078`, refining the administrator factory reset operation:
> - **Conscious Confirmation & Mandatory Server Gate**: The destructive Factory Reset action in `AdminSyncPage.tsx` must be
>   gated by a conscious confirmation input requiring the operator to type `"factory reset"` (case-insensitive)
>   before the execution button is enabled. The server endpoint `POST /api/admin/reset-factory` **strictly requires**
>   a JSON body containing `{ "confirm": "factory reset" }`, returning HTTP 400 Bad Request if missing, malformed, or mismatched.
> - **Client-Side Cache Purge**: A successful factory reset must immediately execute `clearOfflineStorage()`
>   (purging `service_snapshots`, `media_cache`, and `emergency_outbox` in IndexedDB `worship_deck_offline_db`)
>   with fallback to `indexedDB.deleteDatabase()` before reloading the application window. If cache purge fails,
>   the UI must block and report remediation rather than reloading into a stale resurrected state.
> - **Correction of Stale Table Reference**: DEC-078's reference to `sync_device_mutations` is formally corrected
>   to `sync_state`.

## Why

During real-world cloud pull testing against `presenter-dev.bic.my.id`, zero media assets were downloaded
because existing server uploads were named using 32-hex random tokens while the sync protocol strictly
enforced 64-hex SHA-256 digests. This caused 404 errors, broken backgrounds, and `Degraded: 26 assets failed`
warnings. Establishing dual-mode asset identity resolves existing production assets while ensuring all future
uploads are strictly content-addressed. Additionally, requiring typed confirmation for factory reset prevents
catastrophic accidental database wipes, and purging IndexedDB guarantees clean client state post-reset.

## Cost, accepted

- Both 32-hex and 64-hex upload paths must be supported across sync endpoints and client extractors.
- Administrators must type `"factory reset"` to execute a factory reset.
