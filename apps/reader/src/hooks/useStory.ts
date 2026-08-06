import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { StoryEngine } from '@embranche/story-engine';
import type { EngineSnapshot, ResolvedScene } from '@embranche/story-engine';
import type { GameState, Story } from '@embranche/story-format';

export interface UseStoryOptions {
  story: Story;
  /**
   * Save to resume. Read once, when the engine is created: the engine is the
   * source of truth afterwards, not React.
   */
  initialState?: GameState | null;
  /** Called on every new state — where the app plugs its persistence in. */
  onStateChange?: (state: GameState) => void;
}

export interface UseStoryResult {
  engine: StoryEngine;
  state: GameState;
  scene: ResolvedScene;
  canGoBack: boolean;
  /** Choices actually made — not counting automatic chaining. */
  decisions: number;
  choose: (linkId: string) => void;
  /** Moves on one node when the story chains by itself. False when there is nothing to do. */
  advance: () => boolean;
  goBack: () => void;
  restart: () => void;
}

/**
 * Bridge between the agnostic engine and React.
 *
 * `useSyncExternalStore` subscribes directly to the engine: no story state is
 * copied into React, so there is nothing to resynchronize. The engine emits,
 * React reads the snapshot back — and that reference only changes when the
 * state changes.
 */
export function useStory({ story, initialState, onStateChange }: UseStoryOptions): UseStoryResult {
  // The engine depends on the story alone: resuming a run must not recreate it,
  // or subscriptions would be lost on every save.
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
