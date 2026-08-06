/**
 * Story engine — pure TypeScript, no framework, no DOM, no I/O.
 *
 * It knows three things: a story (immutable), a game state (replaced on every
 * transition, never mutated), and a list of subscribers it notifies when either
 * moves. Any UI able to subscribe can render it.
 */

import {
  awaitsChoice,
  choiceLabel,
  parseStory,
  sceneMessages,
  speakerOf,
} from '@embranche/story-format';
import type {
  GameState,
  Link,
  LinkId,
  Scene,
  SceneEnding,
  SceneId,
  SceneKind,
  Story,
  TextBlock,
} from '@embranche/story-format';

import { contextFromState, isSatisfied } from './conditions.js';
import { applyEffects } from './effects.js';
import { Emitter } from './emitter.js';
import type { Unsubscribe } from './emitter.js';
import { EngineError } from './errors.js';
import { createInitialState, serializeState, systemClock } from './state.js';
import type { Clock } from './state.js';

/**
 * A choice as the UI should see it. `id` is that of the *link* taken, not of
 * the target node: two links can lead to the same choice node.
 */
export interface ResolvedChoice {
  id: LinkId;
  label: string;
  target: SceneId;
  /** False when the link condition is not satisfied. */
  available: boolean;
}

/** The current scene, already resolved: nothing left for the UI to interpret. */
export interface ResolvedScene {
  id: SceneId;
  kind: SceneKind;
  title: string;
  /** What the scene sends — a choice label when it has no body. */
  blocks: readonly TextBlock[];
  /** Who speaks in this scene. */
  speaker: 'narrator' | 'player';
  /**
   * The choices to offer, when the scene awaits one. Empty when the story
   * chains on by itself: `advance()` takes over then.
   */
  choices: readonly ResolvedChoice[];
  allChoices: readonly ResolvedChoice[];
  /** True when the reading must stop here and wait for a decision. */
  awaitsChoice: boolean;
  /** True when a passable automatic chaining link remains. */
  canAdvance: boolean;
  isEnding: boolean;
  ending?: SceneEnding;
  media?: Scene['media'];
}

/**
 * Full snapshot. Its reference only changes when the state changes — exactly
 * the contract `useSyncExternalStore` expects.
 */
export interface EngineSnapshot {
  state: GameState;
  scene: ResolvedScene;
  canGoBack: boolean;
  /** Number of distinct endings in the story. */
  endingCount: number;
  /**
   * Decisions actually taken by the player — distinct from the history length,
   * which also counts nodes walked through automatically.
   */
  decisions: number;
}

export interface EngineEvents {
  /** Emitted on every new state, whatever the cause. */
  'state:changed': { state: GameState; snapshot: EngineSnapshot };
  /** Emitted when the current scene changes (choice, chaining, back, resume). */
  'scene:changed': { scene: ResolvedScene; previousSceneId: SceneId | null };
  /**
   * Emitted after applying the effects of a link that was taken. `chosen`
   * distinguishes a player decision from plain chaining.
   */
  'link:followed': { link: Link; from: SceneId; to: SceneId; chosen: boolean };
  /** Emitted on arrival at a terminal scene. */
  'story:ended': { scene: ResolvedScene; ending: SceneEnding };
}

export interface StoryEngineOptions {
  /** Starting state. Defaults to a fresh run on the initial scene. */
  state?: GameState;
  /** Injectable clock, for deterministic tests. */
  now?: Clock;
  /**
   * Validate the story on construction (default: `true`). The studio sets it to
   * `false` while editing, where the graph is transiently inconsistent.
   */
  validate?: boolean;
}

export class StoryEngine {
  private readonly emitter = new Emitter<EngineEvents>();
  private readonly clock: Clock;
  private readonly _story: Story;
  private _state: GameState;
  private _snapshot: EngineSnapshot;
  /** Raw `subscribe()` listeners — the bridge to useSyncExternalStore. */
  private readonly subscribers = new Set<() => void>();

  constructor(story: Story, options: StoryEngineOptions = {}) {
    this._story = options.validate === false ? story : parseStory(story);
    this.clock = options.now ?? systemClock;

    const state = options.state ?? createInitialState(this._story, this.clock);
    this.assertKnownScene(state.currentSceneId);
    if (state.storyId !== this._story.id) {
      throw new EngineError(
        'story-mismatch',
        `L'etat vise le recit « ${state.storyId} », pas « ${this._story.id} ».`,
      );
    }
    this._state = state;
    this._snapshot = this.buildSnapshot(state);
  }

  /** Opens a story from arbitrary JSON, validating it along the way. */
  static fromJson(json: string, options: StoryEngineOptions = {}): StoryEngine {
    return new StoryEngine(JSON.parse(json) as Story, options);
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  get story(): Story {
    return this._story;
  }

  get state(): GameState {
    return this._state;
  }

  /**
   * Current snapshot — stable reference as long as the state does not change.
   * Bound to the instance: `useSyncExternalStore` receives it detached from the
   * engine.
   */
  readonly getSnapshot = (): EngineSnapshot => this._snapshot;

  getCurrentScene(): ResolvedScene {
    return this._snapshot.scene;
  }

  /** Only the choices whose condition is satisfied. */
  getAvailableChoices(): readonly ResolvedChoice[] {
    return this._snapshot.scene.choices;
  }

  canChoose(linkId: LinkId): boolean {
    return this._snapshot.scene.choices.some((choice) => choice.id === linkId);
  }

  /** True when the story can carry on without a decision from the player. */
  canAdvance(): boolean {
    return this._snapshot.scene.canAdvance;
  }

  canGoBack(): boolean {
    return this._state.history.length > 0;
  }

  get isEnded(): boolean {
    return this._snapshot.scene.isEnding;
  }

  // -------------------------------------------------------------------------
  // Transitions
  // -------------------------------------------------------------------------

  /**
   * Takes a choice: checks the link can be offered, applies its effects, then
   * moves on. Throws `EngineError` when the link does not exist, does not lead
   * to a choice node, or when its condition is not satisfied — the UI should
   * never offer such a button.
   */
  choose(linkId: LinkId): void {
    const from = this._state.currentSceneId;
    const scene = this.requireScene(from);
    const link = scene.next.find((candidate) => candidate.id === linkId);

    if (!link) {
      throw new EngineError('unknown-choice', `La scene « ${from} » n'a aucun lien « ${linkId} ».`);
    }
    if (this._story.scenes[link.to]?.kind !== 'choice') {
      throw new EngineError(
        'not-a-choice',
        `Le lien « ${linkId} » de « ${from} » n'est pas un choix : le recit y enchaine seul.`,
      );
    }
    if (!isSatisfied(link.condition, contextFromState(this._state))) {
      throw new EngineError(
        'choice-unavailable',
        `Ce choix de « ${from} » n'est pas disponible dans l'etat courant.`,
      );
    }
    this.follow(link, true);
  }

  /**
   * Carries on without a decision: takes the first passable link to a node that
   * is not a choice. Returns false when there is nothing to chain — the scene
   * awaits the player, or the story is over.
   *
   * The UI calls this one step at a time rather than letting the engine unroll
   * the whole chain at once: every node walked through must be able to appear
   * at its own pace in the conversation.
   */
  advance(): boolean {
    const from = this._state.currentSceneId;
    const scene = this.requireScene(from);
    if (scene.ending || awaitsChoice(this._story, scene)) return false;

    const context = contextFromState(this._state);
    const link = scene.next.find(
      (candidate) => this._story.scenes[candidate.to] && isSatisfied(candidate.condition, context),
    );
    if (!link) return false;

    this.follow(link, false);
    return true;
  }

  /** Takes a link: effects, move, history, events. */
  private follow(link: Link, chosen: boolean): void {
    const from = this._state.currentSceneId;
    this.assertKnownScene(link.to);

    // Effects are applied before arrival: the target scene and its own
    // conditions already see the world as the link just changed it.
    let next = applyEffects(this._state, link.effects);
    next = {
      ...next,
      currentSceneId: link.to,
      history: [...next.history, { sceneId: from, linkId: link.id }],
      visited: next.visited.includes(link.to) ? next.visited : [...next.visited, link.to],
      updatedAt: this.clock(),
    };

    this.commit(next, from);
    this.emitter.emit('link:followed', { link, from, to: link.to, chosen });

    const arrived = this._snapshot.scene;
    if (arrived.isEnding && arrived.ending) {
      this.emitter.emit('story:ended', { scene: arrived, ending: arrived.ending });
    }
  }

  /**
   * Goes back to the last choice — not to the last node.
   *
   * Automatic chaining is undone along with it: stepping back a single node
   * would put the player in front of a scene that immediately moves on again,
   * and the back button would do nothing visible.
   *
   * The state is *replayed* from scratch using the truncated history rather
   * than trying to invert the effects: that is the only exact way to undo a
   * `toggle` or a `set` that overwrote a value. The engine being
   * deterministic, the replay yields the exact state.
   */
  goBack(): void {
    if (this._state.history.length === 0) {
      throw new EngineError('empty-history', 'Aucune etape a annuler.');
    }
    const from = this._state.currentSceneId;
    const replayed = this.replay(this._state.history.slice(0, this.lastDecisionIndex()));
    this.commit(replayed, from);
  }

  /** Index, in the history, of the last link the player chose. */
  private lastDecisionIndex(): number {
    for (let i = this._state.history.length - 1; i >= 0; i -= 1) {
      const entry = this._state.history[i];
      if (entry && this.isDecision(entry)) return i;
    }
    return 0;
  }

  /** Starts over on the same story. */
  reset(): void {
    const from = this._state.currentSceneId;
    this.commit(createInitialState(this._story, this.clock), from);
  }

  /** Resumes a saved run. */
  loadState(state: GameState): void {
    if (state.storyId !== this._story.id) {
      throw new EngineError(
        'story-mismatch',
        `Cette sauvegarde appartient au recit « ${state.storyId} ».`,
      );
    }
    this.assertKnownScene(state.currentSceneId);
    const from = this._state.currentSceneId;
    this.commit(state, from);
  }

  // -------------------------------------------------------------------------
  // Persistence (the caller decides where the result goes)
  // -------------------------------------------------------------------------

  serialize(): string {
    return serializeState(this._state);
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  /**
   * Payload-free subscription, called on every state change. Designed for
   * `useSyncExternalStore(engine.subscribe, engine.getSnapshot)`.
   */
  readonly subscribe = (listener: () => void): Unsubscribe => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  /** Typed subscription, one event at a time. */
  on<K extends keyof EngineEvents>(
    event: K,
    listener: (payload: EngineEvents[K]) => void,
  ): Unsubscribe {
    return this.emitter.on(event, listener);
  }

  once<K extends keyof EngineEvents>(
    event: K,
    listener: (payload: EngineEvents[K]) => void,
  ): Unsubscribe {
    return this.emitter.once(event, listener);
  }

  off<K extends keyof EngineEvents>(event: K, listener: (payload: EngineEvents[K]) => void): void {
    this.emitter.off(event, listener);
  }

  /** Drops every subscription — call it when the UI unmounts. */
  dispose(): void {
    this.emitter.removeAllListeners();
    this.subscribers.clear();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private commit(next: GameState, previousSceneId: SceneId | null): void {
    this._state = next;
    this._snapshot = this.buildSnapshot(next);

    for (const listener of [...this.subscribers]) listener();
    this.emitter.emit('state:changed', { state: next, snapshot: this._snapshot });
    if (previousSceneId !== next.currentSceneId) {
      this.emitter.emit('scene:changed', { scene: this._snapshot.scene, previousSceneId });
    }
  }

  /** Replays a sequence of steps from a fresh state. */
  private replay(history: GameState['history']): GameState {
    let state = createInitialState(this._story, this.clock);
    state = { ...state, startedAt: this._state.startedAt };

    for (const entry of history) {
      const scene = this._story.scenes[entry.sceneId];
      const link = scene?.next.find((candidate) => candidate.id === entry.linkId);
      // A history that no longer matches the story (a scene deleted since) is
      // truncated here rather than breaking the resume.
      if (!link || !this._story.scenes[link.to]) break;

      state = applyEffects(state, link.effects);
      state = {
        ...state,
        currentSceneId: link.to,
        history: [...state.history, entry],
        visited: state.visited.includes(link.to) ? state.visited : [...state.visited, link.to],
      };
    }
    return { ...state, updatedAt: this.clock() };
  }

  private buildSnapshot(state: GameState): EngineSnapshot {
    return {
      state,
      scene: this.resolveScene(state),
      canGoBack: state.history.length > 0,
      endingCount: Object.values(this._story.scenes).filter((scene) => scene.ending).length,
      decisions: state.history.filter((entry) => this.isDecision(entry)).length,
    };
  }

  /** Does this history entry correspond to a button the player pressed? */
  private isDecision(entry: GameState['history'][number]): boolean {
    const link = this._story.scenes[entry.sceneId]?.next.find((l) => l.id === entry.linkId);
    return Boolean(link && this._story.scenes[link.to]?.kind === 'choice');
  }

  private resolveScene(state: GameState): ResolvedScene {
    const scene = this.requireScene(state.currentSceneId);
    const context = contextFromState(state);
    // A terminal scene leads nowhere, even if links are still hanging off it.
    const waits = !scene.ending && awaitsChoice(this._story, scene);

    const allChoices: ResolvedChoice[] = waits
      ? scene.next.map((link) => ({
          id: link.id,
          label: this.labelOf(link),
          target: link.to,
          available: isSatisfied(link.condition, context),
        }))
      : [];

    const resolved: ResolvedScene = {
      id: scene.id,
      kind: scene.kind,
      title: scene.title,
      blocks: sceneMessages(scene),
      speaker: speakerOf(scene),
      choices: allChoices.filter((choice) => choice.available),
      allChoices,
      awaitsChoice: waits,
      canAdvance:
        !scene.ending &&
        !waits &&
        scene.next.some(
          (link) => this._story.scenes[link.to] && isSatisfied(link.condition, context),
        ),
      isEnding: Boolean(scene.ending),
    };
    if (scene.ending) resolved.ending = scene.ending;
    if (scene.media) resolved.media = scene.media;
    return resolved;
  }

  /** The button text of a link: that of the choice node it points at. */
  private labelOf(link: Link): string {
    const target = this._story.scenes[link.to];
    return target ? choiceLabel(target) : link.to;
  }

  private requireScene(id: SceneId): Scene {
    const scene = this._story.scenes[id];
    if (!scene) throw new EngineError('unknown-scene', `La scene « ${id} » n'existe pas.`);
    return scene;
  }

  private assertKnownScene(id: SceneId): void {
    this.requireScene(id);
  }
}
