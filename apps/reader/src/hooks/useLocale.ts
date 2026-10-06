import { useCallback, useEffect, useState } from 'react';

import { loadLocale, saveLocale } from '../lib/i18n';
import type { Locale } from '../lib/i18n';

/**
 * The language of the reader itself, kept from one visit to the next. It
 * starts from the browser, and an explicit choice then replaces it.
 */
export function useLocale(): [Locale, (locale: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(() => loadLocale(navigator.languages));

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const choose = useCallback((next: Locale) => {
    saveLocale(next);
    setLocale(next);
  }, []);

  return [locale, choose];
}
