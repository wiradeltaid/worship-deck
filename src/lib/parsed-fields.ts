import type {
  ParsedRundown,
  ParsedScripture,
  ParsedSermon,
} from './parser';
import { lookupHymn, parseScriptureValue } from './parser';

/** One Song Set weekly input as sent by the Hub form (DEC-004 / FR-32). */
export type SongSetEntryPayload = {
  songNumber?: number | string | null;
  songBookCode?: string | null;
  background?: string | null;
  lyricText?: string | null;
};

export type SongSetPayloadMap = Record<string, SongSetEntryPayload>;

export type StructuredServiceFields = {
  themeVerse?: ParsedScripture | null;
  verseReading?: ParsedScripture | null;
  /** @deprecated Prefer familyPrayerRequest / youthPrayerRequest */
  familyYouth?: string | null;
  familyPrayerRequest?: string | null;
  youthPrayerRequest?: string | null;
  familyName?: string | null;
  youthName?: string | null;
  sermon?: ParsedSermon | null;
  specialSong?: string | null;
  closingPrayerPerson?: string | null;
  afternoonProgram?: string | null;
  /** Weekly inputs keyed by Registry variable_name â€” persisted via song_set_inputs. */
  songSets?: SongSetPayloadMap | null;
};

function coerceScripture(value: unknown): ParsedScripture | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return parseScriptureValue(value);
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;

  const refRaw = (value as { reference?: unknown }).reference;
  const textRaw = (value as { text?: unknown }).text;
  const reference =
    typeof refRaw === 'string' && refRaw.trim() ? refRaw.trim() : null;
  const text = typeof textRaw === 'string' ? textRaw.trim() : '';

  if (!reference && !text) return null;
  const translationRaw = (value as { translation?: unknown }).translation;
  const translation =
    typeof translationRaw === 'string' && translationRaw.trim()
      ? translationRaw.trim().toUpperCase()
      : undefined;
  return translation ? { reference, text, translation } : { reference, text };
}

function coerceSpecialSong(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'â€”' || /^none$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function coerceNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
}

function coerceNullableTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

/** A non-integer draft never becomes a number â€” free text is not a hymn number. */
function coerceEntrySongNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function coerceSongSets(value: unknown): SongSetPayloadMap | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: SongSetPayloadMap = {};
  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const entry =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as SongSetEntryPayload)
        : {};
    out[trimmed] = {
      songNumber: coerceEntrySongNumber(entry.songNumber),
      songBookCode: coerceNullableTrimmed(entry.songBookCode),
      background: coerceNullableTrimmed(entry.background),
      lyricText: coerceNullableTrimmed(entry.lyricText),
    };
  }
  return out;
}

/** Parse optional structured patch fields from a PUT/POST body. */
export function coerceStructuredFields(
  body: unknown
): StructuredServiceFields | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const src =
    (body as { fields?: unknown }).fields !== undefined
      ? (body as { fields: unknown }).fields
      : body;

  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;

  const fields: StructuredServiceFields = {};
  let any = false;

  if (Object.prototype.hasOwnProperty.call(src, 'themeVerse')) {
    const v = coerceScripture((src as { themeVerse?: unknown }).themeVerse);
    if (v !== undefined) {
      fields.themeVerse = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'verseReading')) {
    const v = coerceScripture((src as { verseReading?: unknown }).verseReading);
    if (v !== undefined) {
      fields.verseReading = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'familyYouth')) {
    const v = coerceNullableString((src as { familyYouth?: unknown }).familyYouth);
    if (v !== undefined) {
      fields.familyYouth = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'familyPrayerRequest')) {
    const v = coerceNullableString(
      (src as { familyPrayerRequest?: unknown }).familyPrayerRequest
    );
    if (v !== undefined) {
      fields.familyPrayerRequest = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'youthPrayerRequest')) {
    const v = coerceNullableString(
      (src as { youthPrayerRequest?: unknown }).youthPrayerRequest
    );
    if (v !== undefined) {
      fields.youthPrayerRequest = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'familyName')) {
    const v = coerceNullableString(
      (src as { familyName?: unknown }).familyName
    );
    if (v !== undefined) {
      fields.familyName = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'youthName')) {
    const v = coerceNullableString(
      (src as { youthName?: unknown }).youthName
    );
    if (v !== undefined) {
      fields.youthName = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'sermon')) {
    const raw = (src as { sermon?: unknown }).sermon;
    if (raw === null) {
      fields.sermon = null;
      any = true;
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const speaker = String(
        (raw as { speaker?: unknown }).speaker ?? ''
      ).trim();
      const title = String((raw as { title?: unknown }).title ?? '').trim();
      fields.sermon = speaker ? { speaker, title } : null;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'specialSong')) {
    const v = coerceSpecialSong((src as { specialSong?: unknown }).specialSong);
    if (v !== undefined) {
      fields.specialSong = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'closingPrayerPerson')) {
    const v = coerceNullableString(
      (src as { closingPrayerPerson?: unknown }).closingPrayerPerson
    );
    if (v !== undefined) {
      fields.closingPrayerPerson = v;
      any = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(src, 'afternoonProgram')) {
    const v = coerceNullableString(
      (src as { afternoonProgram?: unknown }).afternoonProgram
    );
    if (v !== undefined) {
      fields.afternoonProgram = v;
      any = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(src, 'songSets')) {
    fields.songSets = coerceSongSets((src as { songSets?: unknown }).songSets);
    // Presence alone counts: an empty map still drives the song_set_inputs
    // upsert (clearing stored rows) on the server write path.
    any = true;
  }

  const flat = src as {
    sermonSpeaker?: unknown;
    sermonTitle?: unknown;
  };
  if (
    fields.sermon === undefined &&
    (Object.prototype.hasOwnProperty.call(src, 'sermonSpeaker') ||
      Object.prototype.hasOwnProperty.call(src, 'sermonTitle'))
  ) {
    const speaker =
      typeof flat.sermonSpeaker === 'string' ? flat.sermonSpeaker.trim() : '';
    const title =
      typeof flat.sermonTitle === 'string' ? flat.sermonTitle.trim() : '';
    fields.sermon = speaker ? { speaker, title } : null;
    any = true;
  }

  return any ? fields : null;
}

/**
 * Validate each Song Set entry's number against the hymn corpus (DEC-004 /
 * FR-32). The weekly inputs themselves are persisted by the Hub write path
 * into song_set_inputs, keyed by variable_name â€” parsed_data no longer carries
 * positional hymn overlays. A number whose lyrics cannot be resolved is
 * reported through failedHymnNumbers; a number that resolves is cleared from
 * that list so a corrected entry stops warning.
 */
function validateSongSetNumbers(
  parsed: ParsedRundown,
  sets: SongSetPayloadMap | null | undefined
): void {
  if (!sets) return;
  for (const entry of Object.values(sets)) {
    const n = coerceEntrySongNumber(entry?.songNumber);
    if (n == null) continue;
    const found = lookupHymn(n);
    if (found.incomplete) {
      if (!parsed.failedHymnNumbers.includes(n)) {
        parsed.failedHymnNumbers.push(n);
      }
    } else {
      parsed.failedHymnNumbers = parsed.failedHymnNumbers.filter(
        (x) => x !== n
      );
    }
  }
}

/** Overlay structured fields onto a ParsedRundown (in place). */
export function applyStructuredFields(
  parsed: ParsedRundown,
  fields: StructuredServiceFields
): ParsedRundown {
  if (fields.themeVerse !== undefined) parsed.themeVerse = fields.themeVerse;
  if (fields.verseReading !== undefined) {
    parsed.verseReading = fields.verseReading;
  }
  if (fields.familyYouth !== undefined) parsed.familyYouth = fields.familyYouth;
  if (
    fields.familyPrayerRequest !== undefined ||
    fields.youthPrayerRequest !== undefined
  ) {
    if (fields.familyPrayerRequest !== undefined) {
      parsed.familyPrayerRequest = fields.familyPrayerRequest;
    }
    if (fields.youthPrayerRequest !== undefined) {
      parsed.youthPrayerRequest = fields.youthPrayerRequest;
    }
    // Split fields are source of truth â€” clear legacy combined text
    parsed.familyYouth = null;
  }
  if (fields.familyName !== undefined) parsed.familyName = fields.familyName;
  if (fields.youthName !== undefined) parsed.youthName = fields.youthName;
  if (fields.afternoonProgram !== undefined) parsed.afternoonProgram = fields.afternoonProgram;
  if (fields.specialSong !== undefined) parsed.specialSong = fields.specialSong;
  if (fields.closingPrayerPerson !== undefined) {
    let person = fields.closingPrayerPerson;
    if (
      person &&
      /^the\s+speaker$/i.test(person.trim()) &&
      parsed.sermon?.speaker
    ) {
      person = parsed.sermon.speaker;
    }
    parsed.closingPrayerPerson = person;
    const idx = parsed.items.findIndex(
      (i) => i.type === 'role' && /^Closing Prayer$/i.test(i.role)
    );
    if (person) {
      if (idx >= 0) {
        parsed.items[idx] = {
          type: 'role',
          role: 'Closing Prayer',
          name: person,
        };
      } else {
        parsed.items.push({
          type: 'role',
          role: 'Closing Prayer',
          name: person,
        });
      }
    } else if (idx >= 0) {
      parsed.items.splice(idx, 1);
    }
  }
  if (fields.sermon !== undefined) {
    parsed.sermon = fields.sermon;
    const idx = parsed.items.findIndex(
      (i) => i.type === 'role' && /^Sermon$/i.test(i.role)
    );
    if (fields.sermon) {
      const name = fields.sermon.title
        ? `${fields.sermon.speaker} â€” ${fields.sermon.title}`
        : fields.sermon.speaker;
      if (idx >= 0) {
        parsed.items[idx] = { type: 'role', role: 'Sermon', name };
      } else {
        parsed.items.push({ type: 'role', role: 'Sermon', name });
      }
      if (
        parsed.closingPrayerPerson &&
        /^the\s+speaker$/i.test(parsed.closingPrayerPerson.trim())
      ) {
        parsed.closingPrayerPerson = fields.sermon.speaker;
        const cpIdx = parsed.items.findIndex(
          (i) => i.type === 'role' && /^Closing Prayer$/i.test(i.role)
        );
        if (cpIdx >= 0) {
          parsed.items[cpIdx] = {
            type: 'role',
            role: 'Closing Prayer',
            name: fields.sermon.speaker,
          };
        }
      }
    } else if (idx >= 0) {
      parsed.items.splice(idx, 1);
    }
  }

  validateSongSetNumbers(parsed, fields.songSets);

  return parsed;
}

/** Normalize legacy parsed_data JSON missing newer keys. */
export function normalizeParsedRundown(parsed: ParsedRundown): ParsedRundown {
  const familyYouth = parsed.familyYouth ?? null;
  let familyPrayerRequest = parsed.familyPrayerRequest ?? null;
  let youthPrayerRequest = parsed.youthPrayerRequest ?? null;
  // Legacy combined field â†’ family prayer when split fields empty.
  // applyStructuredFields clears familyYouth when split fields are saved.
  if (!familyPrayerRequest && !youthPrayerRequest && familyYouth) {
    familyPrayerRequest = familyYouth;
  }

  return {
    date: parsed.date ?? null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    unmappedLines: Array.isArray(parsed.unmappedLines)
      ? parsed.unmappedLines
      : [],
    failedHymnNumbers: Array.isArray(parsed.failedHymnNumbers)
      ? parsed.failedHymnNumbers
      : [],
    sermon: parsed.sermon ?? null,
    specialSong: parsed.specialSong ?? null,
    closingPrayerPerson: parsed.closingPrayerPerson ?? null,
    themeVerse: parsed.themeVerse ?? null,
    verseReading: parsed.verseReading ?? null,
    familyYouth,
    familyPrayerRequest,
    youthPrayerRequest,
    familyName: parsed.familyName ?? null,
    youthName: parsed.youthName ?? null,
    afternoonProgram: parsed.afternoonProgram ?? null,
  };
}
