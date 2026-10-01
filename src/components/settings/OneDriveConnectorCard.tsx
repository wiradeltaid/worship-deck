import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/operator';
import { Cloud, Folder, CheckCircle2, XCircle, RefreshCw, ExternalLink, Unlink } from 'lucide-react';
import OneDriveFolderPickerModal from './OneDriveFolderPickerModal';

export interface OneDrivePublicConfig {
  connected: boolean;
  account_email: string;
  account_name: string;
  target_folder_id: string;
  target_folder_path: string;
  sync_mode: 'ask' | 'always' | 'off';
}

export default function OneDriveConnectorCard() {
  const { t } = useT();
  const [config, setConfig] = useState<OneDrivePublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/onedrive', { credentials: 'same-origin' });
      if (res.ok) {
        const data = (await res.json()) as OneDrivePublicConfig;
        setConfig(data);
      }
    } catch {
      // Offline or network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Listen for popup auth completion message
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ONEDRIVE_AUTH_SUCCESS') {
        setConnecting(false);
        setFeedback({ type: 'success', text: t('onedrive.syncMode.saved') });
        fetchConfig();
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [fetchConfig, t]);

  const handleConnect = async () => {
    setConnecting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/onedrive/auth-url', { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error('Failed to obtain authorization URL');
      }
      const data = (await res.json()) as { auth_url: string };
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.auth_url,
        'onedrive_auth_window',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to top-level navigation if popup blocked
        window.location.href = data.auth_url;
      }
    } catch {
      setConnecting(false);
      setFeedback({ type: 'error', text: t('onedrive.syncMode.failed') });
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/onedrive', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                connected: false,
                account_email: '',
                account_name: '',
              }
            : null
        );
      }
    } catch {
      setFeedback({ type: 'error', text: t('onedrive.syncMode.failed') });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncModeChange = async (mode: 'ask' | 'always' | 'off') => {
    if (!config || config.sync_mode === mode) return;
    setSavingMode(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/onedrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sync_mode: mode }),
      });
      if (res.ok) {
        const updated = (await res.json()) as OneDrivePublicConfig;
        setConfig(updated);
        setFeedback({ type: 'success', text: t('onedrive.syncMode.saved') });
      } else {
        throw new Error();
      }
    } catch {
      setFeedback({ type: 'error', text: t('onedrive.syncMode.failed') });
    } finally {
      setSavingMode(false);
    }
  };

  const handleSelectFolder = async (folderId: string, folderPath: string) => {
    try {
      const res = await fetch('/api/settings/onedrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          target_folder_id: folderId,
          target_folder_path: folderPath,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as OneDrivePublicConfig;
        setConfig(updated);
        setFeedback({ type: 'success', text: t('onedrive.syncMode.saved') });
      }
    } catch {
      setFeedback({ type: 'error', text: t('onedrive.syncMode.failed') });
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
          <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>Loading OneDrive settings…</span>
        </div>
      </Card>
    );
  }

  const isConnected = Boolean(config?.connected);

  return (
    <Card className="border border-border/80 shadow-sm" data-testid="onedrive-connector-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              {t('onedrive.title')}
              {isConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('onedrive.connectedAs')}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground gap-1 text-[11px] font-medium">
                  <XCircle className="w-3 h-3" />
                  {t('onedrive.notConnected')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {t('onedrive.desc')}
            </CardDescription>
          </div>
        </div>

        <div>
          {isConnected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
            >
              {disconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              {disconnecting ? t('onedrive.disconnecting') : t('onedrive.disconnect')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
            >
              {connecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              {connecting ? t('onedrive.connecting') : t('onedrive.connect')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-destructive/15 text-destructive border border-destructive/30'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/60">
            <div>
              <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Account</Label>
              <p className="text-sm font-semibold text-foreground mt-0.5">{config?.account_name || 'Microsoft User'}</p>
              <p className="text-xs text-muted-foreground font-mono">{config?.account_email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('onedrive.targetFolder')}</Label>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-xs font-mono bg-muted/80 px-2.5 py-1 rounded-md border border-border/80 truncate text-foreground flex-1">
                  {config?.target_folder_path || t('onedrive.noFolderSelected')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFolderPickerOpen(true)}
                  className="shrink-0 text-xs gap-1"
                >
                  <Folder className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  {config?.target_folder_path ? t('onedrive.changeFolder') : t('onedrive.selectFolder')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Mode Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('onedrive.syncMode.title')}
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['ask', 'always', 'off'] as const).map((mode) => {
              const isActive = (config?.sync_mode || 'ask') === mode;
              const labelKey = `onedrive.syncMode.${mode}` as const;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={mode}
                  onClick={() => !savingMode && handleSyncModeChange(mode)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!savingMode) handleSyncModeChange(mode);
                    }
                  }}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'border-sky-500/80 bg-sky-500/10 ring-1 ring-sky-500/30'
                      : 'border-border/80 hover:bg-muted/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-xs capitalize text-foreground">
                      {mode === 'ask' ? 'Ask on Export' : mode === 'always' ? 'Always Sync' : 'Sync Disabled'}
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isActive ? 'border-sky-500 bg-sky-500' : 'border-muted-foreground/40'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    {t(labelKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      <OneDriveFolderPickerModal
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        currentFolderId={config?.target_folder_id}
        currentFolderPath={config?.target_folder_path}
        onSelectFolder={handleSelectFolder}
      />
    </Card>
  );
}
