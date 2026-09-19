# 03: Dynamic Canvas Token Hydration in Go Slide Plan

**What to build:**
Update the Go slide plan engine (`internal/plan/hydrate.go` and `internal/plan/plan.go`) to hydrate canvas slide templates dynamically from `service_field_values` (and historical layout snapshots), allowing any `{variable_name}` defined in predefined fields to substitute into text and image elements without requiring hardcoded Go struct definitions, establishing a dynamic token resolver and preserving DEC-004 S5 error contracts and 100% parity for existing slide generation and PPTX export.

**Blocked by:** SPEC-46-02

**Status:** done

- [x] Refactor `catalogValues` / `computeCtx` in `internal/plan/plan.go` to load dynamic field key-value pairs from `service_field_values` into the `values map[string]interface{}` passed to `hydrateArtifact`.
- [x] Implement dynamic token resolution for canvas elements: text elements substitute `{variable_name}` inline, and image elements bind via `{variable_name}` into element `src` or matching `placeholderKey`.
- [x] Update artifact template validation in `internal/plan/validate_artifact.go` and `src/lib/registry/validate.ts` so that tokens matching registered `predefined_fields.variable_name` (or snapshot field definitions) are recognized as valid tokens.
- [x] Enforce DEC-004 S5 contract: unknown or unregistered tokens generate a validation warning on save in the artifact editor, but during live presentation hydration they render as an empty string without crashing or blocking slide generation.
- [x] Ensure historical services continue hydrating tokens correctly even if a predefined field is subsequently soft-deleted or archived in global settings.
- [x] Maintain specialized node generation for song sets (title, lyrics, background, and omitting empty slots per DEC-004) and announcement sets (inserting weekly poster slots 1..4 per SPEC-45).
- [x] Add Go tests in `internal/plan` verifying that custom token substitution works seamlessly for new fields and that existing services generate 100% identical normalized slide plans and PPTX open-xml structures.
