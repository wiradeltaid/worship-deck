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
congregations. WorshipDeck does not sell or license the software or its bundled
corpora for a fee. The corpus is not offered as a hymnal, a substitute for
purchasing one, or a general-purpose lyrics database.

**No claim of ownership.** Including this corpus is not a claim of any right in
it. It remains the property of its copyright holders, and this notice is not a
license, neither ours to give nor granted to us.

### Removal requests

If you hold rights in this material and want it removed or changed, please open
an issue at <https://github.com/wiradeltaid/worship-deck/issues> or
contact the maintainer through the org at <https://github.com/wiradeltaid>.
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

The application relies on open-source libraries for its frontend single-page application and backend Go server. All direct production dependencies use permissive open-source licences (MIT, BSD-3-Clause, Apache-2.0, ISC, and SIL Open Font License 1.1).

### Frontend & build runtime (npm)

| Package | Version | Licence | Purpose |
|---|---|---|---|
| `@base-ui/react` | ^1.6.0 | MIT | Unstyled UI primitives |
| `@fontsource/geist-mono` | ^5.3.0 | OFL-1.1 | Self-hosted monospace typeface |
| `@fontsource/geist-sans` | ^5.3.0 | OFL-1.1 | Self-hosted sans-serif typeface |
| `better-sqlite3` | ^12.11.1 | MIT | Node.js SQLite client for scripts and testing |
| `class-variance-authority` | ^0.7.1 | Apache-2.0 | Component variant styling |
| `clsx` | ^2.1.1 | MIT | Classname composition utility |
| `fabric` | ^6.6.1 | MIT | HTML5 canvas presentation and slide editing |
| `jszip` | ^3.10.1 | MIT | Archive generation for PPTX export |
| `lucide-react` | ^1.25.0 | ISC | Application iconography |
| `next-themes` | ^0.4.6 | MIT | Theme management (light/dark) |
| `pptxgenjs` | ^4.0.1 | MIT | PowerPoint presentation generation |
| `react` | 19.2.4 | MIT | UI framework |
| `react-dom` | 19.2.4 | MIT | React DOM renderer |
| `shadcn` | ^4.13.0 | MIT | UI component library CLI |
| `sonner` | ^2.0.7 | MIT | Toast notification system |
| `tailwind-merge` | ^3.6.0 | MIT | Tailwind utility merging |
| `tw-animate-css` | ^1.4.0 | MIT | UI animation utilities |

Transitive npm dependencies and full licence texts reside within `node_modules`. Run `npm ls --all` to list the full dependency tree.

### Backend server (Go)

| Module | Version | Licence | Purpose |
|---|---|---|---|
| `modernc.org/sqlite` | v1.34.5 | BSD-3-Clause | Pure-Go CGO-free SQLite database engine |
| `modernc.org/libc` | v1.55.3 | BSD-3-Clause | C runtime translation layer for SQLite |
| `modernc.org/mathutil` | v1.6.0 | BSD-3-Clause | Mathematical utilities for SQLite |
| `modernc.org/memory` | v1.8.0 | BSD-3-Clause | Memory management primitives |
| `github.com/dustin/go-humanize` | v1.0.1 | MIT | Data format humanization |
| `github.com/google/uuid` | v1.6.0 | BSD-3-Clause | Cryptographic UUID generation |
| `github.com/mattn/go-isatty` | v0.0.20 | MIT | Terminal TTY detection |
| `github.com/ncruces/go-strftime` | v0.1.9 | BSD-3-Clause | Date formatting utilities |
| `github.com/remyoudompheng/bigfft` | v0.0.0-20230129092748-24d4a6f8daec | BSD-3-Clause | FFT floating point primitives |
| `golang.org/x/crypto` | v0.31.0 | BSD-3-Clause | Cryptographic algorithms (scrypt) |
| `golang.org/x/sys` | v0.28.0 | BSD-3-Clause | OS-level syscall abstractions |

Transitive Go module licences can be verified via `go list -m -json all`.

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
