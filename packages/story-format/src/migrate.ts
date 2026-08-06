/**
 * Migration of story documents.
 *
 * A file written against an older format must still open. Every entry point for
 * external JSON (`parseStory`, the reader library, the studio local storage)
 * goes through `migrateStory` before validating anything.
 *
 * Migration is *total and silent*: it does not judge the coherence of the
 * story, it translates one shape into another. An up-to-date document passes
 * through untouched.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Condition, Effect, Scene, SceneId, Story, TextBlock } from './types.js';

/** Shape of a choice in format 1, where the transition was a scene field. */
interface LegacyChoice {
  id: string;
  label: string;
  target: SceneId;
  condition?: Condition;
  effects?: Effect[];
}

/** A format 1 block could declare its own speaker. */
interface LegacyBlock extends TextBlock {
  speaker?: 'narrator' | 'player';
}

interface LegacyScene {
  id: SceneId;
  title: string;
  blocks: LegacyBlock[];
  choices: LegacyChoice[];
  position: { x: number; y: number };
  ending?: Scene['ending'];
  media?: Scene['media'];
  tags?: string[];
}

function isLegacyStory(input: unknown): input is Omit<Story, 'scenes'> & {
  scenes: Record<SceneId, LegacyScene>;
} {
  if (typeof input !== 'object' || input === null) return false;
  const story = input as { formatVersion?: unknown; scenes?: unknown };
  if (story.formatVersion !== 1) return false;
  return typeof story.scenes === 'object' && story.scenes !== null;
}

/**
 * Brings any document up to the current format version. Anything unrecognized
 * is returned as-is: rejecting it is validation's job, not migration's — the
 * migration never guesses.
 */
export function migrateStory(input: unknown): unknown {
  if (isLegacyStory(input)) return fromV1(input);
  return repairSpeakers(input);
}

/**
 * Repairs a version 2 document whose blocks still carry a `speaker` field.
 *
 * Such a block contradicts its node's `kind`, and nothing in the studio lets an
 * author fix it by hand. The repair splits the scene the same way the v1
 * migration does, so the rendering stays identical. It is idempotent and
 * returns the document unchanged when there is nothing to do, so it can run on
 * every read.
 */
function repairSpeakers(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const story = input as Story;
  if (typeof story.scenes !== 'object' || story.scenes === null) return input;

  const affected = Object.values(story.scenes).filter(
    (scene) =>
      scene?.kind !== 'choice' && (scene?.blocks ?? []).some((block) => 'speaker' in block),
  );
  if (affected.length === 0) return input;

  const taken = new Set(Object.keys(story.scenes));
  const scenes: Record<SceneId, Scene> = { ...story.scenes };

  for (const scene of affected) {
    const runs = splitBySpeaker(scene.blocks as LegacyBlock[]);
    const head: Scene = {
      ...scene,
      kind: runs[0]?.kind ?? scene.kind,
      blocks: runs[0]?.blocks ?? [],
    };
    scenes[scene.id] = head;

    // What follows the scene follows the *last* fragment, not the first.
    const outgoing = head.next;
    const ending = head.ending;

    let tail = head;
    runs.slice(1).forEach((run, index) => {
      const id = freeId(taken, `${scene.id}-suite-${index + 1}`);
      taken.add(id);
      const node: Scene = {
        id,
        kind: run.kind,
        title: `${scene.title} (suite)`,
        blocks: run.blocks,
        next: [],
        position: { x: scene.position.x, y: scene.position.y + (index + 1) * 130 },
      };
      scenes[id] = node;
      tail.next = [{ id: 'suite', to: id }];
      tail = node;
    });

    if (tail !== head) {
      tail.next = outgoing;
      if (ending) {
        tail.ending = ending;
        delete head.ending;
      }
    }
  }

  return { ...story, scenes };
}

/**
 * Format 1 → 2.
 *
 * Each scene becomes an `npc` node, and each choice it carried becomes a
 * `choice` node inserted between it and its target:
 *
 *     [scene] --choice--> [target]      (v1)
 *     [npc] --> [choice] --> [target]   (v2)
 *
 * The first link inherits the condition and the effects of the choice: it is
 * the one taken when the button is pressed, so it is the one that decides
 * whether the button shows and what pressing it triggers. The second link is
 * plain chaining.
 */
function fromV1(story: Omit<Story, 'scenes'> & { scenes: Record<SceneId, LegacyScene> }): Story {
  const taken = new Set(Object.keys(story.scenes));
  const scenes: Record<SceneId, Scene> = {};
  /** Last node of each split scene — the choices leave from it. */
  const tails = new Map<SceneId, Scene>();

  for (const legacy of Object.values(story.scenes)) {
    const runs = splitBySpeaker(legacy.blocks ?? []);

    // The first fragment keeps the scene id, so everything that pointed at the
    // scene keeps pointing at it.
    const head: Scene = {
      id: legacy.id,
      kind: runs[0]?.kind ?? 'npc',
      title: legacy.title,
      blocks: runs[0]?.blocks ?? [],
      next: [],
      position: legacy.position,
    };
    if (legacy.media) head.media = legacy.media;
    if (legacy.tags) head.tags = legacy.tags;
    scenes[legacy.id] = head;

    // The following fragments become chained nodes: that is how format 2 says
    // "and now the other one speaks".
    let tail = head;
    runs.slice(1).forEach((run, index) => {
      const id = freeId(taken, `${legacy.id}-suite-${index + 1}`);
      taken.add(id);
      const node: Scene = {
        id,
        kind: run.kind,
        title: `${legacy.title} (suite)`,
        blocks: run.blocks,
        next: [],
        position: { x: legacy.position.x, y: legacy.position.y + (index + 1) * 130 },
      };
      scenes[id] = node;
      tail.next = [{ id: 'suite', to: id }];
      tail = node;
    });

    // The ending belongs to the last fragment: it is the one that closes the story.
    if (legacy.ending) tail.ending = legacy.ending;
    tails.set(legacy.id, tail);
  }

  for (const legacy of Object.values(story.scenes)) {
    const source = tails.get(legacy.id);
    if (!source) continue;

    (legacy.choices ?? []).forEach((choice, index) => {
      const choiceId = freeId(taken, `${legacy.id}-${choice.id}`);
      taken.add(choiceId);

      scenes[choiceId] = {
        id: choiceId,
        kind: 'choice',
        title: choice.label,
        label: choice.label,
        // The label already doubles as the player's line: `sceneMessages`
        // returns it, so there is no need to copy it into a block.
        blocks: [],
        next: [{ id: 'suite', to: choice.target }],
        position: between(source.position, story.scenes[choice.target]?.position, index),
      };

      const link: Scene['next'][number] = { id: choice.id, to: choiceId };
      if (choice.condition) link.condition = choice.condition;
      if (choice.effects?.length) link.effects = choice.effects;
      source.next.push(link);
    });
  }

  return { ...story, formatVersion: STORY_FORMAT_VERSION, scenes };
}

/**
 * Splits the blocks of a v1 scene into runs with a single speaker.
 *
 * Format 1 let a scene alternate between the correspondent and the player,
 * message by message. Format 2 does not, by design: the node kind is the only
 * answer to "who is speaking". An alternation is therefore expressed as several
 * chained nodes, which the reader walks through on its own without asking the
 * player for anything. The rendering is identical.
 */
function splitBySpeaker(blocks: LegacyBlock[]): { kind: Scene['kind']; blocks: TextBlock[] }[] {
  const runs: { kind: Scene['kind']; blocks: TextBlock[] }[] = [];

  for (const block of blocks) {
    const kind: Scene['kind'] = block.speaker === 'player' ? 'player' : 'npc';
    const current = runs.at(-1);
    // `speaker` is not part of the format: only the text carries over.
    const kept: TextBlock = { text: block.text };
    if (current && current.kind === kind) current.blocks.push(kept);
    else runs.push({ kind, blocks: [kept] });
  }
  return runs;
}

/** Places the choice node halfway, offset so siblings do not overlap. */
function between(
  from: { x: number; y: number },
  to: { x: number; y: number } | undefined,
  index: number,
): { x: number; y: number } {
  if (!to) return { x: from.x + 240, y: from.y + 120 + index * 90 };
  return {
    x: Math.round((from.x + to.x) / 2) + index * 30,
    y: Math.round((from.y + to.y) / 2) + index * 24,
  };
}

/** A free id derived from a base — the migration must never overwrite a node. */
function freeId(taken: Set<string>, base: string): SceneId {
  const root = base.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'choix';
  if (!taken.has(root)) return root;
  for (let i = 2; ; i += 1) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
