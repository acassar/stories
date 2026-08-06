import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, EdgeChange, NodeChange, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { kinds, studio } from '@embranche/design-tokens';
import { exploreReachable } from '@embranche/story-engine';
import { validateStory } from '@embranche/story-format';
import type { SceneId, SceneKind, Story } from '@embranche/story-format';

import { useStoryHistory } from '../hooks/useStoryHistory';
import {
  childPosition,
  focusOn,
  nextScenePosition,
  parseEdgeId,
  toEdges,
  toNodes,
} from '../lib/graph';
import type { SceneFlowNode } from '../lib/graph';
import { arrangeStory } from '../lib/layout';
import { searchScenes } from '../lib/search';
import {
  addChild,
  addLink,
  addScene,
  canChainTo,
  canLink,
  copyScenes,
  moveScene,
  pasteScenes,
  removeLink,
  removeScene,
  removeScenes,
} from '../lib/storyDoc';
import type { SceneClipboard } from '../lib/storyDoc';
import { downloadStoryJson } from '../lib/storage';
import { Inspector } from './Inspector';
import { IssuesBar } from './IssuesBar';
import { Playtest } from './Playtest';
import { SceneNode } from './SceneNode';
import { Toolbar } from './Toolbar';
import { VariablesPanel } from './VariablesPanel';

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
  const history = useStoryHistory(story, onChange);
  const commit = history.commit;

  const [selectedIds, setSelectedIds] = useState<SceneId[]>(() =>
    story.scenes[story.startSceneId] ? [story.startSceneId] : [],
  );
  const [playtestFrom, setPlaytestFrom] = useState<SceneId | null | undefined>(undefined);
  const [showVariables, setShowVariables] = useState(false);
  const [query, setQuery] = useState('');
  const [focusMode, setFocusMode] = useState(true);
  const [deadPaths, setDeadPaths] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [issuesOpen, setIssuesOpen] = useState(false);

  const clipboard = useRef<SceneClipboard | null>(null);
  const { setCenter, fitView } = useReactFlow();

  // A single selected node is *the* selected node — that is what the inspector
  // edits and what the focus lights up. Several is a bulk gesture.
  const primaryId = selectedIds.length === 1 ? (selectedIds[0] as SceneId) : null;

  // Live validation: recomputed on every keystroke, it feeds both the alert
  // ring on the nodes and the bottom bar.
  const validation = useMemo(() => validateStory(story), [story]);
  const hits = useMemo(() => searchScenes(story, query), [story, query]);
  const matches = useMemo(() => new Set(hits.map((hit) => hit.sceneId)), [hits]);

  const focus = useMemo(
    () => (focusMode ? focusOn(story, selectedIds) : undefined),
    [story, selectedIds, focusMode],
  );

  /*
   * Condition-aware reachability is a state-space search, so it only runs when
   * the author asks for it (STU-14). The graph-level orphan warning stays on
   * permanently — it is cheap and answers a different question.
   */
  const reach = useMemo(() => (deadPaths ? exploreReachable(story) : null), [story, deadPaths]);
  const dead = useMemo(() => {
    if (!reach?.exhaustive) return undefined;
    return new Set(Object.keys(story.scenes).filter((id) => !reach.scenes.has(id)));
  }, [reach, story]);
  const deadLinks = useMemo(() => {
    if (!reach?.exhaustive) return undefined;
    const unused = new Set<string>();
    for (const scene of Object.values(story.scenes)) {
      for (const link of scene.next) {
        if (story.scenes[link.to] && !reach.links.has(`${scene.id}:${link.id}`)) {
          unused.add(`${scene.id}:${link.id}`);
        }
      }
    }
    return unused;
  }, [reach, story]);

  const projection = useMemo(
    () => ({ focus, matches, dead, deadLinks }),
    [focus, matches, dead, deadLinks],
  );

  const nodes = useMemo(
    () => toNodes(story, validation.issues, selectedIds, projection),
    [story, validation.issues, selectedIds, projection],
  );
  const edges = useMemo(
    () => toEdges(story, validation.issues, projection),
    [story, validation.issues, projection],
  );

  /** Selects a node and brings it into view — used by search, issues, links. */
  const reveal = useCallback(
    (sceneId: SceneId) => {
      setSelectedIds([sceneId]);
      const scene = story.scenes[sceneId];
      if (scene)
        setCenter(scene.position.x + 95, scene.position.y + 45, { zoom: 1, duration: 320 });
    },
    [story, setCenter],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<SceneFlowNode>[]) => {
      let next = story;
      let selection: SceneId[] | null = null;
      const current = new Set(selectedIds);

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          next = moveScene(next, change.id, change.position);
        } else if (change.type === 'select') {
          // Box selection sends one change per node: the batch is applied to
          // the whole set rather than to the last change alone.
          if (change.selected) current.add(change.id);
          else current.delete(change.id);
          selection = [...current];
        } else if (change.type === 'remove') {
          next = removeScene(next, change.id);
          current.delete(change.id);
          selection = [...current];
        }
      }

      if (selection) setSelectedIds(selection);
      if (next !== story) commit(next);
    },
    [story, commit, selectedIds],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      let next = story;
      for (const change of changes) {
        if (change.type !== 'remove') continue;
        const parsed = parseEdgeId(change.id);
        if (parsed) next = removeLink(next, parsed.sceneId, parsed.linkId);
      }
      if (next !== story) commit(next);
    },
    [story, commit],
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
      if (next !== story) commit(next);
    },
    [story, commit],
  );

  /**
   * The connection is refused rather than allowed to create an inconsistency:
   * mixing, under one node, links to choices and chaining links means nothing —
   * the reader would not know whether to wait for the player.
   */
  const isValidConnection = useCallback(
    (connection: Connection | { source: string; target: string }) =>
      canLink(story, connection.source, connection.target),
    [story],
  );

  /*
   * The creation buttons obey the same rule as the drag. Offering a kind the
   * graph will refuse, then reporting the error a moment later, would make the
   * toolbar disagree with the canvas about what the format allows.
   */
  const chainable = useMemo(() => {
    if (!primaryId) return null;
    return (['npc', 'player', 'choice'] as const).filter((kind) =>
      canChainTo(story, primaryId, kind),
    );
  }, [story, primaryId]);

  const handleAddScene = useCallback(
    (kind: SceneKind) => {
      const parent = primaryId ? story.scenes[primaryId] : undefined;
      // From a selected node, create the continuation: the node *and* its link.
      const result = parent
        ? addChild(story, parent.id, kind, childPosition(parent, parent.next.length + 1))
        : addScene(story, kind, nextScenePosition(story));
      commit(result.story);
      setSelectedIds([result.sceneId]);
    },
    [story, primaryId, commit],
  );

  const handleArrange = useCallback(() => {
    commit(arrangeStory(story));
    // The graph moved wholesale: keeping the old viewport would lose the
    // author. The wait lets React Flow take the new positions in first.
    window.setTimeout(() => void fitView({ duration: 420, padding: 0.2 }), 120);
  }, [story, commit, fitView]);

  const handleCopy = useCallback(() => {
    const copied = copyScenes(story, selectedIds);
    if (copied) clipboard.current = copied;
  }, [story, selectedIds]);

  const handlePaste = useCallback(() => {
    if (!clipboard.current) return;
    const result = pasteScenes(story, clipboard.current);
    commit(result.story);
    setSelectedIds(result.sceneIds);
  }, [story, commit]);

  const handleDuplicate = useCallback(() => {
    const copied = copyScenes(story, selectedIds);
    if (!copied) return;
    const result = pasteScenes(story, copied);
    commit(result.story);
    setSelectedIds(result.sceneIds);
  }, [story, selectedIds, commit]);

  const handleDeleteSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    commit(removeScenes(story, selectedIds));
    setSelectedIds([]);
  }, [story, selectedIds, commit]);

  /*
   * Keyboard shortcuts. They stand down as soon as the author is typing: a text
   * field has its own undo, and stealing Ctrl+Z from it would be worse than not
   * offering the shortcut at all.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        history.undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        history.redo();
      } else if (key === 'c') {
        handleCopy();
      } else if (key === 'v') {
        handlePaste();
      } else if (key === 'd') {
        event.preventDefault();
        handleDuplicate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history, handleCopy, handlePaste, handleDuplicate]);

  const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = validation.issues.length - errorCount;

  return (
    <>
      <div className="panel editor">
        <Toolbar
          storyTitle={story.title}
          errorCount={errorCount}
          warningCount={warningCount}
          history={history}
          selectionCount={selectedIds.length}
          chainableKinds={chainable}
          selectedName={primaryId ? (story.scenes[primaryId]?.title ?? primaryId) : null}
          query={query}
          hits={hits}
          onQueryChange={setQuery}
          onPickHit={reveal}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((on) => !on)}
          deadPaths={deadPaths}
          onToggleDeadPaths={() => setDeadPaths((on) => !on)}
          onAddScene={handleAddScene}
          onArrange={handleArrange}
          onOpenVariables={() => setShowVariables(true)}
          onPlaytest={(fromSelection) => setPlaytestFrom(fromSelection ? primaryId : null)}
          onExport={() => downloadStoryJson(story)}
          onBack={onBack}
          onShowIssues={() => setIssuesOpen(true)}
        />

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
              onPaneClick={() => setSelectedIds([])}
              fitView
              minZoom={0.15}
              maxZoom={1.8}
              proOptions={{ hideAttribution: false }}
              deleteKeyCode={['Backspace', 'Delete']}
              connectionRadius={28}
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

              <Panel position="top-left">
                <Legend
                  focusMode={focusMode}
                  focusedOn={primaryId ? (story.scenes[primaryId]?.title ?? primaryId) : null}
                  selectionCount={selectedIds.length}
                  matchCount={query.trim() ? hits.length : null}
                  deadCount={deadPaths ? (dead ? dead.size : null) : undefined}
                />
              </Panel>

              {selectedIds.length > 1 && (
                <Panel position="bottom-center">
                  <div className="bulk">
                    <span>{selectedIds.length} nœuds sélectionnés</span>
                    <button type="button" className="btn btn--small" onClick={handleDuplicate}>
                      Dupliquer
                    </button>
                    <button type="button" className="btn btn--small" onClick={handleCopy}>
                      Copier
                    </button>
                    <button
                      type="button"
                      className="btn btn--small btn--danger"
                      onClick={handleDeleteSelection}
                    >
                      Supprimer
                    </button>
                  </div>
                </Panel>
              )}
            </ReactFlow>

            <button
              type="button"
              className="inspector__handle"
              onClick={() => setInspectorOpen((open) => !open)}
              aria-expanded={inspectorOpen}
              title={inspectorOpen ? 'Replier le panneau' : 'Déplier le panneau'}
            >
              {inspectorOpen ? '›' : '‹'}
            </button>
          </div>

          {inspectorOpen && (
            <Inspector
              story={story}
              selectedIds={selectedIds}
              issues={validation.issues}
              onChange={commit}
              onSelect={reveal}
              onDeleteSelection={handleDeleteSelection}
              onDuplicateSelection={handleDuplicate}
            />
          )}
        </div>

        <IssuesBar
          issues={validation.issues}
          open={issuesOpen && validation.issues.length > 0}
          onToggle={() => setIssuesOpen((open) => !open)}
          onSelect={reveal}
        />
      </div>

      {playtestFrom !== undefined && (
        <Playtest
          story={story}
          fromSceneId={playtestFrom}
          onClose={() => setPlaytestFrom(undefined)}
        />
      )}

      {showVariables && (
        <VariablesPanel
          story={story}
          onSelect={(sceneId) => {
            reveal(sceneId);
            setShowVariables(false);
          }}
          onClose={() => setShowVariables(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

interface LegendProps {
  focusMode: boolean;
  focusedOn: string | null;
  selectionCount: number;
  /** Number of search hits, or `null` when the box is empty. */
  matchCount: number | null;
  /** Dead nodes, `null` when the analysis was truncated, `undefined` when off. */
  deadCount: number | null | undefined;
}

/**
 * What the canvas is currently saying. The colors carry a lot — kind, focus,
 * search, dead paths — and a legend is cheaper than making the author guess.
 */
function Legend({ focusMode, focusedOn, selectionCount, matchCount, deadCount }: LegendProps) {
  return (
    <div className="legend">
      <div className="legend__kinds">
        {(['npc', 'player', 'choice'] as const).map((kind) => (
          <span className="legend__kind" key={kind}>
            <span
              className="legend__swatch"
              style={{ background: kinds[kind].surface, borderColor: kinds[kind].border }}
              aria-hidden="true"
            />
            {kinds[kind].label}
          </span>
        ))}
      </div>

      {focusMode && focusedOn && selectionCount === 1 && (
        <div className="legend__line">
          <span className="legend__dash legend__dash--up" aria-hidden="true" />y mène ·
          <span className="legend__dash legend__dash--down" aria-hidden="true" />
          en découle — « {focusedOn} »
        </div>
      )}

      {matchCount !== null && (
        <div className="legend__line">
          {matchCount === 0
            ? 'Aucun nœud ne correspond à la recherche.'
            : `${matchCount} nœud(s) trouvé(s), surlignés sur le canevas.`}
        </div>
      )}

      {deadCount !== undefined && (
        <div className="legend__line">
          {deadCount === null
            ? 'Analyse des chemins morts interrompue : récit trop ramifié pour conclure.'
            : deadCount === 0
              ? 'Aucun chemin mort : toute scène est atteignable en jeu.'
              : `${deadCount} nœud(s) qu’aucune partie ne peut atteindre.`}
        </div>
      )}
    </div>
  );
}

/** True when the event targets a field where the browser owns the keyboard. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== 'string') return false;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable === true
  );
}
