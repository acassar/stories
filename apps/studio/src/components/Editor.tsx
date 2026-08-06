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

import { kinds, studio } from '@embranche/design-tokens';
import { validateStory } from '@embranche/story-format';
import type { SceneId, SceneKind, Story } from '@embranche/story-format';

import { childPosition, nextScenePosition, parseEdgeId, toEdges, toNodes } from '../lib/graph';
import type { SceneFlowNode } from '../lib/graph';
import { addChild, addLink, addScene, moveScene, removeLink } from '../lib/storyDoc';
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

/** Editing screen: scene canvas on the left, editing panel on the right. */
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

  // Live validation: recomputed on every keystroke, it feeds both the alert
  // ring on the nodes and the bottom bar.
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
        if (parsed) next = removeLink(next, parsed.sceneId, parsed.linkId);
      }
      if (next !== story) onChange(next);
    },
    [story, onChange],
  );

  /**
   * Dragging an edge creates a link. That is the whole "reach a distant node"
   * gesture: nothing forces going through a choice, and the target can be any
   * node already written.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      const next = addLink(story, source, target);
      if (next !== story) onChange(next);
    },
    [story, onChange],
  );

  /**
   * The connection is refused rather than allowed to create an inconsistency:
   * mixing, under one node, links to choices and chaining links means nothing —
   * the reader would not know whether to wait for the player.
   */
  const isValidConnection = useCallback(
    (connection: Connection | { source: string; target: string }) => {
      const source = story.scenes[connection.source];
      const target = story.scenes[connection.target];
      if (!source || !target) return false;
      if (source.next.some((link) => link.to === target.id)) return false;

      const existing = source.next
        .map((link) => story.scenes[link.to])
        .filter((scene): scene is NonNullable<typeof scene> => Boolean(scene));
      if (existing.length === 0) return true;
      return existing.every((scene) => (scene.kind === 'choice') === (target.kind === 'choice'));
    },
    [story],
  );

  const handleAddScene = (kind: SceneKind) => {
    const parent = selectedId ? story.scenes[selectedId] : undefined;
    // From a selected node, create the continuation: the node *and* its link.
    const result = parent
      ? addChild(story, parent.id, kind, childPosition(parent, parent.next.length + 1))
      : addScene(story, kind, nextScenePosition(story));
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
          {/*
            One button per kind, colored like the node it creates: the
            vocabulary of the format is meant to be learned by using it.
          */}
          {(['npc', 'player', 'choice'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className="btn btn--kind"
              style={{
                background: kinds[kind].surface,
                borderColor: kinds[kind].border,
                color: kinds[kind].ink,
              }}
              onClick={() => handleAddScene(kind)}
              title={
                selectedId
                  ? `Ajouter un nœud ${kinds[kind].label.toLowerCase()} à la suite du nœud sélectionné`
                  : `Ajouter un nœud ${kinds[kind].label.toLowerCase()}`
              }
            >
              ＋ {kinds[kind].label}
            </button>
          ))}
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
              isValidConnection={isValidConnection}
              onPaneClick={() => setSelectedId(null)}
              fitView
              minZoom={0.2}
              maxZoom={1.8}
              proOptions={{ hideAttribution: false }}
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1.2}
                color={studio.gridDot}
              />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => {
                  const scene = (node as SceneFlowNode).data?.scene;
                  if (!scene) return studio.chip;
                  return scene.ending ? studio.endingBadge : kinds[scene.kind].border;
                }}
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
