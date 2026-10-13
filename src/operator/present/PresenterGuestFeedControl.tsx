import { memo, useEffect, useRef, useState } from 'react';
import {
  Video,
  VideoOff,
  Play,
  Undo2,
  AlertCircle,
  Camera,
  ChevronDown,
} from 'lucide-react';
import { useT } from '@/lib/i18n/operator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CaptureDeviceOption } from '@/lib/capture-broker';
import type {
  PresenterGuestFeedController,
  PresenterGuestFeedSnapshot,
} from './presenter-guest-feed-controller';

import type { PresenterRemoteIntent, RemoteControlSessionState } from '@/lib/presenter-remote-client';

export interface PresenterGuestFeedControlProps {
  controller: PresenterGuestFeedController;
  isProjectorResponding: boolean;
  className?: string;
  isRemote?: boolean;
  mirroredGuestFeed?: RemoteControlSessionState['guestFeed'];
  onRemoteIntent?: (intent: PresenterRemoteIntent) => void;
  planIdentity?: string;
}

export default memo(function PresenterGuestFeedControl({
  controller,
  isProjectorResponding,
  className,
  isRemote = false,
  mirroredGuestFeed,
  onRemoteIntent,
  planIdentity = '',
}: PresenterGuestFeedControlProps) {
  const { t } = useT();
  const [snapshot, setSnapshot] = useState<PresenterGuestFeedSnapshot>(() =>
    controller
      ? controller.getSnapshot()
      : {
          uiState: mirroredGuestFeed?.uiState || 'idle',
          devices: [],
          selectedDeviceId: 'host-capture',
          isDeviceStale: false,
          errorMessage: mirroredGuestFeed?.errorMessage || null,
          projection: mirroredGuestFeed?.projection || { kind: 'deck' },
          guestAttemptId: null,
          guestSessionId: null,
          frameHealth: mirroredGuestFeed?.frameHealth || 'unknown',
          isConsoleFocused: true,
          lastHealth: null,
        }
  );

  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const [deviceMenuDevices, setDeviceMenuDevices] = useState<CaptureDeviceOption[]>([]);
  const deviceMenuRequestId = useRef(0);

  useEffect(() => {
    void controller.enumerateDevices();
    return controller.subscribe((next) => {
      setSnapshot(next);
      if (!deviceMenuOpen) {
        setDeviceMenuDevices(next.devices);
      }
    });
  }, [controller, deviceMenuOpen]);

  useEffect(() => {
    if (isRemote && mirroredGuestFeed) {
      setSnapshot((prev) => ({
        ...prev,
        uiState: mirroredGuestFeed.uiState || 'idle',
        errorMessage: mirroredGuestFeed.errorMessage || null,
        projection: mirroredGuestFeed.projection || { kind: 'deck' },
        frameHealth: mirroredGuestFeed.frameHealth || 'unknown',
      }));
    }
  }, [isRemote, mirroredGuestFeed]);

  const handleDeviceMenuOpenChange = (open: boolean) => {
    if (isRemote || !controller) return;
    if (!open) {
      deviceMenuRequestId.current++;
      setDeviceMenuOpen(false);
      return;
    }
    const requestId = ++deviceMenuRequestId.current;
    setDeviceMenuOpen(true);
    void controller.enumerateDevices().then((devs) => {
      if (requestId === deviceMenuRequestId.current) {
        setDeviceMenuDevices(devs);
      }
    });
  };

  // Window focus listener for hotkey availability warning
  useEffect(() => {
    if (isRemote || !controller) return;
    const onFocus = () => controller.setConsoleFocused(true);
    const onBlur = () => controller.setConsoleFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [controller, isRemote]);

  const {
    uiState,
    devices,
    selectedDeviceId,
    isDeviceStale,
    errorMessage,
    isConsoleFocused,
  } = snapshot;

  const isGuestActive = uiState === 'guest-pending' || uiState === 'confirmed-live';
  const hasUsableDevices = devices.length > 0 && devices.some((d) => Boolean(d.deviceId));
  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId);
  const selectedLabel = isRemote
    ? 'Host USB HDMI'
    : selectedDevice
    ? selectedDevice.label
    : !hasUsableDevices
    ? t('presenter.guestFeed.noDevices')
    : t('presenter.guestFeed.selectDevice');

  return (
    <div
      data-testid="presenter-guest-feed-control"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs',
        isGuestActive && 'border-emerald-500/40 bg-emerald-500/5',
        className
      )}
    >
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
        <Camera className="size-3.5" />
        <span>{t('presenter.guestFeed.title')}</span>
      </div>

      {/* Device Picker via shadcn DropdownMenu (suppressed on remote when confirmed-live) */}
      {!(isRemote && uiState === 'confirmed-live') && (
        <DropdownMenu
          open={deviceMenuOpen}
          onOpenChange={handleDeviceMenuOpenChange}
        >
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uiState === 'arming' || isGuestActive}
                data-testid="guest-device-select-trigger"
                className="h-7 max-w-[170px] justify-between gap-1 truncate px-2 text-xs font-normal"
              >
                <span className="truncate">{selectedLabel}</span>
                <ChevronDown className="size-3 shrink-0 opacity-50" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-56 text-xs">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                {t('presenter.guestFeed.selectDevice')}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {deviceMenuDevices.length === 0 ? (
              <div className="flex flex-col gap-2 p-2 text-xs">
                <span className="text-muted-foreground">
                  {t('presenter.guestFeed.noDevices')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="guest-enable-access-dropdown-button"
                  onClick={() => {
                    if (controller) void controller.requestPermission();
                  }}
                  className="h-7 w-full gap-1 px-2 text-xs"
                >
                  <Camera className="size-3" />
                  <span>{t('presenter.guestFeed.enableAccess')}</span>
                </Button>
              </div>
            ) : (
              <DropdownMenuRadioGroup
                value={selectedDeviceId || ''}
                onValueChange={(val) => {
                  if (val && controller) {
                    controller.selectDevice(val);
                    setDeviceMenuOpen(false);
                  }
                }}
              >
                {deviceMenuDevices.map((d) => (
                  <DropdownMenuRadioItem
                    key={d.deviceId}
                    value={d.deviceId}
                    className="text-xs"
                  >
                    {d.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Enable Camera Access CTA when no devices discovered */}
      {!isRemote && !hasUsableDevices && (uiState === 'idle' || uiState === 'error') && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="guest-enable-access-button"
          onClick={() => void controller?.requestPermission()}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Camera className="size-3" />
          <span>{t('presenter.guestFeed.enableAccess')}</span>
        </Button>
      )}

      {/* Arm / Disarm Button */}
      {uiState === 'idle' || uiState === 'error' || uiState === 'arming' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="guest-arm-button"
          disabled={(!selectedDeviceId && !isRemote) || uiState === 'arming'}
          onClick={() => {
            if (isRemote) {
              onRemoteIntent?.({ type: 'guest-arm', planIdentity: planIdentity || '' });
              return;
            }
            if (selectedDeviceId && controller) controller.arm(selectedDeviceId);
          }}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Video className="size-3" />
          <span>
            {uiState === 'arming'
              ? t('presenter.guestFeed.arming')
              : t('presenter.guestFeed.arm')}
          </span>
        </Button>
      ) : !(isRemote && uiState === 'confirmed-live') ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="guest-disarm-button"
          onClick={() => {
            if (isRemote) {
              onRemoteIntent?.({ type: 'guest-disarm', planIdentity: planIdentity || '' });
              return;
            }
            controller?.disarm();
          }}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <VideoOff className="size-3" />
          <span>{t('presenter.guestFeed.disarm')}</span>
        </Button>
      ) : null}

      {/* State Badges */}
      {uiState === 'ready' && (
        <Badge
          variant="outline"
          data-testid="guest-ready-badge"
          className="border-blue-500/40 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
        >
          {t('presenter.guestFeed.ready')}
        </Badge>
      )}

      {uiState === 'guest-pending' && (
        <Badge
          variant="outline"
          data-testid="guest-pending-badge"
          className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400 animate-pulse"
        >
          {t('presenter.guestFeed.waitingProjector')}
        </Badge>
      )}

      {uiState === 'confirmed-live' && (
        <Badge
          variant="default"
          data-testid="guest-live-badge"
          className="bg-emerald-600 text-white text-[10px] font-semibold"
        >
          {t('presenter.guestFeed.live')}
        </Badge>
      )}

      {/* Switch to Guest Action */}
      {uiState === 'ready' && (
        <Button
          type="button"
          size="sm"
          variant="default"
          data-testid="guest-switch-button"
          disabled={!isProjectorResponding}
          onClick={() => {
            if (isRemote) {
              onRemoteIntent?.({ type: 'guest-project', projected: true, planIdentity: planIdentity || '' });
              return;
            }
            controller?.switch(isProjectorResponding);
          }}
          className="h-7 gap-1 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
          title={
            !isProjectorResponding
              ? t('presenter.guestFeed.waitingProjector')
              : t('presenter.guestFeed.switchToGuest')
          }
        >
          <Play className="size-3" />
          <span>{t('presenter.guestFeed.switchToGuest')}</span>
        </Button>
      )}

      {/* Revert to Deck Action (Esc) */}
      {isGuestActive && (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          data-testid="guest-revert-button"
          onClick={() => {
            if (isRemote) {
              onRemoteIntent?.({ type: 'guest-project', projected: false, planIdentity: planIdentity || '' });
              return;
            }
            controller?.revertToDeck();
          }}
          className="h-7 gap-1 px-2.5 text-xs font-semibold"
        >
          <Undo2 className="size-3" />
          <span>{t('presenter.guestFeed.revertToDeck')}</span>
        </Button>
      )}

      {/* Stale device warning */}
      {isDeviceStale && (
        <span
          role="status"
          data-testid="guest-stale-warning"
          className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
        >
          <AlertCircle className="size-3" />
          {t('presenter.guestFeed.staleDevice')}
        </span>
      )}

      {/* Unfocused hotkeys warning */}
      {!isConsoleFocused && (uiState === 'ready' || isGuestActive) && (
        <span
          role="status"
          data-testid="guest-unfocused-warning"
          className="text-[11px] text-muted-foreground"
        >
          {t('presenter.guestFeed.hotkeysUnavailable')}
        </span>
      )}

      {/* Error display */}
      {errorMessage && (
        <span
          role="alert"
          data-testid="guest-error-message"
          className="text-[11px] text-destructive"
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
});
