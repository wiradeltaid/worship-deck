# Customization and Slide Layouts: WorshipDeck

WorshipDeck starts with a clean slide registry ready for your congregation designs and liturgical structure.

---

## 1. Slide Layout Authoring

Sign in as an administrator and navigate to `/admin/artifacts` (the Registry Admin panel):

* **Visual Canvas Editor:** Author custom slide layouts directly in the browser canvas. Move, resize, and style text blocks, background elements, and liturgical headers with PowerPoint-faithful coordinate snapping.
* **Import from PowerPoint:** Import pre-existing presentation decks (`.pptx`) to extract slide geometries, color themes, and shape layouts automatically into the local SQLite registry.
* **Optional Sample Layouts:** For exploration or demonstration, an optional set of 38 sample slide layouts can be seeded into the local database by running `npm run seed:demo`.

---

## 2. Private Congregation Overrides

If you prefer to keep your church specific registry, custom hymns, or service configurations out of version control entirely:

1. Place your private registry file at `data/local/default-registry.json`.
2. When present, WorshipDeck automatically seeds from this file on boot instead of repository defaults.
3. The entire `data/local/` directory is git-ignored by design to prevent accidental commits of congregation records.
4. Review [`.constitution/project/private-data.md`](../.constitution/project/private-data.md) for strict data boundary policies.
