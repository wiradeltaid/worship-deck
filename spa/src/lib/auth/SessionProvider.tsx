import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  clearCachedSession,
  getCachedSession,
  LAST_SESSION_STORAGE_KEY,
  resolveOfflineSessionState,
  revalidateSessionOnline,
  setCachedSession,
  type StoredSession,
} from '@/lib/auth-session';

export type Session = StoredSession;

export type SessionStatus = 'loading' | 'authed' | 'unauthed';

export type SessionContextValue = {
  session: Session | null;
  status: SessionStatus;
  isOffline: boolean;
};

export {
  clearCachedSession,
  getCachedSession,
  LAST_SESSION_STORAGE_KEY,
  resolveOfflineSessionState,
  revalidateSessionOnline,
  setCachedSession,
};

const Ctx = createContext<SessionContextValue | null>(null);

/**
 * One shared `/api/session` fetch for the whole operator tree with offline resilience.
 *
 * Distinguishes between HTTP 401 Unauthorized (invalid/expired credentials -> clears
 * cached session identity and navigates to /login) and network-level failures
 * (transient outages, timeouts, TypeError: Failed to fetch, 5xx server errors).
 *
 * Includes an explicit 5-second AbortController timeout to guarantee dead or hanging
 * venue Wi-Fi connections gracefully fall back to cached session state rather than
 * blocking indefinitely.
 *
 * On network failure, if a previously verified session exists in sessionStorage,
 * the session remains active with `isOffline: true`, preventing disruptive
 * ejections from the Run Sheet or Presenter during services.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [isOffline, setIsOffline] = useState(false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Real-time network connectivity transition listeners with active API revalidation
  const revalidationSeqRef = useRef(0);

  useEffect(() => {
    let unmounted = false;
    const handleOffline = () => {
      revalidationSeqRef.current++;
      setIsOffline(true);
      setStatus((prev) => {
        if (prev === 'loading') {
          const fallback = resolveOfflineSessionState();
          setSession(fallback.session);
          return fallback.status;
        }
        return prev;
      });
    };

    const handleOnline = async () => {
      const currentSeq = ++revalidationSeqRef.current;
      // Defensively verify the WorshipDeck API is actually reachable before clearing isOffline,
      // preventing fail-open mutations on captive portals or partial Wi-Fi reconnects.
      const result = await revalidateSessionOnline();
      if (unmounted || currentSeq !== revalidationSeqRef.current) return;

      if (result.status === 'authed') {
        setCachedSession(result.session);
        setSession(result.session);
        setStatus('authed');
        setIsOffline(false);
      } else if (result.status === 'unauthed') {
        clearCachedSession();
        setSession(null);
        setStatus('unauthed');
        setIsOffline(false);
        navigateRef.current('/login', { replace: true });
      } else {
        // Explicit fail-closed: if revalidation failed or timed out, remain or become offline
        setIsOffline(true);
        setStatus((prev) => {
          if (prev === 'loading') {
            const fallback = resolveOfflineSessionState();
            setSession(fallback.session);
            return fallback.status;
          }
          return prev;
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    return () => {
      unmounted = true;
      revalidationSeqRef.current++;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialSeq = ++revalidationSeqRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Session request timed out'));
    }, 5000);

    (async () => {
      try {
        const res = await fetch('/api/session', {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (cancelled || initialSeq !== revalidationSeqRef.current) return;

        if (res.status === 401 || res.status === 403) {
          clearTimeout(timeoutId);
          clearCachedSession();
          setSession(null);
          setStatus('unauthed');
          setIsOffline(false);
          navigateRef.current('/login', { replace: true });
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const body = (await res.json().catch(() => null)) as Session | null;
        clearTimeout(timeoutId);
        if (cancelled || initialSeq !== revalidationSeqRef.current) return;

        if (body && typeof body.username === 'string' && (body.role === 'admin' || body.role === 'operator')) {
          setCachedSession(body);
          setSession(body);
          setStatus('authed');
          setIsOffline(false);
        } else {
          clearCachedSession();
          setStatus('unauthed');
          setIsOffline(false);
          navigateRef.current('/login', { replace: true });
        }
      } catch (_err) {
        clearTimeout(timeoutId);
        if (cancelled || initialSeq !== revalidationSeqRef.current) return;
        // Network failure / offline / timeout / server error: fall back to cached session
        const fallback = resolveOfflineSessionState();
        setSession(fallback.session);
        setStatus(fallback.status);
        setIsOffline(true);
      }
    })();

    return () => {
      cancelled = true;
      revalidationSeqRef.current++;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  if (status === 'unauthed' && isOffline && !session) {
    return (
      <div
        data-testid="offline-no-session-error"
        className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-foreground"
      >
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold">Jaringan Tidak Terhubung</h2>
          <p className="text-sm text-muted-foreground">
            Tidak dapat terhubung ke server WorshipDeck dan tidak ada sesi lokal yang tersimpan.
            Periksa koneksi jaringan Anda atau hubungkan ke Wi-Fi gereja lalu coba lagi.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Coba Hubungkan Ulang
            </button>
            <button
              type="button"
              onClick={() => navigateRef.current('/login')}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Ke Halaman Masuk
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={{ session, status, isOffline }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return ctx;
}
