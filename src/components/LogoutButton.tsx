import { useT } from '@/lib/i18n/operator';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { clearCachedSession } from '@/lib/auth-session';
import { clearOfflineStorage } from '@/lib/offline/service-snapshot';

export default function LogoutButton({
  variant = 'button',
}: {
  variant?: 'button' | 'menu';
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    clearCachedSession();
    try {
      // Bounded 1s timeout for offline storage purge so hanging IndexedDB never blocks navigation
      await Promise.race([
        clearOfflineStorage(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]).catch(() => {});

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Ignore network failures or timeouts during logout
    } finally {
      // Unconditionally navigate to /login to clear in-memory auth state even on offline dropouts
      window.location.assign('/login');
    }
  };

  if (variant === 'menu') {
    return (
      <DropdownMenuItem
        variant="destructive"
        disabled={busy}
        onClick={() => void logout()}
      >
        <LogOut className="size-4" />
        {busy ? t('chrome.logout.busy') : t('chrome.logout')}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="shrink-0 gap-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={logout}
      disabled={busy}
    >
      <LogOut className="size-4" />
      {busy ? t('chrome.logout.busy') : t('chrome.logout')}
    </Button>
  );
}
