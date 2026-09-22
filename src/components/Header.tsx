import { usePathname } from '@/lib/navigation';
import { useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import LogoutButton from './LogoutButton';
import ThemeToggle from './ThemeToggle';
import { CustomLink } from './navigation-blocker';
import { headerLinkClass, HEADER_CONTROL_BOX_BASE } from './header-chrome';
import { useT } from '@/lib/i18n/operator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface HeaderProps {
  username?: string;
  isAdmin?: boolean;
}

export default function Header({ isAdmin = false, username = 'Operator' }: HeaderProps) {
  const { t } = useT();
  const pathname = usePathname() || '';
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const getLinkClass = headerLinkClass;

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setPwError(null);
    setPwSuccess(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('chrome.password.failed'));
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => {
        setChangePasswordOpen(false);
        setPwSuccess(false);
      }, 1500);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error occurred');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/80 pb-6 gap-4 relative">
      <div className="flex items-center gap-4">
        <CustomLink href="/" className="flex items-center gap-4 group">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card shadow-md text-primary group-hover:border-primary/50 transition-colors overflow-hidden">
            <img
              src="/branding/worship-deck-icon-square.svg"
              alt="WorshipDeck"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {t('chrome.brand.title')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('chrome.brand.tagline')}
            </p>
          </div>
        </CustomLink>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <nav className="flex flex-wrap items-center gap-2">
          <CustomLink
            href="/"
            className={getLinkClass(pathname === '/')}
          >
            {t('chrome.nav.dashboard')}
          </CustomLink>
          <CustomLink
            href="/new"
            className={getLinkClass(pathname === '/new')}
            aria-current={pathname === '/new' ? 'page' : undefined}
          >
            New Workspace Mockup
          </CustomLink>
          {isAdmin && (
            <>
              <CustomLink
                href="/admin/artifacts"
                className={getLinkClass(pathname.startsWith('/admin/artifacts'))}
              >
                {t('chrome.nav.artifacts')}
              </CustomLink>
              <CustomLink
                href="/admin"
                className={getLinkClass(
                  pathname.startsWith('/admin') && !pathname.startsWith('/admin/artifacts')
                )}
              >
                {t('chrome.nav.settings')}
              </CustomLink>
            </>
          )}
        </nav>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-2.5 text-foreground ${HEADER_CONTROL_BOX_BASE}`}
          >
            <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
              {username[0]?.toUpperCase()}
            </div>
            <span>{username}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-muted-foreground">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="size-4" />
              {t('chrome.password.change')}
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => { window.location.href = '/admin/sync'; }}>
                <RefreshCw className="size-4" />
                <a href="/admin/sync">Sync</a>
              </DropdownMenuItem>
            )}
            <LogoutButton variant="menu" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={changePasswordOpen}
        onOpenChange={(open) => {
          setChangePasswordOpen(open);
          if (!open) resetPasswordForm();
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('chrome.password.title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('chrome.password.current')}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder={t('chrome.password.placeholderCurrent')}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('chrome.password.new')}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder={t('chrome.password.placeholderNew')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {pwError ? <p className="text-sm text-destructive">{pwError}</p> : null}
            {pwSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 animate-pulse">
                {t('chrome.password.success')}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setChangePasswordOpen(false);
                  resetPasswordForm();
                }}
              >
                {t('chrome.password.cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {t('chrome.password.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
