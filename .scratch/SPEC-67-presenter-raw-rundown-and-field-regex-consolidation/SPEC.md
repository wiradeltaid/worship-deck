# SPEC-67 — Presenter raw rundown display and dynamic field regex consolidation

## Problem Statement

WorshipDeck currently suffers from a dual-engine architecture mismatch between rundown intake and
presenter display:

1. **Fragile Line-by-Line Presenter Run-Sheet:**
   In Presenter mode (`/services/:id/present`), `PresenterOperator.tsx` expects an array of parsed
   item objects (`runSheetItems: ParsedItem[]`) derived from `data.parsed_data.items`. These items
   attempt to classify every line of a church bulletin into artificial categories (`section`, `role`,
   `hymn`). If a bulletin's line formatting varies even slightly, lines are discarded as "unmapped" and
   vanish from the presenter's sidebar. Presenters and operators lose crucial context, announcements, or
   pastoral notes that were present in the original schedule.

2. **Redundant Dual Parsing Engines & Unclear Extraction Boundary:**
   WorshipDeck maintains two overlapping parsing systems:
   - Macro document parsing (`rundown_parser_profiles` / `ParserProfile`) that attempts global
     document-level line splitting, section delimiters, and role classification.
   - Granular per-field regex extraction (`predefined_fields.extraction_regex` and
     `song_set_entries.extraction_regex`), which directly extracts values for each form field.
   Because the presenter view historically depended on the macro parser to generate `parsed.items`,
   custom liturgies risked losing visible schedule lines unless complex macro profiles were configured.

## Solution

1. **Presenter View Displays Raw Rundown Text Directly:**
   Update `PresentPage.tsx` and `PresenterOperator.tsx` so the Run-Sheet sidebar directly renders the
   original bulletin text (`raw_payload`) in a clean, scrollable, `whitespace-pre-wrap` view. The
   obsolete `runSheetItems` prop is removed entirely. The presenter sees the 100% faithful, un-mangled
   bulletin text exactly as provided by the service coordinator.

2. **Consolidate Form Intake onto Dynamic Predefined Field Regex:**
   Form field auto-population for custom and liturgical items is explicitly governed by Dynamic
   Predefined Field Regex (`predefined_fields.extraction_regex`) and Song Set Entry Regex
   (`song_set_entries.extraction_regex`). Form intake follows an explicit suggestion contract:
   regex extraction populates `fieldSuggestions` which the form hydrates into editable input fields for
   operator review before persisting to `service_field_values` on submission (operator edits are never
   silently overwritten).
   
3. **Explicit Scope Boundary on Macro Parsing:**
   Macro parsing (`ParserProfile`) is decoupled completely from Presenter display. It is retained
   solely as background infrastructure for date detection and legacy slide-plan generation, and is
   not required for custom field extraction or presenter schedule visibility.

## User Stories

1. As a presenter or operator in Presenter mode, I want to see the full, unedited rundown text in the
   Run-Sheet sidebar, so that no lines, notes, or cues are dropped or hidden due to parser mismatch.
2. As an administrator configuring service fields, I want each field's extraction to be defined via its
   own regex on the Predefined Field, so that I don't have to manage complex macro document parser profiles
   just to capture custom service elements.
3. As a service operator pasting a rundown into the Service form, I want clicking "Parse" to populate
   form fields via their configured field regexes as non-destructive suggestions, while preserving the
   original raw text for presenter display.

## Implementation Decisions

- In `spa/src/pages/PresentPage.tsx`: pass `rundownText={data.raw_payload || ''}` to `PresenterOperator`.
- In `src/operator/present/PresenterOperator.tsx`:
  - Remove `runSheetItems: ParsedItem[]` completely and add `rundownText?: string`.
  - In the Run-Sheet sidebar, render `rundownText` in a container with `whitespace-pre-wrap font-sans text-sm text-foreground/90`
    with `overflow-y-auto`.
  - When `rundownText` is empty or only whitespace, render a localized empty state via `t('presenter.noRundownText')`.
- In `internal/httpapi/services.go` and `internal/parse/parser.go`:
  - Retain `raw_payload` storage in `services` table.
  - Dynamic extraction executes `extractDynamicFieldSuggestions` (Predefined Fields) and
    `extractDynamicSongSetSuggestions` (Song Set Entries) against raw text, populating `fieldSuggestions`.
  - Client-side form (`CreateForm.tsx`, `EditForm.tsx`) hydrates suggestions into form fields, requiring
    operator submission to commit values to `service_field_values` (preventing silent overwrites).

## Testing Decisions

- Presenter unit tests in `tests/presenter-raw-rundown.test.mjs` asserting that:
  - Multi-line raw bulletin text with blank lines, indentation, and emoji renders with exact `textContent` equality.
  - Empty or whitespace-only rundown text displays the localized empty state `t('presenter.noRundownText')`.
  - Sidebar container retains `overflow-y-auto`.
- Intake API tests in `tests/dynamic-field-extraction.test.mjs` asserting that:
  - A text line that macro parser does NOT recognize, but a Predefined Field regex matches, successfully
    produces the expected `fieldSuggestions`.
  - Submitting the form persists the extracted field value into `service_field_values`.
  - `GET /api/services/{id}` returns the unaltered `raw_payload`.

## Out of Scope

- Removing existing database columns `rundown_parser_profiles` prematurely (schema cleanup belongs to
  a future deprecation wave).
- Altering the slide plan generation engine (`internal/plan/`) which operates on structured service items.
- Automatically overwriting saved field values on update without operator action.
