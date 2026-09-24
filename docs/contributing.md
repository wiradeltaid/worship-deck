# Developer and Contribution Guide: WorshipDeck

Thank you for your interest in contributing to WorshipDeck! We welcome community contributions, particularly from software engineers adapting WorshipDeck to diverse liturgical traditions and language translations.

---

## 1. Development Prerequisites

* **Go:** 1.24 or later
* **Node.js:** 22 or later (with `npm`)
* **Git:** Standard Git client
* **Inno Setup (Optional):** Version 6+ for compiling the Windows installer (`ISCC.exe`)

---

## 2. Setting Up the Local Workspace

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

* Backend API server: `http://localhost:3000`
* Frontend Vite SPA: `http://localhost:5173`

---

## 3. Strict Public Repository Privacy Guard

This repository is publicly hosted on GitHub. **Congregation private data must never enter Git history.** This includes:
* Real congregation member names, photographs, prayer requests, and contact details
* Bank account numbers and payment QR codes
* Exported presentation files (`*.pptx`, `*.potx`) and local database files (`data.db`, `.env`)

Automated tests strictly enforce this invariant. Before staging any commit, run:
```bash
node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs
```

---

## 4. Verification & Testing Suite

Before opening a pull request, ensure all test suites pass:

```bash
npm test                # Executes the complete Node test suite and public repo guard
npx tsc --noEmit        # TypeScript typecheck
npm run lint            # ESLint static analysis
npm run build:desktop   # Validates Go binary compilation and desktop bundle assembly
```

---

## 5. Architectural Conventions

* **Local-First Simplicity:** Prefer single Go binary + embedded SQLite (`modernc.org/sqlite`) without requiring external database servers (Postgres/MySQL) or Docker runtimes.
* **WYSIWYG Parity:** Any visual change made in the Canvas Editor must render identically on the Web Projector and in the exported PowerPoint (`.pptx`) deck.
* **Component Reuse:** Utilize existing Radix UI / Tailwind components rather than introducing heavy third-party UI libraries.
* **Commit Standard:** Follow Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
