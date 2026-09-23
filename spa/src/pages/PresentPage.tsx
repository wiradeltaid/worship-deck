import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import PresenterOperator from '@/operator/present/PresenterOperator';

export default function PresentPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/services/${id}`, { credentials: 'same-origin' });
      if (!res.ok) {
        setData('missing');
        return;
      }
      setData(await res.json());
    })();
  }, [id]);

  if (data === 'missing') return <Navigate to="/" replace />;
  if (!data) return null;
  return (
    <PresenterOperator
      serviceId={data.id}
      serviceDate={data.date}
      slides={data.plan || []}
      rundownText={data.raw_payload || ''}
      planIdentity={typeof data.plan_identity === 'string' ? data.plan_identity : ''}
      transition={data.transition || 'fade'}
    />
  );
}
