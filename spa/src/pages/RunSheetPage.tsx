import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Link from '@/components/Link';
import EditForm from '@/operator/EditForm';
import SyncArtifactButton from '@/operator/SyncArtifactButton';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/operator';
import { ChevronDown, RefreshCw } from 'lucide-react';
import {
  peekPresenterSession,
  clearPresenterSession,
  type PeekPresenterSessionResult,
} from '@/lib/presenter-session';
import { useSession } from '../lib/auth/SessionProvider';
import {
  clearCachedSession,
  getCachedSession,
  invalidateAuthAndPurgeOffline,
} from '@/lib/auth-session';
import {
  clearEmergencyPatches,
  getEmergencyPatches,
  getServiceSnapshot,
  revertEmergencyPatches,
  warmServiceSnapshot,
  type EmergencyPatchRecord,
} from '@/lib/offline/service-snapshot';
import { OfflineReadinessBadge } from '@/components/offline/OfflineReadinessBadge';
import OneDriveSyncPromptModal from '@/components/onedrive/OneDriveSyncPromptModal';

export interface OneDriveStateConfig {
  connected: boolean;
  account_email: string;
  account_name: string;
  target_folder_id: string;
  target_folder_path: string;
  sync_mode: 'ask' | 'always' | 'off';
}

export default function RunSheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { t } = useT();
  const [svc, setSvc] = useState<any>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingPatches, setPendingPatches] = useState<EmergencyPatchRecord[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // SPEC-95: OneDrive Sync Integration State
  const [oneDriveConfig, setOneDriveConfig] = useState<OneDriveStateConfig | null>(null);
  const [syncPromptOpen, setSyncPromptOpen] = useState(false);
  const [retainedPptxBlob, setRetainedPptxBlob] = useState<Blob | null>(null);
  const [retainedFilename, setRetainedFilename] = useState<string>('');
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false);
  const [isUploadingOneDrive, setIsUploadingOneDrive] = useState(false);
  const [oneDriveToast, setOneDriveToast] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
    url?: string;
  } | null>(null);

  // SPEC-105-03: Inspect active presenter session state for adaptive resume action
  const [sessionInfo, setSessionInfo] = useState<PeekPresenterSessionResult>({
    hasSession: false,
    slideNumber: 1,
    isBlank: false,
    hasScripture: false,
  });

  useEffect(() => {
    if (!svc?.id || !svc?.plan_identity) return;
    const check = () => {
      setSessionInfo(peekPresenterSession(svc.id, svc.plan_identity));
    };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [svc?.id, svc?.plan_identity]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/onedrive', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setOneDriveConfig(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (id) {
      getEmergencyPatches(id).then((records) => {
        if (!cancelled) setPendingPatches(records);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [id, svc?.updated_at]);

  const handleSyncEmergencyToServer = async () => {
    if (!id) return;
    setIsReconciling(true);
    setReconcileError(null);
    try {
      const getRes = await fetch(`/api/services/${id}`, { credentials: 'same-origin' });
      if (!getRes.ok) {
        throw new Error(`Gagal memuat status server: HTTP ${getRes.status}`);
      }
      const remoteData = await getRes.json();

      // Check basePlanIdentity concurrency guard
      const divergentPatch = pendingPatches.find(
        (p) => p.basePlanIdentity && remoteData.plan_identity && p.basePlanIdentity !== remoteData.plan_identity
      );
      if (divergentPatch) {
        setReconcileError('Konflik: Susunan acara di server telah berubah sejak koreksi dibuat. Silakan muat ulang atau periksa perubahan.');
        return;
      }

      // Apply queued patches onto fresh server plan
      let patchedPlan = Array.isArray(remoteData.plan) ? [...remoteData.plan] : [];
      for (const p of pendingPatches) {
        if (p.slideIndex >= 0 && p.slideIndex < patchedPlan.length && p.patchedArtifact) {
          patchedPlan[p.slideIndex] = {
            ...patchedPlan[p.slideIndex],
            artifact: p.patchedArtifact,
            body: p.updatedText,
            lines: p.updatedText.split('\n'),
          };
        }
      }

      const putRes = await fetch(`/api/services/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': remoteData.updated_at || '',
        },
        body: JSON.stringify({
          updated_at: remoteData.updated_at,
          emergency_patches: pendingPatches.map((p) => ({
            slideIndex: p.slideIndex,
            updatedText: p.updatedText,
            patchedArtifact: p.patchedArtifact,
            patchRevision: p.patchRevision,
            basePlanIdentity: p.basePlanIdentity,
          })),
        }),
      });

      if (putRes.status === 409) {
        setReconcileError('Konflik versi: Layanan telah diubah di server.');
        return;
      }
      if (!putRes.ok) {
        throw new Error(`HTTP ${putRes.status}`);
      }

      await clearEmergencyPatches(id);
      setPendingPatches([]);
      await reloadService();
    } catch (err: any) {
      setReconcileError(err.message || 'Gagal menyimpan ke server');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleDiscardEmergencyPatches = async () => {
    if (!id) return;
    setIsReconciling(true);
    setReconcileError(null);
    try {
      if (!isOfflineData) {
        const getRes = await fetch(`/api/services/${id}`, { credentials: 'same-origin' });
        if (!getRes.ok) {
          throw new Error(`Gagal memuat status server: HTTP ${getRes.status}`);
        }
        const remoteData = await getRes.json();
        const putRes = await fetch(`/api/services/${id}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': remoteData.updated_at || '',
          },
          body: JSON.stringify({
            updated_at: remoteData.updated_at,
            emergency_patches: [],
          }),
        });
        if (putRes.status === 409) {
          setReconcileError('Konflik versi: Layanan telah diubah di server.');
          return;
        }
        if (!putRes.ok) {
          throw new Error(`HTTP ${putRes.status}`);
        }
      }

      await revertEmergencyPatches(id);
      setPendingPatches([]);
      await reloadService();
    } catch (err: any) {
      setReconcileError(err.message || 'Gagal membuang koreksi');
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    (async () => {
      try {
        const res = await fetch(`/api/services/${id}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          await invalidateAuthAndPurgeOffline().catch(() => {});
          navigate('/login', { replace: true });
          return;
        }
        if (res.status === 404) {
          setSvc('missing');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        if (data && data.id) {
          warmServiceSnapshot(data.id, data).catch(() => {});
        }
        setSvc(data);
        setIsOfflineData(false);
        setLoading(false);
      } catch {
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (id) {
          const cachedSession = getCachedSession();
          if (cachedSession && cachedSession.username) {
            try {
              const snapshot = await getServiceSnapshot(id);
              if (cancelled) return;
              if (snapshot && snapshot.id) {
                setSvc(snapshot);
                setIsOfflineData(true);
                setLoading(false);
                return;
              }
            } catch {
              // fall through
            }
          }
        }
        setSvc('missing');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [id]);

  if (svc === 'missing') return <Navigate to="/" replace />;
  if (!session) return null;
  if (loading || !svc) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading service">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-10 w-64 rounded bg-muted" />
        <div className="h-96 rounded-xl bg-muted/60" />
      </div>
    );
  }

  const isAdmin = session.role === 'admin';
  const images = svc.images_payload && typeof svc.images_payload === 'object' ? svc.images_payload : {};

  const reloadService = async () => {
    try {
      const res = await fetch(`/api/services/${id}`, { credentials: 'same-origin' });
      if (res.status === 401 || res.status === 403) {
        await invalidateAuthAndPurgeOffline().catch(() => {});
        navigate('/login', { replace: true });
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          warmServiceSnapshot(data.id, data).catch(() => {});
        }
        setSvc(data);
        setIsOfflineData(false);
      }
    } catch {
      // non-blocking
    }
  };

  const uploadBlobToOneDrive = async (blob: Blob, filename: string) => {
    if (!svc?.id) return;
    setIsUploadingOneDrive(true);
    setOneDriveToast({
      type: 'info',
      message: t('onedrive.upload.progress'),
    });

    try {
      const formData = new FormData();
      formData.append('file', blob, filename);

      const res = await fetch(`/api/services/${svc.id}/onedrive-upload`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result = (await res.json()) as { success: boolean; web_url?: string; filename?: string };
      setOneDriveToast({
        type: 'success',
        message: `${t('onedrive.upload.success')}: ${result.filename || filename}`,
        url: result.web_url,
      });
    } catch (err) {
      setOneDriveToast({
        type: 'error',
        message: `${t('onedrive.upload.failed')}: ${err instanceof Error ? err.message : 'Upload failed'}`,
      });
    } finally {
      setIsUploadingOneDrive(false);
    }
  };

  const handleDownloadPptx = async (wrap: boolean = true) => {
    if (!svc?.id) return;
    setIsDownloadingPptx(true);
    setOneDriveToast(null);

    const filename = `Service-${svc.id}.pptx`;
    const pptxUrl = wrap
      ? `/api/services/${svc.id}/pptx`
      : `/api/services/${svc.id}/pptx?wrap=false`;

    try {
      // Step 1: Single-blob generation fetch
      const res = await fetch(pptxUrl, { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error(`Failed to generate PPTX: HTTP ${res.status}`);
      }
      const blob = await res.blob();

      // Step 2: Immediate local download to guarantee local offline presentation delivery (AD-1/FR-14)
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      // Step 3: Retain single-blob reference for OneDrive
      setRetainedPptxBlob(blob);
      setRetainedFilename(filename);

      // Step 4: Evaluate OneDrive cloud delivery
      if (!oneDriveConfig?.connected || oneDriveConfig.sync_mode === 'off') {
        return;
      }

      if (oneDriveConfig.sync_mode === 'always') {
        uploadBlobToOneDrive(blob, filename);
      } else {
        // sync_mode === 'ask'
        setSyncPromptOpen(true);
      }
    } catch (err) {
      console.error('PPTX export error:', err);
    } finally {
      setIsDownloadingPptx(false);
    }
  };

  const actionClass = cn(buttonVariants({ variant: 'outline' }), 'h-auto px-3 py-2');

  return (
    <>
      <div className="mb-6">
        <Link href="/" className={buttonVariants({ variant: 'link' })}>
          {t('edit.actions.back')}
        </Link>
      </div>
      {isOfflineData && (
        <div
          data-testid="offline-runsheet-banner"
          role="status"
          className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>{t('edit.offline.banner')}</span>
          </div>
          <span className="text-[11px] opacity-75">{t('edit.offline.savedLocal')}</span>
        </div>
      )}
      {pendingPatches.length > 0 && !isOfflineData && (
        <div
          data-testid="emergency-reconciliation-banner"
          role="status"
          className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <span>
              {t('edit.emergency.bannerPrefix')} {pendingPatches.length} {t('edit.emergency.changesSaved')}
            </span>
            {reconcileError && (
              <span className="text-destructive font-medium ml-2">({reconcileError})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              data-testid="emergency-sync-server-button"
              disabled={isReconciling}
              onClick={handleSyncEmergencyToServer}
              className="h-7 px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isReconciling ? t('edit.emergency.saving') : t('edit.emergency.syncServer')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="emergency-discard-button"
              disabled={isReconciling}
              onClick={handleDiscardEmergencyPatches}
              className="h-7 px-2.5 text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
            >
              {t('edit.emergency.discard')}
            </Button>
          </div>
        </div>
      )}
      <header
        data-testid="run-sheet-header"
        className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4 border-b border-border/80 pb-4 items-start"
      >
        {/* Column 1 (Left 50%): Meta Cluster */}
        <div data-testid="header-meta-cluster" className="min-w-0 flex flex-col justify-center">
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate whitespace-nowrap"
            title={`Run-Sheet: ${svc.date || svc.id}`}
          >
            Run-Sheet: {svc.date || svc.id}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>
        </div>

        {/* Column 2 (Right 50%): Structured Action Clusters */}
        <div data-testid="header-actions-wrapper" className="flex flex-col items-start lg:items-end gap-2.5">
          {/* Row 1: Status visibility */}
          <div data-testid="header-offline-row" className="flex items-center justify-start lg:justify-end w-full">
            <OfflineReadinessBadge serviceId={svc.id} serviceData={svc} />
          </div>

          {/* Row 2: Primary Controls (Present with primary visual prominence, Preview, Remote) */}
          <div data-testid="header-primary-controls" className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            <Link
              href={`/services/${svc.id}/present`}
              className={cn(
                buttonVariants({ variant: 'default' }),
                sessionInfo.hasSession
                  ? 'rounded-r-none px-3.5 border-r border-primary-foreground/20'
                  : 'px-4',
                'h-9 font-bold shadow-xs'
              )}
              title={sessionInfo.hasSession && sessionInfo.isBlank ? 'Screen is blanked' : undefined}
            >
              {sessionInfo.hasSession
                ? `Resume (Slide ${sessionInfo.slideNumber})`
                : t('edit.actions.present')}
            </Link>
            {sessionInfo.hasSession && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Presentation Launch Options"
                  className={cn(
                    buttonVariants({ variant: 'default' }),
                    'rounded-l-none -ml-2 h-9 px-2 cursor-pointer'
                  )}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => navigate(`/services/${svc.id}/present`)}
                    className="cursor-pointer font-medium"
                  >
                    Resume (Slide {sessionInfo.slideNumber})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      clearPresenterSession(svc.id);
                      navigate(`/services/${svc.id}/present`);
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    Start from Beginning (Slide 1)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link
              href={`/services/${svc.id}/slideshow`}
              target="_blank"
              rel="noreferrer"
              className={actionClass}
            >
              {t('edit.actions.preview')}
            </Link>
            <Link href={`/services/${svc.id}/remote`} className={actionClass}>
              {t('edit.actions.remote')}
            </Link>
          </div>

          {/* Row 3: Utility Controls (Sync Artifact, Download PPTX split button) */}
          <div data-testid="header-utility-controls" className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            {isAdmin ? (
              <SyncArtifactButton
                serviceId={svc.id}
                updatedAt={svc.updated_at}
                onSuccess={reloadService}
              />
            ) : null}
            <div className="inline-flex rounded-md shadow-xs">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDownloadPptx(true)}
                disabled={isDownloadingPptx}
                aria-label={t('edit.actions.downloadPptx')}
                className="rounded-r-none h-auto px-3 py-2 border-r-0 text-xs font-medium cursor-pointer"
              >
                {isDownloadingPptx ? 'Exporting…' : t('edit.actions.downloadPptx')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="PPTX Export Options"
                  disabled={isDownloadingPptx}
                  className={cn(buttonVariants({ variant: 'outline' }), 'rounded-l-none h-auto px-2 py-2 cursor-pointer')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    onClick={() => handleDownloadPptx(true)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <span className="font-medium text-xs">{t('edit.pptx.wordWrapDefault')}</span>
                    <span className="text-muted-foreground text-[10px]">{t('edit.pptx.wordWrapDefaultDesc')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDownloadPptx(false)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <span className="font-medium text-xs">{t('edit.pptx.wordWrapDisabled')}</span>
                    <span className="text-muted-foreground text-[10px]">{t('edit.pptx.wordWrapDisabledDesc')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* SPEC-95: Non-blocking OneDrive Status Banner */}
      {oneDriveToast && (
        <div
          data-testid="onedrive-toast"
          role="status"
          className={cn(
            'mb-6 rounded-md border px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3 shadow-xs',
            oneDriveToast.type === 'info' && 'border-sky-500/30 bg-sky-500/10 text-sky-400',
            oneDriveToast.type === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
            oneDriveToast.type === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {oneDriveToast.type === 'info' && <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
            <span className="truncate">{oneDriveToast.message}</span>
            {oneDriveToast.url && (
              <a
                href={oneDriveToast.url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:no-underline font-semibold ml-1 shrink-0"
              >
                {t('onedrive.upload.open')} ↗
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {oneDriveToast.type === 'error' && retainedPptxBlob && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] border-destructive/40 hover:bg-destructive/15"
                onClick={() => uploadBlobToOneDrive(retainedPptxBlob, retainedFilename)}
              >
                {t('onedrive.upload.retry')}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOneDriveToast(null)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      <OneDriveSyncPromptModal
        open={syncPromptOpen}
        onClose={() => setSyncPromptOpen(false)}
        targetFolderPath={oneDriveConfig?.target_folder_path}
        onConfirmSync={async (alwaysSync) => {
          if (alwaysSync) {
            fetch('/api/settings/onedrive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ sync_mode: 'always' }),
            }).catch(() => {});
            setOneDriveConfig((prev) => (prev ? { ...prev, sync_mode: 'always' } : null));
          }
          if (retainedPptxBlob) {
            uploadBlobToOneDrive(retainedPptxBlob, retainedFilename);
          }
        }}
      />
      <EditForm
        id={svc.id}
        initialPayload={svc.raw_payload || ''}
        initialParsed={svc.parsed_data}
        initialSongSets={svc.songSets}
        hymnIndex={[]}
        initialSermonGraphicUrl={images.sermonGraphicUrl || ''}
        initialFamilyPhotoUrl={images.familyPhotoUrl || ''}
        initialYouthPhotoUrl={images.youthPhotoUrl || ''}
        initialAnnouncementInserts={
          Array.isArray(images.announcementInserts)
            ? images.announcementInserts.map((x: unknown) => (typeof x === 'string' ? x : ''))
            : []
        }
        initialFieldValues={svc.field_values}
        initialLayoutSnapshot={svc.form_layout_snapshot}
        initialUpdatedAt={svc.updated_at}
        initialHiddenSlideIds={svc.hidden_slide_ids}
      />
    </>
  );
}
