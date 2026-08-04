import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import type { SceneFlowNode } from '../lib/graph';

/**
 * Noeud de scene : titre, badge, apercu du texte, et une poignee de sortie par
 * choix. Tirer la poignee d'un choix rebranche *ce* choix — c'est ce qui rend
 * l'edition des liens directe sur le canvas.
 */
export function SceneNode({ data, selected }: NodeProps<SceneFlowNode>) {
  const { scene, isStart, issues } = data;
  const hasError = issues.some((issue) => issue.severity === 'error');
  const preview = scene.blocks.map((block) => block.text).join(' ') || '—';

  const classes = [
    'scene-node',
    scene.ending && 'scene-node--ending',
    selected && 'scene-node--selected',
    hasError && 'scene-node--invalid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-testid={`scene-node-${scene.id}`}>
      <Handle type="target" position={Position.Top} />

      <div className="scene-node__head">
        <div className="scene-node__title" title={scene.title}>
          {scene.title || scene.id}
        </div>
        {isStart && <span className="scene-node__badge scene-node__badge--start">DÉPART</span>}
        <span
          className={`scene-node__badge${scene.ending ? ' scene-node__badge--ending' : ''}`}
        >
          {scene.ending ? 'FIN' : `${scene.choices.length} choix`}
        </span>
      </div>

      <div className="scene-node__preview">{preview}</div>

      {scene.choices.length > 0 && (
        <div className="scene-node__choices">
          {scene.choices.map((choice) => {
            const broken = issues.some((issue) => issue.choiceId === choice.id);
            const classNames = [
              'scene-node__choice',
              choice.condition && 'scene-node__choice--conditional',
              broken && 'scene-node__choice--broken',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={choice.id} className={classNames} title={choice.label}>
                {choice.condition ? '◇ ' : '→ '}
                {choice.label}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={choice.id}
                  // Chaque poignee est calee sur sa ligne de choix.
                  style={{ top: '50%', right: -14 }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Poignee generique : tirer depuis le bas cree un nouveau choix. */}
      <Handle type="source" position={Position.Bottom} id="__new" />

      {hasError && <div className="scene-node__alert">⚠ {issues[0]?.message}</div>}
    </div>
  );
}
