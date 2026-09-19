import React, { useState } from 'react';
import {
  X,
  Smartphone,
  RotateCcw,
  Copy,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateSecurePin, generateScopedPairingToken } from './utils';
import { toast } from 'sonner';

interface MockupRemotePairingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId?: string;
  onRevokeAll?: () => void;
}

export default function MockupRemotePairingModal({
  open,
  onOpenChange,
  serviceId = 'srv-active',
  onRevokeAll,
}: MockupRemotePairingModalProps) {
  const [pin, setPin] = useState<string>(() => generateSecurePin());
  const [tokenData, setTokenData] = useState<{ token: string; expiresAt: number }>(
    () => generateScopedPairingToken(serviceId)
  );
  const [connectedRemotesCount, setConnectedRemotesCount] = useState(1);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isRevoked, setIsRevoked] = useState(false);
  const maxAttempts = 5;

  if (!open) return null;

  const isLockedOut = failedAttempts >= maxAttempts;
  const pairingUrl = isRevoked
    ? 'Tautan pairing telah dicabut (Revoked). Tekan Ganti PIN untuk mengaktifkan kembali.'
    : `https://presenter.church.local/services/${serviceId}/remote?token=${tokenData.token}`;

  const handleCopyUrl = () => {
    if (isRevoked) {
      toast.error('Tautan sudah dicabut, silakan generate PIN baru.');
      return;
    }
    navigator.clipboard?.writeText(pairingUrl);
    toast.success('Tautan remote pairing disalin ke clipboard.');
  };

  const handleRefreshPin = () => {
    const newPin = generateSecurePin();
    const newToken = generateScopedPairingToken(serviceId);
    setPin(newPin);
    setTokenData(newToken);
    setFailedAttempts(0);
    setIsRevoked(false);
    setConnectedRemotesCount(1);
    toast.info(`PIN pairing baru & token scoped digenerate: ${newPin}`);
  };

  const handleSimulateFailedAttempt = () => {
    const nextFailed = failedAttempts + 1;
    setFailedAttempts(nextFailed);
    if (nextFailed >= maxAttempts) {
      toast.error(
        'Batas percobaan PIN tercapai (5 kali salah). Pairing terkunci selama 15 menit.'
      );
    } else {
      toast.warning(`Percobaan PIN salah: ${nextFailed}/${maxAttempts}`);
    }
  };

  const handleRevokeAll = () => {
    setConnectedRemotesCount(0);
    setIsRevoked(true);
    setFailedAttempts(0);
    if (onRevokeAll) onRevokeAll();
    toast.success('Seluruh koneksi remote smartphone berhasil diputuskan & token dicabut.');
  };

  return (
    <div
      data-testid="remote-control-pairing-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                📱 Pairing Remote Control Smartphone
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Kendalikan slide proyektor secara wireless dari smartphone liturgis atau pengkhotbah.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* QR Code Stage */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white text-black shadow-inner">
            <div
              data-testid="remote-qr-code"
              className="w-44 h-44 border-4 border-black p-2 flex flex-col items-center justify-center relative bg-white"
            >
              {/* High Contrast Simulated QR Matrix */}
              <div className="w-full h-full grid grid-cols-6 grid-rows-6 gap-1 p-1">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-2xs ${
                      !isRevoked && ((i % 2 === 0 && i % 3 === 0) || i < 7 || i > 28 || i === 14 || i === 21)
                        ? 'bg-black'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="p-1 rounded-sm bg-white border border-black shadow-xs">
                  {isRevoked ? (
                    <ShieldAlert className="w-4 h-4 text-destructive" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-black" />
                  )}
                </div>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-zinc-700 mt-2 text-center">
              {isRevoked
                ? 'QR Code tidak aktif (koneksi telah dicabut)'
                : 'Pindai dengan kamera smartphone untuk membuka Remote Operator'}
            </p>
          </div>

          {/* 4-Digit PIN & Rate Limiting Badge */}
          <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground block uppercase">
                Kode PIN Pairing (4-Digit)
              </span>
              <span
                data-testid="remote-pairing-pin"
                className={`text-2xl font-mono font-extrabold tracking-widest ${
                  isRevoked
                    ? 'text-muted-foreground line-through'
                    : isLockedOut
                    ? 'text-destructive'
                    : 'text-primary'
                }`}
              >
                {isRevoked ? '----' : pin}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div
                data-testid="remote-pin-attempts-badge"
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                  isLockedOut
                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isLockedOut
                  ? 'Terkunci (15 Menit)'
                  : `Percobaan: ${failedAttempts}/${maxAttempts}`}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-muted-foreground gap-1 px-1.5"
                  onClick={handleRefreshPin}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isRevoked ? 'Aktifkan Kembali' : 'Ganti PIN'}</span>
                </Button>
                {/* Simulation helper */}
                {!isLockedOut && !isRevoked && (
                  <button
                    type="button"
                    onClick={handleSimulateFailedAttempt}
                    className="text-[10px] text-muted-foreground underline hover:text-foreground"
                    title="Simulasi salah PIN untuk uji rate limiting"
                  >
                    (Simulasi Salah)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pairing URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Tautan Akses Cepat (Scoped Token TTL 4 Jam)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={pairingUrl}
                className={`w-full h-8 px-2.5 rounded-lg border border-border font-mono text-[11px] ${
                  isRevoked
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted/40 text-muted-foreground'
                }`}
                data-testid="remote-pairing-url"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 shrink-0"
                onClick={handleCopyUrl}
                title="Salin Tautan"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Connected Remotes & Revocation */}
          <div className="p-3 rounded-xl border border-border/80 bg-card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectedRemotesCount > 0 && !isRevoked
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-muted-foreground'
                }`}
              />
              <span className="text-xs text-foreground font-semibold">
                {connectedRemotesCount > 0 && !isRevoked
                  ? `${connectedRemotesCount} Smartphone Terhubung`
                  : 'Belum Ada Remote Terhubung'}
              </span>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-xs font-semibold gap-1"
              onClick={handleRevokeAll}
              data-testid="revoke-all-remotes-button"
            >
              <span>Putuskan Semua Remote</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-muted/10 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold"
          >
            Selesai
          </Button>
        </div>
      </div>
    </div>
  );
}
