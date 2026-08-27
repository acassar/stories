import { useEffect, useState } from 'react';

/**
 * The current instant, refreshed only while something is counting down.
 *
 * A conversation at rest must not re-render once a second for nothing, so the
 * ticking is switched off the moment the correspondent is back — which is also
 * what makes this safe to call from a screen that is almost always idle.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return now;
}
