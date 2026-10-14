import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ClipboardPaste,
  CloudDownload,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PairingInfo {
  paired: boolean;
  cloud_url?: string;
  tenant_id?: string;
  church_name?: string;
  device_id?: string;
  token_masked?: string;
  paired_at?: string;
}

interface CloudPairingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairingInfo?: PairingInfo | null;
  onPairingChanged?: () => void;
  isStageLive?: boolean;
}

export default function CloudPairingModal({
  open,
  onOpenChange,
  pairingInfo,
  onPairingChanged,
  isStageLive = false,
}: CloudPairingModalProps) {
  const [cloudUrl, setCloudUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [unpairing, setUnpairing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Sync state when modal opens or pairingInfo changes
  useEffect(() => {
    if (pairingInfo?.paired && pairingInfo.cloud_url) {
      setCloudUrl(pairingInfo.cloud_url);
    } else {
      setTestSuccess(null);
      setTestError(null);
    }
  }, [pairingInfo, open]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCloudUrl(e.target.value);
    setTestSuccess(null);
    setTestError(null);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value);
    setTestSuccess(null);
    setTestError(null);
  };

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setToken(text.trim());
      setTestSuccess(null);
      setTestError(null);
    } catch {
      toast.error('Tidak dapat membaca papan klip. Tempel secara manual.');
    }
  };

  const handleTestConnection = async () => {
    if (!cloudUrl.trim() || !token.trim()) return;

    setTesting(true);
    setTestError(null);
    setTestSuccess(null);

    try {
      const res = await fetch('/api/desktop/pairing/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_url: cloudUrl.trim(),
          token: token.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghubungi workspace cloud');
      }

      const church = data.church_name || 'Gereja Anda';
      setTestSuccess(church);
      toast.success(`Terhubung ke ${church}`);
    } catch (err: any) {
      setTestError(err.message || 'Alamat ini tidak bisa dijangkau. Periksa ejaan dan koneksi internet.');
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!testSuccess) return;

    setConnecting(true);
    try {
      const res = await fetch('/api/desktop/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_url: cloudUrl.trim(),
          token: token.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan konfigurasi pairing');
      }

      toast.success(`Laptop berhasil terhubung ke ${data.church_name || 'Workspace Cloud'}`);
      setToken('');
      if (onPairingChanged) onPairingChanged();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghubungkan laptop ke cloud');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (isStageLive) {
      toast.error('Tidak bisa diputus saat panggung sedang tayang.');
      return;
    }

    setUnpairing(true);
    try {
      const res = await fetch('/api/desktop/pairing', { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memutus hubungan');

      toast.info('Terputus dari cloud. Data lokal tetap tersimpan.');
      setConfirmDisconnect(false);
      setCloudUrl('');
      setToken('');
      setTestSuccess(null);
      if (onPairingChanged) onPairingChanged();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memutus hubungan pairing');
    } finally {
      setUnpairing(false);
    }
  };

  // 1. Connected View (Laptop already paired)
  if (pairingInfo?.paired) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="cloud-pairing-connected-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Cloud className="size-5 text-primary" />
              <span>Workspace Cloud Terhubung</span>
            </DialogTitle>
            <DialogDescription>
              Laptop FOH ini terhubung dengan aman ke workspace gereja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-base text-foreground truncate">
                    {pairingInfo.church_name || 'Gereja Anda'}
                  </h4>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {pairingInfo.cloud_url}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Token: <span className="font-mono">{pairingInfo.token_masked || 'foh_••••••••'}</span>
                  </p>
                </div>
              </div>
            </div>

            {confirmDisconnect ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 space-y-3">
                <p className="text-xs font-medium text-destructive leading-relaxed">
                  Putuskan laptop ini dari {pairingInfo.church_name || 'workspace'}? Laptop tidak akan menerima pembaruan dari cloud, namun seluruh data lokal tetap aman dan dapat ditayangkan.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDisconnect(false)}
                    disabled={unpairing}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={unpairing}
                    data-testid="confirm-disconnect-btn"
                  >
                    {unpairing ? 'Memutus...' : 'Ya, Putuskan'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={isStageLive}
                  title={isStageLive ? 'Tidak bisa diputus saat panggung sedang tayang' : undefined}
                  data-testid="disconnect-pairing-btn"
                >
                  <Unlink className="size-3.5 mr-1.5" />
                  Putuskan hubungan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Tutup
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 2. Unpaired / Setup View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="cloud-pairing-setup-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Cloud className="size-5 text-primary" />
            <span>Hubungkan laptop ini ke cloud</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Siapkan ibadah bersama tim di cloud, lalu tarik semuanya ke laptop ini sebelum ibadah. Saat tayang, panggung berjalan tanpa internet.
          </DialogDescription>
        </DialogHeader>

        {/* Guidance Card (Opus K0.4) */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">Cara mendapatkan token:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Buka <strong className="text-foreground">console.worshipdeck.org</strong> di perangkat mana pun dan masuk.</li>
            <li>Buka menu <strong className="text-foreground">Perangkat FOH → Buat token pairing</strong>.</li>
            <li>Salin token berformat <code className="font-mono text-primary">foh_...</code> dan tempel di bawah.</li>
          </ol>
          <p className="text-[11px] opacity-80 pt-1">Bukan pengelola? Minta token ke admin gereja Anda.</p>
        </div>

        <div className="space-y-4 py-2">
          {/* Cloud URL */}
          <div className="space-y-1.5">
            <Label htmlFor="cloud-url" className="text-xs font-semibold">Alamat workspace cloud</Label>
            <Input
              id="cloud-url"
              data-testid="pairing-url-input"
              placeholder="https://gereja-anda.worshipdeck.org"
              value={cloudUrl}
              onChange={handleUrlChange}
              disabled={testing || connecting}
              className="text-xs font-mono"
            />
          </div>

          {/* Pairing Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pairing-token" className="text-xs font-semibold">Token pairing</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={handlePasteToken}
                disabled={testing || connecting}
              >
                <ClipboardPaste className="size-3 mr-1" />
                Tempel
              </Button>
            </div>
            <div className="relative">
              <Input
                id="pairing-token"
                data-testid="pairing-token-input"
                type={showToken ? 'text' : 'password'}
                placeholder="foh_xxxxxxxx.xxxxxxxxxxxxxxxx"
                value={token}
                onChange={handleTokenChange}
                disabled={testing || connecting}
                className="text-xs font-mono pr-9"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Test connection result box */}
          {testing && (
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground animate-pulse">
              <RefreshCw className="size-3.5 animate-spin" />
              <span>Menguji koneksi ke cloud...</span>
            </div>
          )}

          {testSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Terhubung ke <strong>{testSuccess}</strong></span>
            </div>
          )}

          {testError && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{testError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={testing || connecting}
          >
            Batal
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || connecting || !cloudUrl.trim() || !token.trim()}
              data-testid="pairing-test-btn"
            >
              {testing ? 'Menguji…' : 'Uji koneksi'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConnect}
              disabled={!testSuccess || connecting}
              data-testid="pairing-connect-btn"
            >
              {connecting ? 'Menghubungkan…' : `Hubungkan`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
