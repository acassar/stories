/**
 * Reading a node: who speaks, what it sends, and what happens next.
 *
 * Everything that interprets `kind` and `next` goes through here — engine and
 * studio alike. This is the only place that knows the chaining rule, so it
 * cannot drift between the reader and the studio preview.
 */

import type { Link, Scene, SceneId, Story, TextBlock } from './types.js';

/**
 * Who speaks in this node. The kind decides, alone and without exception —
 * which is what guarantees a node cannot show its messages on a different side
 * than the one its color announces in the studio.
 */
export function speakerOf(scene: Pick<Scene, 'kind'>): 'narrator' | 'player' {
  return scene.kind === 'npc' ? 'narrator' : 'player';
}

/**
 * The messages a scene actually sends. A `choice` node without a body sends its
 * label, so an author who writes nothing but a button still gets a line.
 */
export function sceneMessages(scene: Scene): readonly TextBlock[] {
  if (scene.blocks.length > 0) return scene.blocks;
  if (scene.kind === 'choice' && scene.label) return [{ text: scene.label }];
  return [];
}

/** The button text of a `choice` node. */
export function choiceLabel(scene: Scene): string {
  return scene.label || scene.blocks[0]?.text || scene.title || scene.id;
}

/**
 * **The rule.** A node waits for a decision when its links point at `choice`
 * nodes; otherwise the story chains on by itself. Nothing else distinguishes a
 * branch from a run of lines.
 *
 * Dangling links are ignored: a document being written must not change behavior
 * because a target has not been created yet.
 */
export function awaitsChoice(story: Story, scene: Scene): boolean {
  return scene.next.some((link) => story.scenes[link.to]?.kind === 'choice');
}

/** The links of a node, resolved to their target scene when it exists. */
export function outgoing(story: Story, scene: Scene): { link: Link; target: Scene | undefined }[] {
  return scene.next.map((link) => ({ link, target: story.scenes[link.to] }));
}

/** True when the scene ends the story — no link is ever followed out of it. */
export function isTerminal(scene: Scene): boolean {
  return Boolean(scene.ending);
}

/**
 * Scenes caught in an automatic chaining loop.
 *
 * A loop going through a `choice` node is perfectly legitimate — the player may
 * go around in circles on purpose. A loop containing none never gives control
 * back: the reader would chain forever. Cycles are therefore searched for only
 * in the subgraph of automatic links.
 *
 * Conditions are not evaluated: a loop that a condition *might* break is still
 * a loop worth reporting to the author.
 */
export function findAutoLoops(story: Story): SceneId[] {
  const inProgress = new Set<SceneId>();
  const done = new Set<SceneId>();
  const looping = new Set<SceneId>();

  const walk = (id: SceneId): void => {
    if (done.has(id)) return;
    if (inProgress.has(id)) {
      looping.add(id);
      return;
    }
    const scene = story.scenes[id];
    if (!scene) return;

    if (!isTerminal(scene) && !awaitsChoice(story, scene)) {
      inProgress.add(id);
      for (const link of scene.next) {
        if (story.scenes[link.to]) walk(link.to);
      }
      inProgress.delete(id);
    }
    done.add(id);
  };

  for (const id of Object.keys(story.scenes)) walk(id);
  return [...looping];
}
