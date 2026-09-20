---
type: mandate
id: DEC-053
status: accepted
accepted_by: 'kodesh87 (2026-09-20)'
touches:
  - .control/memlog/autopilot-DEC-053.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-52-unified-workspace-schedule-preset-rundown-slide0-architecture/SPEC.md
  - src/operator/workspace/
  - spa/src/
  - tests/smoke-spec-52.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-20'
---

# DEC-053 — Daily Autopilot mandate for Unified Workspace Schedule-Preset Rundown Slide0 Architecture (SPEC-52)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-053:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-053.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-053`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-52 Unified Workspace Schedule-Preset Rundown Slide0 Architecture) covering:
1) Top-left schedule navigation (`[Jadwal Baru]`, `[Muat Jadwal]`, `[Salin Preset]`, `[Simpan sebagai Preset Baru]` with automated Preset Sanitizer);
2) Pinned Slide 0 Rundown & Form Hub in Run Sheet timeline with raw WhatsApp rundown parsing, centralized weekly variable inputs, and layout editor hook;
3) Canvas-first freedom for Slide 1..N eliminating rigid title/subtitle inputs with direct typography/content editing and token insertion;
4) Master Song Sets & Announcements binding status (`[ 🔗 Terikat Master ]`) and explicit detachment (`[ 🔓 Detach dari Master ]`);
5) 100% operational parity with legacy presenter workflows (filmstrip overlay, quick blackout/clear/aspect tools, keyboard focus safety guard, remote control pairing, desktop offline sync) without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or cause regressions in presenter parity if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
