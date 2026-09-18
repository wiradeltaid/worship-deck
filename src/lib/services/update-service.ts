/**
 * Service update: existence + optimistic-concurrency gates, merge-or-keep
 * image payload, re-parse or re-normalize, and one guarded UPDATE.
 */
import type Database from 'better-sqlite3';
import { parseImagesPayloadJson } from '@/lib/images';
import { parseRundown } from '@/lib/parser';
import type { ParsedRundown } from '@/lib/parser';
import {
  applyStructuredFields,
  normalizeParsedRundown,
} from '@/lib/parsed-fields';
import { STAMP_NOW_SQL } from '@/lib/db/stamp';
import { readUpdatedAt } from './queries';
import type {
  ServiceDetailRow,
  ServiceImagesPayload,
  ServiceTimestampsRow,
  UpdateServiceInput,
  UpdateServiceResult,
} from './types';

const TIMESTAMPS_SQL = 'SELECT created_at, updated_at FROM services WHERE id = ?';

/**
 * Private sentinel thrown inside the write transaction when the guarded UPDATE
 * matches no row, so better-sqlite3 issues a ROLLBACK instead of committing.
 *
 * Returning a status out of the transaction callback would COMMIT, which is
 * only harmless while the guard happens to be the first statement; the sentinel
 * keeps the conflict path structurally non-committing whatever is added later.
 * It never escapes this module — `updateService` maps it to the 409 result.
 */
class StaleWriteError extends Error {
  constructor() {
    super('services: guarded UPDATE matched no row');
    this.name = 'StaleWriteError';
  }
}

/** Re-hydrate the stored rundown, falling back to a fresh parse of the raw text. */
function reparseStored(row: ServiceDetailRow): ParsedRundown {
  if (row.parsed_data) {
    try {
      return normalizeParsedRundown(JSON.parse(row.parsed_data) as ParsedRundown);
    } catch {
      // Corrupt stored JSON — fall through to a fresh parse.
    }
  }
  return parseRundown(row.raw_payload);
}

/**
 * Update a service from an already narrowed body.
 *
 * Sequence is load-bearing: the 404 and 409 gates precede the deferred image /
 * announcements / participants validation, exactly as the original handler did.
 * The `updated_at` guard is re-asserted inside the UPDATE's `WHERE` clause so a
 * write that races the pre-check still loses.
 */
export function updateService(
  db: Database.Database,
  serviceId: number,
  input: UpdateServiceInput
): UpdateServiceResult {
  const existing = db
    .prepare<[number], ServiceDetailRow>(
      `SELECT raw_payload, parsed_data, images_payload, participants_payload,
                date, created_at, updated_at
         FROM services WHERE id = ?`
    )
    .get(serviceId);

  if (!existing) return { ok: false, kind: 'not-found' };

  const currentUpdatedAt = readUpdatedAt(existing);
  if (input.updatedAt !== currentUpdatedAt) {
    return { ok: false, kind: 'conflict', updatedAt: currentUpdatedAt };
  }

  if (!input.payload.ok) return input.payload;
  const payload = input.payload.value;

  let imagesPayload: ServiceImagesPayload | null = null;
  if (payload.images.any) {
    const stored = parseImagesPayloadJson(existing.images_payload);
    const { urls, sermonGraphicUrl, familyPhotoUrl, youthPhotoUrl } =
      payload.images;
    imagesPayload = {
      images: urls.present ? urls.value : stored.urls,
      sermonGraphicUrl: sermonGraphicUrl.present
        ? sermonGraphicUrl.value
        : stored.sermonGraphicUrl,
      familyPhotoUrl: familyPhotoUrl.present
        ? familyPhotoUrl.value
        : stored.familyPhotoUrl,
      youthPhotoUrl: youthPhotoUrl.present
        ? youthPhotoUrl.value
        : stored.youthPhotoUrl,
    };
  }

  const participantsPayload = payload.participants.present
    ? payload.participants.value
    : existing.participants_payload;

  const storedRaw = input.rawPayload ?? existing.raw_payload;
  // Companion: re-parse (when raw changed) then always overlay structured fields.
  let parsedData =
    input.rawPayload !== null ? parseRundown(storedRaw) : reparseStored(existing);
  if (input.structured) {
    parsedData = applyStructuredFields(parsedData, input.structured);
  }
  parsedData = normalizeParsedRundown(parsedData);

  const newDate = parsedData.date;
  const assignments: string[] = [];
  const params: Array<string | number | null> = [];

  if (newDate) {
    assignments.push('date = ?');
    params.push(newDate);
  }
  assignments.push('raw_payload = ?');
  params.push(storedRaw);
  assignments.push('parsed_data = ?');
  params.push(JSON.stringify(parsedData));
  if (imagesPayload !== null) {
    assignments.push('images_payload = ?');
    params.push(JSON.stringify(imagesPayload));
  }
  assignments.push('participants_payload = ?');
  params.push(participantsPayload);
  assignments.push(`updated_at = ${STAMP_NOW_SQL}`);
  params.push(serviceId, currentUpdatedAt);

  const sql = `UPDATE services
             SET ${assignments.join(', ')}
             WHERE id = ? AND COALESCE(updated_at, created_at) = ?`;

  const commit = db.transaction((): void => {
    const result = db
      .prepare<Array<string | number | null>>(sql)
      .run(...params);
    if (result.changes === 0) throw new StaleWriteError();
  });

  let stale = false;
  try {
    commit();
  } catch (error) {
    if (!(error instanceof StaleWriteError)) throw error;
    stale = true;
  }

  if (stale) {
    const again = db
      .prepare<[number], ServiceTimestampsRow>(TIMESTAMPS_SQL)
      .get(serviceId);
    if (!again) return { ok: false, kind: 'not-found' };
    return { ok: false, kind: 'conflict', updatedAt: readUpdatedAt(again) };
  }

  const after = db
    .prepare<[number], ServiceTimestampsRow>(TIMESTAMPS_SQL)
    .get(serviceId);
  if (!after) return { ok: false, kind: 'not-found' };

  return {
    ok: true,
    failedHymnNumbers: parsedData.failedHymnNumbers,
    updatedAt: readUpdatedAt(after),
  };
}
