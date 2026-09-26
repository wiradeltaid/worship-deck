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
            <span>Mode Offline — Membaca data tersimpan</span>
          </div>
          <span className="text-[11px] opacity-75">Tersimpan di perangkat lokal</span>
        </div>
      )}
      {pendingPatches.length > 0 && !isOfflineData && (
        <div
          data-testid="emergency-reconciliation-banner"
          role="status"
          className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <span>Terdapat koreksi panggung: {pendingPatches.length} perubahan tersimpan secara lokal</span>
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
              {isReconciling ? 'Menyimpan...' : 'Simpan ke Server'}
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
              Buang
            </Button>
          </div>
        </div>
      )}
      <header
        data-testid="run-sheet-header"
        className="mb-8 flex flex-col gap-4 border-b border-border/80 pb-4 lg:flex-row lg:items-center lg:justify-between"
      >
        {/* Meta Cluster (Left) */}
        <div data-testid="header-meta-cluster" className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Run-Sheet: {svc.date || svc.id}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>
          </div>
          <div className="pt-0.5 sm:pt-0">
            <OfflineReadinessBadge serviceId={svc.id} serviceData={svc} />
          </div>
        </div>

        {/* Action Clusters (Right) */}
        <div data-testid="header-actions-wrapper" className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Primary Controls (Present with primary visual prominence, Preview, Remote) */}
          <div data-testid="header-primary-controls" className="flex items-center gap-2">
            <Link
              href={`/services/${svc.id}/present`}
              className={cn(buttonVariants({ variant: 'default' }), 'h-9 px-4 font-bold shadow-xs')}
            >
              {t('edit.actions.present')}
            </Link>
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

          {/* Utility Controls (Sync Artifact, Download PPTX split button) */}
          <div data-testid="header-utility-controls" className="flex items-center gap-2">
            {isAdmin ? (
              <SyncArtifactButton
                serviceId={svc.id}
                updatedAt={svc.updated_at}
                onSuccess={reloadService}
              />
            ) : null}
            <div className="inline-flex rounded-md shadow-xs">
              <a
                href={`/api/services/${svc.id}/pptx`}
                download
                aria-label={t('edit.actions.downloadPptx')}
                className={cn(buttonVariants({ variant: 'outline' }), 'rounded-r-none h-auto px-3 py-2 border-r-0 text-xs font-medium')}
              >
                {t('edit.actions.downloadPptx')}
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="PPTX Export Options"
                  className={cn(buttonVariants({ variant: 'outline' }), 'rounded-l-none h-auto px-2 py-2')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = `/api/services/${svc.id}/pptx`;
                      a.download = '';
                      a.click();
                    }}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <span className="font-medium text-xs">Word Wrap in PowerPoint (Default)</span>
                    <span className="text-muted-foreground text-[10px]">Text reflows in PowerPoint when edited</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = `/api/services/${svc.id}/pptx?wrap=false`;
                      a.download = '';
                      a.click();
                    }}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <span className="font-medium text-xs">Disable PowerPoint Word Wrap</span>
                    <span className="text-muted-foreground text-[10px]">Preserves fixed unwrapped shape boundaries</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
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
