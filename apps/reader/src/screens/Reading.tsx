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
  /** Save to resume, or `null` for a fresh run. */
  initialState: GameState | null;
  endingsSeen: number;
  mode: ColorMode;
  onToggleMode: () => void;
  onLeave: () => void;
  onStateChange: (state: GameState) => void;
  onEndingReached: (sceneId: string) => void;
}

/**
 * Reading as a conversation — the one reading format of Embranche.
 *
 * The screen knows nothing of the story: it reads the engine snapshot and shows
 * what it is given. The only local logic is the progressive arrival of the
 * messages, which is staging, not a game rule.
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
   * Automatic chaining.
   *
   * When the current node awaits no decision, the story carries on by itself —
   * but only once its messages have arrived, and after the same silence as
   * between two messages. That is what makes a forced player line, or two lines
   * in a row from the correspondent, read as a real conversation rather than as
   * a block dropping all at once.
   */
  useEffect(() => {
    if (!reveal.done || !scene.canAdvance) return;
    const timer = setTimeout(advance, reduceMotion ? 0 : REVEAL_TIMING.pause);
    return () => clearTimeout(timer);
  }, [reveal.done, scene.canAdvance, scene.id, advance, reduceMotion]);

  // The conversation always follows its latest message.
  useEffect(() => {
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [reveal.revealed, reveal.typing, state.history.length, reduceMotion]);

  const reachedEnding = scene.isEnding && scene.ending;
  useEffect(() => {
    if (reachedEnding) onEndingReached(scene.id);
    // `onEndingReached` is stable on the App side; only the scene should trigger.
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
        // Tapping the conversation skips the wait: nobody should have to wait
        // for an animation to read on.
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
          // The player "types" too: a forced line arrives on their side of the
          // conversation, not on the correspondent's.
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
          A true dead end: no choice to offer, no chaining to follow, no
          declared ending. A chaining node shows nothing — it moves on.
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
