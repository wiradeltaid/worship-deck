---
type: contract
component: hub
lc: LC-20
direction: exposed
created: '2026-09-22'
updated: '2026-09-22'
---

# Contract — Form Layout

## Source of truth

`none`. `internal/httpapi/form_layout.go`.

## Purpose

UC-31. Admin configures the Service form's Predefined Fields and their grouping; FR-37. DEC-058
makes explicit that a Predefined Field's key is Admin-authored, not a code change.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/worship-form-layout` | The assembled layout (active Form Layout → its Form Groupings → their Form Grouping Slots) the Service form renders | UC-2, UC-31 |
| POST `/api/admin/form-groupings` | Create or update a Form Grouping | UC-31 |
| DELETE `/api/admin/form-groupings/[id]` | Delete a Form Grouping (cascades its slots) | UC-31 |
| PUT `/api/admin/form-groupings/reorder` | Reorder Form Groupings within a layout | UC-31 |
| POST `/api/admin/form-grouping-slots` | Create a slot inside a Form Grouping, bound to one Predefined Field, Song Set entry, or announcement slot | UC-31 |
| DELETE `/api/admin/form-grouping-slots/[id]` | Delete a slot | UC-31 |
| PUT `/api/admin/form-grouping-slots/reorder` | Reorder slots within a grouping | UC-31 |
| POST `/api/admin/form-grouping-slots/[id]/move-grouping` | Move a slot to a different grouping | UC-31 |
| POST `/api/admin/predefined-fields` | Create or update a Predefined Field (`text` / `text_area` / `image`) | UC-31 |
| DELETE `/api/admin/predefined-fields/[id]` | Delete a Predefined Field | UC-31 |
| POST `/api/admin/predefined-fields/seed-defaults` | Seed the built-in Predefined Fields | UC-31 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | `/api/admin/*` requires an Admin session (AD-5). `GET /api/worship-form-layout` requires any signed-in session — the Operator's Service form reads it. |
| Validation | A slot's `widget_kind` MUST be `predefined_field`, `song_set_entry`, or `announcement_slot`; `grouping_id` and `ref_key` are required. `UNIQUE(layout_id, widget_kind, ref_key)` — the same ref cannot occupy two slots in one layout; a second attempt is 409. A Predefined Field's `variable_name` MUST match `/^[a-z][a-z0-9_]{1,63}$/` and is unique; `field_type` MUST be `text`, `text_area`, or `image`. |
| Error handling | Envelope in `cross-cutting.md`. 404 unknown grouping/slot/field id. 400 invalid `widget_kind`, missing required field, or invalid `variable_name`. 409 duplicate slot ref or duplicate `variable_name`. 403 non-Admin on any `/api/admin/*` route. |
| Rate limiting | `none` — same posture as every other admin surface. |
| Idempotency | GET is safe. Reorder operations are full-replace of the ordering, not incremental — sending the same order twice is harmless. Deleting a grouping cascades its slots; deleting it twice → 404 the second time. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Unknown grouping/slot/field id | 404 | Refresh the layout |
| Invalid `widget_kind` | 400 | Use one of the three recognised kinds |
| Duplicate slot ref in the same layout | 409 | The ref is already placed; move or remove the existing slot first |
| Duplicate Predefined Field `variable_name` | 409 | Choose a different name |
| Invalid `variable_name` format | 400 | Lowercase, starts with a letter, alphanumeric/underscore, ≤64 chars |
| Non-Admin caller | 403 | Sign in as Admin |

## Compatibility

`GET /api/worship-form-layout`'s response shape is read by the Operator's Service form to render
itself dynamically — narrowing a field the form already reads is breaking. Deleting a Predefined
Field is a **soft delete** (`is_active = 0`, `deletePredefinedField`), not a row removal — the
`predefined_fields` row survives, so no `service_field_values` row is ever orphaned; a "deleted"
field's historical values on past Services remain exactly as entered, the same posture a retired
Song Set entry's weekly inputs already have.

## Constraints

A Form Grouping Slot is a **placement**, not the content itself — deleting a slot removes that
position from the form; it does not delete the Predefined Field, Song Set entry, or announcement
slot it referenced. Exactly one Form Layout is active at a time (mirrors Rundown Parser Profiles'
single-active shape, `09-rundown-parser-profiles.md`); the Service form always renders the active
layout, falling back to the shipped `default-layout` row if none is marked active
(`getWorshipFormLayout`, `WHERE is_active = 1 LIMIT 1` then a named-id fallback).
