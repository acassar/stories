import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import { kinds } from '@embranche/design-tokens';
import { sceneMessages } from '@embranche/story-format';

import { PORT } from '../lib/graph';
import type { SceneFlowNode } from '../lib/graph';

/**
 * Canvas node.
 *
 * Its color *is* its kind: cold ink for the correspondent, green for the
 * player's voice, plum for a decision. That is the one piece of information
 * that must read without zooming, because it says whether the reading stops
 * there or carries on by itself.
 *
 * A node has a single grabbable input handle and a single grabbable output
 * handle: choices are not rows inside the node, they are neighboring nodes. The
 * side ports are not offered to the author — they exist so `routeOf` can send a
 * link around the cards instead of across them.
 */
export function SceneNode({ data, selected }: NodeProps<SceneFlowNode>) {
  const { scene, isStart, issues, awaitsChoice, focus, match, dead } = data;
  const hasError = issues.some((issue) => issue.severity === 'error');
  const hasWarning = !hasError && issues.length > 0;
  const palette = kinds[scene.kind];
  const preview = sceneMessages(scene)
    .map((block) => block.text)
    .join(' ');

  const classes = [
    'scene-node',
    `scene-node--${scene.kind}`,
    `scene-node--focus-${focus}`,
    scene.ending && 'scene-node--ending',
    selected && 'scene-node--selected',
    hasError && 'scene-node--invalid',
    match && 'scene-node--match',
    dead && 'scene-node--dead',
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
      <Handle type="target" position={Position.Top} id={PORT.in} />
      <SidePorts />

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
        What happens next. A node awaiting a decision reads differently from a
        node that chains on its own — that is the whole difference between the
        two halves of the format, so it is spelled out.
      */}
      {!scene.ending && (
        <div className="scene-node__flow">
          <span>
            {awaitsChoice
              ? `${scene.next.length} choix proposé${scene.next.length > 1 ? 's' : ''}`
              : scene.next.length > 0
                ? 'enchaîne'
                : 'sans suite'}
          </span>
          {/*
            The validation ring says something is wrong; this says what family
            of wrong, without opening the panel — and reads without color.
          */}
          {hasError && (
            <span className="scene-node__alert" title="Erreur bloquante">
              ⨯ erreur
            </span>
          )}
          {hasWarning && (
            <span className="scene-node__alert scene-node__alert--warn" title="Avertissement">
              ◦ à revoir
            </span>
          )}
        </div>
      )}

      {dead && (
        <div className="scene-node__dead" title="Aucune partie ne peut atteindre ce nœud">
          chemin mort
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id={PORT.out} />
    </div>
  );
}

/**
 * The four routing ports, invisible and not connectable.
 *
 * They are anchors, not affordances: showing them would suggest four ways of
 * drawing a link where there is only one, and letting the author grab them
 * would let the drawing decide the routing — which is the layout's job.
 */
function SidePorts() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id={PORT.inLeft}
        className="scene-node__port"
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Right}
        id={PORT.inRight}
        className="scene-node__port"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Left}
        id={PORT.outLeft}
        className="scene-node__port scene-node__port--out"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={PORT.outRight}
        className="scene-node__port scene-node__port--out"
        isConnectable={false}
      />
    </>
  );
}
