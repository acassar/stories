/**
 * Moteur d'histoire — TypeScript pur, sans framework, sans DOM, sans I/O.
 *
 * Il connait trois choses : un recit (immuable), un etat de partie (remplace a
 * chaque transition, jamais mute), et une liste d'abonnes qu'il previent quand
 * l'un des deux bouge. Toute UI qui sait s'abonner peut l'afficher.
 */

import { parseStory } from '@embranche/story-format';
import type {
  Choice,
  ChoiceId,
  GameState,
  Scene,
  SceneEnding,
  SceneId,
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

/** Un choix tel que l'UI doit le voir : le libelle, et s'il est proposable. */
export interface ResolvedChoice {
  id: ChoiceId;
  label: string;
  target: SceneId;
  /** Faux quand la condition du choix n'est pas remplie. */
  available: boolean;
}

/** La scene courante, deja resolue : plus rien a interpreter cote UI. */
export interface ResolvedScene {
  id: SceneId;
  title: string;
  blocks: readonly TextBlock[];
  /** Uniquement les choix disponibles. `allChoices` porte les autres. */
  choices: readonly ResolvedChoice[];
  allChoices: readonly ResolvedChoice[];
  isEnding: boolean;
  ending?: SceneEnding;
  media?: Scene['media'];
}

/**
 * Instantane complet. Sa reference ne change que si l'etat change — c'est le
 * contrat attendu par `useSyncExternalStore`.
 */
export interface EngineSnapshot {
  state: GameState;
  scene: ResolvedScene;
  canGoBack: boolean;
  /** Nombre de fins distinctes du recit, et celle qui vient d'etre atteinte. */
  endingCount: number;
}

export interface EngineEvents {
  /** Emis a chaque nouvel etat, quelle qu'en soit la cause. */
  'state:changed': { state: GameState; snapshot: EngineSnapshot };
  /** Emis quand la scene courante change (choix, retour, reprise, reinitialisation). */
  'scene:changed': { scene: ResolvedScene; previousSceneId: SceneId | null };
  /** Emis apres application des effets d'un choix retenu. */
  'choice:applied': { choice: Choice; from: SceneId; to: SceneId };
  /** Emis a l'arrivee sur une scene terminale. */
  'story:ended': { scene: ResolvedScene; ending: SceneEnding };
}

export interface StoryEngineOptions {
  /** Etat de depart. Par defaut, une partie neuve sur la scene initiale. */
  state?: GameState;
  /** Horloge injectable, pour des tests deterministes. */
  now?: Clock;
  /**
   * Valider le recit a la construction (defaut : `true`). Le studio le passe a
   * `false` pendant l'edition, ou le graphe est transitoirement incoherent.
   */
  validate?: boolean;
}

export class StoryEngine {
  private readonly emitter = new Emitter<EngineEvents>();
  private readonly clock: Clock;
  private readonly _story: Story;
  private _state: GameState;
  private _snapshot: EngineSnapshot;
  /** Abonnes « bruts » de `subscribe()` — le pont vers useSyncExternalStore. */
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

  /** Ouvre un recit depuis un JSON quelconque : il est valide au passage. */
  static fromJson(json: string, options: StoryEngineOptions = {}): StoryEngine {
    return new StoryEngine(JSON.parse(json) as Story, options);
  }

  // -------------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------------

  get story(): Story {
    return this._story;
  }

  get state(): GameState {
    return this._state;
  }

  /** Instantane courant — reference stable tant que l'etat ne change pas. */
  getSnapshot(): EngineSnapshot {
    return this._snapshot;
  }

  getCurrentScene(): ResolvedScene {
    return this._snapshot.scene;
  }

  /** Uniquement les choix dont la condition est remplie. */
  getAvailableChoices(): readonly ResolvedChoice[] {
    return this._snapshot.scene.choices;
  }

  canChoose(choiceId: ChoiceId): boolean {
    return this._snapshot.scene.choices.some((choice) => choice.id === choiceId);
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
   * Retient un choix : verifie qu'il est disponible, applique ses effets, puis
   * avance vers la scene cible. Leve `EngineError` si le choix n'existe pas ou
   * si sa condition n'est pas remplie — l'UI ne devrait jamais le proposer.
   */
  choose(choiceId: ChoiceId): void {
    const from = this._state.currentSceneId;
    const scene = this.requireScene(from);
    const choice = scene.choices.find((c) => c.id === choiceId);

    if (!choice) {
      throw new EngineError(
        'unknown-choice',
        `La scene « ${from} » ne propose aucun choix « ${choiceId} ».`,
      );
    }
    if (!isSatisfied(choice.condition, contextFromState(this._state))) {
      throw new EngineError(
        'choice-unavailable',
        `Le choix « ${choice.label} » n'est pas disponible dans l'etat courant.`,
      );
    }
    this.assertKnownScene(choice.target);

    // Les effets sont appliques avant l'arrivee : la scene cible et ses propres
    // conditions voient deja le monde tel que le choix vient de le modifier.
    let next = applyEffects(this._state, choice.effects);
    next = {
      ...next,
      currentSceneId: choice.target,
      history: [...next.history, { sceneId: from, choiceId: choice.id, label: choice.label }],
      visited: next.visited.includes(choice.target) ? next.visited : [...next.visited, choice.target],
      updatedAt: this.clock(),
    };

    this.commit(next, from);
    this.emitter.emit('choice:applied', { choice, from, to: choice.target });

    const arrived = this._snapshot.scene;
    if (arrived.isEnding && arrived.ending) {
      this.emitter.emit('story:ended', { scene: arrived, ending: arrived.ending });
    }
  }

  /**
   * Revient d'un cran. L'etat est *rejoue* depuis le debut a partir de
   * l'historique tronque, plutot que d'essayer d'inverser les effets : c'est la
   * seule facon exacte d'annuler un `toggle` ou un `set` qui a ecrase une
   * valeur. Le moteur etant deterministe, le rejeu redonne l'etat exact.
   */
  goBack(): void {
    if (this._state.history.length === 0) {
      throw new EngineError('empty-history', 'Aucune etape a annuler.');
    }
    const from = this._state.currentSceneId;
    const target = this._state.history.slice(0, -1);
    const replayed = this.replay(target);
    this.commit(replayed, from);
  }

  /** Repart de zero sur le meme recit. */
  reset(): void {
    const from = this._state.currentSceneId;
    this.commit(createInitialState(this._story, this.clock), from);
  }

  /** Reprend une partie sauvegardee. */
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
  // Persistance (l'appelant decide ou ranger le resultat)
  // -------------------------------------------------------------------------

  serialize(): string {
    return serializeState(this._state);
  }

  // -------------------------------------------------------------------------
  // Abonnement
  // -------------------------------------------------------------------------

  /**
   * Abonnement sans charge utile, appele a chaque changement d'etat.
   * Conçu pour `useSyncExternalStore(engine.subscribe, engine.getSnapshot)`.
   */
  readonly subscribe = (listener: () => void): Unsubscribe => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  /** Abonnement type, evenement par evenement. */
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

  /** Coupe tous les abonnements — a appeler quand l'UI se demonte. */
  dispose(): void {
    this.emitter.removeAllListeners();
    this.subscribers.clear();
  }

  // -------------------------------------------------------------------------
  // Interne
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

  /** Rejoue une suite de choix depuis un etat neuf. */
  private replay(history: GameState['history']): GameState {
    let state = createInitialState(this._story, this.clock);
    state = { ...state, startedAt: this._state.startedAt };

    for (const entry of history) {
      const scene = this._story.scenes[entry.sceneId];
      const choice = scene?.choices.find((c) => c.id === entry.choiceId);
      // Un historique qui ne colle plus au recit (scene supprimee depuis) est
      // tronque ici plutot que de faire planter la reprise.
      if (!choice || !this._story.scenes[choice.target]) break;

      state = applyEffects(state, choice.effects);
      state = {
        ...state,
        currentSceneId: choice.target,
        history: [...state.history, entry],
        visited: state.visited.includes(choice.target)
          ? state.visited
          : [...state.visited, choice.target],
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
    };
  }

  private resolveScene(state: GameState): ResolvedScene {
    const scene = this.requireScene(state.currentSceneId);
    const context = contextFromState(state);

    const allChoices: ResolvedChoice[] = scene.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      target: choice.target,
      available: isSatisfied(choice.condition, context),
    }));

    const resolved: ResolvedScene = {
      id: scene.id,
      title: scene.title,
      blocks: scene.blocks,
      // Une scene terminale ne propose rien, meme si des choix y trainent encore.
      choices: scene.ending ? [] : allChoices.filter((choice) => choice.available),
      allChoices,
      isEnding: Boolean(scene.ending),
    };
    if (scene.ending) resolved.ending = scene.ending;
    if (scene.media) resolved.media = scene.media;
    return resolved;
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
