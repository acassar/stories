/**
 * Zod schemas for the story format.
 *
 * They carry *structural* validation (shapes, types, required fields). Graph
 * coherence (existing targets, start scene, orphans...) is checked separately
 * in `validate.ts`: that is a property of the story, not of the document shape.
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
 * The type is annotated by hand: Zod cannot infer a recursive schema, and the
 * schema and the TypeScript type have to stay locked together.
 */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('always') }),
    z.object({
      op: comparisonOperatorSchema,
      variable: z.string().min(1),
      value: variableValueSchema,
    }),
    z.object({
      op: z.literal('hasItem'),
      item: identifier,
      quantity: z.number().int().min(1).optional(),
    }),
    z.object({
      op: z.literal('lacksItem'),
      item: identifier,
      quantity: z.number().int().min(1).optional(),
    }),
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
  z.object({
    op: z.literal('addItem'),
    item: identifier,
    quantity: z.number().int().min(1).optional(),
  }),
  z.object({
    op: z.literal('removeItem'),
    item: identifier,
    quantity: z.number().int().min(1).optional(),
  }),
]);

export const textBlockSchema = z.object({
  text: z.string(),
});

export const sceneKindSchema = z.enum(['npc', 'player', 'choice']);

export const linkSchema = z.object({
  id: identifier,
  to: identifier,
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

/**
 * The label is not required for `choice` nodes here: a button without text is a
 * story inconsistency, not a malformed document, and the studio must be able to
 * save a choice that was just created. `validate.ts` handles it.
 */
export const sceneSchema = z.object({
  id: identifier,
  kind: sceneKindSchema,
  title: z.string(),
  label: z.string().optional(),
  blocks: z.array(textBlockSchema),
  next: z.array(linkSchema),
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
  // Older documents are not rejected: they go through `migrateStory` before
  // reaching this point, so validation always runs on the current shape.
  formatVersion: z.number().int().min(STORY_FORMAT_VERSION).max(STORY_FORMAT_VERSION),
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
  linkId: identifier,
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
