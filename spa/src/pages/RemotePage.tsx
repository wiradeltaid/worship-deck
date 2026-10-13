import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import RemoteOperator from '@/operator/present/RemoteOperator';

export default function RemotePage() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const searchParams = new URLSearchParams(location.search);
  const queryService = searchParams.get('service');
  const code = searchParams.get('code');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let effectiveId = id || queryService;

        // Auto-resolve active service if neither path parameter nor service query param is present
        if (!effectiveId) {
          const listRes = await fetch('/api/services', { credentials: 'same-origin' });
          if (!active) return;
          if (listRes.ok) {
            const listJson = (await listRes.json()) as { services?: Array<{ id: number; date?: string }> };
            if (Array.isArray(listJson.services) && listJson.services.length > 0) {
              const now = new Date();
              const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const todaySvc = listJson.services.find(
                (s) => typeof s.date === 'string' && s.date.includes(todayIso)
              );
              effectiveId = String(todaySvc ? todaySvc.id : listJson.services[0].id);
            }
          }
        }

        if (!effectiveId) {
          if (!active) return;
          setData('missing');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/services/${effectiveId}`, { credentials: 'same-origin' });
        if (!active) return;
        if (!res.ok) {
          setData('missing');
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (!active) return;
        setData(json);
        setLoading(false);
      } catch {
        if (!active) return;
        setData('missing');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, queryService]);

  if (data === 'missing') return <Navigate to="/" replace />;
  if (loading || !data) {
    return (
      <div className="dark min-h-dvh bg-background text-foreground flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground font-mono">Loading service…</p>
      </div>
    );
  }

  return (
    <RemoteOperator
      serviceId={data.id}
      serviceDate={data.date}
      slides={data.plan || []}
      rundownText={data.raw_payload || ''}
      planIdentity={typeof data.plan_identity === 'string' ? data.plan_identity : ''}
      transition={data.transition || 'fade'}
      autoClaimCode={code || undefined}
    />
  );
}
