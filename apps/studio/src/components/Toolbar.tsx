import { useEffect, useRef, useState } from 'react';

import { kinds } from '@embranche/design-tokens';
import type { SceneId, SceneKind } from '@embranche/story-format';

import type { SearchHit } from '../lib/search';
import type { StoryHistory } from '../hooks/useStoryHistory';

interface Props {
  storyTitle: string;
  errorCount: number;
  warningCount: number;
  history: StoryHistory;
  /** How many nodes are selected — drives the wording of the tools. */
  selectionCount: number;
  /**
   * Kinds that can be chained after the selected node, or `null` when there is
   * no single selection and the button creates a loose node.
   */
  chainableKinds: readonly SceneKind[] | null;
  selectedName: string | null;
  query: string;
  hits: SearchHit[];
  onQueryChange: (query: string) => void;
  onPickHit: (sceneId: SceneId) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  deadPaths: boolean;
  onToggleDeadPaths: () => void;
  onAddScene: (kind: SceneKind) => void;
  onArrange: () => void;
  onOpenVariables: () => void;
  onPlaytest: (fromSelection: boolean) => void;
  onExport: () => void;
  onBack: () => void;
  /** Unfolds the validation list at the bottom of the editor. */
  onShowIssues: () => void;
}

/**
 * Editor toolbar, in two rows: what the story *is* on top (where am I, is it
 * consistent, can I play it), what the author *does* below (write, arrange,
 * find). Mixing the two is what made the single row unreadable as soon as it
 * held more than five buttons.
 */
export function Toolbar(props: Props) {
  const { history, errorCount, warningCount, selectionCount } = props;
  const blocked = errorCount > 0;
  const health = storyHealth(errorCount, warningCount);

  return (
    <div className="toolbar">
      <div className="toolbar__row">
        <button type="button" className="btn btn--ghost" onClick={props.onBack}>
          ← Mes histoires
        </button>
        <div className="toolbar__story" title={props.storyTitle}>
          « {props.storyTitle} »
        </div>

        <div className="app__spacer" />

        {/*
          One pill, three states, and it is a button.
          Announcing « récit cohérent » next to a count of warnings was saying
          two things at once: a story that plays and a story that is finished
          are not the same claim, and the second is the one an author is
          checking. Pressing it opens the list of what is left.
        */}
        <button
          type="button"
          className={`pill pill--${health.tone} pill--button`}
          onClick={props.onShowIssues}
          title="Voir le détail de la validation"
        >
          {health.label}
        </button>

        <div className="toolbar__sep" aria-hidden="true" />

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => props.onPlaytest(false)}
          disabled={blocked}
          title={blocked ? 'Corrige les erreurs bloquantes d’abord' : 'Jouer depuis le début'}
        >
          ▶ Playtest
        </button>
        {/* STU-13: proofreading a late branch should not mean replaying the story. */}
        <button
          type="button"
          className="btn"
          onClick={() => props.onPlaytest(true)}
          disabled={blocked || selectionCount !== 1}
          title={
            selectionCount === 1
              ? 'Jouer à partir du nœud sélectionné'
              : 'Sélectionne un nœud pour jouer à partir de lui'
          }
        >
          ▶ D’ici
        </button>
        <button type="button" className="btn" onClick={props.onExport}>
          ⤓ Exporter
        </button>
      </div>

      <div className="toolbar__row toolbar__row--tools">
        <div className="toolbar__group">
          <button
            type="button"
            className="btn btn--icon"
            onClick={history.undo}
            disabled={!history.canUndo}
            title={`Annuler (Ctrl+Z) — ${history.depth} étape${history.depth > 1 ? 's' : ''}`}
            aria-label="Annuler"
          >
            ↶
          </button>
          <button
            type="button"
            className="btn btn--icon"
            onClick={history.redo}
            disabled={!history.canRedo}
            title="Rétablir (Ctrl+Maj+Z)"
            aria-label="Rétablir"
          >
            ↷
          </button>
        </div>

        <div className="toolbar__sep" aria-hidden="true" />

        {/*
          One button per kind, colored like the node it creates: the vocabulary
          of the format is meant to be learned by using it.
        */}
        <div className="toolbar__group">
          {(['npc', 'player', 'choice'] as const).map((kind) => {
            const allowed = props.chainableKinds === null || props.chainableKinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                className="btn btn--kind"
                style={{
                  background: kinds[kind].surface,
                  borderColor: kinds[kind].border,
                  color: kinds[kind].ink,
                }}
                disabled={!allowed}
                onClick={() => props.onAddScene(kind)}
                title={addHint(kind, allowed, selectionCount, props.selectedName)}
              >
                ＋ {kinds[kind].label}
              </button>
            );
          })}
        </div>

        <div className="toolbar__sep" aria-hidden="true" />

        <div className="toolbar__group">
          <button type="button" className="btn" onClick={props.onArrange} title="Ranger le graphe">
            ⤢ Ranger
          </button>
          <button
            type="button"
            className={`btn${props.focusMode ? ' btn--on' : ''}`}
            onClick={props.onToggleFocus}
            aria-pressed={props.focusMode}
            title="Éteindre ce qui ne mène pas au nœud sélectionné"
          >
            ◎ Focus
          </button>
          <button
            type="button"
            className={`btn${props.deadPaths ? ' btn--on' : ''}`}
            onClick={props.onToggleDeadPaths}
            aria-pressed={props.deadPaths}
            title="Repérer les nœuds qu’aucune partie ne peut atteindre"
          >
            ⌀ Chemins morts
          </button>
          <button type="button" className="btn" onClick={props.onOpenVariables}>
            ƒ Variables
          </button>
        </div>

        <div className="app__spacer" />

        <SearchBox
          query={props.query}
          hits={props.hits}
          onQueryChange={props.onQueryChange}
          onPick={props.onPickHit}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Why a creation button is offered, or why it is not.
 *
 * A refusal has to say what to do about it. Deselecting is the way out — a
 * loose node can then be wired wherever it belongs.
 */
function addHint(
  kind: SceneKind,
  allowed: boolean,
  selectionCount: number,
  selectedName: string | null,
): string {
  const label = kinds[kind].label.toLowerCase();
  if (!allowed) {
    return kind === 'choice'
      ? `« ${selectedName} » enchaîne déjà tout seul : y ajouter un choix mêlerait décision et enchaînement. Clique le fond pour créer un nœud libre.`
      : `« ${selectedName} » propose déjà des choix : y ajouter un nœud ${label} mêlerait décision et enchaînement. Clique le fond pour créer un nœud libre.`;
  }
  return selectionCount === 1
    ? `Ajouter un nœud ${label} à la suite du nœud sélectionné`
    : `Ajouter un nœud ${label}`;
}

/**
 * State of health of the story, in one sentence.
 *
 * Three states, because there are three: unplayable, playable but unfinished,
 * and clean. Collapsing the middle one into either of the others is what made
 * the badge look frozen — ordinary writing produces warnings, hardly ever
 * errors, so a two-state badge stayed green whatever the author did.
 */
function storyHealth(
  errorCount: number,
  warningCount: number,
): { tone: 'error' | 'warning' | 'ok'; label: string } {
  if (errorCount > 0) {
    return {
      tone: 'error',
      label: `${errorCount} erreur${errorCount > 1 ? 's' : ''} · injouable`,
    };
  }
  if (warningCount > 0) {
    return {
      tone: 'warning',
      label: `Jouable · ${warningCount} à revoir`,
    };
  }
  return { tone: 'ok', label: 'Récit cohérent' };
}

// ---------------------------------------------------------------------------

interface SearchProps {
  query: string;
  hits: SearchHit[];
  onQueryChange: (query: string) => void;
  onPick: (sceneId: SceneId) => void;
}

const FIELD_LABELS: Record<SearchHit['field'], string> = {
  title: 'titre',
  label: 'bouton',
  text: 'message',
  ending: 'fin',
  id: 'identifiant',
};

/**
 * Search box (STU-11). Matching nodes stay lit on the canvas while the query
 * holds: the list answers "where is it", the canvas answers "where is it *in
 * the story*", and the second question is the one a graph is for.
 */
function SearchBox({ query, hits, onQueryChange, onPick }: SearchProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      if (!box.current?.contains(event.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const showList = open && query.trim().length > 0;

  return (
    <div className="search" ref={box}>
      <div className="search__field">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          placeholder="Chercher une réplique…"
          aria-label="Chercher dans les scènes"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && hits[0]) {
              onPick(hits[0].sceneId);
              setOpen(false);
            }
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            className="search__clear"
            onClick={() => onQueryChange('')}
            aria-label="Effacer la recherche"
          >
            ✕
          </button>
        )}
      </div>

      {showList && (
        <div className="search__results" role="listbox">
          {hits.length === 0 && <div className="search__empty">Aucun nœud ne correspond.</div>}
          {hits.slice(0, 12).map((hit) => (
            <button
              key={hit.sceneId}
              type="button"
              className="search__hit"
              role="option"
              aria-selected="false"
              onClick={() => {
                onPick(hit.sceneId);
                setOpen(false);
              }}
            >
              <span className="search__hit-name">{hit.name}</span>
              <span className="search__hit-meta">
                {hit.kind} · {FIELD_LABELS[hit.field]}
              </span>
              <span className="search__hit-excerpt">{hit.excerpt}</span>
            </button>
          ))}
          {hits.length > 12 && (
            <div className="search__empty">et {hits.length - 12} autre(s) résultat(s)…</div>
          )}
        </div>
      )}
    </div>
  );
}
