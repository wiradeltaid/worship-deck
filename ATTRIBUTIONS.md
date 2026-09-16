# Attributions and third-party content

The MIT licence in [LICENSE](LICENSE) covers the code in this repository. It does
not cover the content below, which belongs to others.

## Seventh-day Adventist Hymnal

`data/song-book/sdah.json` contains the hymn texts of *The Seventh-day Adventist
Hymnal* (1985), indexed by its hymn numbering. The same statement is carried
inside the file itself, in its `book.attribution` and `book.licence` fields, so
it travels with the corpus rather than only with the repository.

**Copyright holder:** the General Conference of Seventh-day Adventists, and
Review and Herald Publishing Association. Individual hymn texts and tunes carry
their own authors, translators and copyright holders; many are in the public
domain, others are not.

**Why it is here.** This tool projects hymn lyrics during worship for
Seventh-day Adventist congregations. The corpus is included so that a
congregation can install the tool and use it, without each one having to
assemble the same texts by hand.

**How it is used.** Non-commercially, for worship and study within
congregations. Nothing in this project is sold, licensed for a fee, or
monetised in any form. The corpus is not offered as a hymnal, a substitute for
purchasing one, or a general-purpose lyrics database.

**No claim of ownership.** Including this corpus is not a claim of any right in
it. It remains the property of its copyright holders, and this notice is not a
licence — neither ours to give nor granted to us.

### Removal requests

If you hold rights in this material and want it removed or changed, please open
an issue at <https://github.com/wiradeltaid/worship-presenter-web/issues> or
contact the maintainer through the org at <https://github.com/wiradigitalid>.
Requests will be honoured promptly and without argument.

Anyone adapting this project for another tradition should add their own corpus
at `data/song-book/<book-code>.json` in the same shape, and set it as the
default song book. Hymns are keyed by `(book_code, number)`, so a second book
sits alongside this one rather than replacing it.

## King James Version

Scripture lookup uses the King James Version, which is in the public domain in
most jurisdictions. In the United Kingdom it remains under perpetual Crown
copyright, exercised under Letters Patent by Cambridge University Press and, in
Scotland, the Scottish Bible Board; reproduction there is permitted under the
patent holders' standing terms for non-commercial liturgical and devotional use,
which is this corpus's only use here.

The corpus **is** committed, at `data/en/bible-translation/kjv.json`, and reconciles into the
database on first boot. It carries its own licence and provenance in its
`translation` block. A clone therefore resolves a reference offline, with no
file handed to it and no third-party host in the boot path.

## Slide background images

The images under `public/assets/` were produced by the project's own team and
are covered by the repository's MIT licence.

## Dependencies

Every npm dependency carries its own licence. `npm ls --all` lists them, and
each package's licence text ships inside `node_modules`.

## Agent skills under `.claude/skills/`

Six skills are copied in from [mattpocock/skills](https://github.com/mattpocock/skills),
MIT licensed: `to-spec`, `to-tickets`, `implement`, `tdd`, `code-review`, and
`domain-modeling`. `skills-lock.json` at the repository root records the source
and a content hash for each. They are the engines WDI Method drives at G5, and
WDI Method requires them in the repository rather than as a user-level plugin —
`.control/wdi-method.yaml` carries that trace, and the reason is in the method's
own `why/README.md`.

**Three of them are modified here, in one line each.** `to-spec`, `to-tickets`
and `implement` ship with `disable-model-invocation: true`, which stops any
skill from invoking them; `wdi-method` removes that key from this repository's
copies so `wdi-build` can drive them, and writes a guard line in its place
naming which skills may. The bodies are the author's, untouched.

The `bmad-*` skills come from [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD)
and are installed by its own installer. Thirteen of them are marked
`disable-model-invocation: true` here because this method retires them at G5;
that is a one-line frontmatter change and their bodies are untouched too.
