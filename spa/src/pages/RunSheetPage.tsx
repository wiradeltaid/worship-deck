import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Link from '@/components/Link';
import EditForm from '@/operator/EditForm';
import SyncArtifactButton from '@/operator/SyncArtifactButton';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/operator';
import { useSession } from '../lib/auth/SessionProvider';

export default function RunSheetPage() {
  const { id } = useParams();
  const { session } = useSession();
  const { t } = useT();
  const [svc, setSvc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/services/${id}`, { credentials: 'same-origin' });
      if (cancelled) return;
      if (res.status === 404) {
        setSvc('missing');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setSvc(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (svc === 'missing') return <Navigate to="/" replace />;
  if (!session) return null;
  if (loading || !svc) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading service">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-10 w-64 rounded bg-muted" />
        <div className="h-96 rounded-xl bg-muted/60" />
      </div>
    );
  }

  const isAdmin = session.role === 'admin';
  const images = svc.images_payload && typeof svc.images_payload === 'object' ? svc.images_payload : {};

  const reloadService = async () => {
    try {
      const res = await fetch(`/api/services/${id}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setSvc(data);
      }
    } catch {
      // non-blocking
    }
  };

  const actionClass = cn(buttonVariants({ variant: 'outline' }), 'h-auto px-3 py-2');

  return (
    <>
      <div className="mb-6">
        <Link href="/" className={buttonVariants({ variant: 'link' })}>
          {t('edit.actions.back')}
        </Link>
      </div>
      <header className="mb-8 flex flex-col gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Run-Sheet: {svc.date || svc.id}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Service ID: {svc.id}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/services/${svc.id}/slideshow`}
            target="_blank"
            rel="noreferrer"
            className={actionClass}
          >
            {t('edit.actions.preview')}
          </Link>
          <Link href={`/services/${svc.id}/present`} className={actionClass}>
            {t('edit.actions.present')}
          </Link>
          <Link href={`/services/${svc.id}/remote`} className={actionClass}>
            {t('edit.actions.remote')}
          </Link>
          {isAdmin ? (
            <SyncArtifactButton
              serviceId={svc.id}
              updatedAt={svc.updated_at}
              onSuccess={reloadService}
            />
          ) : null}
          <div className="inline-flex rounded-md shadow-xs">
            <a
              href={`/api/services/${svc.id}/pptx`}
              download
              aria-label={t('edit.actions.downloadPptx')}
              className={cn(buttonVariants({ variant: 'default' }), 'rounded-r-none h-auto px-3 py-2 border-r border-primary-foreground/20')}
            >
              {t('edit.actions.downloadPptx')}
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="PPTX Export Options"
                className={cn(buttonVariants({ variant: 'default' }), 'rounded-l-none h-auto px-2 py-2')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = `/api/services/${svc.id}/pptx`;
                    a.download = '';
                    a.click();
                  }}
                  className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                >
                  <span className="font-medium text-xs">Word Wrap in PowerPoint (Default)</span>
                  <span className="text-muted-foreground text-[10px]">Text reflows in PowerPoint when edited</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = `/api/services/${svc.id}/pptx?wrap=false`;
                    a.download = '';
                    a.click();
                  }}
                  className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                >
                  <span className="font-medium text-xs">Disable PowerPoint Word Wrap</span>
                  <span className="text-muted-foreground text-[10px]">Preserves fixed unwrapped shape boundaries</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <EditForm
        id={svc.id}
        initialPayload={svc.raw_payload || ''}
        initialParsed={svc.parsed_data}
        initialSongSets={svc.songSets}
        hymnIndex={[]}
        initialSermonGraphicUrl={images.sermonGraphicUrl || ''}
        initialFamilyPhotoUrl={images.familyPhotoUrl || ''}
        initialYouthPhotoUrl={images.youthPhotoUrl || ''}
        initialAnnouncementInserts={
          Array.isArray(images.announcementInserts)
            ? images.announcementInserts.map((x: unknown) => (typeof x === 'string' ? x : ''))
            : []
        }
        initialFieldValues={svc.field_values}
        initialLayoutSnapshot={svc.form_layout_snapshot}
        initialUpdatedAt={svc.updated_at}
      />
    </>
  );
}
