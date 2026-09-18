/**
 * Shared vocabulary for the service domain: row shapes, narrowed request
 * inputs, and the discriminated results the route handlers map to HTTP.
 *
 * Route handlers must never re-declare a row shape or re-narrow a body.
 */
import type { StructuredServiceFields } from '@/lib/parsed-fields';

/** Row shape returned by the list/search SELECT (`updated_at` already coalesced). */
export type ServiceRow = {
  id: number;
  date: string;
  raw_payload: string;
  parsed_data: string | null;
  created_at: string;
  updated_at: string;
};

/** Row shape the update path reads before writing. */
export type ServiceDetailRow = {
  raw_payload: string;
  parsed_data: string | null;
  images_payload: string | null;
  participants_payload: string | null;
  date: string;
  created_at: string;
  updated_at: string | null;
};

/** Minimal row used for optimistic-concurrency timestamp reads. */
export type ServiceTimestampsRow = {
  created_at: string;
  updated_at: string | null;
};

/** DTO emitted by `GET /api/services`. */
export type ServiceListItem = {
  id: number;
  date: string;
  created_at: string;
  updated_at: string;
  raw_payload: string;
  /** Tolerant `JSON.parse` of `parsed_data`; `null` when absent or corrupt. */
  parsed_data: unknown;
};

/** Stored `images_payload` object form. */
export type ServiceImagesPayload = {
  images: string[];
  sermonGraphicUrl: string | null;
  familyPhotoUrl: string | null;
  youthPhotoUrl: string | null;
  announcementInserts?: string[];
};

/** Presence-tagged optional field, so "absent" is distinct from "set to null". */
export type FieldPatch<T> = { present: false } | { present: true; value: T };

export const ABSENT: { present: false } = { present: false };

/** A body-level validation failure carrying the exact message the route emits. */
export type ValidationFailure = {
  ok: false;
  kind: 'validation';
  message: string;
};

/** Result of narrowing an `unknown` request body. */
export type Narrowed<T> = { ok: true; value: T } | ValidationFailure;

export function validationFailure(message: string): ValidationFailure {
  return { ok: false, kind: 'validation', message };
}

/**
 * Create-body fields whose validation the legacy handler ran *after* the
 * "could not parse service date" check. Carried as a `Narrowed<…>` so
 * `createService` can surface the failure at exactly that point.
 */
export type CreateServicePayload = {
  imagesPayload: ServiceImagesPayload;
  participantsRaw: string | null;
};

export type CreateServiceInput = {
  rawPayload: string;
  structured: StructuredServiceFields | null;
  clearMaster: boolean;
  allowSecond: boolean;
  payload: Narrowed<CreateServicePayload>;
};

/** Merge-or-keep image patch: `any` is false when the body omits all four keys. */
export type UpdateImagesPatch = {
  any: boolean;
  urls: FieldPatch<string[]>;
  sermonGraphicUrl: FieldPatch<string | null>;
  familyPhotoUrl: FieldPatch<string | null>;
  youthPhotoUrl: FieldPatch<string | null>;
};

/**
 * Update-body fields whose validation the legacy handler ran *after* the
 * existence (404) and staleness (409) gates.
 */
export type UpdateServicePayload = {
  images: UpdateImagesPatch;
  participants: FieldPatch<string | null>;
};

export type UpdateServiceInput = {
  /** Client-supplied `updated_at`, trimmed. */
  updatedAt: string;
  /** `null` when the body omits `raw_payload` or sends an empty string. */
  rawPayload: string | null;
  structured: StructuredServiceFields | null;
  clearMaster: boolean;
  payload: Narrowed<UpdateServicePayload>;
};

export type CreateServiceResult =
  | { ok: true; id: number; date: string; failedHymnNumbers: number[] }
  | ValidationFailure
  | { ok: false; kind: 'collision'; existingId: number; date: string };

export type UpdateServiceResult =
  | { ok: true; failedHymnNumbers: number[]; updatedAt: string }
  | ValidationFailure
  | { ok: false; kind: 'not-found' }
  | { ok: false; kind: 'conflict'; updatedAt: string };
