import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import OperatorPageShell from '@/components/OperatorPageShell';
import { NavigationBlockerProvider } from '@/components/navigation-blocker';
import { useSession } from '../lib/auth/SessionProvider';

/**
 * Shared chrome for every operator page.
 *
 * Mounted as a React Router layout route (`<Route element={<OperatorShell />}>`)
 * so Header and the page shell survive navigation between operator pages. Only
 * `<Outlet />` (the page content) re-renders on a route change.
 *
 * Session is read from context, so this component renders nothing until the
 * SessionProvider resolves. That is a single shared fetch across the whole
 * tree; pages no longer gate on session themselves.
 *
 * `NavigationBlockerProvider` is mounted here — the narrowest layout covering
 * both of its consumers: Header (above) reads `isBlocked` to decide whether to
 * confirm a navigation, and the artifact editor (below via `<Outlet />`) writes
 * it when its canvas is dirty. Pages that do not touch it read the default
 * (`isBlocked: false`) and behave exactly as before.
 *
 * `innerClassName="max-w-6xl"` widens the default `max-w-5xl` because the
 * artifact editor's table wants the extra room. Other pages render their own
 * internal spacing (e.g. `<div className="space-y-8">`) inside this shell.
 */
export default function OperatorShell() {
  const { session, status, isOffline } = useSession();
  const loc = useLocation();
  if (status !== 'authed' || !session) return null;

  const isWide = loc.pathname === '/new';

  return (
    <NavigationBlockerProvider>
      <OperatorPageShell innerClassName={isWide ? 'max-w-[1700px] w-full' : 'max-w-6xl'}>
        <Header isAdmin={session.role === 'admin'} username={session.username} isOffline={isOffline} />
        {isOffline && (
          <div
            data-testid="offline-session-banner"
            role="status"
            className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Offline — Menjalankan sesi lokal tersimpan</span>
            </div>
            <span className="text-[11px] opacity-75">Tindakan server dibatasi</span>
          </div>
        )}
        <Outlet />
      </OperatorPageShell>
    </NavigationBlockerProvider>
  );
}
