/**
 * Editing operations on a story document.
 *
 * All pure and immutable: they take a `Story` and return a new one. The app
 * only ever chains `setStory(op(story, ...))`, which makes undo and persistence
 * trivial.
 */

import { createId, createLink, createScene, slugify } from '@embranche/story-format';
import type { Link, Scene, SceneId, SceneKind, Story, TextBlock } from '@embranche/story-format';

export function updateStory(story: Story, patch: Partial<Story>): Story {
  return { ...story, ...patch };
}

export function updateScene(story: Story, sceneId: SceneId, patch: Partial<Scene>): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, ...patch } } };
}

export function moveScene(
  story: Story,
  sceneId: SceneId,
  position: { x: number; y: number },
): Story {
  return updateScene(story, sceneId, { position });
}

/** Adds a blank node and returns the document along with its id. */
export function addScene(
  story: Story,
  kind: SceneKind,
  position: { x: number; y: number },
): { story: Story; sceneId: SceneId } {
  const sceneId = uniqueSceneId(story, kind === 'choice' ? 'choix' : kind);
  const scene = createScene({ id: sceneId, kind, position });
  return { story: { ...story, scenes: { ...story.scenes, [sceneId]: scene } }, sceneId };
}

/**
 * Creates a child node *and* the link that leads to it, in one operation.
 *
 * This is the author's common gesture — "and then?" — and the only way to get a
 * coherent graph on the first try: the link is born with its target, so it is
 * never dangling.
 */
export function addChild(
  story: Story,
  parentId: SceneId,
  kind: SceneKind,
  position: { x: number; y: number },
): { story: Story; sceneId: SceneId } {
  const parent = story.scenes[parentId];
  if (!parent) return { story, sceneId: parentId };

  const created = addScene(story, kind, position);
  const link = createLink({ to: created.sceneId });
  return {
    story: updateScene(created.story, parentId, { next: [...parent.next, link] }),
    sceneId: created.sceneId,
  };
}

/**
 * Deletes a node *and* every link that led to it — leaving dangling targets
 * behind would turn a deletion into a validation error.
 */
export function removeScene(story: Story, sceneId: SceneId): Story {
  const scenes: Record<SceneId, Scene> = {};
  for (const [id, scene] of Object.entries(story.scenes)) {
    if (id === sceneId) continue;
    scenes[id] = { ...scene, next: scene.next.filter((link) => link.to !== sceneId) };
  }
  const remaining = Object.keys(scenes);
  const startSceneId =
    story.startSceneId === sceneId ? (remaining[0] ?? story.startSceneId) : story.startSceneId;
  return { ...story, scenes, startSceneId };
}

/** Duplicates a node next to the original, without carrying incoming links. */
export function duplicateScene(story: Story, sceneId: SceneId): { story: Story; sceneId: SceneId } {
  const source = story.scenes[sceneId];
  if (!source) return { story, sceneId };
  const newId = uniqueSceneId(story, slugify(source.title, 'scene'));
  const copy: Scene = {
    ...structuredClone(source),
    id: newId,
    title: `${source.title} (copie)`,
    position: { x: source.position.x + 40, y: source.position.y + 60 },
    next: source.next.map((link) => ({ ...link, id: createId('lien') })),
  };
  return { story: { ...story, scenes: { ...story.scenes, [newId]: copy } }, sceneId: newId };
}

export function setStartScene(story: Story, sceneId: SceneId): Story {
  return story.scenes[sceneId] ? { ...story, startSceneId: sceneId } : story;
}

export function setBlocks(story: Story, sceneId: SceneId, blocks: TextBlock[]): Story {
  return updateScene(story, sceneId, { blocks });
}

/**
 * Changes the kind of a node.
 *
 * A node becoming a choice needs a label — without one the button would be
 * empty and validation would refuse it immediately. It is derived from the
 * title, and the author refines it.
 */
export function setKind(story: Story, sceneId: SceneId, kind: SceneKind): Story {
  const scene = story.scenes[sceneId];
  if (!scene || scene.kind === kind) return story;
  const patch: Partial<Scene> = { kind };
  if (kind === 'choice' && !scene.label) patch.label = scene.title || scene.blocks[0]?.text || '';
  return updateScene(story, sceneId, patch);
}

/**
 * Toggles a node as an ending. Links are not erased: the engine simply ignores
 * them, and the author finds them again when toggling back. The validator
 * reports it with a warning.
 */
export function toggleEnding(story: Story, sceneId: SceneId): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  if (scene.ending) {
    const { ending: _removed, ...rest } = scene;
    return { ...story, scenes: { ...story.scenes, [sceneId]: rest } };
  }
  return updateScene(story, sceneId, {
    ending: { type: 'Fin', name: scene.title, blurb: '' },
  });
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export function addLink(story: Story, sceneId: SceneId, to: SceneId): Story {
  const scene = story.scenes[sceneId];
  if (!scene || !story.scenes[to]) return story;
  // The same link twice would add nothing and clutter the canvas.
  if (scene.next.some((link) => link.to === to)) return story;
  return updateScene(story, sceneId, { next: [...scene.next, createLink({ to })] });
}

export function updateLink(
  story: Story,
  sceneId: SceneId,
  linkId: string,
  patch: Partial<Link>,
): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  return updateScene(story, sceneId, {
    next: scene.next.map((link) => (link.id === linkId ? cleanLink({ ...link, ...patch }) : link)),
  });
}

export function removeLink(story: Story, sceneId: SceneId, linkId: string): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  return updateScene(story, sceneId, {
    next: scene.next.filter((link) => link.id !== linkId),
  });
}

/** Drops empty optional fields — the exported JSON stays readable. */
function cleanLink(link: Link): Link {
  const next: Link = { ...link };
  if (next.effects && next.effects.length === 0) delete next.effects;
  if (next.condition === undefined) delete next.condition;
  return next;
}

/**
 * The link leading to this node, when there is exactly one.
 *
 * The inspector uses it to show condition and effects "on the button" when a
 * choice node is selected, even though they live on the edge. It is ambiguous
 * as soon as there are several incoming links: which one to edit is not a guess
 * worth making.
 */
export function soleIncomingLink(
  story: Story,
  sceneId: SceneId,
): { sceneId: SceneId; link: Link } | null {
  const found: { sceneId: SceneId; link: Link }[] = [];
  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      if (link.to === sceneId) found.push({ sceneId: scene.id, link });
    }
  }
  return found.length === 1 ? (found[0] ?? null) : null;
}

// ---------------------------------------------------------------------------

/** A free node id, derived from a readable base. */
export function uniqueSceneId(story: Story, base: string): SceneId {
  const root = slugify(base, 'scene');
  if (!story.scenes[root]) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!story.scenes[candidate]) return candidate;
  }
  return createId(root);
}

/** Renames a node, repointing every link that targeted it. */
export function renameSceneId(story: Story, from: SceneId, rawTo: string): Story {
  const scene = story.scenes[from];
  const to = slugify(rawTo, from);
  if (!scene || to === from || story.scenes[to]) return story;

  const scenes: Record<SceneId, Scene> = {};
  for (const [id, current] of Object.entries(story.scenes)) {
    const retargeted: Scene = {
      ...current,
      next: current.next.map((link) => (link.to === from ? { ...link, to } : link)),
    };
    if (id === from) scenes[to] = { ...retargeted, id: to };
    else scenes[id] = retargeted;
  }
  return {
    ...story,
    scenes,
    startSceneId: story.startSceneId === from ? to : story.startSceneId,
  };
}

/** Number of endings in the story — used as-is by the dashboard. */
export function countEndings(story: Story): number {
  return Object.values(story.scenes).filter((scene) => scene.ending).length;
}

export function countScenes(story: Story): number {
  return Object.keys(story.scenes).length;
}
