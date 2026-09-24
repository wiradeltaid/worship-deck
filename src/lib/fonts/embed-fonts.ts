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
  if (def?.embeddable && typeof fetch === 'function') {
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
  sourceTypeface?: string;
}

/**
 * Builds an uncompressed Embedded OpenType (EOT v2.2) binary (.fntdata)
 * from a TrueType/OpenType font buffer according to Microsoft OpenType / EOT specification.
 * Required for native Microsoft PowerPoint Desktop font embedding and DirectWrite rendering.
 */
export function buildEot(
  fontBuffer: Buffer,
  familyName: string = 'Unknown',
  styleName: string = 'Regular'
): Buffer {
  let usWeightClass = 400;
  let fsType = 0;
  let panose = Buffer.alloc(10);
  let italic = 0;
  let urange1 = 0, urange2 = 0, urange3 = 0, urange4 = 0;
  let cprange1 = 0, cprange2 = 0;
  let chksum = 0;
  let family = familyName;
  let style = styleName;
  let ver = '1.000';
  let full = `${family} ${style}`;

  // Attempt to parse TTF tables if valid SFNT
  if (fontBuffer && fontBuffer.length >= 12) {
    const numTables = fontBuffer.readUInt16BE(4);
    if (12 + numTables * 16 <= fontBuffer.length) {
      const tables: Record<string, { offset: number; length: number }> = {};
      for (let i = 0; i < numTables; i++) {
        const off = 12 + i * 16;
        const tag = fontBuffer.toString('latin1', off, off + 4);
        const toff = fontBuffer.readUInt32BE(off + 8);
        const tlen = fontBuffer.readUInt32BE(off + 12);
        tables[tag] = { offset: toff, length: tlen };
      }

      if (tables['OS/2'] && tables['OS/2'].offset + 86 <= fontBuffer.length) {
        const os2 = tables['OS/2'].offset;
        usWeightClass = fontBuffer.readUInt16BE(os2 + 4);
        fsType = fontBuffer.readUInt16BE(os2 + 8);
        panose = Buffer.from(fontBuffer.subarray(os2 + 32, os2 + 42));
        urange1 = fontBuffer.readUInt32BE(os2 + 42);
        urange2 = fontBuffer.readUInt32BE(os2 + 46);
        urange3 = fontBuffer.readUInt32BE(os2 + 50);
        urange4 = fontBuffer.readUInt32BE(os2 + 54);
        const fsSel = fontBuffer.readUInt16BE(os2 + 62);
        italic = (fsSel & 1) ? 1 : 0;
        cprange1 = fontBuffer.readUInt32BE(os2 + 78);
        cprange2 = fontBuffer.readUInt32BE(os2 + 82);
      }

      if (tables['head'] && tables['head'].offset + 12 <= fontBuffer.length) {
        const head = tables['head'].offset;
        chksum = fontBuffer.readUInt32BE(head + 8);
      }

      if (tables['name'] && tables['name'].offset + 6 <= fontBuffer.length) {
        const noff = tables['name'].offset;
        const nCount = fontBuffer.readUInt16BE(noff + 2);
        const sOff = fontBuffer.readUInt16BE(noff + 4);
        const names: Record<number, string> = {};
        for (let i = 0; i < nCount; i++) {
          const roff = noff + 6 + i * 12;
          if (roff + 12 <= fontBuffer.length) {
            const plat = fontBuffer.readUInt16BE(roff);
            const enc = fontBuffer.readUInt16BE(roff + 2);
            const lang = fontBuffer.readUInt16BE(roff + 4);
            const nid = fontBuffer.readUInt16BE(roff + 6);
            const slen = fontBuffer.readUInt16BE(roff + 8);
            const soff = fontBuffer.readUInt16BE(roff + 10);
            if (plat === 3 && enc === 1 && lang === 1033) {
              const strStart = noff + sOff + soff;
              if (strStart + slen <= fontBuffer.length) {
                const sBytes = Buffer.from(fontBuffer.subarray(strStart, strStart + slen));
                sBytes.swap16();
                names[nid] = sBytes.toString('utf16le');
              }
            }
          }
        }
        if (names[1] || names[16]) family = names[1] || names[16];
        if (names[2] || names[17]) style = names[2] || names[17];
        if (names[5]) ver = names[5];
        if (names[4]) full = names[4];
        else full = `${family} ${style}`;
      }
    }
  }

  function makeStrField(s: string): Buffer {
    const raw = Buffer.from(s, 'utf16le');
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16LE(raw.length, 0);
    const nullPad = Buffer.from([0, 0]);
    return Buffer.concat([lenBuf, raw, nullPad]);
  }

  const strData = Buffer.concat([
    makeStrField(family),
    makeStrField(style),
    makeStrField(ver),
    makeStrField(full),
    // Trailing 24 bytes
    Buffer.from([0, 0]), // RootStringSize = 0
    Buffer.from([0x42, 0x53, 0x47, 0x50]), // RootStringChecksum = 0x50475342 LE
    Buffer.from([0xe4, 0x04, 0x00, 0x00]), // EUDCCodePage = 0x000004e4 LE
    Buffer.alloc(14), // 14 bytes reserved
  ]);

  const fixedHdrLen = 82;
  const hdrLen = fixedHdrLen + strData.length;
  const fontDataSize = fontBuffer.length;
  const eotSize = hdrLen + fontDataSize;

  const hdr = Buffer.alloc(fixedHdrLen);
  hdr.writeUInt32LE(eotSize, 0);
  hdr.writeUInt32LE(fontDataSize, 4);
  hdr.writeUInt32LE(0x00020002, 8); // Version 2.2
  hdr.writeUInt32LE(0x00000000, 12); // Flags = uncompressed
  panose.copy(hdr, 16, 0, 10);
  hdr.writeUInt8(0, 26); // Charset = 0
  hdr.writeUInt8(italic, 27);
  hdr.writeUInt32LE(usWeightClass, 28);
  hdr.writeUInt16LE(fsType, 32);
  hdr.writeUInt16LE(0x504c, 34); // MagicNumber 'LP'
  hdr.writeUInt32LE(urange1, 36);
  hdr.writeUInt32LE(urange2, 40);
  hdr.writeUInt32LE(urange3, 44);
  hdr.writeUInt32LE(urange4, 48);
  hdr.writeUInt32LE(cprange1, 52);
  hdr.writeUInt32LE(cprange2, 56);
  hdr.writeUInt32LE(chksum, 60);
  hdr.writeUInt32LE(0, 64);
  hdr.writeUInt32LE(0, 68);
  hdr.writeUInt32LE(0, 72);
  hdr.writeUInt32LE(0, 76);
  hdr.writeUInt16LE(0, 80); // Padding

  return Buffer.concat([hdr, strData, fontBuffer]);
}

/**
 * Extracts alternative family and typeface names from TrueType name table (Name ID 1 and 16).
 */
export function extractFontAliases(fontBuffer: Buffer, defaultFamily: string): string[] {
  const aliases = new Set<string>([defaultFamily]);
  if (!fontBuffer || fontBuffer.length < 12) return Array.from(aliases);

  const numTables = fontBuffer.readUInt16BE(4);
  if (12 + numTables * 16 > fontBuffer.length) return Array.from(aliases);

  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = fontBuffer.toString('latin1', off, off + 4);
    if (tag === 'name') {
      const noff = fontBuffer.readUInt32BE(off + 8);
      if (noff + 6 > fontBuffer.length) break;
      const nCount = fontBuffer.readUInt16BE(noff + 2);
      const sOff = fontBuffer.readUInt16BE(noff + 4);
      for (let j = 0; j < nCount; j++) {
        const roff = noff + 6 + j * 12;
        if (roff + 12 > fontBuffer.length) break;
        const plat = fontBuffer.readUInt16BE(roff);
        const enc = fontBuffer.readUInt16BE(roff + 2);
        const lang = fontBuffer.readUInt16BE(roff + 4);
        const nid = fontBuffer.readUInt16BE(roff + 6);
        const slen = fontBuffer.readUInt16BE(roff + 8);
        const soff = fontBuffer.readUInt16BE(roff + 10);
        if (plat === 3 && enc === 1 && lang === 1033 && (nid === 1 || nid === 16)) {
          const strStart = noff + sOff + soff;
          if (strStart + slen <= fontBuffer.length) {
            const sBytes = Buffer.from(fontBuffer.subarray(strStart, strStart + slen));
            sBytes.swap16();
            const name = sBytes.toString('utf16le').trim();
            if (name) aliases.add(name);
          }
        }
      }
      break;
    }
  }

  return Array.from(aliases);
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
            facesToEmbed.push({
              family,
              slot,
              buffer: buf,
              sourceTypeface: manifestMatch.sourceTypeface,
            });
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

  // 1. Ensure [Content_Types].xml declares ECMA-376 obfuscatedFont MIME type for odttf AND application/x-fontdata for fntdata
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    let ctXml = await contentTypesFile.async('string');
    if (!ctXml.includes('Extension="odttf"')) {
      ctXml = ctXml.replace(
        '</Types>',
        '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/></Types>'
      );
    }
    if (!ctXml.includes('Extension="fntdata"')) {
      ctXml = ctXml.replace(
        '</Types>',
        '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>'
      );
    }
    zip.file('[Content_Types].xml', ctXml);
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
      aliases: Set<string>;
    }
  >();

  let fontCounter = 0;
  for (const face of facesToEmbed) {
    const rId = `rId${++maxId}`;
    fontCounter++;
    const fntFileName = `font${fontCounter}.fntdata`;
    const target = `fonts/${fntFileName}`;

    // 1. Build uncompressed EOT v2.2 binary for native PowerPoint Desktop rendering
    const eotBuffer = buildEot(face.buffer, face.family, face.slot);
    zip.file(`ppt/${target}`, eotBuffer);

    // 2. Also package ECMA-376 .odttf with XOR obfuscation for standard conformity
    const rawUuid = crypto.randomUUID().toUpperCase();
    const key = deriveObfuscationKey(rawUuid);
    if (key) {
      const obfuscated = obfuscateFont(face.buffer, key);
      zip.file(`ppt/fonts/${rawUuid}.odttf`, obfuscated);
    }

    const relTag = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/>`;
    relsXml = relsXml.replace('</Relationships>', `${relTag}</Relationships>`);

    let familyGroup = familySlotMap.get(face.family);
    if (!familyGroup) {
      const aliases = new Set<string>([face.family]);
      if (face.sourceTypeface) aliases.add(face.sourceTypeface);
      for (const alias of extractFontAliases(face.buffer, face.family)) {
        aliases.add(alias);
      }
      familyGroup = { aliases };
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
      for (const typefaceName of slots.aliases) {
        familyBlocksMap.set(
          typefaceName.toLowerCase(),
          `<p:embeddedFont><p:font typeface="${escapeXml(typefaceName)}"/>${slotTags}</p:embeddedFont>`
        );
      }
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

    if (!presXml.includes('embedTrueTypeFonts="1"')) {
      presXml = presXml.replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" ');
    }
    if (!presXml.includes('saveSubsetFonts="1"')) {
      presXml = presXml.replace('<p:presentation ', '<p:presentation saveSubsetFonts="1" ');
    }

    zip.file('ppt/presentation.xml', presXml);
  }

  return Array.from(embeddedFamilies);
}
