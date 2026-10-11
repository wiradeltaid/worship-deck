import { memo } from 'react';
import {
  Cloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/operator';

// 4-state labels contract: Streaming, Mengunduh, Tersedia di lokal, File terlepas
export type MediaBadgeState = 'streaming-only' | 'downloading' | 'local' | 'detached';

export interface MediaStatusBadgeProps {
  state: MediaBadgeState;
  progress?: number;
  onDownload?: () => void;
  onCancel?: () => void;
  onReconnect?: () => void;
  className?: string;
}

export const MediaStatusBadge = memo(function MediaStatusBadge({
  state,
  progress = 0,
  onDownload,
  onCancel,
  onReconnect,
  className,
}: MediaStatusBadgeProps) {
  const { t } = useT();

  if (state === 'local') {
    return (
      <span
        data-testid="media-badge-local"
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0',
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>{t('media.badge.local')}</span>
      </span>
    );
  }

  if (state === 'downloading') {
    return (
      <div
        data-testid="media-badge-downloading"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn('inline-flex items-center gap-1.5 shrink-0', className)}
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
          <Download className="h-3 w-3 animate-pulse" />
          <span>{t('media.badge.downloading', { percent: Math.round(progress) })}</span>
        </span>
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid="badge-action-batal"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
          >
            {t('media.badge.cancel')}
          </Button>
        )}
      </div>
    );
  }

  if (state === 'detached') {
    return (
      <div
        data-testid="media-badge-detached"
        className={cn('inline-flex items-center gap-1.5 shrink-0', className)}
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          <span>{t('media.badge.detached')}</span>
        </span>
        {onReconnect && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="badge-action-reconnect"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onReconnect();
            }}
            className="h-5 px-1.5 text-[10px] text-foreground"
          >
            <RotateCw className="h-2.5 w-2.5 mr-1" />
            {t('media.badge.reconnect')}
          </Button>
        )}
      </div>
    );
  }

  // streaming-only default
  return (
    <div
      data-testid="media-badge-streaming"
      className={cn('inline-flex items-center gap-1.5 shrink-0', className)}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Cloud className="h-3 w-3" />
        <span>{t('media.badge.streaming')}</span>
      </span>
      {onDownload && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="badge-action-unduh"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="h-5 px-1.5 text-[10px] text-primary hover:text-primary-foreground hover:bg-primary"
        >
          <Download className="h-2.5 w-2.5 mr-1" />
          {t('media.badge.download')}
        </Button>
      )}
    </div>
  );
});
