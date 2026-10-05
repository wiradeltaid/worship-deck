---
status: Accepted
ratified_by: 5903b59
playbook:
  repo: wiradeltaid/ops
  path: research/wdi-ecosystem-strategy/coding-playbook/
  local: D:\Developer\wiradeltaid\ops\research\wdi-ecosystem-strategy\coding-playbook\
  rev: 5903b59
reads:
  - 01-principles.md
  - 02-architecture-and-structure.md
  - 03-essential-conventions.md
  - 04-file-size-and-cohesion.md
  - 05-realtime-and-sync-protocols.md
  - 06-tooling-and-ratchet.md
  - 07-ui-architecture-and-design-system.md
  - stack/go.md
  - stack/react-typescript.md
excludes:
  - stack/rust.md
  - stack/slint.md
  - stack/kotlin.md
  - stack/python.md
---

# stack — codebase guide

**Loaded when:** writing or reviewing code.

## 1. Toolchains & Runtimes

- **Core & Presenter Service:** Go 1.22 (`net/http` + SQLite / BoltDB).
- **Operator & Projection Surface:** React 19 / TypeScript 5 + Vite.
- **Pengecualian Eksternal:** Modul legacy PHP dikecualikan secara eksplisit dari cakupan playbook.

## 2. Command Verifikasi

```powershell
go test ./...
npm run build
npm run test
```
