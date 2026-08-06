/**
 * Translation between the story format and the React Flow graph.
 *
 * The format stays the source of truth: React Flow is only a projection. A
 * single place knows both vocabularies — this one.
 *
 * An edge on the canvas is exactly a `Link` of the story: nothing is hidden in
 * the source node. What is drawn is what is written.
 */

import type { Edge, Node } from '@xyflow/react';
import type { Link, Scene, SceneId, Story, ValidationIssue } from '@embranche/story-format';

import { kinds, studio } from '@embranche/design-tokens';

/** Data carried by a scene node. */
export interface SceneNodeData extends Record<string, unknown> {
  scene: Scene;
  isStart: boolean;
  /** Issues attached to this scene, for the alert ring. */
  issues: ValidationIssue[];
  /** True when this node stops the reading to wait for a player decision. */
  awaitsChoice: boolean;
}

export type SceneFlowNode = Node<SceneNodeData, 'scene'>;

/** Edge id: `scene:link`, stable and directly decodable. */
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
 * One edge per link.
 *
 * The edge does not carry the choice text — a choice is a node of its own and
 * displays it itself. The edge only says what the node cannot: that it is
 * conditional, and what it changes. Its color is that of the kind it targets,
 * so the nature of a transition reads before reaching its end.
 */
export function toEdges(story: Story, issues: ValidationIssue[]): Edge[] {
  const edges: Edge[] = [];
  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const target = story.scenes[link.to];
      if (!target) continue; // dangling target: reported on the node
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

/** What an edge has worth saying — nothing, most of the time. */
function edgeLabel(link: Link): string | undefined {
  const marks: string[] = [];
  if (link.condition) marks.push('◇ si…');
  if (link.effects?.length) marks.push(`⚙ ${link.effects.length}`);
  return marks.length > 0 ? marks.join(' ') : undefined;
}

/**
 * Places a new node below the lowest one, rather than at the origin where it
 * would risk overlapping an existing node.
 */
export function nextScenePosition(story: Story): { x: number; y: number } {
  const positions = Object.values(story.scenes).map((scene) => scene.position);
  if (positions.length === 0) return { x: 320, y: 40 };
  const lowest = positions.reduce((a, b) => (b.y > a.y ? b : a));
  return { x: lowest.x, y: lowest.y + 180 };
}

/**
 * Places a child node below its parent, shifted right by the number of
 * siblings — creating three choices in a row must not stack them.
 */
export function childPosition(parent: Scene, siblings: number): { x: number; y: number } {
  return { x: parent.position.x + (siblings - 1) * 130, y: parent.position.y + 170 };
}
