/**
 * Inventory of what a story writes and reads.
 *
 * Conditions and effects are data, so the whole picture can be built by walking
 * the document — no execution needed. The studio turns it into a table; the
 * validator already uses a narrower version of it to flag a variable read but
 * never written.
 *
 * Variables and items are analysed side by side because they answer the same
 * authoring question, and because a story rarely uses one without the other.
 */

import type {
  Condition,
  Effect,
  ItemId,
  SceneId,
  Story,
  VariableName,
  VariableValue,
} from './types.js';

/** Where a read or a write happens: always on a link, never on a scene. */
export interface UsageSite {
  sceneId: SceneId;
  /** Title of the source scene, so the table reads without a second lookup. */
  sceneTitle: string;
  linkId: string;
  /** Scene the link leads to. */
  targetId: SceneId;
}

export interface WriteSite extends UsageSite {
  op: Effect['op'];
}

export interface VariableUsage {
  name: VariableName;
  /** Declared in `story.variables` — and therefore holding a starting value. */
  declared: boolean;
  initial?: VariableValue;
  reads: UsageSite[];
  writes: WriteSite[];
}

export interface ItemUsage {
  name: ItemId;
  declared: boolean;
  initial?: number;
  reads: UsageSite[];
  writes: WriteSite[];
}

export interface StoryUsage {
  variables: VariableUsage[];
  items: ItemUsage[];
}

/**
 * A variable nobody reads changes nothing in the reading; a variable nobody
 * writes is stuck on its starting value. Neither is an error — a draft is
 * allowed to be halfway — but both are worth showing.
 */
export function isDeadWeight(usage: VariableUsage | ItemUsage): boolean {
  return usage.reads.length === 0;
}

export function isNeverWritten(usage: VariableUsage | ItemUsage): boolean {
  return usage.writes.length === 0 && !usage.declared;
}

/** Full inventory, sorted by name so the table never jumps around. */
export function analyzeStory(story: Story): StoryUsage {
  const variables = new Map<VariableName, VariableUsage>();
  const items = new Map<ItemId, ItemUsage>();

  const variableEntry = (name: VariableName): VariableUsage => {
    let entry = variables.get(name);
    if (!entry) {
      entry = { name, declared: false, reads: [], writes: [] };
      variables.set(name, entry);
    }
    return entry;
  };

  const itemEntry = (name: ItemId): ItemUsage => {
    let entry = items.get(name);
    if (!entry) {
      entry = { name, declared: false, reads: [], writes: [] };
      items.set(name, entry);
    }
    return entry;
  };

  for (const [name, value] of Object.entries(story.variables ?? {})) {
    const entry = variableEntry(name);
    entry.declared = true;
    entry.initial = value;
  }
  for (const [name, quantity] of Object.entries(story.inventory ?? {})) {
    const entry = itemEntry(name);
    entry.declared = true;
    entry.initial = quantity;
  }

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const site: UsageSite = {
        sceneId: scene.id,
        sceneTitle: scene.title || scene.id,
        linkId: link.id,
        targetId: link.to,
      };

      if (link.condition) {
        const read = readsOf(link.condition);
        for (const name of read.variables) variableEntry(name).reads.push(site);
        for (const name of read.items) itemEntry(name).reads.push(site);
      }

      for (const effect of link.effects ?? []) {
        const write: WriteSite = { ...site, op: effect.op };
        if ('variable' in effect) variableEntry(effect.variable).writes.push(write);
        else itemEntry(effect.item).writes.push(write);
      }
    }
  }

  return {
    variables: [...variables.values()].sort(byName),
    items: [...items.values()].sort(byName),
  };
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'fr');
}

/** Variables and items a condition tests, descending through composites. */
function readsOf(condition: Condition): { variables: Set<VariableName>; items: Set<ItemId> } {
  const variables = new Set<VariableName>();
  const items = new Set<ItemId>();

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
      case 'visited':
      case 'notVisited':
        return;
      case 'hasItem':
      case 'lacksItem':
        items.add(node.item);
        return;
      default:
        variables.add(node.variable);
    }
  };

  walk(condition);
  return { variables, items };
}

/** Scenes a story tests with `visited` / `notVisited` — the studio dims none. */
export function scenesTestedByConditions(story: Story): Set<SceneId> {
  const tested = new Set<SceneId>();

  const walk = (node: Condition): void => {
    switch (node.op) {
      case 'and':
      case 'or':
        node.conditions.forEach(walk);
        return;
      case 'not':
        walk(node.condition);
        return;
      case 'visited':
      case 'notVisited':
        tested.add(node.scene);
        return;
      default:
    }
  };

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      if (link.condition) walk(link.condition);
    }
  }
  return tested;
}
