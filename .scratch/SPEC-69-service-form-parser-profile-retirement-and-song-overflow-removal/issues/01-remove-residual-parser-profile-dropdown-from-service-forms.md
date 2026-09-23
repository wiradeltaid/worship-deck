# 01: Remove residual parser profile dropdown from service forms

**What to build:** In `src/operator/CreateForm.tsx` and `src/operator/EditForm.tsx`, an obsolete "Parsing Profile:" selector dropdown and badges remain visible above the rundown textarea. With macro parser profiles retired from admin management (SPEC-68), operators no longer select or configure macro profiles during service creation. Remove the `parserProfiles` state, `selectedProfileId`, `GET /api/parser-profiles` fetch effect, and the UI selector from both forms. Remove `parserProfileId` from the parse and save payloads, ensuring the backend defaults cleanly to the system profile. Add an absence guard in smoke tests verified by defect injection.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/operator/CreateForm.tsx` and `src/operator/EditForm.tsx` in full first.
- [ ] In `src/operator/CreateForm.tsx`:
      (1) Remove `parserProfiles` state and `selectedProfileId` state.
      (2) Remove the `fetch('/api/parser-profiles')` call and related state updates.
      (3) Remove the "Parsing Profile:" label, dropdown `<Select>`, and `<Badge>` elements above the rundown textarea.
      (4) Remove `parserProfileId` from the payload sent in `handleParse` (`POST /api/services/parse`) and `handleSave` (`POST /api/services`).
- [ ] In `src/operator/EditForm.tsx`:
      (1) Remove `parserProfiles` state and `selectedProfileId` state.
      (2) Remove the `fetch('/api/parser-profiles')` call and related state updates.
      (3) Remove the "Parsing Profile:" label, dropdown `<Select>`, and `<Badge>` elements above the rundown textarea.
      (4) Remove `parserProfileId` from the payload sent in `handleParse` (`POST /api/services/parse`) and `handleSave` (`PUT /api/services/{id}`).
- [ ] In `internal/httpapi/services.go`:
      (1) Ensure `parseRundownHandler`, `createServiceHandler`, and `updateServiceHandler` gracefully handle missing/null `parserProfileId`, resolving the default profile via `parse.LoadDefaultParserProfile(s.DB)`.
      (2) Add executable Go HTTP API test cases in `internal/httpapi/services_test.go` or `services_field_values_test.go` testing parse, create, and update endpoints with both omitted and explicit `null` `parserProfileId`.
- [ ] Add an executable absence guard in smoke tests:
      (1) Assert `CreateForm.tsx` and `EditForm.tsx` do NOT include `selectedProfileId` or `form.parser.profile`.
      (2) Prove the absence guard by defect injection: temporarily re-introduce the reference, verify the test goes RED, then revert to GREEN.
- [ ] Verify both Create and Edit forms render cleanly and parse requests succeed without error.
