/**
 * Operations d'edition sur un document d'histoire.
 *
 * Toutes pures et immuables : elles prennent une `Story` et en renvoient une
 * nouvelle. L'app se contente d'enchainer `setStory(op(story, ...))`, ce qui
 * rend l'annulation et la persistance triviales.
 */

import { createChoice, createId, createScene, slugify } from '@embranche/story-format';
import type { Choice, Scene, SceneId, Story, TextBlock } from '@embranche/story-format';

export function updateStory(story: Story, patch: Partial<Story>): Story {
  return { ...story, ...patch };
}

export function updateScene(story: Story, sceneId: SceneId, patch: Partial<Scene>): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, ...patch } } };
}

export function moveScene(story: Story, sceneId: SceneId, position: { x: number; y: number }): Story {
  return updateScene(story, sceneId, { position });
}

/** Ajoute une scene vierge et renvoie le document ainsi que son identifiant. */
export function addScene(
  story: Story,
  position: { x: number; y: number },
): { story: Story; sceneId: SceneId } {
  const sceneId = uniqueSceneId(story, 'scene');
  const scene = createScene({
    id: sceneId,
    title: 'Nouvelle scène',
    blocks: [{ text: '' }],
    position,
  });
  return { story: { ...story, scenes: { ...story.scenes, [sceneId]: scene } }, sceneId };
}

/**
 * Supprime une scene *et* tous les choix qui y menaient — laisser des cibles
 * pendantes derriere soi transformerait une suppression en erreur de validation.
 */
export function removeScene(story: Story, sceneId: SceneId): Story {
  const scenes: Record<SceneId, Scene> = {};
  for (const [id, scene] of Object.entries(story.scenes)) {
    if (id === sceneId) continue;
    scenes[id] = { ...scene, choices: scene.choices.filter((c) => c.target !== sceneId) };
  }
  const remaining = Object.keys(scenes);
  const startSceneId =
    story.startSceneId === sceneId ? (remaining[0] ?? story.startSceneId) : story.startSceneId;
  return { ...story, scenes, startSceneId };
}

/** Duplique une scene a cote de l'originale, sans reprendre ses choix entrants. */
export function duplicateScene(story: Story, sceneId: SceneId): { story: Story; sceneId: SceneId } {
  const source = story.scenes[sceneId];
  if (!source) return { story, sceneId };
  const newId = uniqueSceneId(story, slugify(source.title, 'scene'));
  const copy: Scene = {
    ...structuredClone(source),
    id: newId,
    title: `${source.title} (copie)`,
    position: { x: source.position.x + 40, y: source.position.y + 60 },
    choices: source.choices.map((choice) => ({ ...choice, id: createId('choice') })),
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
 * Bascule une scene en fin de recit. Les choix ne sont pas effaces : ils sont
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

export function addChoice(story: Story, sceneId: SceneId): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  // Par defaut, on vise une autre scene : un choix qui boucle sur lui-meme
  // n'est presque jamais ce que l'auteur veut.
  const other = Object.keys(story.scenes).find((id) => id !== sceneId);
  const choice = createChoice({ target: other ?? sceneId });
  return updateScene(story, sceneId, { choices: [...scene.choices, choice] });
}

export function updateChoice(
  story: Story,
  sceneId: SceneId,
  choiceId: string,
  patch: Partial<Choice>,
): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  return updateScene(story, sceneId, {
    choices: scene.choices.map((choice) =>
      choice.id === choiceId ? cleanChoice({ ...choice, ...patch }) : choice,
    ),
  });
}

export function removeChoice(story: Story, sceneId: SceneId, choiceId: string): Story {
  const scene = story.scenes[sceneId];
  if (!scene) return story;
  return updateScene(story, sceneId, {
    choices: scene.choices.filter((choice) => choice.id !== choiceId),
  });
}

/** Retire les champs optionnels vides — le JSON exporte reste lisible. */
function cleanChoice(choice: Choice): Choice {
  const next: Choice = { ...choice };
  if (next.effects && next.effects.length === 0) delete next.effects;
  if (next.condition === undefined) delete next.condition;
  return next;
}

/** Identifiant de scene libre, derive d'une base lisible. */
export function uniqueSceneId(story: Story, base: string): SceneId {
  const root = slugify(base, 'scene');
  if (!story.scenes[root]) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!story.scenes[candidate]) return candidate;
  }
  return createId(root);
}

/** Renomme une scene en repointant tous les choix qui la visaient. */
export function renameSceneId(story: Story, from: SceneId, rawTo: string): Story {
  const scene = story.scenes[from];
  const to = slugify(rawTo, from);
  if (!scene || to === from || story.scenes[to]) return story;

  const scenes: Record<SceneId, Scene> = {};
  for (const [id, current] of Object.entries(story.scenes)) {
    const retargeted: Scene = {
      ...current,
      choices: current.choices.map((choice) =>
        choice.target === from ? { ...choice, target: to } : choice,
      ),
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
