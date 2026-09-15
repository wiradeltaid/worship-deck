/**
 * 45 Curated Presentation Fonts for Worship Slides & PPTX Export.
 *
 * Categories:
 * - system: 10 Universal system fonts supported natively across PowerPoint installations.
 * - sans: 12 Clean modern sans-serifs for lyrics, reading, and body text.
 * - serif: 8 Dignified classic serifs for scripture, sermon titles, and communion.
 * - display: 8 Bold, high-impact fonts for event themes, opening titles, and countdowns.
 * - script: 7 Elegant calligraphy, brush, and handwriting fonts for greetings and personal notes.
 */

export type FontCategory = 'system' | 'sans' | 'serif' | 'display' | 'script';

export interface FontDefinition {
  family: string;
  label: string;
  category: FontCategory;
  fallback: string;
  googleFont?: string;
  pptxSafe: boolean;
  pptxSubstitute?: string;
  embeddable?: boolean;
}

export const FONT_CATEGORY_LABELS: Record<FontCategory, { en: string; id: string }> = {
  system: { en: 'System & PowerPoint Safe', id: 'Standar Sistem & PPTX' },
  sans: { en: 'Modern Sans-Serif', id: 'Sans-Serif Modern' },
  serif: { en: 'Dignified Serif', id: 'Serif Klasik & Sakral' },
  display: { en: 'Bold Display & Title', id: 'Display & Judul Besar' },
  script: { en: 'Script & Handwriting', id: 'Kaligrafi & Tulisan Tangan' },
};

export const FONT_CATALOG: FontDefinition[] = [
  // 1. System Safe / PPTX Universal (10 fonts)
  { family: 'Arial', label: 'Arial', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Calibri', label: 'Calibri', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Aptos', label: 'Aptos', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Segoe UI', label: 'Segoe UI', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Verdana', label: 'Verdana', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Trebuchet MS', label: 'Trebuchet MS', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Tahoma', label: 'Tahoma', category: 'system', fallback: 'sans-serif', pptxSafe: true, embeddable: false },
  { family: 'Georgia', label: 'Georgia', category: 'system', fallback: 'serif', pptxSafe: true, embeddable: false },
  { family: 'Times New Roman', label: 'Times New Roman', category: 'system', fallback: 'serif', pptxSafe: true, embeddable: false },
  { family: 'Garamond', label: 'Garamond', category: 'system', fallback: 'serif', pptxSafe: true, embeddable: false },

  // 2. Modern Sans-Serif (12 fonts)
  { family: 'Inter', label: 'Inter', category: 'sans', fallback: 'sans-serif', googleFont: 'Inter:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Roboto', label: 'Roboto', category: 'sans', fallback: 'sans-serif', googleFont: 'Roboto:wght@400;500;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Open Sans', label: 'Open Sans', category: 'sans', fallback: 'sans-serif', googleFont: 'Open+Sans:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Lato', label: 'Lato', category: 'sans', fallback: 'sans-serif', googleFont: 'Lato:wght@400;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Montserrat', label: 'Montserrat', category: 'sans', fallback: 'sans-serif', googleFont: 'Montserrat:wght@400;600;700;800', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Poppins', label: 'Poppins', category: 'sans', fallback: 'sans-serif', googleFont: 'Poppins:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Nunito', label: 'Nunito', category: 'sans', fallback: 'sans-serif', googleFont: 'Nunito:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Raleway', label: 'Raleway', category: 'sans', fallback: 'sans-serif', googleFont: 'Raleway:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Oswald', label: 'Oswald', category: 'sans', fallback: 'sans-serif', googleFont: 'Oswald:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Barlow Condensed', label: 'Barlow Condensed', category: 'sans', fallback: 'sans-serif', googleFont: 'Barlow+Condensed:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'DM Sans', label: 'DM Sans', category: 'sans', fallback: 'sans-serif', googleFont: 'DM+Sans:wght@400;500;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Work Sans', label: 'Work Sans', category: 'sans', fallback: 'sans-serif', googleFont: 'Work+Sans:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },

  // 3. Dignified Serif (8 fonts)
  { family: 'Merriweather', label: 'Merriweather', category: 'serif', fallback: 'serif', googleFont: 'Merriweather:wght@400;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif', fallback: 'serif', googleFont: 'Playfair+Display:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Lora', label: 'Lora', category: 'serif', fallback: 'serif', googleFont: 'Lora:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Cinzel', label: 'Cinzel', category: 'serif', fallback: 'serif', googleFont: 'Cinzel:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Cormorant Garamond', label: 'Cormorant Garamond', category: 'serif', fallback: 'serif', googleFont: 'Cormorant+Garamond:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'PT Serif', label: 'PT Serif', category: 'serif', fallback: 'serif', googleFont: 'PT+Serif:wght@400;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'EB Garamond', label: 'EB Garamond', category: 'serif', fallback: 'serif', googleFont: 'EB+Garamond:wght@400;600;700', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Baskervville', label: 'Baskervville', category: 'serif', fallback: 'serif', googleFont: 'Baskervville:ital@0;1', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },

  // 4. Bold Display & Title Impact (8 fonts)
  { family: 'Bebas Neue', label: 'Bebas Neue', category: 'display', fallback: 'sans-serif', googleFont: 'Bebas+Neue', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Anton', label: 'Anton', category: 'display', fallback: 'sans-serif', googleFont: 'Anton', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'League Spartan', label: 'League Spartan', category: 'display', fallback: 'sans-serif', googleFont: 'League+Spartan:wght@600;700;800', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Righteous', label: 'Righteous', category: 'display', fallback: 'sans-serif', googleFont: 'Righteous', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Teko', label: 'Teko', category: 'display', fallback: 'sans-serif', googleFont: 'Teko:wght@500;600;700', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Abril Fatface', label: 'Abril Fatface', category: 'display', fallback: 'serif', googleFont: 'Abril+Fatface', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Alfa Slab One', label: 'Alfa Slab One', category: 'display', fallback: 'serif', googleFont: 'Alfa+Slab+One', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Russo One', label: 'Russo One', category: 'display', fallback: 'sans-serif', googleFont: 'Russo+One', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },

  // 5. Script & Handwriting (7 fonts)
  { family: 'Great Vibes', label: 'Great Vibes', category: 'script', fallback: 'cursive', googleFont: 'Great+Vibes', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Pacifico', label: 'Pacifico', category: 'script', fallback: 'cursive', googleFont: 'Pacifico', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Caveat', label: 'Caveat', category: 'script', fallback: 'cursive', googleFont: 'Caveat:wght@600;700', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Dancing Script', label: 'Dancing Script', category: 'script', fallback: 'cursive', googleFont: 'Dancing+Script:wght@600;700', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Sacramento', label: 'Sacramento', category: 'script', fallback: 'cursive', googleFont: 'Sacramento', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Shadows Into Light', label: 'Shadows Into Light', category: 'script', fallback: 'cursive', googleFont: 'Shadows+Into+Light', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Satisfy', label: 'Satisfy', category: 'script', fallback: 'cursive', googleFont: 'Satisfy', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
];

export const DEFAULT_FONT_FAMILY = 'Arial';

const FONT_MAP = new Map<string, FontDefinition>(
  FONT_CATALOG.map((f) => [f.family.toLowerCase(), f])
);

export function getFontDefinition(family: string | undefined): FontDefinition | undefined {
  if (!family) return undefined;
  return FONT_MAP.get(family.trim().toLowerCase());
}

/**
 * SPEC-33-01: Decouples universal system fonts from embeddable TrueType fonts.
 * A font is considered export-ready if:
 * 1) It is a universal system font installed across all PowerPoint machines (category === 'system');
 * 2) It is a catalog font with confirmed export embedding support (embeddable === true);
 * 3) It has been dynamically hydrated and registered into the font catalog.
 */
export function isFontExportReady(family: string | undefined): boolean {
  if (!family) return true;
  const def = getFontDefinition(family);
  if (!def) return false;
  return def.category === 'system' || def.embeddable === true;
}

export function getFontStack(family: string | undefined): string {
  const def = getFontDefinition(family);
  if (!def) {
    if (family) {
      const clean = family.trim();
      const lower = clean.toLowerCase();
      // SPEC-33-03: Heuristic fallback for unacquired script / handwriting / calligraphy fonts
      if (
        lower.includes('script') ||
        lower.includes('hand') ||
        lower.includes('calligraphy') ||
        lower.includes('brush') ||
        lower.includes('youngest')
      ) {
        return `"${clean}", cursive, sans-serif`;
      }
      return `"${clean}", "${DEFAULT_FONT_FAMILY}", sans-serif`;
    }
    return `"${DEFAULT_FONT_FAMILY}", sans-serif`;
  }
  return `"${def.family}", ${def.fallback}`;
}

export function resolveCatalogFontFamily(fabricFamily: string | undefined): string {
  if (!fabricFamily) return DEFAULT_FONT_FAMILY;
  const match = fabricFamily.match(/"([^"]+)"/);
  const candidate = match?.[1] ?? fabricFamily.split(',')[0]?.trim();
  return getFontDefinition(candidate)?.family ?? candidate ?? DEFAULT_FONT_FAMILY;
}

export function getGoogleFontsStylesheetUrl(): string {
  const families = FONT_CATALOG.filter((f) => Boolean(f.googleFont))
    .map((f) => `family=${f.googleFont}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export interface ImportedFontFace {
  id: string;
  family: string;
  sourceTypeface: string;
  weight: string;
  style: string;
  format: string;
  url: string;
}

const registeredFaces = new Set<string>();

export async function registerDynamicFontFace(face: ImportedFontFace): Promise<boolean> {
  const key = `${face.family}-${face.weight}-${face.style}-${face.url}`;
  if (registeredFaces.has(key)) return true;

  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') {
    return false;
  }

  const family = face.family.trim();
  const descriptors: FontFaceDescriptors = {
    weight: face.weight || 'normal',
    style: face.style || 'normal',
  };

  try {
    for (const f of document.fonts) {
      if (f.family === family && f.weight === descriptors.weight && f.style === descriptors.style) {
        registeredFaces.add(key);
        return true;
      }
    }
    const font = new FontFace(family, `url("${face.url}")`, descriptors);
    const loaded = await font.load();
    document.fonts.add(loaded);
    registeredFaces.add(key);

    // Register into catalog map if not present
    if (!FONT_MAP.has(family.toLowerCase())) {
      const def: FontDefinition = {
        family,
        label: family,
        category: 'sans',
        fallback: 'sans-serif',
        pptxSafe: true, // Self-contained embedded font
        embeddable: true,
      };
      FONT_CATALOG.push(def);
      FONT_MAP.set(family.toLowerCase(), def);
    }

    return true;
  } catch (e) {
    console.warn(`[font-catalog] failed to load dynamic FontFace ${family}:`, e);
    return false;
  }
}

export async function hydrateImportedFonts(): Promise<number> {
  if (typeof fetch === 'undefined') return 0;
  try {
    const res = await fetch('/api/fonts');
    if (!res.ok) return 0;
    const fonts = (await res.json()) as ImportedFontFace[];
    if (!Array.isArray(fonts)) return 0;
    let registered = 0;
    for (const font of fonts) {
      const ok = await registerDynamicFontFace(font);
      if (ok) registered++;
    }
    return registered;
  } catch {
    return 0;
  }
}

