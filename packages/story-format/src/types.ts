/**
 * Format d'histoire Embranche — le contrat entre le studio (qui ecrit) et le
 * lecteur (qui lit). TypeScript pur : aucune dependance framework, aucun DOM.
 *
 * Regle d'or : tout ce qui est ici doit survivre a un aller-retour JSON.
 * Pas de fonction, pas de `Date`, pas de code — conditions et effets sont des
 * donnees declaratives interpretees par `@embranche/story-engine`.
 */

/** Version du format lui-meme, pour la migration future des fichiers. */
export const STORY_FORMAT_VERSION = 2;

export type SceneId = string;
export type LinkId = string;
export type VariableName = string;
export type ItemId = string;

/** Les seules valeurs qu'une variable de jeu peut prendre. */
export type VariableValue = string | number | boolean;

/** Teinte de reliure du recit — pilote la couverture et l'accent de l'UI. */
export type StoryTheme = 'fantasy' | 'mystery' | 'adventure' | 'night';

/** Cycle de vie editorial, pilote depuis le tableau de bord du studio. */
export type StoryStatus = 'draft' | 'published';

// ---------------------------------------------------------------------------
// Conditions — vocabulaire ferme, evalue par le moteur.
// ---------------------------------------------------------------------------

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export type Condition =
  /** Toujours vrai — sert de valeur neutre explicite. */
  | { op: 'always' }
  /** Compare une variable de jeu a une valeur litterale. */
  | { op: ComparisonOperator; variable: VariableName; value: VariableValue }
  /** L'inventaire contient au moins `quantity` (defaut 1) exemplaires. */
  | { op: 'hasItem'; item: ItemId; quantity?: number }
  /** L'inventaire en contient strictement moins que `quantity` (defaut 1). */
  | { op: 'lacksItem'; item: ItemId; quantity?: number }
  /** La scene a deja ete traversee au cours de la partie. */
  | { op: 'visited'; scene: SceneId }
  | { op: 'notVisited'; scene: SceneId }
  | { op: 'and'; conditions: Condition[] }
  | { op: 'or'; conditions: Condition[] }
  | { op: 'not'; condition: Condition };

// ---------------------------------------------------------------------------
// Effets — appliques quand un choix est retenu.
// ---------------------------------------------------------------------------

export type Effect =
  /** Ecrit une valeur litterale dans une variable. */
  | { op: 'set'; variable: VariableName; value: VariableValue }
  /** Incremente / decremente une variable numerique (creee a 0 si absente). */
  | { op: 'inc'; variable: VariableName; value: number }
  | { op: 'dec'; variable: VariableName; value: number }
  /** Inverse un booleen (une variable absente devient `true`). */
  | { op: 'toggle'; variable: VariableName }
  /** Retire completement la variable de l'etat. */
  | { op: 'unset'; variable: VariableName }
  | { op: 'addItem'; item: ItemId; quantity?: number }
  /** Retire au plus `quantity` exemplaires ; ne descend jamais sous zero. */
  | { op: 'removeItem'; item: ItemId; quantity?: number };

// ---------------------------------------------------------------------------
// Contenu
// ---------------------------------------------------------------------------

/**
 * Un bloc de texte d'une scene. Le lecteur les rend en correspondance : un
 * bloc = un message qui arrive, avec un temps de frappe avant apparition.
 *
 * Le bloc ne dit pas qui parle : c'est le `kind` du noeud qui le porte, et lui
 * seul. Le format 1 avait un `speaker` par message ; deux sources de verite
 * pour la meme question finissent toujours par se contredire, et c'etait le
 * cas. Un changement de locuteur au milieu d'une scene se dit desormais avec
 * ce que le format sait faire : un second noeud, enchaine.
 */
export interface TextBlock {
  text: string;
}

/**
 * Type d'un noeud — c'est lui qui porte toute la semantique du graphe.
 *
 * - `npc`    : l'interlocuteur parle.
 * - `player` : le joueur parle, sans rien decider. Le recit enchaine seul.
 * - `choice` : le joueur decide. Seul type qui arrete la lecture.
 *
 * Consequence : une scene n'a plus a declarer si elle propose des choix. Il
 * suffit de regarder le type de ce qu'elle vise — si ce sont des `choice`, ce
 * sont des boutons ; sinon, on enchaine.
 */
export type SceneKind = 'npc' | 'player' | 'choice';

/**
 * Une transition, devenue un objet a part entiere.
 *
 * C'est le lien — pas la scene d'arrivee — qui porte `condition` et `effects` :
 * une meme scene pouvant desormais etre atteinte par plusieurs chemins, ranger
 * les consequences sur la scene les appliquerait quel que soit le chemin suivi.
 */
export interface Link {
  id: LinkId;
  /** Scene atteinte en empruntant ce lien. */
  to: SceneId;
  /**
   * Si presente et non satisfaite, le lien est impraticable : le bouton n'est
   * pas propose, ou l'enchainement automatique passe au lien suivant.
   */
  condition?: Condition;
  /** Appliques dans l'ordre, avant l'arrivee sur la scene cible. */
  effects?: Effect[];
}

/**
 * Habillage d'une fin. Sa presence marque la scene comme terminale : le lecteur
 * bascule alors sur l'ecran de fin au lieu de proposer des choix.
 */
export interface SceneEnding {
  /** Categorie affichee en capitales : « Fin lumineuse », « Fin tragique »... */
  type: string;
  /** Nom de la fin, tel qu'il apparait au palmares du joueur. */
  name: string;
  /** Une ou deux phrases de cloture. */
  blurb: string;
}

/**
 * Champs media — declares des maintenant pour figer le contrat, volontairement
 * non exploites par les apps de cette iteration.
 */
export interface SceneMedia {
  /** Chemin ou URL d'une image de fond. */
  backgroundImage?: string;
  /** Chemin ou URL d'une ambiance sonore bouclee. */
  ambience?: string;
  /** Portrait de l'interlocuteur pour cette scene. */
  portrait?: string;
}

export interface Scene {
  id: SceneId;
  kind: SceneKind;
  /** Titre de travail — affiche dans le studio, jamais au joueur. */
  title: string;
  /**
   * Libelle du bouton, pour un noeud `choice` uniquement. Distinct de `blocks` :
   * le bouton peut annoncer « Mentir » quand la replique envoyee est tout autre.
   * A defaut de `blocks`, c'est le libelle qui part dans la correspondance.
   */
  label?: string;
  /** Corps de la scene, decoupe en messages. */
  blocks: TextBlock[];
  /** Liens sortants, dans l'ordre — c'est l'ordre d'affichage des boutons. */
  next: Link[];
  /** Position du noeud sur le canvas du studio ; persistee dans le format. */
  position: { x: number; y: number };
  ending?: SceneEnding;
  media?: SceneMedia;
  /** Etiquettes libres, pour le filtrage cote studio. */
  tags?: string[];
}

/** L'interlocuteur de la correspondance : qui ecrit au joueur. */
export interface Narrator {
  name: string;
  /** Ligne de statut sous le nom : « la voix de la clairiere », « en ligne »... */
  status?: string;
}

export interface StoryMeta {
  id: string;
  title: string;
  /** Version editoriale du recit (semver libre), distincte de `formatVersion`. */
  version: string;
  author?: string;
  /** Accroche de l'ecran de detail. */
  blurb?: string;
  /** Etiquette de genre affichee : « Fantastique », « Enquete »... */
  tag?: string;
  theme?: StoryTheme;
  /** Duree de lecture annoncee, en minutes. */
  estimatedMinutes?: number;
  status?: StoryStatus;
  narrator?: Narrator;
}

export interface Story extends StoryMeta {
  formatVersion: number;
  startSceneId: SceneId;
  /** Valeurs initiales des variables de jeu. */
  variables?: Record<VariableName, VariableValue>;
  /** Contenu initial de l'inventaire : identifiant d'objet → quantite. */
  inventory?: Record<ItemId, number>;
  /** Dictionnaire des scenes, indexe par `Scene.id`. */
  scenes: Record<SceneId, Scene>;
}

// ---------------------------------------------------------------------------
// Etat de jeu
// ---------------------------------------------------------------------------

/** Une etape franchie : la scene quittee et le lien qui en a fait sortir. */
export interface HistoryEntry {
  sceneId: SceneId;
  linkId: LinkId;
}

export interface GameState {
  storyId: string;
  /** Version du recit au moment de la sauvegarde, pour detecter un decalage. */
  storyVersion: string;
  currentSceneId: SceneId;
  variables: Record<VariableName, VariableValue>;
  inventory: Record<ItemId, number>;
  history: HistoryEntry[];
  /** Scenes traversees, dans l'ordre de premiere visite. */
  visited: SceneId[];
  /** Horodatages ISO 8601 — chaines, pour rester serialisables. */
  startedAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'schema'
  | 'missing-start-scene'
  | 'scene-id-mismatch'
  | 'dangling-link-target'
  | 'duplicate-link-id'
  | 'self-loop'
  | 'orphan-scene'
  | 'ending-with-links'
  | 'dead-end'
  | 'unknown-variable'
  | 'empty-scene'
  | 'no-ending'
  /** Un noeud `choice` sans libelle : le bouton serait vide. */
  | 'choice-without-label'
  /** Un noeud melange des liens vers des choix et vers des enchainements. */
  | 'mixed-links'
  /** Enchainement automatique dont tous les liens sont conditionnels. */
  | 'no-default-link'
  /** Boucle d'enchainements automatiques : la lecture ne s'arreterait jamais. */
  | 'auto-loop';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: IssueCode;
  message: string;
  /** Scene concernee, quand l'anomalie est localisable. */
  sceneId?: SceneId;
  linkId?: LinkId;
  /** Chemin dans le document, pour les erreurs de schema. */
  path?: string;
}

export interface ValidationResult {
  /** Vrai si aucune anomalie de severite `error`. */
  valid: boolean;
  issues: ValidationIssue[];
}
