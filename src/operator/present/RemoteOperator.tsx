import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SlidePlanItem } from '@/lib/slide-plan';
import SlideView from '@/components/SlideView';
import {
  parseSlideTransition,
  SLIDE_TRANSITIONS,
  SLIDE_TRANSITION_SPECS,
  type SlideTransition,
} from '@/lib/transitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScriptureRefAutocomplete } from '@/components/ScriptureRefAutocomplete';
import { useT } from '@/lib/i18n/operator';
import {
  RemoteControlSession,
  type RemoteControlConnectionState,
  type RemoteControlSessionState,
  type PresenterRemoteIntent,
} from '@/lib/presenter-remote-client';
import {
  activePresenterEntry,
  buildPresenterEntries,
  clampSlideIndex,
} from '@/operator/present/presenter-model';

export default function RemoteOperator({
  serviceId,
  serviceDate,
  slides,
  planIdentity,
  transition: deckTransition,
}: {
  serviceId: number;
  serviceDate: string;
  slides: SlidePlanItem[];
  planIdentity: string;
  transition: SlideTransition;
}) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [liveTransition, setLiveTransition] =
    useState<SlideTransition>(deckTransition);
  const [liveBackground, setLiveBackground] = useState<string | null>(null);
  const [backgroundLibrary, setBackgroundLibrary] = useState<
    Array<{ id: number; url: string; isDefault: boolean }>
  >([]);
  const [scriptureRef, setScriptureRef] = useState('');
  const [scriptureBusy, setScriptureBusy] = useState(false);
  const [scriptureError, setScriptureError] = useState<string | null>(null);
  const [scriptureTranslation, setScriptureTranslation] = useState('');
  const [bibleTranslations, setBibleTranslations] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [bibleDefaultMissing, setBibleDefaultMissing] = useState(false);

  const [pairingCode, setPairingCode] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [connectionState, setConnectionState] =
    useState<RemoteControlConnectionState>('idle');
  const [moreOpen, setMoreOpen] = useState(false);

  const sessionRef = useRef<RemoteControlSession | null>(null);
  const planIdentityRef = useRef(planIdentity);
  planIdentityRef.current = planIdentity;

  useEffect(() => {
    let active = true;
    void fetch('/api/background-library', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return { images: [] };
        return (await res.json()) as {
          images?: Array<{ id: number; url: string; isDefault: boolean }>;
        };
      })
      .then((body) => {
        if (!active || !body) return;
        const images = Array.isArray(body.images) ? body.images : [];
        setBackgroundLibrary(images);
      })
      .catch(() => {});
    void fetch('/api/bible-translations', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return { translations: [] };
        return (await res.json()) as {
          translations?: Array<{ code: string; name: string }>;
          default_bible_translation_resolved?: string;
          default_bible_translation_installed?: boolean;
        };
      })
      .then((body) => {
        if (!active || !body) return;
        const rows = Array.isArray(body.translations) ? body.translations : [];
        setBibleTranslations(rows);
        const resolved = body.default_bible_translation_resolved?.trim();
        if (resolved) setScriptureTranslation(resolved);
        else if (rows[0]?.code) setScriptureTranslation(rows[0].code);
        setBibleDefaultMissing(body.default_bible_translation_installed === false);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleStateUpdate = useCallback(
    (state: RemoteControlSessionState) => {
      if (typeof state.index === 'number') {
        setIndex(clampSlideIndex(state.index, slides.length));
      }
      if (typeof state.blank === 'boolean') {
        setBlank(state.blank);
      }
      if (typeof state.transition === 'string') {
        setLiveTransition(parseSlideTransition(state.transition));
      }
      if (state.background !== undefined) {
        setLiveBackground(state.background);
      }
    },
    [slides.length]
  );

  useEffect(() => {
    const session = new RemoteControlSession({
      serviceId,
      onState: handleStateUpdate,
      onConnectionChange: (st) => {
        setConnectionState(st);
        if (st === 'connected') {
          setPaired(true);
        } else if (st === 'disconnected') {
          setPaired(false);
        }
      },
    });
    sessionRef.current = session;
    return () => {
      session.stop();
    };
  }, [serviceId, handleStateUpdate]);

  const connect = async () => {
    if (!pairingCode.trim()) return;
    setPairingBusy(true);
    setPairingError(null);
    const session = sessionRef.current;
    if (!session) {
      setPairingBusy(false);
      return;
    }
    const res = await session.claim(pairingCode.trim());
    setPairingBusy(false);
    if (!res.ok) {
      if (res.error === 'conflict') {
        setPairingError(t('remote.conflict'));
      } else {
        setPairingError(t('remote.invalidCode'));
      }
    }
  };

  const sendIntent = useCallback((intent: PresenterRemoteIntent) => {
    void sessionRef.current?.sendIntent(intent);
  }, []);

  const setIndexIntent = useCallback(
    (nextIdx: number) => {
      const clamped = clampSlideIndex(nextIdx, slides.length);
      setIndex(clamped);
      sendIntent({
        type: 'sync',
        index: clamped,
        blank,
        transition: liveTransition,
        background: liveBackground,
        planIdentity: planIdentityRef.current,
      });
    },
    [blank, liveBackground, liveTransition, sendIntent, slides.length]
  );

  const toggleBlankIntent = useCallback(() => {
    const nextBlank = !blank;
    setBlank(nextBlank);
    sendIntent({
      type: 'blank',
      blank: nextBlank,
      planIdentity: planIdentityRef.current,
    });
  }, [blank, sendIntent]);

  const setTransitionIntent = useCallback(
    (nextTr: SlideTransition) => {
      setLiveTransition(nextTr);
      sendIntent({
        type: 'transition',
        transition: nextTr,
        planIdentity: planIdentityRef.current,
      });
    },
    [sendIntent]
  );

  const setBackgroundIntent = useCallback(
    (nextBg: string | null) => {
      setLiveBackground(nextBg);
      sendIntent({
        type: 'background',
        background: nextBg,
        planIdentity: planIdentityRef.current,
      });
    },
    [sendIntent]
  );

  const pushScripture = async () => {
    setScriptureBusy(true);
    setScriptureError(null);
    try {
      const params = new URLSearchParams({ ref: scriptureRef.trim() });
      if (scriptureTranslation) params.set('translation', scriptureTranslation);
      const res = await fetch(`/api/scripture?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reference?: string;
        text?: string;
      };
      if (!res.ok) {
        setScriptureError(
          data.error ||
            (res.status === 404
              ? t('presenter.scripture.notFound')
              : t('presenter.scripture.lookupFailed'))
        );
        return;
      }
      if (!data.reference || !data.text) {
        setScriptureError(t('presenter.scripture.lookupFailed'));
        return;
      }
      sendIntent({
        type: 'scripture',
        reference: data.reference,
        text: data.text,
        planIdentity: planIdentityRef.current,
      });
      setScriptureRef('');
      setMoreOpen(false);
    } catch {
      setScriptureError(t('presenter.scripture.lookupFailed'));
    } finally {
      setScriptureBusy(false);
    }
  };

  const entries = useMemo(() => buildPresenterEntries(slides), [slides]);
  const current = slides[index];
  const next = slides[index + 1];
  const atEnd = index >= slides.length - 1;
  const activeEntry = activePresenterEntry(entries, index);

  if (!paired) {
    return (
      <div className="dark flex min-h-dvh flex-col bg-background text-foreground p-4 justify-center items-center">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card/40 p-6">
          <h1 className="text-xl font-semibold">{t('remote.title')}</h1>
          <p className="text-xs text-muted-foreground">{serviceDate}</p>
          <div className="space-y-2">
            <Label htmlFor="remote-code">{t('remote.codePrompt')}</Label>
            <Input
              id="remote-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={t('remote.codePlaceholder')}
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              className="text-center font-mono text-2xl tracking-widest"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void connect();
                }
              }}
            />
          </div>
          {pairingError ? (
            <p role="alert" className="text-xs text-destructive">
              {pairingError}
            </p>
          ) : null}
          {connectionState === 'disconnected' ? (
            <p role="alert" className="text-xs text-amber-200 dark:text-amber-200">
              {t('remote.disconnected')}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={pairingBusy || pairingCode.trim().length === 0}
            onClick={() => void connect()}
          >
            {pairingBusy ? t('remote.pairingBusy') : t('remote.pairButton')}
          </Button>
        </div>
      </div>
    );
  }

  const slideCountText = t('remote.slideCount')
    .replace('{current}', slides.length === 0 ? '0' : String(index + 1))
    .replace('{total}', String(slides.length));

  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground select-none pb-24">
      {connectionState === 'reconnecting' ? (
        <div
          role="status"
          className="bg-amber-500/20 text-amber-200 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-medium"
        >
          {t('remote.reconnecting')}
        </div>
      ) : null}
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{t('remote.title')}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {slideCountText}
            {activeEntry ? ` · ${activeEntry.label}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
              {t('remote.more')}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('remote.more')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Scripture Lookup Section */}
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <h2 className="text-sm font-semibold">
                    {t('presenter.scripture.title')}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t('presenter.scripture.hint')}
                  </p>
                  {bibleTranslations.length > 0 ? (
                    <div>
                      <Label
                        className="mb-1 block text-xs font-medium text-muted-foreground"
                        htmlFor="remote-bible-translation"
                      >
                        {t('presenter.scripture.translation')}
                      </Label>
                      <Select
                        value={scriptureTranslation}
                        onValueChange={(val) => {
                          if (val) setScriptureTranslation(val);
                        }}
                      >
                        <SelectTrigger id="remote-bible-translation" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {bibleTranslations.map((row) => (
                            <SelectItem key={row.code} value={row.code}>
                              {row.name ? `${row.name} (${row.code})` : row.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {bibleDefaultMissing ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('presenter.scripture.defaultMissing')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <ScriptureRefAutocomplete
                      value={scriptureRef}
                      onChange={setScriptureRef}
                      translation={scriptureTranslation || undefined}
                      placeholder={t('presenter.scripture.placeholder')}
                      inputClassName="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void pushScripture();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void pushScripture()}
                        disabled={scriptureBusy || !scriptureRef.trim()}
                      >
                        {scriptureBusy
                          ? t('presenter.scripture.lookingUp')
                          : t('presenter.scripture.push')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          sendIntent({
                            type: 'clear-scripture',
                            planIdentity: planIdentityRef.current,
                          });
                          setMoreOpen(false);
                        }}
                      >
                        {t('remote.clearScripture')}
                      </Button>
                    </div>
                    {scriptureError && (
                      <p className="text-xs text-destructive">{scriptureError}</p>
                    )}
                  </div>
                </div>

                {/* Transition Picker */}
                <div className="space-y-1">
                  <Label htmlFor="remote-transition" className="text-xs text-muted-foreground">
                    {t('remote.transition')}
                  </Label>
                  <Select
                    value={liveTransition}
                    onValueChange={(val) => {
                      setTransitionIntent(parseSlideTransition(val));
                    }}
                  >
                    <SelectTrigger id="remote-transition" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLIDE_TRANSITIONS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {SLIDE_TRANSITION_SPECS[id].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Background Override Picker */}
                <div className="space-y-1">
                  <Label htmlFor="remote-background" className="text-xs text-muted-foreground">
                    {t('remote.background')}
                  </Label>
                  <Select
                    value={liveBackground || 'default'}
                    onValueChange={(val) => {
                      setBackgroundIntent(val === 'default' ? null : val);
                    }}
                  >
                    <SelectTrigger id="remote-background" className="w-full">
                      <SelectValue placeholder={t('remote.deckDefault')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('remote.deckDefault')}</SelectItem>
                      {backgroundLibrary.map((bg) => (
                        <SelectItem key={bg.id} value={bg.url}>
                          {bg.url.split('/').pop() || `Image ${bg.id}`}{' '}
                          {bg.isDefault ? '(Default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-3 overflow-y-auto">
        {/* Current Slide Display */}
        <section className="space-y-1">
          <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t('remote.current')}</span>
            {blank ? (
              <span
                role="status"
                className="rounded border border-amber-400/50 bg-amber-400/15 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-200 dark:text-amber-200"
              >
                {t('remote.blankedBadge')}
              </span>
            ) : null}
          </p>
          <div
            className={`aspect-video w-full overflow-hidden rounded-lg border bg-black ${
              blank ? 'border-amber-400/70' : 'border-border'
            }`}
          >
            {current ? <SlideView slide={current} /> : null}
          </div>
        </section>

        {/* Next Slide Preview */}
        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('remote.nextSlide')}
          </p>
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
            {next ? (
              <SlideView slide={next} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                End of deck
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Thumb-friendly primary controls pinned at the bottom */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur p-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 text-base h-14"
            disabled={index <= 0}
            onClick={() => setIndexIntent(index - 1)}
          >
            ← {t('remote.prev')}
          </Button>
          <Button
            size="lg"
            variant={blank ? 'destructive' : 'outline'}
            className="h-14 px-5 text-sm font-semibold"
            aria-pressed={blank}
            onClick={toggleBlankIntent}
          >
            {blank ? t('remote.resume') : t('remote.blank')}
          </Button>
          <Button
            size="lg"
            className="flex-1 text-base h-14"
            disabled={atEnd}
            onClick={() => setIndexIntent(index + 1)}
          >
            {t('remote.next')} →
          </Button>
        </div>
      </footer>
    </div>
  );
}
