import { useEffect } from 'react';

import { PACE_LABELS, allowedPaces } from '../lib/settings';
import type { Pace, Plan } from '../lib/settings';

interface Props {
  pace: Pace;
  plan?: Plan;
  onChoose: (pace: Pace) => void;
  onClose: () => void;
}

/**
 * The reader's own settings — today, the pace of the waits.
 *
 * It is a sheet rather than a screen because it belongs to nowhere in
 * particular: one opens it from the library or from a conversation, and lands
 * back exactly where one was. A story being read carries on behind it, and a
 * silence shortened from here is shortened on the spot.
 */
export function Settings({ pace, plan = 'free', onChoose, onClose }: Props) {
  const paces = allowedPaces(plan);

  // A sheet one opens with a thumb must also close without one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Réglages" onClick={onClose}>
      <div className="sheet__panel" onClick={(event) => event.stopPropagation()}>
        <h2 className="sheet__title">Le temps qui passe</h2>
        <p className="sheet__hint">
          Certains récits te font attendre pour de vrai — ton correspondant vit sa vie et te répond
          plus tard. Tu décides à quelle vitesse ce temps s’écoule.
        </p>

        <div className="pace" role="radiogroup" aria-label="Vitesse des attentes">
          {paces.map((option) => (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={option === pace}
              className={`pace__option${option === pace ? ' pace__option--on' : ''}`}
              onClick={() => onChoose(option)}
            >
              {PACE_LABELS[String(option)] ?? String(option)}
            </button>
          ))}
        </div>

        <p className="sheet__hint">
          {pace === 1
            ? 'Le récit se déroule au rythme que son auteur a écrit.'
            : pace === Infinity
              ? 'Les silences sont supprimés : tout arrive d’un trait.'
              : `Une heure d’attente en dure ${Math.round(60 / pace)}.`}
        </p>

        <button type="button" className="cta" onClick={onClose}>
          C’est noté
        </button>
      </div>
    </div>
  );
}
