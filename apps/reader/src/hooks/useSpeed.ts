import { useCallback, useState } from 'react';

import { clampPace, loadPace, savePace } from '../lib/settings';
import type { Pace, Plan } from '../lib/settings';

/**
 * The pace the reader gave the waits, kept from one visit to the next.
 *
 * It never travels with a run: it says something about the person reading, not
 * about the story. Moving it during a silence is expected and costs nothing —
 * the state records when the silence started, so the end recomputes itself.
 */
export function useSpeed(plan: Plan = 'free'): [Pace, (pace: Pace) => void] {
  const [pace, setPace] = useState<Pace>(() => loadPace(plan));

  const choose = useCallback(
    (next: Pace) => {
      const allowed = clampPace(next, plan);
      savePace(allowed);
      setPace(allowed);
    },
    [plan],
  );

  return [pace, choose];
}
