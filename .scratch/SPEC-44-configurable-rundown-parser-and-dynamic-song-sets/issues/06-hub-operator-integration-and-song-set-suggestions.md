# 06: Hub Operator Integration and Song Set Suggestions

**What to build:**
Integrate configurable parsing and dynamic song set suggestions into `CreateForm.tsx` and `EditForm.tsx`, presenting parsed songs as non-destructive suggestions that operators can review and accept, accompanied by unmapped line diagnostics.

**Blocked by:** 05 (Admin UI: Parsing Profile Builder and Live Sandbox)

**Status:** ready-for-agent

- [ ] Extend `POST /api/services/preview` to accept optional `parserProfileId` and return `songSetSuggestions` alongside `fields` and `plan`.
- [ ] In `CreateForm.tsx` and `EditForm.tsx`, display an active parser profile indicator and allow selecting an alternate profile if multiple active profiles exist.
- [ ] Display parsed song matches in song set rows as "Suggested from Rundown" draft chips with an inline "Accept" action, and provide an "Accept All Suggestions" shortcut on the Parse action.
- [ ] Display prominent warning banners for unmapped lines or song overflow with copy/inspect capabilities so operators can easily correct omissions.
- [ ] End-to-end smoke tests in `tests/smoke-spec-44.test.mjs` verifying complete intake flow from rundown text to saved service with hydrated song sets and verified presentation slide plan.
