/**
 * Traduction entre le format d'histoire et le graphe React Flow.
 *
 * Le format reste la source de verite : React Flow n'est qu'une projection.
 * Un seul endroit connait les deux vocabulaires — celui-ci.
 *
 * Depuis le format 2, une arete du canvas est exactement un `Link` du recit :
 * plus rien n'est cache dans le noeud source. Ce qui se dessine est ce qui est
 * ecrit.
 */

import type { Edge, Node } from '@xyflow/react';
import type { Link, Scene, SceneId, Story, ValidationIssue } from '@embranche/story-format';

import { kinds, studio } from '@embranche/design-tokens';

/** Donnees portees par un noeud de scene. */
export interface SceneNodeData extends Record<string, unknown> {
  scene: Scene;
  isStart: boolean;
  /** Anomalies rattachees a cette scene, pour l'anneau d'alerte. */
  issues: ValidationIssue[];
  /** Vrai si ce noeud arrete la lecture en attendant une decision du joueur. */
  awaitsChoice: boolean;
}

export type SceneFlowNode = Node<SceneNodeData, 'scene'>;

/** Identifiant d'arete : `scene:lien`, stable et directement decodable. */
export function edgeId(sceneId: SceneId, linkId: string): string {
  return `${sceneId}:${linkId}`;
}

export function parseEdgeId(id: string): { sceneId: SceneId; linkId: string } | null {
  const separator = id.indexOf(':');
  if (separator < 0) return null;
  return { sceneId: id.slice(0, separator), linkId: id.slice(separator + 1) };
}

export function toNodes(
  story: Story,
  issues: ValidationIssue[],
  selectedId: SceneId | null,
): SceneFlowNode[] {
  return Object.values(story.scenes).map((scene) => ({
    id: scene.id,
    type: 'scene',
    position: scene.position,
    selected: scene.id === selectedId,
    data: {
      scene,
      isStart: scene.id === story.startSceneId,
      issues: issues.filter((issue) => issue.sceneId === scene.id),
      awaitsChoice: scene.next.some((link) => story.scenes[link.to]?.kind === 'choice'),
    },
  }));
}

/**
 * Une arete par lien.
 *
 * L'arete ne porte plus le texte du choix — celui-ci est desormais un noeud a
 * part entiere, qui l'affiche lui-meme. L'arete ne dit donc que ce que le
 * noeud ne peut pas dire : qu'elle est conditionnelle, et ce qu'elle modifie.
 * Sa couleur est celle du type qu'elle vise, pour qu'on lise la nature d'un
 * enchainement avant meme d'en atteindre le bout.
 */
export function toEdges(story: Story, issues: ValidationIssue[]): Edge[] {
  const edges: Edge[] = [];
  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const target = story.scenes[link.to];
      if (!target) continue; // cible pendante : signalee sur le noeud
      const broken = issues.some(
        (issue) =>
          issue.linkId === link.id && issue.sceneId === scene.id && issue.severity === 'error',
      );
      const conditional = Boolean(link.condition);
      edges.push({
        id: edgeId(scene.id, link.id),
        source: scene.id,
        target: link.to,
        label: edgeLabel(link),
        type: 'smoothstep',
        animated: conditional,
        style: {
          stroke: broken ? studio.danger : kinds[target.kind].border,
          strokeWidth: 2,
          strokeDasharray: conditional ? '5 6' : undefined,
        },
        labelStyle: { fontFamily: 'var(--emb-font-ui)', fontSize: 11, fill: studio.sub },
        labelBgStyle: { fill: studio.surface, fillOpacity: 0.92 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
      });
    }
  }
  return edges;
}

/** Ce qu'une arete a d'interessant a dire — rien, la plupart du temps. */
function edgeLabel(link: Link): string | undefined {
  const marks: string[] = [];
  if (link.condition) marks.push('◇ si…');
  if (link.effects?.length) marks.push(`⚙ ${link.effects.length}`);
  return marks.length > 0 ? marks.join(' ') : undefined;
}

/**
 * Place un nouveau noeud sous le dernier, plutot qu'a l'origine ou il
 * risquerait de se superposer a un existant.
 */
export function nextScenePosition(story: Story): { x: number; y: number } {
  const positions = Object.values(story.scenes).map((scene) => scene.position);
  if (positions.length === 0) return { x: 320, y: 40 };
  const lowest = positions.reduce((a, b) => (b.y > a.y ? b : a));
  return { x: lowest.x, y: lowest.y + 180 };
}

/**
 * Place un noeud enfant sous son parent, decale a droite selon le nombre de
 * freres — creer trois choix d'affilee ne doit pas les empiler.
 */
export function childPosition(parent: Scene, siblings: number): { x: number; y: number } {
  return { x: parent.position.x + (siblings - 1) * 130, y: parent.position.y + 170 };
}
