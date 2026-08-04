import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Connection, EdgeChange, NodeChange, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { studio } from '@embranche/design-tokens';
import { createChoice, validateStory } from '@embranche/story-format';
import type { SceneId, Story } from '@embranche/story-format';

import { nextScenePosition, parseEdgeId, toEdges, toNodes } from '../lib/graph';
import type { SceneFlowNode } from '../lib/graph';
import { addScene, moveScene, removeChoice, updateChoice, updateScene } from '../lib/storyDoc';
import { downloadStoryJson } from '../lib/storage';
import { Inspector } from './Inspector';
import { IssuesBar } from './IssuesBar';
import { Playtest } from './Playtest';
import { SceneNode } from './SceneNode';

interface Props {
  story: Story;
  onChange: (story: Story) => void;
  onBack: () => void;
}

const nodeTypes: NodeTypes = { scene: SceneNode };

/** Ecran d'edition : canvas de scenes a gauche, panneau d'edition a droite. */
export function Editor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorCanvas {...props} />
    </ReactFlowProvider>
  );
}

function EditorCanvas({ story, onChange, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<SceneId | null>(story.startSceneId);
  const [playtesting, setPlaytesting] = useState(false);

  // Validation en direct : recalculee a chaque frappe, elle alimente a la fois
  // l'anneau d'alerte des noeuds et la barre du bas.
  const validation = useMemo(() => validateStory(story), [story]);
  const nodes = useMemo(
    () => toNodes(story, validation.issues, selectedId),
    [story, validation.issues, selectedId],
  );
  const edges = useMemo(() => toEdges(story, validation.issues), [story, validation.issues]);

  const onNodesChange = useCallback(
    (changes: NodeChange<SceneFlowNode>[]) => {
      let next = story;
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          next = moveScene(next, change.id, change.position);
        } else if (change.type === 'select' && change.selected) {
          setSelectedId(change.id);
        }
      }
      if (next !== story) onChange(next);
    },
    [story, onChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      let next = story;
      for (const change of changes) {
        if (change.type !== 'remove') continue;
        const parsed = parseEdgeId(change.id);
        if (parsed) next = removeChoice(next, parsed.sceneId, parsed.choiceId);
      }
      if (next !== story) onChange(next);
    },
    [story, onChange],
  );

  /**
   * Relier deux noeuds. Depuis la poignee d'un choix, on rebranche ce choix ;
   * depuis la poignee du bas, on cree un nouveau choix vers la cible.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle } = connection;
      if (!source || !target || !story.scenes[source] || !story.scenes[target]) return;

      if (sourceHandle && sourceHandle !== '__new') {
        onChange(updateChoice(story, source, sourceHandle, { target }));
        return;
      }
      const scene = story.scenes[source];
      if (!scene) return;
      const choice = createChoice({ target, label: story.scenes[target]?.title ?? 'Nouveau choix' });
      onChange(updateScene(story, source, { choices: [...scene.choices, choice] }));
    },
    [story, onChange],
  );

  const handleAddScene = () => {
    const result = addScene(story, nextScenePosition(story));
    onChange(result.story);
    setSelectedId(result.sceneId);
  };

  const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length;

  return (
    <>
      <div className="panel editor">
        <div className="toolbar">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            ← Mes histoires
          </button>
          <div className="toolbar__lights" aria-hidden="true">
            <span style={{ background: '#f0604d' }} />
            <span style={{ background: '#f7c043' }} />
            <span style={{ background: '#5cc25c' }} />
          </div>
          <div className="toolbar__title">Arbre des scènes</div>
          <div className="toolbar__story">« {story.title} »</div>
          <div className="app__spacer" />
          <span className={`pill pill--${errorCount > 0 ? 'error' : 'ok'}`}>
            {errorCount > 0 ? `${errorCount} erreur(s)` : 'Récit cohérent'}
          </span>
          <button type="button" className="btn btn--primary" onClick={handleAddScene}>
            ＋ Scène
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPlaytesting(true)}
            disabled={errorCount > 0}
            title={errorCount > 0 ? 'Corrige les erreurs bloquantes d’abord' : undefined}
          >
            ▶ Playtest
          </button>
          <button type="button" className="btn" onClick={() => downloadStoryJson(story)}>
            Exporter JSON
          </button>
        </div>

        <div className="editor__body">
          <div className="canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={() => setSelectedId(null)}
              fitView
              minZoom={0.2}
              maxZoom={1.8}
              proOptions={{ hideAttribution: false }}
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color={studio.gridDot} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) =>
                  (node as SceneFlowNode).data?.scene.ending ? studio.endingBadge : studio.chip
                }
                maskColor="rgba(250,247,241,.7)"
              />
            </ReactFlow>
          </div>

          <Inspector
            story={story}
            selectedId={selectedId}
            issues={validation.issues}
            onChange={onChange}
            onSelect={setSelectedId}
          />
        </div>

        <IssuesBar issues={validation.issues} onSelect={setSelectedId} />
      </div>

      {playtesting && (
        <Playtest story={story} fromSceneId={null} onClose={() => setPlaytesting(false)} />
      )}
    </>
  );
}
