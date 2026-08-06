/**
 * Operations d'edition sur un document d'histoire.
 *
 * Toutes pures et immuables : elles prennent une `Story` et en renvoient une
 * nouvelle. L'app se contente d'enchainer `setStory(op(story, ...))`, ce qui
 * rend l'annulation et la persistance triviales.
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

/** Ajoute un noeud vierge et renvoie le document ainsi que son identifiant. */
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
 * Cree un noeud enfant *et* le lien qui y mene, en une seule operation.
 *
 * C'est le geste courant de l'auteur — « et ensuite ? » —, et le seul moyen
 * d'obtenir un graphe coherent du premier coup : le lien nait avec sa cible,
 * donc jamais pendant.
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
 * Supprime un noeud *et* tous les liens qui y menaient — laisser des cibles
 * pendantes derriere soi transformerait une suppression en erreur de validation.
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

/** Duplique un noeud a cote de l'original, sans reprendre les liens entrants. */
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
 * Change le type d'un noeud.
 *
 * Un noeud qui devient un choix a besoin d'un libelle — sans quoi le bouton
 * serait vide et la validation le refuserait aussitot. On le derive du titre,
 * charge a l'auteur de l'affiner.
 */
export function setKind(story: Story, sceneId: SceneId, kind: SceneKind): Story {
  const scene = story.scenes[sceneId];
  if (!scene || scene.kind === kind) return story;
  const patch: Partial<Scene> = { kind };
  if (kind === 'choice' && !scene.label) patch.label = scene.title || scene.blocks[0]?.text || '';
  return updateScene(story, sceneId, patch);
}

/**
 * Bascule un noeud en fin de recit. Les liens ne sont pas effaces : ils sont
 * simplement ignores par le moteur, et l'auteur les retrouve s'il revient en
 * arriere. Le validateur le signale par un avertissement.
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
// Liens
// ---------------------------------------------------------------------------

export function addLink(story: Story, sceneId: SceneId, to: SceneId): Story {
  const scene = story.scenes[sceneId];
  if (!scene || !story.scenes[to]) return story;
  // Un meme lien deux fois n'ajouterait rien et brouillerait le canvas.
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

/** Retire les champs optionnels vides — le JSON exporte reste lisible. */
function cleanLink(link: Link): Link {
  const next: Link = { ...link };
  if (next.effects && next.effects.length === 0) delete next.effects;
  if (next.condition === undefined) delete next.condition;
  return next;
}

/**
 * Le lien qui mene a ce noeud, s'il est unique.
 *
 * L'inspecteur s'en sert pour montrer condition et effets « sur le bouton »
 * quand on selectionne un noeud de choix, alors qu'ils sont ranges sur l'arete.
 * Ambigu des qu'il y a plusieurs entrees : on ne devine pas laquelle editer.
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

/** Identifiant de noeud libre, derive d'une base lisible. */
export function uniqueSceneId(story: Story, base: string): SceneId {
  const root = slugify(base, 'scene');
  if (!story.scenes[root]) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!story.scenes[candidate]) return candidate;
  }
  return createId(root);
}

/** Renomme un noeud en repointant tous les liens qui le visaient. */
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

/** Compte des fins du recit — repris tel quel par le tableau de bord. */
export function countEndings(story: Story): number {
  return Object.values(story.scenes).filter((scene) => scene.ending).length;
}

export function countScenes(story: Story): number {
  return Object.keys(story.scenes).length;
}
