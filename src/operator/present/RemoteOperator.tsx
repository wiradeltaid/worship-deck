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
import { findNextVisibleIndex } from '@/lib/slide-visibility';
import PresenterOperator from './PresenterOperator';

export default function RemoteOperator({
  serviceId,
  serviceDate,
  slides,
  rundownText = '',
  planIdentity,
  transition: deckTransition,
  autoClaimCode,
}: {
  serviceId: number;
  serviceDate: string;
  slides: SlidePlanItem[];
  rundownText?: string;
  planIdentity: string;
  transition: SlideTransition;
  autoClaimCode?: string;
}) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [liveTransition, setLiveTransition] =
    useState<SlideTransition>(deckTransition);
  const [liveBackground, setLiveBackground] = useState<string | null>(null);
  const [presentationLock, setPresentationLock] = useState(true);
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
  const [remoteMediaState, setRemoteMediaState] = useState<
    RemoteControlSessionState['media']
  >(undefined);
  const [remoteScriptureState, setRemoteScriptureState] = useState<
    RemoteControlSessionState['scripture']
  >(undefined);
  const [remoteGuestFeedState, setRemoteGuestFeedState] = useState<
    RemoteControlSessionState['guestFeed']
  >(undefined);
  const [remoteProjectorState, setRemoteProjectorState] = useState<
    RemoteControlSessionState['projector']
  >(undefined);
  const [connectionState, setConnectionState] =
    useState<RemoteControlConnectionState>('idle');
  const [moreOpen, setMoreOpen] = useState(false);

  const tRef = useRef(t);
  tRef.current = t;

  const sessionRef = useRef<RemoteControlSession | null>(null);
  const planIdentityRef = useRef(planIdentity);
  planIdentityRef.current = planIdentity;

  const stripTokenFromUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('code');
      const cleanUrl =
        currentUrl.pathname +
        (currentUrl.searchParams.toString()
          ? '?' + currentUrl.searchParams.toString()
          : '') +
        currentUrl.hash;
      window.history.replaceState(window.history.state, '', cleanUrl);
    }
  }, []);

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
      if (typeof state.presentationLock === 'boolean') {
        setPresentationLock(state.presentationLock);
      }
      if (state.media) {
        setRemoteMediaState(state.media);
      }
      if (state.scripture !== undefined) {
        setRemoteScriptureState(state.scripture);
      }
      if (state.guestFeed !== undefined) {
        setRemoteGuestFeedState(state.guestFeed);
      }
      if (state.projector !== undefined) {
        setRemoteProjectorState(state.projector);
      }
    },
    [slides.length]
  );

  useEffect(() => {
    let active = true;
    const session = new RemoteControlSession({
      serviceId,
      onState: handleStateUpdate,
      onConnectionChange: (st) => {
        if (!active) return;
        setConnectionState(st);
        if (st === 'connected') {
          setPaired(true);
        } else if (st === 'disconnected') {
          setPaired(false);
        }
      },
    });
    sessionRef.current = session;

    if (autoClaimCode && autoClaimCode.trim()) {
      const trimmedCode = autoClaimCode.trim();
      setPairingCode(trimmedCode);
      setPairingBusy(true);
      setPairingError(null);
      void session.claim(trimmedCode).then((res) => {
        if (!active) return;
        setPairingBusy(false);
        if (res.ok) {
          stripTokenFromUrl();
        } else {
          if (res.error === 'conflict') {
            setPairingError(tRef.current('remote.conflict'));
          } else {
            setPairingError(tRef.current('remote.invalidCode'));
          }
        }
      });
    }

    return () => {
      active = false;
      session.stop();
    };
  }, [serviceId, autoClaimCode, handleStateUpdate, stripTokenFromUrl]);

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
    } else {
      stripTokenFromUrl();
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
        is_whole_chapter?: boolean;
        verses?: Array<{ verse: number; text: string }>;
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
        verses: data.verses,
        is_whole_chapter: data.is_whole_chapter,
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
  const _prevSkip = findNextVisibleIndex(slides, index, -1);
  const _nextSkip = findNextVisibleIndex(slides, index, 1);

  const controlledState = useMemo(
    () => ({
      index,
      blank,
      transition: liveTransition,
      background: liveBackground,
      presentationLock,
    }),
    [index, blank, liveTransition, liveBackground, presentationLock]
  );

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

  return (
    <div className="dark min-h-dvh flex flex-col bg-background text-foreground select-none">
      {connectionState === 'reconnecting' ? (
        <div
          role="status"
          className="bg-amber-500/20 text-amber-200 dark:text-amber-200 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-medium sticky top-0 z-50"
        >
          {t('remote.reconnecting')}
        </div>
      ) : null}
      <PresenterOperator
        serviceId={serviceId}
        serviceDate={serviceDate}
        slides={slides}
        rundownText={rundownText}
        planIdentity={planIdentity}
        transition={liveTransition}
        mode="remote"
        onSendIntent={sendIntent}
        controlledState={controlledState}
        controlledMediaState={remoteMediaState}
        controlledScriptureState={remoteScriptureState}
        controlledGuestFeedState={remoteGuestFeedState}
        controlledProjectorState={remoteProjectorState}
      />
    </div>
  );
}
