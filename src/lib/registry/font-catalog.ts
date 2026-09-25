/**
 * 51 Curated Presentation Fonts for Worship Slides & PPTX Export.
 *
 * Categories:
 * - system: 10 Universal system fonts supported natively across PowerPoint installations.
 * - sans: 13 Clean modern sans-serifs for lyrics, reading, and body text.
 * - serif: 10 Dignified classic serifs for scripture, sermon titles, and communion.
 * - display: 11 Bold, high-impact fonts for event themes, opening titles, and countdowns.
 * - script: 7 Elegant calligraphy, brush, and handwriting fonts for greetings and personal notes.
 */

export type FontCategory = 'custom' | 'system' | 'sans' | 'serif' | 'display' | 'script';

export type FontVariant = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface FontDefinition {
  family: string;
  label: string;
  category: FontCategory;
  fallback: string;
  pptxSafe: boolean;
  pptxSubstitute?: string;
  embeddable?: boolean;
  variants?: FontVariant[];
}

export function resolveFontVariantKey(weight: string | undefined, style: string | undefined): FontVariant {
  const w = String(weight ?? '').toLowerCase();
  const s = String(style ?? '').toLowerCase();
  const isBold = w === 'bold' || w === '700' || w === '800' || w === '900' || w === '600';
  const isItalic = s === 'italic' || s === 'oblique';
  if (isBold && isItalic) return 'boldItalic';
  if (isBold) return 'bold';
  if (isItalic) return 'italic';
  return 'regular';
}

export const FONT_CATEGORY_LABELS: Record<FontCategory, { en: string; id: string }> = {
  custom: { en: 'Custom / Uploaded Fonts', id: 'Font Kustom / Diunggah' },
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

  // 2. Modern Sans-Serif (13 fonts)
  { family: 'Inter', label: 'Inter', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Roboto', label: 'Roboto', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Open Sans', label: 'Open Sans', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Lato', label: 'Lato', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Montserrat', label: 'Montserrat', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Poppins', label: 'Poppins', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Nunito', label: 'Nunito', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Raleway', label: 'Raleway', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Oswald', label: 'Oswald', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Barlow Condensed', label: 'Barlow Condensed', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'DM Sans', label: 'DM Sans', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Work Sans', label: 'Work Sans', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', category: 'sans', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },

  // 3. Dignified Serif (10 fonts)
  { family: 'Merriweather', label: 'Merriweather', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Lora', label: 'Lora', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Cinzel', label: 'Cinzel', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Cormorant Garamond', label: 'Cormorant Garamond', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'PT Serif', label: 'PT Serif', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'EB Garamond', label: 'EB Garamond', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Baskervville', label: 'Baskervville', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Source Serif 4', label: 'Source Serif 4', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },
  { family: 'Cinzel Decorative', label: 'Cinzel Decorative', category: 'serif', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Times New Roman', embeddable: true },

  // 4. Bold Display & Title Impact (11 fonts)
  { family: 'Bebas Neue', label: 'Bebas Neue', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Anton', label: 'Anton', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'League Spartan', label: 'League Spartan', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Righteous', label: 'Righteous', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Teko', label: 'Teko', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Abril Fatface', label: 'Abril Fatface', category: 'display', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Alfa Slab One', label: 'Alfa Slab One', category: 'display', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Russo One', label: 'Russo One', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Fraunces', label: 'Fraunces', category: 'display', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Calistoga', label: 'Calistoga', category: 'display', fallback: 'serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },
  { family: 'Syne', label: 'Syne', category: 'display', fallback: 'sans-serif', pptxSafe: false, pptxSubstitute: 'Arial', embeddable: true },

  // 5. Script & Handwriting (7 fonts)
  { family: 'Great Vibes', label: 'Great Vibes', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Pacifico', label: 'Pacifico', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Caveat', label: 'Caveat', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Dancing Script', label: 'Dancing Script', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Sacramento', label: 'Sacramento', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Shadows Into Light', label: 'Shadows Into Light', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
  { family: 'Satisfy', label: 'Satisfy', category: 'script', fallback: 'cursive', pptxSafe: false, pptxSubstitute: 'Georgia', embeddable: true },
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
const activeVariantUrls = new Map<string, { url: string; faceObj?: any }>();

export async function registerDynamicFontFace(
  face: ImportedFontFace,
  fontFaceLoader?: (family: string, url: string, descriptors: FontFaceDescriptors) => Promise<boolean>
): Promise<boolean> {
  const family = face.family.trim();
  const descriptors: FontFaceDescriptors = {
    weight: face.weight || 'normal',
    style: face.style || 'normal',
  };
  const identityKey = `${family.toLowerCase()}-${descriptors.weight}-${descriptors.style}`;
  const key = `${identityKey}-${face.url}`;
  if (registeredFaces.has(key)) return true;

  // Hydrate in browser DOM or using injected fontFaceLoader
  let loadedFontFace: any = undefined;
  if (fontFaceLoader) {
    try {
      const ok = await fontFaceLoader(family, face.url, descriptors);
      if (!ok) return false;
    } catch (e) {
      console.warn(`[font-catalog] loader failed for ${family}:`, e);
      return false;
    }
  } else if (typeof document !== 'undefined' && 'fonts' in document && typeof FontFace !== 'undefined') {
    try {
      // SPEC-36-02: If replacing an existing face with a different URL, retire the old FontFace
      const existing = activeVariantUrls.get(identityKey);
      if (existing && existing.url !== face.url) {
        if (existing.faceObj) {
          try {
            (document.fonts as any).delete(existing.faceObj);
          } catch {}
        }
        registeredFaces.delete(`${identityKey}-${existing.url}`);
      }

      // Also clean up any lingering matching face in document.fonts
      const toRemove: any[] = [];
      for (const f of document.fonts) {
        if (
          f.family.toLowerCase() === family.toLowerCase() &&
          f.weight === descriptors.weight &&
          f.style === descriptors.style
        ) {
          toRemove.push(f);
        }
      }
      for (const f of toRemove) {
        try {
          (document.fonts as any).delete(f);
        } catch {}
      }

      // SPEC-37-02: Add FontFace to document.fonts before loading so document.fonts emits
      // lifecycle events ('loading' / 'loadingdone') needed by ArtifactSlide text re-fit.
      const font = new FontFace(family, `url("${face.url}")`, descriptors);
      document.fonts.add(font);
      try {
        loadedFontFace = await font.load();
      } catch (loadErr) {
        try {
          (document.fonts as any).delete(font);
        } catch {}
        throw loadErr;
      }
    } catch (e) {
      console.warn(`[font-catalog] failed to load dynamic FontFace ${family}:`, e);
      return false;
    }
  }

  // Only reached if FontFace loading succeeded (or running in headless environment)
  registeredFaces.add(key);
  activeVariantUrls.set(identityKey, { url: face.url, faceObj: loadedFontFace });

  const variant = resolveFontVariantKey(descriptors.weight, descriptors.style);

  const lowerFamily = family.toLowerCase();
  let def = FONT_MAP.get(lowerFamily);
  if (!def) {
    def = {
      family,
      label: family,
      category: 'custom',
      fallback: 'sans-serif',
      pptxSafe: true, // Self-contained embedded font
      embeddable: true,
      variants: [variant],
    };
    FONT_CATALOG.unshift(def);
    FONT_MAP.set(lowerFamily, def);
  } else {
    // An uploaded face always promotes to 'custom' category and ensures export readiness
    def.category = 'custom';
    def.embeddable = true;
    def.pptxSafe = true;
    if (!def.variants) {
      def.variants = [variant];
    } else if (!def.variants.includes(variant)) {
      def.variants.push(variant);
    }
  }

  return true;
}

let inFlightHydration: Promise<number> | null = null;

export async function hydrateImportedFonts(): Promise<number> {
  if (inFlightHydration) {
    return inFlightHydration;
  }
  if (typeof fetch === 'undefined') return 0;

  inFlightHydration = (async () => {
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
    } finally {
      inFlightHydration = null;
    }
  })();

  return inFlightHydration;
}

