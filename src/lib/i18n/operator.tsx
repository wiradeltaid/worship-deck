import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  asUiLocale,
  resolveString,
  type I18nKey,
  type UiLocale,
} from '@/lib/i18n';
import {
  applyDocumentLang,
  subscribeUiLocale,
} from '@/lib/ui-locale-document';

type LocaleApi = {
  locale: UiLocale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
};

const Ctx = createContext<LocaleApi | null>(null);

/** Operator shell only. Room-facing routes never mount this. */
export function OperatorUiLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<UiLocale>('en');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/session', { credentials: 'same-origin' });
      const body = (await res.json().catch(() => ({}))) as {
        ui_locale?: unknown;
      };
      if (cancelled) return;
      const next = asUiLocale(
        typeof body.ui_locale === 'string' ? body.ui_locale : null
      );
      setLocale(next);
      applyDocumentLang(next);
    })();
    return subscribeUiLocale((next) => {
      setLocale(next);
      applyDocumentLang(next);
    });
  }, []);
  const value = useMemo<LocaleApi>(
    () => ({
      locale,
      t: (key, params) => resolveString(key, locale, params),
    }),
    [locale]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): LocaleApi {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    locale: 'en',
    t: (key, params) => resolveString(key, 'en', params),
  };
}
