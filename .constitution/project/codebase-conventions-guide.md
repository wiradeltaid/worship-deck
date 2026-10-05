---
status: Accepted
ratified_by: 5903b59
---

# conventions — codebase guide

**Loaded when:** writing or reviewing code.

## WDI Engineering Playbook Integration

Proyek WorshipDeck ini mengadopsi Single Source of Truth (SSOT) rekayasa terpusat WDI:
- **Konvensi Inti (`03-essential-conventions.md`):** Tiga lapis penegakan `[L1-Tool]`, `[L2-Guard]`, `[L3-Review]`.
- **Backend & Jaringan Lokal (`stack/go.md` & `03`):**
  - Loopback binding eksklusif (`127.0.0.1`) pada listener presenter lokal (`[L2-Guard]`).
  - Dinamis port hunting tanpa kegagalan saat port terpakai.
  - Pembungkusan error kontekstual `%w` dan fail-closed boot configuration.
- **Frontend & Presentasi Realtime (`stack/react-typescript.md` & `05`):**
  - Heartbeat terikat dan tri-state liveness evaluation (`never-opened`, `live`, `lost`).
  - Safe object URL revocation pada media cache dan cleanup effect listeners.
