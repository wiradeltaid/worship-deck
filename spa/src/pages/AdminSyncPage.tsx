import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/auth/SessionProvider';
import {
  pushSyncChunked,
  pullSync,
  getSyncStatus,
  checkSyncAssets,
  uploadSyncAsset,
  downloadSyncAsset,
  loginRemote,
  extractUploadHashes,
  computeBufferSha256,
  SyncHttpError,
  SyncPushPayload,
  SyncPullResponse,
  SyncStatusResponse,
} from '@/lib/sync/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CloudUpload,
  CloudDownload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Server,
  Laptop,
  Clock,
  ShieldAlert,
  Copy,
  Lock,
  LogOut,
  Trash2,
} from 'lucide-react';
import { useT } from '@/lib/i18n/operator';

export interface ServiceConflict {
  global_id: string;
  date: string;
  local_updated_at: string;
  server_updated_at: string;
  local_payload: string;
  server_payload?: string;
  local_service?: any;
  server_service?: any;
}

export function getOriginSafely(urlStr: string): string {
  try {
    return new URL(urlStr, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('wpw_device_id');
  if (!id) {
    const now = BigInt(Date.now());
    const timeHex = now.toString(16).padStart(12, '0');
    const randomBytes = new Uint8Array(10);
    crypto.getRandomValues(randomBytes);
    randomBytes[0] = (randomBytes[0] & 0x0f) | 0x70; // version 7
    randomBytes[2] = (randomBytes[2] & 0x3f) | 0x80; // variant RFC 9562
    const randHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    id = `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}-${randHex.slice(8)}`;
    localStorage.setItem('wpw_device_id', id);
  }
  return id;
}

export default function AdminSyncPage() {
  const { session } = useSession();
  const { t } = useT();

  const [remoteUrl, setRemoteUrl] = useState(() => {
    return localStorage.getItem('wpw_sync_remote_url') || window.location.origin;
  });

  const [inMemoryRemoteToken, setInMemoryRemoteToken] = useState<string | null>(null);
  const [boundRemoteOrigin, setBoundRemoteOrigin] = useState<string>(() =>
    getOriginSafely(localStorage.getItem('wpw_sync_remote_url') || window.location.origin)
  );

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null);
  const [remoteUsername, setRemoteUsername] = useState('admin');
  const [remotePassword, setRemotePassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<'push' | 'pull' | null>(null);

  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncAction, setSyncAction] = useState<'push' | 'pull' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Factory Reset State (DEC-078)
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Conflict Resolution Dialog State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ServiceConflict | null>(null);

  const isForeignHost = () => {
    const currentOrigin = getOriginSafely(remoteUrl.trim() || window.location.origin);
    return currentOrigin !== window.location.origin;
  };

  const handleRemoteUrlChange = (newUrl: string) => {
    setRemoteUrl(newUrl);
    const newOrigin = getOriginSafely(newUrl);
    if (boundRemoteOrigin !== newOrigin) {
      setInMemoryRemoteToken(null);
      setBoundRemoteOrigin(newOrigin);
    }
  };

  const handleDisconnectRemote = () => {
    setInMemoryRemoteToken(null);
    setMessage({ type: 'success', text: 'Remote session disconnected. Token cleared from memory.' });
  };

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await getSyncStatus(window.location.origin);
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch sync status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (session && session.role === 'admin') {
      void fetchStatus();
    }
  }, [session]);

  const handleSaveConfig = () => {
    const trimmed = remoteUrl.trim();
    localStorage.setItem('wpw_sync_remote_url', trimmed);
    const newOrigin = getOriginSafely(trimmed);
    if (boundRemoteOrigin !== newOrigin) {
      setInMemoryRemoteToken(null);
      setBoundRemoteOrigin(newOrigin);
    }
    setMessage({ type: 'success', text: 'Sync connection settings saved.' });
  };

  const executePush = async (token: string | null) => {
    setSyncing(true);
    setSyncAction('push');
    setMessage(null);
    try {
      const targetUrl = remoteUrl.trim() || window.location.origin;
      const targetOrigin = getOriginSafely(targetUrl);

      // 1. Gather local changes
      const pullRes = await pullSync(window.location.origin);
      const mutationId = 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const deviceId = status?.device_id || getOrCreateDeviceId();

      const payload: SyncPushPayload = {
        client_device_id: deviceId,
        mutation_id: mutationId,
        mutations: {
          services: pullRes.changes.services as any,
          hymns: pullRes.changes.hymns as any,
          song_set_entries: pullRes.changes.song_set_entries as any,
          background_library_images: pullRes.changes.background_library_images as any,
          announcement_items: pullRes.changes.announcement_items as any,
          announcement_sets: (pullRes.changes as any).announcement_sets as any,
          announcement_set_slides: (pullRes.changes as any).announcement_set_slides as any,
          artifact_templates: (pullRes.changes as any).artifact_templates as any,
          service_registry_snapshots: (pullRes.changes as any).service_registry_snapshots as any,
          song_set_layouts: (pullRes.changes as any).song_set_layouts as any,
          service_song_set_layouts: (pullRes.changes as any).service_song_set_layouts as any,
        },
        tombstones: pullRes.tombstones,
      };

      const headers: Record<string, string> = {};
      if (token && (!isForeignHost() || boundRemoteOrigin === targetOrigin)) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 2. Check and upload any missing local media assets across all entities
      const shaHashes = extractUploadHashes(pullRes.changes);

      if (shaHashes.length > 0) {
        try {
          const checkResult = await checkSyncAssets(targetUrl, shaHashes, headers);
          for (const missingHash of checkResult.missing) {
            try {
              const assetBuffer = await downloadSyncAsset(window.location.origin, missingHash);
              const computedSha = await computeBufferSha256(assetBuffer);
              if (computedSha.toLowerCase() !== missingHash.toLowerCase()) {
                throw new Error(`Local asset ${missingHash} is corrupted (checksum mismatch); aborting push to prevent corrupt remote state`);
              }
              await uploadSyncAsset(targetUrl, assetBuffer, missingHash, '', headers);
            } catch (assetErr: any) {
              if (assetErr?.status === 401) {
                throw assetErr;
              }
              throw new Error(`Asset upload failed for ${missingHash}: ${assetErr.message || assetErr}`);
            }
          }
        } catch (checkErr: any) {
          if (checkErr?.status === 401) {
            throw checkErr;
          }
          throw new Error(`Asset check failed: ${checkErr.message || checkErr}`);
        }
      }

      const res = await pushSyncChunked(targetUrl, payload, headers);
      if (res.skippedRecords && res.skippedRecords.length > 0) {
        setMessage({
          type: 'error',
          text: `Push completed with warnings: ${res.appliedTotal} changes synchronized; skipped: ${res.skippedRecords.map((s) => `${s.id} (${s.reason})`).join(', ')}`,
        });
      } else {
        setMessage({
          type: 'success',
          text: `Push completed successfully! ${res.appliedTotal} entity changes synchronized.`,
        });
      }
      await fetchStatus();
    } catch (err: any) {
      if (err.status === 401 && isForeignHost()) {
        setInMemoryRemoteToken(null);
        setPendingAction('push');
        setAuthModalMessage('Remote session expired or invalid credentials. Please log in again.');
        setAuthError(null);
        setAuthModalOpen(true);
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to push changes to cloud.' });
      }
    } finally {
      setSyncing(false);
      setSyncAction(null);
    }
  };

  const executePull = async (token: string | null) => {
    setSyncing(true);
    setSyncAction('pull');
    setMessage(null);
    try {
      const targetUrl = remoteUrl.trim() || window.location.origin;
      const targetOrigin = getOriginSafely(targetUrl);

      const headers: Record<string, string> = {};
      if (token && (!isForeignHost() || boundRemoteOrigin === targetOrigin)) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const remoteData = await pullSync(targetUrl, '', headers);

      // Hydrate missing assets from remote into local storage with SHA-256 integrity verification
      const remoteHashes = extractUploadHashes(remoteData.changes);
      const skippedAssets: Array<{ hash: string; reason: string }> = [];
      if (remoteHashes.length > 0) {
        const localCheck = await checkSyncAssets(window.location.origin, remoteHashes);
        for (const missingHash of localCheck.missing) {
          let assetBuffer: ArrayBuffer;
          try {
            assetBuffer = await downloadSyncAsset(targetUrl, missingHash, headers);
          } catch (assetErr: any) {
            if (assetErr.status === 404 || assetErr.message?.includes('not found')) {
              skippedAssets.push({ hash: missingHash, reason: 'remote_not_found' });
              console.warn(`[sync] Auxiliary media asset ${missingHash} not found on remote server; skipping.`);
              continue;
            }
            throw assetErr;
          }
          const actualSha = await computeBufferSha256(assetBuffer);
          if (actualSha.toLowerCase() !== missingHash.toLowerCase()) {
            throw new Error(`Asset checksum verification failed for ${missingHash}: expected ${missingHash}, computed ${actualSha}`);
          }
          await uploadSyncAsset(window.location.origin, assetBuffer, missingHash);
        }
      }

      // Apply remote data into local database
      const mutationId = 'pull-mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const applyPayload: SyncPushPayload = {
        client_device_id: 'cloud-pull',
        mutation_id: mutationId,
        mutations: {
          services: remoteData.changes.services as any,
          hymns: remoteData.changes.hymns as any,
          song_set_entries: remoteData.changes.song_set_entries as any,
          background_library_images: remoteData.changes.background_library_images as any,
          announcement_items: remoteData.changes.announcement_items as any,
          announcement_sets: (remoteData.changes as any).announcement_sets as any,
          announcement_set_slides: (remoteData.changes as any).announcement_set_slides as any,
          artifact_templates: (remoteData.changes as any).artifact_templates as any,
          service_registry_snapshots: (remoteData.changes as any).service_registry_snapshots as any,
          song_set_layouts: (remoteData.changes as any).song_set_layouts as any,
          service_song_set_layouts: (remoteData.changes as any).service_song_set_layouts as any,
        },
        tombstones: remoteData.tombstones,
      };

      try {
        const applyRes = await pushSyncChunked(window.location.origin, applyPayload);
        const skippedNote = skippedAssets.length > 0
          ? ` (${skippedAssets.length} auxiliary media items could not be found on remote server).`
          : '';
        setMessage({
          type: 'success',
          text: `Pull completed successfully! Applied ${applyRes.appliedTotal} updates from cloud.${skippedNote}`,
        });
      } catch (applyErr: any) {
        if (applyErr.conflict || applyErr.message?.includes('newer remote edits') || applyErr.message?.includes('conflict')) {
          // Open interactive conflict resolution modal with real conflicting entity data
          const conf = applyErr.conflict || {};
          const confGid = conf.global_id;
          let localSvc: any = null;
          try {
            const localPull = await pullSync(window.location.origin);
            localSvc = (localPull.changes.services as any[])?.find((s) => !confGid || s.global_id === confGid);
          } catch {}
          const remoteSvc = (remoteData.changes.services as any[])?.find((s) => !confGid || s.global_id === confGid);

          setActiveConflict({
            global_id: confGid || localSvc?.global_id || remoteSvc?.global_id || 'conflict-service',
            date: localSvc?.date || remoteSvc?.date || new Date().toISOString().split('T')[0],
            local_updated_at: localSvc?.updated_at || new Date().toISOString(),
            server_updated_at: conf.server_updated_at || remoteSvc?.updated_at || remoteData.server_timestamp,
            local_payload: localSvc?.raw_payload || 'Local modified worship service',
            server_payload: remoteSvc?.raw_payload || 'Cloud modified worship service',
            local_service: localSvc,
            server_service: remoteSvc,
          });
          setConflictModalOpen(true);
          return;
        }
        throw applyErr;
      }

      await fetchStatus();
    } catch (err: any) {
      if (err.status === 401 && isForeignHost()) {
        setInMemoryRemoteToken(null);
        setPendingAction('pull');
        setAuthModalMessage('Remote session expired or invalid credentials. Please log in again.');
        setAuthError(null);
        setAuthModalOpen(true);
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to pull changes from cloud.' });
      }
    } finally {
      setSyncing(false);
      setSyncAction(null);
    }
  };

  // Push to Cloud (On-Demand Trigger)
  const handlePush = async () => {
    if (isForeignHost() && !inMemoryRemoteToken) {
      setPendingAction('push');
      setAuthModalMessage(null);
      setAuthError(null);
      setAuthModalOpen(true);
      return;
    }
    await executePush(inMemoryRemoteToken);
  };

  // Pull from Cloud (On-Demand Trigger)
  const handlePull = async () => {
    if (isForeignHost() && !inMemoryRemoteToken) {
      setPendingAction('pull');
      setAuthModalMessage(null);
      setAuthError(null);
      setAuthModalOpen(true);
      return;
    }
    await executePull(inMemoryRemoteToken);
  };

  // Remote Handshake Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const targetUrl = remoteUrl.trim() || window.location.origin;
      const submissionOrigin = getOriginSafely(targetUrl);
      const authRes = await loginRemote(targetUrl, remoteUsername.trim(), remotePassword);

      // Verify URL origin was not changed while authentication was in flight
      const currentOrigin = getOriginSafely(remoteUrl.trim() || window.location.origin);
      if (currentOrigin !== submissionOrigin) {
        setRemotePassword('');
        setAuthModalOpen(false);
        setPendingAction(null);
        setMessage({ type: 'warning', text: 'Remote URL was modified during authentication. Session discarded.' });
        return;
      }

      const token = authRes.token;
      setInMemoryRemoteToken(token);
      setBoundRemoteOrigin(submissionOrigin);
      setRemotePassword('');
      setAuthModalOpen(false);

      const action = pendingAction;
      setPendingAction(null);
      if (action === 'push') {
        void executePush(token);
      } else if (action === 'pull') {
        void executePull(token);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Remote authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Conflict Resolution Handlers
  const handleResolveKeepLocal = async () => {
    if (!activeConflict) return;
    setSyncing(true);
    try {
      const nowStr = new Date().toISOString();
      const localServiceData = activeConflict.local_service || {};
      const payload: SyncPushPayload = {
        client_device_id: getOrCreateDeviceId(),
        mutation_id: 'resolve-local-' + Date.now(),
        mutations: {
          services: [
            {
              global_id: activeConflict.global_id,
              date: activeConflict.date,
              raw_payload: activeConflict.local_payload,
              parsed_data: localServiceData.parsed_data,
              images_payload: localServiceData.images_payload,
              afternoon_program: localServiceData.afternoon_program,
              hidden_slide_ids: localServiceData.hidden_slide_ids,
              emergency_patches: localServiceData.emergency_patches,
              updated_at: nowStr,
            },
          ],
        },
      };
      const targetUrl = remoteUrl.trim() || window.location.origin;
      const targetOrigin = getOriginSafely(targetUrl);

      const headers: Record<string, string> = {};
      if (inMemoryRemoteToken && (!isForeignHost() || boundRemoteOrigin === targetOrigin)) {
        headers['Authorization'] = `Bearer ${inMemoryRemoteToken}`;
      }
      await pushSyncChunked(targetUrl, payload, headers);
      setConflictModalOpen(false);
      setMessage({
        type: 'success',
        text: 'Conflict resolved: Local service kept as authoritative and pushed to cloud.',
      });
      await fetchStatus();
    } catch (err: any) {
      if (err.status === 401 && isForeignHost()) {
        setInMemoryRemoteToken(null);
        setPendingAction('push');
        setConflictModalOpen(false);
        setAuthModalMessage('Remote session expired or invalid credentials. Please log in again.');
        setAuthError(null);
        setAuthModalOpen(true);
      } else {
        setMessage({ type: 'error', text: 'Failed to keep local version: ' + err.message });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveUseCloud = async () => {
    if (!activeConflict) return;
    setSyncing(true);
    try {
      const serverServiceData = activeConflict.server_service || {};
      const payload: SyncPushPayload = {
        client_device_id: getOrCreateDeviceId(),
        mutation_id: 'resolve-cloud-' + Date.now(),
        mutations: {
          services: [
            {
              global_id: activeConflict.global_id,
              date: activeConflict.date,
              raw_payload: activeConflict.server_payload || activeConflict.local_payload,
              parsed_data: serverServiceData.parsed_data,
              images_payload: serverServiceData.images_payload,
              afternoon_program: serverServiceData.afternoon_program,
              hidden_slide_ids: serverServiceData.hidden_slide_ids,
              emergency_patches: serverServiceData.emergency_patches,
              updated_at: activeConflict.server_updated_at,
            },
          ],
        },
      };
      await pushSyncChunked(window.location.origin, payload);
      setConflictModalOpen(false);
      setMessage({
        type: 'success',
        text: 'Conflict resolved: Cloud service version accepted and updated locally.',
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to apply cloud version: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveSaveBoth = async () => {
    if (!activeConflict) return;
    setSyncing(true);
    try {
      // 1. Create duplicate local copy with fresh global_id and "(Copy)" in title
      const duplicatePayload = activeConflict.local_payload + ' (Copy)';
      const createRes = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: activeConflict.date,
          raw_payload: duplicatePayload,
        }),
      });
      if (!createRes.ok) {
        throw new Error('Failed to create local duplicate copy');
      }

      // 2. Accept cloud version for original service
      const payload: SyncPushPayload = {
        client_device_id: getOrCreateDeviceId(),
        mutation_id: 'resolve-both-' + Date.now(),
        mutations: {
          services: [
            {
              global_id: activeConflict.global_id,
              date: activeConflict.date,
              raw_payload: activeConflict.server_payload || activeConflict.local_payload,
              updated_at: activeConflict.server_updated_at,
            },
          ],
        },
      };
      await pushSyncChunked(window.location.origin, payload);
      setConflictModalOpen(false);
      setMessage({
        type: 'success',
        text: 'Conflict resolved: Saved both! Created duplicate local copy and accepted cloud version.',
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to save both: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleFactoryReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/admin/reset-factory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || `Factory reset failed with status ${res.status}`);
      }
      setResetModalOpen(false);
      setMessage({
        type: 'success',
        text: t('sync.factoryReset.success'),
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `${t('sync.factoryReset.failed')}: ${err.message}`,
      });
    } finally {
      setResetting(false);
    }
  };

  if (!session) return null;
  if (session.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Data Synchronization</h2>
        <p className="text-muted-foreground mt-1">
          On-demand bidirectional synchronization between offline desktop workstations and cloud web servers.
        </p>
      </div>

      {status?.presenter_active && (
        <Alert variant="destructive" className="border-red-500 bg-red-500/10 text-red-700 dark:text-red-300">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle className="font-bold">Presentation Actively Projecting</AlertTitle>
          <AlertDescription>
            The presenter mode is currently live. Synchronizations that mutate active service schedules are paused to prevent interrupting live slide displays.
          </AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert
          className={
            message.type === 'error'
              ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
              : message.type === 'warning'
              ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              : 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          }
        >
          {message.type === 'error' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          <AlertTitle className="capitalize font-semibold">{message.type}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Sync Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-primary" /> Last Synced
            </CardDescription>
            <CardTitle className="text-lg">
              {status?.last_synced_at ? new Date(status.last_synced_at).toLocaleString() : 'Never'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Monotonic revision tracking active</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium">
              <Laptop className="w-4 h-4 text-primary" /> Client Device
            </CardDescription>
            <CardTitle className="text-lg truncate">
              {status?.device_id || 'Standalone Desktop'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="font-mono text-xs">
              UUIDv7 Monotonic
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium">
              <Server className="w-4 h-4 text-primary" /> Tombstones
            </CardDescription>
            <CardTitle className="text-lg">
              {status?.total_tombstones ?? 0} deletions tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Zombie resurrection protected</span>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Actions</CardTitle>
          <CardDescription>
            All data synchronization is strictly on-demand. No background timers or polling routines run.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Button
            size="lg"
            className="flex-1 gap-2 font-semibold"
            onClick={handlePush}
            disabled={syncing || status?.presenter_active}
          >
            <CloudUpload className="w-5 h-5" />
            {syncing && syncAction === 'push' ? 'Pushing to Cloud...' : 'Push to Cloud'}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="flex-1 gap-2 font-semibold"
            onClick={handlePull}
            disabled={syncing || status?.presenter_active}
          >
            <CloudDownload className="w-5 h-5" />
            {syncing && syncAction === 'pull' ? 'Pulling from Cloud...' : 'Pull from Cloud'}
          </Button>

          <Button
            size="lg"
            variant="ghost"
            onClick={fetchStatus}
            disabled={loadingStatus || syncing}
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>

      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Remote Server Connection</CardTitle>
              <CardDescription>
                Configure the central church web server URL for cross-machine delta synchronization.
              </CardDescription>
            </div>
            <div>
              {!isForeignHost() ? (
                <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  Local Workstation (Active Session)
                </Badge>
              ) : inMemoryRemoteToken ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    Remote Session Active (In-Memory)
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleDisconnectRemote}
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  Remote Cloud (Authentication Required)
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="remote-url">Remote Web Server URL</Label>
            <Input
              id="remote-url"
              placeholder="https://worship.mychurch.org"
              value={remoteUrl}
              onChange={(e) => handleRemoteUrlChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Target WorshipDeck server instance URL. When connecting to a remote server, authentication is prompted on-demand and held exclusively in-memory.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSaveConfig}>Save Connection Settings</Button>
        </CardFooter>
      </Card>

      {/* Factory Reset Section (DEC-078) */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> {t('sync.factoryReset.title')}
          </CardTitle>
          <CardDescription>
            {t('sync.factoryReset.description')}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setResetModalOpen(true)}
            disabled={syncing || resetting}
          >
            {t('sync.factoryReset.button')}
          </Button>
        </CardFooter>
      </Card>

      {/* Factory Reset Confirmation Modal */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" /> {t('sync.factoryReset.confirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('sync.factoryReset.confirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetModalOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleFactoryReset}
              disabled={resetting}
            >
              {resetting ? t('sync.factoryReset.inProgress') : t('sync.factoryReset.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ephemeral Remote Authentication Modal */}
      <Dialog
        open={authModalOpen}
        onOpenChange={(open) => {
          setAuthModalOpen(open);
          if (!open) {
            setRemotePassword('');
            setAuthError(null);
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Connect to Remote WorshipDeck Server
            </DialogTitle>
            <DialogDescription>
              Enter Admin Username &amp; Password for <span className="font-mono text-foreground font-semibold">{getOriginSafely(remoteUrl)}</span>. Credentials and tokens are held in-memory and never stored on disk.
            </DialogDescription>
          </DialogHeader>

          {authModalMessage && (
            <Alert className="border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{authModalMessage}</AlertDescription>
            </Alert>
          )}

          {authError && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{authError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="remote-username">Admin Username</Label>
              <Input
                id="remote-username"
                autoFocus
                required
                autoComplete="username"
                value={remoteUsername}
                onChange={(e) => setRemoteUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remote-password">Admin Password</Label>
              <Input
                id="remote-password"
                type="password"
                required
                autoComplete="current-password"
                value={remotePassword}
                onChange={(e) => setRemotePassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAuthModalOpen(false);
                  setRemotePassword('');
                  setAuthError(null);
                  setPendingAction(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={authSubmitting || !remoteUsername || !remotePassword}>
                {authSubmitting ? 'Authenticating...' : 'Connect & Sync'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Interactive Conflict Resolution Modal */}
      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Service Rundown Conflict Detected
            </DialogTitle>
            <DialogDescription>
              This service rundown was modified both locally and on the cloud server. Choose how you want to resolve the conflict.
            </DialogDescription>
          </DialogHeader>

          {activeConflict && (
            <div className="space-y-4 py-3 border-y border-border my-2">
              <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 rounded-lg text-sm">
                <div>
                  <span className="font-semibold block text-xs text-muted-foreground uppercase">Local Version</span>
                  <p className="font-medium mt-1">{activeConflict.local_payload}</p>
                  <span className="text-xs text-muted-foreground block mt-1">
                    Updated: {new Date(activeConflict.local_updated_at).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <span className="font-semibold block text-xs text-muted-foreground uppercase">Cloud Version</span>
                  <p className="font-medium mt-1">{activeConflict.server_payload}</p>
                  <span className="text-xs text-muted-foreground block mt-1">
                    Updated: {new Date(activeConflict.server_updated_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleResolveKeepLocal} className="sm:flex-1">
              Keep Local Version
            </Button>
            <Button variant="outline" onClick={handleResolveUseCloud} className="sm:flex-1">
              Use Cloud Version
            </Button>
            <Button onClick={handleResolveSaveBoth} className="sm:flex-1 gap-1">
              <Copy className="w-4 h-4" /> Save Both (Duplicate)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
