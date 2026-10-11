---
type: mandate
id: DEC-097
status: accepted
accepted_by: 'kodesh87 (2026-10-11)'
touches:
  - .control/memlog/autopilot-DEC-097.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-111-direct-local-media-playback-and-top-dock-ergonomics/
supersedes: null
superseded_by: null
created: '2026-10-11'
---

# DEC-097 — Daily Autopilot mandate for Direct Local Media Playback, Conscious Offline Downloader, and Two-Tab Media Library (SPEC-111)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-097:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review, and primary peer review: Terra (`terra-codex` via Codex CLI) with supplementary reviewers Sonnet (`sonnet` via Kiro Agent), DeepSeek Pro (`cbcn/deepseek-v4-pro` via CodeBuddy CN), and GLM-5.3 (`cbcn/glm-5.3` via CodeBuddy CN);
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra-Codex peer reviewer and supplementary panel;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-097.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-097`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-111: Direct Local Media Playback, Conscious Offline Downloader, and Two-Tab Media Library (`SPEC-111-01`..`SPEC-111-09`)
incorporating:
1) Two-tier media library (server SQLite catalog + local operator IndexedDB media-store);
2) Direct local playback via File System Access API (`window.showDirectoryPicker()`) with SHA-256 integrity and virtual streaming through service worker / blob URLs;
3) Conscious downloader with explicit progress and non-emoji badge states;
4) Top media control bar with fixed 44px height (zero layout shift) and spacebar focus safety;
5) Local-first playback routing and graceful cloud fallback;
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, local storage quota handling, and a 7-day expiry.
