/**
 * Session storage persistence and offline cache helpers.
 *
 * Provides shared access to the last verified session record in sessionStorage,
 * ensuring consistent cache removal across SessionProvider, ProjectorPage, and LogoutButton.
 */

import { clearOfflineStorage } from '@/lib/offline/service-snapshot';

export const LAST_SESSION_STORAGE_KEY = 'worship_deck_last_session';

export type StoredSession = {
  username: string;
  role: 'admin' | 'operator';
};

/**
 * Purges cached session identity from sessionStorage.
 */
export function clearCachedSession(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(LAST_SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage access issues
  }
}

/**
 * Invalidates authenticated session and purges all offline storage (snapshots, media blobs, outbox).
 * Used across SessionProvider, RunSheetPage, PresentPage, and ProjectorPage upon 401/403 responses.
 */
export async function invalidateAuthAndPurgeOffline(): Promise<void> {
  clearCachedSession();
  try {
    await clearOfflineStorage();
  } catch {
    // ignore offline purge errors
  }
}

/**
 * Retrieves the cached session identity if valid.
 */
export function getCachedSession(): StoredSession | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(LAST_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.username === 'string' &&
          (parsed.role === 'admin' || parsed.role === 'operator')
        ) {
          return parsed as StoredSession;
        }
      }
    }
  } catch {
    // ignore parsing error
  }
  return null;
}

/**
 * Caches verified session identity in sessionStorage.
 */
export function setCachedSession(session: StoredSession): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage quota issues
  }
}

/**
 * Resolves session status from cached storage on network failure.
 */
export function resolveOfflineSessionState(): {
  status: 'authed' | 'unauthed';
  session: StoredSession | null;
  isOffline: true;
} {
  const cached = getCachedSession();
  if (cached) {
    return { status: 'authed', session: cached, isOffline: true };
  }
  return { status: 'unauthed', session: null, isOffline: true };
}

export type RevalidationResult =
  | { status: 'authed'; session: StoredSession }
  | { status: 'unauthed' }
  | { status: 'offline' };

/**
 * Revalidates session when network connectivity transitions online.
 * Returns atomic result without prematurely mutating sessionStorage, allowing
 * consumers to verify sequence validity before applying storage changes.
 */
export async function revalidateSessionOnline({
  fetchFn = fetch,
}: {
  fetchFn?: typeof fetch;
} = {}): Promise<RevalidationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetchFn('/api/session', {
      credentials: 'same-origin',
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      clearTimeout(timeoutId);
      return { status: 'unauthed' };
    }

    if (res.ok) {
      const body = (await res.json().catch(() => null)) as StoredSession | null;
      clearTimeout(timeoutId);
      if (
        body &&
        typeof body.username === 'string' &&
        (body.role === 'admin' || body.role === 'operator')
      ) {
        return { status: 'authed', session: body };
      }
    }

    clearTimeout(timeoutId);
    // Non-OK response or invalid body: fail-closed to offline
    return { status: 'offline' };
  } catch {
    clearTimeout(timeoutId);
    // Fetch threw or timed out: fail-closed to offline
    return { status: 'offline' };
  }
}

/**
 * Submits a password change request with defensive offline protection.
 */
export async function submitPasswordChange({
  currentPassword,
  newPassword,
  isOffline,
  fetchFn = fetch,
}: {
  currentPassword: string;
  newPassword: string;
  isOffline?: boolean;
  fetchFn?: typeof fetch;
}): Promise<{ ok: boolean; error?: string }> {
  if (isOffline) {
    return { ok: false, error: 'Tindakan server dinonaktifkan saat offline' };
  }
  const res = await fetchFn('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || 'Password change failed' };
  }
  return { ok: true };
}
