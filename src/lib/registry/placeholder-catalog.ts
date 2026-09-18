// Hand-mirrored port: src/lib/registry/placeholder-catalog.ts <-> internal/plan/validate_artifact.go
/**
 * Placeholder Catalog (DEC-004 Supplement S1, AD-19/AD-32).
 *
 * The catalog admits the 17 predefined-field keys named by the reference deck.
 * Hydration substitutes `{key}` tokens inline in a text element's content; an
 * image key keeps its own geometry box. Weekly values land in the catalog
 * through `catalogValuesFromWeekly`, which keeps the same `CatalogWeeklyInput`
 * surface (callers supply the right field) and writes to the new keys
 * directly — the legacy `reference`/`text` fallback merge is gone (S1).
 */
import type { PlaceholderType } from './types';

export type CatalogEntry = {
  key: string;
  type: PlaceholderType;
};

export const PLACEHOLDER_CATALOG: readonly CatalogEntry[] = [
  { key: 'service_date', type: 'text' },
  { key: 'scripture_reference', type: 'text' },
  { key: 'scripture_text', type: 'text' },
  { key: 'scripture_bible_version', type: 'text' },
  { key: 'theme_reference', type: 'text' },
  { key: 'theme_text', type: 'text' },
  { key: 'special_song', type: 'text' },
  { key: 'sermon_title', type: 'text' },
  { key: 'sermon_speaker_name', type: 'text' },
  { key: 'sermon_poster', type: 'image' },
  { key: 'closing_prayer_person', type: 'text' },
  { key: 'family_request', type: 'text' },
  { key: 'youth_request', type: 'text' },
  { key: 'family_name', type: 'text' },
  { key: 'youth_name', type: 'text' },
  { key: 'family_photo', type: 'image' },
  { key: 'youth_photo', type: 'image' },
];

const CATALOG_BY_KEY = new Map(PLACEHOLDER_CATALOG.map((entry) => [entry.key, entry]));

export function catalogEntry(key: string): CatalogEntry | undefined {
  return CATALOG_BY_KEY.get(key);
}

export function isCatalogPlaceholderKey(key: string): boolean {
  return CATALOG_BY_KEY.has(key);
}

/** Token matching regex for inline `{token_name}` in text element content. */
export const INLINE_TOKEN_REGEX = /\{([a-zA-Z0-9_]+)\}/g;

/** Extracts all unique token keys found inside text content (e.g. `{service_date}` -> `['service_date']`). */
export function extractInlineTokens(content: string | null | undefined): string[] {
  if (!content) return [];
  const tokens = new Set<string>();
  const regex = new RegExp(INLINE_TOKEN_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    tokens.add(match[1]);
  }
  return Array.from(tokens);
}

/**
 * Returns a list of warning messages for any inline tokens in a template's text elements
 * or image placeholderKeys that are not recognized in the Predefined Field Catalog.
 */
export function findUnknownPredefinedFieldTokens(template: {
  layouts?: Record<string, { elements?: Array<{ type?: string; content?: string; placeholderKey?: string }> }>;
}): string[] {
  const warnings: string[] = [];
  if (!template.layouts) return warnings;
  for (const [layoutKey, layout] of Object.entries(template.layouts)) {
    if (!layout?.elements) continue;
    for (const el of layout.elements) {
      if (el.type === 'text' && typeof el.content === 'string') {
        const tokens = extractInlineTokens(el.content);
        for (const token of tokens) {
          if (!isCatalogPlaceholderKey(token)) {
            warnings.push(
              `Unknown predefined field token {${token}} in layout "${layoutKey}"`
            );
          }
        }
      } else if ((el.type === 'image' || el.type === 'image-placeholder') && el.placeholderKey) {
        if (!isCatalogPlaceholderKey(el.placeholderKey)) {
          warnings.push(
            `Unknown predefined field image key "${el.placeholderKey}" in layout "${layoutKey}"`
          );
        }
      }
    }
  }
  return warnings;
}

/**
 * Weekly values a General can bind. The two-purpose `verseReference` /
 * `themeReference` pair replaces the old merged `reference` key — a caller
 * chooses which purpose it is supplying (S1 / R1). `serviceDate` is the new
 * name for `date`.
 */
export type CatalogWeeklyInput = {
  serviceDate?: string;
  scriptureReference?: string;
  scriptureText?: string;
  scriptureBibleVersion?: string;
  themeReference?: string;
  themeText?: string;
  specialSong?: string | null;
  sermonTitle?: string | null;
  sermonSpeaker?: string | null;
  sermonGraphic?: string | null;
  closingPrayer?: string | null;
  familyRequest?: string | null;
  youthRequest?: string | null;
  familyName?: string | null;
  youthName?: string | null;
  familyPhoto?: string | null;
  youthPhoto?: string | null;
};

function firstText(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Fills every catalog key the rundown can supply. Each new key writes from
 * the matching weekly field — there is no `reference`/`text` fallback merge,
 * and the verse-reading slide binds `scripture_*` while
 * `bible-verse-contemplation` binds `theme_*` (the migration log records the
 * per-slide identity match; S1/R1).
 */
export function catalogValuesFromWeekly(input: CatalogWeeklyInput): Readonly<
  Record<string, string>
> {
  const values: Record<string, string> = {};
  const serviceDate = firstText(input.serviceDate);
  if (serviceDate) values.service_date = serviceDate;
  const scriptureReference = firstText(input.scriptureReference);
  if (scriptureReference) values.scripture_reference = scriptureReference;
  const scriptureText = firstText(input.scriptureText);
  if (scriptureText) values.scripture_text = scriptureText;
  const scriptureBibleVersion = firstText(input.scriptureBibleVersion);
  if (scriptureBibleVersion) values.scripture_bible_version = scriptureBibleVersion;
  const themeReference = firstText(input.themeReference);
  if (themeReference) values.theme_reference = themeReference;
  const themeText = firstText(input.themeText);
  if (themeText) values.theme_text = themeText;
  const specialSong = firstText(input.specialSong);
  if (specialSong) values.special_song = specialSong;
  const sermonTitle = firstText(input.sermonTitle);
  if (sermonTitle) values.sermon_title = sermonTitle;
  const sermonSpeakerName = firstText(input.sermonSpeaker);
  if (sermonSpeakerName) values.sermon_speaker_name = sermonSpeakerName;
  const sermonPoster = firstText(input.sermonGraphic);
  if (sermonPoster) values.sermon_poster = sermonPoster;
  const closingPrayerPerson = firstText(input.closingPrayer);
  if (closingPrayerPerson) values.closing_prayer_person = closingPrayerPerson;
  const familyRequest = firstText(input.familyRequest);
  if (familyRequest) values.family_request = familyRequest;
  const youthRequest = firstText(input.youthRequest);
  if (youthRequest) values.youth_request = youthRequest;
  const familyName = firstText(input.familyName);
  if (familyName) values.family_name = familyName;
  const youthName = firstText(input.youthName);
  if (youthName) values.youth_name = youthName;
  const familyPhoto = firstText(input.familyPhoto);
  if (familyPhoto) values.family_photo = familyPhoto;
  const youthPhoto = firstText(input.youthPhoto);
  if (youthPhoto) values.youth_photo = youthPhoto;
  return values;
}
