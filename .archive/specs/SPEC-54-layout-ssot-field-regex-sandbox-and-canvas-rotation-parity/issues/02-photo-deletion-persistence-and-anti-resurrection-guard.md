# Issue SPEC-54-02 — Photo Deletion Persistence and Anti-Resurrection Guard

**Status:** closed  
**Spec:** SPEC-54  
**Component:** hub  
**Satisfies:** [UC-5, FR-11]  
**Blocked by:** [SPEC-54-01]  
**Touches:** [services, uploads]  

## Description

Fix weekly service image clearing and deletion persistence for `family_photo`, `youth_photo`, and `sermon_poster`, establishing per-key merge precedence so that clearing an image in the Service Edit form permanently persists and never resurrects upon page refresh, while gracefully preserving unrelated legacy fields.

## Key Changes

1. **Explicit Deletion State in `EditForm.tsx`:**
   - In `src/operator/EditForm.tsx`, update initial state hydration to check explicit `undefined` rather than falsiness:
     ```tsx
     if (initialFamilyPhotoUrl && base.family_photo === undefined) base.family_photo = initialFamilyPhotoUrl;
     if (initialYouthPhotoUrl && base.youth_photo === undefined) base.youth_photo = initialYouthPhotoUrl;
     if (initialSermonGraphicUrl && base.sermon_poster === undefined) base.sermon_poster = initialSermonGraphicUrl;
     ```
     Never use `!base.family_photo`, which treats empty string `""` as falsy and restores the old image URL.
   - When the user clicks "Hapus Gambar" in `ImageThreeColumnRenderer`, `handleFieldValueChange(varName, '')` sets `fieldValues[varName] = ''` and clears `familyPhotoUrl` / `youthPhotoUrl`.
   - On save (`handleSave`), ensure `field_values` explicitly sends `""` and image payload fields send `null`.

2. **Backend Per-Key Merge Precedence in `internal/httpapi/services.go`:**
   - In `fieldValuesFromBody`: preserve empty string `""` keys so `upsertFieldValues` updates `service_field_values` with `value_text = ''`.
   - In `mergeImagesPayload`: when `familyPhotoUrl`, `youthPhotoUrl`, or `sermonGraphicUrl` is cleared, set the corresponding key in `images_payload` to `nil` (null).
   - In `storedFieldValues`: implement per-key evaluation. If a key exists in `service_field_values` (even when `value_text == ""`), that row is authoritative for that specific key and MUST NOT fall back to `images_payload` or `parsed_data`. Keys that do NOT exist in `service_field_values` continue to fall back to legacy payloads.

## Verification & Tests

- **Mixed Legacy/Current State API Test:**
  - In `internal/httpapi/services_test.go` and Node HTTP smoke test:
    - Setup service with legacy `images_payload` (`familyPhotoUrl: "https://example.com/family.jpg"`, `sermonGraphicUrl: "https://example.com/sermon.jpg"`) and legacy `parsed_data` (`sermon.speaker: "Pastor John"`).
    - Send `PUT /api/services/:id` with `field_values: { family_photo: "" }`.
    - Query `GET /api/services/:id`: verify `field_values["family_photo"]` is `""`, `images_payload.familyPhotoUrl` is `null`, while `sermonGraphicUrl` and `sermon_speaker_name` are preserved from legacy payloads and NOT dropped.
- **Client Hydration Regression Test:**
  - Regression test verifying that clearing an image in `EditForm.tsx` sends explicit empty values and does not fall back to initial props after simulated refresh.
