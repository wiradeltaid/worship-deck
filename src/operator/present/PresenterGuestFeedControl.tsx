import { memo, useEffect, useState } from 'react';
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
import type {
  PresenterGuestFeedController,
  PresenterGuestFeedSnapshot,
} from './presenter-guest-feed-controller';

export interface PresenterGuestFeedControlProps {
  controller: PresenterGuestFeedController;
  isProjectorResponding: boolean;
  className?: string;
}

export default memo(function PresenterGuestFeedControl({
  controller,
  isProjectorResponding,
  className,
}: PresenterGuestFeedControlProps) {
  const { t } = useT();
  const [snapshot, setSnapshot] = useState<PresenterGuestFeedSnapshot>(() =>
    controller.getSnapshot()
  );

  useEffect(() => {
    void controller.enumerateDevices();
    return controller.subscribe((next) => {
      setSnapshot(next);
    });
  }, [controller]);

  // Window focus listener for hotkey availability warning
  useEffect(() => {
    const onFocus = () => controller.setConsoleFocused(true);
    const onBlur = () => controller.setConsoleFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [controller]);

  const {
    uiState,
    devices,
    selectedDeviceId,
    isDeviceStale,
    errorMessage,
    isConsoleFocused,
  } = snapshot;

  const isGuestActive = uiState === 'guest-pending' || uiState === 'confirmed-live';
  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId);
  const selectedLabel = selectedDevice
    ? selectedDevice.label
    : devices.length === 0
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

      {/* Device Picker via shadcn DropdownMenu */}
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            void controller.enumerateDevices();
          }
        }}
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
          {devices.length === 0 ? (
            <div className="p-2 text-muted-foreground text-xs">
              {t('presenter.guestFeed.noDevices')}
            </div>
          ) : (
            <DropdownMenuRadioGroup
              value={selectedDeviceId || ''}
              onValueChange={(val) => {
                if (val) controller.selectDevice(val);
              }}
            >
              {devices.map((d) => (
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

      {/* Arm / Disarm Button */}
      {uiState === 'idle' || uiState === 'error' || uiState === 'arming' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="guest-arm-button"
          disabled={!selectedDeviceId || uiState === 'arming'}
          onClick={() => {
            if (selectedDeviceId) controller.arm(selectedDeviceId);
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
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="guest-disarm-button"
          onClick={() => controller.disarm()}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <VideoOff className="size-3" />
          <span>{t('presenter.guestFeed.disarm')}</span>
        </Button>
      )}

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
          onClick={() => controller.switch(isProjectorResponding)}
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
          onClick={() => controller.revertToDeck()}
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
