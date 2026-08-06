import { useEffect, useRef } from 'react';

import type { ColorMode } from '@embranche/design-tokens';
import type { GameState, Story } from '@embranche/story-format';

import { BackIcon, MoonIcon, SunIcon } from '../components/Icons';
import { usePrefersReducedMotion } from '../hooks/useColorMode';
import { REVEAL_TIMING, useReveal } from '../hooks/useReveal';
import { useStory } from '../hooks/useStory';
import { buildTranscript } from '../lib/transcript';
import { Ending } from './Ending';

interface Props {
  story: Story;
  /** Sauvegarde a reprendre, ou `null` pour une partie neuve. */
  initialState: GameState | null;
  endingsSeen: number;
  mode: ColorMode;
  onToggleMode: () => void;
  onLeave: () => void;
  onStateChange: (state: GameState) => void;
  onEndingReached: (sceneId: string) => void;
}

/**
 * Lecture en correspondance — l'unique format de lecture d'Embranche.
 *
 * L'ecran ne connait rien du recit : il lit l'instantane du moteur et affiche
 * ce qu'on lui donne. La seule logique locale est l'arrivee progressive des
 * messages, qui est un effet de mise en scene, pas une regle de jeu.
 */
export function Reading({
  story,
  initialState,
  endingsSeen,
  mode,
  onToggleMode,
  onLeave,
  onStateChange,
  onEndingReached,
}: Props) {
  const { state, scene, canGoBack, decisions, choose, advance, goBack, restart } = useStory({
    story,
    initialState,
    onStateChange,
  });

  const reduceMotion = usePrefersReducedMotion();
  const reveal = useReveal(scene.id, scene.blocks.length, !reduceMotion);
  const thread = useRef<HTMLUListElement>(null);

  /**
   * L'enchainement automatique.
   *
   * Quand le noeud courant n'attend aucune decision, le recit poursuit seul —
   * mais seulement une fois ses messages arrives, et apres le meme silence
   * qu'entre deux messages. C'est ce qui fait qu'une replique imposee du joueur
   * ou deux repliques d'affilee de l'interlocuteur se lisent comme une vraie
   * conversation, et non comme un bloc qui tombe d'un coup.
   */
  useEffect(() => {
    if (!reveal.done || !scene.canAdvance) return;
    const timer = setTimeout(advance, reduceMotion ? 0 : REVEAL_TIMING.pause);
    return () => clearTimeout(timer);
  }, [reveal.done, scene.canAdvance, scene.id, advance, reduceMotion]);

  // La conversation suit toujours son dernier message.
  useEffect(() => {
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [reveal.revealed, reveal.typing, state.history.length, reduceMotion]);

  const reachedEnding = scene.isEnding && scene.ending;
  useEffect(() => {
    if (reachedEnding) onEndingReached(scene.id);
    // `onEndingReached` est stable cote App ; on ne veut declencher que sur la scene.
  }, [reachedEnding, scene.id, onEndingReached]);

  if (scene.isEnding && scene.ending && reveal.done) {
    return (
      <Ending
        story={story}
        ending={scene.ending}
        endingsSeen={endingsSeen}
        steps={decisions}
        onRestart={restart}
        onLibrary={onLeave}
      />
    );
  }

  const messages = buildTranscript(story, state, scene, { revealed: reveal.revealed });
  const narrator = story.narrator;

  return (
    <div className="reading">
      <header className="reading__head">
        <button
          type="button"
          className="icon-btn"
          onClick={() => (canGoBack ? goBack() : onLeave())}
          aria-label={canGoBack ? 'Revenir au choix précédent' : 'Retour à la fiche du récit'}
        >
          <BackIcon />
        </button>
        <div className="avatar" aria-hidden="true">
          {(narrator?.name ?? story.title).charAt(0)}
        </div>
        <div className="reading__who">
          <div className="reading__name">{narrator?.name ?? story.title}</div>
          <div className="reading__status">
            {reveal.typing ? 'écrit…' : (narrator?.status ?? story.tag ?? '')}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMode}
          aria-label={mode === 'light' ? 'Passer en mode nuit' : 'Passer en mode jour'}
        >
          {mode === 'light' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <ul
        className="thread"
        ref={thread}
        aria-live="polite"
        aria-label="Correspondance"
        // Taper dans la conversation saute l'attente : personne ne doit
        // attendre une animation pour lire la suite.
        onClick={reveal.skip}
      >
        {messages.map((message) => (
          <li
            key={message.key}
            className={`bubble-row${message.fromPlayer ? ' bubble-row--player' : ''}`}
          >
            <div className={`bubble${message.fromPlayer ? ' bubble--player' : ''}`}>
              {message.text}
            </div>
          </li>
        ))}

        {reveal.typing && (
          // Le joueur aussi « écrit » : une réplique imposée arrive de son côté
          // de la conversation, pas de celui de l'interlocuteur.
          <li className={`bubble-row${scene.speaker === 'player' ? ' bubble-row--player' : ''}`}>
            <div className="typing" aria-label="En train d’écrire">
              <span />
              <span />
              <span />
            </div>
          </li>
        )}
      </ul>

      <div className="answers">
        {reveal.done && scene.choices.length > 0 && (
          <>
            <div className="answers__label">Répondre</div>
            {scene.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="answer"
                onClick={() => choose(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </>
        )}

        {/*
          Vrai cul-de-sac : ni choix a proposer, ni enchainement a suivre, ni
          fin declaree. Un noeud qui enchaine n'affiche rien — il repart.
        */}
        {reveal.done && !scene.awaitsChoice && !scene.canAdvance && !scene.isEnding && (
          <div className="answers__label">
            Cette scène ne mène nulle part — le récit s’arrête ici.
          </div>
        )}
      </div>
    </div>
  );
}
