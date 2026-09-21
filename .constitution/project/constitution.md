---
status: Accepted
---

# Constitution — WorshipDeck

Everything in `.constitution/` that is method text arrives from the public WDI
Method package via `npx wdi-method install` / `update`. Articles 1, 2, and 5
below are this product's. Articles 3, 4, 6, and 7 are the method.

An agent working here MUST be able to act on the contents of this repo alone.

> **Articles 3, 4, 6, 7 were removed from this file on migration to the two-folder layout.**
> They are the method's and live in [`../method/constitution.md`](../method/constitution.md), which
> `update` replaces. Only Articles 1, 2, 5 are yours. The removed text is in git.

## Article 1 — Scope

This repo covers the product named at `product.name` in
`.control/registry/index.yaml`. One product, one repo. A second product MUST
get a repo of its own.

`product.client` in the same file names the client if there is one, and stays
empty if there is not. The product brief at G1 uses `product.name` as its
title. Neither this file nor the brief is a second source of the name.

An agent working here MUST NOT demand that sibling organisation repositories
be open in the same session.

## Article 2 — Content boundary, `.work/`, and cross-repo references

The general boundary is governed by [`../method/repo-guide.md`](../method/repo-guide.md). Its rules MUST NOT
be repeated here.

This repo is **public**. The extra boundary that follows from that is governed by
[`public-repository.md`](public-repository.md) and MUST NOT be relaxed by anything else
in this tree. Congregation identity, prayer requests, live payment details, member
photographs, source decks, and anything under `data/local/` MUST NOT enter git.

What else is particular to this repo:

- The legacy private repository `bic-pptx-workflow` is frozen. New work MUST happen here.
- `3p.md` MUST NOT be created here. Operational engagement memory lives outside.
- `.work/` is committed scratch, emptied when a task closes. It MUST NOT be imported by `src/`,
  MUST be excluded when searching for code, and MUST stay out of deploy payloads. Congregation data MUST NOT land there.
- `docs/` holds operator-facing material that predates the method. It is inventory to
  sort, not a second home for corpus or rules. Until a slot owns a file, it stays there
  or moves to `_bmad-output/prior-knowledge/` — it MUST NOT be copied into `.what/` or
  `.how/` by hand.

## Article 5 — The method arrives from WDI Method

`.constitution/method/` guides and templates, the `wdi-*` skills, and
`_bmad/custom/*.toml` arrive from the public WDI Method package via
`npx wdi-method install` / `update`. This file's Articles 1, 2, and 5,
`public-repository.md`, `codebase-*-guide.md` at every `status:`, and any extra file
this repo added in `.constitution/project/` do not — `update` never writes the
project room.

- A method file MUST NOT be invented or patched here to improve the method. If a rule is
  wrong, it is fixed in the WDI Method package, then brought here with `update`.
- `wdi-method update` MUST overwrite method files and MUST NOT touch `.what/`, `.how/`,
  `.control/` product state, this file's Articles 1–2 and 5, `public-repository.md`,
  `codebase-*-guide.md` at any `status:`, extra constitution files this repo added, or
  `_bmad/custom/*.user.toml`.
- A rule particular to this repo MUST be written out in full in this file or a sibling,
  and MUST NOT be replaced by a pointer into another repository.

A prefix in `.claude/skills/` names the **method**, not the owner: `bmad-*` is BMad's,
`wdi-*` is this method's.

