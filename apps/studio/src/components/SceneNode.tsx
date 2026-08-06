import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import { kinds } from '@embranche/design-tokens';
import { sceneMessages } from '@embranche/story-format';

import type { SceneFlowNode } from '../lib/graph';

/**
 * Noeud du canvas.
 *
 * Sa couleur *est* son type : encre froide pour l'interlocuteur, vert pour la
 * voix du joueur, prune pour une decision. C'est la seule information qu'on
 * doit pouvoir lire sans zoomer, parce que c'est elle qui dit si la lecture
 * s'arrete la ou si elle continue toute seule.
 *
 * Un noeud n'a plus qu'une poignee d'entree et une de sortie : les choix ne
 * sont plus des lignes a l'interieur du noeud, ce sont des noeuds voisins.
 */
export function SceneNode({ data, selected }: NodeProps<SceneFlowNode>) {
  const { scene, isStart, issues, awaitsChoice } = data;
  const hasError = issues.some((issue) => issue.severity === 'error');
  const palette = kinds[scene.kind];
  const preview = sceneMessages(scene)
    .map((block) => block.text)
    .join(' ');

  const classes = [
    'scene-node',
    `scene-node--${scene.kind}`,
    scene.ending && 'scene-node--ending',
    selected && 'scene-node--selected',
    hasError && 'scene-node--invalid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      data-testid={`scene-node-${scene.id}`}
      style={
        scene.ending
          ? undefined
          : { background: palette.surface, borderColor: palette.border, color: palette.ink }
      }
    >
      <Handle type="target" position={Position.Top} />

      <div className="scene-node__head">
        <span
          className="scene-node__kind"
          style={{ background: palette.badge, color: palette.ink }}
          title={`Nœud ${palette.label.toLowerCase()}`}
        >
          {palette.label}
        </span>
        <div className="scene-node__title" title={scene.title}>
          {scene.kind === 'choice' ? scene.label || scene.title : scene.title || scene.id}
        </div>
        {isStart && <span className="scene-node__badge scene-node__badge--start">DÉPART</span>}
        {scene.ending && <span className="scene-node__badge scene-node__badge--ending">FIN</span>}
      </div>

      <div className="scene-node__preview">{preview || '—'}</div>

      {/*
        Ce qui se passe apres. Un noeud qui attend une decision se distingue
        d'un noeud qui enchaine seul — c'est toute la difference entre les deux
        moities du format, autant l'ecrire.
      */}
      {!scene.ending && (
        <div className="scene-node__flow">
          {awaitsChoice
            ? `${scene.next.length} choix proposé${scene.next.length > 1 ? 's' : ''}`
            : scene.next.length > 0
              ? 'enchaîne'
              : 'sans suite'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
