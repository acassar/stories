/**
 * Schemas Zod du format d'histoire.
 *
 * Ils portent la validation *structurelle* (formes, types, champs requis).
 * La coherence du graphe (cibles existantes, scene de depart, orphelines...)
 * est verifiee separement dans `validate.ts` : c'est une propriete du recit,
 * pas de la forme du document.
 */

import { z } from 'zod';
import { STORY_FORMAT_VERSION } from './types.js';
import type { Condition, Effect } from './types.js';

const identifier = z
  .string()
  .min(1, 'identifiant vide')
  .regex(/^[A-Za-z0-9_-]+$/, 'identifiant : lettres, chiffres, tiret et souligne uniquement');

export const variableValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const storyThemeSchema = z.enum(['fantasy', 'mystery', 'adventure', 'night']);

export const storyStatusSchema = z.enum(['draft', 'published']);

const comparisonOperatorSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);

/**
 * Le type est annote a la main : Zod ne sait pas inferer un schema recursif,
 * et on veut que le schema et le type TypeScript restent verrouilles ensemble.
 */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('always') }),
    z.object({
      op: comparisonOperatorSchema,
      variable: z.string().min(1),
      value: variableValueSchema,
    }),
    z.object({ op: z.literal('hasItem'), item: identifier, quantity: z.number().int().min(1).optional() }),
    z.object({ op: z.literal('lacksItem'), item: identifier, quantity: z.number().int().min(1).optional() }),
    z.object({ op: z.literal('visited'), scene: identifier }),
    z.object({ op: z.literal('notVisited'), scene: identifier }),
    z.object({ op: z.literal('and'), conditions: z.array(conditionSchema).min(1) }),
    z.object({ op: z.literal('or'), conditions: z.array(conditionSchema).min(1) }),
    z.object({ op: z.literal('not'), condition: conditionSchema }),
  ]),
);

export const effectSchema: z.ZodType<Effect> = z.discriminatedUnion('op', [
  z.object({ op: z.literal('set'), variable: z.string().min(1), value: variableValueSchema }),
  z.object({ op: z.literal('inc'), variable: z.string().min(1), value: z.number() }),
  z.object({ op: z.literal('dec'), variable: z.string().min(1), value: z.number() }),
  z.object({ op: z.literal('toggle'), variable: z.string().min(1) }),
  z.object({ op: z.literal('unset'), variable: z.string().min(1) }),
  z.object({ op: z.literal('addItem'), item: identifier, quantity: z.number().int().min(1).optional() }),
  z.object({ op: z.literal('removeItem'), item: identifier, quantity: z.number().int().min(1).optional() }),
]);

export const textBlockSchema = z.object({
  text: z.string(),
  speaker: z.enum(['narrator', 'player']).optional(),
});

export const choiceSchema = z.object({
  id: identifier,
  label: z.string().min(1, 'un choix sans libelle ne peut pas etre propose'),
  target: identifier,
  condition: conditionSchema.optional(),
  effects: z.array(effectSchema).optional(),
});

export const sceneEndingSchema = z.object({
  type: z.string(),
  name: z.string(),
  blurb: z.string(),
});

export const sceneMediaSchema = z.object({
  backgroundImage: z.string().optional(),
  ambience: z.string().optional(),
  portrait: z.string().optional(),
});

export const positionSchema = z.object({ x: z.number(), y: z.number() });

export const sceneSchema = z.object({
  id: identifier,
  title: z.string(),
  blocks: z.array(textBlockSchema),
  choices: z.array(choiceSchema),
  position: positionSchema,
  ending: sceneEndingSchema.optional(),
  media: sceneMediaSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const narratorSchema = z.object({
  name: z.string().min(1),
  status: z.string().optional(),
});

export const storySchema = z.object({
  formatVersion: z.number().int().min(1).max(STORY_FORMAT_VERSION),
  id: identifier,
  title: z.string().min(1),
  version: z.string().min(1),
  author: z.string().optional(),
  blurb: z.string().optional(),
  tag: z.string().optional(),
  theme: storyThemeSchema.optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  status: storyStatusSchema.optional(),
  narrator: narratorSchema.optional(),
  startSceneId: identifier,
  variables: z.record(variableValueSchema).optional(),
  inventory: z.record(z.number().int().min(0)).optional(),
  scenes: z.record(sceneSchema),
});

export const historyEntrySchema = z.object({
  sceneId: identifier,
  choiceId: identifier,
  label: z.string(),
});

export const gameStateSchema = z.object({
  storyId: identifier,
  storyVersion: z.string(),
  currentSceneId: identifier,
  variables: z.record(variableValueSchema),
  inventory: z.record(z.number().int().min(0)),
  history: z.array(historyEntrySchema),
  visited: z.array(identifier),
  startedAt: z.string(),
  updatedAt: z.string(),
});
