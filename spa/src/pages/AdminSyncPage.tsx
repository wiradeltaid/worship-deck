import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/auth/SessionProvider';
import {
  pushSync,
  pullSync,
  getSyncStatus,
  checkSyncAssets,
  uploadSyncAsset,
  downloadSyncAsset,
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
} from 'lucide-react';

export interface ServiceConflict {
  global_id: string;
  date: string;
  local_updated_at: string;
  server_updated_at: string;
  local_payload: string;
  server_payload?: string;
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

  const [remoteUrl, setRemoteUrl] = useState(() => {
    return localStorage.getItem('wpw_sync_remote_url') || window.location.origin;
  });
  const [deviceToken, setDeviceToken] = useState(() => {
    return localStorage.getItem('wpw_sync_device_token') || '';
  });

  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncAction, setSyncAction] = useState<'push' | 'pull' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Conflict Resolution Dialog State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ServiceConflict | null>(null);

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
    localStorage.setItem('wpw_sync_remote_url', remoteUrl.trim());
    localStorage.setItem('wpw_sync_device_token', deviceToken.trim());
    setMessage({ type: 'success', text: 'Sync connection settings saved.' });
  };

  // Push to Cloud (On-Demand Trigger)
  const handlePush = async () => {
    setSyncing(true);
    setSyncAction('push');
    setMessage(null);
    try {
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
        },
        tombstones: pullRes.tombstones,
      };

      const headers: Record<string, string> = {};
      if (deviceToken.trim()) {
        headers['Authorization'] = `Bearer ${deviceToken.trim()}`;
      }

      // 2. Check and upload any missing local media assets (flyers, backgrounds)
      const assetUrls: string[] = [];
      for (const ann of (pullRes.changes.announcement_items as any[]) || []) {
        if (ann.image_url) assetUrls.push(ann.image_url);
      }
      for (const bg of (pullRes.changes.background_library_images as any[]) || []) {
        if (bg.url) assetUrls.push(bg.url);
      }
      const shaHashes = assetUrls
        .map((url) => {
          const match = url.match(/([a-fA-F0-9]{64})/);
          return match ? match[1].toLowerCase() : null;
        })
        .filter((h): h is string => Boolean(h));

      if (shaHashes.length > 0) {
        try {
          const checkResult = await checkSyncAssets(remoteUrl.trim() || window.location.origin, shaHashes, headers);
          for (const missingHash of checkResult.missing) {
            try {
              const assetBuffer = await downloadSyncAsset(window.location.origin, missingHash);
              await uploadSyncAsset(remoteUrl.trim() || window.location.origin, assetBuffer, missingHash, '', headers);
            } catch (assetErr) {
              console.warn(`Asset upload failed for ${missingHash}:`, assetErr);
            }
          }
        } catch (checkErr) {
          console.warn('Asset check failed:', checkErr);
        }
      }

      const res = await pushSync(remoteUrl.trim() || window.location.origin, payload, headers);
      setMessage({
        type: 'success',
        text: `Push completed successfully! ${res.applied_count ?? 0} entity changes synchronized.`,
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to push changes to cloud.' });
    } finally {
      setSyncing(false);
      setSyncAction(null);
    }
  };

  // Pull from Cloud (On-Demand Trigger)
  const handlePull = async () => {
    setSyncing(true);
    setSyncAction('pull');
    setMessage(null);
    try {
      const headers: Record<string, string> = {};
      if (deviceToken.trim()) {
        headers['Authorization'] = `Bearer ${deviceToken.trim()}`;
      }

      const remoteData = await pullSync(remoteUrl.trim() || window.location.origin, '', headers);

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
        },
        tombstones: remoteData.tombstones,
      };

      try {
        const applyRes = await pushSync(window.location.origin, applyPayload);
        setMessage({
          type: 'success',
          text: `Pull completed successfully! Applied ${applyRes.applied_count ?? 0} updates from cloud.`,
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
          });
          setConflictModalOpen(true);
          return;
        }
        throw applyErr;
      }

      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to pull changes from cloud.' });
    } finally {
      setSyncing(false);
      setSyncAction(null);
    }
  };

  // Conflict Resolution Handlers
  const handleResolveKeepLocal = async () => {
    if (!activeConflict) return;
    setSyncing(true);
    try {
      const nowStr = new Date().toISOString();
      const payload: SyncPushPayload = {
        client_device_id: getOrCreateDeviceId(),
        mutation_id: 'resolve-local-' + Date.now(),
        mutations: {
          services: [
            {
              global_id: activeConflict.global_id,
              date: activeConflict.date,
              raw_payload: activeConflict.local_payload,
              updated_at: nowStr,
            },
          ],
        },
      };
      const headers: Record<string, string> = {};
      if (deviceToken.trim()) {
        headers['Authorization'] = `Bearer ${deviceToken.trim()}`;
      }
      await pushSync(remoteUrl.trim() || window.location.origin, payload, headers);
      setConflictModalOpen(false);
      setMessage({
        type: 'success',
        text: 'Conflict resolved: Local service kept as authoritative and pushed to cloud.',
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to keep local version: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveUseCloud = async () => {
    if (!activeConflict) return;
    setSyncing(true);
    try {
      const payload: SyncPushPayload = {
        client_device_id: getOrCreateDeviceId(),
        mutation_id: 'resolve-cloud-' + Date.now(),
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
      await pushSync(window.location.origin, payload);
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
      await pushSync(window.location.origin, payload);
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
          <CardTitle>Remote Server Connection</CardTitle>
          <CardDescription>
            Configure the central church web server URL and device authorization token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="remote-url">Remote Web Server URL</Label>
            <Input
              id="remote-url"
              placeholder="https://worship.mychurch.org"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-token">Device Authorization Token (Optional)</Label>
            <Input
              id="device-token"
              type="password"
              placeholder="Bearer token or 6-digit pairing code"
              value={deviceToken}
              onChange={(e) => setDeviceToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used when connecting to an authenticated remote church server instance.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSaveConfig}>Save Connection Settings</Button>
        </CardFooter>
      </Card>

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
