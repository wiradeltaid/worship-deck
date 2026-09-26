import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProjectorClient from '@/projected/ProjectorClient';
import ProjectedNotFound from '../projected/ProjectedNotFound';
import ProjectedError from '../projected/ProjectedError';
import {
  clearCachedSession,
  getCachedSession,
  setCachedSession,
  type StoredSession,
} from '@/lib/auth-session';
import {
  createMediaResolutionContext,
  getServiceSnapshot,
  resolvePlanMedia,
  warmServiceSnapshot,
} from '@/lib/offline/service-snapshot';

export default function ProjectorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [unavailable, setUnavailable] = useState<'missing' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolutionContext = createMediaResolutionContext();
    setUnavailable(null);
    setData(null);
    const sessionController = new AbortController();
    const serviceController = new AbortController();
    const sessionTimer = setTimeout(() => sessionController.abort(), 5000);

    (async () => {
      let isOffline = false;
      try {
        const me = await fetch('/api/session', {
          credentials: 'same-origin',
          signal: sessionController.signal,
        });
        clearTimeout(sessionTimer);
        if (cancelled) return;
        if (me.status === 401 || me.status === 403) {
          clearCachedSession();
          navigate('/login');
          return;
        }
        if (me.ok) {
          const sessionBody = (await me.json().catch(() => null)) as StoredSession | null;
          if (cancelled) return;
          if (
            sessionBody &&
            typeof sessionBody.username === 'string' &&
            (sessionBody.role === 'admin' || sessionBody.role === 'operator')
          ) {
            setCachedSession(sessionBody);
          }
        } else {
          isOffline = true;
        }
      } catch {
        clearTimeout(sessionTimer);
        if (cancelled) return;
        isOffline = true;
      }

      if (cancelled) return;

      // On network failure, attempt loading from offline snapshot directly ONLY if an authorized session exists
      if (isOffline && id) {
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
              return;
            }
          } catch {
            // fall through
          }
        }
      }

      const serviceTimer = setTimeout(() => serviceController.abort(), 5000);
      try {
        const res = await fetch(`/api/services/${id}`, {
          credentials: 'same-origin',
          signal: serviceController.signal,
        });
        clearTimeout(serviceTimer);
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          clearCachedSession();
          navigate('/login');
          return;
        }
        if (res.status === 404) {
          setUnavailable('missing');
          return;
        }
        if (!res.ok) {
          if (id) {
            const cachedSession = getCachedSession();
            if (cachedSession && cachedSession.username) {
              const snapshot = await getServiceSnapshot(id).catch(() => null);
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
                return;
              }
            }
          }
          if (!cancelled) setUnavailable('error');
          return;
        }
        const servicePayload = await res.json();
        if (cancelled) return;
        // Background-warm and provision local offline snapshot on successful load
        if (servicePayload && servicePayload.id) {
          warmServiceSnapshot(servicePayload.id, servicePayload).catch(() => {});
        }
        setData(servicePayload);
      } catch {
        clearTimeout(serviceTimer);
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
                return;
              }
            } catch {
              // fall through
            }
          }
        }
        if (!cancelled) setUnavailable('error');
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(sessionTimer);
      sessionController.abort();
      serviceController.abort();
      resolutionContext.revoke();
    };
  }, [id, navigate]);

  if (unavailable === 'missing') return <ProjectedNotFound />;
  if (unavailable === 'error') return <ProjectedError />;
  if (!data) {
    return <div style={{ background: '#000', minHeight: '100vh' }} />;
  }
  return (
    <ProjectorClient
      serviceId={data.id}
      slides={data.plan || []}
      planIdentity={typeof data.plan_identity === 'string' ? data.plan_identity : ''}
      transition={data.transition || 'fade'}
    />
  );
}
