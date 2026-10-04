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
  DropdownMenuGroup,
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
  isExternalScreen,
} from '@/lib/display-target';
import type { LivenessVerdict } from '@/lib/projector-liveness';

export interface PresenterDisplayControlProps {
  liveness: LivenessVerdict;
  hasOpenProjector?: boolean;
  presentationLock?: boolean;
  onOpenOrFocus: () => void;
  onFocusProjector?: () => void;
  onReopenProjector?: () => void;
  onRelocate?: (target: ResolvedLaunchTarget) => void;
  onCloseProjector?: () => void;
  className?: string;
}

export default memo(function PresenterDisplayControl({
  liveness,
  hasOpenProjector = false,
  presentationLock = false,
  onOpenOrFocus,
  onFocusProjector,
  onReopenProjector,
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

      const newResolved = resolveLaunchTarget(newConfig, screens);
      if (hasOpenProjector || liveness === 'live' || liveness === 'lost') {
        if (onRelocate) {
          onRelocate(newResolved);
        } else {
          onOpenOrFocus();
        }
      } else {
        onOpenOrFocus();
      }
    },
    [hasOpenProjector, liveness, onOpenOrFocus, onRelocate, screens]
  );

  const handleCloseClick = useCallback(() => {
    if (!onCloseProjector) return;
    if (presentationLock) {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(
              'Presentation Lock is active. Are you sure you want to close the congregation projector display?'
            )
          : true;
      if (!confirmed) return;
    }
    onCloseProjector();
  }, [onCloseProjector, presentationLock]);

  // External and primary screen categorization
  const externalScreens = useMemo(() => screens.filter(isExternalScreen), [screens]);
  const primaryScreen = useMemo(() => screens.find((s) => s.isPrimary), [screens]);

  // Target radio selection handler
  const handleSelectRadio = useCallback(
    (value: string) => {
      // Determine screen label/name for confirmation message
      let targetLabel = t('presenter.displayTarget.openWindow');
      if (value === 'primary-display') {
        targetLabel = primaryScreen ? primaryScreen.label : t('presenter.displayTarget.primaryDisplay');
      } else if (value === 'external-default') {
        targetLabel = externalScreens[0] ? externalScreens[0].label : t('presenter.displayTarget.openExternal');
      } else if (value !== 'window-mode') {
        const found = screens.find((s) => s.id === value);
        if (found) targetLabel = found.label;
      }

      // Prepare confirmation message, ensuring primary-display fullscreen always includes laptopWarning
      let confirmMsg = t('presenter.displayTarget.relocateConfirm').replace('{screen}', targetLabel);
      if (value === 'primary-display') {
        confirmMsg = `${t('presenter.displayTarget.laptopWarning')}\n\n${confirmMsg}`;
      }

      // Prompt confirmation if currently live (relocation) or if targeting primary display
      if (liveness === 'live' || value === 'primary-display') {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(confirmMsg)) {
            return; // Cancelled: keep existing window and configuration
          }
        }
      }

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
    [config, externalScreens, handleConfigChange, liveness, primaryScreen, screens, t]
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
        buttonIcon: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />,
        buttonVariant: 'outline' as const,
      };
    }
    if (liveness === 'lost') {
      return {
        buttonLabel: t('presenter.displayTarget.reopen'),
        buttonIcon: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />,
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

  return (
    <div
      className={cn(
        'inline-flex items-center',
        className
      )}
      data-testid="presenter-display-control-container"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant={buttonVariant}
              size="sm"
              data-testid="presenter-display-control-trigger"
              aria-label={t('presenter.displayTarget.targetHeader')}
              className="h-8 gap-2 px-2.5 text-xs font-medium"
            >
              {buttonIcon}
              <span>{buttonLabel}</span>
              <ChevronDown className="size-3.5 opacity-70 ml-0.5" />
            </Button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-72 p-1 text-xs"
          data-testid="presenter-display-control-menu"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
              {t('presenter.displayTarget.targetHeader')}
            </DropdownMenuLabel>
          </DropdownMenuGroup>

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
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
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
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {t('presenter.displayTarget.windowSafe')}
                </span>
              </div>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator className="my-1" />

          {/* Action options when window is open or active */}
          {(hasOpenProjector || liveness === 'live' || liveness === 'lost') && (
            <>
              {/* Pure Focus Screen (without URL overwrite) */}
              <DropdownMenuItem
                onClick={onFocusProjector || onOpenOrFocus}
                className="py-1.5 text-xs gap-2"
                data-testid="presenter-action-focus"
              >
                <Maximize2 className="size-3.5 text-muted-foreground" />
                <span>{t('presenter.displayTarget.focus')}</span>
              </DropdownMenuItem>

              {/* Explicit Reopen / Recover Screen when liveness is lost */}
              {liveness === 'lost' && (
                <DropdownMenuItem
                  onClick={onReopenProjector || onOpenOrFocus}
                  className="py-1.5 text-xs gap-2 text-amber-600 dark:text-amber-400 font-medium"
                  data-testid="presenter-action-reopen"
                >
                  <AlertTriangle className="size-3.5" />
                  <span>{t('presenter.displayTarget.reopen')}</span>
                </DropdownMenuItem>
              )}

              {/* Close Projector with PresentationLock confirmation */}
              {onCloseProjector && (
                <DropdownMenuItem
                  onClick={handleCloseClick}
                  className="py-1.5 text-xs gap-2 text-destructive focus:text-destructive cursor-pointer"
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
