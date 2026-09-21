# Issue SPEC-54-01 — Form Layout SSOT, Dynamic Hydration on Service Edit, and Seeder Song Set Cleanup

**Status:** closed  
**Spec:** SPEC-54  
**Component:** hub  
**Satisfies:** [UC-2, UC-5, FR-11]  
**Blocked by:** []  
**Touches:** [services, artifacts]  

## Description

Establish `Artifacts -> Layout & Fields -> Card Groupings & Layout` as the authoritative Single Source of Truth (SSOT) for form layout configuration, eliminating duplicate in-place layout mutation controls on the weekly Service Edit page, defining snapshot-to-live layout compatibility with historical data preservation, and cleaning up seeder collisions.

## Key Changes

1. **Remove In-Place Layout Customization from `DynamicFormBody.tsx`:**
   - Remove the `Kelola Layout Visual` toggle button, `Seed Default Predefined Fields` button, and the `Tambah Kartu Form Baru` form from `src/operator/DynamicFormBody.tsx`.
   - Remove inline grouping deletion, slot moving, and in-place slot addition within `DynamicFormBody.tsx`.
   - Ensure `DynamicFormBody.tsx` focuses purely on rendering form fields, suggestions, and values for service data entry.

2. **Dynamic Layout Hydration with Historical Data Preservation in `EditForm.tsx`:**
   - In `src/operator/EditForm.tsx`, update `fetchLayout` so that active layout updates from `/api/worship-form-layout` refresh card groupings and slot order.
   - Compatibility & Zero Data Loss Guarantee:
     - If an existing service contains saved values in `service_field_values` for fields or slots that are no longer assigned in the active layout, those fields MUST NOT be silently discarded. They must be collected and rendered in a "Preserved Historical Fields" card at the bottom of the form.
     - Layout re-fetches must preserve an operator's active, unsaved form inputs.

3. **Seeder Song Set Cleanup & Idempotency in `internal/db/form_layout.go`:**
   - Clean up `defaultGroupings` in `SeedDefaultPredefinedFields`: remove obsolete hardcoded song set entries (`ds_opening_song`, `praise_song_1/2`, `ds_closing_song`) that conflict with user customization.
   - Guard against re-inserting deleted groupings or overriding custom user card orders.

## Verification, Tests & Absence Guard Proof

- **Absence Guard & Defect Injection Proof:**
  - Create absence assertion in `tests/smoke-spec-54.test.mjs` verifying `DynamicFormBody.tsx` does NOT contain:
    - `Kelola Layout Visual`
    - `Seed Default Predefined Fields`
    - `Tambah Kartu Form Baru`
    - `handleSeedDefaults`
  - Defect Injection Proof: Inject each forbidden variant into `DynamicFormBody.tsx`, observe test suite failure, revert, and confirm green.
- **Compatibility Test:**
  - Test loading a service containing saved field values for an unmapped field and verify the value is rendered and preserved upon saving.
- **Seeder Test:**
  - Run `internal/db/form_layout_test.go` ensuring seeder does not force obsolete song set slots into existing or fresh layouts.
