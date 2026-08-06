import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { StoryEngine } from '@embranche/story-engine';
import type { EngineSnapshot, ResolvedScene } from '@embranche/story-engine';
import type { GameState, Story } from '@embranche/story-format';

export interface UseStoryOptions {
  story: Story;
  /**
   * Sauvegarde a reprendre. Lue une seule fois, a la creation du moteur : le
   * moteur est ensuite la source de verite, pas React.
   */
  initialState?: GameState | null;
  /** Appele a chaque nouvel etat — c'est la que l'app branche sa persistance. */
  onStateChange?: (state: GameState) => void;
}

export interface UseStoryResult {
  engine: StoryEngine;
  state: GameState;
  scene: ResolvedScene;
  canGoBack: boolean;
  /** Choix effectivement faits — sans compter les enchainements automatiques. */
  decisions: number;
  choose: (linkId: string) => void;
  /** Poursuit d'un noeud quand le recit enchaine seul. Faux s'il n'y a rien a faire. */
  advance: () => boolean;
  goBack: () => void;
  restart: () => void;
}

/**
 * Pont entre le moteur agnostique et React.
 *
 * `useSyncExternalStore` s'abonne directement au moteur : aucun etat de recit
 * n'est recopie dans React, donc rien a resynchroniser. Le moteur emet, React
 * relit l'instantane — dont la reference ne change que quand l'etat change.
 */
export function useStory({ story, initialState, onStateChange }: UseStoryOptions): UseStoryResult {
  // Le moteur ne depend que du recit : reprendre une partie ne doit pas le
  // recreer, sinon on perdrait les abonnements a chaque sauvegarde.
  const resumeRef = useRef(initialState);
  const engine = useMemo(() => {
    const resume = resumeRef.current;
    const usable = resume && resume.storyId === story.id && story.scenes[resume.currentSceneId];
    return new StoryEngine(story, usable ? { state: resume } : {});
  }, [story]);

  const notifyRef = useRef(onStateChange);
  notifyRef.current = onStateChange;

  useEffect(() => {
    const unsubscribe = engine.on('state:changed', ({ state }) => notifyRef.current?.(state));
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);

  const snapshot: EngineSnapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  const choose = useCallback((linkId: string) => engine.choose(linkId), [engine]);
  const advance = useCallback(() => engine.advance(), [engine]);
  const goBack = useCallback(() => {
    if (engine.canGoBack()) engine.goBack();
  }, [engine]);
  const restart = useCallback(() => engine.reset(), [engine]);

  return {
    engine,
    state: snapshot.state,
    scene: snapshot.scene,
    canGoBack: snapshot.canGoBack,
    decisions: snapshot.decisions,
    choose,
    advance,
    goBack,
    restart,
  };
}
