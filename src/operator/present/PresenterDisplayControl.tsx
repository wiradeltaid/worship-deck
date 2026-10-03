import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Tv,
  Monitor,
  ChevronDown,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { useT } from '@/lib/i18n/operator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  type DisplayTargetConfig,
  type ScreenInfo,
  type ResolvedLaunchTarget,
  DEFAULT_DISPLAY_TARGET_CONFIG,
  getDisplayTargetConfig,
  saveDisplayTargetConfig,
  detectAvailableScreens,
  subscribeScreenTopology,
  resolveLaunchTarget,
} from '@/lib/display-target';
import type { LivenessVerdict } from '@/lib/projector-liveness';

export interface PresenterDisplayControlProps {
  liveness: LivenessVerdict;
  presentationLock?: boolean;
  onOpenOrFocus: () => void;
  onRelocate?: (target: ResolvedLaunchTarget) => void;
  onCloseProjector?: () => void;
  className?: string;
}

export default memo(function PresenterDisplayControl({
  liveness,
  presentationLock = false,
  onOpenOrFocus,
  onRelocate,
  onCloseProjector,
  className,
}: PresenterDisplayControlProps) {
  const { t } = useT();

  const [config, setConfig] = useState<DisplayTargetConfig>(() => getDisplayTargetConfig());
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  // Initial detection and topology subscription
  const refreshScreens = useCallback(async () => {
    setIsDetecting(true);
    try {
      const detected = await detectAvailableScreens();
      setScreens(detected);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    refreshScreens();
    const unsubscribe = subscribeScreenTopology(() => {
      refreshScreens();
    });
    return () => {
      unsubscribe();
    };
  }, [refreshScreens]);

  // Resolve current target dynamically
  const resolvedTarget = useMemo(() => {
    return resolveLaunchTarget(config, screens);
  }, [config, screens]);

  // Update configuration handler
  const handleConfigChange = useCallback(
    (newConfig: DisplayTargetConfig) => {
      setConfig(newConfig);
      saveDisplayTargetConfig(newConfig);

      // If already active/live, trigger live relocation
      if (liveness === 'live' && onRelocate) {
        const newResolved = resolveLaunchTarget(newConfig, screens);
        onRelocate(newResolved);
      }
    },
    [liveness, onRelocate, screens]
  );

  // Target radio selection handler
  const handleSelectRadio = useCallback(
    (value: string) => {
      if (value === 'window-mode') {
        handleConfigChange({
          ...config,
          targetPreference: 'window-mode',
          mode: 'window',
        });
      } else if (value === 'primary-display') {
        handleConfigChange({
          ...config,
          targetPreference: 'primary-display',
          mode: 'fullscreen',
        });
      } else if (value === 'external-default') {
        handleConfigChange({
          ...config,
          targetPreference: 'external-display',
          mode: 'fullscreen',
          rememberedScreenId: undefined,
        });
      } else {
        // Specific screen ID
        handleConfigChange({
          ...config,
          targetPreference: 'specific-display',
          mode: 'fullscreen',
          rememberedScreenId: value,
        });
      }
    },
    [config, handleConfigChange]
  );

  // Compute radio group active value
  const radioValue = useMemo(() => {
    if (config.targetPreference === 'window-mode') return 'window-mode';
    if (config.targetPreference === 'primary-display') return 'primary-display';
    if (config.targetPreference === 'specific-display' && config.rememberedScreenId) {
      const matched = screens.find((s) => s.id === config.rememberedScreenId);
      if (matched) return matched.id;
    }
    return 'external-default';
  }, [config, screens]);

  // Primary button label & icon
  const { buttonLabel, buttonIcon, buttonVariant } = useMemo(() => {
    if (liveness === 'live') {
      return {
        buttonLabel: t('presenter.displayTarget.active'),
        buttonIcon: <CheckCircle2 className="size-4 text-emerald-400" />,
        buttonVariant: 'outline' as const,
      };
    }
    if (liveness === 'lost') {
      return {
        buttonLabel: t('presenter.displayTarget.reopen'),
        buttonIcon: <AlertTriangle className="size-4 text-amber-400" />,
        buttonVariant: 'outline' as const,
      };
    }
    if (resolvedTarget.mode === 'window') {
      return {
        buttonLabel: t('presenter.displayTarget.openWindow'),
        buttonIcon: <Monitor className="size-4" />,
        buttonVariant: 'default' as const,
      };
    }
    return {
      buttonLabel: t('presenter.displayTarget.openExternal'),
      buttonIcon: <Tv className="size-4" />,
      buttonVariant: 'default' as const,
    };
  }, [liveness, resolvedTarget, t]);

  const externalScreens = useMemo(() => screens.filter((s) => !s.isPrimary), [screens]);
  const primaryScreen = useMemo(() => screens.find((s) => s.isPrimary), [screens]);

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-input shadow-xs bg-background',
        presentationLock && 'opacity-60 cursor-not-allowed pointer-events-none',
        className
      )}
      data-testid="presenter-display-control-container"
    >
      <Button
        type="button"
        variant={buttonVariant}
        size="sm"
        disabled={presentationLock}
        onClick={onOpenOrFocus}
        data-testid="presenter-display-control-primary"
        className="h-8 gap-2 rounded-r-none border-0 text-xs font-medium focus-visible:ring-1"
      >
        {buttonIcon}
        <span>{buttonLabel}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant={buttonVariant}
              size="sm"
              disabled={presentationLock}
              data-testid="presenter-display-control-trigger"
              aria-label={t('presenter.displayTarget.targetHeader')}
              className="h-8 w-7 rounded-l-none border-0 border-l border-input/50 px-0 hover:bg-accent"
            >
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-72 p-1 text-xs"
          data-testid="presenter-display-control-menu"
        >
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
            {t('presenter.displayTarget.targetHeader')}
          </DropdownMenuLabel>

          <DropdownMenuRadioGroup value={radioValue} onValueChange={handleSelectRadio}>
            {/* External screens */}
            {externalScreens.length > 0 ? (
              externalScreens.map((screen) => (
                <DropdownMenuRadioItem
                  key={screen.id}
                  value={screen.id}
                  className="py-1.5 text-xs"
                  data-testid={`presenter-target-screen-${screen.id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{screen.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {screen.availWidth}x{screen.availHeight} — {t('presenter.displayTarget.externalRecommended')}
                    </span>
                  </div>
                </DropdownMenuRadioItem>
              ))
            ) : (
              <DropdownMenuRadioItem
                value="external-default"
                className="py-1.5 text-xs"
                data-testid="presenter-target-screen-external-default"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{t('presenter.displayTarget.openExternal')}</span>
                  <span className="text-[10px] text-amber-500">
                    {t('presenter.displayTarget.windowSafe')} (1 Screen detected)
                  </span>
                </div>
              </DropdownMenuRadioItem>
            )}

            {/* Primary laptop display (with warning) */}
            <DropdownMenuRadioItem
              value="primary-display"
              className="py-1.5 text-xs"
              data-testid="presenter-target-screen-primary"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {primaryScreen ? primaryScreen.label : t('presenter.displayTarget.primaryDisplay')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t('presenter.displayTarget.laptopWarning')}
                </span>
              </div>
            </DropdownMenuRadioItem>

            {/* Window mode (safe) */}
            <DropdownMenuRadioItem
              value="window-mode"
              className="py-1.5 text-xs"
              data-testid="presenter-target-screen-window"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{t('presenter.displayTarget.openWindow')}</span>
                <span className="text-[10px] text-emerald-500">
                  {t('presenter.displayTarget.windowSafe')}
                </span>
              </div>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator className="my-1" />

          {/* Action options when window is active/live */}
          {liveness === 'live' && (
            <>
              <DropdownMenuItem
                onClick={onOpenOrFocus}
                className="py-1.5 text-xs gap-2"
                data-testid="presenter-action-focus"
              >
                <Maximize2 className="size-3.5 text-muted-foreground" />
                <span>{t('presenter.displayTarget.focus')}</span>
              </DropdownMenuItem>
              {onCloseProjector && (
                <DropdownMenuItem
                  onClick={onCloseProjector}
                  className="py-1.5 text-xs gap-2 text-destructive focus:text-destructive"
                  data-testid="presenter-action-close"
                >
                  <X className="size-3.5" />
                  <span>{t('presenter.displayTarget.close')}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="my-1" />
            </>
          )}

          {/* Utility re-detection action */}
          <DropdownMenuItem
            onClick={refreshScreens}
            className="py-1.5 text-xs gap-2"
            data-testid="presenter-action-detect"
          >
            <RefreshCw className={cn('size-3.5 text-muted-foreground', isDetecting && 'animate-spin')} />
            <span>{t('presenter.displayTarget.detectDisplays')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          {/* Remember on device checkbox */}
          <DropdownMenuCheckboxItem
            checked={config.rememberOnDevice}
            onCheckedChange={(checked) =>
              handleConfigChange({
                ...config,
                rememberOnDevice: Boolean(checked),
              })
            }
            className="py-1.5 text-xs"
            data-testid="presenter-target-remember-checkbox"
          >
            <span className="text-[11px] text-muted-foreground">
              {t('presenter.displayTarget.remember')}
            </span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
