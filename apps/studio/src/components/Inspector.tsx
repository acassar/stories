import { useEffect, useState } from 'react';

import { STORY_THEMES, kinds, themeLabels } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import { collectStoryVariables, slugify } from '@embranche/story-format';
import type { Scene, SceneId, SceneKind, Story, ValidationIssue } from '@embranche/story-format';

import {
  addLink,
  removeLink,
  renameSceneId,
  setKind,
  setStartScene,
  soleIncomingLink,
  toggleEnding,
  updateLink,
  updateScene,
  updateStory,
} from '../lib/storyDoc';
import { formatWait } from '../lib/values';
import { ConditionEditor } from './ConditionEditor';
import { EffectEditor } from './EffectEditor';

interface Props {
  story: Story;
  selectedIds: SceneId[];
  issues: ValidationIssue[];
  onChange: (story: Story) => void;
  onSelect: (sceneId: SceneId) => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
}

/** Editing panel: the selected scene, or the story metadata. */
export function Inspector({
  story,
  selectedIds,
  issues,
  onChange,
  onSelect,
  onDeleteSelection,
  onDuplicateSelection,
}: Props) {
  const [tab, setTab] = useState<'scene' | 'story'>('scene');
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : undefined;
  const scene = selectedId ? story.scenes[selectedId] : undefined;
  const activeTab = scene ? tab : 'story';
  const knownVariables = [...collectStoryVariables(story)].sort();

  return (
    <aside className="inspector" aria-label="Panneau d’édition">
      {/*
        One datalist for the whole panel. Rendering it inside each condition row
        would repeat the same DOM id as many times as there are rows, and a
        duplicated id is a broken autocompletion.
      */}
      <datalist id="emb-known-variables">
        {knownVariables.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scene'}
          className={`tabs__tab${activeTab === 'scene' ? ' tabs__tab--on' : ''}`}
          onClick={() => setTab('scene')}
          disabled={!scene}
        >
          Nœud
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'story'}
          className={`tabs__tab${activeTab === 'story' ? ' tabs__tab--on' : ''}`}
          onClick={() => setTab('story')}
        >
          Récit
        </button>
      </div>

      {selectedIds.length > 1 ? (
        <SelectionPanel
          story={story}
          selectedIds={selectedIds}
          onSelect={onSelect}
          onDelete={onDeleteSelection}
          onDuplicate={onDuplicateSelection}
        />
      ) : activeTab === 'story' ? (
        <StoryPanel story={story} onChange={onChange} />
      ) : scene ? (
        <ScenePanel
          story={story}
          scene={scene}
          knownVariables={knownVariables}
          issues={issues.filter((issue) => issue.sceneId === scene.id)}
          onChange={onChange}
          onSelect={onSelect}
          onDelete={onDeleteSelection}
          onDuplicate={onDuplicateSelection}
        />
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------

/** Bulk gestures. Editing several nodes at once would mean editing none. */
function SelectionPanel({
  story,
  selectedIds,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  story: Story;
  selectedIds: SceneId[];
  onSelect: (sceneId: SceneId) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <>
      <div className="inspector__label">{selectedIds.length} nœuds sélectionnés</div>
      <div className="field__hint">
        Le contenu s’édite un nœud à la fois. Ici, les gestes qui portent sur le lot.
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {selectedIds.slice(0, 12).map((id) => (
          <button key={id} type="button" className="btn btn--small" onClick={() => onSelect(id)}>
            {kinds[story.scenes[id]?.kind ?? 'npc'].label} · {nodeName(story, id)}
          </button>
        ))}
        {selectedIds.length > 12 && (
          <div className="field__hint">et {selectedIds.length - 12} autre(s)…</div>
        )}
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        <button type="button" className="btn" onClick={onDuplicate}>
          Dupliquer le lot (Ctrl+D)
        </button>
        <button type="button" className="btn btn--danger" onClick={onDelete}>
          Supprimer {selectedIds.length} nœuds
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function StoryPanel({ story, onChange }: { story: Story; onChange: (story: Story) => void }) {
  const set = (patch: Partial<Story>) => onChange(updateStory(story, patch));

  return (
    <>
      <div className="inspector__label">Le récit</div>

      <label className="field">
        <span className="field__label">Titre</span>
        <input
          className="input"
          value={story.title}
          onChange={(event) => set({ title: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Auteur</span>
        <input
          className="input"
          value={story.author ?? ''}
          onChange={(event) => set({ author: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Accroche</span>
        <textarea
          className="textarea"
          rows={3}
          value={story.blurb ?? ''}
          onChange={(event) => set({ blurb: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Genre affiché</span>
        <input
          className="input"
          value={story.tag ?? ''}
          placeholder="Fantastique, Enquête…"
          onChange={(event) => set({ tag: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Teinte de reliure</span>
        <select
          className="select"
          value={story.theme ?? 'night'}
          onChange={(event) => set({ theme: event.target.value as StoryTheme })}
        >
          {STORY_THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {themeLabels[theme]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Durée (min)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={story.estimatedMinutes ?? 0}
            onChange={(event) =>
              set({ estimatedMinutes: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
        <label className="field">
          <span className="field__label">Version</span>
          <input
            className="input"
            value={story.version}
            onChange={(event) => set({ version: event.target.value })}
          />
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Interlocuteur</span>
          <input
            className="input"
            value={story.narrator?.name ?? ''}
            placeholder="Elara"
            onChange={(event) => set({ narrator: { ...story.narrator, name: event.target.value } })}
          />
        </label>
        <label className="field">
          <span className="field__label">Statut affiché</span>
          <input
            className="input"
            value={story.narrator?.status ?? ''}
            placeholder="en ligne"
            onChange={(event) =>
              set({
                narrator: {
                  ...story.narrator,
                  name: story.narrator?.name ?? '',
                  status: event.target.value,
                },
              })
            }
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Statut pendant une attente</span>
        <input
          className="input"
          value={story.narrator?.awayStatus ?? ''}
          placeholder="hors ligne"
          aria-describedby="emb-away-hint"
          onChange={(event) =>
            set({
              narrator: {
                ...story.narrator,
                name: story.narrator?.name ?? '',
                awayStatus: event.target.value,
              },
            })
          }
        />
        <span className="field__hint" id="emb-away-hint">
          Ce que le lecteur lit sous le nom tant que ton personnage n’a pas répondu. Chaque récit
          dit son absence à sa façon : « hors ligne », « en plongée », « injoignable ».
        </span>
      </label>

      <label className="field">
        <span className="field__label">Publication</span>
        <select
          className="select"
          value={story.status ?? 'draft'}
          onChange={(event) => set({ status: event.target.value as Story['status'] })}
        >
          <option value="draft">Brouillon</option>
          <option value="published">Publiée</option>
        </select>
      </label>

      <div className="field__hint" style={{ marginTop: 16 }}>
        Scène de départ : <strong>{story.scenes[story.startSceneId]?.title ?? '—'}</strong>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

interface ScenePanelProps {
  story: Story;
  scene: Scene;
  knownVariables: string[];
  issues: ValidationIssue[];
  onChange: (story: Story) => void;
  onSelect: (sceneId: SceneId) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function ScenePanel({
  story,
  scene,
  knownVariables,
  issues,
  onChange,
  onSelect,
  onDelete,
  onDuplicate,
}: ScenePanelProps) {
  const sceneIds = Object.keys(story.scenes);
  const isStart = story.startSceneId === scene.id;
  const palette = kinds[scene.kind];

  const set = (patch: Partial<Scene>) => onChange(updateScene(story, scene.id, patch));

  return (
    <>
      <div className="inline">
        <span className="inspector__label">Nœud sélectionné</span>
        <span className="app__spacer" />
        {isStart && <span className="pill pill--ok">Départ</span>}
      </div>

      {/*
        The kind comes first: it drives everything else in the panel, from the
        label to the reading behavior.
      */}
      <div className="field">
        <span className="field__label">Type de nœud</span>
        <div className="kind-picker">
          {(['npc', 'player', 'choice'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`kind-picker__option${scene.kind === kind ? ' kind-picker__option--on' : ''}`}
              style={
                scene.kind === kind
                  ? {
                      background: kinds[kind].surface,
                      borderColor: kinds[kind].border,
                      color: kinds[kind].ink,
                    }
                  : undefined
              }
              onClick={() => onChange(setKind(story, scene.id, kind))}
            >
              {kinds[kind].label}
            </button>
          ))}
        </div>
        <span className="field__hint">{kindHelp[scene.kind]}</span>
      </div>

      {/*
        The hint sits outside the label, tied by `aria-describedby`. Nested in
        it, it would become part of the accessible name of the field: a screen
        reader would announce the whole notice on every tab stop.
      */}
      {scene.kind === 'choice' && (
        <div className="field">
          <label className="field__label" htmlFor="emb-choice-label">
            Libellé du bouton
          </label>
          <input
            id="emb-choice-label"
            className="input"
            value={scene.label ?? ''}
            placeholder="Mentir"
            aria-describedby="emb-choice-label-hint"
            onChange={(event) => set({ label: event.target.value })}
          />
          <span className="field__hint" id="emb-choice-label-hint">
            Ce que le joueur lit sur le bouton. Le message envoyé, lui, s’écrit ci-dessous —
            laisse-le vide pour envoyer le libellé tel quel.
          </span>
        </div>
      )}

      <label className="field">
        <span className="field__label">Titre de travail</span>
        <input
          className="input"
          value={scene.title}
          onChange={(event) => set({ title: event.target.value })}
        />
      </label>

      <SceneIdField story={story} scene={scene} onChange={onChange} onSelect={onSelect} />

      {/*
        Offered on everything but a choice: there, the player is the one
        writing, and nobody keeps themselves waiting.
      */}
      {scene.kind !== 'choice' && (
        <label className="field">
          <span className="field__label">Attente avant ce message (min)</span>
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            value={scene.waitMinutes ?? 0}
            aria-describedby="emb-wait-hint"
            onChange={(event) => {
              const minutes = Math.max(0, Math.round(Number(event.target.value) || 0));
              // Zero is the absence of a wait, so it is written as an absence:
              // the field would otherwise appear in every exported scene.
              set({ waitMinutes: minutes === 0 ? undefined : minutes });
            }}
          />
          <span className="field__hint" id="emb-wait-hint">
            Du temps réel : {formatWait(Math.max(1, scene.waitMinutes ?? 0))} avant que ce message
            n’arrive. Chaque lecteur peut l’accélérer depuis ses réglages, jamais le rallonger.
          </span>
        </label>
      )}

      {scene.kind === 'choice' && (
        <IncomingLinkPanel
          story={story}
          scene={scene}
          knownVariables={knownVariables}
          sceneIds={sceneIds}
          onChange={onChange}
        />
      )}

      <div className="section" style={{ borderTopColor: palette.border }}>
        <div className="inline">
          <span className="field__label" style={{ margin: 0 }}>
            {scene.kind === 'npc' ? 'Messages envoyés' : 'Ce que dit le joueur'}
          </span>
          <span className="app__spacer" />
          <button
            type="button"
            className="btn btn--small"
            onClick={() => set({ blocks: [...scene.blocks, { text: '' }] })}
          >
            ＋ Message
          </button>
        </div>
        <div className="stack" style={{ marginTop: 8 }}>
          {scene.blocks.map((block, index) => (
            <div className="card" key={index}>
              <textarea
                className="textarea"
                rows={2}
                value={block.text}
                placeholder={
                  scene.kind === 'npc'
                    ? 'Ce qui arrive au joueur, en un message.'
                    : 'Ce que le joueur envoie, en un message.'
                }
                onChange={(event) =>
                  set({
                    blocks: scene.blocks.map((current, i) =>
                      i === index ? { ...current, text: event.target.value } : current,
                    ),
                  })
                }
                aria-label={`Message ${index + 1}`}
              />
              <div className="inline" style={{ marginTop: 6 }}>
                <span className="field__hint" style={{ margin: 0 }}>
                  Message {index + 1}
                </span>
                <span className="app__spacer" />
                <button
                  type="button"
                  className="btn btn--icon btn--danger"
                  onClick={() => set({ blocks: scene.blocks.filter((_, i) => i !== index) })}
                  aria-label={`Supprimer le message ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {scene.blocks.length === 0 && (
            <div className="field__hint">
              {scene.kind === 'choice'
                ? 'Sans message, c’est le libellé du bouton qui part dans la conversation.'
                : 'Aucun texte : le nœud passera sans rien afficher.'}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`btn toggle${scene.ending ? ' toggle--on' : ''}`}
        onClick={() => onChange(toggleEnding(story, scene.id))}
      >
        {scene.ending ? '✓ Nœud de fin' : 'Marquer comme fin'}
      </button>

      {scene.ending && (
        <div className="stack" style={{ marginTop: 12 }}>
          <label>
            <span className="field__label">Catégorie de fin</span>
            <input
              className="input"
              value={scene.ending.type}
              placeholder="Fin lumineuse"
              onChange={(event) => set({ ending: { ...scene.ending!, type: event.target.value } })}
            />
          </label>
          <label>
            <span className="field__label">Nom de la fin</span>
            <input
              className="input"
              value={scene.ending.name}
              onChange={(event) => set({ ending: { ...scene.ending!, name: event.target.value } })}
            />
          </label>
          <label>
            <span className="field__label">Phrase de clôture</span>
            <textarea
              className="textarea"
              rows={2}
              value={scene.ending.blurb}
              onChange={(event) => set({ ending: { ...scene.ending!, blurb: event.target.value } })}
            />
          </label>
        </div>
      )}

      {!scene.ending && (
        <div className="section">
          <div className="row-between">
            <span className="field__label" style={{ margin: 0 }}>
              Suites ({scene.next.length})
            </span>
            <select
              className="select select--compact"
              value=""
              onChange={(event) => {
                if (event.target.value) onChange(addLink(story, scene.id, event.target.value));
              }}
              aria-label="Relier à un nœud existant"
            >
              <option value="">＋ Relier à…</option>
              {sceneIds
                .filter((id) => !scene.next.some((link) => link.to === id))
                .map((id) => (
                  <option key={id} value={id}>
                    {kinds[story.scenes[id]!.kind].label} · {nodeName(story, id)}
                  </option>
                ))}
            </select>
          </div>

          <div className="field__hint" style={{ marginTop: -4 }}>
            {describeFlow(story, scene)}
          </div>

          <div className="stack" style={{ marginTop: 10 }}>
            {scene.next.map((link) => {
              const target = story.scenes[link.to];
              return (
                <div className="card" key={link.id}>
                  <div className="inline">
                    <span className="field__hint" style={{ flex: 'none', margin: 0 }}>
                      ↳ vers
                    </span>
                    <select
                      className="select select--compact"
                      style={{ flex: 1 }}
                      value={link.to}
                      onChange={(event) =>
                        onChange(updateLink(story, scene.id, link.id, { to: event.target.value }))
                      }
                      aria-label="Nœud cible"
                    >
                      {sceneIds.map((id) => (
                        <option key={id} value={id}>
                          {kinds[story.scenes[id]!.kind].label} · {nodeName(story, id)}
                        </option>
                      ))}
                    </select>
                    {target && (
                      <button
                        type="button"
                        className="btn btn--icon"
                        onClick={() => onSelect(target.id)}
                        title={`Ouvrir « ${nodeName(story, target.id)} »`}
                        aria-label={`Ouvrir ${nodeName(story, target.id)}`}
                      >
                        ↗
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--icon btn--danger"
                      onClick={() => onChange(removeLink(story, scene.id, link.id))}
                      aria-label={`Supprimer le lien vers ${nodeName(story, link.to)}`}
                    >
                      ✕
                    </button>
                  </div>

                  {/*
                    On a link to a choice, condition and effects can also be
                    edited from the choice node itself — it is the same object,
                    seen from both ends.
                  */}
                  <ConditionEditor
                    value={link.condition}
                    knownVariables={knownVariables}
                    sceneIds={sceneIds}
                    onChange={(condition) =>
                      onChange(updateLink(story, scene.id, link.id, { condition }))
                    }
                  />
                  <EffectEditor
                    value={link.effects}
                    knownVariables={knownVariables}
                    onChange={(effects) =>
                      onChange(updateLink(story, scene.id, link.id, { effects }))
                    }
                  />
                </div>
              );
            })}
            {scene.next.length === 0 && (
              <div className="field__hint">
                Aucune suite. Tire une arête depuis le nœud, ou relie-le ci-dessus à un nœud
                existant.
              </div>
            )}
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="stack" style={{ marginTop: 18 }}>
          {issues.map((issue, index) => (
            <div key={index} className={`pill pill--${issue.severity} pill--block`}>
              {issue.message}
            </div>
          ))}
        </div>
      )}

      <div className="stack" style={{ marginTop: 22 }}>
        <button
          type="button"
          className="btn"
          disabled={isStart}
          onClick={() => onChange(setStartScene(story, scene.id))}
        >
          Marquer comme scène de départ
        </button>
        <button type="button" className="btn" onClick={onDuplicate}>
          Dupliquer ce nœud
        </button>
        <button type="button" className="btn btn--danger" onClick={onDelete}>
          Supprimer ce nœud
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Renaming the node id (STU-8).
 *
 * `renameSceneId` already repoints every link that targeted the node, so the
 * operation is safe; what was missing was the field. The value is held locally
 * while typing — renaming on every keystroke would create one node id per
 * letter, and repoint the whole story each time.
 */
function SceneIdField({
  story,
  scene,
  onChange,
  onSelect,
}: {
  story: Story;
  scene: Scene;
  onChange: (story: Story) => void;
  onSelect: (sceneId: SceneId) => void;
}) {
  const [draft, setDraft] = useState(scene.id);
  useEffect(() => setDraft(scene.id), [scene.id]);

  const target = slugify(draft, scene.id);
  const taken = target !== scene.id && Boolean(story.scenes[target]);
  const changed = target !== scene.id;

  const apply = () => {
    if (!changed || taken) {
      setDraft(scene.id);
      return;
    }
    onChange(renameSceneId(story, scene.id, draft));
    onSelect(target);
  };

  return (
    <label className="field">
      <span className="field__label">Identifiant</span>
      <div className="inline">
        <input
          className="input input--mono"
          style={{ flex: 1 }}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={apply}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setDraft(scene.id);
          }}
          aria-label="Identifiant du nœud"
        />
        <button
          type="button"
          className="btn btn--small"
          disabled={!changed || taken}
          onClick={apply}
        >
          Renommer
        </button>
      </div>
      <span className="field__hint">
        {taken
          ? `« ${target} » est déjà pris.`
          : changed
            ? `Deviendra « ${target} » ; tous les liens qui visent ce nœud suivront.`
            : 'Il apparaît dans le JSON exporté et dans les conditions « a vu la scène ».'}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------

const kindHelp: Record<SceneKind, string> = {
  npc: 'L’interlocuteur parle. La lecture enchaîne toute seule vers la suite.',
  player: 'Le joueur parle, sans rien décider. La lecture enchaîne toute seule.',
  choice: 'Le joueur décide. C’est le seul type de nœud qui arrête la lecture.',
};

function nodeName(story: Story, id: SceneId): string {
  const scene = story.scenes[id];
  if (!scene) return id;
  return (scene.kind === 'choice' ? scene.label || scene.title : scene.title) || id;
}

/** States in plain words what the format infers from the kind of the targets. */
function describeFlow(story: Story, scene: Scene): string {
  const targets = scene.next
    .map((link) => story.scenes[link.to])
    .filter((target): target is Scene => Boolean(target));
  if (targets.length === 0) return 'Le récit s’arrête ici.';
  if (targets.some((target) => target.kind === 'choice')) {
    return `Le joueur choisit entre ${targets.length} réponse(s).`;
  }
  return targets.length > 1
    ? 'Enchaînement automatique : le premier lien dont la condition est remplie l’emporte.'
    : 'Enchaînement automatique : la suite arrive sans que le joueur agisse.';
}

/**
 * Condition and effects of the link that *leads* to this choice.
 *
 * They live on the edge — it is the path taken that has consequences, not the
 * node reached, which several routes may lead to. But for the author, "this
 * button only appears if..." is a property of the button, so they are shown
 * here, on the node, as long as there is a single incoming link.
 */
function IncomingLinkPanel({
  story,
  scene,
  knownVariables,
  sceneIds,
  onChange,
}: {
  story: Story;
  scene: Scene;
  knownVariables: string[];
  sceneIds: SceneId[];
  onChange: (story: Story) => void;
}) {
  const incoming = soleIncomingLink(story, scene.id);
  if (!incoming) {
    return (
      <div className="field__hint">
        Ce choix est atteint par plusieurs chemins : ouvre le nœud de départ concerné pour régler sa
        condition et ses effets.
      </div>
    );
  }

  return (
    <div className="section">
      {/*
        The link belongs to the node upstream, but it is read from here — "this
        button only appears if…". Cutting it should not mean going to look for
        its owner first, so the same panel that edits it can also remove it.
      */}
      <div className="row-between">
        <span className="field__label" style={{ margin: 0 }}>
          Lien depuis « {nodeName(story, incoming.sceneId)} »
        </span>
        <button
          type="button"
          className="btn btn--icon btn--danger"
          onClick={() => onChange(removeLink(story, incoming.sceneId, incoming.link.id))}
          title={`Supprimer le lien depuis « ${nodeName(story, incoming.sceneId)} »`}
          aria-label={`Supprimer le lien depuis ${nodeName(story, incoming.sceneId)}`}
        >
          ✕
        </button>
      </div>

      <span className="field__label" style={{ marginTop: 12 }}>
        Quand ce bouton apparaît
      </span>
      <ConditionEditor
        value={incoming.link.condition}
        knownVariables={knownVariables}
        sceneIds={sceneIds}
        onChange={(condition) =>
          onChange(updateLink(story, incoming.sceneId, incoming.link.id, { condition }))
        }
      />
      <span className="field__label" style={{ marginTop: 12 }}>
        Ce que l’appuyer déclenche
      </span>
      <EffectEditor
        value={incoming.link.effects}
        knownVariables={knownVariables}
        onChange={(effects) =>
          onChange(updateLink(story, incoming.sceneId, incoming.link.id, { effects }))
        }
      />
    </div>
  );
}
