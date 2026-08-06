/**
 * Lecture d'un noeud : qui parle, ce qu'il envoie, et ce qui se passe apres.
 *
 * Tout ce qui interprete `kind` et `next` passe par ici — moteur comme studio.
 * C'est le seul endroit qui connait la regle d'enchainement, pour qu'elle ne
 * puisse pas diverger entre le lecteur et l'apercu du createur.
 */

import type { Link, Scene, SceneId, Story, TextBlock } from './types.js';

/**
 * Qui parle dans ce noeud. Le type le decide, seul et sans exception : c'est
 * ce qui garantit qu'un noeud ne peut pas afficher ses messages du cote de
 * quelqu'un d'autre que ce que sa couleur annonce dans le studio.
 */
export function speakerOf(scene: Pick<Scene, 'kind'>): 'narrator' | 'player' {
  return scene.kind === 'npc' ? 'narrator' : 'player';
}

/**
 * Les messages effectivement envoyes par une scene. Un noeud `choice` sans
 * corps envoie son libelle : l'auteur qui n'ecrit qu'un bouton obtient quand
 * meme une replique, comme dans l'ancien format.
 */
export function sceneMessages(scene: Scene): readonly TextBlock[] {
  if (scene.blocks.length > 0) return scene.blocks;
  if (scene.kind === 'choice' && scene.label) return [{ text: scene.label }];
  return [];
}

/** Le texte du bouton d'un noeud `choice`. */
export function choiceLabel(scene: Scene): string {
  return scene.label || scene.blocks[0]?.text || scene.title || scene.id;
}

/**
 * **La regle.** Un noeud attend une decision si ses liens visent des noeuds
 * `choice` ; sinon le recit enchaine tout seul. Rien d'autre ne distingue un
 * embranchement d'une suite de repliques.
 *
 * Les liens pendants sont ignores : un document en cours d'ecriture ne doit pas
 * changer de comportement a cause d'une cible pas encore creee.
 */
export function awaitsChoice(story: Story, scene: Scene): boolean {
  return scene.next.some((link) => story.scenes[link.to]?.kind === 'choice');
}

/** Les liens du noeud, resolus vers leur scene cible quand elle existe. */
export function outgoing(story: Story, scene: Scene): { link: Link; target: Scene | undefined }[] {
  return scene.next.map((link) => ({ link, target: story.scenes[link.to] }));
}

/** Vrai si la scene termine le recit — aucun lien n'en sort, quoi qu'il arrive. */
export function isTerminal(scene: Scene): boolean {
  return Boolean(scene.ending);
}

/**
 * Scenes prises dans une boucle d'enchainements automatiques.
 *
 * Une boucle passant par un noeud `choice` est parfaitement legitime — le
 * joueur peut tourner en rond s'il le veut. Une boucle qui n'en contient aucun
 * ne rend jamais la main : le lecteur enchainerait a l'infini. On ne cherche
 * donc les cycles que dans le sous-graphe des liens automatiques.
 *
 * Les conditions ne sont pas evaluees : une boucle qu'une condition briserait
 * *peut-etre* reste une boucle qu'il faut signaler a l'auteur.
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
