/**
 * Moteur d'histoire — TypeScript pur, sans framework, sans DOM, sans I/O.
 *
 * Il connait trois choses : un recit (immuable), un etat de partie (remplace a
 * chaque transition, jamais mute), et une liste d'abonnes qu'il previent quand
 * l'un des deux bouge. Toute UI qui sait s'abonner peut l'afficher.
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
 * Un choix tel que l'UI doit le voir. `id` est celui du *lien* emprunte, pas
 * du noeud vise : deux liens peuvent mener au meme noeud de choix.
 */
export interface ResolvedChoice {
  id: LinkId;
  label: string;
  target: SceneId;
  /** Faux quand la condition du lien n'est pas remplie. */
  available: boolean;
}

/** La scene courante, deja resolue : plus rien a interpreter cote UI. */
export interface ResolvedScene {
  id: SceneId;
  kind: SceneKind;
  title: string;
  /** Ce que la scene envoie — le libelle d'un choix a defaut de corps. */
  blocks: readonly TextBlock[];
  /** Qui parle par defaut dans cette scene. */
  speaker: 'narrator' | 'player';
  /**
   * Les choix a proposer, si la scene en attend un. Vide quand le recit
   * enchaine seul : c'est `advance()` qui prend alors le relais.
   */
  choices: readonly ResolvedChoice[];
  allChoices: readonly ResolvedChoice[];
  /** Vrai si la lecture doit s'arreter ici en attendant une decision. */
  awaitsChoice: boolean;
  /** Vrai s'il reste un enchainement automatique praticable. */
  canAdvance: boolean;
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
  /**
   * Decisions reellement prises par le joueur — a distinguer de la longueur de
   * l'historique, qui compte aussi les noeuds traverses tout seuls.
   */
  decisions: number;
}

export interface EngineEvents {
  /** Emis a chaque nouvel etat, quelle qu'en soit la cause. */
  'state:changed': { state: GameState; snapshot: EngineSnapshot };
  /** Emis quand la scene courante change (choix, enchainement, retour, reprise). */
  'scene:changed': { scene: ResolvedScene; previousSceneId: SceneId | null };
  /**
   * Emis apres application des effets d'un lien emprunte. `chosen` distingue
   * la decision du joueur du simple enchainement.
   */
  'link:followed': { link: Link; from: SceneId; to: SceneId; chosen: boolean };
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

  /**
   * Instantane courant — reference stable tant que l'etat ne change pas.
   * Liee a l'instance : `useSyncExternalStore` la recoit detachee du moteur.
   */
  readonly getSnapshot = (): EngineSnapshot => this._snapshot;

  getCurrentScene(): ResolvedScene {
    return this._snapshot.scene;
  }

  /** Uniquement les choix dont la condition est remplie. */
  getAvailableChoices(): readonly ResolvedChoice[] {
    return this._snapshot.scene.choices;
  }

  canChoose(linkId: LinkId): boolean {
    return this._snapshot.scene.choices.some((choice) => choice.id === linkId);
  }

  /** Vrai si le recit peut poursuivre seul, sans decision du joueur. */
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
   * Retient un choix : verifie que le lien est proposable, applique ses effets,
   * puis avance. Leve `EngineError` si le lien n'existe pas, ne mene pas a un
   * noeud de choix, ou si sa condition n'est pas remplie — l'UI ne devrait
   * jamais proposer un tel bouton.
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
   * Poursuit sans decision : emprunte le premier lien praticable vers un noeud
   * qui n'est pas un choix. Renvoie faux quand il n'y a rien a enchainer — la
   * scene attend le joueur, ou le recit est fini.
   *
   * C'est l'UI qui appelle, une etape a la fois, plutot que le moteur qui
   * deroule la chaine d'un coup : chaque noeud traverse doit pouvoir s'afficher
   * a son rythme dans la correspondance.
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

  /** Emprunte un lien : effets, deplacement, historique, evenements. */
  private follow(link: Link, chosen: boolean): void {
    const from = this._state.currentSceneId;
    this.assertKnownScene(link.to);

    // Les effets sont appliques avant l'arrivee : la scene cible et ses propres
    // conditions voient deja le monde tel que le lien vient de le modifier.
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
   * Revient au dernier choix — pas au dernier noeud.
   *
   * Les enchainements automatiques sont annules avec lui : reculer d'un seul
   * cran reposerait le joueur devant une scene qui repartirait aussitot toute
   * seule, et le bouton « revenir » ne ferait rien de visible.
   *
   * L'etat est *rejoue* depuis le debut a partir de l'historique tronque,
   * plutot que d'essayer d'inverser les effets : c'est la seule facon exacte
   * d'annuler un `toggle` ou un `set` qui a ecrase une valeur. Le moteur etant
   * deterministe, le rejeu redonne l'etat exact.
   */
  goBack(): void {
    if (this._state.history.length === 0) {
      throw new EngineError('empty-history', 'Aucune etape a annuler.');
    }
    const from = this._state.currentSceneId;
    const replayed = this.replay(this._state.history.slice(0, this.lastDecisionIndex()));
    this.commit(replayed, from);
  }

  /** Rang, dans l'historique, du dernier lien retenu par le joueur. */
  private lastDecisionIndex(): number {
    for (let i = this._state.history.length - 1; i >= 0; i -= 1) {
      const entry = this._state.history[i];
      if (entry && this.isDecision(entry)) return i;
    }
    return 0;
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
      const link = scene?.next.find((candidate) => candidate.id === entry.linkId);
      // Un historique qui ne colle plus au recit (scene supprimee depuis) est
      // tronque ici plutot que de faire planter la reprise.
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

  /** Une etape de l'historique correspond-elle a un bouton effectivement presse ? */
  private isDecision(entry: GameState['history'][number]): boolean {
    const link = this._story.scenes[entry.sceneId]?.next.find((l) => l.id === entry.linkId);
    return Boolean(link && this._story.scenes[link.to]?.kind === 'choice');
  }

  private resolveScene(state: GameState): ResolvedScene {
    const scene = this.requireScene(state.currentSceneId);
    const context = contextFromState(state);
    // Une scene terminale ne mene nulle part, meme si des liens y trainent encore.
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

  /** Le texte du bouton d'un lien : celui du noeud de choix qu'il vise. */
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
