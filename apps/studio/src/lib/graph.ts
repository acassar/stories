/**
 * Traduction entre le format d'histoire et le graphe React Flow.
 *
 * Le format reste la source de verite : React Flow n'est qu'une projection.
 * Un seul endroit connait les deux vocabulaires — celui-ci.
 */

import type { Edge, Node } from '@xyflow/react';
import type { Scene, SceneId, Story, ValidationIssue } from '@embranche/story-format';

import { studio } from '@embranche/design-tokens';

/** Donnees portees par un noeud de scene. */
export interface SceneNodeData extends Record<string, unknown> {
  scene: Scene;
  isStart: boolean;
  /** Anomalies rattachees a cette scene, pour l'anneau d'alerte. */
  issues: ValidationIssue[];
}

export type SceneFlowNode = Node<SceneNodeData, 'scene'>;

/** Identifiant d'arete : `scene:choix`, stable et directement decodable. */
export function edgeId(sceneId: SceneId, choiceId: string): string {
  return `${sceneId}:${choiceId}`;
}

export function parseEdgeId(id: string): { sceneId: SceneId; choiceId: string } | null {
  const separator = id.indexOf(':');
  if (separator < 0) return null;
  return { sceneId: id.slice(0, separator), choiceId: id.slice(separator + 1) };
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
    },
  }));
}

/**
 * Une arete par choix. Le `sourceHandle` porte l'identifiant du choix : c'est
 * ce qui permet de rebrancher un choix precis en tirant sa poignee.
 */
export function toEdges(story: Story, issues: ValidationIssue[]): Edge[] {
  const edges: Edge[] = [];
  for (const scene of Object.values(story.scenes)) {
    for (const choice of scene.choices) {
      if (!story.scenes[choice.target]) continue; // cible pendante : signalee sur le noeud
      const broken = issues.some(
        (issue) => issue.choiceId === choice.id && issue.severity === 'error',
      );
      const conditional = Boolean(choice.condition);
      edges.push({
        id: edgeId(scene.id, choice.id),
        source: scene.id,
        sourceHandle: choice.id,
        target: choice.target,
        label: choice.label,
        type: 'smoothstep',
        animated: conditional,
        style: {
          stroke: broken ? studio.danger : conditional ? studio.edgeBack : studio.edge,
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

/**
 * Place une nouvelle scene sous la derniere, plutot qu'a l'origine ou elle
 * risquerait de se superposer a une existante.
 */
export function nextScenePosition(story: Story): { x: number; y: number } {
  const positions = Object.values(story.scenes).map((scene) => scene.position);
  if (positions.length === 0) return { x: 320, y: 40 };
  const lowest = positions.reduce((a, b) => (b.y > a.y ? b : a));
  return { x: lowest.x, y: lowest.y + 180 };
}
