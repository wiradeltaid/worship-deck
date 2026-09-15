import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import {
  FONT_CATALOG,
  getFontDefinition,
  resolveCatalogFontFamily,
} from '@/lib/registry/font-catalog';

/**
 * Reads TrueType font data (.ttf) from the local repository cache (data/fonts/)
 * or fetches on-demand from Google Fonts if online.
 */
export async function getFontData(fontFamily: string): Promise<Buffer | null> {
  const canonical = resolveCatalogFontFamily(fontFamily).trim();
  const fontFile = path.resolve('data/fonts', `${canonical}.ttf`);
  if (fs.existsSync(fontFile)) {
    try {
      return fs.readFileSync(fontFile);
    } catch {
      // Fall through to fetch
    }
  }

  const def = getFontDefinition(canonical);
  if (def?.googleFont && typeof fetch === 'function') {
    try {
      const gName = def.family;
      const res = await fetch(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(gName)}:wght@400&display=swap`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );
      if (res.ok) {
        const css = await res.text();
        const m = css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/);
        if (m && m[1]) {
          const fontRes = await fetch(m[1]);
          if (fontRes.ok) {
            const arrayBuf = await fontRes.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            fs.mkdirSync(path.dirname(fontFile), { recursive: true });
            fs.writeFileSync(fontFile, buf);
            return buf;
          }
        }
      }
    } catch {
      // Degrade gracefully if offline or fetch fails
    }
  }

  return null;
}

/**
 * SPEC-27-03: Embeds TrueType font data into the exported PPTX archive.
 * Packages non-system Google Fonts under ppt/fonts/*.fntdata, injects
 * <p:embeddedFontLst> into ppt/presentation.xml, registers font relationships
 * in ppt/_rels/presentation.xml.rels, and ensures [Content_Types].xml covers fntdata.
 */
export async function embedPresentationFonts(
  zip: JSZip,
  usedFontFamilies: Iterable<string>,
  fontManifest?: Array<{ family: string; weight?: string; style?: string; path: string }>
): Promise<string[]> {
  const embeddedFonts: string[] = [];
  const fontsToEmbed: { family: string; buffer: Buffer }[] = [];

  const manifestMap = new Map<string, string>();
  if (Array.isArray(fontManifest)) {
    for (const entry of fontManifest) {
      if (entry.family && entry.path) {
        manifestMap.set(entry.family.trim().toLowerCase(), entry.path);
      }
    }
  }

  const seen = new Set<string>();
  for (const raw of usedFontFamilies) {
    const family = resolveCatalogFontFamily(raw);
    if (seen.has(family)) continue;
    seen.add(family);

    // Check local font manifest first (AD-30 / SPEC-32-02: zero network calls)
    const localPath = manifestMap.get(family.trim().toLowerCase()) || manifestMap.get(raw.trim().toLowerCase());
    if (localPath && fs.existsSync(localPath)) {
      try {
        const buf = fs.readFileSync(localPath);
        fontsToEmbed.push({ family, buffer: buf });
        continue;
      } catch {}
    }

    const def = getFontDefinition(family);
    // Universal system fonts (Arial, Calibri, etc.) are already installed on all PowerPoint machines
    if (!def || def.pptxSafe) continue;

    const buf = await getFontData(family);
    if (buf) {
      fontsToEmbed.push({ family: def.family, buffer: buf });
    }
  }

  if (fontsToEmbed.length === 0) return [];

  // 1. Ensure [Content_Types].xml has fntdata extension registered
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    let ctXml = await contentTypesFile.async('string');
    if (!ctXml.includes('Extension="fntdata"')) {
      ctXml = ctXml.replace(
        '</Types>',
        '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>'
      );
      zip.file('[Content_Types].xml', ctXml);
    }
  }

  // 2. Read ppt/_rels/presentation.xml.rels to register font relationships
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!relsFile) return [];
  let relsXml = await relsFile.async('string');

  let maxId = 10;
  const matches = relsXml.matchAll(/Id="rId(\d+)"/g);
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    if (num > maxId) maxId = num;
  }

  const fontEntries: { family: string; rId: string; target: string }[] = [];

  for (let i = 0; i < fontsToEmbed.length; i++) {
    const { family, buffer } = fontsToEmbed[i];
    const rId = `rId${++maxId}`;
    const fontFileName = `font${i + 1}.fntdata`;
    const target = `fonts/${fontFileName}`;

    zip.file(`ppt/${target}`, buffer);

    const relTag = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/>`;
    relsXml = relsXml.replace('</Relationships>', `${relTag}</Relationships>`);

    fontEntries.push({ family, rId, target });
    embeddedFonts.push(family);
  }

  zip.file('ppt/_rels/presentation.xml.rels', relsXml);

  // 3. Inject <p:embeddedFontLst> into ppt/presentation.xml
  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    let presXml = await presFile.async('string');
    const embeddedFontTags = fontEntries
      .map(
        ({ family, rId }) =>
          `<p:embeddedFont><p:font typeface="${family}"/><p:regular r:id="${rId}"/></p:embeddedFont>`
      )
      .join('');
    const fontListXml = `<p:embeddedFontLst>${embeddedFontTags}</p:embeddedFontLst>`;

    if (presXml.includes('<p:embeddedFontLst>')) {
      presXml = presXml.replace('</p:embeddedFontLst>', `${embeddedFontTags}</p:embeddedFontLst>`);
    } else if (presXml.includes('</p:notesSz>')) {
      presXml = presXml.replace('</p:notesSz>', `</p:notesSz>${fontListXml}`);
    } else if (presXml.includes('<p:defaultTextStyle>')) {
      presXml = presXml.replace('<p:defaultTextStyle>', `${fontListXml}<p:defaultTextStyle>`);
    } else if (presXml.includes('</p:presentation>')) {
      presXml = presXml.replace('</p:presentation>', `${fontListXml}</p:presentation>`);
    }

    zip.file('ppt/presentation.xml', presXml);
  }

  return embeddedFonts;
}
