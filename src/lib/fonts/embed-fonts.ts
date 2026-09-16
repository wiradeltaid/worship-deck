import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import {
  FONT_CATALOG,
  getFontDefinition,
  resolveCatalogFontFamily,
  resolveFontVariantKey,
  type FontVariant,
} from '@/lib/registry/font-catalog';

export interface FontUsageItem {
  family: string;
  weight?: string;
  style?: string;
}

export interface FontManifestItem {
  id?: string;
  family: string;
  sourceTypeface?: string;
  weight?: string;
  style?: string;
  format?: string;
  path: string;
  restricted?: boolean;
}

/**
 * Derives the 16-byte font obfuscation key from a GUID string
 * according to ECMA-376 Part 2 §8.5.2 / ISO/IEC 29500-2.
 * The GUID string is formatted as {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}.
 * Bytes are reversed within each of the first three components.
 */
export function deriveObfuscationKey(guidStr: string): Buffer | null {
  const match = guidStr.match(/\{?([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})\}?/);
  if (!match) return null;

  const p1 = Buffer.from(match[1], 'hex');
  const p2 = Buffer.from(match[2], 'hex');
  const p3 = Buffer.from(match[3], 'hex');
  const p4 = Buffer.from(match[4], 'hex');
  const p5 = Buffer.from(match[5], 'hex');

  if (p1.length !== 4 || p2.length !== 2 || p3.length !== 2 || p4.length !== 2 || p5.length !== 6) {
    return null;
  }

  const key = Buffer.alloc(16);
  // First 4 bytes reversed
  key[0] = p1[3];
  key[1] = p1[2];
  key[2] = p1[1];
  key[3] = p1[0];

  // Next 2 bytes reversed
  key[4] = p2[1];
  key[5] = p2[0];

  // Next 2 bytes reversed
  key[6] = p3[1];
  key[7] = p3[0];

  // Remaining 8 bytes as-is
  key[8] = p4[0];
  key[9] = p4[1];
  p5.copy(key, 10);

  return key;
}

/**
 * Obfuscates a font binary according to ECMA-376 Part 2 §8.5.2:
 * XOR the first 32 bytes with the 16-byte key (repeated twice).
 * Preserves the original font buffer immutably.
 */
export function obfuscateFont(fontBuffer: Buffer, key: Buffer): Buffer {
  const result = Buffer.from(fontBuffer);
  const limit = Math.min(32, result.length);
  for (let i = 0; i < limit; i++) {
    result[i] ^= key[i % 16];
  }
  return result;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Reads TrueType font data (.ttf) from the local repository cache (data/fonts/)
 * or fetches on-demand from Google Fonts if online.
 */
export async function getFontData(
  fontFamily: string,
  weight: string = 'normal',
  style: string = 'normal'
): Promise<Buffer | null> {
  const canonical = resolveCatalogFontFamily(fontFamily).trim();
  const v = resolveFontVariantKey(weight, style);
  const cacheKey = `${canonical}-${v}`;
  const fontFile = path.resolve('data/fonts', `${cacheKey}.ttf`);
  const legacyFontFile = path.resolve('data/fonts', `${canonical}.ttf`);

  if (fs.existsSync(fontFile)) {
    try {
      return fs.readFileSync(fontFile);
    } catch {}
  }
  if (fs.existsSync(legacyFontFile)) {
    try {
      return fs.readFileSync(legacyFontFile);
    } catch {}
  }

  const def = getFontDefinition(canonical);
  if (def?.googleFont && typeof fetch === 'function') {
    try {
      const gName = def.family;
      const wght = v === 'bold' || v === 'boldItalic' ? '700' : '400';
      const ital = v === 'italic' || v === 'boldItalic' ? '1' : '0';
      const res = await fetch(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(gName)}:ital,wght@${ital},${wght}&display=swap`,
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

interface ResolvedFaceToEmbed {
  family: string;
  slot: FontVariant;
  buffer: Buffer;
}

/**
 * SPEC-36-03: ECMA-376 Standard PPTX Font Obfuscation and Variant Slot Embedding.
 * Packages fonts under ppt/fonts/{GUID}.odttf with 16-byte key XOR obfuscation,
 * registers application/vnd.openxmlformats-officedocument.obfuscatedFont in [Content_Types].xml,
 * and maps variant slots (<p:regular>, <p:bold>, <p:italic>, <p:boldItalic>) in <p:embeddedFontLst>.
 */
export async function embedPresentationFonts(
  zip: JSZip,
  usedFontFamilies: Iterable<string | FontUsageItem>,
  fontManifest?: FontManifestItem[]
): Promise<string[]> {
  const embeddedFamilies = new Set<string>();

  // Normalize font usage into canonical triples
  const usageMap = new Map<string, { family: string; weight: string; style: string }>();
  for (const item of usedFontFamilies) {
    const rawFam = typeof item === 'string' ? item : item.family;
    if (!rawFam) continue;
    const family = resolveCatalogFontFamily(rawFam);
    const weight = typeof item === 'object' && item.weight ? item.weight : 'normal';
    const style = typeof item === 'object' && item.style ? item.style : 'normal';
    const key = `${family.toLowerCase()}::${weight.toLowerCase()}::${style.toLowerCase()}`;
    if (!usageMap.has(key)) {
      usageMap.set(key, { family, weight, style });
    }
  }

  const facesToEmbed: ResolvedFaceToEmbed[] = [];

  for (const usage of usageMap.values()) {
    const family = usage.family;
    const slot = resolveFontVariantKey(usage.weight, usage.style);

    // 1. Check local font manifest first (AD-30 / SPEC-32-02 / SPEC-36-02 / SPEC-37-03)
    let manifestMatch: FontManifestItem | undefined;
    let isFamilyRestricted = false;
    if (Array.isArray(fontManifest)) {
      const famLower = family.trim().toLowerCase();
      // Step A: Attempt exact variant slot match
      manifestMatch = fontManifest.find(
        (m) =>
          !m.restricted &&
          (m.family.trim().toLowerCase() === famLower ||
            (m.sourceTypeface && m.sourceTypeface.trim().toLowerCase() === famLower)) &&
          resolveFontVariantKey(m.weight, m.style) === slot
      );

      // Step B: License-aware fallback selection if exact variant slot face does not exist
      if (!manifestMatch) {
        // Collect all candidate faces belonging to this family
        const candidates = fontManifest.filter(
          (m) =>
            m.family.trim().toLowerCase() === famLower ||
            (m.sourceTypeface && m.sourceTypeface.trim().toLowerCase() === famLower)
        );

        if (candidates.length > 0) {
          // If all candidate faces are restricted, do not embed and skip (never fall back to catalog)
          const allRestricted = candidates.every((m) => m.restricted);
          if (allRestricted) {
            isFamilyRestricted = true;
          } else {
            // Prefer regular face among unrestricted candidates
            manifestMatch =
              candidates.find((m) => !m.restricted && resolveFontVariantKey(m.weight, m.style) === 'regular') ||
              candidates.find((m) => !m.restricted);
          }
        }
      }
    }

    if (isFamilyRestricted) {
      console.warn(`[embed-fonts] Font family '${family}' has embedding restricted by license; skipping embedding.`);
      continue;
    }

    if (manifestMatch) {
      // Respect OS/2 fsType embedding restrictions
      if (manifestMatch.restricted) {
        continue;
      }
      if (manifestMatch.path && fs.existsSync(manifestMatch.path)) {
        try {
          const buf = fs.readFileSync(manifestMatch.path);
          const faceKey = `${family.toLowerCase()}::${slot}`;
          if (!facesToEmbed.some((f) => `${f.family.toLowerCase()}::${f.slot}` === faceKey)) {
            facesToEmbed.push({ family, slot, buffer: buf });
            embeddedFamilies.add(family);
          }
          continue;
        } catch {}
      }
    }

    // 2. Check catalog font definition
    const def = getFontDefinition(family);
    if (!def || def.category === 'system' || def.embeddable === false) {
      continue;
    }

    const buf = await getFontData(family, usage.weight, usage.style);
    if (buf) {
      facesToEmbed.push({ family: def.family, slot, buffer: buf });
      embeddedFamilies.add(def.family);
    }
  }

  if (facesToEmbed.length === 0) return [];

  // 1. Ensure [Content_Types].xml declares ECMA-376 obfuscatedFont MIME type for odttf
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    let ctXml = await contentTypesFile.async('string');
    if (!ctXml.includes('Extension="odttf"')) {
      ctXml = ctXml.replace(
        '</Types>',
        '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/></Types>'
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

  // Group embedded faces by family
  const familySlotMap = new Map<
    string,
    {
      regular?: string;
      bold?: string;
      italic?: string;
      boldItalic?: string;
    }
  >();

  for (const face of facesToEmbed) {
    const rId = `rId${++maxId}`;
    const rawUuid = crypto.randomUUID().toUpperCase();
    const fontFileName = `${rawUuid}.odttf`;
    const target = `fonts/${fontFileName}`;

    const key = deriveObfuscationKey(rawUuid);
    if (!key) {
      continue;
    }

    const obfuscated = obfuscateFont(face.buffer, key);
    zip.file(`ppt/${target}`, obfuscated);

    const relTag = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/>`;
    relsXml = relsXml.replace('</Relationships>', `${relTag}</Relationships>`);

    let familyGroup = familySlotMap.get(face.family);
    if (!familyGroup) {
      familyGroup = {};
      familySlotMap.set(face.family, familyGroup);
    }
    familyGroup[face.slot] = rId;
  }

  zip.file('ppt/_rels/presentation.xml.rels', relsXml);

  // 3. Inject <p:embeddedFontLst> into ppt/presentation.xml with variant slots
  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    let presXml = await presFile.async('string');

    // Merge with any existing <p:embeddedFontLst>
    const familyBlocksMap = new Map<string, string>();
    const existingListMatch = presXml.match(/<p:embeddedFontLst>([\s\S]*?)<\/p:embeddedFontLst>/);
    if (existingListMatch) {
      const existingBlocks = existingListMatch[1].match(/<p:embeddedFont>[\s\S]*?<\/p:embeddedFont>/g) || [];
      for (const block of existingBlocks) {
        const tfMatch = block.match(/typeface="([^"]+)"/);
        if (tfMatch) {
          familyBlocksMap.set(tfMatch[1].toLowerCase(), block);
        }
      }
    }

    for (const [family, slots] of familySlotMap.entries()) {
      let slotTags = '';
      if (slots.regular) slotTags += `<p:regular r:id="${slots.regular}"/>`;
      if (slots.bold) slotTags += `<p:bold r:id="${slots.bold}"/>`;
      if (slots.italic) slotTags += `<p:italic r:id="${slots.italic}"/>`;
      if (slots.boldItalic) slotTags += `<p:boldItalic r:id="${slots.boldItalic}"/>`;
      familyBlocksMap.set(
        family.toLowerCase(),
        `<p:embeddedFont><p:font typeface="${escapeXml(family)}"/>${slotTags}</p:embeddedFont>`
      );
    }

    const fontListXml = `<p:embeddedFontLst>${Array.from(familyBlocksMap.values()).join('')}</p:embeddedFontLst>`;

    if (presXml.includes('<p:embeddedFontLst>')) {
      presXml = presXml.replace(/<p:embeddedFontLst>[\s\S]*?<\/p:embeddedFontLst>/, fontListXml);
    } else {
      const notesSzMatch = presXml.match(/(<p:notesSz[^>]*\/>|<\/p:notesSz>)/);
      const defaultTextStyleMatch = presXml.match(/(<p:defaultTextStyle[^>]*>|<p:defaultTextStyle\/>)/);
      if (notesSzMatch && notesSzMatch.index !== undefined) {
        const insertIdx = notesSzMatch.index + notesSzMatch[0].length;
        presXml = presXml.slice(0, insertIdx) + fontListXml + presXml.slice(insertIdx);
      } else if (defaultTextStyleMatch && defaultTextStyleMatch.index !== undefined) {
        const insertIdx = defaultTextStyleMatch.index;
        presXml = presXml.slice(0, insertIdx) + fontListXml + presXml.slice(insertIdx);
      } else if (presXml.includes('</p:presentation>')) {
        presXml = presXml.replace('</p:presentation>', `${fontListXml}</p:presentation>`);
      }
    }

    zip.file('ppt/presentation.xml', presXml);
  }

  return Array.from(embeddedFamilies);
}
