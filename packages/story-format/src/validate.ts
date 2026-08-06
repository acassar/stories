/**
 * Story validation: schema (shape) + graph coherence (substance).
 *
 * The studio calls `validateStory` continuously to surface inconsistencies
 * while writing; the reader calls `parseStory` when opening a file to reject a
 * malformed document outright.
 */

import { migrateStory } from './migrate.js';
import { findAutoLoops } from './scenes.js';
import { gameStateSchema, storySchema } from './schema.js';
import type {
  Condition,
  Effect,
  GameState,
  Link,
  Scene,
  SceneId,
  Story,
  ValidationIssue,
  ValidationResult,
  VariableName,
} from './types.js';

export class StoryFormatError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'StoryFormatError';
    this.issues = issues;
  }
}

/** Validates the document shape. Does not inspect graph coherence. */
export function validateStoryShape(input: unknown): ValidationResult {
  const parsed = storySchema.safeParse(input);
  if (parsed.success) return { valid: true, issues: [] };
  return {
    valid: false,
    issues: parsed.error.issues.map((issue) => ({
      severity: 'error' as const,
      code: 'schema' as const,
      message: issue.message,
      path: issue.path.join('.'),
    })),
  };
}

/**
 * Validates shape *and* coherence. An `error` makes the story unplayable; a
 * `warning` flags a writing problem without blocking.
 */
export function validateStory(input: unknown): ValidationResult {
  const shape = validateStoryShape(input);
  if (!shape.valid) return shape;

  const story = input as Story;
  const issues: ValidationIssue[] = [...checkGraph(story), ...checkVariables(story)];

  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}

/**
 * Validates and returns the typed story. Throws `StoryFormatError` when the
 * document is unusable — this is the entry point for JSON coming from outside,
 * and therefore the place where an older document is migrated.
 */
export function parseStory(input: unknown): Story {
  const migrated = migrateStory(input);
  const result = validateStory(migrated);
  if (!result.valid) {
    const first = result.issues.find((i) => i.severity === 'error');
    throw new StoryFormatError(
      `Histoire invalide : ${first?.message ?? 'anomalie inconnue'}`,
      result.issues,
    );
  }
  return migrated as Story;
}

/** Same contract as `parseStory`, but starting from JSON text. */
export function parseStoryJson(json: string): Story {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new StoryFormatError('JSON illisible', [
      { severity: 'error', code: 'schema', message: (error as Error).message },
    ]);
  }
  return parseStory(data);
}

export function parseGameState(input: unknown): GameState {
  const parsed = gameStateSchema.safeParse(input);
  if (!parsed.success) {
    throw new StoryFormatError('Sauvegarde invalide', [
      {
        severity: 'error',
        code: 'schema',
        message: parsed.error.issues[0]?.message ?? 'forme inattendue',
      },
    ]);
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Graph coherence
// ---------------------------------------------------------------------------

function checkGraph(story: Story): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sceneIds = new Set(Object.keys(story.scenes));

  if (!sceneIds.has(story.startSceneId)) {
    issues.push({
      severity: 'error',
      code: 'missing-start-scene',
      message: `La scene de depart « ${story.startSceneId} » n'existe pas.`,
    });
  }

  for (const [key, scene] of Object.entries(story.scenes)) {
    if (key !== scene.id) {
      issues.push({
        severity: 'error',
        code: 'scene-id-mismatch',
        sceneId: key,
        message: `La cle « ${key} » ne correspond pas a l'identifiant « ${scene.id} ».`,
      });
    }

    if (scene.blocks.length === 0 && !(scene.kind === 'choice' && scene.label)) {
      issues.push({
        severity: 'warning',
        code: 'empty-scene',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » n'a aucun texte.`,
      });
    }

    if (scene.kind === 'choice' && !scene.label) {
      issues.push({
        severity: 'error',
        code: 'choice-without-label',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » est un choix sans libelle : le bouton serait vide.`,
      });
    }

    if (scene.ending && scene.next.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'ending-with-links',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » est une fin mais garde des liens sortants : ils ne seront jamais suivis.`,
      });
    }

    if (!scene.ending && scene.next.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'dead-end',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » n'a ni suite ni fin : le joueur s'y retrouve bloque.`,
      });
    }

    issues.push(...checkLinkShape(scene, sceneIds));
    issues.push(...checkLinkKinds(story, scene));
  }

  for (const id of findUnreachableScenes(story)) {
    const scene = story.scenes[id];
    issues.push({
      severity: 'warning',
      code: 'orphan-scene',
      sceneId: id,
      message: `« ${scene?.title || id} » n'est atteignable depuis aucun choix.`,
    });
  }

  for (const id of findAutoLoops(story)) {
    const scene = story.scenes[id];
    issues.push({
      severity: 'error',
      code: 'auto-loop',
      sceneId: id,
      message: `« ${scene?.title || id} » boucle sur elle-meme sans jamais proposer de choix : la lecture n'en sortirait pas.`,
    });
  }

  if (!Object.values(story.scenes).some((scene) => scene.ending)) {
    issues.push({
      severity: 'warning',
      code: 'no-ending',
      message: "Aucune scene n'est marquee comme fin : le recit ne peut pas se conclure.",
    });
  }

  return issues;
}

/** Duplicate ids, dangling targets, self-loops. */
function checkLinkShape(scene: Scene, sceneIds: Set<SceneId>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const name = scene.title || scene.id;

  for (const link of scene.next) {
    if (seen.has(link.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-link-id',
        sceneId: scene.id,
        linkId: link.id,
        message: `Deux liens de « ${name} » portent l'identifiant « ${link.id} ».`,
      });
    }
    seen.add(link.id);

    if (!sceneIds.has(link.to)) {
      issues.push({
        severity: 'error',
        code: 'dangling-link-target',
        sceneId: scene.id,
        linkId: link.id,
        message: `Un lien de « ${name} » pointe vers une scene inexistante (« ${link.to} »).`,
      });
    }

    if (link.to === scene.id) {
      issues.push({
        severity: 'warning',
        code: 'self-loop',
        sceneId: scene.id,
        linkId: link.id,
        message: `Un lien de « ${name} » ramene a sa propre scene.`,
      });
    }
  }
  return issues;
}

/**
 * Kind coherence of the links leaving a node.
 *
 * Two rules, and they are all that separates a branch from a chain: links to
 * choices are never mixed with links to anything else (the reader would not
 * know whether to wait for the player), and automatic chaining needs one
 * unconditional way out.
 */
function checkLinkKinds(story: Story, scene: Scene): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = scene.next.filter((link) => story.scenes[link.to]);
  if (known.length === 0) return issues;

  const name = scene.title || scene.id;
  const toChoice = known.filter((link) => story.scenes[link.to]?.kind === 'choice');

  if (toChoice.length > 0 && toChoice.length < known.length) {
    const stray = known.find((link) => story.scenes[link.to]?.kind !== 'choice');
    issues.push({
      severity: 'error',
      code: 'mixed-links',
      sceneId: scene.id,
      ...(stray ? { linkId: stray.id } : {}),
      message: `« ${name} » melange des liens vers des choix et des liens d'enchainement : il faut trancher entre laisser le joueur decider et poursuivre seul.`,
    });
  }

  // A fully conditional chain may have no way out at the moment it is taken:
  // the story would stop without reaching an ending.
  if (toChoice.length === 0 && !scene.ending && known.every((link) => link.condition)) {
    issues.push({
      severity: 'warning',
      code: 'no-default-link',
      sceneId: scene.id,
      message: `Tous les liens de « ${name} » sont conditionnels : si aucune condition n'est remplie, la lecture s'arrete la.`,
    });
  }

  return issues;
}

/** Breadth-first walk from the start scene. */
export function findReachableScenes(story: Story): Set<SceneId> {
  const reachable = new Set<SceneId>();
  if (!story.scenes[story.startSceneId]) return reachable;

  const queue: SceneId[] = [story.startSceneId];
  reachable.add(story.startSceneId);

  while (queue.length > 0) {
    const current = queue.shift() as SceneId;
    const scene = story.scenes[current];
    if (!scene) continue;
    for (const link of scene.next) {
      if (!reachable.has(link.to) && story.scenes[link.to]) {
        reachable.add(link.to);
        queue.push(link.to);
      }
    }
  }
  return reachable;
}

export function findUnreachableScenes(story: Story): SceneId[] {
  const reachable = findReachableScenes(story);
  return Object.keys(story.scenes).filter((id) => !reachable.has(id));
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

function checkVariables(story: Story): ValidationIssue[] {
  const declared = new Set<VariableName>(Object.keys(story.variables ?? {}));
  for (const { link } of allLinks(story)) {
    for (const effect of link.effects ?? []) {
      if ('variable' in effect) declared.add(effect.variable);
    }
  }

  const issues: ValidationIssue[] = [];
  for (const { scene, link } of allLinks(story)) {
    if (!link.condition) continue;
    for (const name of collectConditionVariables(link.condition)) {
      if (!declared.has(name)) {
        issues.push({
          severity: 'warning',
          code: 'unknown-variable',
          sceneId: scene.id,
          linkId: link.id,
          message: `La condition d'un lien de « ${scene.title || scene.id} » lit « ${name} », qui n'est jamais initialisee ni ecrite.`,
        });
      }
    }
  }
  return issues;
}

/** Every link of the story, paired with the scene it leaves from. */
export function allLinks(story: Story): { scene: Scene; link: Link }[] {
  return Object.values(story.scenes).flatMap((scene) =>
    scene.next.map((link) => ({ scene, link })),
  );
}

/** Variables read by a condition, descending through composite operators. */
export function collectConditionVariables(condition: Condition): Set<VariableName> {
  const found = new Set<VariableName>();
  const walk = (node: Condition): void => {
    switch (node.op) {
      case 'and':
      case 'or':
        node.conditions.forEach(walk);
        return;
      case 'not':
        walk(node.condition);
        return;
      case 'always':
      case 'hasItem':
      case 'lacksItem':
      case 'visited':
      case 'notVisited':
        return;
      default:
        found.add(node.variable);
    }
  };
  walk(condition);
  return found;
}

/** Variables written by a list of effects. */
export function collectEffectVariables(effects: readonly Effect[]): Set<VariableName> {
  const found = new Set<VariableName>();
  for (const effect of effects) {
    if ('variable' in effect) found.add(effect.variable);
  }
  return found;
}

/** Every variable the story mentions, read or written. */
export function collectStoryVariables(story: Story): Set<VariableName> {
  const found = new Set<VariableName>(Object.keys(story.variables ?? {}));
  for (const { link } of allLinks(story)) {
    if (link.condition) {
      for (const name of collectConditionVariables(link.condition)) found.add(name);
    }
    for (const name of collectEffectVariables(link.effects ?? [])) found.add(name);
  }
  return found;
}

/** Issues attached to a scene — for the studio error badge. */
export function issuesForScene(result: ValidationResult, sceneId: SceneId): ValidationIssue[] {
  return result.issues.filter((issue) => issue.sceneId === sceneId);
}

/** Returns the terminal scenes of the story. */
export function findEndings(story: Story): Scene[] {
  return Object.values(story.scenes).filter((scene) => Boolean(scene.ending));
}
