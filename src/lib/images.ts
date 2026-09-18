import { isLocalUploadRef } from './uploads';

/** Coerce unknown JSON into a list of safe image URL / local upload refs. */
export function coerceImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && isSafeImageUrl(x));
}

export type ImagesPayloadExtras = {
  urls: string[];
  sermonGraphicUrl: string | null;
  familyPhotoUrl: string | null;
  youthPhotoUrl: string | null;
  announcementInserts: string[];
};

/**
 * Parse legacy array images_payload or object form:
 * `{ images?: string[], sermonGraphicUrl?, familyPhotoUrl?, youthPhotoUrl?, announcementInserts? }`.
 */
export function parseImagesPayload(
  value: unknown
): ImagesPayloadExtras {
  const empty: ImagesPayloadExtras = {
    urls: [],
    sermonGraphicUrl: null,
    familyPhotoUrl: null,
    youthPhotoUrl: null,
    announcementInserts: [],
  };
  if (value == null) return empty;
  if (Array.isArray(value)) {
    return { ...empty, urls: coerceImageUrls(value) };
  }
  if (typeof value !== 'object') return empty;
  const obj = value as Record<string, unknown>;
  const urls = coerceImageUrls(
    Array.isArray(obj.images)
      ? obj.images
      : Array.isArray(obj.flyers)
        ? obj.flyers
        : []
  );
  const sermonRaw = obj.sermonGraphicUrl;
  const familyRaw = obj.familyPhotoUrl;
  const youthRaw = obj.youthPhotoUrl;
  const insertsRaw = obj.announcementInserts;
  const announcementInserts: string[] = Array.isArray(insertsRaw)
    ? insertsRaw.map((x) => (typeof x === 'string' && isSafeImageUrl(x) ? x.trim() : ''))
    : [];
  return {
    urls,
    sermonGraphicUrl:
      typeof sermonRaw === 'string' && isSafeImageUrl(sermonRaw)
        ? sermonRaw
        : null,
    familyPhotoUrl:
      typeof familyRaw === 'string' && isSafeImageUrl(familyRaw)
        ? familyRaw
        : null,
    youthPhotoUrl:
      typeof youthRaw === 'string' && isSafeImageUrl(youthRaw)
        ? youthRaw
        : null,
    announcementInserts,
  };
}

export function parseImagesPayloadJson(
  json: string | null | undefined
): ImagesPayloadExtras {
  if (!json) {
    return {
      urls: [],
      sermonGraphicUrl: null,
      familyPhotoUrl: null,
      youthPhotoUrl: null,
      announcementInserts: ['', '', '', ''],
    };
  }
  try {
    return parseImagesPayload(JSON.parse(json));
  } catch {
    return {
      urls: [],
      sermonGraphicUrl: null,
      familyPhotoUrl: null,
      youthPhotoUrl: null,
      announcementInserts: ['', '', '', ''],
    };
  }
}

function allowlistHosts(): string[] | null {
  const raw = process.env.IMAGE_URL_ALLOWLIST?.trim();
  if (!raw) return null;
  const hosts = raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.length > 0 ? hosts : null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function isPrivateOrLocalIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  // 0.0.0.0/8
  if (n <= 0x00ffffff) return true;
  // 10.0.0.0/8
  if (n >= 0x0a000000 && n <= 0x0affffff) return true;
  // 127.0.0.0/8
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true;
  // 169.254.0.0/16 (link-local + cloud metadata)
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true;
  // 172.16.0.0/12
  if (n >= 0xac100000 && n <= 0xac1fffff) return true;
  // 192.168.0.0/16
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true;
  return false;
}

function isPrivateOrLocalIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === '::1' || h === '::') return true;
  // Unique local fc00::/7, link-local fe80::/10
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true;
  }
  // IPv4-mapped :ffff:x.x.x.x
  const mapped = h.match(/:ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateOrLocalIpv4(mapped[1]);
  return false;
}

/** True when hostname is localhost / private / link-local / metadata-like. */
export function isBlockedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'metadata' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return true;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return isPrivateOrLocalIpv4(host);
  }
  if (host.includes(':')) {
    return isPrivateOrLocalIpv6(host);
  }
  return false;
}

/**
 * Safe announcement/PPTX image URL:
 * - Hub-local upload refs: `/api/uploads/<32-hex>.(jpg|jpeg|png|gif|webp)`
 * - Otherwise http(s) only
 * - If IMAGE_URL_ALLOWLIST is set (comma-separated hostnames), host must match
 * - Otherwise block localhost / private / link-local / metadata hosts
 */
export function isSafeImageUrl(ref: string): boolean {
  if (typeof ref !== 'string' || !ref.trim()) return false;
  if (isLocalUploadRef(ref)) return true;
  try {
    const u = new URL(ref.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    const allow = allowlistHosts();
    if (allow) {
      return allow.includes(host);
    }
    return !isBlockedImageHost(host);
  } catch {
    return false;
  }
}

const IMAGE_PATH_EXT = /\.(jpe?g|png|gif|webp)(?:[?#]|$)/i;

/**
 * Coerce an optional image URL field.
 * - undefined → field omitted (keep existing)
 * - null / '' → clear
 * - unsafe / non-image non-empty string → throws Error (caller maps to 400)
 */
export function coerceOptionalSafeImageUrl(
  value: unknown,
  field: string
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isSafeImageUrl(trimmed)) {
    throw new Error(`${field} is not a safe image URL`);
  }
  // Hub-local uploads already validated by isLocalUploadRef path inside isSafeImageUrl
  if (trimmed.startsWith('/')) {
    if (!IMAGE_PATH_EXT.test(trimmed.split(/[?#]/, 1)[0])) {
      throw new Error(
        `${field} must end with an image extension (.jpg, .jpeg, .png, .gif, or .webp)`
      );
    }
    return trimmed;
  }
  try {
    const path = new URL(trimmed).pathname;
    if (!IMAGE_PATH_EXT.test(path)) {
      throw new Error(
        `${field} must end with an image extension (.jpg, .jpeg, .png, .gif, or .webp)`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(`${field} must`)) throw e;
    throw new Error(`${field} is not a valid URL`);
  }
  return trimmed;
}

/** Local calendar YYYY-MM-DD (avoids UTC day-shift from toISOString). */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
