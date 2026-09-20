import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Layers,
  ShieldCheck,
  Split,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export type SyncState = 'synced' | 'pending' | 'conflict';

interface MockupSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncState?: SyncState;
  localRevision?: number;
  serverRevision?: number;
  serviceTitle?: string;
  serviceDate?: string;
  onResolveConflict?: (resolution: 'local' | 'server' | 'fork') => void;
}

export default function MockupSyncDialog({
  open,
  onOpenChange,
  syncState: initialSyncState = 'synced',
  localRevision = 2,
  serverRevision = 3,
  serviceTitle = 'Kebaktian Sabat',
  serviceDate = '2026-09-19',
  onResolveConflict,
}: MockupSyncDialogProps) {
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  if (!open) return null;

  const handlePush = () => {
    setIsPushing(true);
    setTimeout(() => {
      setIsPushing(false);
      setSyncState('synced');
      toast.success(
        'Sinkronisasi Sukses: Perubahan agregat jadwal lokal berhasil diunggah ke server.'
      );
    }, 400);
  };

  const handlePull = () => {
    setIsPulling(true);
    setTimeout(() => {
      setIsPulling(false);
      setSyncState('synced');
      toast.success(
        'Sinkronisasi Sukses: Agregat jadwal terbaru dari server berhasil diunduh.'
      );
    }, 400);
  };

  const handleSimulateConflict = () => {
    setSyncState('conflict');
    toast.warning('Simulasi: Konflik versi jadwal terdeteksi antara desktop dan web.');
  };

  const handleResolution = (type: 'local' | 'server' | 'fork') => {
    setSyncState('synced');
    if (onResolveConflict) {
      onResolveConflict(type);
    }
    if (type === 'local') {
      toast.success(
        'Konflik Terselesaikan: Menggunakan versi lokal (force push dengan revisi baru).'
      );
    } else if (type === 'server') {
      toast.success(
        'Konflik Terselesaikan: Menerima versi server dan memperbarui timeline lokal.'
      );
    } else {
      toast.success(
        'Konflik Terselesaikan: Disimpan sebagai salinan jadwal baru dengan UUIDv7 independen.'
      );
    }
  };

  return (
    <div
      data-testid="sync-status-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                🔄 Status Sinkronisasi Desktop-ke-Web
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Kontrak sinkronisasi agregat atomik (SQLite WAL mode transaction) antara aplikasi Desktop offline dan Server Web.
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
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              syncState === 'synced'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : syncState === 'pending'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {syncState === 'synced' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : syncState === 'pending' ? (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              )}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {syncState === 'synced'
                    ? '🟢 Terhubung & Tersinkron Penuh'
                    : syncState === 'pending'
                    ? '🟡 3 Perubahan Lokal Tertunda'
                    : '🔴 Konflik Versi Terdeteksi'}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  {syncState === 'synced'
                    ? 'Seluruh data jadwal, slide, dan preset telah identik antara database lokal dan server.'
                    : syncState === 'pending'
                    ? 'Ada perubahan jadwal lokal yang belum dikirim ke server web.'
                    : `Versi lokal (rev.${localRevision}) dan server (rev.${serverRevision}) memiliki perubahan bersamaan.`}
                </p>
              </div>
            </div>

            {syncState !== 'conflict' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] shrink-0"
                onClick={handleSimulateConflict}
              >
                Uji Simulasi Konflik
              </Button>
            )}
          </div>

          {/* Sync Trigger Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePush}
              disabled={isPushing}
              className="h-10 text-xs font-semibold justify-center gap-2 border-border/80 hover:bg-muted/40"
              data-testid="sync-push-button"
            >
              <ArrowUpCircle className="w-4 h-4 text-primary" />
              <span>{isPushing ? 'Mengunggah...' : 'Push Perubahan ke Server Web'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handlePull}
              disabled={isPulling}
              className="h-10 text-xs font-semibold justify-center gap-2 border-border/80 hover:bg-muted/40"
              data-testid="sync-pull-button"
            >
              <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
              <span>{isPulling ? 'Mengunduh...' : 'Tarik Pembaruan dari Server'}</span>
            </Button>
          </div>

          {/* Conflict Resolution Section (When in conflict state) */}
          {syncState === 'conflict' && (
            <div
              data-testid="conflict-diff-viewer"
              className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                  <Split className="w-4 h-4" />
                  <span>Penampil Perbedaan Versi (Conflict Diff Viewer)</span>
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                  Version Skew Detected
                </span>
              </div>

              {/* Side-by-side diff comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Local Side */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                  <span className="text-[10px] font-bold text-primary block uppercase">
                    Versi Lokal (Desktop Ini • rev.{localRevision})
                  </span>
                  <p className="font-semibold text-foreground">{serviceTitle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tanggal: {serviceDate} • 8 Timeline Items
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground pt-1">
                    Item terakhir diubah: Lagu Tutup (Key of G)
                  </p>
                </div>

                {/* Server Side */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">
                    Versi Server (Web Hub • rev.{serverRevision})
                  </span>
                  <p className="font-semibold text-foreground">{serviceTitle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tanggal: {serviceDate} • 9 Timeline Items
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground pt-1">
                    Item terakhir diubah: Menambahkan Warta Pengumuman
                  </p>
                </div>
              </div>

              {/* Resolution Options */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-destructive/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  onClick={() => handleResolution('local')}
                  data-testid="resolve-local-button"
                >
                  <span>Gunakan Versi Lokal (Force Push)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  onClick={() => handleResolution('server')}
                  data-testid="resolve-server-button"
                >
                  <span>Gunakan Versi Server (Overwrite)</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5"
                  onClick={() => handleResolution('fork')}
                  data-testid="resolve-fork-button"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Simpan sebagai Salinan Baru</span>
                </Button>
              </div>
            </div>
          )}

          {/* Atomic Aggregate Contract Informational Card */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2 text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" />
              <span>Invarian Kontrak Agregat Atomik (AC-44)</span>
            </h4>
            <ul className="space-y-1 text-muted-foreground text-[11px] list-disc list-inside leading-relaxed">
              <li>
                <strong>Single Transaction:</strong> Seluruh agregat jadwal (service row + schedule_items + snapshot preset) ditransfer dalam satu blok transaksi <code className="font-mono text-[10px]">BEGIN IMMEDIATE</code> di SQLite WAL mode.
              </li>
              <li>
                <strong>UUIDv7 & Tombstones:</strong> Entitas diidentifikasi oleh UUIDv7 terurut waktu dengan penandaan tombstone untuk penghapusan tanpa desinkronisasi.
              </li>
              <li>
                <strong>Schema Version Gate:</strong> Klien desktop dengan versi skema lebih lama dilindungi dari kerusakan data dengan konfirmasi peningkatan terstruktur.
              </li>
            </ul>
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
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
