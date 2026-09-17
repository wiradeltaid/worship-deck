# 03: Embedded TrueType font packaging in PPTX export

**What to build:** Embed TrueType font files for curated Google Fonts directly inside the exported `.pptx` archive, ensuring that presentations opened in Microsoft PowerPoint on any laptop preserve custom typography without font fallback drift.

**Blocked by:** 02 (Canvas Editor single DOM visual architecture)

**Status:** closed

- [x] Cache/bundle TrueType (`.ttf`) font files for non-system presentation fonts (e.g. Poppins, Montserrat, Inter) in the repository.
- [x] During PPTX post-processing in `pptx-draw.ts`, embed the font data files into the ZIP archive under `ppt/fonts/*.fntdata`.
- [x] Inject `<p:embeddedFontLst>` into `ppt/presentation.xml` and register the font parts in `ppt/_rels/presentation.xml.rels`.
- [x] Verify that exported presentations open cleanly in Microsoft PowerPoint Desktop with embedded fonts recognized.
