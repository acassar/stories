/**
 * Migration des documents d'histoire.
 *
 * Un fichier ecrit hier doit s'ouvrir aujourd'hui. Toute porte d'entree d'un
 * JSON exterieur (`parseStory`, la bibliotheque du lecteur, le rangement local
 * du studio) passe par `migrateStory` avant de valider quoi que ce soit.
 *
 * La migration est *totale et silencieuse* : elle ne juge pas la coherence du
 * recit, elle traduit une forme dans une autre. Un document deja a jour la
 * traverse sans etre touche.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Condition, Effect, Scene, SceneId, Story, TextBlock } from './types.js';

/** Forme d'un choix dans le format 1 — la transition y etait un champ de scene. */
interface LegacyChoice {
  id: string;
  label: string;
  target: SceneId;
  condition?: Condition;
  effects?: Effect[];
}

/** Un bloc du format 1 pouvait declarer lui-meme qui le prononcait. */
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
 * Amene un document quelconque a la version courante du format. Ce qui n'est
 * pas reconnu est renvoye tel quel : c'est a la validation de le refuser, pas
 * a la migration de deviner.
 */
export function migrateStory(input: unknown): unknown {
  if (isLegacyStory(input)) return fromV1(input);
  return repairSpeakers(input);
}

/**
 * Repare un document deja en version 2 dont les blocs portent encore un
 * `speaker`.
 *
 * Ce cas ne devrait pas exister — mais une premiere version de la migration
 * recopiait les blocs tels quels, et un document passe par elle a pu etre
 * enregistre en v2 en gardant le champ. Le noeud affichait alors ses messages
 * du cote annonce par le bloc et non par son type, sans que rien dans le studio
 * ne permette de le corriger. La reparation est idempotente et rend le document
 * inchange quand il n'y a rien a faire : elle peut tourner a chaque lecture.
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

    // Ce qui suivait la scene suivra le *dernier* fragment, pas le premier.
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
 * Chaque scene devient un noeud `npc`, et chaque choix qu'elle portait devient
 * un noeud `choice` intercale entre elle et sa cible :
 *
 *     [scene] --choix--> [cible]        (v1)
 *     [npc] --> [choice] --> [cible]    (v2)
 *
 * Le premier lien herite de la condition et des effets du choix : c'est lui
 * qu'on emprunte en appuyant sur le bouton, donc c'est lui qui doit decider si
 * le bouton s'affiche et ce que l'appui declenche. Le second est un simple
 * enchainement.
 */
function fromV1(story: Omit<Story, 'scenes'> & { scenes: Record<SceneId, LegacyScene> }): Story {
  const taken = new Set(Object.keys(story.scenes));
  const scenes: Record<SceneId, Scene> = {};
  /** Dernier noeud de chaque scene eclatee — c'est de lui que partent les choix. */
  const tails = new Map<SceneId, Scene>();

  for (const legacy of Object.values(story.scenes)) {
    const runs = splitBySpeaker(legacy.blocks ?? []);

    // Le premier fragment garde l'identifiant de la scene : tout ce qui la
    // visait continue de la viser.
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

    // Les fragments suivants deviennent des noeuds enchaines : c'est ainsi que
    // le format 2 dit « et maintenant c'est l'autre qui parle ».
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

    // La fin appartient au dernier fragment : c'est lui qui clot le recit.
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
        // Le libelle servait deja de replique du joueur : `sceneMessages` le
        // renverra, inutile de le recopier dans un bloc.
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
 * Decoupe les blocs d'une scene v1 en tranches homogenes de locuteur.
 *
 * Le format 1 laissait une scene alterner entre l'interlocuteur et le joueur,
 * message par message. Le format 2 ne le permet plus — et c'est voulu : le type
 * du noeud est la seule reponse a « qui parle ». La suite se dit donc en
 * plusieurs noeuds, ce que le lecteur enchaine tout seul, sans rien demander au
 * joueur. Le rendu final est identique ; c'est le modele qui devient honnete.
 */
function splitBySpeaker(blocks: LegacyBlock[]): { kind: Scene['kind']; blocks: TextBlock[] }[] {
  const runs: { kind: Scene['kind']; blocks: TextBlock[] }[] = [];

  for (const block of blocks) {
    const kind: Scene['kind'] = block.speaker === 'player' ? 'player' : 'npc';
    const current = runs.at(-1);
    // `speaker` disparait du format : seul le texte suit.
    const kept: TextBlock = { text: block.text };
    if (current && current.kind === kind) current.blocks.push(kept);
    else runs.push({ kind, blocks: [kept] });
  }
  return runs;
}

/** Pose le noeud de choix a mi-chemin, decale pour que la fratrie ne se superpose pas. */
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

/** Identifiant libre derive d'une base — la migration ne doit ecraser personne. */
function freeId(taken: Set<string>, base: string): SceneId {
  const root = base.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'choix';
  if (!taken.has(root)) return root;
  for (let i = 2; ; i += 1) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
