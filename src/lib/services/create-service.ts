/**
 * Service creation: parse, structured overlay, collision policy, and the
 * INSERT + announcement sync transaction.
 */
import type Database from 'better-sqlite3';
import { parseRundown } from '@/lib/parser';
import {
  applyStructuredFields,
  normalizeParsedRundown,
} from '@/lib/parsed-fields';
import { STAMP_NOW_SQL } from '@/lib/db/stamp';
import { cloneRegistryToNewService } from '@/lib/registry/service-snapshot';
import type { CreateServiceInput, CreateServiceResult } from './types';

/**
 * Create a service from an already narrowed body.
 *
 * Sequence is load-bearing: parse and payload validation precede the
 * date-collision check, which runs inside the same transaction as INSERT.
 */
export function createService(
  db: Database.Database,
  input: CreateServiceInput
): CreateServiceResult {
  let parsedData = parseRundown(input.rawPayload);
  if (!parsedData.date) {
    return {
      ok: false,
      kind: 'validation',
      message: 'Could not parse service date from raw_payload',
    };
  }
  const serviceDate = parsedData.date;

  if (!input.payload.ok) return input.payload;
  const payload = input.payload.value;

  if (input.structured) {
    parsedData = applyStructuredFields(parsedData, input.structured);
  }
  parsedData = normalizeParsedRundown(parsedData);

  const parsedJson = JSON.stringify(parsedData);
  const imagesJson = JSON.stringify(payload.imagesPayload);

  class DateCollision extends Error {
    existingId: number;
    date: string;
    constructor(existingId: number, date: string) {
      super('collision');
      this.existingId = existingId;
      this.date = date;
    }
  }

  let serviceId = 0;
  try {
    const commit = db.transaction(() => {
      const existing = db
        .prepare<[string], { id: number }>(
          'SELECT id FROM services WHERE date = ?'
        )
        .get(serviceDate);
      if (existing && !input.allowSecond) {
        throw new DateCollision(existing.id, serviceDate);
      }
      const afternoonProgram = parsedData.afternoonProgram || '';
      const result = db
        .prepare<[string, string, string, string, string | null, string]>(
          `INSERT INTO services
             (date, raw_payload, parsed_data, images_payload, participants_payload, afternoon_program, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ${STAMP_NOW_SQL})`
        )
        .run(
          serviceDate,
          input.rawPayload,
          parsedJson,
          imagesJson,
          payload.participantsRaw,
          afternoonProgram
        );
      serviceId = Number(result.lastInsertRowid);

      // Announcements master list write path is retired (DEC-004 / Story 4)
      cloneRegistryToNewService(db, serviceId);
    });
    commit();
  } catch (err) {
    if (err instanceof DateCollision) {
      return {
        ok: false,
        kind: 'collision',
        existingId: err.existingId,
        date: err.date,
      };
    }
    throw err;
  }

  return {
    ok: true,
    id: serviceId,
    date: serviceDate,
    failedHymnNumbers: parsedData.failedHymnNumbers,
  };
}
