import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PresenterOperator from '@/operator/present/PresenterOperator';
import { clearCachedSession, getCachedSession, invalidateAuthAndPurgeOffline } from '@/lib/auth-session';
import {
  createMediaResolutionContext,
  getServiceSnapshot,
  resolvePlanMedia,
  warmServiceSnapshot,
} from '@/lib/offline/service-snapshot';

export default function PresentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolutionContext = createMediaResolutionContext();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    (async () => {
      try {
        const res = await fetch(`/api/services/${id}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          await invalidateAuthAndPurgeOffline().catch(() => {});
          navigate('/login', { replace: true });
          return;
        }
        if (res.status === 404) {
          setData('missing');
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (cancelled) return;
        if (json && json.id) {
          warmServiceSnapshot(json.id, json).catch(() => {});
        }
        setData(json);
        setIsOfflineData(false);
      } catch {
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (id) {
          const cachedSession = getCachedSession();
          if (cachedSession && cachedSession.username) {
            try {
              const snapshot = await getServiceSnapshot(id);
              if (cancelled) return;
              if (snapshot && snapshot.id) {
                const resolvedPlan = await resolvePlanMedia(
                  snapshot.plan || [],
                  resolutionContext,
                  () => cancelled
                );
                if (cancelled) {
                  resolutionContext.revoke();
                  return;
                }
                setData({ ...snapshot, plan: resolvedPlan });
                setIsOfflineData(true);
                return;
              }
            } catch {
              // fall through
            }
          }
        }
        setData('missing');
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
      resolutionContext.revoke();
    };
  }, [id, navigate]);

  if (data === 'missing') return <Navigate to="/" replace />;
  if (!data) return null;
  return (
    <PresenterOperator
      serviceId={data.id}
      serviceDate={data.date || String(data.id)}
      slides={data.plan || []}
      rundownText={data.raw_payload || ''}
      planIdentity={typeof data.plan_identity === 'string' ? data.plan_identity : ''}
      transition={data.transition || 'fade'}
      isOffline={isOfflineData}
      rawService={data}
    />
  );
}
