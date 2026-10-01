import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AccountsManager from '@/operator/admin/AccountsManager';
import WorshipSettings from '@/operator/admin/WorshipSettings';
import SystemSettings from '@/operator/admin/SystemSettings';
import OneDriveConnectorCard from '@/components/settings/OneDriveConnectorCard';
import { useSession } from '../lib/auth/SessionProvider';

export default function AdminPage() {
  const { session } = useSession();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || session.role !== 'admin') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const acc = await fetch('/api/admin/accounts', { credentials: 'same-origin' });
        const accData = ((await acc.json()) as { accounts: any[] }).accounts || [];
        const st = await fetch('/api/admin/settings', { credentials: 'same-origin' });
        const stData = await st.json();
        if (cancelled) return;
        setAccounts(accData);
        setSettings(stData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) return null;
  if (session.role !== 'admin') return <Navigate to="/" replace />;
  if (loading || !settings) {
    return (
      <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading admin settings">
        <div className="h-64 rounded-xl bg-muted/60" />
        <div className="h-48 rounded-xl bg-muted/60" />
        <div className="h-48 rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AccountsManager initialAccounts={accounts} />
      <WorshipSettings
        initialTransition={settings.slide_transition}
        initialBibleCode={settings.default_bible_translation}
        initialBibleInstalled={Boolean(settings.default_bible_translation_installed)}
      />
      <SystemSettings
        initialDays={settings.pptx_retention_days}
        initialLocale={settings.ui_locale}
      />
      <OneDriveConnectorCard />
    </div>
  );
}
