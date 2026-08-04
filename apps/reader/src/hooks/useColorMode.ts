import { useCallback, useEffect, useState } from 'react';

import type { ColorMode } from '@embranche/design-tokens';

const KEY = 'embranche.reader.mode';

/**
 * Jour / nuit. On part de la preference du systeme, et le choix explicite du
 * lecteur la remplace ensuite — c'est le sien qui gagne, y compris au retour.
 */
export function useColorMode(): [ColorMode, () => void] {
  const [mode, setMode] = useState<ColorMode>(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    window.localStorage.setItem(KEY, mode);
    // Aligne la barre de navigation du telephone sur le mode courant.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#1b212d' : '#f6f2ea');
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return [mode, toggle];
}

/** Vrai si le systeme demande a limiter les animations. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
