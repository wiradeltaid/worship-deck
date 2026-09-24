import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeNextPath } from '@/lib/auth/safe-next';
import { useT } from '@/lib/i18n/operator';

const LOGIN_FIELD =
  'h-auto rounded-xl border-border/80 bg-background/50 px-4 py-3 text-sm shadow-none focus-visible:border-primary/80 focus-visible:ring-2 focus-visible:ring-primary/20 dark:bg-background/50';

function BrandMark() {
  return (
    <div
      className="mb-6 flex size-12 items-center justify-center rounded-xl border border-border bg-card/80 text-primary shadow-md backdrop-blur-md overflow-hidden"
      aria-hidden
    >
      <img
        src="/branding/worship-deck-icon-square.svg"
        alt="WorshipDeck"
        className="size-full object-cover"
      />
    </div>
  );
}

export default function LoginPage() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/setup/status', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { setupRequired?: boolean } | null) => {
        if (active && data && data.setupRequired) {
          setIsSetup(true);
        }
      })
      .catch(() => {
        // Status endpoint unavailable or non-loopback, fall back to normal login
      });
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (isSetup && password !== confirmPassword) {
      setError(t('setup.passwordMismatch'));
      setBusy(false);
      return;
    }

    try {
      const endpoint = isSetup ? '/api/setup/admin' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || (isSetup ? t('setup.failed') : t('login.invalid')));
      }
      window.location.assign(safeNextPath(searchParams.get('next')));
    } catch (err) {
      setError(err instanceof Error ? err.message : (isSetup ? t('setup.failed') : t('login.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6 font-sans text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 dark:opacity-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <BrandMark />
        <h1 className="mb-2 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          {isSetup ? t('setup.title') : t('chrome.brand.title')}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {isSetup ? t('setup.subtitle') : t('login.subtitle')}
        </p>

        <div className="relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-8 shadow-xl backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="login-username"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {isSetup ? t('setup.username') : t('login.username')}
              </Label>
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder={isSetup ? t('setup.usernamePlaceholder') : t('login.usernamePlaceholder')}
                required
                disabled={busy}
                className={LOGIN_FIELD}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {isSetup ? t('setup.password') : t('login.password')}
              </Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                placeholder={isSetup ? t('setup.passwordPlaceholder') : t('login.passwordPlaceholder')}
                required
                disabled={busy}
                className={LOGIN_FIELD}
              />
            </div>
            {isSetup ? (
              <div className="space-y-2">
                <Label
                  htmlFor="setup-confirm-password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t('setup.confirmPassword')}
                </Label>
                <Input
                  id="setup-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={t('setup.confirmPasswordPlaceholder')}
                  required
                  disabled={busy}
                  className={LOGIN_FIELD}
                />
              </div>
            ) : null}
            {error ? (
              <p className="animate-pulse text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-auto w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/95 hover:shadow-primary/10 active:scale-[0.98]"
            >
              {busy
                ? isSetup
                  ? t('setup.submitting')
                  : t('login.submitting')
                : isSetup
                  ? t('setup.submit')
                  : t('login.submit')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
