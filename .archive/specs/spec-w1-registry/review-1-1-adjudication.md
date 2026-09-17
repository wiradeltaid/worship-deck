# Panel adjudication — Story 1-1

Cursor's Orca panel seat could not run (hook JSON). Claude's seat is `_bmad-output/specs/spec-w1-registry/review-1-1-claude.md`. Owner asked this session to continue on `main` without Orca.

| # | Finding | Disposition |
|---|---|---|
| 1 | Delete has no core-vs-extra guard | **Follow-up.** AC made deletion uniform. Residual: deleting `welcome`/`sermon` silently omits that slide. Recorded in `deferred-work.md`. No guard unless the owner asks. |
| 2 | `nextRegistryUpdatedAt` NaN | **Follow-up.** Not reachable on current writers. |
| 3 | Reorder 400 does not reload like 409 | **Follow-up.** |
| 4 | Client swap/delete body untested in ArtifactEditor | **Follow-up.** |
| 5 | Duplicate `Unknown template` message | **Follow-up.** Cosmetic. |
| 6 | Unused `ArtifactTemplateOrderItem` export | **Follow-up.** |

Zero must-fix returned to Step 2. Story status stays `done`.

Story 1-2 had no second-family panel: owner overrode isolation/Orca and asked this session to finish unattended on `main`.
