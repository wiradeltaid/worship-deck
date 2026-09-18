import type { ParsedRundown } from './parser';

/**
 * One Song Set weekly input group, keyed by the Registry entry's
 * `variable_name` (DEC-004 / FR-32). Numbers stay strings in form state and
 * become numbers only in the API payload.
 */
export type SongSetEntryInput = {
  songNumber: string;
  songBookCode: string;
  background: string;
  lyricText: string;
};

export type SongSetInputs = Record<string, SongSetEntryInput>;

export const EMPTY_SONG_SET_ENTRY: SongSetEntryInput = {
  songNumber: '',
  songBookCode: '',
  background: '',
  lyricText: '',
};

/** Client-safe worship form field state (overlays only). */
export type WorshipFormFields = {
  songSets: SongSetInputs;
  verseReference: string;
  verseText: string;
  verseTranslation: string;
  sermonSpeaker: string;
  specialSong: string;
  closingPrayerPerson: string;
  familyPrayerRequest: string;
  youthPrayerRequest: string;
  familyName: string;
  youthName: string;
};

export type HymnIndexEntry = { number: number; title: string };

export const EMPTY_WORSHIP_FORM_FIELDS: WorshipFormFields = {
  songSets: {},
  verseReference: '',
  verseText: '',
  verseTranslation: '',
  sermonSpeaker: '',
  specialSong: '',
  closingPrayerPerson: '',
  familyPrayerRequest: '',
  youthPrayerRequest: '',
  familyName: '',
  youthName: '',
};

/** Map ParsedRundown → overlay form fields (Parse hydrate / edit initial). */
export function fieldsFromParsed(
  parsed: ParsedRundown | null
): WorshipFormFields {
  // Song sets are weekly inputs owned by song_set_inputs (DEC-004), not
  // parsed_data overlays — parsed hydrate starts them empty and the edit form
  // fills them from the Service's own stored rows instead.
  return {
    songSets: {},
    verseReference: parsed?.verseReading?.reference ?? '',
    verseText: parsed?.verseReading?.text ?? '',
    verseTranslation: parsed?.verseReading?.translation ?? '',
    sermonSpeaker: parsed?.sermon?.speaker ?? '',
    specialSong: parsed?.specialSong ?? '',
    closingPrayerPerson: parsed?.closingPrayerPerson ?? '',
    familyPrayerRequest:
      parsed?.familyPrayerRequest ?? parsed?.familyYouth ?? '',
    youthPrayerRequest: parsed?.youthPrayerRequest ?? '',
    familyName: parsed?.familyName ?? '',
    youthName: parsed?.youthName ?? '',
  };
}

/** Build structured fields payload for preview / create / edit APIs. */
export function buildFieldsPayload(fields: WorshipFormFields) {
  const verseRef = fields.verseReference.trim();
  const verseBody = fields.verseText.trim();
  const verseTranslation = (fields.verseTranslation ?? '').trim().toUpperCase();
  return {
    verseReading:
      verseRef || verseBody
        ? {
            reference: verseRef || null,
            text: verseBody,
            ...(verseTranslation ? { translation: verseTranslation } : {}),
          }
        : null,
    familyPrayerRequest: (fields.familyPrayerRequest ?? '').trim() || null,
    youthPrayerRequest: (fields.youthPrayerRequest ?? '').trim() || null,
    familyName: (fields.familyName ?? '').trim() || null,
    youthName: (fields.youthName ?? '').trim() || null,
    sermon: (fields.sermonSpeaker ?? '').trim()
      ? { speaker: fields.sermonSpeaker.trim(), title: '' }
      : null,
    specialSong: (fields.specialSong ?? '').trim() || null,
    closingPrayerPerson: (fields.closingPrayerPerson ?? '').trim() || null,
    songSets: songSetsToPayload(fields.songSets ?? {}),
  };
}

/**
 * Form state → API shape for `fields.songSets`. Every rendered entry is sent,
 * including fully-cleared ones, so an upsert stores NULLs and a previously
 * saved number stops resolving (LC-12). A non-integer draft never becomes a
 * number — free text is not a hymn number.
 */
export function songSetsToPayload(
  inputs: SongSetInputs
): Record<
  string,
  {
    songNumber: number | null;
    songBookCode: string | null;
    background: string | null;
    lyricText: string | null;
  }
> {
  const out: ReturnType<typeof songSetsToPayload> = {};
  for (const [name, entry] of Object.entries(inputs)) {
    const trimmedName = name.trim();
    if (!trimmedName) continue;
    const raw = (entry?.songNumber ?? '').trim();
    out[trimmedName] = {
      songNumber: /^\d+$/.test(raw) ? Number(raw) : null,
      songBookCode: entry?.songBookCode.trim() || null,
      background: entry?.background.trim() || null,
      lyricText: entry?.lyricText.trim() || null,
    };
  }
  return out;
}

/** Display label for hymn inputs: `159 - O Worship the King`. */
export function formatHymnFieldDisplay(
  number: number | string,
  title: string
): string {
  const n = String(number).trim();
  const t = title.trim();
  if (!n) return t;
  if (!t) return n;
  return `${n} - ${t}`;
}

/**
 * Normalize autocomplete query so `159 - Title` still matches by number/title.
 * Returns lowercase search tokens (may be empty after trim).
 */
export function normalizeHymnFilterQuery(query: string): string {
  const raw = query.trim();
  if (!raw) return '';
  const dash = raw.match(/^(\d+)\s*[-–—]\s*(.*)$/);
  if (dash) {
    const titlePart = dash[2].trim();
    // Prefer title when present so typing after select still filters; else number.
    return (titlePart || dash[1]).toLowerCase();
  }
  return raw.toLowerCase();
}

/** Resolve display text for a stored number-only song field. */
export function hymnFieldDisplayValue(
  value: string,
  hymnIndex: HymnIndexEntry[]
): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return value;
  const hymn = hymnIndex.find((h) => String(h.number) === trimmed);
  if (!hymn) return value;
  return formatHymnFieldDisplay(hymn.number, hymn.title);
}

/**
 * Merge hymn entries from several sources (server seed, fetched search
 * results, user-picked) into one lookup. First occurrence of a number wins;
 * the result is sorted by number so dropdown order matches the server index.
 * Lets display labels survive without embedding the whole hymnal.
 */
export function mergeHymnIndexEntries(
  ...sources: readonly (readonly HymnIndexEntry[] | null | undefined)[]
): HymnIndexEntry[] {
  const byNumber = new Map<number, HymnIndexEntry>();
  for (const source of sources) {
    if (!source) continue;
    for (const entry of source) {
      // Same predicate as `coerceHymnIndexEntries`: a non-integer number can
      // never match `hymnFieldDisplayValue`'s `/^\d+$/` lookup, so admitting
      // one here would mint a permanently unresolvable dropdown row.
      if (!entry || !Number.isSafeInteger(entry.number)) continue;
      if (byNumber.has(entry.number)) continue;
      byNumber.set(entry.number, { number: entry.number, title: entry.title });
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

/** Coerce a `GET /api/hymns` body (or bare array) into hymn entries. */
export function coerceHymnIndexEntries(raw: unknown): HymnIndexEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? (raw as { hymns?: unknown }).hymns
      : null;
  if (!Array.isArray(list)) return [];
  const out: HymnIndexEntry[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { number?: unknown; title?: unknown };
    const number = Number(r.number);
    if (!Number.isSafeInteger(number)) continue;
    out.push({ number, title: typeof r.title === 'string' ? r.title : '' });
  }
  return out;
}

/** Client-side hymn index filter (number or title substring). */
export function filterHymnIndex(
  hymnIndex: HymnIndexEntry[],
  query: string,
  limit = 40
): HymnIndexEntry[] {
  const q = normalizeHymnFilterQuery(query);
  if (!q) return [];
  return hymnIndex
    .filter(
      (h) =>
        String(h.number).includes(q) || h.title.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

/** Outcome of settling a blurred hymn input draft. */
export type HymnDraftResolution =
  | { kind: 'commit'; value: string }
  | { kind: 'lookup'; query: string }
  | { kind: 'keep' };

/**
 * Decide what a blurred hymn draft writes into a hymn number input. Pure, so
 * the failure branches are unit-testable without a DOM.
 *
 * `fetched` carries the state of the `/api/hymns` title lookup:
 * - `undefined` — not attempted yet; a free-text draft answers
 *   `{ kind: 'lookup' }` with the query the caller must run.
 * - an array — the rows the server returned (possibly empty).
 * - `null` — the lookup **failed** (non-2xx, offline, expired session). A
 *   failed lookup proves nothing: it can neither establish a unique match nor
 *   rule one out, so the answer is `keep` — the draft stays on screen and the
 *   stored value is untouched. Deciding from the local seed instead would
 *   silently commit the wrong hymn (the seed's only local match) or erase what
 *   the operator typed (no local match at all), exactly when the network is
 *   unreliable.
 */
export function resolveHymnDraft({
  draft,
  value,
  entries,
  fetched,
}: {
  draft: string;
  /** Currently stored field value, used as the fallback when nothing matches. */
  value: string;
  /** Hymns already known locally (server seed + this session's learned rows). */
  entries: readonly HymnIndexEntry[];
  fetched?: readonly HymnIndexEntry[] | null;
}): HymnDraftResolution {
  const trimmed = draft.trim();
  if (!trimmed) return { kind: 'commit', value: '' };
  const dash = trimmed.match(/^(\d+)\s*[-–—]\s*/);
  if (dash) return { kind: 'commit', value: dash[1] };
  if (/^\d+$/.test(trimmed)) return { kind: 'commit', value: trimmed };

  const query = normalizeHymnFilterQuery(trimmed);
  if (!query) return { kind: 'commit', value: '' };
  if (fetched === undefined) return { kind: 'lookup', query };
  if (fetched === null) return { kind: 'keep' };

  // Free-text title: accept only a unique match (song*Number is number-only).
  const matches = filterHymnIndex(
    mergeHymnIndexEntries(entries, fetched),
    trimmed,
    2
  );
  if (matches.length === 1) {
    return { kind: 'commit', value: String(matches[0].number) };
  }
  // Ambiguous / no match: keep the stored number, never leak letters into it.
  const current = value.trim();
  return { kind: 'commit', value: /^\d+$/.test(current) ? current : '' };
}

/** Coerce one stored song-set entry (unknown-safe) into form state. */
export function coerceSongSetEntry(raw: unknown): SongSetEntryInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_SONG_SET_ENTRY };
  }
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const number = o.songNumber;
  return {
    songNumber:
      typeof number === 'number' && Number.isSafeInteger(number)
        ? String(number)
        : str(number),
    songBookCode: str(o.songBookCode),
    background: str(o.background),
    lyricText: str(o.lyricText),
  };
}

/** Coerce a `songSets` map (unknown-safe) into form state, keyed by variableName. */
export function coerceSongSetInputs(raw: unknown): SongSetInputs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SongSetInputs = {};
  for (const [name, value] of Object.entries(
    raw as Record<string, unknown>
  )) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    out[trimmed] = coerceSongSetEntry(value);
  }
  return out;
}

/** Coerce API hydrate object into WorshipFormFields (unknown-safe). */
export function coerceHydrateFields(raw: unknown): WorshipFormFields | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    songSets: coerceSongSetInputs(o.songSets),
    verseReference: str(o.verseReference),
    verseText: str(o.verseText),
    verseTranslation: str(o.verseTranslation),
    sermonSpeaker: str(o.sermonSpeaker),
    specialSong: str(o.specialSong),
    closingPrayerPerson: str(o.closingPrayerPerson),
    familyPrayerRequest: str(o.familyPrayerRequest),
    youthPrayerRequest: str(o.youthPrayerRequest),
    familyName: str(o.familyName),
    youthName: str(o.youthName),
  };
}

export function shouldClosingPrayerCheckboxStartChecked(
  speaker: string | null | undefined,
  closing: string | null | undefined
): boolean {
  const s = (speaker ?? '').trim();
  const c = (closing ?? '').trim();
  if (!s || !c) return false;
  return s === c;
}
