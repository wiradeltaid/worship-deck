import { useRouter } from '@/lib/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from '@/components/Link';
import { cn } from '@/lib/utils';
import {
  flushPendingHymnCommits,
  HymnNumberAutocomplete,
} from '@/components/HymnNumberAutocomplete';
import { ScriptureRefAutocomplete } from '@/components/ScriptureRefAutocomplete';
import {
  SlidePreviewList,
  type SlidePreviewItem,
} from '@/components/SlidePreviewList';
import { ImageUploadField } from '@/components/ImageUploadField';
import type { PreviewEntry } from '@/lib/artifacts/preview-model';
import { useT } from '@/lib/i18n/operator';
import {
  FORM_ERROR_BANNER,
  FORM_WARN_BANNER,
  FORM_WARN_BANNER_BODY,
} from '@/operator/form-banners';
import {
  buildFieldsPayload,
  coerceHydrateFields,
  EMPTY_WORSHIP_FORM_FIELDS,
  shouldClosingPrayerCheckboxStartChecked,
  type HymnIndexEntry,
  type WorshipFormFields,
} from '@/lib/worship-form-fields';
import { DynamicFormBody, type FormLayoutData } from './DynamicFormBody';

/** Module-level so the default keeps a stable identity across renders. */
const EMPTY_HYMN_INDEX: HymnIndexEntry[] = [];

export default function CreateForm({
  hymnIndex = EMPTY_HYMN_INDEX,
}: {
  hymnIndex?: HymnIndexEntry[];
} = {}) {
  const router = useRouter();
  const { t } = useT();
  const [payload, setPayload] = useState('');
  const [sermonGraphicUrl, setSermonGraphicUrl] = useState('');
  const [familyPhotoUrl, setFamilyPhotoUrl] = useState('');
  const [youthPhotoUrl, setYouthPhotoUrl] = useState('');
  const [announcementInserts, setAnnouncementInserts] = useState<string[]>([
    '',
    '',
    '',
    '',
  ]);

  const [fields, setFields] = useState<WorshipFormFields>(
    EMPTY_WORSHIP_FORM_FIELDS
  );
  const [songSetEntries, setSongSetEntries] = useState<
    Array<{ variableName: string; title: string }>
  >([]);
  const [backgroundLibrary, setBackgroundLibrary] = useState<
    Array<{ id: number; url: string; isDefault: boolean }>
  >([]);
  const [songBooks, setSongBooks] = useState<
    Array<{ bookCode: string; name: string; isDefault: boolean }>
  >([]);
  const [openLyricEditors, setOpenLyricEditors] = useState<Record<string, boolean>>({});
  const [savingBookStatus, setSavingBookStatus] = useState<Record<string, boolean>>({});
  const [layoutData, setLayoutData] = useState<FormLayoutData | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldSuggestions, setFieldSuggestions] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const fetchLayout = async () => {
    try {
      const res = await fetch('/api/worship-form-layout');
      if (res.ok) {
        const data = (await res.json()) as FormLayoutData;
        setLayoutData(data);
        setLayoutError(null);
      } else {
        const errMsg = `Failed to load form layout (${res.status} ${res.statusText || 'Error'})`;
        console.error(errMsg);
        setLayoutError(errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error loading form layout';
      console.error('Failed to fetch worship form layout:', err);
      setLayoutError(errMsg);
    }
  };

  const toggleLyricEditor = async (variableName: string) => {
    const isOpening = !openLyricEditors[variableName];
    setOpenLyricEditors((prev) => ({ ...prev, [variableName]: isOpening }));

    if (isOpening) {
      const current = fieldsRef.current.songSets[variableName];
      // If lyrics are not already filled, fetch from hymn number if valid
      if (!current?.lyricText && current?.songNumber && /^\d+$/.test(current.songNumber.trim())) {
        const num = Number(current.songNumber.trim());
        const bookParam = current.songBookCode ? `&book_code=${encodeURIComponent(current.songBookCode)}` : '';
        try {
          const res = await fetch(`/api/hymns?numbers=${num}${bookParam}`);
          if (res.ok) {
            const data = (await res.json()) as { hymns?: Array<{ number: number; lyrics?: string }> };
            const hymn = data.hymns?.find((h) => h.number === num);
            if (hymn?.lyrics) {
              setSongSetField(variableName, 'lyricText', hymn.lyrics);
            }
          }
        } catch {
          // ignore lookup failure
        }
      }
    }
  };

  useEffect(() => {
    let active = true;
    void fetchLayout();
    void (async () => {
      try {
        const [entriesRes, bgRes, booksRes] = await Promise.all([
          fetch('/api/song-set-entries'),
          fetch('/api/background-library'),
          fetch('/api/song-books'),
        ]);
        if (entriesRes.ok) {
          const data = (await entriesRes.json()) as {
            entries?: Array<{ variableName: string; title: string }>;
          };
          if (active && Array.isArray(data.entries)) {
            setSongSetEntries(data.entries);
          }
        }
        if (bgRes.ok) {
          const data = (await bgRes.json()) as {
            images?: Array<{ id: number; url: string; isDefault: boolean }>;
          };
          if (active && Array.isArray(data.images)) {
            setBackgroundLibrary(data.images);
          }
        }
        if (booksRes.ok) {
          const data = (await booksRes.json()) as {
            books?: Array<{ bookCode: string; name: string; isDefault: boolean }>;
          };
          if (active && Array.isArray(data.books)) {
            setSongBooks(data.books);
          }
        }
        try {
          const sessRes = await fetch('/api/session');
          if (sessRes.ok) {
            const s = (await sessRes.json()) as { role?: string };
            if (active) setIsAdmin(s.role === 'admin');
          }
        } catch {
          // ignore
        }
      } catch {
        // Non-blocking: fallback to whatever entries form has
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [songSetSuggestions, setSongSetSuggestions] = useState<Record<string, { songNumber: number; songBookCode: string; title: string; matchKind: string }>>({});
  const [songOverflow, setSongOverflow] = useState<Array<{ line: string; number: number; bookCode: string }>>([]);
  const [unmappedLines, setUnmappedLines] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningCollision, setWarningCollision] = useState<{
    date: string;
    id: number;
  } | null>(null);

  const [detectedDate, setDetectedDate] = useState<string | null>(null);
  const [slidePlan, setSlidePlan] = useState<SlidePreviewItem[]>([]);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [failedHymnNumbers, setFailedHymnNumbers] = useState<number[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSeqRef = useRef(0);

  useEffect(() => {
    if (!payload.trim()) {
      setDetectedDate(null);
      setSlidePlan([]);
      setPreviewEntries([]);
      setFailedHymnNumbers([]);
      setWarningCollision(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const seq = ++previewSeqRef.current;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/services/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            raw_payload: payload,
            sermonGraphicUrl: sermonGraphicUrl || null,
            familyPhotoUrl: familyPhotoUrl || null,
            youthPhotoUrl: youthPhotoUrl || null,
            announcementInserts: announcementInserts.map((s) => s.trim()),
            fields: buildFieldsPayload(fields),
          }),
        });

        if (seq !== previewSeqRef.current) return;
        if (!res.ok) throw new Error('Preview generation failed');
        const data = (await res.json()) as {
          plan?: SlidePreviewItem[];
          previewEntries?: PreviewEntry[];
          date?: string | null;
          failedHymnNumbers?: number[];
        };
        if (seq !== previewSeqRef.current) return;

        setSlidePlan(data.plan || []);
        // Absent on older cached responses — the list falls back to raw kinds.
        setPreviewEntries(
          Array.isArray(data.previewEntries) ? data.previewEntries : []
        );
        setDetectedDate(data.date || null);
        setFailedHymnNumbers(
          Array.isArray(data.failedHymnNumbers) ? data.failedHymnNumbers : []
        );

        if (data.date) {
          const collisionRes = await fetch(`/api/services?q=${data.date}`, {
            signal: controller.signal,
          });
          if (seq !== previewSeqRef.current) return;
          if (collisionRes.ok) {
            const collData = (await collisionRes.json()) as {
              services?: Array<{ id: number; date: string }>;
            };
            const exactMatch = collData.services?.find(
              (r) => r.date === data.date
            );
            if (exactMatch) {
              setWarningCollision({ date: data.date, id: exactMatch.id });
            } else {
              setWarningCollision(null);
            }
          }
        } else {
          setWarningCollision(null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Preview error:', err);
        if (seq === previewSeqRef.current) {
          setSlidePlan([]);
          setPreviewEntries([]);
          setDetectedDate(null);
          setWarningCollision(null);
          setFailedHymnNumbers([]);
        }
      } finally {
        if (seq === previewSeqRef.current) setPreviewLoading(false);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    payload,
    sermonGraphicUrl,
    familyPhotoUrl,
    youthPhotoUrl,
    announcementInserts,
    fields,
  ]);

  // Mirrors `fields` synchronously. A hymn input commits on blur, which the
  // browser dispatches on the Save button's mousedown — before the click that
  // runs `handleSave`. The click closure therefore still holds the pre-commit
  // `fields`, so the request body is built from this ref instead.
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const handleFieldValueChange = (varName: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [varName]: val }));
    if (varName === 'sermon_speaker_name') {
      onSermonSpeakerChange(val);
    } else if (varName === 'scripture_reference') {
      setField('verseReference', val);
    } else if (varName === 'scripture_text') {
      setField('verseText', val);
    } else if (varName === 'special_song') {
      setField('specialSong', val);
    } else if (varName === 'closing_prayer_person') {
      setField('closingPrayerPerson', val);
    } else if (varName === 'family_name') {
      setField('familyName', val);
    } else if (varName === 'family_request') {
      setField('familyPrayerRequest', val);
    } else if (varName === 'youth_name') {
      setField('youthName', val);
    } else if (varName === 'youth_request') {
      setField('youthPrayerRequest', val);
    } else if (varName === 'sermon_poster') {
      setSermonGraphicUrl(val);
    } else if (varName === 'family_photo') {
      setFamilyPhotoUrl(val);
    } else if (varName === 'youth_photo') {
      setYouthPhotoUrl(val);
    }
  };

  const setSongSetField = (
    variableName: string,
    subField: 'songNumber' | 'songBookCode' | 'background' | 'lyricText',
    value: string
  ) => {
    setFields((prev) => {
      const current = prev.songSets[variableName] || {
        songNumber: '',
        songBookCode: '',
        background: '',
        lyricText: '',
      };
      const updated = {
        ...prev.songSets,
        [variableName]: { ...current, [subField]: value },
      };
      fieldsRef.current = { ...fieldsRef.current, songSets: updated };
      return { ...prev, songSets: updated };
    });
  };

  const setField = <K extends keyof WorshipFormFields>(
    key: K,
    value: WorshipFormFields[K]
  ) => {
    fieldsRef.current = { ...fieldsRef.current, [key]: value };
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleAcceptAllSuggestions = () => {
    if (Object.keys(songSetSuggestions).length > 0) {
      setFields((prev) => {
        const updated = { ...prev.songSets };
        for (const [vn, sug] of Object.entries(songSetSuggestions)) {
          if (!updated[vn]?.songNumber || updated[vn]?.songNumber.trim() === '') {
            updated[vn] = {
              ...(updated[vn] || { background: '', lyricText: '' }),
              songNumber: String(sug.songNumber),
              songBookCode: sug.songBookCode || updated[vn]?.songBookCode || '',
            };
          }
        }
        fieldsRef.current = { ...fieldsRef.current, songSets: updated };
        return { ...prev, songSets: updated };
      });
    }
    if (Object.keys(fieldSuggestions).length > 0) {
      for (const [vn, val] of Object.entries(fieldSuggestions)) {
        if (!fieldValues[vn] || fieldValues[vn].trim() === '') {
          handleFieldValueChange(vn, val);
        }
      }
    }
  };

  const handleParse = async () => {
    if (!payload.trim()) {
      setError('Raw Rundown Text is required to parse');
      return;
    }
    setParseLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/services/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_payload: payload,
          // Images so setSlidePlan does not flicker photos away;
          // omit fields so hydrate overlays come from raw parse only.
          sermonGraphicUrl: sermonGraphicUrl || null,
          familyPhotoUrl: familyPhotoUrl || null,
          youthPhotoUrl: youthPhotoUrl || null,
          announcementInserts: announcementInserts.map((s) => s.trim()),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        plan?: SlidePreviewItem[];
        previewEntries?: PreviewEntry[];
        date?: string | null;
        failedHymnNumbers?: number[];
        fields?: unknown;
        songSetSuggestions?: Record<string, { songNumber: number; songBookCode: string; title: string; matchKind: string }>;
        songOverflow?: Array<{ line: string; number: number; bookCode: string }>;
        unmappedLines?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error || t('form.error.parse'));
      }
      setSongSetSuggestions(data.songSetSuggestions || {});
      if ((data as any).fieldSuggestions) {
        setFieldSuggestions((data as any).fieldSuggestions);
      }
      setSongOverflow(data.songOverflow || []);
      setUnmappedLines(data.unmappedLines || []);
      const hydrated = coerceHydrateFields(data.fields);
      if (hydrated) {
        fieldsRef.current = hydrated;
        setFields(hydrated);
        setClosingPrayerCopiesSpeaker(
          shouldClosingPrayerCheckboxStartChecked(
            hydrated.sermonSpeaker,
            hydrated.closingPrayerPerson
          )
        );
      }
      setSlidePlan(data.plan || []);
      setPreviewEntries(
        Array.isArray(data.previewEntries) ? data.previewEntries : []
      );
      setDetectedDate(data.date || null);
      setFailedHymnNumbers(
        Array.isArray(data.failedHymnNumbers) ? data.failedHymnNumbers : []
      );
      if (data.date) {
        const collisionRes = await fetch(`/api/services?q=${data.date}`);
        if (collisionRes.ok) {
          const collData = (await collisionRes.json()) as {
            services?: Array<{ id: number; date: string }>;
          };
          const exactMatch = collData.services?.find(
            (r) => r.date === data.date
          );
          if (exactMatch) {
            setWarningCollision({ date: data.date, id: exactMatch.id });
          } else {
            setWarningCollision(null);
          }
        }
      } else {
        setWarningCollision(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('form.error.parse'));
    } finally {
      setParseLoading(false);
    }
  };

  const [closingPrayerCopiesSpeaker, setClosingPrayerCopiesSpeaker] =
    useState(false);

  const onSermonSpeakerChange = (nextSpeaker: string) => {
    fieldsRef.current = { ...fieldsRef.current, sermonSpeaker: nextSpeaker };
    setFields((prev) => ({
      ...prev,
      sermonSpeaker: nextSpeaker,
    }));
  };

  const onClosingPrayerCopiesSpeakerChange = (checked: boolean) => {
    setClosingPrayerCopiesSpeaker(checked);
    if (checked) {
      setField('closingPrayerPerson', fields.sermonSpeaker);
    }
  };

  const resolveScripture = async () => {
    const ref = fields.verseReference;
    if (!ref.trim()) return;

    setError(null);
    try {
      const res = await fetch(
        `/api/scripture?ref=${encodeURIComponent(ref.trim())}`
      );
      const data = (await res.json()) as {
        error?: string;
        text?: string;
        translation?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || t('form.error.scripture'));
      }
      setFields((prev) => ({
        ...prev,
        verseText: data.text || '',
        verseTranslation: data.translation || prev.verseTranslation,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('form.error.scripture'));
    }
  };

  const handleSave = async (allowSecond = false) => {
    if (!payload.trim()) {
      setError(t('form.error.requiredRundown'));
      return;
    }

    // A hymn input blurred by this very click may still be resolving its title
    // against /api/hymns; let it land before the payload is built.
    await flushPendingHymnCommits();

    setIsSaving(true);
    setError(null);

    try {
      const bodyPayload: Record<string, unknown> = {
        raw_payload: payload,
        sermonGraphicUrl: sermonGraphicUrl.trim() || null,
        familyPhotoUrl: familyPhotoUrl.trim() || null,
        youthPhotoUrl: youthPhotoUrl.trim() || null,
        announcementInserts: announcementInserts.map((s) => s.trim()),
        fields: buildFieldsPayload(fieldsRef.current),
        field_values: fieldValues,
      };
      if (allowSecond) bodyPayload.allowSecond = true;

      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = (await res.json()) as {
        error?: string;
        date?: string;
        existingId?: number;
        id?: number;
        failedHymnNumbers?: number[];
      };

      if (res.status === 409) {
        if (data.date && data.existingId != null) {
          setWarningCollision({ date: data.date, id: data.existingId });
        }
        setError(data.error || t('form.collision.error'));
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || t('form.error.create'));
      }

      if (Array.isArray(data.failedHymnNumbers)) {
        setFailedHymnNumbers(data.failedHymnNumbers);
      }

      router.push(`/services/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('form.error.generic'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {warningCollision && (
        <div className={`${FORM_WARN_BANNER} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3`}>
          <div>
            <p className="text-sm font-bold">{t('form.collision.title')}</p>
            <p className={FORM_WARN_BANNER_BODY}>
              {t('form.collision.body').replace(
                '{date}',
                warningCollision.date
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/services/${warningCollision.id}`}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-800/40 bg-amber-500/20 hover:bg-amber-500/30 font-semibold transition-all"
            >
              {t('form.collision.openExisting')}
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving || !payload.trim()}
              onClick={() => handleSave(true)}
              className="border-amber-800/40 bg-amber-500/20 text-xs hover:bg-amber-500/30"
            >
              {t('form.collision.createSecond')}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className={FORM_ERROR_BANNER} role="alert">
          {error}
        </div>
      )}

      {failedHymnNumbers.length > 0 && (
        <div className={FORM_WARN_BANNER}>
          <p className="font-semibold">{t('form.missingHymns.title')}</p>
          <p className={FORM_WARN_BANNER_BODY}>
            {t('form.missingHymns.body').replace(
              '{list}',
              failedHymnNumbers.map((n) => `#${n}`).join(', ')
            )}
          </p>
        </div>
      )}

      {layoutError && (
        <div className={`${FORM_ERROR_BANNER} flex items-center justify-between gap-3`} role="alert">
          <div>
            <p className="font-semibold">{t('form.layout.errorTitle') || 'Dynamic form layout unavailable'}</p>
            <p className="text-xs opacity-90">{layoutError}. {t('form.layout.errorFallback') || 'Falling back to static fields.'}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchLayout()}
            className="shrink-0 h-8 px-3 text-xs bg-background/50 hover:bg-background"
          >
            {t('common.retry') || 'Retry'}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                {t('form.create.title')}
              </CardTitle>
              <CardDescription>
                {t('form.create.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-muted-foreground">
                    {t('form.rundown.label')}
                  </label>
                </div>
                <Textarea
                  className="h-72 font-mono text-xs"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder={t('form.rundown.placeholder')}
                  required
                  disabled={isSaving}
                />
                <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                  {detectedDate ? (
                    <p className="text-xs text-primary font-semibold">
                      {t('form.detectedDate').replace('{date}', detectedDate)}
                    </p>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    {(Object.keys(songSetSuggestions).length + Object.keys(fieldSuggestions).length) > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAcceptAllSuggestions}
                        disabled={isSaving}
                      >
                        {t('form.parser.acceptAll')} ({Object.keys(songSetSuggestions).length + Object.keys(fieldSuggestions).length})
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleParse()}
                      disabled={isSaving || parseLoading || !payload.trim()}
                    >
                      {parseLoading ? t('form.parsing') : t('form.parse')}
                    </Button>
                  </div>
                </div>

                {/* Diagnostics: Unmapped lines warning */}
                {unmappedLines.length > 0 ? (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <span className="text-base">⚠️</span> {t('form.parser.unmappedWarning')}
                    </p>
                    <ul className="list-disc pl-5 font-mono text-[11px] max-h-24 overflow-y-auto space-y-0.5">
                      {unmappedLines.map((line, idx) => (
                        <li key={idx} className="truncate">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Diagnostics: Song overflow warning */}
                {songOverflow.length > 0 ? (
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">
                      ⚠️ {t('form.parser.overflowWarning')}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 font-mono text-[11px]">
                      {songOverflow.map((s, idx) => (
                        <Badge key={idx} variant="outline" className="border-amber-500/50">
                          {s.bookCode} #{s.number}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {layoutData && layoutData.groupings && layoutData.groupings.length > 0 ? (
            <DynamicFormBody
              layoutData={layoutData}
              fieldValues={fieldValues}
              onFieldValueChange={handleFieldValueChange}
              songSetValues={fields.songSets}
              onSongSetChange={setSongSetField}
              announcementInserts={announcementInserts}
              onAnnouncementInsertChange={(idx, url) => {
                setAnnouncementInserts((prev) => {
                  const next = [...prev];
                  while (next.length < 4) next.push('');
                  next[idx] = url;
                  return next;
                });
              }}
              songSetEntries={songSetEntries}
              songBooks={songBooks}
              backgroundLibrary={backgroundLibrary}
              openLyricEditors={openLyricEditors}
              onToggleLyricEditor={toggleLyricEditor}
              savingBookStatus={savingBookStatus}
              fieldSuggestions={fieldSuggestions}
              onAcceptFieldSuggestion={handleFieldValueChange}
              songSetSuggestions={songSetSuggestions}
              onAcceptSongSetSuggestion={(varName, sug) => {
                setSongSetField(varName, 'songNumber', String(sug.songNumber || sug.number || ''));
                if (sug.songBookCode) setSongSetField(varName, 'songBookCode', sug.songBookCode);
                if (sug.lyrics || sug.lyricText) setSongSetField(varName, 'lyricText', sug.lyrics || sug.lyricText);
              }}
              disabled={isSaving}
              isAdmin={isAdmin}
              onRefreshLayout={fetchLayout}
              hymnIndex={hymnIndex}
            />
          ) : (
            <>
          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t('form.songSets.title')}
              </CardTitle>
              <CardDescription>
                {t('form.songSets.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {songSetEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {t('form.songSets.empty')}
                </p>
              ) : (
                <div className="space-y-3">
                  {songSetEntries.map((entry) => {
                    const defaultBook = songBooks.find((b) => b.isDefault);
                    const current = fields.songSets[entry.variableName] || {
                      songNumber: '',
                      songBookCode: '',
                      background: '',
                      lyricText: '',
                    };
                    const selectedBookCode = current.songBookCode || defaultBook?.bookCode || '';
                    const isLyricOpen = !!openLyricEditors[entry.variableName];
                    const numVal = current.songNumber.trim();
                    const hasValidNum = /^\d+$/.test(numVal);
                    return (
                      <div
                        key={entry.variableName}
                        data-slot="song-set-row"
                        className="rounded-lg border border-border/50 bg-background/50 p-3 transition-colors hover:border-border"
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="w-32 sm:w-36 shrink-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                              {entry.title}
                            </span>
                          </div>

                          <div className="w-28 shrink-0">
                            <Select
                              value={current.songBookCode || (defaultBook ? defaultBook.bookCode : '')}
                              onValueChange={(val) =>
                                setSongSetField(entry.variableName, 'songBookCode', val ?? '')
                              }
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder={t('form.songSets.book')} />
                              </SelectTrigger>
                              <SelectContent>
                                {songBooks.map((b) => (
                                  <SelectItem key={b.bookCode} value={b.bookCode}>
                                    {b.bookCode} {b.isDefault ? `(${t('form.songSets.defaultBookBadge')})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="min-w-[10rem] flex-1">
                            <HymnNumberAutocomplete
                              value={current.songNumber}
                              bookCode={selectedBookCode}
                              onChange={(v) =>
                                setSongSetField(entry.variableName, 'songNumber', v)
                              }
                              hymnIndex={hymnIndex}
                              placeholder={t('form.hymnPlaceholder')}
                              disabled={isSaving}
                            />
                          </div>

                          <div className="w-36 shrink-0">
                            <Select
                              value={current.background || 'default'}
                              onValueChange={(val) =>
                                setSongSetField(
                                  entry.variableName,
                                  'background',
                                  !val || val === 'default' ? '' : val
                                )
                              }
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder={t('form.songSets.globalDefault')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">{t('form.songSets.globalDefault')}</SelectItem>
                                {backgroundLibrary.map((img) => (
                                  <SelectItem key={img.id} value={img.url}>
                                    {img.url.split('/').pop() || `Image ${img.id}`} {img.isDefault ? `(${t('form.songSets.globalDefault')})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="shrink-0">
                            {hasValidNum ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 text-xs"
                                onClick={() => toggleLyricEditor(entry.variableName)}
                              >
                                {isLyricOpen
                                  ? t('form.songSets.hideLyrics')
                                  : t('form.songSets.editLyrics')}
                              </Button>
                            ) : (
                              <div className="w-20" />
                            )}
                          </div>
                        </div>

                        {isLyricOpen ? (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] font-medium text-muted-foreground">
                                {t('form.songSets.lyricsLabel')}
                              </Label>
                            </div>
                            <Textarea
                              rows={6}
                              className="text-xs font-mono"
                              placeholder={t('form.songSets.lyricsPlaceholder')}
                              value={current.lyricText}
                              onChange={(e) =>
                                setSongSetField(entry.variableName, 'lyricText', e.target.value)
                              }
                              disabled={isSaving}
                            />
                          </div>
                        ) : null}

                        {songSetSuggestions[entry.variableName] ? (
                          <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-blue-700 dark:text-blue-300 font-semibold">
                                {t('form.parser.suggested')}:
                              </span>
                              <span className="font-mono font-medium">
                                {songSetSuggestions[entry.variableName].songBookCode} #{songSetSuggestions[entry.variableName].songNumber}
                              </span>
                              {songSetSuggestions[entry.variableName].title ? (
                                <span className="text-muted-foreground truncate">
                                  ({songSetSuggestions[entry.variableName].title})
                                </span>
                              ) : null}
                              <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 ml-1">
                                {songSetSuggestions[entry.variableName].matchKind}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-6 px-2.5 text-xs font-semibold shrink-0"
                              onClick={() => {
                                const sug = songSetSuggestions[entry.variableName];
                                setSongSetField(entry.variableName, 'songNumber', String(sug.songNumber));
                                if (sug.songBookCode) {
                                  setSongSetField(entry.variableName, 'songBookCode', sug.songBookCode);
                                }
                              }}
                              disabled={isSaving}
                            >
                              {t('form.parser.accept')}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t('form.bibleTalk.title')}
              </CardTitle>
              <CardDescription>
                {t('form.bibleTalk.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('form.verseRef')}
                    </label>
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-auto p-0 text-[10px] font-bold"
                      onClick={() => resolveScripture()}
                    >
                      {t('form.resolve')}
                    </Button>
                  </div>
                  <ScriptureRefAutocomplete
                    value={fields.verseReference}
                    onChange={(v) => setField('verseReference', v)}
                    placeholder={t('form.scripturePlaceholder')}
                    disabled={isSaving}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    {t('form.verseText')}
                  </label>
                  <Textarea
                    className="h-20 text-xs"
                    value={fields.verseText}
                    onChange={(e) => setField('verseText', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t('form.divineWorship.title')}
              </CardTitle>
              <CardDescription>
                {t('form.divineWorship.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    {t('form.specialSong')}
                  </label>
                  <Input
                    type="text"
                    className="text-xs"
                    value={fields.specialSong}
                    onChange={(e) => setField('specialSong', e.target.value)}
                    placeholder={t('form.specialSongPlaceholder')}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t('form.sermon.title')}
              </CardTitle>
              <CardDescription>
                {t('form.sermon.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    {t('form.sermonSpeaker')}
                  </label>
                  <Input
                    type="text"
                    className="text-xs"
                    value={fields.sermonSpeaker}
                    onChange={(e) => onSermonSpeakerChange(e.target.value)}
                    placeholder={t('form.sermonSpeakerPlaceholder')}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    {t('form.closingPrayer')}
                  </label>
                  <Input
                    type="text"
                    className="text-xs"
                    value={fields.closingPrayerPerson}
                    onChange={(e) =>
                      setField('closingPrayerPerson', e.target.value)
                    }
                    placeholder={t('form.closingPrayerPlaceholder')}
                    disabled={isSaving}
                  />
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="create-closing-prayer-copies-speaker"
                      checked={closingPrayerCopiesSpeaker}
                      onCheckedChange={(checked) =>
                        onClosingPrayerCopiesSpeakerChange(Boolean(checked))
                      }
                      disabled={isSaving}
                    />
                    <Label
                      htmlFor="create-closing-prayer-copies-speaker"
                      className="text-xs font-medium cursor-pointer text-muted-foreground"
                    >
                      {t('form.closingPrayerSameAsSpeaker')}
                    </Label>
                  </div>
                </div>
              </div>
              <ImageUploadField
                label={t('form.sermonGraphic')}
                value={sermonGraphicUrl}
                onChange={setSermonGraphicUrl}
                previewAlt={t('form.sermonGraphicAlt')}
                uploadLabel={t('form.sermonGraphicUpload')}
                disabled={isSaving}
              />
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                Weekly Announcement Posters
              </CardTitle>
              <CardDescription>
                Upload up to 4 weekly announcement posters to dynamically populate placeholder slides across announcement sets. Empty slots are omitted from the live presentation plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4].map((slot) => (
                  <div
                    key={slot}
                    className="p-3 rounded-md border border-border/60 bg-muted/20 space-y-2"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                      Announcement Slot {slot}
                    </span>
                    <ImageUploadField
                      label={`Slot ${slot} Poster`}
                      value={announcementInserts[slot - 1] || ''}
                      onChange={(url) => {
                        setAnnouncementInserts((prev) => {
                          const next = [...prev];
                          while (next.length < 4) next.push('');
                          next[slot - 1] = url;
                          return next;
                        });
                      }}
                      previewAlt={`Announcement Slot ${slot}`}
                      uploadLabel={`Upload Slot ${slot} Poster`}
                      disabled={isSaving}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t('form.family.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploadField
                label={t('form.familyPhoto')}
                value={familyPhotoUrl}
                onChange={setFamilyPhotoUrl}
                previewAlt={t('form.familyPhotoAlt')}
                uploadLabel={t('form.familyPhotoUpload')}
                disabled={isSaving}
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {t('form.familyName')}
                </label>
                <Input
                  type="text"
                  className="text-xs"
                  value={fields.familyName}
                  onChange={(e) => setField('familyName', e.target.value)}
                  placeholder={t('form.familyNamePlaceholder')}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {t('form.familyPrayer')}
                </label>
                <Textarea
                  className="h-20 text-xs"
                  value={fields.familyPrayerRequest}
                  onChange={(e) =>
                    setField('familyPrayerRequest', e.target.value)
                  }
                  placeholder={t('form.familyPrayerPlaceholder')}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t('form.youth.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploadField
                label={t('form.youthPhoto')}
                value={youthPhotoUrl}
                onChange={setYouthPhotoUrl}
                previewAlt={t('form.youthPhotoAlt')}
                uploadLabel={t('form.youthPhotoUpload')}
                disabled={isSaving}
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {t('form.youthName')}
                </label>
                <Input
                  type="text"
                  className="text-xs"
                  value={fields.youthName}
                  onChange={(e) => setField('youthName', e.target.value)}
                  placeholder={t('form.youthNamePlaceholder')}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {t('form.youthPrayer')}
                </label>
                <Textarea
                  className="h-20 text-xs"
                  value={fields.youthPrayerRequest}
                  onChange={(e) =>
                    setField('youthPrayerRequest', e.target.value)
                  }
                  placeholder={t('form.youthPrayerPlaceholder')}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-md relative overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex justify-between items-center">
                <span>{t('form.preview.title')}</span>
                {previewLoading && (
                  <span className="text-[10px] bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full animate-pulse">
                    {t('form.parsing')}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('form.preview.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/50">
              <div className="max-h-[600px] lg:max-h-[calc(100vh-14rem)] overflow-y-auto divide-y divide-border/60">
                <SlidePreviewList entries={previewEntries} slides={slidePlan} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border/80">
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'h-auto px-4 py-2')}>
          {t('form.cancel')}
        </Link>
        <Button
          onClick={() => handleSave(false)}
          disabled={isSaving || !payload.trim()}
        >
          {isSaving ? t('form.create.saving') : t('form.create.save')}
        </Button>
      </div>
    </div>
  );
}
