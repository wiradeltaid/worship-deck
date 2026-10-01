import fs from 'fs';
import path from 'path';

/** Allowed image extensions for hub-local uploads and announcement refs. */
export const UPLOAD_IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

/**
 * `/api/uploads/<hash>.<ext>` produced by POST /api/upload.
 * Supports discrete dual-hash: 32-hex legacy random tokens or 64-hex SHA-256 digests (DEC-080).
 */
export const LOCAL_UPLOAD_REF =
  /^\/api\/uploads\/((?:[a-f0-9]{32}|[a-f0-9]{64})\.(?:jpe?g|png|gif|webp))$/i;

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'data', 'uploads');
}

/** True for same-origin local upload refs stored after hub file upload. */
export function isLocalUploadRef(ref: string): boolean {
  return LOCAL_UPLOAD_REF.test(ref.trim());
}

/** Filename segment if `ref` is a safe local upload path; otherwise null. */
export function localUploadFilename(ref: string): string | null {
  const m = ref.trim().match(LOCAL_UPLOAD_REF);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Absolute filesystem path for a local upload ref, or null if missing/unsafe.
 * Ensures the resolved path stays under the uploads directory.
 */
export function resolveLocalUploadFsPath(ref: string): string | null {
  const filename = localUploadFilename(ref);
  if (!filename) return null;

  const uploadsDir = path.resolve(getUploadsDir());
  const filePath = path.resolve(uploadsDir, filename);
  const rel = path.relative(uploadsDir, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return filePath;
}

/** Normalize a client filename extension to an allowed image ext, or null. */
export function normalizeUploadExtension(name: string): string | null {
  const ext = path.extname(name || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return ext === '.jpeg' ? '.jpeg' : '.jpg';
  if (ext === '.png' || ext === '.gif' || ext === '.webp') return ext;
  return null;
}

export function ensureUploadsDir(): string {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
