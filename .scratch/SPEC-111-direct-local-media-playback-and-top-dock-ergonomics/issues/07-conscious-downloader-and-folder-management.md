# SPEC-111-07 — Conscious Downloader Engine, Folder Management, and Atomic Streams

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-06"]
**Status:** done

## Summary
Implement the conscious media downloader engine in `MediaDrawer.tsx`, supporting single and bulk download queues, directory handle persistence, atomic writable streams, and OPFS fallback.

## Key Responsibilities
1. **Directory Selection & Persistence**:
   - Prompt `window.showDirectoryPicker()` once on first download; persist `FileSystemDirectoryHandle` in IndexedDB.
   - Fall back to OPFS (`navigator.storage.getDirectory()`) with `navigator.storage.persist()` if directory picking is unavailable or denied.
2. **Download Queue Engine**:
   - Sequential download queue (concurrency 1) for single and "Unduh Semua" actions.
   - Preflight confirmation dialog for "Unduh Semua" displaying item count and total size in MB/GB.
   - Stream content directly to disk via `createWritable()`; compute SHA-256 incrementally during streaming.
   - If computed hash mismatches server `sha256`, call `abort()` to prevent saving corrupted files.
   - Register completed files in IndexedDB local registry and update matching map to `local`.
3. **Absence Guard**:
   - Zero auto-download: no background prefetching or automatic caching occurs without explicit operator click.
   - Unlinking/removing an item from `Media Laptop` tab removes the entry from the index only; never deletes physical files in directory picker mode.

## Acceptance Criteria
- Single item download and bulk "Unduh Semua" write verified files to the chosen local directory.
- Download errors or hash mismatches cleanly abort without writing partial files or corrupted records.
- Deleting a downloaded item from the local tab leaves the physical file intact on disk.

## Comments

- 2026-10-11: Implemented `ConsciousDownloaderEngine` with sequential queue (concurrency 1), bulk preflight calculations, atomic streaming write with sha256 verification and clean abort on mismatch, directory/OPFS storage ladder persistence, and verified physical file preservation on unlink in `tests/local-media-player.test.mjs`.
