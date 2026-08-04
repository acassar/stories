/**
 * Validation d'une histoire : schema (forme) + coherence du graphe (fond).
 *
 * Le studio appelle `validateStory` en continu pour signaler les incoherences
 * pendant l'ecriture ; le lecteur appelle `parseStory` a l'ouverture d'un
 * fichier pour refuser net un document mal forme.
 */

import { gameStateSchema, storySchema } from './schema.js';
import type {
  Condition,
  Effect,
  GameState,
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

/** Valide la forme du document. N'inspecte pas la coherence du graphe. */
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
 * Valide forme *et* coherence. Les `error` empechent de jouer le recit, les
 * `warning` signalent un probleme d'ecriture sans bloquer.
 */
export function validateStory(input: unknown): ValidationResult {
  const shape = validateStoryShape(input);
  if (!shape.valid) return shape;

  const story = input as Story;
  const issues: ValidationIssue[] = [...checkGraph(story), ...checkVariables(story)];

  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}

/**
 * Valide et renvoie l'histoire typee. Leve `StoryFormatError` si le document
 * est inutilisable — c'est la porte d'entree des JSON venus de l'exterieur.
 */
export function parseStory(input: unknown): Story {
  const result = validateStory(input);
  if (!result.valid) {
    const first = result.issues.find((i) => i.severity === 'error');
    throw new StoryFormatError(
      `Histoire invalide : ${first?.message ?? 'anomalie inconnue'}`,
      result.issues,
    );
  }
  return input as Story;
}

/** Meme contrat que `parseStory`, mais depuis du texte JSON. */
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
      { severity: 'error', code: 'schema', message: parsed.error.issues[0]?.message ?? 'forme inattendue' },
    ]);
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Coherence du graphe
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

    if (scene.blocks.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'empty-scene',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » n'a aucun texte.`,
      });
    }

    if (scene.ending && scene.choices.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'ending-with-choices',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » est une fin mais propose encore des choix : ils ne seront jamais affiches.`,
      });
    }

    if (!scene.ending && scene.choices.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'dead-end',
        sceneId: scene.id,
        message: `« ${scene.title || scene.id} » n'a ni choix ni fin : le joueur s'y retrouve bloque.`,
      });
    }

    const seenChoiceIds = new Set<string>();
    for (const choice of scene.choices) {
      if (seenChoiceIds.has(choice.id)) {
        issues.push({
          severity: 'error',
          code: 'duplicate-choice-id',
          sceneId: scene.id,
          choiceId: choice.id,
          message: `Deux choix de « ${scene.title || scene.id} » portent l'identifiant « ${choice.id} ».`,
        });
      }
      seenChoiceIds.add(choice.id);

      if (!sceneIds.has(choice.target)) {
        issues.push({
          severity: 'error',
          code: 'dangling-choice-target',
          sceneId: scene.id,
          choiceId: choice.id,
          message: `Le choix « ${choice.label} » pointe vers une scene inexistante (« ${choice.target} »).`,
        });
      }

      if (choice.target === scene.id) {
        issues.push({
          severity: 'warning',
          code: 'self-loop',
          sceneId: scene.id,
          choiceId: choice.id,
          message: `Le choix « ${choice.label} » ramene a sa propre scene.`,
        });
      }
    }
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

  if (!Object.values(story.scenes).some((scene) => scene.ending)) {
    issues.push({
      severity: 'warning',
      code: 'no-ending',
      message: "Aucune scene n'est marquee comme fin : le recit ne peut pas se conclure.",
    });
  }

  return issues;
}

/** Parcours en largeur depuis la scene de depart. */
export function findReachableScenes(story: Story): Set<SceneId> {
  const reachable = new Set<SceneId>();
  if (!story.scenes[story.startSceneId]) return reachable;

  const queue: SceneId[] = [story.startSceneId];
  reachable.add(story.startSceneId);

  while (queue.length > 0) {
    const current = queue.shift() as SceneId;
    const scene = story.scenes[current];
    if (!scene) continue;
    for (const choice of scene.choices) {
      if (!reachable.has(choice.target) && story.scenes[choice.target]) {
        reachable.add(choice.target);
        queue.push(choice.target);
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
  for (const scene of Object.values(story.scenes)) {
    for (const choice of scene.choices) {
      for (const effect of choice.effects ?? []) {
        if ('variable' in effect) declared.add(effect.variable);
      }
    }
  }

  const issues: ValidationIssue[] = [];
  for (const scene of Object.values(story.scenes)) {
    for (const choice of scene.choices) {
      if (!choice.condition) continue;
      for (const name of collectConditionVariables(choice.condition)) {
        if (!declared.has(name)) {
          issues.push({
            severity: 'warning',
            code: 'unknown-variable',
            sceneId: scene.id,
            choiceId: choice.id,
            message: `La condition du choix « ${choice.label} » lit « ${name} », qui n'est jamais initialisee ni ecrite.`,
          });
        }
      }
    }
  }
  return issues;
}

/** Variables lues par une condition, en descendant les operateurs composites. */
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

/** Variables ecrites par une liste d'effets. */
export function collectEffectVariables(effects: readonly Effect[]): Set<VariableName> {
  const found = new Set<VariableName>();
  for (const effect of effects) {
    if ('variable' in effect) found.add(effect.variable);
  }
  return found;
}

/** Toutes les variables citees par le recit, lues comme ecrites. */
export function collectStoryVariables(story: Story): Set<VariableName> {
  const found = new Set<VariableName>(Object.keys(story.variables ?? {}));
  for (const scene of Object.values(story.scenes)) {
    for (const choice of scene.choices) {
      if (choice.condition) {
        for (const name of collectConditionVariables(choice.condition)) found.add(name);
      }
      for (const name of collectEffectVariables(choice.effects ?? [])) found.add(name);
    }
  }
  return found;
}

/** Anomalies rattachees a une scene — pour le badge d'erreur du studio. */
export function issuesForScene(result: ValidationResult, sceneId: SceneId): ValidationIssue[] {
  return result.issues.filter((issue) => issue.sceneId === sceneId);
}

/** Renvoie les scenes terminales du recit. */
export function findEndings(story: Story): Scene[] {
  return Object.values(story.scenes).filter((scene) => Boolean(scene.ending));
}
