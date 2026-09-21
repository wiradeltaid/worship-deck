# 02: Bundled Portable Node.js and PPTX Worker Isolation

**What to build:**
Enable PPTX export to execute reliably offline on target machines that do not have Node.js installed globally:
1. Update `internal/pptx/worker.go` to resolve `NODE_BIN` using an absolute path hierarchy:
   - Priority 1: Explicit `NODE_BIN` environment variable.
   - Priority 2: Relative to executable: `filepath.Join(root, "runtime", "node.exe")`.
   - Priority 3: Fall back to system `node` on `PATH` (development mode).
2. Ensure worker process execution uses absolute directory roots (`root`) so `./workers/pptx/register.mjs` and `./workers/pptx/draw.mjs` resolve reliably regardless of current working directory.
3. Provide a standalone packaging script/task that stages the pinned Windows x64 portable Node.js binary and production `node_modules` into `{app}/runtime/`.
4. Validate that PPTX export succeeds with empty/unconfigured global `PATH`.

**Blocked by:** 01-desktop-launcher-mutex-and-data-dir-resolution.md

**Status:** closed

- [x] Update `internal/pptx/worker.go` to locate `{root}/runtime/node.exe` before falling back to system `PATH`.
- [x] Add defensive error logging and timeout reporting if the bundled Node binary is missing or times out.
- [x] Ensure `workers/pptx` loads only read-only code and never evaluates user-uploaded scripts from `uploads/`.
- [x] Add unit test in `internal/pptx/worker_test.go` verifying that explicit custom `NODE_BIN` paths are correctly honored.
- [x] Human verification check: Run a PPTX export test with `PATH` cleared of Node.js, proving that PPTX files render successfully using the bundled runtime.
