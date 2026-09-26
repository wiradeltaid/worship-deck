import { useEffect, useRef, useState } from 'react';
import {
  getServiceSnapshot,
  subscribeServiceReadiness,
  warmServiceSnapshot,
  type OfflineReadiness,
} from '@/lib/offline/service-snapshot';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OfflineReadinessBadge({
  serviceId,
  serviceData,
  className,
}: {
  serviceId: string | number;
  serviceData?: any;
  className?: string;
}) {
  const [readiness, setReadiness] = useState<OfflineReadiness | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retrySeqRef = useRef(0);
  const receivedLiveEventRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    receivedLiveEventRef.current = false;
    setRetrying(false);
    retrySeqRef.current++;
    const idStr = String(serviceId);
    setReadiness(null);

    // Subscribe to live auto-warming progress notifications
    const unsubscribe = subscribeServiceReadiness(idStr, (liveReadiness) => {
      if (!cancelled) {
        receivedLiveEventRef.current = true;
        setReadiness(liveReadiness);
      }
    });

    (async () => {
      const snapshot = await getServiceSnapshot(idStr);
      if (cancelled || receivedLiveEventRef.current) return;
      if (snapshot) {
        const total = typeof snapshot.total_assets === 'number' ? snapshot.total_assets : (snapshot.failed_assets?.length || 0);
        const failed = snapshot.failed_assets?.length || 0;
        const cached = typeof snapshot.cached_assets === 'number' ? snapshot.cached_assets : Math.max(0, total - failed);
        setReadiness({
          status: snapshot.status || 'ready',
          total,
          cached,
          failed,
          message:
            snapshot.status === 'ready'
              ? total === 0
                ? 'Offline Ready (0 external assets)'
                : `Offline Ready: ${cached}/${total} assets`
              : snapshot.status === 'degraded'
              ? `Degraded: ${failed} failed`
              : `Warming: ${cached}/${total} assets`,
        });
      }
    })();

    return () => {
      cancelled = true;
      setRetrying(false);
      unsubscribe();
    };
  }, [serviceId, serviceData?.updated_at, serviceData?.plan_identity, serviceData?.cached_at]);

  const handleRetry = async () => {
    if (!serviceData || retrying) return;
    setRetrying(true);
    receivedLiveEventRef.current = false;
    const seq = ++retrySeqRef.current;
    try {
      const res = await warmServiceSnapshot(String(serviceId), serviceData, (prog) => {
        if (seq === retrySeqRef.current && !receivedLiveEventRef.current) {
          setReadiness(prog);
        }
      });
      if (seq === retrySeqRef.current && !receivedLiveEventRef.current) {
        setReadiness(res);
      }
    } catch {
      // non-blocking
    } finally {
      if (seq === retrySeqRef.current) {
        setRetrying(false);
      }
    }
  };

  if (!readiness) return null;

  return (
    <div
      data-testid="offline-readiness-badge"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border select-none',
        readiness.status === 'ready'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : readiness.status === 'degraded'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-muted bg-muted/40 text-muted-foreground',
        className
      )}
      title={readiness.message}
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          readiness.status === 'ready'
            ? 'bg-emerald-500'
            : readiness.status === 'degraded'
            ? 'bg-amber-500'
            : 'bg-primary animate-pulse'
        )}
      />
      <span>{readiness.message}</span>
      {readiness.status === 'degraded' && serviceData && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
          className="h-5 px-1 text-[10px] text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
        >
          {retrying ? '...' : 'Retry'}
        </Button>
      )}
    </div>
  );
}
