import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudDownload,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import CloudPairingModal, { PairingInfo } from '../pairing/CloudPairingModal';

export type StageSyncState =
  | 'S0_UNPAIRED'
  | 'S1_READY'
  | 'S1B_READY_OFFLINE'
  | 'S2_UPDATES_PENDING'
  | 'S2B_NEVER_SYNCED'
  | 'S3_SYNC_INCOMPLETE'
  | 'S4_NEEDS_ATTENTION'
  | 'S5_SYNCING'
  | 'S6_LIVE_FROZEN';

interface FohSyncIndicatorProps {
  isStageLive?: boolean;
}

export default function FohSyncIndicator({ isStageLive = false }: FohSyncIndicatorProps) {
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [syncState, setSyncState] = useState<StageSyncState>('S0_UNPAIRED');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [verifiedAssetsCount, setVerifiedAssetsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressText, setSyncProgressText] = useState<string>('');
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const fetchPairingStatus = async () => {
    try {
      const res = await fetch('/api/desktop/pairing');
      if (!res.ok) return;
      const data: PairingInfo = await res.json();
      setPairingInfo(data);

      if (!data.paired) {
        setSyncState('S0_UNPAIRED');
        return;
      }

      if (isStageLive) {
        setSyncState('S6_LIVE_FROZEN');
        return;
      }

      if (data.paired_at) {
        setSyncState('S1_READY');
        setLastSyncTime(data.paired_at);
      } else {
        setSyncState('S2B_NEVER_SYNCED');
      }
    } catch {
      if (pairingInfo?.paired) {
        setSyncState('S1B_READY_OFFLINE');
      } else {
        setSyncState('S0_UNPAIRED');
      }
    }
  };

  useEffect(() => {
    void fetchPairingStatus();
  }, [isStageLive]);

  const handleTriggerSync = async () => {
    if (isStageLive) {
      toast.warning('Sinkronisasi dijeda selama panggung tayang.');
      return;
    }

    if (!pairingInfo?.paired) {
      setPairingModalOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncState('S5_SYNCING');
    setSyncProgressText('Mengambil liturgi dan lagu…');

    try {
      const res = await fetch('/api/desktop/sync/pull-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        if (data.error?.code === 'presenter_active') {
          setSyncState('S6_LIVE_FROZEN');
          toast.warning('Sinkronisasi ditahan selama sesi presentasi.');
          return;
        }
        if (data.error?.code === 'local_changes_pending') {
          setSyncState('S3_SYNC_INCOMPLETE');
          toast.warning('Ada perubahan darurat lokal yang belum tersinkron.');
          return;
        }
      }

      if (!res.ok) {
        setSyncState('S3_SYNC_INCOMPLETE');
        throw new Error(data.error || 'Gagal menyinkronkan data dari cloud');
      }

      setVerifiedAssetsCount(data.assets_downloaded || 0);
      setSyncState('S1_READY');
      setLastSyncTime(new Date().toISOString());
      toast.success(
        `Siap ibadah · ${data.services_count || 0} layanan, ${data.assets_downloaded || 0} aset terverifikasi`
      );
      void fetchPairingStatus();
    } catch (err: any) {
      setSyncState('S3_SYNC_INCOMPLETE');
      toast.error(err.message || 'Sinkron terhenti — panggung tetap memakai data lokal.');
    } finally {
      setIsSyncing(false);
      setSyncProgressText('');
    }
  };

  // State visuals per Opus §2.2
  const renderBadgeContent = () => {
    if (isStageLive) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <Lock className="size-3.5" />
          <span>Panggung tayang</span>
        </span>
      );
    }

    switch (syncState) {
      case 'S1_READY':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            <span>Siap ibadah</span>
          </span>
        );
      case 'S1B_READY_OFFLINE':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            <span>Siap ibadah (luring)</span>
          </span>
        );
      case 'S2_UPDATES_PENDING':
      case 'S2B_NEVER_SYNCED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <CloudDownload className="size-3.5" />
            <span>Perlu sinkronisasi</span>
          </span>
        );
      case 'S3_SYNC_INCOMPLETE':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="size-3.5" />
            <span>Sinkron belum tuntas</span>
          </span>
        );
      case 'S4_NEEDS_ATTENTION':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            <AlertOctagon className="size-3.5" />
            <span>Perlu perhatian</span>
          </span>
        );
      case 'S5_SYNCING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <RefreshCw className="size-3.5 animate-spin" />
            <span>Menyinkronkan…</span>
          </span>
        );
      case 'S0_UNPAIRED':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border">
            <CloudOff className="size-3.5" />
            <span>Belum terhubung</span>
          </span>
        );
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          data-testid="foh-sync-status-badge"
          className="cursor-pointer transition-opacity hover:opacity-85 focus:outline-none"
          role="status"
          aria-label="Status Kesiapan Panggung FOH"
        >
          {renderBadgeContent()}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4 space-y-3" data-testid="foh-sync-popover">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-foreground">Kesiapan Panggung FOH</h4>
              {pairingInfo?.paired && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  {pairingInfo.church_name || 'Cloud'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {pairingInfo?.paired
                ? (lastSyncTime
                    ? `Sinkron terakhir: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Belum pernah disinkronkan ke cloud.')
                : 'Laptop ini berjalan mandiri tanpa terhubung ke workspace cloud.'}
            </p>
          </div>

          {/* Action button */}
          <div className="pt-1">
            {pairingInfo?.paired ? (
              <Button
                type="button"
                className="w-full text-xs font-semibold"
                size="sm"
                onClick={handleTriggerSync}
                disabled={isSyncing || isStageLive}
                data-testid="sync-from-cloud-btn"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="size-3.5 mr-2 animate-spin" />
                    <span>{syncProgressText || 'Menyinkronkan…'}</span>
                  </>
                ) : isStageLive ? (
                  <>
                    <Lock className="size-3.5 mr-2" />
                    <span>Sinkron dijeda (Panggung tayang)</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="size-3.5 mr-2" />
                    <span>↓ Sinkronkan dari cloud</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full text-xs font-semibold"
                size="sm"
                onClick={() => {
                  setPopoverOpen(false);
                  setPairingModalOpen(true);
                }}
                data-testid="open-pairing-modal-btn"
              >
                <Cloud className="size-3.5 mr-2" />
                <span>Hubungkan ke cloud</span>
              </Button>
            )}
          </div>

          {pairingInfo?.paired && (
            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <button
                type="button"
                className="hover:text-foreground underline underline-offset-2"
                onClick={() => {
                  setPopoverOpen(false);
                  setPairingModalOpen(true);
                }}
              >
                Pengaturan pairing
              </button>
              <span>100% Luring saat ibadah</span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <CloudPairingModal
        open={pairingModalOpen}
        onOpenChange={setPairingModalOpen}
        pairingInfo={pairingInfo}
        onPairingChanged={fetchPairingStatus}
        isStageLive={isStageLive}
      />
    </>
  );
}
