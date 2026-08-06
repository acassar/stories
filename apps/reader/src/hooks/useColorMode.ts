import { useCallback, useEffect, useState } from 'react';

import type { ColorMode } from '@embranche/design-tokens';

const KEY = 'embranche.reader.mode';

/**
 * Light / dark. It starts from the system preference, and an explicit choice by
 * the reader then replaces it — theirs wins, including on the next visit.
 */
export function useColorMode(): [ColorMode, () => void] {
  const [mode, setMode] = useState<ColorMode>(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    window.localStorage.setItem(KEY, mode);
    // Aligns the phone navigation bar with the current mode.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#1b212d' : '#f6f2ea');
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return [mode, toggle];
}

/** True when the system asks for reduced motion. */
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
