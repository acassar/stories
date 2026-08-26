/**
 * Embranche story format — the contract between the studio (which writes) and
 * the reader (which reads). Pure TypeScript: no framework dependency, no DOM.
 *
 * Golden rule: everything here must survive a JSON round-trip. No functions, no
 * `Date`, no code — conditions and effects are declarative data interpreted by
 * `@embranche/story-engine`.
 */

/** Version of the format itself, so files can be migrated. */
export const STORY_FORMAT_VERSION = 2;

export type SceneId = string;
export type LinkId = string;
export type VariableName = string;
export type ItemId = string;

/** The only values a game variable can hold. */
export type VariableValue = string | number | boolean;

/** Binding tint of the story — drives the cover and the UI accent. */
export type StoryTheme = 'fantasy' | 'mystery' | 'adventure' | 'night';

/** Editorial lifecycle, driven from the studio dashboard. */
export type StoryStatus = 'draft' | 'published';

// ---------------------------------------------------------------------------
// Conditions — closed vocabulary, evaluated by the engine.
// ---------------------------------------------------------------------------

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export type Condition =
  /** Always true — an explicit neutral value. */
  | { op: 'always' }
  /** Compares a game variable against a literal value. */
  | { op: ComparisonOperator; variable: VariableName; value: VariableValue }
  /** The inventory holds at least `quantity` (default 1) units. */
  | { op: 'hasItem'; item: ItemId; quantity?: number }
  /** The inventory holds strictly fewer than `quantity` (default 1) units. */
  | { op: 'lacksItem'; item: ItemId; quantity?: number }
  /** The scene has already been walked through during this run. */
  | { op: 'visited'; scene: SceneId }
  | { op: 'notVisited'; scene: SceneId }
  | { op: 'and'; conditions: Condition[] }
  | { op: 'or'; conditions: Condition[] }
  | { op: 'not'; condition: Condition };

// ---------------------------------------------------------------------------
// Effects — applied when a link is taken.
// ---------------------------------------------------------------------------

export type Effect =
  /** Writes a literal value into a variable. */
  | { op: 'set'; variable: VariableName; value: VariableValue }
  /** Increments / decrements a numeric variable (created at 0 if absent). */
  | { op: 'inc'; variable: VariableName; value: number }
  | { op: 'dec'; variable: VariableName; value: number }
  /** Flips a boolean (an absent variable becomes `true`). */
  | { op: 'toggle'; variable: VariableName }
  /** Removes the variable from the state entirely. */
  | { op: 'unset'; variable: VariableName }
  | { op: 'addItem'; item: ItemId; quantity?: number }
  /** Removes at most `quantity` units; never goes below zero. */
  | { op: 'removeItem'; item: ItemId; quantity?: number };

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/**
 * A block of text within a scene. The reader renders blocks as a conversation:
 * one block = one incoming message, preceded by a typing delay.
 *
 * A block does not say who is speaking — the `kind` of its node does, and it
 * alone. A change of speaker in the middle of a scene is written with what the
 * format already offers: a second node, chained to the first.
 */
export interface TextBlock {
  text: string;
}

/**
 * Node kind — it carries the whole semantics of the graph.
 *
 * - `npc`    : the correspondent speaks.
 * - `player` : the player speaks without deciding anything. The story chains on.
 * - `choice` : the player decides. The only kind that stops the reading.
 *
 * As a result, a scene never declares whether it offers choices. Looking at the
 * kind of what it points to is enough — `choice` targets become buttons, and
 * anything else chains on automatically.
 */
export type SceneKind = 'npc' | 'player' | 'choice';

/**
 * A transition, as a first-class object.
 *
 * The link — not the target scene — carries `condition` and `effects`, because
 * a scene can be reached through several paths: storing the consequences on the
 * scene would apply them whichever path was taken.
 */
export interface Link {
  id: LinkId;
  /** Scene reached by following this link. */
  to: SceneId;
  /**
   * When present and unsatisfied, the link is impassable: the button is not
   * offered, or the automatic chaining moves on to the next link.
   */
  condition?: Condition;
  /** Applied in order, before arriving on the target scene. */
  effects?: Effect[];
}

/**
 * Presentation of an ending. Its presence marks the scene as terminal: the
 * reader switches to the ending screen instead of offering choices.
 */
export interface SceneEnding {
  /** Category displayed in capitals: « Fin lumineuse », « Fin tragique »... */
  type: string;
  /** Name of the ending, as it appears in the player's record. */
  name: string;
  /** One or two closing sentences. */
  blurb: string;
}

/**
 * Media fields — declared to freeze the contract, deliberately unused by the
 * apps for now.
 */
export interface SceneMedia {
  /** Path or URL of a background image. */
  backgroundImage?: string;
  /** Path or URL of a looping ambience track. */
  ambience?: string;
  /** Portrait of the correspondent for this scene. */
  portrait?: string;
}

export interface Scene {
  id: SceneId;
  kind: SceneKind;
  /** Working title — shown in the studio, never to the player. */
  title: string;
  /**
   * Button label, for a `choice` node only. Distinct from `blocks`: the button
   * may read « Mentir » while the message actually sent says something else.
   * Without `blocks`, the label is what goes out into the conversation.
   */
  label?: string;
  /** Body of the scene, split into messages. */
  blocks: TextBlock[];
  /** Outgoing links, in order — that is the display order of the buttons. */
  next: Link[];
  /** Node position on the studio canvas; persisted in the format. */
  position: { x: number; y: number };
  ending?: SceneEnding;
  media?: SceneMedia;
  /** Free-form labels, for filtering on the studio side. */
  tags?: string[];
}

/** The correspondent of the conversation: who writes to the player. */
export interface Narrator {
  name: string;
  /** Status line under the name: « la voix de la clairiere », « en ligne »... */
  status?: string;
}

export interface StoryMeta {
  id: string;
  title: string;
  /** Editorial version of the story (free semver), distinct from `formatVersion`. */
  version: string;
  author?: string;
  /** Teaser shown on the detail screen. */
  blurb?: string;
  /** Genre label displayed to the player: « Fantastique », « Enquete »... */
  tag?: string;
  theme?: StoryTheme;
  /** Advertised reading time, in minutes. */
  estimatedMinutes?: number;
  status?: StoryStatus;
  narrator?: Narrator;
}

export interface Story extends StoryMeta {
  formatVersion: number;
  startSceneId: SceneId;
  /** Initial values of the game variables. */
  variables?: Record<VariableName, VariableValue>;
  /** Initial inventory contents: item id → quantity. */
  inventory?: Record<ItemId, number>;
  /** Scene dictionary, indexed by `Scene.id`. */
  scenes: Record<SceneId, Scene>;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/** One step taken: the scene left behind and the link that led out of it. */
export interface HistoryEntry {
  sceneId: SceneId;
  linkId: LinkId;
}

export interface GameState {
  storyId: string;
  /** Story version at save time, to detect a mismatch on resume. */
  storyVersion: string;
  currentSceneId: SceneId;
  variables: Record<VariableName, VariableValue>;
  inventory: Record<ItemId, number>;
  history: HistoryEntry[];
  /** Scenes walked through, in order of first visit. */
  visited: SceneId[];
  /** ISO 8601 timestamps — strings, to stay serializable. */
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
  /** A `{{ token }}` in the text names a variable the story never sets. */
  | 'unknown-variable-in-text'
  | 'empty-scene'
  | 'no-ending'
  /** A `choice` node without a label: the button would be empty. */
  | 'choice-without-label'
  /** A node mixes links to choices with automatic chaining links. */
  | 'mixed-links'
  /** Automatic chaining whose links are all conditional. */
  | 'no-default-link'
  /** Automatic chaining loop: the reading would never stop. */
  | 'auto-loop';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: IssueCode;
  message: string;
  /** Scene concerned, when the issue can be located. */
  sceneId?: SceneId;
  linkId?: LinkId;
  /** Path within the document, for schema errors. */
  path?: string;
}

export interface ValidationResult {
  /** True when no issue has `error` severity. */
  valid: boolean;
  issues: ValidationIssue[];
}
