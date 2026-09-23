# Domain model — Hub

Conceptual. Database column types belong in `.how/`.

| Entity | Meaning | Relations |
| --- | --- | --- |
| Service | One dated worship gathering | 1 weekly payload, 0..1 Snapshot (owned by Registry), 0..N images; records which Rundown Parser Profile (and its version) parsed it, a historical fact, not a per-Service override |
| Account | Per-person account | Admin or Operator role |
| AppSetting | Application settings | transition, ui_locale, default corpus, default Song Book, Background Library default |
| Rundown | Text the Operator enters in Hub this phase; later Events may send it on Telegram | becomes Service payload |
| Hymn | One Song Book entry, identified by book + number | resolved into a Service song block (BR-3) |
| Song Set Weekly Input | One Song Set entry's weekly values for this Service — `<var>_song_number`, `<var>_song_book_name`, `<var>_song_background` | one per Song Set entry the Registry has configured (FR-32); the entry itself is Registry-owned |
| Lyric Override | This Service's edited lyric text for one Song Set entry | scoped to this Service only by default; an explicit save-back action writes it into the Song Book instead (FR-34, DEC-004) |
| Rundown Parser Profile | Admin-authored, named set of extraction rules the Rundown parser applies | exactly one is active at a time; a Rundown pasted while a profile is active is parsed under that profile's rules (FR-36) |
| Predefined Field | Admin-authored Service form field: a name, a shown label, and a type (text, text area, or image) | placed into 0..1 Form Grouping Slot at a time; DEC-058 makes explicit that its key is Admin-authored, not a code change |
| Form Layout | Admin-authored, named arrangement of Form Groupings that decides the Service form's shape | holds an ordered list of Form Groupings; the Service form renders whichever layout is active, falling back to the shipped default (FR-37) |
| Form Grouping | A named, ordered section of one Form Layout | belongs to exactly one Form Layout; holds an ordered list of Form Grouping Slots |
| Form Grouping Slot | One position inside a Form Grouping | bound to exactly one Predefined Field, Song Set entry, or announcement slot; the binding and its position are what the Service form actually renders |
| Service Field Value | This Service's entered value for one Predefined Field | one per `(Service, Predefined Field)` pair; scoped to this Service, the same as any other weekly value |
| Service Form Layout Snapshot | A frozen copy of the Form Layout taken for one Service | one per Service, taken in the same transaction as Service creation (`internal/httpapi/services.go:202`) — the same creation-is-the-freeze-event shape AD-16 already gives the Registry's own Snapshot |

**AnnouncementItem is retired from Hub (DEC-004).** Announcement composition moved entirely to the Registry's Announcement Set (`.what/registry/03-domain/domain-model.md`); Hub owns no announcement-list entity any more (FR-3 retired, superseded by FR-21).

The Operator form is one raw Rundown plus structured overlays. Physical field names: `.how/hub/05-model/form-fields.md`.
