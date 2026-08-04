import { useCallback, useEffect, useRef, useState } from 'react';

/** Cadence d'arrivee des messages, en millisecondes. */
export const REVEAL_TIMING = {
  /** Frappe avant le tout premier message d'une scene. */
  first: 600,
  /** Frappe avant les suivants. */
  next: 700,
  /** Silence entre un message affiche et le debut de la frappe suivante. */
  pause: 320,
} as const;

export interface Reveal {
  /** Nombre de messages deja affiches pour la scene courante. */
  revealed: number;
  /** Vrai pendant l'indicateur « ecrit… ». */
  typing: boolean;
  /** Vrai quand toute la scene est arrivee — les choix peuvent s'afficher. */
  done: boolean;
  /** Affiche immediatement la scene entiere. */
  skip: () => void;
}

/**
 * Fait arriver les messages d'une scene un a un, avec un temps de frappe.
 *
 * C'est une decision d'affichage, pas de recit : le moteur, lui, a deja tout
 * resolu. Couper l'animation (`animate = false`, ou une preference systeme de
 * mouvement reduit) affiche la scene d'un bloc, sans rien changer au jeu.
 */
export function useReveal(sceneId: string, total: number, animate = true): Reveal {
  const [revealed, setRevealed] = useState(animate ? 0 : total);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  const skip = useCallback(() => {
    clearTimers();
    setRevealed(total);
    setTyping(false);
  }, [clearTimers, total]);

  useEffect(() => {
    clearTimers();

    if (!animate || total === 0) {
      setRevealed(total);
      setTyping(false);
      return;
    }

    setRevealed(0);
    setTyping(true);

    const step = (index: number) => {
      timers.current.push(
        setTimeout(
          () => {
            setTyping(false);
            setRevealed(index + 1);
            if (index + 1 < total) {
              timers.current.push(
                setTimeout(() => {
                  setTyping(true);
                  step(index + 1);
                }, REVEAL_TIMING.pause),
              );
            }
          },
          index === 0 ? REVEAL_TIMING.first : REVEAL_TIMING.next,
        ),
      );
    };
    step(0);

    return clearTimers;
  }, [sceneId, total, animate, clearTimers]);

  return { revealed, typing, done: revealed >= total, skip };
}
